/**
 * @file Error class for context assembly failures in the GOAP system.
 */

/**
 * Error thrown when context assembly fails.
 * Used for failures during planning, refinement, or condition context assembly.
 */
class ContextAssemblyError extends Error {
  /**
   * @param {string} message - Error message describing the failure
   * @param {object} [details] - Additional error details
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'ContextAssemblyError';
    this.details = details;

    // Maintain proper stack trace (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContextAssemblyError);
    }
  }
}

export default ContextAssemblyError;
