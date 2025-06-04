// llm-proxy-server/src/utils/proxyApiUtils.js

import { RETRYABLE_HTTP_STATUS_CODES } from '../config/constants.js';
import { ensureValidLogger } from './loggerUtils.js'; // MODIFIED: Import ensureValidLogger

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Calculates the retry delay with exponential backoff and jitter.
 *
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
 * @async
 * @function Workspace_retry
 * @description Wraps a fetch API call to provide automatic retries for transient network
 * errors and specific HTTP status codes. It implements an exponential backoff
 * strategy with added jitter.
 *
 * This function is based on the principles outlined in the research documentation,
 * particularly Section 8.2 "Implementing Robust Retry Mechanisms in Javascript".
 * @param {string} url The URL to fetch.
 * @param {object} options The options object for the fetch call (method, headers, body, etc.).
 * @param {number} maxRetries Maximum number of retry attempts before failing.
 * @param {number} baseDelayMs Initial delay in milliseconds for the first retry.
 * @param {number} maxDelayMs Maximum delay in milliseconds between retries, capping the exponential backoff.
 * @param {ILogger} logger - An ILogger instance for logging.
 * @returns {Promise<any>} A promise that resolves with the parsed JSON response on success.
 * @throws {Error} Throws an error if all retries fail, a non-retryable HTTP error occurs,
 * or another unhandled error arises during fetching. The error message will attempt
 * to include details parsed from the error response body (JSON or text).
 * @example
 * try {
 * const options = { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) };
 * // const myLogger = ensureValidLogger(possiblyUndefinedLogger);
 * const responseData = await Workspace_retry('https://api.example.com/data', options, 5, 1000, 30000, myLogger);
 * // myLogger.info(responseData);
 * } catch (error) {
 * // myLogger.error("Failed to fetch data after multiple retries:", error.message);
 * }
 */
export async function Workspace_retry(
  url,
  options,
  maxRetries,
  baseDelayMs,
  maxDelayMs,
  logger
) {
  // MODIFIED: Use ensureValidLogger
  const currentLogger = ensureValidLogger(logger, 'Workspace_retry');

  /**
   * Performs a single fetch attempt and recursively retries on failure.
   *
   * @param {number} currentAttempt - The current attempt number.
   * @returns {Promise<any>} The parsed JSON response if successful.
   */
  async function attemptFetchRecursive(currentAttempt) {
    // currentLogger is already defined in the outer scope and is valid

    try {
      currentLogger.debug(
        `Attempt ${currentAttempt}/${maxRetries} - Fetching ${options.method || 'GET'} ${url}`
      );
      const response = await fetch(url, options);

      if (!response.ok) {
        let errorBodyText = `Status: ${response.status}, StatusText: ${response.statusText}`;
        try {
          const errorJson = await response.json();
          errorBodyText = JSON.stringify(errorJson);
          currentLogger.debug(
            `Attempt ${currentAttempt} for ${url} - Error response body (JSON): ${errorBodyText.substring(0, 500)}`
          );
        } catch (e_json) {
          currentLogger.debug(
            `Attempt ${currentAttempt} for ${url} - Failed to parse error body as JSON: ${e_json.message}`
          );
          try {
            errorBodyText = await response.text();
            currentLogger.debug(
              `Attempt ${currentAttempt} for ${url} - Error response body (Text): ${errorBodyText.substring(0, 500)}`
            );
          } catch (e_text) {
            currentLogger.warn(
              `Attempt ${currentAttempt} for ${url} - Failed to read error response body as JSON or text. Error: ${e_text.message}`
            );
          }
        }

        const isRetryableStatusCode = RETRYABLE_HTTP_STATUS_CODES.includes(
          response.status
        );

        if (isRetryableStatusCode && currentAttempt < maxRetries) {
          // MODIFIED: Use helper function _calculateRetryDelay
          const waitTimeMs = _calculateRetryDelay(
            currentAttempt,
            baseDelayMs,
            maxDelayMs
          );
          currentLogger.warn(
            `Attempt ${currentAttempt}/${maxRetries} for ${url} failed with status ${response.status}. Retrying in ${waitTimeMs}ms... Error body preview: ${errorBodyText.substring(0, 100)}`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
          return attemptFetchRecursive(currentAttempt + 1);
        } else {
          const errorMessage = `API request to ${url} failed after ${currentAttempt} attempt(s) with status ${response.status}: ${errorBodyText}`;
          currentLogger.error(
            `Workspace_retry: ${errorMessage} (Attempt ${currentAttempt}/${maxRetries}, Non-retryable or max retries reached)`
          );
          throw new Error(errorMessage);
        }
      }
      currentLogger.debug(
        `Workspace_retry: Attempt ${currentAttempt}/${maxRetries} for ${url} - Request successful (status ${response.status}). Parsing JSON response.`
      );
      const responseData = await response.json();
      currentLogger.info(
        `Workspace_retry: Successfully fetched and parsed JSON from ${url} after ${currentAttempt} attempt(s).`
      );
      return responseData;
    } catch (error) {
      // Re-throw error if it's one we've already constructed and thrown from non-retryable HTTP status
      if (error.message && error.message.startsWith('API request to')) {
        throw error;
      }

      const isNetworkError =
        error instanceof TypeError &&
        (error.message.toLowerCase().includes('failed to fetch') ||
          error.message.toLowerCase().includes('network request failed') ||
          error.message.toLowerCase().includes('dns lookup failed') ||
          error.message.toLowerCase().includes('socket hang up') ||
          error.message.toLowerCase().includes('econnrefused') ||
          error.message.toLowerCase().includes('econreset') ||
          error.message.toLowerCase().includes('enotfound') ||
          error.message.toLowerCase().includes('etimedout'));

      if (isNetworkError && currentAttempt < maxRetries) {
        // MODIFIED: Use helper function _calculateRetryDelay
        const waitTimeMs = _calculateRetryDelay(
          currentAttempt,
          baseDelayMs,
          maxDelayMs
        );
        currentLogger.warn(
          `Workspace_retry: Attempt ${currentAttempt}/${maxRetries} for ${url} failed with network error: ${error.message}. Retrying in ${waitTimeMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
        return attemptFetchRecursive(currentAttempt + 1);
      } else {
        let finalErrorMessage;
        if (isNetworkError) {
          finalErrorMessage = `Workspace_retry: Failed for ${url} after ${currentAttempt} attempt(s) due to persistent network error: ${error.message}`;
          currentLogger.error(finalErrorMessage, {
            originalErrorName: error.name,
            originalErrorMessage: error.message,
          });
        } else {
          finalErrorMessage = `Workspace_retry: Failed for ${url} after ${currentAttempt} attempt(s). Unexpected error: ${error.message}`;
          currentLogger.error(finalErrorMessage, {
            originalErrorName: error.name,
            originalErrorMessage: error.message,
            stack: error.stack,
          });
        }
        // Ensure the re-thrown error is an Error instance; original 'error' might not be.
        throw new Error(finalErrorMessage);
      }
    }
  }
  currentLogger.info(
    `Workspace_retry: Initiating request sequence for ${url} with maxRetries=${maxRetries}, baseDelayMs=${baseDelayMs}, maxDelayMs=${maxDelayMs}.`
  );
  return attemptFetchRecursive(1);
}
