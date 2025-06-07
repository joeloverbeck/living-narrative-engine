// src/llms/environmentContext.js
// --- FILE START ---

/**
 * @typedef {object} ILogger
 * @description Defines a basic logger interface.
 * @property {(message: string, ...args: any[]) => void} info - Logs an informational message.
 * @property {(message: string, ...args: any[]) => void} warn - Logs a warning message.
 * @property {(message: string, ...args: any[]) => void} error - Logs an error message.
 * @property {(message: string, ...args: any[]) => void} debug - Logs a debug message.
 */

const DEFAULT_PROXY_SERVER_URL = 'http://localhost:3001/api/llm-request';
const VALID_EXECUTION_ENVIRONMENTS = ['client', 'server', 'unknown'];

/**
 * @class EnvironmentContext
 * @description Encapsulates and validates information about the application's execution environment.
 * This class centralizes environment-specific settings, making them explicitly available and testable.
 */
export class EnvironmentContext {
  /**
   * @private
   * @type {ILogger}
   */
  #logger;

  /**
   * @private
   * @type {'client' | 'server' | 'unknown'}
   */
  #executionEnvironment;

  /**
   * @private
   * @type {string | null}
   */
  #projectRootPath;

  /**
   * @private
   * @type {string}
   */
  #proxyServerUrl;

  /**
   * Creates an instance of EnvironmentContext.
   *
   * @param {object} params - The parameters for the EnvironmentContext.
   * @param {ILogger} params.logger - An instance conforming to ILogger for internal logging.
   * @param {string} params.executionEnvironment - The execution environment. Expected to be 'client', 'server', or 'unknown'.
   * @param {string} [params.projectRootPath] - Optional. Absolute path to the project root.
   * Required if executionEnvironment is 'server' and file-based operations are anticipated.
   * @param {string} [params.proxyServerUrl] - Optional. The URL of the proxy server.
   * Primarily used if executionEnvironment is 'client'.
   * @throws {Error} If logger is invalid or if critical validations fail (e.g., missing projectRootPath for server).
   */
  constructor({
    logger,
    executionEnvironment,
    projectRootPath = null,
    proxyServerUrl = null,
  }) {
    // Validate logger
    if (
      !logger ||
      typeof logger.warn !== 'function' ||
      typeof logger.error !== 'function' ||
      typeof logger.debug !== 'function'
    ) {
      const errorMsg =
        'EnvironmentContext: Constructor requires a valid logger instance with info, warn, error, and debug methods.';
      // Use console.error as a last resort if logger is completely unusable
      (logger && typeof logger.error === 'function' ? logger : console).error(
        errorMsg
      );
      throw new Error(errorMsg);
    }
    this.#logger = logger;

    // Validate and set executionEnvironment
    if (
      typeof executionEnvironment === 'string' &&
      VALID_EXECUTION_ENVIRONMENTS.includes(executionEnvironment.toLowerCase())
    ) {
      this.#executionEnvironment = executionEnvironment.toLowerCase();
    } else {
      const warningMsg = `EnvironmentContext: Invalid executionEnvironment provided: '${executionEnvironment}'. Defaulting to 'unknown'. Valid options are: ${VALID_EXECUTION_ENVIRONMENTS.join(', ')}.`;
      this.#logger.warn(warningMsg);
      this.#executionEnvironment = 'unknown';
      // As per ticket: "Log a warning and default to 'unknown' or throw an error" - choosing default.
    }

    // Validate and set projectRootPath
    this.#projectRootPath = null; // Initialize to null
    if (this.#executionEnvironment === 'server') {
      if (
        !projectRootPath ||
        typeof projectRootPath !== 'string' ||
        projectRootPath.trim() === ''
      ) {
        const errorMsg =
          "EnvironmentContext: Constructor requires 'projectRootPath' (non-empty string) when executionEnvironment is 'server'.";
        this.#logger.error(errorMsg);
        throw new Error(errorMsg);
      }
      this.#projectRootPath = projectRootPath.trim();
      this.#logger.debug(
        `EnvironmentContext: Server-side projectRootPath set to: '${this.#projectRootPath}'`
      );
    } else if (projectRootPath) {
      this.#logger.warn(
        `EnvironmentContext: 'projectRootPath' ("${projectRootPath}") was provided, but executionEnvironment is '${this.#executionEnvironment}', not 'server'. It will be ignored.`
      );
      // this.#projectRootPath remains null as it's not applicable
    }

    // Validate and set proxyServerUrl
    if (this.#executionEnvironment === 'client') {
      if (
        proxyServerUrl &&
        typeof proxyServerUrl === 'string' &&
        proxyServerUrl.trim() !== ''
      ) {
        try {
          // Validate if it's a proper URL
          new URL(proxyServerUrl.trim());
          this.#proxyServerUrl = proxyServerUrl.trim();
          this.#logger.debug(
            `EnvironmentContext: Client-side proxy URL configured to: '${this.#proxyServerUrl}'.`
          );
        } catch (e) {
          this.#logger.warn(
            `EnvironmentContext: Provided proxyServerUrl '${proxyServerUrl}' for client environment is not a valid URL. Falling back to default: '${DEFAULT_PROXY_SERVER_URL}'. Error: ${e.message}`
          );
          this.#proxyServerUrl = DEFAULT_PROXY_SERVER_URL;
        }
      } else {
        this.#proxyServerUrl = DEFAULT_PROXY_SERVER_URL;
        if (proxyServerUrl === null || proxyServerUrl === undefined) {
          this.#logger.debug(
            `EnvironmentContext: Client-side proxyServerUrl not provided. Using default: '${this.#proxyServerUrl}'.`
          );
        } else {
          this.#logger.warn(
            `EnvironmentContext: Client-side proxyServerUrl provided but was empty or invalid ('${proxyServerUrl}'). Using default: '${this.#proxyServerUrl}'.`
          );
        }
      }
    } else {
      // For 'server' or 'unknown' environments
      if (
        proxyServerUrl &&
        typeof proxyServerUrl === 'string' &&
        proxyServerUrl.trim() !== ''
      ) {
        try {
          new URL(proxyServerUrl.trim()); // Validate if provided
          this.#proxyServerUrl = proxyServerUrl.trim();
          this.#logger.debug(
            `EnvironmentContext: proxyServerUrl ('${this.#proxyServerUrl}') was provided for non-client environment ('${this.#executionEnvironment}'). It might not be used.`
          );
        } catch (e) {
          this.#logger.debug(
            `EnvironmentContext: Provided proxyServerUrl '${proxyServerUrl}' for non-client environment is not a valid URL. Setting to default ('${DEFAULT_PROXY_SERVER_URL}'), but it might not be used. Error: ${e.message}`
          );
          this.#proxyServerUrl = DEFAULT_PROXY_SERVER_URL;
        }
      } else {
        this.#proxyServerUrl = DEFAULT_PROXY_SERVER_URL; // Set a default even if not client, though it might not be used.
        if (proxyServerUrl) {
          // if it was provided but empty/invalid type
          this.#logger.debug(
            `EnvironmentContext: proxyServerUrl was provided but invalid for non-client environment ('${this.#executionEnvironment}'). Defaulting to '${this.#proxyServerUrl}', though it might not be used.`
          );
        } else {
          this.#logger.debug(
            `EnvironmentContext: proxyServerUrl not provided for non-client environment ('${this.#executionEnvironment}'). Defaulting to '${this.#proxyServerUrl}', though it might not be used.`
          );
        }
      }
    }
    this.#logger.debug(
      `EnvironmentContext: Instance created. Execution environment: ${this.#executionEnvironment}.`
    );
  }

  /**
   * Gets the execution environment.
   *
   * @returns {'client' | 'server' | 'unknown'} The current execution environment.
   */
  getExecutionEnvironment() {
    return this.#executionEnvironment;
  }

  /**
   * Gets the project root path.
   *
   * @returns {string | null} The project root path if the environment is 'server' and it was provided, otherwise null.
   */
  getProjectRootPath() {
    return this.#projectRootPath;
  }

  /**
   * Gets the proxy server URL.
   * Returns the configured URL if in 'client' mode, or the provided URL (or default) in other modes.
   *
   * @returns {string} The proxy server URL.
   */
  getProxyServerUrl() {
    return this.#proxyServerUrl;
  }

  /**
   * Checks if the current execution environment is 'client'.
   *
   * @returns {boolean} True if the execution environment is 'client', false otherwise.
   */
  isClient() {
    return this.#executionEnvironment === 'client';
  }

  /**
   * Checks if the current execution environment is 'server'.
   *
   * @returns {boolean} True if the execution environment is 'server', false otherwise.
   */
  isServer() {
    return this.#executionEnvironment === 'server';
  }
}

// --- FILE END ---
