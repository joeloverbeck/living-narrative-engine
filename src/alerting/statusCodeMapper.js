/**
 * @file Provides a centralized utility for mapping HTTP status codes to user-friendly messages.
 * @module StatusCodeMapper
 */

/**
 * @typedef {object} FriendlyResult
 * @property {string} displayMessage - The user-friendly message to display.
 * @property {string | null} devDetails - The technical details for developers, or null if none are available.
 */

/**
 * A map of HTTP status codes to user-friendly display messages.
 *
 * @type {Map<number, string>}
 */
export const statusCodeMap = new Map([
  [400, 'Bad request. Please check your input.'],
  [401, 'You are not authorized. Please log in again.'],
  [403, 'Access denied.'],
  [404, 'Resource not found.'],
  [500, 'Server error. Please try again later.'],
  [503, 'Service temporarily unavailable. Please retry in a moment.'],
]);

/**
 * Converts an event's details object, which may contain an HTTP status code,
 * into a user-friendly message and developer-oriented details.
 *
 * @param {object | null | undefined} details - The details object from the event payload. May contain `statusCode`, `url`, and `raw` properties.
 * @param {string} originalMessage - The original message from the event, used as a fallback if no status code logic applies.
 * @returns {FriendlyResult} An object containing the message to display and the developer details.
 */
export function getUserFriendlyMessage(details, originalMessage) {
  if (details?.statusCode) {
    const code = details.statusCode;
    const url = details.url || '';
    const raw = details.raw || '';

    const displayMessage =
      statusCodeMap.get(code) || 'An unexpected error occurred.';

    let devDetails = '';
    // Prioritize the raw message if it exists, otherwise use the status code.
    const primaryDetail = raw || code.toString();
    if (url) {
      devDetails = `${primaryDetail} at ${url}`;
    } else {
      devDetails = primaryDetail;
    }

    return {
      displayMessage,
      devDetails,
    };
  }

  // No statusCode in details
  return {
    displayMessage: originalMessage,
    devDetails: details?.raw || null,
  };
}
