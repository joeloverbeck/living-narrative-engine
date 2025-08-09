// src/domUI/DomUtils.js

/**
 * @file A collection of static utility functions for common DOM operations.
 * These functions are designed to be pure, stateless, and handle null/undefined
 * element arguments gracefully.
 */

/**
 * @module DomUtils
 */
export const DomUtils = {
  /**
   * Clears all child nodes from a given DOM element.
   * If the element is null or undefined, this function does nothing.
   *
   * @param {Element | null | undefined} element - The DOM element to clear.
   */
  clearElement(element) {
    if (!element) {
      // console.warn('[DomUtils.clearElement] Attempted to clear a null or undefined element.');
      return;
    }
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  },

  /**
   * Escapes HTML special characters in a string to prevent XSS attacks.
   * Escapes <, >, &, ", and ' for safe use in HTML attributes and content.
   *
   * @param {string} text - The text to escape.
   * @returns {string} The escaped text.
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    const escaped = div.innerHTML;

    // Additionally escape quotes for attribute safety
    return escaped.replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  },

  /**
   * Converts newline characters to HTML line breaks while escaping other HTML.
   * This is safe to use with innerHTML as it escapes potentially dangerous content.
   *
   * @param {string} text - The text containing newlines.
   * @returns {string} HTML string with newlines converted to <br> tags.
   */
  textToHtml(text) {
    if (!text) return '';
    // First escape any HTML to prevent XSS
    const escaped = this.escapeHtml(text);
    // Then convert newlines to <br> tags
    return escaped.replace(/\n/g, '<br>');
  },
};
