// src/actions/validation/validationErrorUtils.js

/**
 * Formats a validation error with additional context.
 *
 * @param {Error} error - The original error.
 * @param {string} context - The context where the error occurred.
 * @param {object} metadata - Additional metadata to include.
 * @returns {Error} A new error with formatted message and metadata.
 */
export function formatValidationError(error, context, metadata) {
  const formattedError = new Error(`${context}: ${error.message}`);
  formattedError.name = 'ValidationError';
  formattedError.originalError = error;
  formattedError.metadata = metadata;

  // Preserve the original stack trace
  if (error.stack) {
    formattedError.stack = error.stack;
  }

  return formattedError;
}

