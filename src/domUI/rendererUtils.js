// src/domUI/rendererUtils.js

/**
 * @file Provides helper functions for safely rendering content in the DOM.
 * Includes utilities for HTML escaping, text truncation, and creating interactive UI elements.
 * @module RendererUtils
 */

/**
 * @typedef {object} TruncateResult
 * @property {boolean} truncated - Whether the text was truncated.
 * @property {string} preview - The visible part of the text (the full text if not truncated).
 * @property {string} remainder - The hidden part of the text (empty if not truncated).
 */

/**
 * Replaces HTML special characters with their corresponding entities to prevent XSS.
 *
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string, safe for insertion into HTML.
 * @example
 * const safeString = escapeHtml("<script>alert('XSS')</script>");
 * // -> "&lt;script&gt;alert('XSS')&lt;/script&gt;"
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Truncates a string to a maximum length, separating it into a preview and a remainder.
 *
 * @param {string} text - The text to truncate.
 * @param {number} maxLength - The maximum length of the preview text.
 * @returns {TruncateResult} An object containing the truncated parts.
 */
export function truncateText(text, maxLength) {
  if (text.length <= maxLength) {
    return { truncated: false, preview: text, remainder: '' };
  }
  return {
    truncated: true,
    preview: text.slice(0, maxLength),
    remainder: text.slice(maxLength),
  };
}

/**
 * Creates a focusable <button> element for toggling content visibility.
 *
 * @param {'text' | 'details'} type - The type of content being toggled. Affects the button's class.
 * @param {'collapsed' | 'expanded'} initialState - The initial state of the toggle.
 * @returns {HTMLButtonElement} The created button element.
 */
export function createToggleElement(type, initialState) {
  const button = document.createElement('button');
  button.setAttribute('tabindex', '0');
  button.textContent = initialState === 'collapsed' ? 'Show more' : 'Show less';
  button.classList.add(type === 'text' ? 'toggle-text' : 'toggle-details');
  return button;
}
