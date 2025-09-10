/**
 * @file Retry manager with exponential backoff
 */

/**
 * Manages retry logic with exponential backoff and jitter
 */
export class RetryManager {
  /**
   * Retry an operation with exponential backoff
   *
   * @param {Function} operation - The operation to retry
   * @param {object} options - Retry options
   * @returns {Promise} Result of the operation
   */
  async retry(operation, options = {}) {
    const {
      maxAttempts = 3,
      delay = 1000,
      exponentialBackoff = true,
      maxDelay = 30000,
      jitter = true,
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts) {
          throw error;
        }

        const waitTime = this.#calculateDelay(
          attempt,
          delay,
          exponentialBackoff,
          maxDelay,
          jitter
        );
        await this.#wait(waitTime);
      }
    }

    throw lastError;
  }

  #calculateDelay(attempt, baseDelay, exponential, maxDelay, jitter) {
    let delay = exponential ? baseDelay * Math.pow(2, attempt - 1) : baseDelay;

    delay = Math.min(delay, maxDelay);

    if (jitter) {
      delay *= 0.5 + Math.random() * 0.5; // Add 0-50% jitter
    }

    return Math.floor(delay);
  }

  #wait(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      if (typeof timer === 'object' && timer.unref) {
        timer.unref();
      }
    });
  }
}
