import { getModuleLogger } from './loggerUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';

const RETRYABLE_HTTP_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/**
 * @description Calculates an exponential backoff delay with jitter for retry
 * attempts.
 * @param {number} currentAttempt The current attempt number starting at 1.
 * @param {number} baseDelayMs Base delay in milliseconds for the first retry.
 * @param {number} maxDelayMs Maximum delay allowed between retries.
 * @returns {number} Delay in milliseconds before the next retry.
 * @private
 */
function _calculateRetryDelay(currentAttempt, baseDelayMs, maxDelayMs) {
  const factor = Math.pow(2, currentAttempt - 1);
  let delay = baseDelayMs * factor;
  delay = Math.min(delay, maxDelayMs);
  const jitter = (Math.random() * 0.4 - 0.2) * delay;
  return Math.max(0, Math.floor(delay + jitter));
}

/**
 * @description Parse an error HTTP response body, returning both the parsed
 * JSON body (if possible) and the raw text.
 * @param {Response} response The fetch Response to parse.
 * @returns {Promise<{parsedBody: any, bodyText: string}>} Parsed body object and
 *  body text.
 * @private
 */
async function _parseErrorResponse(response) {
  let bodyText = `Status: ${response.status}, StatusText: ${response.statusText}`;
  let parsedBody = null;
  try {
    const text = await response.clone().text();
    try {
      parsedBody = JSON.parse(text);
      bodyText = JSON.stringify(parsedBody);
    } catch {
      bodyText = text;
    }
  } catch {
    // ignore body read failures
  }
  return { parsedBody, bodyText };
}

/**
 * @description Determine whether the request should be retried based on status
 * code and attempt count.
 * @param {number} status HTTP status code from the response.
 * @param {number} attempt Current attempt number.
 * @param {number} maxRetries Maximum allowed retries.
 * @returns {boolean} True if another retry should be attempted.
 * @private
 */
function _shouldRetry(status, attempt, maxRetries) {
  return RETRYABLE_HTTP_STATUS_CODES.includes(status) && attempt < maxRetries;
}

/**
 * @async
 * @function fetchWithRetry
 * @description
 * Wraps a fetch API call to provide automatic retries for transient network
 * errors and specific HTTP status codes. It implements an exponential backoff
 * strategy with added jitter.
 * @param {string} url The URL to fetch.
 * @param {object} options The options object for the fetch call (method, headers, body, etc.).
 * @param {number} maxRetries Maximum number of attempts before failing.
 * @param {number} baseDelayMs Initial delay in milliseconds for the first retry.
 * @param {number} maxDelayMs Maximum delay in milliseconds between retries, capping the exponential backoff.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} safeEventDispatcher Dispatcher for SYSTEM_ERROR_OCCURRED_ID events.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] Optional logger instance.
 * @param {typeof fetch} [fetchFn] The fetch implementation to use.
 * @returns {Promise<any>} A promise that resolves with the parsed JSON response on success.
 * @throws {Error} Throws an error if all retries fail, a non-retryable HTTP error occurs,
 * or another unhandled error arises during fetching.
 */
export async function fetchWithRetry(
  url,
  options,
  maxRetries,
  baseDelayMs,
  maxDelayMs,
  safeEventDispatcher,
  logger,
  fetchFn = fetch
) {
  const log = getModuleLogger('fetchWithRetry', logger);

  /**
   *
   * @param currentAttempt
   */
  async function attemptFetchRecursive(currentAttempt) {
    try {
      log.debug(
        `Attempt ${currentAttempt}/${maxRetries} - Fetching ${options.method || 'GET'} ${url}`
      );
      const response = await fetchFn(url, options);

      if (!response.ok) {
        const { parsedBody, bodyText } = await _parseErrorResponse(response);

        if (_shouldRetry(response.status, currentAttempt, maxRetries)) {
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
            `Attempt ${currentAttempt}/${maxRetries} for ${url} failed with status ${response.status}. Retrying in ${waitTimeMs}ms... Error body preview: ${bodyText.substring(0, 100)}`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
          return attemptFetchRecursive(currentAttempt + 1);
        }

        const errorMessage = `API request to ${url} failed after ${currentAttempt} attempt(s) with status ${response.status}: ${bodyText}`;
        await safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
          message: `fetchWithRetry: ${errorMessage} (Attempt ${currentAttempt}/${maxRetries}, Non-retryable or max retries reached)`,
          details: {
            status: response.status,
            body: parsedBody !== null ? parsedBody : bodyText,
          },
        });
        const err = new Error(errorMessage);
        err.status = response.status;
        err.body = parsedBody !== null ? parsedBody : bodyText;
        throw err;
      }

      log.debug(
        `fetchWithRetry: Attempt ${currentAttempt}/${maxRetries} for ${url} - Request successful (status ${response.status}). Parsing JSON response.`
      );
      const responseData = await response.json();
      log.debug(
        `fetchWithRetry: Successfully fetched and parsed JSON from ${url} after ${currentAttempt} attempt(s).`
      );
      return responseData;
    } catch (error) {
      if (error.message.startsWith('API request to')) {
        throw error;
      }

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
          `fetchWithRetry: Attempt ${currentAttempt}/${maxRetries} for ${url} failed with network error: ${error.message}. Retrying in ${waitTimeMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
        return attemptFetchRecursive(currentAttempt + 1);
      }

      let finalErrorMessage;
      if (isNetworkError) {
        finalErrorMessage = `fetchWithRetry: Failed for ${url} after ${currentAttempt} attempt(s) due to persistent network error: ${error.message}`;
      } else {
        finalErrorMessage = `fetchWithRetry: Failed for ${url} after ${currentAttempt} attempt(s). Unexpected error: ${error.message}`;
      }
      await safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: finalErrorMessage,
        details: {
          originalErrorName: error.name,
          originalErrorMessage: error.message,
          stack: error.stack,
          status: error.status,
        },
      });
      const finalError = new Error(finalErrorMessage);
      finalError.status = error.status;
      throw finalError;
    }
  }

  log.debug(
    `fetchWithRetry: Initiating request sequence for ${url} with maxRetries=${maxRetries}, baseDelayMs=${baseDelayMs}, maxDelayMs=${maxDelayMs}.`
  );
  return attemptFetchRecursive(1);
}
