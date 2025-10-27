// src/services/httpConfigurationProvider.js
// --- FILE START ---

import { IConfigurationProvider } from '../interfaces/IConfigurationProvider.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';
import { dispatchSystemErrorEvent } from '../utils/staticErrorDispatcher.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {import('../interfaces/IConfigurationProvider.js').RootLLMConfigsFile} RootLLMConfigsFile
 */

/**
 * @class HttpConfigurationProvider
 * @augments IConfigurationProvider
 * @implements {IConfigurationProvider}
 * @description Fetches LLM configuration data from a given URL using the global fetch API.
 * This class is responsible for retrieving configurations over HTTP, encapsulating
 * the fetch logic and error handling.
 */
export class HttpConfigurationProvider extends IConfigurationProvider {
  /**
   * @private
   * @type {ILogger}
   * @description Logger instance.
   */
  #logger;

  /**
   * @private
   * @type {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher}
   */
  #dispatcher;

  /**
   * Creates an instance of HttpConfigurationProvider.
   *
   * @param {object} [options] - Configuration options.
   * @param {ILogger} [options.logger] - An ILogger instance for logging. Defaults to the global console.
   */
  constructor(options = {}) {
    super();
    this.#logger = options.logger || console;
    if (!options.safeEventDispatcher?.dispatch) {
      throw new Error(
        'HttpConfigurationProvider requires ISafeEventDispatcher'
      );
    }
    this.#dispatcher = options.safeEventDispatcher;
  }

  /**
   * Fetches raw configuration data from the specified URL.
   * It uses the global `fetch` API, handles HTTP errors, parses the response as JSON,
   * and logs the process.
   *
   * @async
   * @param {string} sourceUrl - The URL from which to fetch the configuration data.
   * This URL should point to a JSON file structured according to {@link RootLLMConfigsFile}.
   * @returns {Promise<RootLLMConfigsFile>} A promise that resolves to the parsed JSON object
   * (conforming to the {@link RootLLMConfigsFile} structure).
   * @throws {Error} If `sourceUrl` is invalid, if fetching fails (e.g., network error, non-OK HTTP response),
   * or if parsing the JSON response fails.
   * @override
   */
  async fetchData(sourceUrl) {
    const isString = typeof sourceUrl === 'string';
    const normalizedUrl = isString ? sourceUrl.trim() : '';

    if (!isString || normalizedUrl === '') {
      const errorMessage =
        'HttpConfigurationProvider: sourceUrl must be a non-empty string.';
      await dispatchSystemErrorEvent(
        this.#dispatcher,
        errorMessage,
        {
          scopeName: 'HttpConfigurationProvider.fetchData',
          url: isString ? sourceUrl : undefined,
        },
        this.#logger
      );
      throw new Error(errorMessage);
    }

    this.#logger.debug(
      `HttpConfigurationProvider: Attempting to load configurations from ${normalizedUrl}`
    );

    try {
      const response = await fetch(normalizedUrl);

      if (!response.ok) {
        const errorStatusText =
          response.statusText || `HTTP status ${response.status}`;
        await dispatchSystemErrorEvent(
          this.#dispatcher,
          `HttpConfigurationProvider: Failed to fetch configuration from ${normalizedUrl}. Status: ${response.status} ${errorStatusText}`,
          {
            statusCode: response.status,
            statusText: errorStatusText,
            url: normalizedUrl,
            originalUrl: sourceUrl,
            scopeName: 'HttpConfigurationProvider.fetchData',
          },
          this.#logger
        );
        throw new Error(
          `Failed to fetch configuration file from ${normalizedUrl}: ${errorStatusText}`
        );
      }

      /** @type {RootLLMConfigsFile} */
      let jsonData;
      try {
        jsonData = await response.json();
      } catch (parseError) {
        await dispatchSystemErrorEvent(
          this.#dispatcher,
          `HttpConfigurationProvider: Failed to parse JSON response from ${normalizedUrl}.`,
          {
            error:
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
            stack: parseError instanceof Error ? parseError.stack : undefined,
            url: normalizedUrl,
            originalUrl: sourceUrl,
            scopeName: 'HttpConfigurationProvider.fetchData',
          },
          this.#logger
        );
        throw new Error(
          `Failed to parse configuration data from ${normalizedUrl} as JSON: ${
            parseError instanceof Error
              ? parseError.message
              : String(parseError)
          }`
        );
      }

      this.#logger.debug(
        `HttpConfigurationProvider: Successfully fetched and parsed configuration from ${normalizedUrl}.`
      );
      return jsonData;
    } catch (error) {
      // Errors from `response.ok` check or `response.json()` parseError are already specific and logged.
      // This outer catch handles other errors like network failures before `fetch` resolves,
      // or if the error is not an instance of Error.
      if (
        error instanceof Error &&
        (error.message.startsWith('Failed to fetch configuration file') ||
          error.message.startsWith('Failed to parse configuration data'))
      ) {
        // These specific errors are already logged with good detail, so just rethrow.
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await dispatchSystemErrorEvent(
        this.#dispatcher,
        `HttpConfigurationProvider: Error loading or parsing configuration from ${normalizedUrl}. Detail: ${errorMessage}`,
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          url: normalizedUrl,
          originalUrl: sourceUrl,
          scopeName: 'HttpConfigurationProvider.fetchData',
        },
        this.#logger
      );
      throw new Error(
        `Could not load configuration from ${normalizedUrl}: ${errorMessage}`
      );
    }
  }
}

// --- FILE END ---
