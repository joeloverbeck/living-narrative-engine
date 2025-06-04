// src/domUI/documentContext.js
/**
 * @file Implements DocumentContext for abstracting DOM access.
 * Provides a consistent interface for querying and creating DOM elements,
 * facilitating testing by allowing injection of different document contexts (like JSDOM).
 */

/** @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */

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
   *
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
   * @param {HTMLElement | Document | null | undefined} [root] - Optional root element or document. If it's a Document, it's used directly.
   * If it's a valid HTMLElement, its ownerDocument will be used. Otherwise, it falls back to the global `document`.
   */
  constructor(root) {
    let contextFound = false;

    // Define the relevant constructors for the current environment dynamically AT INSTANTIATION TIME.
    // This avoids issues with stale constructors captured at module load time in test environments.
    const CurrentEnvDocument =
      typeof global !== 'undefined' && global.Document
        ? global.Document
        : typeof Document !== 'undefined'
          ? Document
          : undefined;

    const CurrentEnvHTMLElement =
      typeof global !== 'undefined' && global.HTMLElement
        ? global.HTMLElement
        : typeof HTMLElement !== 'undefined'
          ? HTMLElement
          : undefined;

    // 1. Check if the provided 'root' argument is itself a Document object (or behaves like one)
    if (root) {
      // Ensure root is not null/undefined before checks
      if (CurrentEnvDocument && root instanceof CurrentEnvDocument) {
        this.#docContext = root;
        contextFound = true;
      } else if (
        typeof root.querySelector === 'function' &&
        typeof root.createElement === 'function'
      ) {
        // Fallback check if 'root' quacks like a document, even if instanceof fails
        // (can happen in some complex module/realm scenarios or if root is a proxy)
        // This was the key to TestSpecificDocumentContext working.
        this.#docContext = /** @type {Document} */ (root); // Cast if necessary, assuming it's document-like
        contextFound = true;
        if (!(CurrentEnvDocument && root instanceof CurrentEnvDocument)) {
          // Log if instanceof failed but we're using it anyway based on duck-typing.
          // console.warn('[DocumentContext] Constructor: Used `root` argument based on duck-typing as `instanceof Document` check failed. This might be unexpected.', { rootConstructorName: root.constructor?.name });
        }
      }
    }

    // 2. Try using the root element's ownerDocument if root is a valid HTMLElement and context not yet found
    if (
      !contextFound &&
      CurrentEnvHTMLElement &&
      root instanceof CurrentEnvHTMLElement &&
      root.ownerDocument
    ) {
      this.#docContext = root.ownerDocument;
      contextFound = true;
    }

    // 3. If no context yet from `root`, explicitly try using the global document
    if (
      !contextFound &&
      typeof global !== 'undefined' &&
      typeof global.document !== 'undefined'
    ) {
      // Ensure the global document itself is usable
      if (global.document.querySelector && global.document.createElement) {
        this.#docContext = global.document;
        contextFound = true;
      }
    }

    // 4. Set to null and log error if no valid context could be determined
    if (!contextFound) {
      this.#docContext = null;
      console.error(
        '[DocumentContext] Construction failed: Could not determine a valid document context. Ensure a valid document object is passed or available globally when DocumentContext is instantiated.'
      );
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
      console.warn(
        `[DocumentContext] query('${selector}') attempted, but no document context is available.`
      );
      return null;
    }
    try {
      return this.#docContext.querySelector(selector);
    } catch (error) {
      console.error(
        `[DocumentContext] Error during query('${selector}'):`,
        error
      );
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
      console.warn(
        `[DocumentContext] create('${tagName}') attempted, but no document context is available.`
      );
      return null;
    }
    try {
      return this.#docContext.createElement(tagName);
    } catch (error) {
      console.error(
        `[DocumentContext] Error during create('${tagName}'):`,
        error
      );
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
