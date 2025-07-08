/**
 * @module throttleUtils
 * @description Provides utility functions for alert throttling and deduplication.
 */

/**
 * @typedef {object} AlertDetails
 * @property {number} [statusCode] - The HTTP status code, if any.
 * @property {string} [url] - The request URL, if any.
 */

/**
 * Generates a unique deduplication key for an alert event.
 * The key is a composite of the message, status code, and URL.
 * The function is pure and has no side effects.
 *
 * @param {string} displayMessage - The pre-escaped HTML message of the alert.
 * @param {AlertDetails} [details] - The details object associated with the alert.
 * @returns {string} A string to be used as a deduplication key.
 * @example
 * generateKey('User not found', { statusCode: 404, url: '/api/users/123' });
 * // returns 'User not found::404::/api/users/123'
 * @example
 * generateKey('An unknown error occurred', null);
 * // returns 'An unknown error occurred::::'
 */
export function generateKey(displayMessage, details) {
  const statusCodePart = details?.statusCode ?? '';
  const urlPart = details?.url ?? '';
  return `${displayMessage}::${statusCodePart}::${urlPart}`;
}
