// src/domUI/IDocumentContext.js
/**
 * @fileoverview Defines the IDocumentContext interface for abstracting DOM access.
 * This allows injecting document-like objects (e.g., from JSDOM) for testing.
 */

// This file only contains type definitions (JSDoc interface) and has no runtime code.
// It is used to define a contract for objects that provide access to a document context.

/**
 * @typedef {object} IDocumentContext
 * @property {function(string): (Element | null)} query
 * Finds the first Element within the document that matches the specified selector.
 * Corresponds to `document.querySelector`.
 * @property {function<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K]} create
 * Creates the HTML element specified by tagName.
 * Corresponds to `document.createElement`.
 * The generic type ensures the correct HTML element type is returned based on the tag.
 */

// Export an empty object or use a marker export if required by the module system
// or build tools, although for JSDoc types, this isn't strictly necessary
// for type checking itself, but helps signify it's a module.
export {};