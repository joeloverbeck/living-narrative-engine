// src/domUI/documentContext.js
/**
 * @file Implements DocumentContext for abstracting DOM access.
 * Provides a consistent interface for querying and creating DOM elements,
 * facilitating testing by allowing injection of different document contexts (like JSDOM).
 */

/** @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

import ConsoleLogger from '../logging/consoleLogger.js';

/**
 * Provides a consistent way to access document querySelector and createElement,
 * either from a provided root element's ownerDocument or the global document.
 * This facilitates testing with JSDOM or similar environments.
 *
 * @implements {IDocumentContext}
 */
/**
 * Determines the most appropriate Document context to use based on a provided
 * root element or the global environment.
 *
 * @description Detects a usable `Document` object by inspecting the supplied
 * root value and the current global environment. Falls back to the global
 * document when available. Logs an error if no valid context can be found.
 * @param {HTMLElement | Document | null | undefined} [root] - Optional root
 * element or document.
 * @returns {Document | null} The detected document context or `null` if none is
 * available.
 */
export function detectDocumentContext(root, logger = new ConsoleLogger()) {
  let detected = null;
  let contextFound = false;

  const CurrentEnvDocument =
    typeof globalThis !== 'undefined' && globalThis.Document
      ? globalThis.Document
      : typeof Document !== 'undefined'
        ? Document
        : undefined;

  const CurrentEnvHTMLElement =
    typeof globalThis !== 'undefined' && globalThis.HTMLElement
      ? globalThis.HTMLElement
      : typeof HTMLElement !== 'undefined'
        ? HTMLElement
        : undefined;

  if (root) {
    if (CurrentEnvDocument && root instanceof CurrentEnvDocument) {
      detected = root;
      contextFound = true;
    } else if (
      typeof root.querySelector === 'function' &&
      typeof root.createElement === 'function'
    ) {
      detected = /** @type {Document} */ (root);
      contextFound = true;
    }
  }

  if (
    !contextFound &&
    CurrentEnvHTMLElement &&
    root instanceof CurrentEnvHTMLElement &&
    root.ownerDocument
  ) {
    detected = root.ownerDocument;
    contextFound = true;
  }

  if (
    !contextFound &&
    typeof globalThis !== 'undefined' &&
    typeof globalThis.document !== 'undefined'
  ) {
    if (
      globalThis.document.querySelector &&
      globalThis.document.createElement
    ) {
      detected = globalThis.document;
      contextFound = true;
    }
  }

  if (!contextFound) {
    detected = null;
    logger.error(
      '[DocumentContext] Construction failed: Could not determine a valid document context. Ensure a valid document object is passed or available globally when DocumentContext is instantiated.'
    );
  }

  return detected;
}

class DocumentContext {
  /**
   * The document object (either global or from root's ownerDocument) used for DOM operations.
   *
   * @private
   * @type {Document | null}
   */
  #docContext = null;

  /**
   * @private
   * @type {ILogger}
   */
  #logger;

  /**
   * Creates an instance of DocumentContext.
   * It determines the appropriate document object to use based on the presence of a root element
   * or the availability of `global.document`.
   * Logs an error if no valid document context can be found.
   *
   * @param {HTMLElement | Document | null | undefined} [root] - Optional root element or document. If it's a Document, it's used directly.
   * If it's a valid HTMLElement, its ownerDocument will be used. Otherwise, it falls back to the global `document`.
   */
  constructor(root, logger = new ConsoleLogger()) {
    this.#logger = logger;
    this.#docContext = detectDocumentContext(root, logger);
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
      this.#logger.warn(
        `[DocumentContext] query('${selector}') attempted, but no document context is available.`
      );
      return null;
    }
    try {
      return this.#docContext.querySelector(selector);
    } catch (error) {
      this.#logger.error(
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
   * @param {string} tagName - The tag name for the element to create (e.g., 'div', 'span', 'button').
   * @returns {HTMLElement | null} The newly created HTML element, or null if the
   * document context is missing.
   */
  create(tagName) {
    if (!this.#docContext) {
      this.#logger.warn(
        `[DocumentContext] create('${tagName}') attempted, but no document context is available.`
      );
      return null;
    }
    try {
      return this.#docContext.createElement(tagName);
    } catch (error) {
      this.#logger.error(
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
