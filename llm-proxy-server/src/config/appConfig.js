// llm-proxy-server/src/dependencyInjection/appConfig.js
/* eslint-disable no-console */
import dotenv from 'dotenv';

// Load environment variables from .env file at the very beginning
dotenv.config();

/**
 * @typedef {object} ILogger
 * @description Defines a basic logger interface.
 * @property {(message: any, ...optionalParams: any[]) => void} debug - Logs a debug message.
 * @property {(message: any, ...optionalParams: any[]) => void} info - Logs an informational message.
 * @property {(message: any, ...optionalParams: any[]) => void} warn - Logs a warning message.
 * @property {(message: any, ...optionalParams: any[]) => void} error - Logs an error message.
 */

let instance = null;

/**
 * AppConfigService provides centralized access to application-level environment variables.
 */
class AppConfigService {
  /**
   * @type {ILogger}
   * @private
   */
  _logger;

  /** @private */
  _proxyPort;
  /** @private */
  _isProxyPortDefaulted = false; // Added to track if PROXY_PORT was defaulted
  /** @private */
  _llmConfigPath;
  /** @private */
  _proxyAllowedOrigin;
  /** @private */
  _proxyProjectRootPathForApiKeyFiles;

  /**
   * Initializes the AppConfigService. It's recommended to use the getAppConfigService
   * factory function to ensure a singleton instance.
   * @param {ILogger} logger - An ILogger instance.
   */
  constructor(logger) {
    this._logger = logger;

    this._logger.info(
      'AppConfigService: Initializing and loading configurations...'
    );
    this._loadAndLogConfigs();
  }

  /**
   * Helper to log the status of a string-based configuration value.
   * @private
   * @param {string} envVarName - The name of the environment variable (e.g., "LLM_CONFIG_PATH").
   * @param {string | undefined} envVarValue - The direct value from process.env.
   * @param {string | null} finalValue - The final value assigned to the dependencyInjection.
   * @param {string} [defaultValueDescription] - Description if a default is used.
   */
  _logStringEnvVarStatus(
    envVarName,
    envVarValue,
    finalValue,
    defaultValueDescription = 'LlmConfigService will use its default'
  ) {
    const servicePrefix = 'AppConfigService: ';
    if (envVarValue !== undefined) {
      if (envVarValue === '') {
        this._logger.info(
          `${servicePrefix}${envVarName} found in environment but is empty. Current effective value: '${finalValue === null ? 'null' : finalValue}'.`
        );
      } else {
        this._logger.info(
          `${servicePrefix}${envVarName} found in environment: '${envVarValue}'. Effective value: '${finalValue}'.`
        );
      }
    } else {
      this._logger.info(
        `${servicePrefix}${envVarName} not set in environment. ${defaultValueDescription}. Effective value: '${finalValue === null ? 'null' : finalValue}'.`
      );
    }
  }

  /**
   * Loads environment variables, applies defaults, and logs them.
   * @private
   */
  _loadAndLogConfigs() {
    const servicePrefix = 'AppConfigService: ';

    // PROXY_PORT
    const proxyPortEnv = process.env.PROXY_PORT;
    const defaultProxyPort = 3001;
    if (proxyPortEnv !== undefined) {
      const parsedPort = parseInt(proxyPortEnv, 10);
      if (!isNaN(parsedPort) && parsedPort > 0) {
        this._proxyPort = parsedPort;
        this._logger.info(
          `${servicePrefix}PROXY_PORT found in environment: '${proxyPortEnv}'. Using port ${this._proxyPort}.`
        );
        this._isProxyPortDefaulted = false;
      } else {
        this._proxyPort = defaultProxyPort;
        this._logger.warn(
          `${servicePrefix}PROXY_PORT found in environment: '${proxyPortEnv}', but it's invalid. Using default port ${this._proxyPort}.`
        );
        this._isProxyPortDefaulted = true;
      }
    } else {
      this._proxyPort = defaultProxyPort;
      this._logger.info(
        `${servicePrefix}PROXY_PORT not found in environment. Using default port ${this._proxyPort}.`
      );
      this._isProxyPortDefaulted = true;
    }

    // LLM_CONFIG_PATH
    const llmConfigPathEnv = process.env.LLM_CONFIG_PATH;
    // null means LlmConfigService will use its internal default path.
    // An empty string from env var means "don't use default, use current dir for 'llm-configs.json'" if LlmConfigService handles it that way,
    // or it might also mean "use default" depending on LlmConfigService's interpretation of "" vs null.
    // For AppConfigService, we just store what's given or null if not set.
    this._llmConfigPath =
      llmConfigPathEnv !== undefined ? llmConfigPathEnv : null;
    this._logStringEnvVarStatus(
      'LLM_CONFIG_PATH',
      llmConfigPathEnv,
      this._llmConfigPath,
      'LlmConfigService will use its default path'
    );

    // PROXY_ALLOWED_ORIGIN
    const proxyAllowedOriginEnv = process.env.PROXY_ALLOWED_ORIGIN;
    this._proxyAllowedOrigin =
      proxyAllowedOriginEnv !== undefined ? proxyAllowedOriginEnv : null;
    this._logStringEnvVarStatus(
      'PROXY_ALLOWED_ORIGIN',
      proxyAllowedOriginEnv,
      this._proxyAllowedOrigin,
      'CORS will not be specifically configured by the proxy based on this variable'
    );

    // PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES
    const proxyProjectRootEnv =
      process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES;
    this._proxyProjectRootPathForApiKeyFiles =
      proxyProjectRootEnv !== undefined ? proxyProjectRootEnv : null;
    this._logStringEnvVarStatus(
      'PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES',
      proxyProjectRootEnv,
      this._proxyProjectRootPathForApiKeyFiles,
      'API key file retrieval relative to a project root will not be available unless this is set'
    );
    this._logger.info('AppConfigService: Configuration loading complete.');
  }

  /**
   * Gets the port number for the proxy server.
   * @returns {number} The proxy port.
   */
  getProxyPort() {
    return this._proxyPort;
  }

  /**
   * Checks if the PROXY_PORT was defaulted (i.e., not set or invalid in environment).
   * @returns {boolean} True if the default port is being used.
   */
  isProxyPortDefaulted() {
    return this._isProxyPortDefaulted;
  }

  /**
   * Gets the path to the LLM configuration file as specified by environment variable.
   * Returns null if the environment variable was not set.
   * An empty string means the environment variable was set to an empty string.
   * @returns {string | null} The LLM configuration path from env, or null if not set.
   */
  getLlmConfigPath() {
    return this._llmConfigPath;
  }

  /**
   * Gets the configured PROXY_ALLOWED_ORIGIN string from environment variable.
   * Returns null if the environment variable was not set.
   * An empty string means the environment variable was set to an empty string.
   * @returns {string | null} The allowed origin string from env, or null if not set.
   */
  getProxyAllowedOrigin() {
    return this._proxyAllowedOrigin;
  }

  /**
   * Gets an array of allowed origins for CORS.
   * Parses PROXY_ALLOWED_ORIGIN if set and non-empty, returns an empty array otherwise.
   * @returns {string[]} An array of allowed origins.
   */
  getAllowedOriginsArray() {
    if (this._proxyAllowedOrigin && this._proxyAllowedOrigin.trim() !== '') {
      return this._proxyAllowedOrigin.split(',').map((origin) => origin.trim());
    }
    return [];
  }

  /**
   * Gets the project root path for API key files as specified by environment variable.
   * Returns null if the environment variable was not set.
   * An empty string means the environment variable was set to an empty string.
   * @returns {string | null} The path from env, or null if not set.
   */
  getProxyProjectRootPathForApiKeyFiles() {
    return this._proxyProjectRootPathForApiKeyFiles;
  }
}

/**
 * Gets the singleton instance of the AppConfigService.
 * Initializes the service on first call.
 * @param {ILogger} logger - An ILogger instance, required for the first initialization.
 * @returns {AppConfigService} The singleton AppConfigService instance.
 * @throws {Error} if logger is not provided during the first call.
 */
export function getAppConfigService(logger) {
  if (!instance) {
    if (!logger) {
      // This case should ideally be avoided by ensuring logger is passed on first call.
      // Using console.error directly as logger is definitively not available here.
      console.error(
        'AppConfigService: Critical - Logger must be provided for the first instantiation of AppConfigService.'
      );
      throw new Error(
        'AppConfigService: Logger must be provided for the first instantiation.'
      );
    }
    instance = new AppConfigService(logger);
  }
  return instance;
}
