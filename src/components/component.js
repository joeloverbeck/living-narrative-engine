// src/components/component.js

/** Base class for components (optional, but can be useful) */
class Component {
    constructor() {
        if (this.constructor === Component) {
            // Optional: prevent instantiation of the base class directly
            throw new Error("Cannot instantiate abstract base Component class.");
        }
    }
}

export default Component;