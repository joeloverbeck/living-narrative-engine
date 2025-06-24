// src/domUI/browserUserPrompt.js
/**
 * @file Implements IUserPrompt using the browser's `window.confirm` API.
 */

/** @typedef {import('../interfaces/IUserPrompt.js').IUserPrompt} IUserPrompt */

/**
 * Simple wrapper around `window.confirm`.
 *
 * @implements {IUserPrompt}
 */
class BrowserUserPrompt {
  /**
   * Displays a confirmation dialog to the user.
   *
   * @param {string} message - The message to display.
   * @returns {boolean} True if the user confirms, false otherwise.
   */
  confirm(message) {
    return typeof window !== 'undefined' ? window.confirm(message) : false;
  }
}

export default BrowserUserPrompt;
