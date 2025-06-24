// src/domUI/windowUserPrompt.js

/**
 * @file Default IUserPrompt implementation using the browser's window.confirm.
 */

/** @typedef {import('../interfaces/IUserPrompt.js').IUserPrompt} IUserPrompt */

/**
 * Wraps the global window.confirm for dependency injection.
 *
 * @implements {IUserPrompt}
 */
export class WindowUserPrompt {
  /**
   * Displays a confirmation dialog.
   *
   * @param {string} message - Text shown in the confirmation dialog.
   * @returns {boolean} The user's choice.
   */
  confirm(message) {
    return typeof window !== 'undefined' ? window.confirm(message) : false;
  }
}

export default WindowUserPrompt;
