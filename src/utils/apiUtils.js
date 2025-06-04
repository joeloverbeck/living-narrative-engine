// src/utils/apiUtils.js
// --- FILE START ---

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
  maxDelayMs
) {
  // This internal recursive function handles the actual fetch attempts and retry logic.
  // It's called by Workspace_retry with the initial attempt number.
  /**
   *
   * @param currentAttempt
   */
  async function attemptFetchRecursive(currentAttempt) {
    try {
      const response = await fetch(url, options); // "Workspace API call"

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

        // Retryable HTTP status codes based on Acceptance Criteria and
        const isRetryableStatusCode = [408, 429, 500, 502, 503].includes(
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
            const delayFactor = Math.pow(2, currentAttempt - 1); // currentAttempt starts at 1
            let delay = baseDelayMs * delayFactor;
            delay = Math.min(delay, maxDelayMs); // Cap the delay [cite: 1]
            const jitter = (Math.random() * 0.4 - 0.2) * delay;
            waitTimeMs = Math.max(0, Math.floor(delay + jitter)); // Ensure non-negative
          }

          console.warn(
            `Workspace_retry: Attempt ${currentAttempt}/${maxRetries} for ${url} failed with status ${response.status}. Retrying in ${waitTimeMs}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
          return attemptFetchRecursive(currentAttempt + 1);
        } else {
          // Non-retryable HTTP error or max retries reached for an HTTP error
          const errorMessage = `API request to ${url} failed after ${currentAttempt} attempt(s) with status ${response.status}: ${errorBodyText}`;
          const err = new Error(errorMessage);
          err.status = response.status;
          err.body = parsedErrorBody !== null ? parsedErrorBody : errorBodyText;
          console.error(errorMessage);
          throw err;
        }
      }
      // Assuming the successful LLM API response is JSON content [cite: 1]
      return response.json();
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
        const delayFactor = Math.pow(2, currentAttempt - 1);
        let delay = baseDelayMs * delayFactor;
        delay = Math.min(delay, maxDelayMs);
        const jitter = (Math.random() * 0.4 - 0.2) * delay;
        const waitTimeMs = Math.max(0, Math.floor(delay + jitter));

        console.warn(
          `Workspace_retry: Attempt ${currentAttempt}/${maxRetries} for ${url} failed with network error: ${error.message}. Retrying in ${waitTimeMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
        return attemptFetchRecursive(currentAttempt + 1);
      } else {
        // Max retries reached for a network error, or it's another type of error not handled above.
        const finalErrorMessage = `Workspace failed for ${url} after ${currentAttempt} attempt(s). Final error: ${error.message}`;
        const finalError = new Error(finalErrorMessage);
        finalError.status = error.status;
        console.error(finalErrorMessage, error); // Log the original error for more context
        throw finalError;
      }
    }
  }

  return attemptFetchRecursive(1); // Start with the first attempt
}

// --- FILE END ---
