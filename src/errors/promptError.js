// src/core/errors/promptError.js
// --- FILE START ---

/**
 * @file Defines a custom error class for errors related to player prompting.
 */

/**
 * @class PromptError
 * @augments Error
 * @description Custom error class for failures specifically related to player prompting logic,
 * such as issues during action discovery, dispatching the prompt event, or awaiting player input.
 */
export class PromptError extends Error {
  /**
   * The original error that caused this PromptError, if available.
   * @type {Error | any | undefined}
   * @public
   */
  cause;

  /**
   * An optional error code for programmatic error handling or categorization.
   * @type {string | undefined}
   * @public
   */
  code;

  /**
   * Creates an instance of PromptError.
   * @param {string} message - The primary error message describing the prompt failure.
   * @param {Error | any} [originalError] - The underlying error that triggered this error, if any.
   * This will be stored in the `cause` property.
   * @param {string} [errorCode] - An optional error code (e.g., "PROMPT_TIMEOUT", "INVALID_ACTION_ID").
   * This will be stored in the `code` property.
   */
  constructor(message, originalError, errorCode) {
    super(message); // Pass message to the base Error class constructor
    this.name = 'PromptError'; // Set the name property for identification

    // Capture stack trace (specific to V8, common practice)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PromptError);
    }

    // Store the original error if provided
    if (originalError !== undefined) {
      this.cause = originalError;
    }

    // Store the error code if provided
    if (errorCode !== undefined) {
      this.code = errorCode;
    }

    // Ensure the prototype chain is correctly set for instanceof checks
    Object.setPrototypeOf(this, PromptError.prototype);
  }
}

// --- FILE END ---
