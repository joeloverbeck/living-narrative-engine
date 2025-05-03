// src/domUI/domElementFactory.js
/**
 * @fileoverview Provides a factory for creating common DOM elements using a DocumentContext.
 * Simplifies element creation and ensures testability by abstracting direct document access.
 */

/** @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext */

/**
 * A utility class for creating standard HTML elements.
 * Relies on an injected IDocumentContext to interact with the DOM,
 * making it suitable for both browser and testing environments (like JSDOM).
 */
class DomElementFactory {
    /**
     * The document context used for creating elements.
     * @private
     * @type {IDocumentContext | null}
     */
    #docContext;

    /**
     * Creates an instance of DomElementFactory.
     * @param {IDocumentContext} docContext - The document context provider (e.g., an instance of DocumentContext).
     */
    constructor(docContext) {
        if (!docContext || typeof docContext.create !== 'function') {
            console.error('[DomElementFactory] Invalid IDocumentContext provided. Element creation will fail.');
            this.#docContext = null; // Ensure it's null if invalid context provided
        } else {
            this.#docContext = docContext;
        }
    }

    /**
     * Helper to add CSS classes to an element.
     * Handles single string, space-separated string, or array of strings.
     * @private
     * @param {Element} element - The element to add classes to.
     * @param {string | string[] | undefined | null} cls - The class or classes to add.
     */
    #addClasses(element, cls) {
        if (!cls) return;

        if (Array.isArray(cls)) {
            element.classList.add(...cls.filter(c => c)); // Filter out empty strings
        } else if (typeof cls === 'string') {
            // Split space-separated strings and add individually
            const classes = cls.split(' ').filter(c => c);
            if (classes.length > 0) {
                element.classList.add(...classes);
            }
        }
    }

    /**
     * Creates a <div> element.
     * @param {string | string[] | undefined | null} [cls] - Optional CSS class(es) to add.
     * @returns {HTMLDivElement | null} The created element or null if context is invalid.
     */
    div(cls) {
        if (!this.#docContext) return null;
        const el = this.#docContext.create('div');
        if (el) {
            this.#addClasses(el, cls);
        }
        return el;
    }

    /**
     * Creates a <button> element.
     * @param {string} [text=''] - The text content of the button.
     * @param {string | string[] | undefined | null} [cls] - Optional CSS class(es) to add.
     * @returns {HTMLButtonElement | null} The created element or null if context is invalid.
     */
    button(text = '', cls) {
        if (!this.#docContext) return null;
        const el = this.#docContext.create('button');
        if (el) {
            el.textContent = text;
            this.#addClasses(el, cls);
        }
        return el;
    }

    /**
     * Creates a <ul> element.
     * @param {string | undefined | null} [id] - Optional ID for the element.
     * @param {string | string[] | undefined | null} [cls] - Optional CSS class(es) to add.
     * @returns {HTMLUListElement | null} The created element or null if context is invalid.
     */
    ul(id, cls) {
        if (!this.#docContext) return null;
        const el = this.#docContext.create('ul');
        if (el) {
            if (id) {
                el.id = id;
            }
            this.#addClasses(el, cls);
        }
        return el;
    }

    /**
     * Creates an <li> element.
     * @param {string | string[] | undefined | null} [cls] - Optional CSS class(es) to add.
     * @param {string} [text] - Optional text content for the list item.
     * @returns {HTMLLIElement | null} The created element or null if context is invalid.
     */
    li(cls, text) {
        if (!this.#docContext) return null;
        const el = this.#docContext.create('li');
        if (el) {
            this.#addClasses(el, cls);
            if (text !== undefined) {
                el.textContent = text;
            }
        }
        return el;
    }

    /**
     * Creates a <span> element.
     * @param {string | string[] | undefined | null} [cls] - Optional CSS class(es) to add.
     * @param {string} [text] - Optional text content for the span.
     * @returns {HTMLSpanElement | null} The created element or null if context is invalid.
     */
    span(cls, text) {
        if (!this.#docContext) return null;
        const el = this.#docContext.create('span');
        if (el) {
            this.#addClasses(el, cls);
            if (text !== undefined) {
                el.textContent = text;
            }
        }
        return el;
    }

    /**
     * Creates a <p> element.
     * @param {string | string[] | undefined | null} [cls] - Optional CSS class(es) to add.
     * @param {string} [text] - Optional text content for the paragraph.
     * @returns {HTMLParagraphElement | null} The created element or null if context is invalid.
     */
    p(cls, text) {
        if (!this.#docContext) return null;
        const el = this.#docContext.create('p');
        if (el) {
            this.#addClasses(el, cls);
            if (text !== undefined) {
                el.textContent = text;
            }
        }
        return el;
    }

    /**
     * Creates an <h3> element.
     * @param {string | string[] | undefined | null} [cls] - Optional CSS class(es) to add.
     * @param {string} [text] - Optional text content for the heading.
     * @returns {HTMLHeadingElement | null} The created element or null if context is invalid.
     */
    h3(cls, text) {
        if (!this.#docContext) return null;
        const el = this.#docContext.create('h3');
        if (el) {
            this.#addClasses(el, cls);
            if (text !== undefined) {
                el.textContent = text;
            }
        }
        return el;
    }

    /**
     * Creates an <img> element.
     * @param {string} src - The source URL for the image.
     * @param {string} alt - The alt text for the image.
     * @param {string | string[] | undefined | null} [cls] - Optional CSS class(es) to add.
     * @returns {HTMLImageElement | null} The created element or null if context is invalid.
     */
    img(src, alt, cls) {
        if (!this.#docContext) return null;
        const el = this.#docContext.create('img');
        if (el) {
            el.src = src;
            el.alt = alt;
            this.#addClasses(el, cls);
        }
        return el;
    }

    /**
     * Generic element creator for tags not covered by specific helpers.
     * @template {keyof HTMLElementTagNameMap} K
     * @param {K} tagName - The tag name to create.
     * @param {{id?: string, cls?: string | string[], text?: string, attrs?: Record<string, string>}} [options] - Optional configuration.
     * @param {string} [options.id] - ID for the element.
     * @param {string | string[] | undefined | null} [options.cls] - CSS class(es).
     * @param {string} [options.text] - Text content.
     * @param {Record<string, string>} [options.attrs] - Additional attributes as key-value pairs.
     * @returns {HTMLElementTagNameMap[K] | null} The created element or null.
     */
    create(tagName, options = {}) {
        if (!this.#docContext) return null;
        const el = this.#docContext.create(tagName);
        if (el) {
            if (options.id) {
                el.id = options.id;
            }
            if (options.cls) {
                this.#addClasses(el, options.cls);
            }
            if (options.text !== undefined) {
                // Only set textContent if it's explicitly provided
                el.textContent = options.text;
            }
            if (options.attrs) {
                for (const [key, value] of Object.entries(options.attrs)) {
                    if (value !== undefined && value !== null) { // Don't set undefined/null attributes
                        el.setAttribute(key, value);
                    }
                }
            }
        }
        return el;
    }
}

export default DomElementFactory;