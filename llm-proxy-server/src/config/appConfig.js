// llm-proxy-server/src/dependencyInjection/appConfig.js
/* eslint-disable no-console */
import dotenv from 'dotenv';
import {
  CACHE_DEFAULT_TTL,
  CACHE_DEFAULT_MAX_SIZE,
  API_KEY_CACHE_TTL,
  HTTP_AGENT_KEEP_ALIVE,
  HTTP_AGENT_MAX_SOCKETS,
  HTTP_AGENT_MAX_FREE_SOCKETS,
  HTTP_AGENT_TIMEOUT,
  HTTP_AGENT_FREE_SOCKET_TIMEOUT,
  HTTP_AGENT_MAX_TOTAL_SOCKETS,
  HTTP_AGENT_MAX_IDLE_TIME,
} from './constants.js';

// Load environment variables from .env file at the very beginning
dotenv.config();

/**
 * @typedef {object} ILogger
 * @description Defines a basic logger interface.
 * @property {Function} debug - Logs a debug message.
 * @property {Function} info - Logs an informational message.
 * @property {Function} warn - Logs a warning message.
 * @property {Function} error - Logs an error message.
 */

/** @type {AppConfigService | null} */
let instance = null;

/**
 * AppConfigService provides centralized access to application-level environment variables.
 */
class AppConfigService {
  /**
   * @type {any}
   * @private
   */
  _logger = console;

  /** @type {number} @private */
  _proxyPort = 3001;
  /** @type {boolean} @private */
  _isProxyPortDefaulted = false; // Added to track if PROXY_PORT was defaulted
  /** @type {string | null} @private */
  _llmConfigPath = null;
  /** @type {string | null} @private */
  _proxyAllowedOrigin = null;
  /** @type {string | null} @private */
  _proxyProjectRootPathForApiKeyFiles = null;
  /** @type {string} @private */
  _nodeEnv = 'development';

  // Cache configuration
  /** @type {boolean} @private */
  _cacheEnabled = true;
  /** @type {number} @private */
  _cacheDefaultTtl = 300000;
  /** @type {number} @private */
  _cacheMaxSize = 1000;
  /** @type {number} @private */
  _apiKeyCacheTtl = 300000;

  // HTTP Agent configuration
  /** @type {boolean} @private */
  _httpAgentEnabled = true;
  /** @type {boolean} @private */
  _httpAgentKeepAlive = true;
  /** @type {number} @private */
  _httpAgentMaxSockets = 50;
  /** @type {number} @private */
  _httpAgentMaxFreeSockets = 10;
  /** @type {number} @private */
  _httpAgentTimeout = 60000;
  /** @type {number} @private */
  _httpAgentFreeSocketTimeout = 4000;
  /** @type {number} @private */
  _httpAgentMaxTotalSockets = 0;
  /** @type {number} @private */
  _httpAgentMaxIdleTime = 60000;

  /**
   * Initializes the AppConfigService. It's recommended to use the getAppConfigService
   * factory function to ensure a singleton instance.
   * @param {ILogger} logger - An ILogger instance.
   */
  constructor(logger) {
    /** @type {any} */
    this._logger = logger;

    this._logger.debug(
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
        this._logger.debug(
          `${servicePrefix}${envVarName} found in environment but is empty. Current effective value: '${finalValue === null ? 'null' : finalValue}'.`
        );
      } else {
        this._logger.debug(
          `${servicePrefix}${envVarName} found in environment: '${envVarValue}'. Effective value: '${finalValue}'.`
        );
      }
    } else {
      this._logger.debug(
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
        this._logger.debug(
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
      this._logger.debug(
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

    // NODE_ENV
    const nodeEnvValue = process.env.NODE_ENV;
    this._nodeEnv = nodeEnvValue || 'development';
    this._logger.debug(
      `AppConfigService: NODE_ENV found in environment: '${nodeEnvValue || 'undefined'}'. Effective value: '${this._nodeEnv}'.`
    );

    // Cache Configuration
    this._logger.debug(`${servicePrefix}Loading cache configuration...`);

    // CACHE_ENABLED (default: true)
    const cacheEnabledEnv = process.env.CACHE_ENABLED;
    this._cacheEnabled =
      cacheEnabledEnv !== undefined
        ? cacheEnabledEnv.toLowerCase() === 'true'
        : true;
    this._logger.debug(
      `${servicePrefix}CACHE_ENABLED: '${cacheEnabledEnv || 'undefined'}'. Effective value: ${this._cacheEnabled}.`
    );

    // CACHE_DEFAULT_TTL
    const cacheDefaultTtlEnv = process.env.CACHE_DEFAULT_TTL;
    this._cacheDefaultTtl = cacheDefaultTtlEnv
      ? parseInt(cacheDefaultTtlEnv, 10)
      : CACHE_DEFAULT_TTL;
    if (isNaN(this._cacheDefaultTtl)) {
      this._cacheDefaultTtl = CACHE_DEFAULT_TTL;
      this._logger.warn(
        `${servicePrefix}CACHE_DEFAULT_TTL invalid: '${cacheDefaultTtlEnv}'. Using default: ${this._cacheDefaultTtl}ms.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}CACHE_DEFAULT_TTL: '${cacheDefaultTtlEnv || 'undefined'}'. Effective value: ${this._cacheDefaultTtl}ms.`
      );
    }

    // CACHE_MAX_SIZE
    const cacheMaxSizeEnv = process.env.CACHE_MAX_SIZE;
    this._cacheMaxSize = cacheMaxSizeEnv
      ? parseInt(cacheMaxSizeEnv, 10)
      : CACHE_DEFAULT_MAX_SIZE;
    if (isNaN(this._cacheMaxSize) || this._cacheMaxSize <= 0) {
      this._cacheMaxSize = CACHE_DEFAULT_MAX_SIZE;
      this._logger.warn(
        `${servicePrefix}CACHE_MAX_SIZE invalid: '${cacheMaxSizeEnv}'. Using default: ${this._cacheMaxSize}.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}CACHE_MAX_SIZE: '${cacheMaxSizeEnv || 'undefined'}'. Effective value: ${this._cacheMaxSize}.`
      );
    }

    // API_KEY_CACHE_TTL
    const apiKeyCacheTtlEnv = process.env.API_KEY_CACHE_TTL;
    this._apiKeyCacheTtl = apiKeyCacheTtlEnv
      ? parseInt(apiKeyCacheTtlEnv, 10)
      : API_KEY_CACHE_TTL;
    if (isNaN(this._apiKeyCacheTtl)) {
      this._apiKeyCacheTtl = API_KEY_CACHE_TTL;
      this._logger.warn(
        `${servicePrefix}API_KEY_CACHE_TTL invalid: '${apiKeyCacheTtlEnv}'. Using default: ${this._apiKeyCacheTtl}ms.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}API_KEY_CACHE_TTL: '${apiKeyCacheTtlEnv || 'undefined'}'. Effective value: ${this._apiKeyCacheTtl}ms.`
      );
    }

    // HTTP Agent Configuration
    this._logger.debug(`${servicePrefix}Loading HTTP agent configuration...`);

    // HTTP_AGENT_ENABLED (default: true)
    const httpAgentEnabledEnv = process.env.HTTP_AGENT_ENABLED;
    this._httpAgentEnabled =
      httpAgentEnabledEnv !== undefined
        ? httpAgentEnabledEnv.toLowerCase() === 'true'
        : true;
    this._logger.debug(
      `${servicePrefix}HTTP_AGENT_ENABLED: '${httpAgentEnabledEnv || 'undefined'}'. Effective value: ${this._httpAgentEnabled}.`
    );

    // HTTP_AGENT_KEEP_ALIVE
    const httpAgentKeepAliveEnv = process.env.HTTP_AGENT_KEEP_ALIVE;
    this._httpAgentKeepAlive =
      httpAgentKeepAliveEnv !== undefined
        ? httpAgentKeepAliveEnv.toLowerCase() === 'true'
        : HTTP_AGENT_KEEP_ALIVE;
    this._logger.debug(
      `${servicePrefix}HTTP_AGENT_KEEP_ALIVE: '${httpAgentKeepAliveEnv || 'undefined'}'. Effective value: ${this._httpAgentKeepAlive}.`
    );

    // HTTP_AGENT_MAX_SOCKETS
    const httpAgentMaxSocketsEnv = process.env.HTTP_AGENT_MAX_SOCKETS;
    this._httpAgentMaxSockets = httpAgentMaxSocketsEnv
      ? parseInt(httpAgentMaxSocketsEnv, 10)
      : HTTP_AGENT_MAX_SOCKETS;
    if (isNaN(this._httpAgentMaxSockets) || this._httpAgentMaxSockets <= 0) {
      this._httpAgentMaxSockets = HTTP_AGENT_MAX_SOCKETS;
      this._logger.warn(
        `${servicePrefix}HTTP_AGENT_MAX_SOCKETS invalid: '${httpAgentMaxSocketsEnv}'. Using default: ${this._httpAgentMaxSockets}.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_MAX_SOCKETS: '${httpAgentMaxSocketsEnv || 'undefined'}'. Effective value: ${this._httpAgentMaxSockets}.`
      );
    }

    // HTTP_AGENT_MAX_FREE_SOCKETS
    const httpAgentMaxFreeSocketsEnv = process.env.HTTP_AGENT_MAX_FREE_SOCKETS;
    this._httpAgentMaxFreeSockets = httpAgentMaxFreeSocketsEnv
      ? parseInt(httpAgentMaxFreeSocketsEnv, 10)
      : HTTP_AGENT_MAX_FREE_SOCKETS;
    if (
      isNaN(this._httpAgentMaxFreeSockets) ||
      this._httpAgentMaxFreeSockets < 0
    ) {
      this._httpAgentMaxFreeSockets = HTTP_AGENT_MAX_FREE_SOCKETS;
      this._logger.warn(
        `${servicePrefix}HTTP_AGENT_MAX_FREE_SOCKETS invalid: '${httpAgentMaxFreeSocketsEnv}'. Using default: ${this._httpAgentMaxFreeSockets}.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_MAX_FREE_SOCKETS: '${httpAgentMaxFreeSocketsEnv || 'undefined'}'. Effective value: ${this._httpAgentMaxFreeSockets}.`
      );
    }

    // HTTP_AGENT_TIMEOUT
    const httpAgentTimeoutEnv = process.env.HTTP_AGENT_TIMEOUT;
    this._httpAgentTimeout = httpAgentTimeoutEnv
      ? parseInt(httpAgentTimeoutEnv, 10)
      : HTTP_AGENT_TIMEOUT;
    if (isNaN(this._httpAgentTimeout) || this._httpAgentTimeout <= 0) {
      this._httpAgentTimeout = HTTP_AGENT_TIMEOUT;
      this._logger.warn(
        `${servicePrefix}HTTP_AGENT_TIMEOUT invalid: '${httpAgentTimeoutEnv}'. Using default: ${this._httpAgentTimeout}ms.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_TIMEOUT: '${httpAgentTimeoutEnv || 'undefined'}'. Effective value: ${this._httpAgentTimeout}ms.`
      );
    }

    // HTTP_AGENT_FREE_SOCKET_TIMEOUT
    const httpAgentFreeSocketTimeoutEnv =
      process.env.HTTP_AGENT_FREE_SOCKET_TIMEOUT;
    this._httpAgentFreeSocketTimeout = httpAgentFreeSocketTimeoutEnv
      ? parseInt(httpAgentFreeSocketTimeoutEnv, 10)
      : HTTP_AGENT_FREE_SOCKET_TIMEOUT;
    if (
      isNaN(this._httpAgentFreeSocketTimeout) ||
      this._httpAgentFreeSocketTimeout <= 0
    ) {
      this._httpAgentFreeSocketTimeout = HTTP_AGENT_FREE_SOCKET_TIMEOUT;
      this._logger.warn(
        `${servicePrefix}HTTP_AGENT_FREE_SOCKET_TIMEOUT invalid: '${httpAgentFreeSocketTimeoutEnv}'. Using default: ${this._httpAgentFreeSocketTimeout}ms.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_FREE_SOCKET_TIMEOUT: '${httpAgentFreeSocketTimeoutEnv || 'undefined'}'. Effective value: ${this._httpAgentFreeSocketTimeout}ms.`
      );
    }

    // HTTP_AGENT_MAX_TOTAL_SOCKETS
    const httpAgentMaxTotalSocketsEnv =
      process.env.HTTP_AGENT_MAX_TOTAL_SOCKETS;
    this._httpAgentMaxTotalSockets = httpAgentMaxTotalSocketsEnv
      ? parseInt(httpAgentMaxTotalSocketsEnv, 10)
      : HTTP_AGENT_MAX_TOTAL_SOCKETS;
    if (
      isNaN(this._httpAgentMaxTotalSockets) ||
      this._httpAgentMaxTotalSockets <= 0
    ) {
      this._httpAgentMaxTotalSockets = HTTP_AGENT_MAX_TOTAL_SOCKETS;
      this._logger.warn(
        `${servicePrefix}HTTP_AGENT_MAX_TOTAL_SOCKETS invalid: '${httpAgentMaxTotalSocketsEnv}'. Using default: ${this._httpAgentMaxTotalSockets}.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_MAX_TOTAL_SOCKETS: '${httpAgentMaxTotalSocketsEnv || 'undefined'}'. Effective value: ${this._httpAgentMaxTotalSockets}.`
      );
    }

    // HTTP_AGENT_MAX_IDLE_TIME
    const httpAgentMaxIdleTimeEnv = process.env.HTTP_AGENT_MAX_IDLE_TIME;
    this._httpAgentMaxIdleTime = httpAgentMaxIdleTimeEnv
      ? parseInt(httpAgentMaxIdleTimeEnv, 10)
      : HTTP_AGENT_MAX_IDLE_TIME;
    if (isNaN(this._httpAgentMaxIdleTime) || this._httpAgentMaxIdleTime <= 0) {
      this._httpAgentMaxIdleTime = HTTP_AGENT_MAX_IDLE_TIME;
      this._logger.warn(
        `${servicePrefix}HTTP_AGENT_MAX_IDLE_TIME invalid: '${httpAgentMaxIdleTimeEnv}'. Using default: ${this._httpAgentMaxIdleTime}ms.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_MAX_IDLE_TIME: '${httpAgentMaxIdleTimeEnv || 'undefined'}'. Effective value: ${this._httpAgentMaxIdleTime}ms.`
      );
    }

    this._logger.debug('AppConfigService: Configuration loading complete.');
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

  /**
   * Gets the current NODE_ENV value.
   * @returns {string} The NODE_ENV value, defaults to 'development' if not set.
   */
  getNodeEnv() {
    return this._nodeEnv;
  }

  /**
   * Checks if the application is running in production environment.
   * @returns {boolean} True if NODE_ENV is 'production', false otherwise.
   */
  isProduction() {
    return this._nodeEnv === 'production';
  }

  /**
   * Checks if the application is running in development environment.
   * @returns {boolean} True if NODE_ENV is 'development' or not set, false otherwise.
   */
  isDevelopment() {
    return this._nodeEnv === 'development';
  }

  // Cache Configuration Getters

  /**
   * Gets whether caching is enabled.
   * @returns {boolean} True if caching is enabled, false otherwise.
   */
  isCacheEnabled() {
    return this._cacheEnabled;
  }

  /**
   * Gets the default cache TTL in milliseconds.
   * @returns {number} The default cache TTL.
   */
  getCacheDefaultTtl() {
    return this._cacheDefaultTtl;
  }

  /**
   * Gets the maximum cache size.
   * @returns {number} The maximum number of entries in cache.
   */
  getCacheMaxSize() {
    return this._cacheMaxSize;
  }

  /**
   * Gets the API key cache TTL in milliseconds.
   * @returns {number} The API key cache TTL.
   */
  getApiKeyCacheTtl() {
    return this._apiKeyCacheTtl;
  }

  /**
   * Gets the cache configuration object.
   * @returns {object} Cache configuration object.
   */
  getCacheConfig() {
    return {
      enabled: this._cacheEnabled,
      defaultTtl: this._cacheDefaultTtl,
      maxSize: this._cacheMaxSize,
      apiKeyCacheTtl: this._apiKeyCacheTtl,
    };
  }

  // HTTP Agent Configuration Getters

  /**
   * Gets whether HTTP agent pooling is enabled.
   * @returns {boolean} True if HTTP agent pooling is enabled, false otherwise.
   */
  isHttpAgentEnabled() {
    return this._httpAgentEnabled;
  }

  /**
   * Gets whether HTTP agent keep-alive is enabled.
   * @returns {boolean} True if keep-alive is enabled, false otherwise.
   */
  getHttpAgentKeepAlive() {
    return this._httpAgentKeepAlive;
  }

  /**
   * Gets the maximum number of sockets per host.
   * @returns {number} The maximum number of sockets.
   */
  getHttpAgentMaxSockets() {
    return this._httpAgentMaxSockets;
  }

  /**
   * Gets the maximum number of free sockets per host.
   * @returns {number} The maximum number of free sockets.
   */
  getHttpAgentMaxFreeSockets() {
    return this._httpAgentMaxFreeSockets;
  }

  /**
   * Gets the HTTP agent socket timeout in milliseconds.
   * @returns {number} The socket timeout.
   */
  getHttpAgentTimeout() {
    return this._httpAgentTimeout;
  }

  /**
   * Gets the HTTP agent free socket timeout in milliseconds.
   * @returns {number} The free socket timeout.
   */
  getHttpAgentFreeSocketTimeout() {
    return this._httpAgentFreeSocketTimeout;
  }

  /**
   * Gets the maximum total sockets across all hosts.
   * @returns {number} The maximum total sockets.
   */
  getHttpAgentMaxTotalSockets() {
    return this._httpAgentMaxTotalSockets;
  }

  /**
   * Gets the maximum idle time for agents in milliseconds.
   * @returns {number} The maximum idle time.
   */
  getHttpAgentMaxIdleTime() {
    return this._httpAgentMaxIdleTime;
  }

  /**
   * Gets the HTTP agent configuration object.
   * @returns {object} HTTP agent configuration object.
   */
  getHttpAgentConfig() {
    return {
      enabled: this._httpAgentEnabled,
      keepAlive: this._httpAgentKeepAlive,
      maxSockets: this._httpAgentMaxSockets,
      maxFreeSockets: this._httpAgentMaxFreeSockets,
      timeout: this._httpAgentTimeout,
      freeSocketTimeout: this._httpAgentFreeSocketTimeout,
      maxTotalSockets: this._httpAgentMaxTotalSockets,
      maxIdleTime: this._httpAgentMaxIdleTime,
    };
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

/**
 * Resets the singleton instance. This is primarily for testing purposes.
 * @returns {void}
 */
export function resetAppConfigServiceInstance() {
  instance = null;
}
