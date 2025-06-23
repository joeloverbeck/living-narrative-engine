/**
 * @file Helper to generate an empty slot message element.
 */

/** @typedef {import('../domElementFactory.js').default} DomElementFactory */

/**
 * Creates a DOM element or string representing an empty slots message.
 *
 * @param {DomElementFactory} [domFactory] - The DOM element factory.
 * @param {string} message - Text content for the message.
 * @returns {HTMLElement | string} The created <li> or <p> element, or the message string.
 */
export function createEmptySlotMessage(domFactory, message) {
  const cls = 'empty-slot-message';
  const li = domFactory?.li?.(cls, message) || null;
  if (li) return li;
  const p = domFactory?.p?.(cls, message) || null;
  if (p) return p;
  return message;
}

export default createEmptySlotMessage;
