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
import { initLogger } from '../utils/index.js';
import { isNonBlankString } from '../utils/textUtils.js';

/**
 * @description Checks if the provided object conforms to the EnvironmentContext interface.
 * @param {any} ctx - Object to validate.
 * @returns {boolean} True if the object exposes the expected methods.
 */
export function isValidEnvironmentContext(ctx) {
  return (
    !!ctx &&
    typeof ctx.isClient === 'function' &&
    typeof ctx.isServer === 'function' &&
    typeof ctx.getExecutionEnvironment === 'function' &&
    typeof ctx.getProjectRootPath === 'function'
  );
}

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
    this.#validateLogger(logger);
    this.#setExecutionEnvironment(executionEnvironment);
    this.#setProjectRootPath(projectRootPath);
    this.#configureProxyUrl(proxyServerUrl);
    this.#logger.debug(
      `EnvironmentContext: Instance created. Execution environment: ${this.#executionEnvironment}.`
    );
  }

  /**
   * Validates the provided logger and assigns it to the instance.
   *
   * @private
   * @param {ILogger} logger - Logger implementation to validate.
   * @throws {Error} If logger is invalid.
   */
  #validateLogger(logger) {
    this.#logger = initLogger('EnvironmentContext', logger);
  }

  /**
   * Normalizes and stores the execution environment value.
   * Defaults to 'unknown' if the provided value is invalid.
   *
   * @private
   * @param {string} value - Raw execution environment input.
   */
  #setExecutionEnvironment(value) {
    if (
      typeof value === 'string' &&
      VALID_EXECUTION_ENVIRONMENTS.includes(value.toLowerCase())
    ) {
      this.#executionEnvironment = value.toLowerCase();
    } else {
      const warningMsg = `EnvironmentContext: Invalid executionEnvironment provided: '${value}'. Defaulting to 'unknown'. Valid options are: ${VALID_EXECUTION_ENVIRONMENTS.join(', ')}.`;
      this.#logger.warn(warningMsg);
      this.#executionEnvironment = 'unknown';
    }
  }

  /**
   * Validates and assigns the project root path based on the execution environment.
   *
   * @private
   * @param {string | null} path - Project root path to validate.
   * @throws {Error} If required path is missing or invalid when running on the server.
   */
  #setProjectRootPath(path) {
    this.#projectRootPath = null;
    if (this.#executionEnvironment === 'server') {
      if (!path || typeof path !== 'string' || path.trim() === '') {
        const errorMsg =
          "EnvironmentContext: Constructor requires 'projectRootPath' (non-empty string) when executionEnvironment is 'server'.";
        this.#logger.error(errorMsg);
        throw new Error(errorMsg);
      }
      this.#projectRootPath = path.trim();
      this.#logger.debug(
        `EnvironmentContext: Server-side projectRootPath set to: '${this.#projectRootPath}'`
      );
    } else if (path) {
      this.#logger.warn(
        `EnvironmentContext: 'projectRootPath' ("${path}") was provided, but executionEnvironment is '${this.#executionEnvironment}', not 'server'. It will be ignored.`
      );
    }
  }

  /**
   * Determines the proxy URL to use based on environment and input.
   *
   * @private
   * @param {string | null} url - Proxy server URL from configuration.
   */
  #configureProxyUrl(url) {
    if (this.#executionEnvironment === 'client') {
      if (isNonBlankString(url)) {
        try {
          new URL(url.trim());
          this.#proxyServerUrl = url.trim();
          this.#logger.debug(
            `EnvironmentContext: Client-side proxy URL configured to: '${this.#proxyServerUrl}'.`
          );
        } catch (e) {
          this.#logger.warn(
            `EnvironmentContext: Provided proxyServerUrl '${url}' for client environment is not a valid URL. Falling back to default: '${DEFAULT_PROXY_SERVER_URL}'. Error: ${e.message}`
          );
          this.#proxyServerUrl = DEFAULT_PROXY_SERVER_URL;
        }
      } else {
        this.#proxyServerUrl = DEFAULT_PROXY_SERVER_URL;
        if (url === null || url === undefined) {
          this.#logger.debug(
            `EnvironmentContext: Client-side proxyServerUrl not provided. Using default: '${this.#proxyServerUrl}'.`
          );
        } else {
          this.#logger.warn(
            `EnvironmentContext: Client-side proxyServerUrl provided but was empty or invalid ('${url}'). Using default: '${this.#proxyServerUrl}'.`
          );
        }
      }
    } else {
      if (isNonBlankString(url)) {
        try {
          new URL(url.trim());
          this.#proxyServerUrl = url.trim();
          this.#logger.debug(
            `EnvironmentContext: proxyServerUrl ('${this.#proxyServerUrl}') was provided for non-client environment ('${this.#executionEnvironment}'). It might not be used.`
          );
        } catch (e) {
          this.#logger.debug(
            `EnvironmentContext: Provided proxyServerUrl '${url}' for non-client environment is not a valid URL. Setting to default ('${DEFAULT_PROXY_SERVER_URL}'), but it might not be used. Error: ${e.message}`
          );
          this.#proxyServerUrl = DEFAULT_PROXY_SERVER_URL;
        }
      } else {
        this.#proxyServerUrl = DEFAULT_PROXY_SERVER_URL;
        if (url) {
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
