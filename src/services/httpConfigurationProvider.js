// src/services/httpConfigurationProvider.js
// --- FILE START ---

import { IConfigurationProvider } from '../interfaces/IConfigurationProvider.js';

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
   * Creates an instance of HttpConfigurationProvider.
   * @param {object} [options] - Configuration options.
   * @param {ILogger} [options.logger] - An ILogger instance for logging. Defaults to the global console.
   */
  constructor(options = {}) {
    super(); // Call superclass constructor
    this.#logger = options.logger || console;
  }

  /**
   * Fetches raw configuration data from the specified URL.
   * It uses the global `fetch` API, handles HTTP errors, parses the response as JSON,
   * and logs the process.
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
    if (
      !sourceUrl ||
      typeof sourceUrl !== 'string' ||
      sourceUrl.trim() === ''
    ) {
      const errorMessage =
        'HttpConfigurationProvider: sourceUrl must be a non-empty string.';
      this.#logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    this.#logger.info(
      `HttpConfigurationProvider: Attempting to load configurations from ${sourceUrl}`
    );

    try {
      const response = await fetch(sourceUrl);

      if (!response.ok) {
        const errorStatusText =
          response.statusText || `HTTP status ${response.status}`;
        this.#logger.error(
          `HttpConfigurationProvider: Failed to fetch configuration from ${sourceUrl}. Status: ${response.status} ${errorStatusText}`
        );
        throw new Error(
          `Failed to fetch configuration file from ${sourceUrl}: ${errorStatusText}`
        );
      }

      /** @type {RootLLMConfigsFile} */
      let jsonData;
      try {
        jsonData = await response.json();
      } catch (parseError) {
        this.#logger.error(
          `HttpConfigurationProvider: Failed to parse JSON response from ${sourceUrl}.`,
          {
            error:
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
          }
        );
        // @ts-ignore
        throw new Error(
          `Failed to parse configuration data from ${sourceUrl} as JSON: ${parseError.message}`
        );
      }

      this.#logger.info(
        `HttpConfigurationProvider: Successfully fetched and parsed configuration from ${sourceUrl}.`
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
      this.#logger.error(
        `HttpConfigurationProvider: Error loading or parsing configuration from ${sourceUrl}. Detail: ${errorMessage}`,
        { error }
      );
      throw new Error(
        `Could not load configuration from ${sourceUrl}: ${errorMessage}`
      );
    }
  }
}

// --- FILE END ---
