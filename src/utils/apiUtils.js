// src/utils/apiUtils.js
// --- FILE START ---
import { ensureValidLogger } from './loggerUtils.js';

const RETRYABLE_HTTP_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/**
 *
 * @param currentAttempt
 * @param baseDelayMs
 * @param maxDelayMs
 */
function _calculateRetryDelay(currentAttempt, baseDelayMs, maxDelayMs) {
  const factor = Math.pow(2, currentAttempt - 1);
  let delay = baseDelayMs * factor;
  delay = Math.min(delay, maxDelayMs);
  const jitter = (Math.random() * 0.4 - 0.2) * delay;
  return Math.max(0, Math.floor(delay + jitter));
}

/**
 * @async
 * @function Workspace_retry
 * @description
 * Wraps a fetch API call to provide automatic retries for transient network
 * errors and specific HTTP status codes. It implements an exponential backoff
 * strategy with added jitter.
 *
 * This function is based on the principles outlined in the research documentation,
 * particularly Section 8.2 "Implementing Robust Retry Mechanisms in Javascript"[cite: 1].
 * @param {string} url The URL to fetch.
 * @param {object} options The options object for the fetch call (method, headers, body, etc.).
 * @param {number} maxRetries Maximum number of retry attempts before failing.
 * @param {number} baseDelayMs Initial delay in milliseconds for the first retry.
 * @param {number} maxDelayMs Maximum delay in milliseconds between retries, capping the exponential backoff.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] Optional logger instance.
 * @returns {Promise<any>} A promise that resolves with the parsed JSON response on success.
 * @throws {Error} Throws an error if all retries fail, a non-retryable HTTP error occurs,
 * or another unhandled error arises during fetching. The error message will attempt
 * to include details parsed from the error response body (JSON or text).
 * If a 429 status is encountered and the response includes a `Retry-After`
 * header, that value (in seconds) is used as the next delay before retrying.
 * @example
 * try {
 * const options = { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) };
 * const responseData = await Workspace_retry('[https://api.example.com/data](https://api.example.com/data)', options, 5, 1000, 30000);
 * console.log(responseData);
 * } catch (error) {
 * console.error("Failed to fetch data after multiple retries:", error.message);
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
  const log = ensureValidLogger(logger, 'Workspace_retry');
  // This internal recursive function handles the actual fetch attempts and retry logic.
  // It's called by Workspace_retry with the initial attempt number.
  /**
   *
   * @param currentAttempt
   */
  async function attemptFetchRecursive(currentAttempt) {
    try {
      log.debug(
        `Attempt ${currentAttempt}/${maxRetries} - Fetching ${options.method || 'GET'} ${url}`
      );
      const response = await fetch(url, options);

      if (!response.ok) {
        // Attempt to get more detailed error information from the response body [cite: 1]
        let errorBodyText = `Status: ${response.status}, StatusText: ${response.statusText}`;
        let parsedErrorBody = null;
        try {
          parsedErrorBody = await response.json();
          errorBodyText = JSON.stringify(parsedErrorBody); // [cite: 1]
        } catch (e) {
          try {
            errorBodyText = await response.text(); // [cite: 1]
          } catch (e_text) {
            // If reading as text also fails, stick with the status text [cite: 1]
          }
        }

        const isRetryableStatusCode = RETRYABLE_HTTP_STATUS_CODES.includes(
          response.status
        );

        if (isRetryableStatusCode && currentAttempt < maxRetries) {
          let waitTimeMs;
          if (response.status === 429) {
            const retryAfter = parseFloat(response.headers.get('Retry-After'));
            if (!Number.isNaN(retryAfter) && retryAfter > 0) {
              waitTimeMs = Math.floor(retryAfter * 1000);
            }
          }
          if (waitTimeMs === undefined) {
            waitTimeMs = _calculateRetryDelay(
              currentAttempt,
              baseDelayMs,
              maxDelayMs
            );
          }

          log.warn(
            `Attempt ${currentAttempt}/${maxRetries} for ${url} failed with status ${response.status}. Retrying in ${waitTimeMs}ms... Error body preview: ${errorBodyText.substring(0, 100)}`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
          return attemptFetchRecursive(currentAttempt + 1);
        } else {
          // Non-retryable HTTP error or max retries reached for an HTTP error
          const errorMessage = `API request to ${url} failed after ${currentAttempt} attempt(s) with status ${response.status}: ${errorBodyText}`;
          log.error(
            `Workspace_retry: ${errorMessage} (Attempt ${currentAttempt}/${maxRetries}, Non-retryable or max retries reached)`
          );
          const err = new Error(errorMessage);
          err.status = response.status;
          err.body = parsedErrorBody !== null ? parsedErrorBody : errorBodyText;
          throw err;
        }
      }
      log.debug(
        `Workspace_retry: Attempt ${currentAttempt}/${maxRetries} for ${url} - Request successful (status ${response.status}). Parsing JSON response.`
      );
      const responseData = await response.json();
      log.debug(
        `Workspace_retry: Successfully fetched and parsed JSON from ${url} after ${currentAttempt} attempt(s).`
      );
      return responseData;
    } catch (error) {
      // This catch block handles network errors (e.g., TypeError from fetch)
      // or errors re-thrown from the !response.ok block if they weren't caught by the specific `Error` type check.
      // If the error was intentionally thrown from the !response.ok block, it's already formatted.
      if (error.message.startsWith('API request to')) {
        throw error; // Re-throw the custom error from HTTP failure path
      }

      // Check for network errors (e.g., TypeError: Failed to fetch) [cite: 1]
      const isNetworkError =
        error instanceof TypeError &&
        (error.message.toLowerCase().includes('failed to fetch') ||
          error.message.toLowerCase().includes('network request failed'));

      if (isNetworkError && currentAttempt < maxRetries) {
        const waitTimeMs = _calculateRetryDelay(
          currentAttempt,
          baseDelayMs,
          maxDelayMs
        );

        log.warn(
          `Workspace_retry: Attempt ${currentAttempt}/${maxRetries} for ${url} failed with network error: ${error.message}. Retrying in ${waitTimeMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
        return attemptFetchRecursive(currentAttempt + 1);
      } else {
        let finalErrorMessage;
        if (isNetworkError) {
          finalErrorMessage = `Workspace_retry: Failed for ${url} after ${currentAttempt} attempt(s) due to persistent network error: ${error.message}`;
          log.error(finalErrorMessage, {
            originalErrorName: error.name,
            originalErrorMessage: error.message,
          });
        } else {
          finalErrorMessage = `Workspace_retry: Failed for ${url} after ${currentAttempt} attempt(s). Unexpected error: ${error.message}`;
          log.error(finalErrorMessage, {
            originalErrorName: error.name,
            originalErrorMessage: error.message,
            stack: error.stack,
          });
        }
        const finalError = new Error(finalErrorMessage);
        finalError.status = error.status;
        throw finalError;
      }
    }
  }

  log.debug(
    `Workspace_retry: Initiating request sequence for ${url} with maxRetries=${maxRetries}, baseDelayMs=${baseDelayMs}, maxDelayMs=${maxDelayMs}.`
  );
  return attemptFetchRecursive(1);
}

// --- FILE END ---
