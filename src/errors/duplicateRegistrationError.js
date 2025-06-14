/**
 * @file Defines the DuplicateRegistrationError class.
 */

/**
 * @class DuplicateRegistrationError
 * @description Error thrown when an attempt is made to index a different list of actions
 * for the same actor within the same turn.
 * @extends {Error}
 */
export class DuplicateRegistrationError extends Error {
  /**
   * @param {string} message - The error message.
   */
  constructor(message) {
    super(message);
    this.name = 'DuplicateRegistrationError';
  }
}
