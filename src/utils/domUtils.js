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
};
