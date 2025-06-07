// llm-proxy-server/src/config/llmConfigService.js
// --- FILE START ---

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCAL_API_TYPES_REQUIRING_NO_PROXY_KEY,
  DEFAULT_ENCODING_UTF8,
} from './constants.js';

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
 * @description Represents the structure of the parsed llm-configs.json file.
 * @property {string} [defaultConfigId] - The ID of the default LLM configuration.
 * @property {{[key: string]: LLMModelConfig}} configs - A dictionary of LLM configurations, keyed by their configId.
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
   */
  constructor(fileSystemReader, logger, appConfig) {
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

    this.#_defaultLlmConfigPath = path.resolve(
      __dirname,
      '../../../config/llm-configs.json'
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

    this.#logger.info(
      `LlmConfigService: Attempting to load LLM configurations from: ${this.#resolvedConfigPath}`
    );

    try {
      // Step 1: Read file content
      let fileContent;
      try {
        fileContent = await this.#fileSystemReader.readFile(
          this.#resolvedConfigPath,
          DEFAULT_ENCODING_UTF8
        );
        this.#logger.debug(
          `LlmConfigService: Successfully read file content from ${this.#resolvedConfigPath}. Length: ${fileContent.length}`
        );
      } catch (readError) {
        this._setInitializationError(
          `Failed to read LLM configuration file`,
          'config_load_file_read_error',
          readError
        );
        return; // Stop initialization
      }

      // Step 2: Parse JSON
      let parsedConfigs;
      try {
        parsedConfigs = JSON.parse(fileContent);
        this.#logger.debug(
          `LlmConfigService: Successfully parsed JSON content from ${this.#resolvedConfigPath}.`
        );
      } catch (parseError) {
        this._setInitializationError(
          `Failed to parse LLM configuration file as JSON`,
          'config_load_json_parse_error',
          parseError
        );
        return; // Stop initialization
      }

      // Step 3: Basic Validation
      if (typeof parsedConfigs !== 'object' || parsedConfigs === null) {
        this._setInitializationError(
          'LLM configuration content is not a valid object',
          'config_load_validation_not_object',
          null,
          { parsedContentType: typeof parsedConfigs }
        );
        return; // Stop initialization
      }

      if (
        typeof parsedConfigs.configs !== 'object' ||
        parsedConfigs.configs === null
      ) {
        // MODIFIED: Check for 'configs' which aligns with schema's main map
        this._setInitializationError(
          "LLM configuration content is missing the required 'configs' object property", // MODIFIED: Message reflects 'configs'
          'config_load_validation_missing_configs_map', // MODIFIED: Stage reflects 'configs'
          null,
          { configsPropertyType: typeof parsedConfigs.configs } // MODIFIED: Detail reflects 'configs'
        );
        return; // Stop initialization
      }
      // Note: The JSDoc for LLMConfigurationFileForProxy uses 'llms', but the schema uses 'configs'.
      // The original code in proxyLlmConfigLoader.js checks for 'parsedConfigs.llms'.
      // This needs to be consistent. Assuming the schema `configs` is the target:
      // proxyLlmConfigLoader should check `parsedConfigs.configs` and its JSDoc should use `configs`.
      // Here, `LlmConfigService` should also expect `parsedConfigs.configs`.
      // If `parsedConfigs.llms` was the intended property name in the JSON, the schema is wrong.
      // Based on the prompt's `config/llm-configs.json`, the key is `configs`.
      // So, `proxyLlmConfigLoader.js` also needs adjustment for this.
      // And the JSDoc `LLMConfigurationFileForProxy` should use `configs`.

      // Let's assume the provided JSON file structure is the source of truth for key names:
      // { "defaultConfigId": "...", "configs": { ... } }
      // Schema also uses "configs".
      // proxyLlmConfigLoader.js currently validates `parsedConfigs.llms`. This is an error.
      // LLMConfigurationFileForProxy JSDoc in proxyLlmConfigLoader.js uses `llms`. This is an error.

      // Re-evaluating the previous step:
      // The fix in proxyLlmConfigLoader.js was only for defaultLlmId -> defaultConfigId in JSDoc.
      // It also needs to change the property name from 'llms' to 'configs' in its JSDoc and validation.
      // And LlmConfigService should use 'configs'.

      // For now, proceeding with the current code structure's use of 'llms' but acknowledging this discrepancy.
      // The original file `config/llm-configs.json` provided uses "configs" as the key for the map.
      // The `proxyLlmConfigLoader.js` file provided checks for `parsedConfigs.llms`.
      // The `LlmConfigService.js` (this file) JSDoc `LLMConfigurationFileForProxy` refers to `llms`.
      // This is a pre-existing inconsistency.
      // I will correct LlmConfigService to use `defaultConfigId` as requested for this chunk.
      // The `llms` vs `configs` discrepancy is a separate issue from the `defaultConfigId` one.
      // The prompt asks for adaptations to fit the *new schema*. The new schema uses `configs`.
      // The provided `llm-configs.json` also uses `configs`.
      // Therefore, `proxyLlmConfigLoader.js`'s JSDoc and validation for `llms` is wrong and should be `configs`.
      // And this file (`LlmConfigService.js`) should also work with `configs`.

      // If `parsedConfigs.configs` is used (aligning with schema and provided JSON):
      const llmMap = parsedConfigs.configs; // Using 'configs'
      if (typeof llmMap !== 'object' || llmMap === null) {
        this._setInitializationError(
          "LLM configuration content is missing the required 'configs' object property or it's not an object",
          'config_load_validation_missing_configs_map',
          null,
          { configsPropertyType: typeof llmMap }
        );
        return;
      }

      // Success
      this.#loadedLlmConfigs = /** @type {LLMConfigurationFileForProxy} */ (
        parsedConfigs
      );
      this.#isProxyOperational = true;
      this.#initializationError = null; // Clear any potential error state if successful

      const llmCount = Object.keys(this.#loadedLlmConfigs.configs).length; // Using 'configs'
      const defaultId = this.#loadedLlmConfigs.defaultConfigId || 'Not set'; // CORRECTED
      this.#logger.info(
        `LlmConfigService: Initialization successful. Loaded ${llmCount} LLM configurations. Default LLM ID: ${defaultId}. Proxy is operational.`
      );
    } catch (unexpectedError) {
      // This catch handles any other unforeseen errors during the try block.
      this._setInitializationError(
        `An unexpected error occurred during LLM configuration loading`,
        'config_load_unexpected_error',
        unexpectedError
      );
      // this.#isProxyOperational = false; // Handled by _setInitializationError
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
    if (!this.#loadedLlmConfigs || !this.#loadedLlmConfigs.configs) {
      // Using 'configs'
      this.#logger.warn(
        `LlmConfigService.getLlmById: Attempted to get LLM '${llmId}' but configurations are not loaded or 'configs' map is missing.`
      );
      return null;
    }
    const config = this.#loadedLlmConfigs.configs[llmId]; // Using 'configs'
    if (!config) {
      this.#logger.warn(
        `LlmConfigService.getLlmById: LLM configuration for ID '${llmId}' not found.`
      );
      return null;
    }
    return config;
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
    if (this.#initializationError) {
      // Return a structure that's safe for external use, omitting the direct originalError object.
      // eslint-disable-next-line no-unused-vars
      const { originalError: _unusedOriginalError, ...safeErrorDetails } =
        this.#initializationError;
      return safeErrorDetails;
    }
    return null;
  }

  /**
   * Checks if any configured cloud LLM uses apiKeyFileName.
   * This is useful for displaying startup warnings if PROXY_PROJECT_ROOT_PATH is not set.
   * @returns {boolean} True if any cloud LLM is configured to use an API key file, false otherwise.
   */
  hasFileBasedApiKeys() {
    if (
      !this.#isProxyOperational ||
      !this.#loadedLlmConfigs ||
      !this.#loadedLlmConfigs.configs
    ) {
      // Using 'configs'
      return false;
    }

    for (const llmId in this.#loadedLlmConfigs.configs) {
      // Using 'configs'
      // Ensure it's a direct property and not from the prototype chain
      if (
        Object.prototype.hasOwnProperty.call(
          this.#loadedLlmConfigs.configs,
          llmId
        )
      ) {
        // Using 'configs'
        const config = this.#loadedLlmConfigs.configs[llmId]; // Using 'configs'
        const isCloudService =
          config.apiType &&
          !LOCAL_API_TYPES_REQUIRING_NO_PROXY_KEY.includes(
            config.apiType.toLowerCase()
          );
        if (
          isCloudService &&
          config.apiKeyFileName &&
          config.apiKeyFileName.trim() !== ''
        ) {
          return true;
        }
      }
    }
    return false;
  }
}

// --- FILE END ---
