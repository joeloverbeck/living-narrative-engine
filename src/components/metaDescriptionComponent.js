// src/components/metaDescriptionComponent.js

export class MetaDescriptionComponent {
    /**
     * Stores meta-information (like keywords) about an entity,
     * potentially for use by systems like LLM description generation.
     * @param {object} data - The component data from JSON.
     * @param {string[]} data.keywords - An array of keyword strings.
     */
    constructor(data = {}) {
        // Store the keywords, defaulting to an empty array if not provided
        this.keywords = Array.isArray(data.keywords) ? [...data.keywords] : [];
    }

    // Optional: Add methods if needed later, e.g., to add/remove keywords
    addKeyword(keyword) {
        if (keyword && !this.keywords.includes(keyword)) {
            this.keywords.push(keyword);
        }
    }

    toString() {
        return `Keywords: [${this.keywords.join(', ')}]`;
    }
}