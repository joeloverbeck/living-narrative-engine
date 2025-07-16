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
    // Check both global.window and window to handle test environments
    const windowObj =
      (typeof global !== 'undefined' && global.window) ||
      (typeof window !== 'undefined' && window);
    return windowObj ? windowObj.confirm(message) : false;
  }
}

export default WindowUserPrompt;
