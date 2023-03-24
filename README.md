# Code Explorer

This program helps you organize your development projects stored locally.

I recently tried to clean up my hard drive, and decided to switch to a flat hierarchy for storing my projects. Each project has its dedicated folder under `~/Code`. My motivation was that any static folder hierarchy would yield inconsistencies. A better way to organize things would be tags, yet this is somehow not natively doable in Windows. Therefore, I implemented a small web application doing just what I needed:

- Display the list of folders
- Use a tagging system to organize and search through them
- Add specific shortcuts for development projects (open in terminal, open in code editor, etc.)

## Getting Started

### Prerequisites

You'll need a working installation of [Python 3](https://www.python.org/downloads/).

### Installation

1. Clone this repository
2. Run `main.py` (no external module needed)

The first time, you'll have to specify the configuration for your setup. Then, it will start automatically.
