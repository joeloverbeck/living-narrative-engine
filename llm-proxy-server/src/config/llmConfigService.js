// llm-proxy-server/src/config/llmConfigService.js
// --- FILE START ---

import * as path from 'node:path';
import { LOCAL_API_TYPES_REQUIRING_NO_PROXY_KEY } from './constants.js';
import { loadProxyLlmConfigs } from '../proxyLlmConfigLoader.js';

/**
 * @typedef {import('../interfaces/IFileSystemReader.js').IFileSystemReader} IFileSystemReader
 */

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {import('./appConfig.js').AppConfigService} AppConfigService
 */

/**
 * @typedef {object} LLMModelConfig
 * @description Configuration for a specific LLM model.
 * @property {string} configId - Unique identifier for this LLM configuration.
 * @property {string} displayName - A user-friendly name for the LLM.
 * @property {string} modelIdentifier - The specific model ID (e.g., "gpt-3.5-turbo").
 * @property {string} endpointUrl - The URL for the LLM API endpoint.
 * @property {string} apiType - The type of API (e.g., "openai", "ollama", "openrouter").
 * @property {string} [apiKeyEnvVar] - The name of the environment variable holding the API key.
 * @property {string} [apiKeyFileName] - The name of the file containing the API key.
 * @property {object} jsonOutputStrategy - Defines the strategy for ensuring JSON output.
 * @property {string} jsonOutputStrategy.method - The method for JSON output (e.g., "tool_calling").
 * @property {string} [jsonOutputStrategy.toolName] - Name of the tool if method is "tool_calling".
 * @property {string} [jsonOutputStrategy.grammar] - GBNF grammar if method is "gbnf_grammar".
 * @property {object} [jsonOutputStrategy.jsonSchema] - JSON schema if method is "openrouter_json_schema".
 * @property {object} [defaultParameters] - Default parameters for requests to this LLM (e.g., maxRetries, temperature).
 * @property {object} [providerSpecificHeaders] - Headers specific to the LLM provider.
 * @property {Array<object>} promptElements - Defines named prompt parts and their wrappers.
 * @property {Array<string>} promptAssemblyOrder - Ordered list of 'promptElements' keys.
 * @property {number} [contextTokenLimit] - Maximum context tokens for the model.
 * @property {object} [promptFrame] - Framing structure for the prompt (e.g., system message).
 * @property {string} [promptFrame.system] - System-level message.
 */

/**
 * @typedef {object} LLMConfigurationFileForProxy
 * @description Parsed structure of the proxy's llm-configs.json file.
 * @property {string} [defaultConfigId] - ID of the configuration to use by default.
 * @property {{[configId: string]: LLMModelConfig}} configs - Map of configuration objects keyed by ID.
 */

/**
 * @typedef {object} StandardizedErrorObject
 * @description Standardized structure for error information.
 * @property {string} message - A human-readable description of the error.
 * @property {string} stage - A machine-readable string indicating the stage or component where the error occurred.
 * @property {object} details - An object containing additional structured details about the error.
 * @property {string} [details.pathAttempted] - The configuration file path that was attempted (for LlmConfigService).
 * @property {string} [details.originalErrorMessage] - The message from the original error, if any.
 * @property {Error} [originalError] - The original error object (primarily for internal logging, not direct client exposure).
 */

/**
 *
 */
export class LlmConfigService {
  /** @type {IFileSystemReader} */
  #fileSystemReader;
  /** @type {ILogger} */
  #logger;
  /** @type {AppConfigService} */
  #appConfig;
  /** @type {Function} */
  #configLoader;

  /** @type {string} */
  #_defaultLlmConfigPath;
  /** @type {string | null} */
  #resolvedConfigPath = null;
  /** @type {LLMConfigurationFileForProxy | null} */
  #loadedLlmConfigs = null;
  /** @type {boolean} */
  #isProxyOperational = false;
  /** @type {StandardizedErrorObject | null} */
  #initializationError = null;

  /**
   * Constructs an LlmConfigService instance.
   * @param {IFileSystemReader} fileSystemReader - An IFileSystemReader instance.
   * @param {ILogger} logger - An ILogger instance.
   * @param {AppConfigService} appConfig - An AppConfigService instance.
   * @param {Function} [loader] - Loader function for LLM configs.
   */
  constructor(
    fileSystemReader,
    logger,
    appConfig,
    loader = loadProxyLlmConfigs
  ) {
    if (!fileSystemReader) {
      throw new Error('LlmConfigService: fileSystemReader is required.');
    }
    if (!logger) {
      throw new Error('LlmConfigService: logger is required.');
    }
    if (!appConfig) {
      throw new Error('LlmConfigService: appConfig is required.');
    }

    this.#fileSystemReader = fileSystemReader;
    this.#logger = logger;
    this.#appConfig = appConfig;
    this.#configLoader = loader;

    this.#_defaultLlmConfigPath = path.resolve(
      process.cwd(),
      'config/llm-configs.json'
    );

    this.#logger.debug('LlmConfigService: Instance created.');
  }

  /**
   * Sets the initialization error details and logs the error.
   * Also sets the proxy operational status to false.
   * @private
   * @param {string} message - The human-readable error message.
   * @param {string} stage - The machine-readable stage of the error.
   * @param {Error | null} [originalError] - The original error object, if any.
   * @param {object} [additionalDetails] - Additional details to merge into the error's details property.
   */
  _setInitializationError(
    message,
    stage,
    originalError = null,
    additionalDetails = {}
  ) {
    this.#isProxyOperational = false; // Ensure proxy is marked not operational
    this.#initializationError = {
      message,
      stage,
      details: {
        pathAttempted: this.#resolvedConfigPath, // Common detail for all init errors
        ...additionalDetails,
      },
    };

    if (
      originalError &&
      originalError.message &&
      !this.#initializationError.details.originalErrorMessage
    ) {
      this.#initializationError.details.originalErrorMessage =
        originalError.message;
    }
    // Store the full originalError object internally for detailed logging/debugging
    // This won't be directly exposed via getInitializationErrorDetails unless explicitly handled by the caller
    if (originalError) {
      this.#initializationError.originalError = originalError;
    }

    const logMessage = `LlmConfigService: CRITICAL ERROR - ${message}. Stage: ${stage}.`;
    const logContext = {
      pathAttempted: this.#resolvedConfigPath, // Duplicate pathAttempted in log for easy viewing
      errorStage: stage,
      additionalDetails, // Log any specific additional details
      originalError: originalError
        ? {
            message: originalError.message,
            name: originalError.name,
            // stack: originalError.stack // Stack can be very verbose for logs, consider if needed
          }
        : undefined,
    };

    this.#logger.error(logMessage, logContext);
  }

  /**
   * Initializes the service by loading and validating the LLM configurations.
   * This method should be called once during application startup.
   * @returns {Promise<void>}
   */
  async initialize() {
    this.#logger.debug('LlmConfigService: Initialization started.');
    this.#isProxyOperational = false; // Default to not operational until success

    const customPath = this.#appConfig.getLlmConfigPath();
    this.#resolvedConfigPath =
      customPath && customPath.trim() !== ''
        ? path.resolve(customPath)
        : this.#_defaultLlmConfigPath;

    this.#logger.debug(
      `LlmConfigService: Attempting to load LLM configurations from: ${this.#resolvedConfigPath}`
    );

    try {
      const result = await this.#configLoader(
        this.#resolvedConfigPath,
        this.#logger,
        this.#fileSystemReader
      );

      if (result.error) {
        this._setInitializationError(
          result.message,
          result.stage,
          result.originalError,
          { pathAttempted: result.pathAttempted }
        );
        return;
      }

      this.#loadedLlmConfigs = Object.freeze({
        ...result.llmConfigs,
        configs: Object.freeze(result.llmConfigs.configs),
      });
      this.#isProxyOperational = true;
      this.#initializationError = null;

      const llmCount = Object.keys(result.llmConfigs.configs).length;
      const defaultId = result.llmConfigs.defaultConfigId || 'Not set';
      this.#logger.debug(
        `LlmConfigService: Initialization successful. Loaded ${llmCount} LLM configurations. Default LLM ID: ${defaultId}. Proxy is operational.`
      );
    } catch (unexpectedError) {
      this._setInitializationError(
        `An unexpected error occurred during LLM configuration loading`,
        'config_load_unexpected_error',
        unexpectedError
      );
    }
  }

  /**
   * Checks if the proxy is operational based on configuration loading success.
   * @returns {boolean} True if operational, false otherwise.
   */
  isOperational() {
    return this.#isProxyOperational;
  }

  /**
   * Gets all loaded LLM configurations.
   * @returns {LLMConfigurationFileForProxy | null} The loaded configurations, or null if not loaded/failed.
   */
  getLlmConfigs() {
    return this.#loadedLlmConfigs;
  }

  /**
   * Gets a specific LLM configuration by its ID.
   * @param {string} llmId - The ID of the LLM to retrieve.
   * @returns {LLMModelConfig | null} The LLM configuration, or null if not found or not loaded.
   */
  getLlmById(llmId) {
    if (!this.#loadedLlmConfigs?.configs) {
      this.#logger.warn(
        `LlmConfigService.getLlmById: Attempted to get LLM '${llmId}' but configurations are not loaded.`
      );
      return null;
    }
    const cfg = this.#loadedLlmConfigs.configs[llmId];
    if (!cfg) {
      this.#logger.warn(
        `LlmConfigService.getLlmById: LLM configuration for ID '${llmId}' not found.`
      );
      return null;
    }
    return cfg;
  }

  /**
   * Gets the actual resolved path used for loading the LLM configuration file.
   * @returns {string | null} The resolved path, or null if not yet determined.
   */
  getResolvedConfigPath() {
    return this.#resolvedConfigPath;
  }

  /**
   * Gets the details of the initialization error, if one occurred.
   * The returned object conforms to { message: string, stage: string, details: object }.
   * The `originalError` property from the internal error object is not directly exposed here
   * to avoid leaking potentially large or sensitive error objects to less controlled contexts.
   * The error log within `_setInitializationError` handles logging necessary details from `originalError`.
   * @returns {StandardizedErrorObject | null} Error details, or null if initialization was successful.
   */
  getInitializationErrorDetails() {
    if (!this.#initializationError) return null;
    const { originalError: _unused, ...safe } = this.#initializationError;
    return safe;
  }

  /**
   * Checks if any configured cloud LLM uses apiKeyFileName.
   * This is useful for displaying startup warnings if PROXY_PROJECT_ROOT_PATH is not set.
   * @returns {boolean} True if any cloud LLM is configured to use an API key file, false otherwise.
   */
  hasFileBasedApiKeys() {
    if (!this.#isProxyOperational || !this.#loadedLlmConfigs) {
      return false;
    }
    return Object.values(this.#loadedLlmConfigs.configs).some((cfg) => {
      const type = cfg.apiType?.toLowerCase();
      const cloud =
        type && !LOCAL_API_TYPES_REQUIRING_NO_PROXY_KEY.includes(type);
      return cloud && cfg.apiKeyFileName?.trim();
    });
  }
}

// --- FILE END ---
