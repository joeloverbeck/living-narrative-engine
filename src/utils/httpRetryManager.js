// src/utils/httpRetryManager.js
import { getModuleLogger } from './loggerUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @class RetryManager
 * @description Utility class for performing retry logic with exponential backoff.
 */
export class RetryManager {
  /**
   * @param {number} maxRetries Maximum number of attempts.
   * @param {number} baseDelayMs Base delay in milliseconds for retries.
   * @param {number} maxDelayMs Maximum delay between retries.
   * @param {ILogger} [logger] Optional logger instance.
   */
  constructor(maxRetries, baseDelayMs, maxDelayMs, logger) {
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.logger = getModuleLogger('RetryManager', logger);
  }

  /**
   * @description Calculates an exponential backoff delay with jitter.
   * @param {number} currentAttempt Attempt number starting at 1.
   * @param {number} baseDelayMs Base delay in milliseconds.
   * @param {number} maxDelayMs Maximum delay between retries.
   * @returns {number} Delay in milliseconds.
   */
  static calculateRetryDelay(currentAttempt, baseDelayMs, maxDelayMs) {
    const factor = Math.pow(2, currentAttempt - 1);
    let delay = baseDelayMs * factor;
    delay = Math.min(delay, maxDelayMs);
    const jitter = (Math.random() * 0.4 - 0.2) * delay;
    return Math.max(0, Math.floor(delay + jitter));
  }

  /**
   * @description Handle a network error, performing a retry delay when applicable.
   * @param {Error} error The thrown error.
   * @param {number} currentAttempt Current attempt number.
   * @returns {Promise<{retried: boolean}>} Whether a retry occurred.
   */
  async handleNetworkError(error, currentAttempt) {
    const isNetworkError =
      error instanceof TypeError &&
      (error.message.toLowerCase().includes('failed to fetch') ||
        error.message.toLowerCase().includes('network request failed'));

    if (isNetworkError && currentAttempt < this.maxRetries) {
      const waitTimeMs = RetryManager.calculateRetryDelay(
        currentAttempt,
        this.baseDelayMs,
        this.maxDelayMs
      );
      this.logger.warn(
        `RetryManager: Attempt ${currentAttempt}/${this.maxRetries} failed with network error: ${error.message}. Retrying in ${waitTimeMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
      return { retried: true };
    }

    return { retried: false };
  }

  /**
   * @description Execute an operation with retry logic.
   * @param {function(number): Promise<any>} attemptFn Function performing a single attempt.
   * @param {function(any, number): Promise<{retry: boolean, data?: any}>} responseHandler Processes the attempt result.
   * @returns {Promise<any>} Resolved value from a successful attempt.
   * @throws {Error} When all retries fail.
   */
  async perform(attemptFn, responseHandler) {
    let attempt = 1;
    while (attempt <= this.maxRetries) {
      try {
        const result = await attemptFn(attempt);
        const { retry, data } = await responseHandler(result, attempt);
        if (!retry) {
          return data;
        }
      } catch (error) {
        const { retried } = await this.handleNetworkError(error, attempt);
        if (!retried) {
          throw error;
        }
      }
      attempt += 1;
    }
    throw new Error(
      `RetryManager: Failed after ${this.maxRetries} attempts with no successful result.`
    );
  }
}

export default RetryManager;
