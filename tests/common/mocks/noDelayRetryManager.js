/**
 * @file Zero-delay retry manager for fast testing
 * Implements IRetryManager interface with synchronous retries
 * @see ../../../src/interfaces/IRetryManager.js
 * @see ../../../src/actions/tracing/resilience/retryManager.js
 */

/**
 * Retry manager that performs retries without delays
 * Used in unit tests to avoid setTimeout waits
 *
 * This implementation matches the `retry` method signature from RetryManager
 * but eliminates all delays for fast test execution.
 */
export class NoDelayRetryManager {
  /**
   * Retry an operation without delays
   *
   * @param {function(): Promise<object>} operation - The operation to retry
   * @param {object} options - Retry options
   * @param {number} options.maxAttempts - Maximum number of attempts
   * @returns {Promise<object>} Result of the operation
   * @throws {Error} The last error if all attempts fail
   */
  async retry(operation, options = {}) {
    const { maxAttempts = 3 } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts) {
          throw error;
        }
        // No delay - immediate retry for fast testing
      }
    }

    throw lastError;
  }
}
