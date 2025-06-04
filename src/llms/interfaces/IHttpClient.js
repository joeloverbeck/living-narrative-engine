// src/interfaces/IHttpClient.js
// --- NEW FILE START ---

/**
 * @file Defines the IHttpClient interface and related types for making HTTP requests.
 * This interface abstracts HTTP client implementations, facilitating testability and flexibility
 * by decoupling components from concrete HTTP client libraries and their specific retry logic.
 */

/**
 * @typedef {'GET' | 'POST' | 'PUT' | 'DELETE' | string} HttpMethod
 * @description Represents common HTTP methods. Allows for standard methods explicitly
 * and supports any other method as a string for flexibility.
 */

/**
 * @typedef {object} HttpClientRequestOptions
 * @description Defines the options for an HTTP request made through an IHttpClient implementation.
 * These options provide a standardized way to specify common request parameters.
 * @property {HttpMethod} method - The HTTP method to be used for the request (e.g., 'GET', 'POST').
 * @property {Record<string, string>} [headers] - Optional. A dictionary of HTTP headers to be sent with the request.
 * Keys are header names and values are header values. For example, `{'Content-Type': 'application/json', 'Authorization': 'Bearer token'}`.
 * @property {string} [body] - Optional. The request body, typically a string. For JSON payloads, this
 * would usually be the result of `JSON.stringify(payload)`.
 * @property {number} [timeout] - Optional. The request timeout in milliseconds. If the request takes
 * longer than this value to complete, it should be aborted, and the promise returned by
 * the `request` method should be rejected.
 * @property {any} [additionalOptions] - Optional. A placeholder for any other common fetch options
 * that specific implementations might need or support. This allows for extensibility
 * without cluttering the primary interface properties for very specific use cases.
 * For example, `credentials`, `mode`, `cache`, `redirect`, `referrer`, `integrity`, etc.
 * The exact interpretation of these options is up to the implementing class.
 */

/**
 * @interface IHttpClient
 * @description Defines a standardized contract for making HTTP requests.
 * Implementations of this interface are responsible for handling the actual
 * HTTP communication. This includes aspects like managing connections,
 * sending the request, receiving the response, and potentially handling
 * underlying library-specific configurations.
 *
 * This abstraction is crucial for making components that perform HTTP requests
 * (like LLM strategies or other service connectors) more testable and flexible,
 * allowing different HTTP client libraries or mock implementations to be used.
 *
 * Note: Retry logic is typically handled by a wrapper class that implements this
 * interface (e.g., a `RetryHttpClient`), rather than by every direct implementation.
 */
export class IHttpClient {
  /**
   * Asynchronously makes an HTTP request to the specified URL with the given options.
   *
   * @async
   * @param {string} url - The absolute URL to which the request will be made.
   * @param {HttpClientRequestOptions} options - An object containing the request details
   * such as method, headers, body, and timeout.
   * @returns {Promise<any>} A Promise that resolves with the parsed JSON response body
   * from the server if the request is successful and the response content type indicates JSON.
   * For LLM interactions, this is typically the primary need.
   *
   * The promise should reject if:
   * - A network error occurs (e.g., DNS resolution failure, connection refused).
   * - The request times out based on the `options.timeout` value.
   * - The server responds with a non-successful HTTP status code (e.g., 4xx or 5xx)
   * that is not handled by any internal retry logic (if present in the implementation).
   * - The response is expected to be JSON (common case for LLMs) but cannot be parsed as such.
   *
   * Rejections should ideally use a custom error object (e.g., `HttpClientError`) that
   * includes details like the HTTP status code (if available), a descriptive message,
   * and potentially the original error or response data for debugging.
   * @throws {Error} The promise will reject with an Error (or a custom subclass like HttpClientError).
   * The error should encapsulate details about the failure.
   * For example:
   * `new HttpClientError('Request failed with status 404', { status: 404, url: '...' })`
   * `new HttpClientError('Network error', { cause: originalNetworkError, url: '...' })`
   * `new HttpClientError('Request timeout', { url: '...' })`
   * `new HttpClientError('Failed to parse JSON response', { cause: parsingError, url: '...' })`
   */
  async request(url, options) {
    // This is an interface method and should not be called directly.
    // Implementations must override this method.
    throw new Error('IHttpClient.request method not implemented.');
  }
}

// --- NEW FILE END ---
