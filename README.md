# Living Narrative Engine

Welcome to the Living Narrative Engine repository.

## About The Project

Living Narrative Engine is a browser-based platform designed for creating and playing highly moddable, data-driven
adventure games and immersive simulations. The core philosophy is **extreme moddability** achieved through:

* **Data-Driven Logic:** Game content, rules, and behaviors are primarily defined in JSON files rather than being
  hard-coded. This allows creators to add or modify items, characters, quests, and even core mechanics simply by editing
  data files.
* **Entity Component System (ECS):** The architecture uses an ECS pattern, where game objects (entities) are defined by
  the data components attached to them. This promotes flexibility and emergent gameplay.
* **Mod Support:** The engine is built from the ground up to support mods, treating even core content as potentially
  replaceable data packs.

The long-term vision includes integrating AI agents (LLMs) to drive dynamic NPC interactions and behaviours, creating
truly living narratives.

## Getting Started

This project primarily runs in the browser using JavaScript. A minimal Python backend may be used for specific features
like future AI integration.

### Prerequisites

Ensure you have Node.js and npm installed.

### Installation & Setup

1. **Clone the repository (if you haven't already)**
   ```bash
   git clone <your-repository-url>
   cd living-narrative-engine

2. **Install development dependencies**
    ```bash
    npm install --save-dev jest @babel/core @babel/preset-env

### Running locally

Since this is a browser-based application, you need a simple web-server to serve the files locally. We recommend using
`http-server`.

    ```bash
    npm install --global http-server   # one-time
    http-server                        # from repo root

Then open the printed URL (usually http://localhost:8080) in your browser.

### Documentation ▶️

JSON Logic – Composite Operators ➜ docs/composite-logical-operators.md
Quick reference for and, or, and not/!, including edge-cases and examples.

Full JSON Logic Usage Guide ➜ docs/json-logic-usage.md
Complete operator list, context explanation, and many ready-made patterns.

Action Event Payload Mapping ➜ docs/action_event_payload_mapping.md

### License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License.
See the LICENSE file for full details.