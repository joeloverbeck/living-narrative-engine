// src/interfaces/DomAdapter.js
/**
 * @file Provides the DomAdapter interface used for limited DOM manipulation.
 */

/**
 * @interface DomAdapter
 * @description Abstraction layer over basic DOM operations to allow easier
 * testing and platform flexibility.
 */
export class DomAdapter {
  /**
   * Creates a new element with the specified tag name.
   *
   * @param {string} tagName - Name of the element to create.
   * @returns {HTMLElement}
   */
  createElement(tagName) {
    throw new Error('DomAdapter.createElement not implemented');
  }

  /**
   * Inserts `newNode` immediately after `referenceNode` in the DOM tree.
   *
   * @param {HTMLElement} referenceNode - Existing node to insert after.
   * @param {HTMLElement} newNode - Node to insert.
   * @returns {void}
   */
  insertAfter(referenceNode, newNode) {
    throw new Error('DomAdapter.insertAfter not implemented');
  }

  /**
   * Sets the text content of an element.
   *
   * @param {HTMLElement} element - Element to modify.
   * @param {string} text - Text to set.
   * @returns {void}
   */
  setTextContent(element, text) {
    throw new Error('DomAdapter.setTextContent not implemented');
  }

  /**
   * Sets a style property on an element.
   *
   * @param {HTMLElement} element - Element to modify.
   * @param {string} property - CSS property name (camelCase or dash-separated).
   * @param {string} value - CSS value to assign.
   * @returns {void}
   */
  setStyle(element, property, value) {
    throw new Error('DomAdapter.setStyle not implemented');
  }
}
