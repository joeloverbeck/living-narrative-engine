// src/interfaces/IUserPrompt.js

/**
 * @interface IUserPrompt
 * @description Provides user confirmation dialogs.
 */
export class IUserPrompt {
  /**
   * Requests user confirmation with a message.
   *
   * @param {string} message - Message to display to the user.
   * @returns {boolean} Result of the confirmation.
   */
  confirm(message) {
    throw new Error('IUserPrompt.confirm method not implemented.');
  }
}
