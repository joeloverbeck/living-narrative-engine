// src/core/errors/modDependencyError.js

/**
 * Custom error class for fatal mod dependency issues.
 * Collects multiple fatal error messages.
 */
class ModDependencyError extends Error {
    /**
     * Creates an instance of ModDependencyError.
     * @param {string} message - A consolidated message, often joined from multiple individual errors.
     */
    constructor(message) {
        super(message); // Pass message to the base Error constructor
        this.name = 'ModDependencyError'; // Set the error name

        // Maintains compatibility with V8 stack trace capture
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ModDependencyError);
        }
    }
}

export default ModDependencyError;