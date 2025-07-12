// llm-proxy-server/src/utils/proxyApiUtils.js

import {
  RETRYABLE_HTTP_STATUS_CODES,
  ERROR_BODY_PREVIEW_LENGTH,
  ERROR_PREVIEW_SHORT_LENGTH,
} from '../config/constants.js';
import { ensureValidLogger } from './loggerUtils.js'; // MODIFIED: Import ensureValidLogger

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Calculates the retry delay with exponential backoff and jitter.
 * @private
 * @param {number} currentAttempt - The current retry attempt number (1-based).
 * @param {number} baseDelayMs - Initial delay in milliseconds for the first retry.
 * @param {number} maxDelayMs - Maximum delay in milliseconds between retries.
 * @returns {number} The calculated wait time in milliseconds.
 */
function _calculateRetryDelay(currentAttempt, baseDelayMs, maxDelayMs) {
  const delayFactor = Math.pow(2, currentAttempt - 1); // currentAttempt is 1-based
  let delay = baseDelayMs * delayFactor;
  delay = Math.min(delay, maxDelayMs);

  // Apply jitter: +/- 20% of the calculated delay
  const jitter = (Math.random() * 0.4 - 0.2) * delay;
  const waitTimeMs = Math.max(0, Math.floor(delay + jitter)); // Ensure non-negative and integer
  return waitTimeMs;
}

/**
 * @class RetryManager
 * @description Handles retry logic for HTTP requests with exponential backoff and jitter.
 * Breaks down the complex retry functionality into focused, testable methods.
 */
class RetryManager {
  #logger;
  #url;
  #options;
  #maxRetries;
  #baseDelayMs;
  #maxDelayMs;

  /**
   * @param {string} url - The URL to fetch.
   * @param {object} options - The options object for the fetch call.
   * @param {number} maxRetries - Maximum number of retry attempts.
   * @param {number} baseDelayMs - Initial delay in milliseconds for the first retry.
   * @param {number} maxDelayMs - Maximum delay in milliseconds between retries.
   * @param {ILogger} logger - An ILogger instance for logging.
   */
  constructor(url, options, maxRetries, baseDelayMs, maxDelayMs, logger) {
    this.#url = url;
    this.#options = options;
    this.#maxRetries = maxRetries;
    this.#baseDelayMs = baseDelayMs;
    this.#maxDelayMs = maxDelayMs;
    this.#logger = ensureValidLogger(logger, 'RetryManager');
  }

  /**
   * Executes the request with retry logic.
   * @returns {Promise<any>} The parsed JSON response if successful.
   * @throws {Error} If all retries fail or a non-retryable error occurs.
   */
  async executeWithRetry() {
    this.#logger.debug(
      `RetryManager: Initiating request sequence for ${this.#url} with maxRetries=${this.#maxRetries}, baseDelayMs=${this.#baseDelayMs}, maxDelayMs=${this.#maxDelayMs}.`
    );
    return this.#attemptRequest(1);
  }

  /**
   * Attempts a single HTTP request.
   * @private
   * @param {number} currentAttempt - The current attempt number (1-based).
   * @returns {Promise<any>} The parsed JSON response if successful.
   */
  async #attemptRequest(currentAttempt) {
    try {
      this.#logger.debug(
        `Attempt ${currentAttempt}/${this.#maxRetries} - Fetching ${this.#options.method || 'GET'} ${this.#url}`
      );

      const response = await fetch(this.#url, this.#options);

      if (!response.ok) {
        return await this.#handleHttpError(response, currentAttempt);
      }

      return await this.#handleSuccessResponse(response, currentAttempt);
    } catch (error) {
      return await this.#handleFetchError(error, currentAttempt);
    }
  }

  /**
   * Handles HTTP error responses (4xx, 5xx status codes).
   * @private
   * @param {Response} response - The HTTP response object.
   * @param {number} currentAttempt - The current attempt number.
   * @returns {Promise<any>} The result of retry attempt or throws error.
   */
  async #handleHttpError(response, currentAttempt) {
    const errorBodyText = await this.#parseErrorResponse(
      response,
      currentAttempt
    );
    const isRetryable = this.#shouldRetryHttpError(
      response.status,
      currentAttempt
    );

    if (isRetryable) {
      const waitTimeMs = _calculateRetryDelay(
        currentAttempt,
        this.#baseDelayMs,
        this.#maxDelayMs
      );
      this.#logger.warn(
        `Attempt ${currentAttempt}/${this.#maxRetries} for ${this.#url} failed with status ${response.status}. Retrying in ${waitTimeMs}ms... Error body preview: ${errorBodyText.substring(0, ERROR_PREVIEW_SHORT_LENGTH)}`
      );
      await this.#waitForRetry(waitTimeMs);
      return this.#attemptRequest(currentAttempt + 1);
    }

    throw this.#createHttpError(response.status, errorBodyText, currentAttempt);
  }

  /**
   * Handles successful HTTP responses.
   * @private
   * @param {Response} response - The HTTP response object.
   * @param {number} currentAttempt - The current attempt number.
   * @returns {Promise<any>} The parsed JSON response.
   */
  async #handleSuccessResponse(response, currentAttempt) {
    this.#logger.debug(
      `RetryManager: Attempt ${currentAttempt}/${this.#maxRetries} for ${this.#url} - Request successful (status ${response.status}). Parsing JSON response.`
    );
    const responseData = await response.json();
    this.#logger.info(
      `RetryManager: Successfully fetched and parsed JSON from ${this.#url} after ${currentAttempt} attempt(s).`
    );
    return responseData;
  }

  /**
   * Handles fetch errors (network issues, timeouts, etc.).
   * @private
   * @param {Error} error - The error that occurred during fetch.
   * @param {number} currentAttempt - The current attempt number.
   * @returns {Promise<any>} The result of retry attempt or throws error.
   */
  async #handleFetchError(error, currentAttempt) {
    // Re-throw error if it's one we've already constructed and thrown from non-retryable HTTP status
    if (error.message && error.message.startsWith('API request to')) {
      throw error;
    }

    const isNetworkError = this.#isNetworkError(error);

    if (isNetworkError && currentAttempt < this.#maxRetries) {
      const waitTimeMs = _calculateRetryDelay(
        currentAttempt,
        this.#baseDelayMs,
        this.#maxDelayMs
      );
      this.#logger.warn(
        `RetryManager: Attempt ${currentAttempt}/${this.#maxRetries} for ${this.#url} failed with network error: ${error.message}. Retrying in ${waitTimeMs}ms...`
      );
      await this.#waitForRetry(waitTimeMs);
      return this.#attemptRequest(currentAttempt + 1);
    }

    throw this.#createNetworkError(error, currentAttempt, isNetworkError);
  }

  /**
   * Parses error response body from HTTP response.
   * @private
   * @param {Response} response - The HTTP response object.
   * @param {number} currentAttempt - The current attempt number.
   * @returns {Promise<string>} The error body text.
   */
  async #parseErrorResponse(response, currentAttempt) {
    let errorBodyText = `Status: ${response.status}, StatusText: ${response.statusText}`;

    try {
      const errorJson = await response.json();
      errorBodyText = JSON.stringify(errorJson);
      this.#logger.debug(
        `Attempt ${currentAttempt} for ${this.#url} - Error response body (JSON): ${errorBodyText.substring(0, ERROR_BODY_PREVIEW_LENGTH)}`
      );
    } catch (e_json) {
      this.#logger.debug(
        `Attempt ${currentAttempt} for ${this.#url} - Failed to parse error body as JSON: ${e_json.message}`
      );
      try {
        errorBodyText = await response.text();
        this.#logger.debug(
          `Attempt ${currentAttempt} for ${this.#url} - Error response body (Text): ${errorBodyText.substring(0, ERROR_BODY_PREVIEW_LENGTH)}`
        );
      } catch (e_text) {
        this.#logger.warn(
          `Attempt ${currentAttempt} for ${this.#url} - Failed to read error response body as JSON or text. Error: ${e_text.message}`
        );
      }
    }

    return errorBodyText;
  }

  /**
   * Determines if an HTTP error should be retried.
   * @private
   * @param {number} statusCode - The HTTP status code.
   * @param {number} currentAttempt - The current attempt number.
   * @returns {boolean} True if the error should be retried.
   */
  #shouldRetryHttpError(statusCode, currentAttempt) {
    const isRetryableStatusCode =
      RETRYABLE_HTTP_STATUS_CODES.includes(statusCode);
    return isRetryableStatusCode && currentAttempt < this.#maxRetries;
  }

  /**
   * Determines if an error is a network error.
   * @private
   * @param {Error} error - The error to check.
   * @returns {boolean} True if it's a network error.
   */
  #isNetworkError(error) {
    return (
      error instanceof TypeError &&
      (error.message.toLowerCase().includes('failed to fetch') ||
        error.message.toLowerCase().includes('network request failed') ||
        error.message.toLowerCase().includes('dns lookup failed') ||
        error.message.toLowerCase().includes('socket hang up') ||
        error.message.toLowerCase().includes('econnrefused') ||
        error.message.toLowerCase().includes('econreset') ||
        error.message.toLowerCase().includes('enotfound') ||
        error.message.toLowerCase().includes('etimedout'))
    );
  }

  /**
   * Creates an HTTP error for failed requests.
   * @private
   * @param {number} statusCode - The HTTP status code.
   * @param {string} errorBodyText - The error body text.
   * @param {number} currentAttempt - The current attempt number.
   * @returns {Error} The created error.
   */
  #createHttpError(statusCode, errorBodyText, currentAttempt) {
    const errorMessage = `API request to ${this.#url} failed after ${currentAttempt} attempt(s) with status ${statusCode}: ${errorBodyText}`;
    this.#logger.error(
      `RetryManager: ${errorMessage} (Attempt ${currentAttempt}/${this.#maxRetries}, Non-retryable or max retries reached)`
    );
    return new Error(errorMessage);
  }

  /**
   * Creates a network error for failed requests.
   * @private
   * @param {Error} originalError - The original error.
   * @param {number} currentAttempt - The current attempt number.
   * @param {boolean} isNetworkError - Whether it's a network error.
   * @returns {Error} The created error.
   */
  #createNetworkError(originalError, currentAttempt, isNetworkError) {
    let finalErrorMessage;
    if (isNetworkError) {
      finalErrorMessage = `RetryManager: Failed for ${this.#url} after ${currentAttempt} attempt(s) due to persistent network error: ${originalError.message}`;
      this.#logger.error(finalErrorMessage, {
        originalErrorName: originalError.name,
        originalErrorMessage: originalError.message,
      });
    } else {
      finalErrorMessage = `RetryManager: Failed for ${this.#url} after ${currentAttempt} attempt(s). Unexpected error: ${originalError.message}`;
      this.#logger.error(finalErrorMessage, {
        originalErrorName: originalError.name,
        originalErrorMessage: originalError.message,
        stack: originalError.stack,
      });
    }
    return new Error(finalErrorMessage);
  }

  /**
   * Waits for the specified delay before retrying.
   * @private
   * @param {number} waitTimeMs - The time to wait in milliseconds.
   * @returns {Promise<void>} A promise that resolves after the delay.
   */
  async #waitForRetry(waitTimeMs) {
    await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
  }
}

// Export RetryManager directly for dependency injection
export { RetryManager };
