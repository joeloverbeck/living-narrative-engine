// src/domUI/documentContext.js
/**
 * @fileoverview Implements DocumentContext for abstracting DOM access.
 * Provides a consistent interface for querying and creating DOM elements,
 * facilitating testing by allowing injection of different document contexts (like JSDOM).
 */

/** @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext */

/**
 * Provides a consistent way to access document querySelector and createElement,
 * either from a provided root element's ownerDocument or the global document.
 * This facilitates testing with JSDOM or similar environments.
 *
 * @implements {IDocumentContext}
 */
class DocumentContext {
    /**
     * The document object (either global or from root's ownerDocument) used for DOM operations.
     * @private
     * @type {Document | null}
     */
    #docContext = null;

    /**
     * Creates an instance of DocumentContext.
     * It determines the appropriate document object to use based on the presence of a root element
     * or the availability of `global.document`.
     * Logs an error if no valid document context can be found.
     *
     * @param {HTMLElement | null | undefined} [root] - Optional root element. If provided and valid,
     * its ownerDocument will be used as the context. Otherwise, it falls back to the global `document`.
     */
    constructor(root) {
        let contextFound = false;

        // Define the HTMLElement constructor relevant to the current environment (global preferred for tests)
        const EnvHTMLElement = (typeof global !== 'undefined' && global.HTMLElement)
            ? global.HTMLElement
            : (typeof HTMLElement !== 'undefined' ? HTMLElement : undefined);

        // 1. Try using the root element's ownerDocument if root is valid
        if (EnvHTMLElement && root instanceof EnvHTMLElement && root.ownerDocument) {
            this.#docContext = root.ownerDocument;
            contextFound = true;
            // console.debug('[DocumentContext] Initialized using ownerDocument from provided root element.');
        }

        // 2. If no context from root, explicitly try using the global document (most common fallback for JSDOM)
        if (!contextFound && typeof global !== 'undefined' && typeof global.document !== 'undefined') {
            this.#docContext = global.document;
            contextFound = true;
            // console.debug('[DocumentContext] Initialized using global.document.');
        }

        // 3. REMOVED fallback checking for local scope 'document' as it caused issues in tests.
        // Context must come from root or global.document.

        // 4. Set to null and log error if no context could be determined after all checks
        if (!contextFound) {
            this.#docContext = null; // Ensure it's null if no context found
            console.error('[DocumentContext] Construction failed: Could not determine a valid document context. Needs root element or global.document.');
        }
    }

    /**
     * Finds the first Element within the context that matches the specified CSS selector.
     * Corresponds to `document.querySelector`. Logs a warning if the context is unavailable
     * or an error if the query itself fails.
     *
     * @param {string} selector - The CSS selector string to match against.
     * @returns {Element | null} The first matching element, or null if no match is found,
     * the context is missing, or the selector is invalid.
     */
    query(selector) {
        if (!this.#docContext) {
            // Ensure warning is active for tests checking missing context
            console.warn(`[DocumentContext] query('${selector}') attempted, but no document context is available.`);
            return null;
        }
        try {
            // Perform the query using the determined document context
            const result = this.#docContext.querySelector(selector);
            // console.log(`[DEBUG] Query for "${selector}" in context returned:`, result ? result.outerHTML : 'null');
            return result;
        } catch (error) {
            console.error(`[DocumentContext] Error during query('${selector}'):`, error);
            return null;
        }
    }

    /**
     * Creates the HTML element specified by tagName within the context.
     * Corresponds to `document.createElement`. Logs a warning if the context is unavailable.
     *
     * @template {keyof HTMLElementTagNameMap} K - Ensures the tag name is a valid HTML tag.
     * @param {K} tagName - The tag name for the element to create (e.g., 'div', 'span', 'button').
     * @returns {HTMLElementTagNameMap[K] | null} The newly created HTML element, or null if the
     * document context is missing. The return type matches the specific HTML element interface (e.g., HTMLDivElement).
     */
    create(tagName) {
        if (!this.#docContext) {
            // Ensure warning is active for tests checking missing context
            console.warn(`[DocumentContext] create('${tagName}') attempted, but no document context is available.`);
            return null;
        }
        try {
            // Create the element using the determined document context
            return this.#docContext.createElement(tagName);
        } catch (error) {
            console.error(`[DocumentContext] Error during create('${tagName}'):`, error);
            return null;
        }
    }

    /**
     * Getter to access the underlying Document object being used by this context.
     * Primarily intended for diagnostics or scenarios where direct document access is unavoidable,
     * though standard usage should rely on `query` and `create`.
     *
     * @returns {Document | null} The underlying Document object, or null if none was determined.
     */
    get document() {
        return this.#docContext;
    }
}

export default DocumentContext;