/**
 * @module AjvUtils
 * @description Helper utilities for formatting Ajv validation errors.
 */

/**
 * Formats an array of Ajv error objects into a readable string. If the array is
 * empty or undefined, a placeholder message is returned.
 *
 * @param {import('ajv').ErrorObject[] | null | undefined} errors
 * @returns {string} Formatted error details.
 */
export function formatAjvErrors(errors) {
  if (!errors || errors.length === 0) {
    return 'No specific error details provided.';
  }
  return JSON.stringify(errors, null, 2);
}
