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
  SALVAGE_DEFAULT_TTL,
  SALVAGE_MAX_ENTRIES,
  DEBUG_LOGGING_ENABLED,
  DEBUG_LOGGING_DEFAULT_PATH,
  DEBUG_LOGGING_DEFAULT_RETENTION_DAYS,
  DEBUG_LOGGING_DEFAULT_MAX_FILE_SIZE,
  DEBUG_LOGGING_DEFAULT_WRITE_BUFFER_SIZE,
  DEBUG_LOGGING_DEFAULT_FLUSH_INTERVAL,
  DEBUG_LOGGING_DEFAULT_MAX_CONCURRENT_WRITES,
  DEBUG_LOGGING_DEFAULT_CLEANUP_SCHEDULE,
  DEBUG_LOGGING_DEFAULT_CLEANUP_ENABLED,
  DEBUG_LOGGING_DEFAULT_COMPRESSION,
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
  _httpAgentTimeout = 120000;
  /** @type {number} @private */
  _httpAgentFreeSocketTimeout = 4000;
  /** @type {number} @private */
  _httpAgentMaxTotalSockets = 0;
  /** @type {number} @private */
  _httpAgentMaxIdleTime = 60000;

  // Salvage configuration
  /** @type {number} @private */
  _salvageDefaultTtl = SALVAGE_DEFAULT_TTL;
  /** @type {number} @private */
  _salvageMaxEntries = SALVAGE_MAX_ENTRIES;

  // Debug Logging configuration
  /** @type {boolean} @private */
  _debugLoggingEnabled = true;
  /** @type {string} @private */
  _debugLoggingPath = './logs';
  /** @type {number} @private */
  _debugLoggingRetentionDays = 7;
  /** @type {string} @private */
  _debugLoggingMaxFileSize = '10MB';
  /** @type {number} @private */
  _debugLoggingWriteBufferSize = 100;
  /** @type {number} @private */
  _debugLoggingFlushInterval = 1000;
  /** @type {number} @private */
  _debugLoggingMaxConcurrentWrites = 5;
  /** @type {string} @private */
  _debugLoggingCleanupSchedule = '0 2 * * *';
  /** @type {boolean} @private */
  _debugLoggingCleanupEnabled = true;
  /** @type {boolean} @private */
  _debugLoggingCompression = false;

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
    const normalizedNodeEnv =
      typeof nodeEnvValue === 'string' && nodeEnvValue.trim() !== ''
        ? nodeEnvValue.trim().toLowerCase()
        : 'development';
    this._nodeEnv = normalizedNodeEnv;
    if (nodeEnvValue !== undefined) {
      this._logger.debug(
        `AppConfigService: NODE_ENV found in environment: '${nodeEnvValue}'. Effective value: '${this._nodeEnv}'.`
      );
    } else {
      this._logger.debug(
        `AppConfigService: NODE_ENV not set in environment. Using default: '${this._nodeEnv}'.`
      );
    }

    // Cache Configuration
    this._logger.debug(`${servicePrefix}Loading cache configuration...`);

    // CACHE_ENABLED (default: true)
    const cacheEnabledEnv = process.env.CACHE_ENABLED;
    this._cacheEnabled =
      cacheEnabledEnv !== undefined
        ? cacheEnabledEnv.toLowerCase() === 'true'
        : true;
    if (cacheEnabledEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}CACHE_ENABLED found in environment: '${cacheEnabledEnv}'. Effective value: ${this._cacheEnabled}.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}CACHE_ENABLED not set in environment. Using default: ${this._cacheEnabled}.`
      );
    }

    // CACHE_DEFAULT_TTL
    const cacheDefaultTtlEnv = process.env.CACHE_DEFAULT_TTL;
    this._cacheDefaultTtl = cacheDefaultTtlEnv
      ? parseInt(cacheDefaultTtlEnv, 10)
      : CACHE_DEFAULT_TTL;
    if (cacheDefaultTtlEnv !== undefined && isNaN(this._cacheDefaultTtl)) {
      this._cacheDefaultTtl = CACHE_DEFAULT_TTL;
      this._logger.warn(
        `${servicePrefix}CACHE_DEFAULT_TTL invalid: '${cacheDefaultTtlEnv}'. Using default: ${this._cacheDefaultTtl}ms.`
      );
    } else if (cacheDefaultTtlEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}CACHE_DEFAULT_TTL found in environment: '${cacheDefaultTtlEnv}'. Effective value: ${this._cacheDefaultTtl}ms.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}CACHE_DEFAULT_TTL not set in environment. Using default: ${this._cacheDefaultTtl}ms.`
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
    } else if (cacheMaxSizeEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}CACHE_MAX_SIZE found in environment: '${cacheMaxSizeEnv}'. Effective value: ${this._cacheMaxSize}.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}CACHE_MAX_SIZE not set in environment. Using default: ${this._cacheMaxSize}.`
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
    } else if (apiKeyCacheTtlEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}API_KEY_CACHE_TTL found in environment: '${apiKeyCacheTtlEnv}'. Effective value: ${this._apiKeyCacheTtl}ms.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}API_KEY_CACHE_TTL not set in environment. Using default: ${this._apiKeyCacheTtl}ms.`
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
    if (httpAgentEnabledEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_ENABLED found in environment: '${httpAgentEnabledEnv}'. Effective value: ${this._httpAgentEnabled}.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_ENABLED not set in environment. Using default: ${this._httpAgentEnabled}.`
      );
    }

    // HTTP_AGENT_KEEP_ALIVE
    const httpAgentKeepAliveEnv = process.env.HTTP_AGENT_KEEP_ALIVE;
    this._httpAgentKeepAlive =
      httpAgentKeepAliveEnv !== undefined
        ? httpAgentKeepAliveEnv.toLowerCase() === 'true'
        : HTTP_AGENT_KEEP_ALIVE;
    if (httpAgentKeepAliveEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_KEEP_ALIVE found in environment: '${httpAgentKeepAliveEnv}'. Effective value: ${this._httpAgentKeepAlive}.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_KEEP_ALIVE not set in environment. Using default: ${this._httpAgentKeepAlive}.`
      );
    }

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
    } else if (httpAgentMaxSocketsEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_MAX_SOCKETS found in environment: '${httpAgentMaxSocketsEnv}'. Effective value: ${this._httpAgentMaxSockets}.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_MAX_SOCKETS not set in environment. Using default: ${this._httpAgentMaxSockets}.`
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
    } else if (httpAgentMaxFreeSocketsEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_MAX_FREE_SOCKETS found in environment: '${httpAgentMaxFreeSocketsEnv}'. Effective value: ${this._httpAgentMaxFreeSockets}.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_MAX_FREE_SOCKETS not set in environment. Using default: ${this._httpAgentMaxFreeSockets}.`
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
    } else if (httpAgentTimeoutEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_TIMEOUT found in environment: '${httpAgentTimeoutEnv}'. Effective value: ${this._httpAgentTimeout}ms.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_TIMEOUT not set in environment. Using default: ${this._httpAgentTimeout}ms.`
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
    } else if (httpAgentFreeSocketTimeoutEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_FREE_SOCKET_TIMEOUT found in environment: '${httpAgentFreeSocketTimeoutEnv}'. Effective value: ${this._httpAgentFreeSocketTimeout}ms.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_FREE_SOCKET_TIMEOUT not set in environment. Using default: ${this._httpAgentFreeSocketTimeout}ms.`
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
    } else if (httpAgentMaxTotalSocketsEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_MAX_TOTAL_SOCKETS found in environment: '${httpAgentMaxTotalSocketsEnv}'. Effective value: ${this._httpAgentMaxTotalSockets}.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_MAX_TOTAL_SOCKETS not set in environment. Using default: ${this._httpAgentMaxTotalSockets}.`
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
    } else if (httpAgentMaxIdleTimeEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_MAX_IDLE_TIME found in environment: '${httpAgentMaxIdleTimeEnv}'. Effective value: ${this._httpAgentMaxIdleTime}ms.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}HTTP_AGENT_MAX_IDLE_TIME not set in environment. Using default: ${this._httpAgentMaxIdleTime}ms.`
      );
    }

    // Salvage Configuration
    const salvageTtlEnv = process.env.SALVAGE_DEFAULT_TTL;
    const parsedSalvageTtl = salvageTtlEnv ? parseInt(salvageTtlEnv, 10) : NaN;
    if (salvageTtlEnv !== undefined) {
      if (!isNaN(parsedSalvageTtl) && parsedSalvageTtl > 0) {
        this._salvageDefaultTtl = parsedSalvageTtl;
        this._logger.debug(
          `${servicePrefix}SALVAGE_DEFAULT_TTL found in environment: '${salvageTtlEnv}'. Effective value: ${this._salvageDefaultTtl}ms.`
        );
      } else {
        this._salvageDefaultTtl = SALVAGE_DEFAULT_TTL;
        this._logger.warn(
          `${servicePrefix}SALVAGE_DEFAULT_TTL invalid: '${salvageTtlEnv}'. Using default: ${this._salvageDefaultTtl}ms.`
        );
      }
    } else {
      this._logger.debug(
        `${servicePrefix}SALVAGE_DEFAULT_TTL not set in environment. Using default: ${this._salvageDefaultTtl}ms.`
      );
    }

    const salvageMaxEntriesEnv = process.env.SALVAGE_MAX_ENTRIES;
    const parsedSalvageMaxEntries = salvageMaxEntriesEnv
      ? parseInt(salvageMaxEntriesEnv, 10)
      : NaN;
    if (salvageMaxEntriesEnv !== undefined) {
      if (!isNaN(parsedSalvageMaxEntries) && parsedSalvageMaxEntries > 0) {
        this._salvageMaxEntries = parsedSalvageMaxEntries;
        this._logger.debug(
          `${servicePrefix}SALVAGE_MAX_ENTRIES found in environment: '${salvageMaxEntriesEnv}'. Effective value: ${this._salvageMaxEntries}.`
        );
      } else {
        this._salvageMaxEntries = SALVAGE_MAX_ENTRIES;
        this._logger.warn(
          `${servicePrefix}SALVAGE_MAX_ENTRIES invalid: '${salvageMaxEntriesEnv}'. Using default: ${this._salvageMaxEntries}.`
        );
      }
    } else {
      this._logger.debug(
        `${servicePrefix}SALVAGE_MAX_ENTRIES not set in environment. Using default: ${this._salvageMaxEntries}.`
      );
    }

    // Debug Logging Configuration
    this._logger.debug(
      `${servicePrefix}Loading debug logging configuration...`
    );

    // DEBUG_LOGGING_ENABLED (default: true)
    const debugLoggingEnabledEnv = process.env.DEBUG_LOGGING_ENABLED;
    this._debugLoggingEnabled =
      debugLoggingEnabledEnv !== undefined
        ? debugLoggingEnabledEnv.toLowerCase() === 'true'
        : DEBUG_LOGGING_ENABLED;
    if (debugLoggingEnabledEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_ENABLED found in environment: '${debugLoggingEnabledEnv}'. Effective value: ${this._debugLoggingEnabled}.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_ENABLED not set in environment. Using default: ${this._debugLoggingEnabled}.`
      );
    }

    // DEBUG_LOGGING_PATH
    const debugLoggingPathEnv = process.env.DEBUG_LOGGING_PATH;
    this._debugLoggingPath = debugLoggingPathEnv || DEBUG_LOGGING_DEFAULT_PATH;
    if (debugLoggingPathEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_PATH found in environment: '${debugLoggingPathEnv}'. Effective value: '${this._debugLoggingPath}'.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_PATH not set in environment. Using default: '${this._debugLoggingPath}'.`
      );
    }

    // DEBUG_LOGGING_RETENTION_DAYS
    const debugLoggingRetentionDaysEnv =
      process.env.DEBUG_LOGGING_RETENTION_DAYS;
    this._debugLoggingRetentionDays = debugLoggingRetentionDaysEnv
      ? parseInt(debugLoggingRetentionDaysEnv, 10)
      : DEBUG_LOGGING_DEFAULT_RETENTION_DAYS;
    if (
      isNaN(this._debugLoggingRetentionDays) ||
      this._debugLoggingRetentionDays < 1 ||
      this._debugLoggingRetentionDays > 365
    ) {
      this._debugLoggingRetentionDays = DEBUG_LOGGING_DEFAULT_RETENTION_DAYS;
      this._logger.warn(
        `${servicePrefix}DEBUG_LOGGING_RETENTION_DAYS invalid: '${debugLoggingRetentionDaysEnv}'. Using default: ${this._debugLoggingRetentionDays} days.`
      );
    } else if (debugLoggingRetentionDaysEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_RETENTION_DAYS found in environment: '${debugLoggingRetentionDaysEnv}'. Effective value: ${this._debugLoggingRetentionDays} days.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_RETENTION_DAYS not set in environment. Using default: ${this._debugLoggingRetentionDays} days.`
      );
    }

    // DEBUG_LOGGING_MAX_FILE_SIZE
    const debugLoggingMaxFileSizeEnv = process.env.DEBUG_LOGGING_MAX_FILE_SIZE;
    this._debugLoggingMaxFileSize =
      debugLoggingMaxFileSizeEnv || DEBUG_LOGGING_DEFAULT_MAX_FILE_SIZE;
    if (debugLoggingMaxFileSizeEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_MAX_FILE_SIZE found in environment: '${debugLoggingMaxFileSizeEnv}'. Effective value: '${this._debugLoggingMaxFileSize}'.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_MAX_FILE_SIZE not set in environment. Using default: '${this._debugLoggingMaxFileSize}'.`
      );
    }

    // DEBUG_LOGGING_WRITE_BUFFER_SIZE
    const debugLoggingWriteBufferSizeEnv =
      process.env.DEBUG_LOGGING_WRITE_BUFFER_SIZE;
    this._debugLoggingWriteBufferSize = debugLoggingWriteBufferSizeEnv
      ? parseInt(debugLoggingWriteBufferSizeEnv, 10)
      : DEBUG_LOGGING_DEFAULT_WRITE_BUFFER_SIZE;
    if (
      isNaN(this._debugLoggingWriteBufferSize) ||
      this._debugLoggingWriteBufferSize < 1
    ) {
      this._debugLoggingWriteBufferSize =
        DEBUG_LOGGING_DEFAULT_WRITE_BUFFER_SIZE;
      this._logger.warn(
        `${servicePrefix}DEBUG_LOGGING_WRITE_BUFFER_SIZE invalid: '${debugLoggingWriteBufferSizeEnv}'. Using default: ${this._debugLoggingWriteBufferSize}.`
      );
    } else if (debugLoggingWriteBufferSizeEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_WRITE_BUFFER_SIZE found in environment: '${debugLoggingWriteBufferSizeEnv}'. Effective value: ${this._debugLoggingWriteBufferSize}.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_WRITE_BUFFER_SIZE not set in environment. Using default: ${this._debugLoggingWriteBufferSize}.`
      );
    }

    // DEBUG_LOGGING_FLUSH_INTERVAL
    const debugLoggingFlushIntervalEnv =
      process.env.DEBUG_LOGGING_FLUSH_INTERVAL;
    this._debugLoggingFlushInterval = debugLoggingFlushIntervalEnv
      ? parseInt(debugLoggingFlushIntervalEnv, 10)
      : DEBUG_LOGGING_DEFAULT_FLUSH_INTERVAL;
    if (
      isNaN(this._debugLoggingFlushInterval) ||
      this._debugLoggingFlushInterval < 100
    ) {
      this._debugLoggingFlushInterval = DEBUG_LOGGING_DEFAULT_FLUSH_INTERVAL;
      this._logger.warn(
        `${servicePrefix}DEBUG_LOGGING_FLUSH_INTERVAL invalid: '${debugLoggingFlushIntervalEnv}'. Using default: ${this._debugLoggingFlushInterval}ms.`
      );
    } else if (debugLoggingFlushIntervalEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_FLUSH_INTERVAL found in environment: '${debugLoggingFlushIntervalEnv}'. Effective value: ${this._debugLoggingFlushInterval}ms.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_FLUSH_INTERVAL not set in environment. Using default: ${this._debugLoggingFlushInterval}ms.`
      );
    }

    // DEBUG_LOGGING_MAX_CONCURRENT_WRITES
    const debugLoggingMaxConcurrentWritesEnv =
      process.env.DEBUG_LOGGING_MAX_CONCURRENT_WRITES;
    this._debugLoggingMaxConcurrentWrites = debugLoggingMaxConcurrentWritesEnv
      ? parseInt(debugLoggingMaxConcurrentWritesEnv, 10)
      : DEBUG_LOGGING_DEFAULT_MAX_CONCURRENT_WRITES;
    if (
      isNaN(this._debugLoggingMaxConcurrentWrites) ||
      this._debugLoggingMaxConcurrentWrites < 1
    ) {
      this._debugLoggingMaxConcurrentWrites =
        DEBUG_LOGGING_DEFAULT_MAX_CONCURRENT_WRITES;
      this._logger.warn(
        `${servicePrefix}DEBUG_LOGGING_MAX_CONCURRENT_WRITES invalid: '${debugLoggingMaxConcurrentWritesEnv}'. Using default: ${this._debugLoggingMaxConcurrentWrites}.`
      );
    } else if (debugLoggingMaxConcurrentWritesEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_MAX_CONCURRENT_WRITES found in environment: '${debugLoggingMaxConcurrentWritesEnv}'. Effective value: ${this._debugLoggingMaxConcurrentWrites}.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_MAX_CONCURRENT_WRITES not set in environment. Using default: ${this._debugLoggingMaxConcurrentWrites}.`
      );
    }

    // DEBUG_LOGGING_CLEANUP_SCHEDULE
    const debugLoggingCleanupScheduleEnv =
      process.env.DEBUG_LOGGING_CLEANUP_SCHEDULE;
    this._debugLoggingCleanupSchedule =
      debugLoggingCleanupScheduleEnv || DEBUG_LOGGING_DEFAULT_CLEANUP_SCHEDULE;
    if (debugLoggingCleanupScheduleEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_CLEANUP_SCHEDULE found in environment: '${debugLoggingCleanupScheduleEnv}'. Effective value: '${this._debugLoggingCleanupSchedule}'.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_CLEANUP_SCHEDULE not set in environment. Using default: '${this._debugLoggingCleanupSchedule}'.`
      );
    }

    // DEBUG_LOGGING_CLEANUP_ENABLED
    const debugLoggingCleanupEnabledEnv =
      process.env.DEBUG_LOGGING_CLEANUP_ENABLED;
    this._debugLoggingCleanupEnabled =
      debugLoggingCleanupEnabledEnv !== undefined
        ? debugLoggingCleanupEnabledEnv.toLowerCase() === 'true'
        : DEBUG_LOGGING_DEFAULT_CLEANUP_ENABLED;
    if (debugLoggingCleanupEnabledEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_CLEANUP_ENABLED found in environment: '${debugLoggingCleanupEnabledEnv}'. Effective value: ${this._debugLoggingCleanupEnabled}.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_CLEANUP_ENABLED not set in environment. Using default: ${this._debugLoggingCleanupEnabled}.`
      );
    }

    // DEBUG_LOGGING_COMPRESSION
    const debugLoggingCompressionEnv = process.env.DEBUG_LOGGING_COMPRESSION;
    this._debugLoggingCompression =
      debugLoggingCompressionEnv !== undefined
        ? debugLoggingCompressionEnv.toLowerCase() === 'true'
        : DEBUG_LOGGING_DEFAULT_COMPRESSION;
    if (debugLoggingCompressionEnv !== undefined) {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_COMPRESSION found in environment: '${debugLoggingCompressionEnv}'. Effective value: ${this._debugLoggingCompression}.`
      );
    } else {
      this._logger.debug(
        `${servicePrefix}DEBUG_LOGGING_COMPRESSION not set in environment. Using default: ${this._debugLoggingCompression}.`
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
   * Parses PROXY_ALLOWED_ORIGIN if set and non-empty.
   * In development mode, provides default origins if none are configured.
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

  // Salvage Configuration Getters

  /**
   * Gets the default salvage TTL in milliseconds.
   * @returns {number} The salvage TTL.
   */
  getSalvageDefaultTtl() {
    return this._salvageDefaultTtl;
  }

  /**
   * Gets the maximum number of salvaged entries to retain.
   * @returns {number} The maximum number of entries.
   */
  getSalvageMaxEntries() {
    return this._salvageMaxEntries;
  }

  /**
   * Gets the salvage configuration object.
   * @returns {{defaultTtl: number, maxEntries: number}} Salvage configuration object.
   */
  getSalvageConfig() {
    return {
      defaultTtl: this._salvageDefaultTtl,
      maxEntries: this._salvageMaxEntries,
    };
  }

  // Debug Logging Configuration Getters

  /**
   * Gets whether debug logging is enabled.
   * @deprecated Debug logging has been removed from the system
   * @returns {boolean} Always returns false
   */
  isDebugLoggingEnabled() {
    return false;
  }

  /**
   * Gets the debug logging path.
   * @deprecated Debug logging has been removed from the system
   * @returns {string} Returns empty string
   */
  getDebugLoggingPath() {
    return '';
  }

  /**
   * Gets the debug logging retention days.
   * @deprecated Debug logging has been removed from the system
   * @returns {number} Returns 0
   */
  getDebugLoggingRetentionDays() {
    return 0;
  }

  /**
   * Gets the debug logging maximum file size.
   * @returns {string} The maximum file size string (e.g., '10MB').
   */
  getDebugLoggingMaxFileSize() {
    return this._debugLoggingMaxFileSize;
  }

  /**
   * Gets the debug logging write buffer size.
   * @returns {number} The write buffer size.
   */
  getDebugLoggingWriteBufferSize() {
    return this._debugLoggingWriteBufferSize;
  }

  /**
   * Gets the debug logging flush interval.
   * @returns {number} The flush interval in milliseconds.
   */
  getDebugLoggingFlushInterval() {
    return this._debugLoggingFlushInterval;
  }

  /**
   * Gets the debug logging maximum concurrent writes.
   * @returns {number} The maximum concurrent writes.
   */
  getDebugLoggingMaxConcurrentWrites() {
    return this._debugLoggingMaxConcurrentWrites;
  }

  /**
   * Gets the debug logging cleanup schedule.
   * @returns {string} The cleanup schedule in cron format.
   */
  getDebugLoggingCleanupSchedule() {
    return this._debugLoggingCleanupSchedule;
  }

  /**
   * Gets whether debug logging cleanup is enabled.
   * @returns {boolean} True if cleanup is enabled, false otherwise.
   */
  isDebugLoggingCleanupEnabled() {
    return this._debugLoggingCleanupEnabled;
  }

  /**
   * Gets whether debug logging compression is enabled.
   * @returns {boolean} True if compression is enabled, false otherwise.
   */
  isDebugLoggingCompressionEnabled() {
    return this._debugLoggingCompression;
  }

  /**
   * Gets the debug logging configuration object.
   * @returns {object} Debug logging configuration object.
   */
  getDebugLoggingConfig() {
    return {
      enabled: this._debugLoggingEnabled,
      storage: {
        path: this._debugLoggingPath,
        retentionDays: this._debugLoggingRetentionDays,
        maxFileSize: this._debugLoggingMaxFileSize,
        compression: this._debugLoggingCompression,
      },
      performance: {
        writeBufferSize: this._debugLoggingWriteBufferSize,
        flushInterval: this._debugLoggingFlushInterval,
        maxConcurrentWrites: this._debugLoggingMaxConcurrentWrites,
      },
      cleanup: {
        schedule: this._debugLoggingCleanupSchedule,
        enabled: this._debugLoggingCleanupEnabled,
      },
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
