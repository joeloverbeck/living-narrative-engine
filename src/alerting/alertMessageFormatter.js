/**
 * @file Implements the AlertMessageFormatter class for converting alert payloads into displayable messages.
 * @see src/alerting/alertMessageFormatter.js
 */

import { IAlertMessageFormatter } from '../interfaces/IAlertMessageFormatter.js';

/**
 * @typedef {import('./IAlertMessageFormatter.js').FormattedAlert} FormattedAlert
 */

/**
 * @class AlertMessageFormatter
 * @implements {IAlertMessageFormatter}
 * @description A class responsible for converting raw error/warning event payloads into
 * user-friendly messages and structured developer details.
 */
export class AlertMessageFormatter extends IAlertMessageFormatter {
  /**
   * Creates an instance of AlertMessageFormatter.
   * The constructor is parameterless but is included for future dependency injection.
   * @constructor
   */
  constructor() {
    super();
  }

  /**
   * Takes a details object from an event payload and transforms it into a user-friendly message
   * and a structured string of developer-oriented details.
   *
   * @param {any} details - The raw details object from the event payload.
   * @returns {FormattedAlert} An object containing the display message and developer details.
   */
  format(details) {
    // Default case for invalid or empty details
    if (!details || typeof details !== 'object') {
      return {
        displayMessage: 'An unknown warning/error occurred.',
        developerDetails:
          details === null ? 'null' : `Malformed details: ${typeof details}`,
      };
    }

    // Status Code Mapping
    if (typeof details.statusCode === 'number') {
      let displayMessage;
      switch (details.statusCode) {
        case 401:
        case 403:
          displayMessage =
            'Authentication failed. Please check your credentials or permissions.';
          break;
        case 404:
          displayMessage = 'The requested resource could not be found.';
          break;
        case 500:
          displayMessage =
            'An unexpected server error occurred. Please try again later.';
          break;
        case 503:
          displayMessage =
            'Service temporarily unavailable. Please retry in a moment.';
          break;
        default:
          // Fallback for unhandled status codes
          displayMessage = details.message || 'An unexpected error occurred.';
      }

      // Developer Details Generation
      const parts = [details.statusCode];
      if (details.raw) parts.push(details.raw);
      if (details.url) parts.push(`at ${details.url}`);
      const developerDetails = parts.join(' ');

      return { displayMessage, developerDetails };
    }

    // Generic Fallback
    if (details.message) {
      return {
        displayMessage: String(details.message),
        developerDetails: null, // No status code, so no specific developer details
      };
    }

    // Final Default Case for empty objects or objects without useful properties
    return {
      displayMessage: 'An unknown warning/error occurred.',
      developerDetails: null,
    };
  }
}
