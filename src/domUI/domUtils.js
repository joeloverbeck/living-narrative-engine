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
   * Sets the text content or HTML content of a given DOM element.
   * If the element is null or undefined, this function does nothing.
   *
   * @param {Element | null | undefined} element - The DOM element whose content will be set.
   * @param {string} content - The string content to set.
   * @param {boolean} [allowHtml] - If true, `content` is set as HTML using `innerHTML`.
   * Otherwise, `content` is set as plain text using `textContent`.
   */
  setTextOrHtml(element, content, allowHtml = false) {
    if (!element) {
      // console.warn('[DomUtils.setTextOrHtml] Attempted to set content on a null or undefined element.');
      return;
    }
    if (allowHtml) {
      element.innerHTML = content;
    } else {
      element.textContent = content;
    }
  },

  /**
   * Toggles a CSS class on a DOM element.
   * If the element or its classList is null or undefined, this function does nothing.
   *
   * @param {Element | null | undefined} element - The DOM element.
   * @param {string} className - The CSS class name to toggle.
   * @param {boolean} [force] - If true, adds the class. If false, removes the class.
   * If undefined, toggles the class.
   */
  toggleClass(element, className, force) {
    if (!element || !element.classList) {
      // console.warn('[DomUtils.toggleClass] Attempted to toggle class on a null, undefined, or invalid element.');
      return;
    }
    if (typeof className !== 'string' || className.trim() === '') {
      // console.warn('[DomUtils.toggleClass] Invalid or empty className provided.');
      return;
    }

    if (force === true) {
      element.classList.add(className);
    } else if (force === false) {
      element.classList.remove(className);
    } else {
      element.classList.toggle(className);
    }
  },

  /**
   * Shows a DOM element by setting its display style.
   * If the element or its style property is null or undefined, this function does nothing.
   *
   * @param {HTMLElement | null | undefined} element - The DOM element to show.
   * @param {string} [displayStyle] - The CSS display style to apply (e.g., 'block', 'flex', 'inline-block').
   */
  showElement(element, displayStyle = 'block') {
    if (!element || !element.style) {
      // console.warn('[DomUtils.showElement] Attempted to show a null, undefined, or invalid element.');
      return;
    }
    element.style.display = displayStyle;
  },

  /**
   * Hides a DOM element by setting its display style to 'none'.
   * If the element or its style property is null or undefined, this function does nothing.
   *
   * @param {HTMLElement | null | undefined} element - The DOM element to hide.
   */
  hideElement(element) {
    if (!element || !element.style) {
      // console.warn('[DomUtils.hideElement] Attempted to hide a null, undefined, or invalid element.');
      return;
    }
    element.style.display = 'none';
  },

  /**
   * Escapes HTML special characters in a string to prevent XSS.
   * Replaces '&', '<', '>', '"', and "'".
   * Gracefully handles non-string inputs by returning an empty string.
   *
   * @param {any} str - The input value to escape.
   * @returns {string} The escaped string, or an empty string if the input is not a string.
   * @example
   * const userInput = '<script>alert("XSS")</script>';
   * const safeHtml = DomUtils.escapeHtml(userInput); // "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;"
   */
  escapeHtml(str) {
    if (typeof str !== 'string') {
      return '';
    }
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
};
