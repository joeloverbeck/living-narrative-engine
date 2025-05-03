// src/domUI/IDomMutationService.js
/**
 * @fileoverview Defines the interface for a service that handles generic DOM mutations.
 */

// This file only contains type definitions (JSDoc interface) and has no runtime code.

/**
 * @typedef {object} DomMutationResult
 * @property {number} count - The total number of elements found matching the selector.
 * @property {number} modified - The number of elements successfully modified.
 * @property {number} failed - The number of elements where modification failed or was not needed (e.g., value already set, error occurred).
 */

/**
 * @typedef {object} IDomMutationService
 * @property {function(string, string, *): DomMutationResult} mutate
 * Mutates properties of DOM elements matching a selector within the correct document context.
 * Checks for document availability before attempting mutation.
 * Includes direct handling for 'textContent' and 'innerHTML'.
 *
 * @param {string} selector - The CSS selector to query for elements.
 * @param {string} propertyPath - Dot-notation path to the property to set (e.g., 'style.color', 'dataset.value', 'textContent').
 * @param {*} value - The value to set the property to.
 * @returns {DomMutationResult} - Object indicating total elements found, how many were modified, and how many failed.
 */

// Export an empty object or use a marker export if required by the module system
export {};