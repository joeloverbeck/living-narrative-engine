/**
 * @file Defines the NoIndexedActionsError class.
 */

/**
 * @class NoIndexedActionsError
 * @description Error thrown when an attempt is made to resolve an action for an actor
 * who has no actions indexed.
 * @extends {Error}
 */
export class NoIndexedActionsError extends Error {
  /**
   * @param {string} message - The error message.
   */
  constructor(message) {
    super(message);
    this.name = 'NoIndexedActionsError';
  }
}
