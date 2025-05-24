// src/llms/retryHttpClient.js
// --- NEW FILE START ---

import {IHttpClient} from './interfaces/IHttpClient.js';

/**
 * @typedef {import('../../llms/interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../interfaces/IHttpClient.js').HttpClientRequestOptions} HttpClientRequestOptions
 * @typedef {import('../../interfaces/IHttpClient.js').HttpMethod} HttpMethod
 */

/**
 * @global
 * @async
 * @function Workspace
 * @description A global function assumed to be available for making HTTP requests,
 * behaving similarly to the standard `Workspace` API.
 * @param {string} url - The URL to request.
 * @param {HttpClientRequestOptions} [options] - The request options (method, headers, body, etc.).
 * @returns {Promise<Response>} A promise that resolves to a Response object.
 * The Response object is expected to have:
 * - `ok`: boolean, true if status is 200-299.
 * - `status`: number, the HTTP status code.
 * - `json()`: method, returns a Promise resolving to the parsed JSON body.
 * - `text()`: method, returns a Promise resolving to the raw text body.
 * - `clone()`: method, returns a Promise resolving to a clone of the Response.
 */

// Default retry parameters
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 10000; // 10 seconds

// Standard HTTP status codes that are generally considered retryable
const RETRYABLE_STATUS_CODES = [
    408, // Request Timeout
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
];

/**
 * @class HttpClientError
 * @extends Error
 * @description Custom error class for HTTP client-related errors.
 * It provides structured information about the HTTP request and response context.
 */
export class HttpClientError extends Error {
    /**
     * @type {string}
     */
    url;
    /**
     * @type {number | undefined}
     */
    status;
    /**
     * @type {any | undefined}
     */
    responseBody;
    /**
     * @type {number | undefined}
     */
    attempts;
    /**
     * @type {boolean | undefined}
     */
    isRetryableFailure; // Indicates if the error was a result of a retryable failure that exhausted retries

    /**
     * Creates an instance of HttpClientError.
     * @param {string} message - The primary error message.
     * @param {object} details - Additional details about the error.
     * @param {string} details.url - The URL of the request that failed.
     * @param {number} [details.status] - The HTTP status code, if available.
     * @param {any} [details.responseBody] - The body of the HTTP response, if available.
     * @param {number} [details.attempts] - The number of attempts made before this error.
     * @param {boolean} [details.isRetryableFailure] - Whether this error is due to exhausting retries on a normally retryable condition.
     * @param {Error} [details.cause] - The original error that caused this HttpClientError, if any.
     */
    constructor(message, {url, status, responseBody, attempts, isRetryableFailure, cause}) {
        super(message);
        this.name = 'HttpClientError';
        this.url = url;
        this.status = status;
        this.responseBody = responseBody;
        this.attempts = attempts;
        this.isRetryableFailure = isRetryableFailure;
        if (cause) {
            this.cause = cause;
        }
        // Ensure the stack trace is captured correctly (especially in V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, HttpClientError);
        }
    }
}

/**
 * @class RetryHttpClient
 * @implements {IHttpClient}
 * @description An HTTP client that implements retry logic for failed requests.
 * It uses the global Workspace API for making HTTP calls and encapsulates
 * retry behavior with exponential backoff and jitter.
 */
export class RetryHttpClient extends IHttpClient {
    /**
     * @private
     * @type {ILogger}
     */
    #logger;
    /**
     * @private
     * @type {number}
     */
    #defaultMaxRetries;
    /**
     * @private
     * @type {number}
     */
    #defaultBaseDelayMs;
    /**
     * @private
     * @type {number}
     */
    #defaultMaxDelayMs;

    /**
     * Creates an instance of RetryHttpClient.
     * @param {object} params - The parameters for the RetryHttpClient.
     * @param {ILogger} params.logger - An instance conforming to ILogger for logging.
     * @param {number} [params.defaultMaxRetries=DEFAULT_MAX_RETRIES] - Optional. Max retry attempts.
     * @param {number} [params.defaultBaseDelayMs=DEFAULT_BASE_DELAY_MS] - Optional. Initial delay for retries in ms.
     * @param {number} [params.defaultMaxDelayMs=DEFAULT_MAX_DELAY_MS] - Optional. Max delay between retries in ms.
     */
    constructor({
                    logger,
                    defaultMaxRetries = DEFAULT_MAX_RETRIES,
                    defaultBaseDelayMs = DEFAULT_BASE_DELAY_MS,
                    defaultMaxDelayMs = DEFAULT_MAX_DELAY_MS
                }) {
        super();
        if (!logger || typeof logger.info !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            const errorMsg = 'RetryHttpClient: Constructor requires a valid logger instance.';
            (logger && typeof logger.error === 'function' ? logger : console).error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#logger = logger;

        if (typeof defaultMaxRetries !== 'number' || defaultMaxRetries < 0) {
            this.#logger.warn(`RetryHttpClient: Invalid defaultMaxRetries (${defaultMaxRetries}). Using default: ${DEFAULT_MAX_RETRIES}.`);
            this.#defaultMaxRetries = DEFAULT_MAX_RETRIES;
        } else {
            this.#defaultMaxRetries = defaultMaxRetries;
        }

        if (typeof defaultBaseDelayMs !== 'number' || defaultBaseDelayMs < 0) {
            this.#logger.warn(`RetryHttpClient: Invalid defaultBaseDelayMs (${defaultBaseDelayMs}). Using default: ${DEFAULT_BASE_DELAY_MS}.`);
            this.#defaultBaseDelayMs = DEFAULT_BASE_DELAY_MS;
        } else {
            this.#defaultBaseDelayMs = defaultBaseDelayMs;
        }

        if (typeof defaultMaxDelayMs !== 'number' || defaultMaxDelayMs < 0 || defaultMaxDelayMs < this.#defaultBaseDelayMs) {
            const newMaxDelay = Math.max(this.#defaultBaseDelayMs, DEFAULT_MAX_DELAY_MS);
            this.#logger.warn(`RetryHttpClient: Invalid defaultMaxDelayMs (${defaultMaxDelayMs}). Adjusted to ${newMaxDelay} to be >= baseDelayMs and system default.`);
            this.#defaultMaxDelayMs = newMaxDelay;
        } else {
            this.#defaultMaxDelayMs = defaultMaxDelayMs;
        }

        this.#logger.debug('RetryHttpClient: Instance created.', {
            maxRetries: this.#defaultMaxRetries,
            baseDelayMs: this.#defaultBaseDelayMs,
            maxDelayMs: this.#defaultMaxDelayMs,
        });
    }

    /**
     * @private
     * Calculates the delay for the next retry attempt using exponential backoff with jitter.
     * @param {number} attemptNumberForRetry - The retry attempt number (1 for first retry, 2 for second, etc.).
     * @returns {number} The calculated delay in milliseconds.
     */
    #calculateDelay(attemptNumberForRetry) {
        if (attemptNumberForRetry <= 0) return 0;

        const delayFactor = Math.pow(2, attemptNumberForRetry - 1);
        let delay = this.#defaultBaseDelayMs * delayFactor;
        delay = Math.min(delay, this.#defaultMaxDelayMs);

        const jitter = (Math.random() * 0.4 - 0.2) * delay; // +/- 20% jitter
        const waitTimeMs = Math.max(0, Math.floor(delay + jitter));

        return waitTimeMs;
    }

    /**
     * @private
     * Attempts to read the response body, trying JSON first, then text.
     * Returns the raw string if it's not JSON or if JSON parsing fails.
     * @param {Response} response - The Response object.
     * @returns {Promise<any>} The parsed JSON body, or the text body, or null if unreadable/empty.
     */
    async #tryReadResponseBody(response) {
        let responseBody = null;
        try {
            // Important: Clone the response before reading its body, as it can only be consumed once.
            const clonedResponse = response.clone();
            responseBody = await clonedResponse.json();
        } catch (jsonError) {
            this.#logger.debug(`RetryHttpClient.#tryReadResponseBody: Failed to parse response as JSON. Attempting to read as text. Error: ${jsonError.message}`);
            try {
                const clonedResponseForText = response.clone(); // Use another clone
                responseBody = await clonedResponseForText.text();
                if (responseBody.trim() === '') responseBody = null; // Treat empty string as null
            } catch (textError) {
                this.#logger.warn(`RetryHttpClient.#tryReadResponseBody: Failed to read response body as text after JSON parse failure. Error: ${textError.message}`);
                responseBody = `(Unreadable response body: JSON parse failed with "${jsonError.message}", Text parse failed with "${textError.message}")`;
            }
        }
        return responseBody;
    }

    /**
     * Asynchronously makes an HTTP request to the specified URL with the given options,
     * applying retry logic for transient errors.
     *
     * @async
     * @param {string} url - The absolute URL to which the request will be made.
     * @param {HttpClientRequestOptions} options - An object containing the request details.
     * @returns {Promise<any>} A Promise that resolves with the parsed JSON response body.
     * @throws {HttpClientError} If the request fails after all retries, if a non-retryable error occurs,
     * or if the response is successful but cannot be parsed as JSON.
     */
    async request(url, options) {
        this.#logger.debug(`RetryHttpClient.request: Initiating request to ${url}`, {
            method: options.method,
            // Consider logging headers/body carefully if they contain sensitive info, or omitting them.
        });

        let currentAttempt = 0; // Number of actual attempts made (1-indexed for user messages)
        let lastError = null;

        // The loop runs for initial attempt (currentAttempt=1) + defaultMaxRetries
        while (currentAttempt <= this.#defaultMaxRetries) {
            currentAttempt++;

            try {
                this.#logger.debug(`RetryHttpClient.request: Attempt ${currentAttempt} of ${this.#defaultMaxRetries + 1} to ${url}.`);
                const response = await fetch(url, options);

                if (response.ok) {
                    this.#logger.info(`RetryHttpClient.request: Successful response (status ${response.status}) from ${url} on attempt ${currentAttempt}.`);
                    try {
                        const responseBody = await response.json();
                        this.#logger.debug(`RetryHttpClient.request: Successfully parsed JSON response from ${url}.`);
                        return responseBody;
                    } catch (jsonError) {
                        this.#logger.error(`RetryHttpClient.request: Malformed JSON response from ${url} despite successful status ${response.status}.`, {
                            causeMessage: jsonError.message,
                            url,
                            status: response.status
                        });
                        // This is a terminal failure for this request, no retry on malformed successful JSON.
                        throw new HttpClientError(
                            `Malformed JSON response from ${url} (status ${response.status}).`,
                            {
                                url,
                                status: response.status,
                                attempts: currentAttempt,
                                cause: jsonError,
                                isRetryableFailure: false
                            }
                        );
                    }
                }

                // --- HTTP Error Handling (response.ok is false) ---
                const status = response.status;
                const responseBody = await this.#tryReadResponseBody(response);
                lastError = new HttpClientError(
                    `HTTP error ${status} from ${url}.`,
                    {
                        url,
                        status,
                        responseBody,
                        attempts: currentAttempt,
                        isRetryableFailure: RETRYABLE_STATUS_CODES.includes(status)
                    }
                );

                if (RETRYABLE_STATUS_CODES.includes(status) && currentAttempt <= this.#defaultMaxRetries) {
                    const delayMs = this.#calculateDelay(currentAttempt); // Pass current retry number (1 for first retry)
                    this.#logger.warn(`RetryHttpClient.request: Attempt ${currentAttempt} for ${url} failed with retryable status ${status}. Retrying in ${delayMs}ms...`, {responseBodyPreview: typeof responseBody === 'string' ? responseBody.substring(0, 100) : responseBody});
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    continue; // Next attempt
                } else {
                    // Not a retryable status OR max retries reached for a retryable status
                    const reason = RETRYABLE_STATUS_CODES.includes(status) ? "max retries reached for retryable status" : "non-retryable status";
                    this.#logger.error(`RetryHttpClient.request: Failed for ${url} on attempt ${currentAttempt} with status ${status} (${reason}). No more retries.`, {responseBody});
                    throw lastError; // lastError already contains the necessary details
                }

            } catch (error) {
                // --- Network Error Handling (e.g., TypeError: Failed to fetch) OR error re-thrown from above ---
                if (error instanceof HttpClientError) {
                    // This could be the malformed JSON error or a non-retryable HTTP error from a previous iteration (though loop structure should prevent this for HTTP).
                    // Or, if error handling above re-throws an HttpClientError explicitly.
                    throw error; // Re-throw if it's already our specific error type.
                }

                // Assume other errors are network-like errors or issues with Workspace() itself
                this.#logger.warn(`RetryHttpClient.request: Network/fetch error during attempt ${currentAttempt} for ${url}. Error: ${error.message}`, {originalError: error});
                lastError = new HttpClientError(
                    `Network error during request to ${url}: ${error.message}`,
                    {url, attempts: currentAttempt, cause: error, isRetryableFailure: true} // Network errors are generally considered retryable
                );

                if (currentAttempt <= this.#defaultMaxRetries) {
                    const delayMs = this.#calculateDelay(currentAttempt);
                    this.#logger.warn(`RetryHttpClient.request: Attempt ${currentAttempt} for ${url} encountered network error. Retrying in ${delayMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    continue; // Next attempt
                } else {
                    this.#logger.error(`RetryHttpClient.request: Failed for ${url} due to persistent network error after ${currentAttempt} attempts. Error: ${error.message}`);
                    throw lastError; // lastError contains the wrapped network error
                }
            }
        } // End of while loop

        // This part should ideally not be reached if the loop logic correctly throws/returns.
        // However, as a safeguard, if the loop finishes without returning or throwing:
        this.#logger.error(`RetryHttpClient.request: Exited retry loop for ${url} without success after ${currentAttempt} attempts. Throwing last known error or a generic one.`);
        if (lastError) {
            // Ensure isRetryableFailure is true if we exhausted retries on something that was initially retryable
            if (lastError instanceof HttpClientError && lastError.isRetryableFailure === undefined) {
                // If it was an HTTP error, isRetryableFailure would have been set.
                // If it was a network error, we consider it a retryable failure.
                lastError.isRetryableFailure = true;
            }
            throw lastError;
        }

        // Fallback generic error if lastError is somehow null (shouldn't happen)
        throw new HttpClientError(
            `Request to ${url} failed after ${this.#defaultMaxRetries + 1} attempts. Unknown error state.`,
            {url, attempts: this.#defaultMaxRetries + 1, isRetryableFailure: true}
        );
    }
}

// --- NEW FILE END ---