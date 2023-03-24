/* Constants *****************************************************************/

const STATUS = ["fork", "idea", "draft", "beta", "prod", "archive"];

/* General utility functions *************************************************/

function show_modal(modal_id) {
    document.getElementById(modal_id).classList.add("active");
}

function close_modal(modal_id) {
    document.getElementById(modal_id).classList.remove("active");
}

function format_mtime(timestamp_seconds) {
    const date = new Date(timestamp_seconds * 1000);
    return `${ date.getFullYear() }-${ date.getMonth().toString().padStart(2, "0") }-${ date.getDate().toString().padStart(2, "0") } ${ date.getHours().toString().padStart(2, "0") }:${ date.getMinutes().toString().padStart(2, "0") }:${ date.getSeconds().toString().padStart(2, "0") }`;
}

function is_element_in_viewport(element) {
    var rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && /* or $(window).height() */
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */
    );
}

function invert_color(hex) {
    if (hex.indexOf('#') === 0) {
        hex = hex.slice(1);
    }
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) {
        throw new Error('Invalid HEX color.');
    }
    var r = parseInt(hex.slice(0, 2), 16),
        g = parseInt(hex.slice(2, 4), 16),
        b = parseInt(hex.slice(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 186 ?
        '#000000' :
        '#FFFFFF';
}

/* Specific utility functions ************************************************/

function create_tag_element(tag, button_text, button_callback) {
    const element = document.createElement("div");
    element.classList.add("tag");
    if (tag) {
        element.setAttribute("index", tag.index);
        element.setAttribute("label", tag.label);
        element.style.background = tag.color;
        if (tag.color.match(/^#[0-9a-f]{6}$/i)) {
            element.style.color = invert_color(tag.color);
        }
        const label = document.createElement("span");
        label.classList.add("tag-label");
        label.textContent = tag.label;
        element.appendChild(label);
    } else {
        element.setAttribute("label", "");
    }
    if (button_text) {
        const button = document.createElement("span");
        button.classList.add("tag-button");
        button.textContent = button_text;
        if (button_callback) {
            button.addEventListener("click", button_callback);
        }
        element.appendChild(button);
    }
    return element;
}

function set_tag_form_color_callback(tag_form) {
    const input = tag_form.querySelector("input[name='color']");

    function callback() {
        const color = input.value;
        if (color.match(/^#[0-9a-f]{6}$/i)) {
            tag_form.style.backgroundColor = color;
            tag_form.style.color = invert_color(color);
            tag_form.style.borderColor = invert_color(color);
        }
    }

    input.addEventListener("input", callback);
    callback();
}

function inflate_status_menu(controller) {
    const status_menu = document.getElementById("folder-status-menu");
    status_menu.innerHTML = "";
    STATUS.forEach(status => {
        const menu_item = document.createElement("div");
        menu_item.textContent = status;
        menu_item.classList.add("menu-item");
        menu_item.addEventListener("click", () => {
            status_menu.classList.add("hidden");
            controller.get(status_menu.getAttribute("dirname")).set_status(status);
            controller.save_folder_data();
        });
        status_menu.appendChild(menu_item);
    });
    status_menu.addEventListener("mouseleave", () => {
        status_menu.classList.add("hidden");
    });
}

/* Data classes **************************************************************/

class Folder {

    constructor(controller, data) {
        this.controller = controller;
        this.dirname = data.dirname;
        this.first_letter = this.dirname.toUpperCase().trim().charAt(0);
        if (this.first_letter.match(/[0-9]/)) {
            this.first_letter = "0";
        }
        this.mtime = data.mtime;
        this.status = null;
        this.languages = [];
        this.element = null;
        this.tags = [];
    }

    inflate(container) {
        const template = document.getElementById("template-folder");
        const node = document.importNode(template.content, true);
        container.appendChild(node);
        this.element = container.querySelector("div.folder:last-child");
        this.element.querySelector(".folder-name").textContent = this.dirname;
        var self = this;
        this.element.querySelector(".btn-vscode").addEventListener("click", () => { self.execute("vscode"); });
        this.element.querySelector(".btn-terminal").addEventListener("click", () => { self.execute("terminal"); });
        this.element.querySelector(".btn-copy").addEventListener("click", () => {
            navigator.clipboard.writeText(`"${ self.controller.root }/${ self.dirname}"`);
        });
        this.element.addEventListener("dblclick", () => { self.execute("explorer"); });
        this.element.querySelector(".folder-mtime").textContent = format_mtime(this.mtime);
        const tag_add_element = create_tag_element(null, "+", () => {
            const modal = document.getElementById("modal-tag-choice");
            modal.setAttribute("dirname", self.dirname);
            modal.classList.add("active");
        });
        this.element.querySelector(".folder-tags").appendChild(tag_add_element);

        this.tags.forEach(tag_index => {
            if (tag_index in this.controller.tags) {
                this.add_tag_element(this.controller.tags[tag_index]);
            }
        })

        const folder_status = this.element.querySelector(".folder-status");
        folder_status.textContent = this.status ? this.status : "unknown";
        folder_status.addEventListener("mouseenter", () => {
            const status_menu = document.getElementById("folder-status-menu");
            const folder_status_rect = folder_status.getBoundingClientRect();
            status_menu.setAttribute("dirname", self.dirname);
            status_menu.classList.remove("hidden");
            status_menu.style.top = folder_status_rect.top + "px";
            status_menu.style.left = folder_status_rect.left + "px";
        });
    }

    execute(action) {
        const url = `/action?action=${ action }&dirname=${ this.dirname }`;
        fetch(url).then(res => res.json()).then(data => {});
    }

    set_status(status) {
        if (!(STATUS.includes(status))) return;
        this.status = status;
        this.element.querySelector(".folder-status").textContent = status;
    }

    add_tag(tag_index) {
        tag_index = parseInt(tag_index);
        if (this.tags.includes(tag_index)) return;
        this.tags.push(tag_index);
        const tag = this.controller.tags[tag_index];
        this.add_tag_element(tag);
    }

    add_tag_element(tag) {
        var self = this;
        const tag_element = create_tag_element(tag, "×", () => {
            self.remove_tag(tag.index);
            self.controller.save_folder_data();
        });
        const folder_tags = this.element.querySelector(".folder-tags");
        let insert_before_child = null;
        for (let i = 0; i < folder_tags.children.length; i++) {
            if (folder_tags.children[i].textContent.toLowerCase() > tag.label.toLowerCase() || folder_tags.children[i].textContent == "+") {
                insert_before_child = folder_tags.children[i];
                break;
            }
        }
        folder_tags.insertBefore(tag_element, insert_before_child);
    }

    get_tag_element(tag_index) {
        tag_index = parseInt(tag_index);
        return this.element.querySelector(`.tag[index="${ tag_index }"]`);
    }

    update_tag(tag_index) {
        tag_index = parseInt(tag_index);
        if (!this.tags.includes(tag_index)) return;
        const tag = this.controller.tags[tag_index];
        const tag_element = this.get_tag_element(tag_index);
        tag_element.querySelector(".tag-label").textContent = tag.label;
        tag_element.style.background = tag.color;
        if (tag.color.match(/^#[0-9a-f]{6}$/i)) {
            tag_element.style.color = invert_color(tag.color);
        }
    }

    remove_tag(tag_index) {
        tag_index = parseInt(tag_index);
        if (!this.tags.includes(tag_index)) return;
        this.tags.splice(this.tags.indexOf(tag_index), 1);
        const tag_element = this.get_tag_element(tag_index);
        tag_element.parentElement.removeChild(tag_element);
    }

    matches_query(query) {
        if (query.charAt(0) == "#") {
            if ("#" + this.status == query) return true;
            for (let i = 0; i < this.tags.length; i++) {
                const tag_index = this.tags[i];
                if (tag_index in this.controller.tags) {
                    if ("#" + this.controller.tags[tag_index].label == query) {
                        return true;
                    }
                }
            }
            for (let i = 0; i < this.languages.length; i++) {
                if ("#" + this.languages[i] == query) {
                    return true;
                }
            }
        } else {
            if (this.dirname.toLowerCase().includes(query)) return true;
        }
        return false;
    }

}

class Controller {

    constructor() {
        this.folders = [];
        this.tags = {};
        this.root = null;
    }

    load_tags() {
        this.tags = {};
        if (SAVED_TAGS) {
            for (let tag_index in SAVED_TAGS) {
                this.tags[parseInt(tag_index)] = SAVED_TAGS[tag_index];
            }
        }
        this.inflate_tags();
    }

    load_folders() {
        var self = this;
        fetch("/scan").then(res => res.json()).then(data => {
            self.root = data.root;
            self.folders = [];
            data.folders.forEach(folder_data => {
                const folder = new Folder(self, folder_data);
                if (folder.dirname in SAVED_FOLDERS) {
                    folder.status = SAVED_FOLDERS[folder.dirname].status;
                    folder.tags = SAVED_FOLDERS[folder.dirname].tags;
                }
                self.folders.push(folder);
            });
            self.inflate_folders();
            // self.scan_languages(); TODO: enable?
        });
    }

    load() {
        this.load_tags();
        this.load_folders();
    }

    scan_languages() {
        var self = this;
        async function aux() {
            for (let i = 0; i < self.folders.length; i++) {
                const folder = self.folders[i];
                if (folder.languages == null) {
                    const response = await fetch(`/languages?dirname=${ folder.dirname }`);
                    const data = await response.json();
                    folder.languages = data;
                    const languages_container = folder.element.querySelector(".folder-languages");
                    folder.languages.forEach(language => {
                        const language_element = document.createElement("div");
                        language_element.classList.add("folder-language");
                        language_element.textContent = language;
                        languages_container.appendChild(language_element);
                    });
                }
            }
        }
        aux();
    }

    inflate_folders() {
        const container = document.getElementById("folders");
        container.innerHTML = "";
        const scrollbar = document.getElementById("scrollbar");
        scrollbar.innerHTML = "";
        let previous_letter = null;
        let size = {};
        let size_total = 0;
        this.folders.forEach(folder => {
            folder.inflate(container);
            if (folder.first_letter != previous_letter) {
                const letter_link = document.createElement("a");
                letter_link.textContent = folder.first_letter;
                letter_link.href = `#anchor-${ folder.first_letter }`;
                folder.element.setAttribute("id", `anchor-${ folder.first_letter }`)
                scrollbar.appendChild(letter_link);
                previous_letter = folder.first_letter;
                size[folder.first_letter] = 0;
            }
            size[folder.first_letter]++;
            size_total++;
        });
        for (let c in size) {
            const link = document.querySelector(`a[href="#anchor-${ c }"]`);
            const rel_size = size[c] / size_total * 100;
            link.style.height = rel_size.toFixed(2) + "%";
        }
    }

    inflate_tags() {
        var self = this;
        const filter_container = document.getElementById("tag-list-config");
        filter_container.innerHTML = "";
        const form_container = document.getElementById("tag-forms");
        form_container.innerHTML = "";
        const modal_choose_tag_container = document.getElementById("tag-list-choice");
        modal_choose_tag_container.innerHTML = "";
        for (let tag_index in this.tags) {
            const tag = this.tags[tag_index];
            const tag_element = create_tag_element(tag, "×", (event) => {
                event.stopImmediatePropagation();
                event.stopPropagation();
                if (confirm("Are you sure?")) {
                    delete self.tags[tag_index];
                    this.folders.forEach(folder => {
                        folder.remove_tag(tag_index);
                    });
                    self.save_tags();
                    self.inflate_tags();
                }
            });
            tag_element.addEventListener("click", () => {
                document.getElementById("searchbar").value = "#" + tag.label;
                self.filter_folders("#" + tag.label);
            });
            filter_container.appendChild(tag_element);

            const tag_form = document.createElement("div");
            tag_form.classList.add("tag-form");
            const tag_form_label = document.createElement("input");
            tag_form_label.classList.add("tag-form-input");
            tag_form_label.setAttribute("name", "label");
            tag_form_label.value = tag.label;
            tag_form.appendChild(tag_form_label);
            const tag_form_color = document.createElement("input");
            tag_form_color.classList.add("tag-form-input");
            tag_form_color.setAttribute("name", "color");
            tag_form_color.size = "7";
            tag_form_color.maxLength = "7";
            tag_form_color.value = tag.color;
            tag_form.appendChild(tag_form_color);
            const tag_form_button = document.createElement("button");
            tag_form_button.classList.add("tag-form-button");
            tag_form_button.textContent = "Save";
            tag_form_button.addEventListener("click", () => {
                const label = tag_form_label.value.trim();
                const color = tag_form_color.value.trim();
                if (color.match(/^#[0-9a-f]{6}$/i)) {
                    tag.label = label;
                    tag.color = color;
                    this.folders.forEach(folder => {
                        folder.update_tag(tag_index);
                    });
                    self.save();
                    self.inflate_tags();
                }
            });
            tag_form.appendChild(tag_form_button);
            form_container.appendChild(tag_form);
            set_tag_form_color_callback(tag_form);

            const choose_tag_element = create_tag_element(tag);
            choose_tag_element.addEventListener("click", () => {
                const modal = modal_choose_tag_container.parentElement;
                const dirname = modal.getAttribute("dirname");
                self.get(dirname).add_tag(tag.index);
                self.save_folder_data();
                modal.classList.remove("active");
            });
            modal_choose_tag_container.appendChild(choose_tag_element);
        };
    }

    filter_folders(query) {
        this.folders.forEach(folder => {
            if (folder.matches_query(query)) {
                folder.element.classList.remove("hidden");
            } else {
                folder.element.classList.add("hidden");
            }
        });
    }

    update_scrollbar() {
        let first_letter = null;
        for (let i = 0; i < this.folders.length; i++) {
            if (is_element_in_viewport(this.folders[i].element)) {
                first_letter = this.folders[i].first_letter;
                break;
            }
        }
        document.querySelectorAll("#scrollbar a").forEach(link => {
            if (link.textContent == first_letter) {
                link.classList.add("bold");
            } else {
                link.classList.remove("bold");
            }
        });
    }

    save_tags() {
        // localStorage.setItem("tags", JSON.stringify(this.tags));
        fetch("/save/tags", {
            method: "POST",
            body: JSON.stringify(this.tags)
        }).then(res => res.json()).then(data => {});
    }

    save_folder_data() {
        const folder_data = {};
        this.folders.forEach(folder => {
            folder_data[folder.dirname] = {
                status: folder.status,
                tags: folder.tags
            }
        });
        // localStorage.setItem("folders", JSON.stringify(folder_data));
        fetch("/save/folders", {
            method: "POST",
            body: JSON.stringify(folder_data)
        }).then(res => res.json()).then(data => {});
    }

    save() {
        this.save_tags();
        this.save_folder_data();
    }

    get(dirname) {
        for (let i = 0; i < this.folders.length; i++) {
            if (this.folders[i].dirname == dirname) {
                return this.folders[i];
            }
        }
    }

    get_next_tag_index() {
        let next_tag_index = 0;
        for (let tag_index in this.tags) {
            tag_index = parseInt(tag_index);
            if (next_tag_index <= tag_index) {
                next_tag_index = tag_index + 1;
            }
        }
        return next_tag_index;
    }

    create_tag() {
        const label = document.getElementById("tag-create-label").value.trim();
        let color = document.getElementById("tag-create-color").value.trim();
        if (!color.match(/^#[0-9a-f]{6}$/i)) {
            color = "#202020";
        }
        const tag_index = this.get_next_tag_index();
        const tag = { "index": tag_index, "label": label, "color": color };
        document.getElementById("tag-create-label").value = "";
        document.getElementById("tag-create-color").value = "";
        document.getElementById("tag-create").removeAttribute("style");
        this.tags[tag_index] = tag;
        this.save_tags();
        this.inflate_tags();
    }

}

/* Main thread ***************************************************************/

window.addEventListener("load", () => {
    const controller = new Controller();
    controller.load();
    document.getElementById("searchbar").addEventListener("input", (event) => {
        const query = event.target.value.toLowerCase().trim();
        controller.filter_folders(query);
    });
    window.addEventListener("scroll", () => {
        controller.update_scrollbar();
    });
    inflate_status_menu(controller);
    set_tag_form_color_callback(document.getElementById("tag-create"));
    document.getElementById("tag-create-button").addEventListener("click", () => {
        controller.create_tag();
    });
    const searchbar = document.getElementById("searchbar");
    document.getElementById("button-searchbar-clear").addEventListener("click", () => {
        searchbar.value = "";
        controller.filter_folders("");
        searchbar.focus();
    });
    searchbar.focus();
});