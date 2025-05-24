// src/llms/errors/LLMStrategyError.js
// --- FILE START ---

/**
 * @file Defines the LLMStrategyError custom error class.
 */

/**
 * @class LLMStrategyError
 * @extends {Error}
 * @description Custom error class for errors specific to the execution of an ILLMStrategy.
 * This error is thrown when a strategy encounters an issue in its specific logic,
 * such as problems with payload construction, response data extraction, or if the
 * LLM's response, though received, doesn't match the expected format for that strategy.
 */
export class LLMStrategyError extends Error {
    /**
     * The ID of the LLM configuration being used when the error occurred.
     * @type {string | undefined}
     */
    llmId;

    /**
     * The original error that caused this strategy error, if any.
     * @type {Error | null | undefined}
     */
    originalError;

    /**
     * Additional details or context about the error.
     * @type {object | undefined}
     */
    details;

    /**
     * Creates an instance of LLMStrategyError.
     * @param {string} message - The primary error message.
     * @param {string} [llmId] - The ID of the LLM configuration involved.
     * @param {Error | null} [originalError] - The original error that was caught, if applicable.
     * @param {object} [details] - Any additional contextual details about the error.
     */
    constructor(message, llmId, originalError = null, details) {
        super(message);
        this.name = "LLMStrategyError";
        this.llmId = llmId;
        this.originalError = originalError;
        this.details = details;

        // Maintains proper stack trace in V8 environments (Chrome, Node.js)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, LLMStrategyError);
        }
    }
}

// --- FILE END ---