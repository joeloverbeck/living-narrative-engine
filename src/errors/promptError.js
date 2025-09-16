// src/errors/promptError.js
// --- FILE START ---

/**
 * @file Defines a custom error class for errors related to player prompting.
 */

import BaseError from './baseError.js';

/**
 * @class PromptError
 * @augments BaseError
 * @description Custom error class for failures specifically related to player prompting logic,
 * such as issues during action discovery, dispatching the prompt event, or awaiting player input.
 */
export class PromptError extends BaseError {
  /**
   * The original error that caused this PromptError, if available.
   *
   * @type {Error | any | undefined}
   * @public
   */
  cause;

  /**
   * Creates an instance of PromptError.
   *
   * @param {string} message - The primary error message describing the prompt failure.
   * @param {Error | any} [originalError] - The underlying error that triggered this error, if any.
   * This will be stored in the `cause` property.
   * @param {string} [errorCode] - An optional error code (e.g., "PROMPT_TIMEOUT", "INVALID_ACTION_ID").
   * This will be stored in the `code` property.
   */
  constructor(message, originalError, errorCode) {
    const context = { originalError, errorCode };
    super(message, errorCode || 'PROMPT_ERROR', context);
    this.name = 'PromptError';

    // Store for backward compatibility
    if (originalError !== undefined) {
      this.cause = originalError;
    }
    // Note: code is already handled by BaseError
  }

  /**
   * @returns {string} Severity level for prompt errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Prompt errors are recoverable
   */
  isRecoverable() {
    return true;
  }
}

// --- FILE END ---
