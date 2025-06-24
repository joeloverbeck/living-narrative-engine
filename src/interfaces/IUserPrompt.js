// src/interfaces/IUserPrompt.js
/**
 * @interface IUserPrompt
 * @description Provides a way to prompt the user for confirmation.
 */
export class IUserPrompt {
  /**
   * Displays a confirmation prompt to the user.
   *
   * @param {string} message - The confirmation message.
   * @returns {boolean} True if the user confirms, false otherwise.
   */
  confirm(message) {
    throw new Error('IUserPrompt.confirm method not implemented.');
  }
}

// --- Boilerplate to ensure module semantics ---
export {};
