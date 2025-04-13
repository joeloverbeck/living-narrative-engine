# Living Narrative Engine

Welcome to the Living Narrative Engine repository.

## About The Project

Living Narrative Engine is a browser-based platform designed for creating and playing highly moddable, data-driven adventure games and immersive simulations. The core philosophy is **extreme moddability** achieved through:

* **Data-Driven Logic:** Game content, rules, and behaviors are primarily defined in JSON files rather than being hardcoded. This allows creators to add or modify items, characters, quests, and even core mechanics simply by editing data files.
* **Entity Component System (ECS):** The architecture uses an ECS pattern, where game objects (entities) are defined by the data components attached to them. This promotes flexibility and emergent gameplay.
* **Mod Support:** The engine is built from the ground up to support mods, treating even core content as potentially replaceable data packs.

The long-term vision includes integrating AI agents (LLMs) to drive dynamic NPC interactions and behaviors, creating truly living narratives.

## Getting Started

This project primarily runs in the browser using JavaScript. A minimal Python backend may be used for specific features like future AI integration.

### Prerequisites

Ensure you have Node.js and npm installed.

### Installation & Setup

1.  **Clone the repository (if you haven't already):**
    ```bash
    git clone <your-repository-url>
    cd living-narrative-engine
    ```
2.  **Install development dependencies:**
    The following commands install Jest and its Babel prerequisites, which are used for running tests:
    ```bash
    npm install --save-dev jest @babel/core @babel/preset-env
    ```

### Running Locally

Since this is a browser-based application, you need a simple web server to serve the files locally. We recommend using `http-server`.

1.  **Install `http-server` globally (if you don't have it):**
    ```bash
    npm install --global http-server
    ```
2.  **Run the server:**
    Navigate to the root directory of the project in your terminal and run:
    ```bash
    http-server
    ```
3.  **Access the application:**
    Open your web browser and go to the local address provided by `http-server` (usually `http://localhost:8080` or similar).

## License

This project is under the MIT license. See the LICENSE file for more info.
