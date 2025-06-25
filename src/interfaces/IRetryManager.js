// src/interfaces/IRetryManager.js
// --- FILE START ---

/**
 * @file Defines the interface for a retry manager utility.
 */

/**
 * @interface IRetryManager
 * @description Provides retry logic with exponential backoff.
 */
export class IRetryManager {
  /**
   * Calculates delay in milliseconds before the next retry attempt.
   *
   * @param {number} attempt - Current attempt number starting at 1.
   * @param {number} baseDelayMs - Base delay in ms.
   * @param {number} maxDelayMs - Maximum delay in ms.
   * @returns {number} Calculated delay.
   */
  calculateRetryDelay(attempt, baseDelayMs, maxDelayMs) {
    throw new Error('IRetryManager.calculateRetryDelay not implemented.');
  }

  /**
   * Executes an operation with retry logic.
   *
   * @param {function(number): Promise<any>} attemptFn - Function performing a single attempt.
   * @param {function(any, number): Promise<{retry: boolean, data?: any}>} responseHandler -
   * Handler to process results.
   * @returns {Promise<any>} Result of the successful attempt.
   */
  async perform(attemptFn, responseHandler) {
    throw new Error('IRetryManager.perform method not implemented.');
  }
}

// --- FILE END ---
