
import argparse
import http.server
import json
import os
import pathlib
import socket
import subprocess
import webbrowser


def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0


LANGUAGES_EXTENSIONS = {
    ".py": "Python",
    ".ipynb": "Python",
    ".c": "C",
    ".cpp": "C",
    ".h": "C",
    ".ps1": "Shell",
    ".sh": "Shell",
    ".bat": "Shell",
    ".js": "JS",
    ".html": "HTML",
    ".css": "CSS",
    ".au3": "AutoIt",
}


BASE_DIR = os.path.dirname(__file__)
CONFIG_FILE_PATH = os.path.join(BASE_DIR, "config.json")
TAGS_FILE_PATH = os.path.join(BASE_DIR, "tags.json")
FOLDERS_FILE_PATH = os.path.join(BASE_DIR, "folders.json")


def scan_folder_languages(top):
    languages = set()
    for root, dirnames, filenames in os.walk(top):
        for filename in filenames:
            path, ext = os.path.splitext(filename)
            if ext in LANGUAGES_EXTENSIONS:
                languages.add(LANGUAGES_EXTENSIONS[ext])
    return sorted(languages)


class RequestHandler(http.server.BaseHTTPRequestHandler):

    @property
    def location(self):
        return self.path.split("?")[0]

    @property
    def query(self):
        args = map(lambda x: x.split("="), self.path.split("?")[1].split("&"))
        return { k: v for k, v in args }

    def do_GET(self):
        if self.location == "/scan":
            self.scan()
        elif self.location == "/action":
            self.action()
        elif self.location == "/languages":
            self.languages()
        else:
            self.serve_file()

    def save(self, json_data, path):
        with open(path, "wb") as file:
            file.write(json_data)

    def do_POST(self):
        json_data = self.rfile.read(int(self.headers.get('content-length', 0)))
        if self.location == "/save/tags":
            self.save(json_data, "tags.json")
        elif self.location == "/save/folders":
            self.save(json_data, "folders.json")
        self.json({})

    def json(self, data):
        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf8"))

    def scan(self):
        folders = []
        for dirname in next(os.walk(self.server.config["folder"]))[1]:
            folders.append({
                "dirname": dirname,
                "mtime": os.path.getmtime(os.path.join(self.server.config["folder"], dirname))
            })
        self.json({
            "root": self.server.config["folder"],
            "folders": folders
        })

    def languages(self):
        query = self.query
        path = pathlib.Path(self.server.config["folder"]) / query["dirname"]
        languages = scan_folder_languages(path)
        self.json(languages)

    def action(self):
        query = self.query
        path = pathlib.Path(self.server.config["folder"]) / query["dirname"]
        if query["action"] == "explorer":
            self.action_explorer(path)
        elif query["action"] == "vscode":
            self.action_vscode(path)
        elif query["action"] == "terminal":
            self.action_terminal(path)
        return self.json({})
    
    def action_explorer(self, path):
        subprocess.Popen(["explorer", path])

    def action_vscode(self, path):
        DETACHED_PROCESS = 0x00000008
        subprocess.Popen([self.server.config["vscode"], path], creationflags=DETACHED_PROCESS, start_new_session=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)

    def action_terminal(self, path):
        subprocess.Popen(["wt", "-d", path])
    
    def serve_file(self):
        is_index = False
        if self.path == "/":
            self.path = "/index.html"
        if self.path == "/index.html":
            is_index = True
        fpath = os.path.join(__file__, os.pardir, self.path[1:])
        if os.path.isfile(fpath):
            self.send_response(200)
            if fpath.endswith(".html"):
                self.send_header("Content-type", "text/html")
            elif fpath.endswith(".js"):
                self.send_header("Content-type", "text/javascript")
            elif fpath.endswith(".css"):
                self.send_header("Content-type", "text/css")
            self.end_headers()
            with open(fpath, "rb") as file:
                if is_index:
                    html = file.read().decode("utf8")
                    json_string_tags = "{}"
                    if os.path.isfile(TAGS_FILE_PATH):
                        with open(TAGS_FILE_PATH, "r", encoding="utf8") as jfile:
                            json_string_tags = jfile.read()
                    json_string_folders = "{}"
                    if os.path.isfile(TAGS_FILE_PATH):
                        with open(FOLDERS_FILE_PATH, "r", encoding="utf8") as jfile:
                            json_string_folders = jfile.read()
                    self.wfile.write(html.replace("JSON_STRING_TAGS", json_string_tags).replace("JSON_STRING_FOLDERS", json_string_folders).encode("utf8"))
                else:
                    self.wfile.write(file.read())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"404 NOT FOUND")
        

class Server(http.server.HTTPServer):

    def __init__(self, config):
        self.config = config
        http.server.HTTPServer.__init__(self, ("", self.config["port"]), RequestHandler)


def create_config(config_path):
    print("Could not find a valid configuration, please provide the following info:")
    config = {}
    config["folder"] = input("Path to folder: ")
    config["port"] = int(input("Local server port: "))
    config["vscode"] = input("Path to code editor: ")
    with config_path.open("w", encoding="utf8") as file:
        json.dump(config, file, indent=4)
    return config


def load_config(config_path):
    if not config_path.exists():
        return create_config(config_path)
    with config_path.open("r", encoding="utf8") as file:
        config = json.load(file)
    return config


def run(config):
    webbrowser.open("http://localhost:%d/" % config["port"])
    if is_port_in_use(config["port"]):
        print("Port already in use, closing this process")
        return
    print("Starting server at http://localhost:%d/. Press ^C to stop." % config["port"])
    try:
        Server(config).serve_forever()
    except KeyboardInterrupt:
        print("User interrupt, closing")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-c", "--config", type=str, default=CONFIG_FILE_PATH)
    args = parser.parse_args()
    config_path = pathlib.Path(args.config)
    config = load_config(config_path)
    run(config)


if __name__ == "__main__":
    main()