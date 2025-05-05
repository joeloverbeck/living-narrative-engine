// src/core/errors/promptError.js
// --- FILE START ---

/**
 * @fileoverview Defines a custom error class for errors related to player prompting.
 */

/**
 * @class PromptError
 * @extends Error
 * @description Custom error class for failures specifically related to player prompting logic,
 * such as issues during action discovery or dispatching the prompt event.
 */
export class PromptError extends Error {
    /**
     * The original error that caused this PromptError, if available.
     * @type {Error | any | undefined}
     * @public
     */
    cause;

    /**
     * Creates an instance of PromptError.
     * @param {string} message - The primary error message describing the prompt failure.
     * @param {Error | any} [originalError] - The underlying error that triggered this error, if any.
     * This will be stored in the `cause` property.
     */
    constructor(message, originalError) {
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

        // Ensure the prototype chain is correctly set for instanceof checks
        // This is often necessary when extending built-in types like Error in older JS environments
        // or specific transpiler configurations, but generally good practice.
        Object.setPrototypeOf(this, PromptError.prototype);
    }
}

// --- FILE END ---