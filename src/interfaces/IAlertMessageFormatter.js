/**
 * @file Defines the IAlertMessageFormatter interface for creating user-friendly alert messages.
 */

/**
 * @typedef {object} FormattedAlert
 * @property {string} displayMessage - The user-friendly message to be displayed in the UI.
 * @property {string | null} developerDetails - A structured string with technical details for developers, or null if not applicable.
 */

/**
 * @interface IAlertMessageFormatter
 * @description Defines the contract for a class that formats raw error/warning event payloads
 * into a structured object suitable for display.
 */
export class IAlertMessageFormatter {
  /**
   * Takes a details object from an event payload and transforms it into a user-friendly message
   * and a structured string of developer-oriented details.
   *
   * @param {any} details - The raw details object from the event payload. This can be of any type,
   * and the implementation should handle malformed or unexpected data gracefully.
   * @returns {FormattedAlert} An object containing the display message and developer details.
   */
  format(details) {
    throw new Error('IAlertMessageFormatter.format method not implemented.');
  }
}
