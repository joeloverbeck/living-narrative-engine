/**
 * @module throttleUtils
 * @description Provides utility functions for alert throttling and deduplication.
 */

/**
 * Generates a unique deduplication key for an alert event.
 * The key is a composite of the message, status code, and URL.
 * The function is pure and has no side effects.
 *
 * @param {string} displayMessage - The pre-escaped HTML message of the alert.
 * @param {object | null | undefined} details - The details object associated with the alert.
 * @param {number} [details.statusCode] - The HTTP status code, if any.
 * @param {string} [details.url] - The request URL, if any.
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
