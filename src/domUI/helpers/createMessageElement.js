/**
 * @file Helper to generate a simple message element.
 */

/** @typedef {import('../domElementFactory.js').default} DomElementFactory */

/**
 * @description Creates a paragraph element containing a message using the
 * provided {@link DomElementFactory}. Falls back to a Text node if the
 * factory is unavailable or fails to create the element.
 * @param {DomElementFactory} [domFactory] - Optional DOM element factory.
 * @param {string} [cssClass] - CSS class to apply to the element.
 * @param {string} text - The message text content.
 * @returns {HTMLElement | Text} The created paragraph element or a Text node.
 */
export function createMessageElement(domFactory, cssClass, text) {
  const p = domFactory?.p?.(cssClass, text) || null;
  if (p) return p;
  return document.createTextNode(text);
}

export default createMessageElement;
