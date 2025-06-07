// src/turns/adapters/configurableLLMAdapter.js
// --- FILE START ---

import { ILLMAdapter } from '../interfaces/ILLMAdapter.js';
import { CLOUD_API_TYPES } from '../../llms/constants/llmConstants.js';

// 🔄  REPLACE the old import with the default CL100K encoder helpers
import { encode as cl100kEncode } from 'gpt-tokenizer';

/**
 * Minimal map: model name → encoding.
 *  Extend it if you start using more legacy models.
 */
const MODEL_TO_ENCODING = {
  'gpt-3.5-turbo': 'cl100k_base',
  'gpt-4': 'cl100k_base',
  'gpt-4o': 'cl100k_base',
  'gpt-4o-mini': 'cl100k_base',
  'gpt-4-turbo': 'cl100k_base',

  // old completions / embeddings
  'text-davinci-003': 'p50k_base',
  'code-davinci-002': 'p50k_base',
  'text-curie-001': 'r50k_base',
  'text-embedding-ada-002': 'cl100k_base',
};

import PromptTooLongError from '../../errors/promptTooLongError.js';
import {
  LLMInteractionError,
  ApiKeyError,
  InsufficientCreditsError,
  ContentPolicyError,
  PermissionError,
  BadRequestError,
  MalformedResponseError,
} from '../../errors/llmInteractionErrors.js';

/**
 * @typedef {import('../../llms/services/llmConfigLoader.js').LlmConfigLoader} LlmConfigLoader
 * @typedef {object} LLMModelConfig
 * @description A self-contained LLM configuration, including properties for prompt engineering and API interaction.
 * Corresponds to the `llmConfiguration` definition in `llm-configs.schema.json`.
 * @property {string} configId - Unique identifier for this LLM configuration.
 * @property {string} displayName - A user-friendly name for this configuration.
 * @property {string} modelIdentifier - The specific model ID or family identifier.
 * @property {string} endpointUrl - The base API endpoint URL.
 * @property {string} apiType - Identifier for the API type (e.g., 'openai', 'openrouter').
 * @property {string} [apiKeyEnvVar] - Optional: Environment variable for API key.
 * @property {string} [apiKeyFileName] - Optional: File name for API key.
 * @property {object} jsonOutputStrategy - Defines the strategy for ensuring JSON output.
 * @property {string} jsonOutputStrategy.method - The method for enforcing JSON output.
 * @property {string} [jsonOutputStrategy.toolName] - Required if method is 'tool_calling'.
 * @property {string} [jsonOutputStrategy.grammar] - Required if method is 'gbnf_grammar'.
 * @property {object} [jsonOutputStrategy.jsonSchema] - Required if method uses JSON schema.
 * @property {object} [defaultParameters] - Optional: Default parameters for LLM requests.
 * @property {object} [providerSpecificHeaders] - Optional: HTTP headers specific to the LLM provider.
 * @property {Array<{key: string, prefix: string, suffix: string}>} promptElements - Defines named prompt parts.
 * @property {string[]} promptAssemblyOrder - Ordered list of 'promptElements' keys.
 * @property {number} [contextTokenLimit] - Optional: Maximum context tokens for the model.
 */

/**
 * @typedef {object} LLMConfigurationFile
 * @description The root structure of the LLM configuration file.
 * @property {string} defaultConfigId - The ID of the default LLM configuration to use.
 * @property {{[key: string]: LLMModelConfig}} configs - A map of LLM configurations, where each key is a configId.
 */

/** @typedef {import('../../llms/services/llmConfigLoader.js').LoadConfigsErrorResult} LoadConfigsErrorResult */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../schemas/llmOutputSchemas.js').LLM_TURN_ACTION_RESPONSE_SCHEMA} LLM_TURN_ACTION_SCHEMA_TYPE */
/** @typedef {import('../../llms/environmentContext.js').EnvironmentContext} EnvironmentContext */
/** @typedef {import('../../llms/interfaces/IApiKeyProvider.js').IApiKeyProvider} IApiKeyProvider */
/** @typedef {import('../../llms/LLMStrategyFactory.js').LLMStrategyFactory} LLMStrategyFactory */

/** @typedef {import('../../llms/interfaces/ILLMStrategy.js').ILLMStrategy} ILLMStrategy */

/**
 * Custom error class for configuration-related issues within the ConfigurableLLMAdapter.
 */
export class ConfigurationError extends Error {
  /**
   * Creates an instance of ConfigurationError.
   *
   * @param {string} message - The error message.
   * @param {object} [details] - Additional details about the error.
   * @param {string} [details.llmId] - The ID of the LLM configuration that caused the error.
   * @param {string | string[]} [details.problematicField] - The name(s) of the configuration field(s) that are problematic.
   * @param {any} [details.fieldValue] - The value of the problematic field.
   * @param {object[]} [details.problematicFields] - Array of problematic fields {field, reason}.
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'ConfigurationError';
    this.llmId = details.llmId;
    this.problematicField = details.problematicField; // Kept for backward compatibility if some old code uses it
    this.fieldValue = details.fieldValue; // Kept for backward compatibility
    this.problematicFields = details.problematicFields; // New field for multiple validation errors
    // Add any other relevant details if needed
  }
}

/**
 * @class ConfigurableLLMAdapter
 * @implements {ILLMAdapter}
 * @description An adapter for interacting with Large Language Models based on
 * external configurations. It loads configurations via LlmConfigLoader and
 * manages the active LLM configuration. It ensures its own initialization is complete
 * before executing core logic.
 */
export class ConfigurableLLMAdapter extends ILLMAdapter {
  // --- Private Fields ---
  #logger;
  #environmentContext;
  #apiKeyProvider;
  #llmStrategyFactory;
  #configLoader = null;

  #llmRootConfig = null; // Renamed from #llmConfigs to reflect it holds the root object

  #defaultConfigIdFromFile = null;
  #allConfigsMap = null;

  #isInitialized = false;
  #isOperational = false;
  #currentActiveLlmId = null;
  #currentActiveLlmConfig = null;
  #initialLlmIdFromConstructor = null;

  /**
   * @private
   * @type {Promise<void> | null}
   * @description Stores the promise returned by the actual initialization logic.
   */
  #initPromise = null;

  /**
   * Creates an instance of ConfigurableLLMAdapter.
   *
   * @param {object} dependencies - The dependencies for this adapter.
   * @param {ILogger} dependencies.logger - A logger instance.
   * @param {EnvironmentContext} dependencies.environmentContext - An EnvironmentContext instance.
   * @param {IApiKeyProvider} dependencies.apiKeyProvider - An IApiKeyProvider instance.
   * @param {LLMStrategyFactory} dependencies.llmStrategyFactory - An LLMStrategyFactory instance.
   * @param {string} [dependencies.initialLlmId] - Optional. The ID of the LLM to activate initially.
   * @throws {Error} If any critical dependency is missing or invalid.
   */
  constructor({
    logger,
    environmentContext,
    apiKeyProvider,
    llmStrategyFactory,
    initialLlmId = null,
  }) {
    super();

    if (!logger || typeof logger.error !== 'function') {
      const errorMsg =
        'ConfigurableLLMAdapter: Constructor requires a valid ILogger instance.';
      if (logger && typeof logger.error === 'function') {
        logger.error(errorMsg);
      }
      throw new Error(errorMsg);
    }
    this.#logger = logger;

    if (
      !environmentContext ||
      typeof environmentContext.getExecutionEnvironment !== 'function'
    ) {
      const errorMsg =
        'ConfigurableLLMAdapter: Constructor requires a valid EnvironmentContext instance.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#environmentContext = environmentContext;

    if (!apiKeyProvider || typeof apiKeyProvider.getKey !== 'function') {
      const errorMsg =
        'ConfigurableLLMAdapter: Constructor requires a valid IApiKeyProvider instance.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#apiKeyProvider = apiKeyProvider;

    if (
      !llmStrategyFactory ||
      typeof llmStrategyFactory.getStrategy !== 'function'
    ) {
      const errorMsg =
        'ConfigurableLLMAdapter: Constructor requires a valid LLMStrategyFactory instance.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#llmStrategyFactory = llmStrategyFactory;

    if (initialLlmId !== null && typeof initialLlmId !== 'string') {
      this.#logger.warn(
        `ConfigurableLLMAdapter: Constructor received an invalid type for initialLlmId (expected string or null). Received: ${typeof initialLlmId}. Ignoring.`
      );
      this.#initialLlmIdFromConstructor = null;
    } else if (initialLlmId && initialLlmId.trim() === '') {
      this.#logger.warn(
        `ConfigurableLLMAdapter: Constructor received an empty string for initialLlmId. It will be treated as if no initialLlmId was provided.`
      );
      this.#initialLlmIdFromConstructor = null;
    } else {
      this.#initialLlmIdFromConstructor = initialLlmId;
    }

    this.#logger.debug(
      `ConfigurableLLMAdapter: Instance created. Execution environment: ${this.#environmentContext.getExecutionEnvironment()}. Initial LLM ID from constructor: '${this.#initialLlmIdFromConstructor || 'not set'}'. Ready for initialization call.`
    );
  }

  /**
   * @private
   * @description Sets the active LLM configuration based on initialLlmId (from constructor)
   * and defaultConfigId (from loaded dependencyInjection), adhering to specified priorities.
   * This method is called internally after configurations are successfully loaded.
   */
  #selectInitialActiveLlm() {
    // Use #allConfigsMap and #defaultConfigIdFromFile
    if (!this.#allConfigsMap || typeof this.#allConfigsMap !== 'object') {
      this.#logger.warn(
        'ConfigurableLLMAdapter.#selectInitialActiveLlm: Cannot select active LLM because configurations map is not loaded or is invalid.'
      );
      this.#currentActiveLlmId = null;
      this.#currentActiveLlmConfig = null;
      return;
    }

    const allConfigsMap = this.#allConfigsMap;
    const defaultConfigId = this.#defaultConfigIdFromFile; // This might be null if not a string in the file
    let llmSelected = false;
    let specificWarningForDefaultNotFoundLogged = false;

    // Priority 1: initialLlmId from constructor
    if (
      this.#initialLlmIdFromConstructor &&
      typeof this.#initialLlmIdFromConstructor === 'string' &&
      this.#initialLlmIdFromConstructor.trim() !== ''
    ) {
      const targetConfig = allConfigsMap[this.#initialLlmIdFromConstructor];
      if (targetConfig) {
        this.#currentActiveLlmId = this.#initialLlmIdFromConstructor;
        this.#currentActiveLlmConfig = targetConfig;
        this.#logger.debug(
          `ConfigurableLLMAdapter: LLM configuration '${this.#currentActiveLlmId}' (${targetConfig.displayName || 'N/A'}) set as active by initialLlmId from constructor.`
        );
        llmSelected = true;
      } else {
        this.#logger.warn(
          `ConfigurableLLMAdapter.#selectInitialActiveLlm: initialLlmId ('${this.#initialLlmIdFromConstructor}') was provided to constructor, but no LLM configuration with this ID exists in the configs map. Falling back to defaultConfigId logic.`
        );
      }
    }

    // Priority 2: defaultConfigId from configuration file
    if (!llmSelected) {
      // Check if defaultConfigId (which is this.#defaultConfigIdFromFile) is a valid, non-empty string
      if (
        defaultConfigId &&
        typeof defaultConfigId === 'string' &&
        defaultConfigId.trim() !== ''
      ) {
        const targetConfig = allConfigsMap[defaultConfigId];
        if (targetConfig) {
          this.#currentActiveLlmId = defaultConfigId;
          this.#currentActiveLlmConfig = targetConfig;
          this.#logger.debug(
            `ConfigurableLLMAdapter: LLM configuration '${this.#currentActiveLlmId}' (${targetConfig.displayName || 'N/A'}) set as active by defaultConfigId from file.`
          );
          llmSelected = true;
        } else {
          // defaultConfigId specified but not found in configs map
          this.#logger.warn(
            `ConfigurableLLMAdapter: 'defaultConfigId' ("${defaultConfigId}") is specified in configurations, but no LLM configuration with this ID exists in the configs map. No default LLM set.`
          );
          specificWarningForDefaultNotFoundLogged = true;
        }
      } else if (defaultConfigId) {
        // defaultConfigId is present (e.g. from file) but empty string or was not a string initially (e.g. null)
        this.#logger.warn(
          `ConfigurableLLMAdapter.#selectInitialActiveLlm: 'defaultConfigId' found in configurations but it is not a valid non-empty string ("${defaultConfigId}").`
        );
      } else {
        // defaultConfigId is null or undefined (either missing from file or was null/invalid type)
        this.#logger.debug(
          `ConfigurableLLMAdapter: No "defaultConfigId" specified in configurations. No LLM is set as active by default.`
        );
      }
    }

    if (!llmSelected) {
      this.#currentActiveLlmId = null;
      this.#currentActiveLlmConfig = null;
      if (Object.keys(allConfigsMap).length === 0) {
        this.#logger.warn(
          'ConfigurableLLMAdapter.#selectInitialActiveLlm: No LLM configurations found in the configs map. No LLM can be set as active.'
        );
      } else if (
        !specificWarningForDefaultNotFoundLogged &&
        !(
          this.#initialLlmIdFromConstructor &&
          allConfigsMap[this.#initialLlmIdFromConstructor]
        ) /* ensure no initialLlmId was found */ &&
        !defaultConfigId /* ensure no default Config Id was even attempted if it was null/undefined */
      ) {
        // This general warning should only appear if no specific issue (like default ID not found, or invalid empty string) was already logged.
        // And no initial id from constructor was used, and no default dependencyInjection id was even present.
        this.#logger.warn(
          'ConfigurableLLMAdapter.#selectInitialActiveLlm: No default LLM set. Neither initialLlmIdFromConstructor nor defaultConfigId resulted in a valid active LLM selection.'
        );
      }
    }
  }

  /**
   * Asynchronously initializes the ConfigurableLLMAdapter if not already initiated.
   * This method is idempotent and manages an internal promise for the async initialization process.
   * It loads LLM configurations using the provided LlmConfigLoader
   * and sets the initial active LLM based on constructor parameter and dependencyInjection file default.
   *
   * @param {object} initParams - Parameters for initialization.
   * @param {LlmConfigLoader} initParams.llmConfigLoader - An instance of LlmConfigLoader.
   * @returns {Promise<void>} A promise that resolves when initialization is complete,
   * or rejects if it fails. This promise is shared across calls to init.
   * @throws {Error} (Synchronously) If llmConfigLoader is invalid when init is first called seriously.
   */
  init({ llmConfigLoader }) {
    // Path 1: Already successfully initialized AND operational from a completed previous call.
    if (this.#isInitialized && this.#isOperational) {
      this.#logger.info(
        'ConfigurableLLMAdapter: Already initialized and operational from a previous successful call. Skipping re-initialization logic.'
      );
      return this.#initPromise;
    }

    // Path 2: Previously initialized (i.e., an init cycle completed) but NOT operational.
    if (this.#isInitialized && !this.#isOperational) {
      const errorMsg =
        'ConfigurableLLMAdapter: Cannot re-initialize after a critical configuration loading failure from a previous attempt.';
      this.#logger.error(errorMsg);
      return Promise.reject(new Error(errorMsg));
    }

    // Path 3: Initialization is already in progress.
    if (this.#initPromise) {
      this.#logger.info(
        'ConfigurableLLMAdapter: Initialization is already in progress. Returning existing promise.'
      );
      return this.#initPromise;
    }

    // Path 4: Synchronous validation for llmConfigLoader.
    if (!llmConfigLoader || typeof llmConfigLoader.loadConfigs !== 'function') {
      const errorMsg =
        'ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.';
      this.#logger.error(errorMsg, { providedLoader: llmConfigLoader });
      this.#isInitialized = true;
      this.#isOperational = false;
      throw new Error(errorMsg);
    }

    // Path 5: Create and return the promise for the main asynchronous initialization process.
    this.#initPromise = (async () => {
      this.#configLoader = llmConfigLoader;
      this.#logger.info(
        'ConfigurableLLMAdapter: Actual asynchronous initialization started with LlmConfigLoader.'
      );
      this.#currentActiveLlmId = null;
      this.#currentActiveLlmConfig = null;
      this.#isOperational = false;
      this.#llmRootConfig = null; // Reset before loading
      this.#defaultConfigIdFromFile = null;
      this.#allConfigsMap = null;

      try {
        const configResult = await this.#configLoader.loadConfigs();

        if (
          configResult &&
          'error' in configResult &&
          configResult.error === true
        ) {
          const loadError = /** @type {LoadConfigsErrorResult} */ (
            configResult
          );
          this.#logger.error(
            'ConfigurableLLMAdapter: Critical error loading LLM configurations.',
            {
              message: loadError.message,
              stage: loadError.stage,
              path: loadError.path,
              originalErrorMessage: loadError.originalError
                ? loadError.originalError.message
                : 'N/A',
            }
          );
        }
        // Stricter condition as per original ticket description and schema requirements
        else if (
          configResult &&
          typeof configResult.configs === 'object' &&
          configResult.configs !== null &&
          typeof configResult.defaultConfigId === 'string'
        ) {
          this.#llmRootConfig = /** @type {LLMConfigurationFile} */ (
            configResult
          );
          this.#defaultConfigIdFromFile = this.#llmRootConfig.defaultConfigId;
          this.#allConfigsMap = this.#llmRootConfig.configs;

          this.#logger.info(
            'ConfigurableLLMAdapter: LLM configurations loaded successfully.',
            {
              numberOfConfigs: Object.keys(this.#allConfigsMap).length,
              defaultConfigId: this.#defaultConfigIdFromFile || 'Not set',
            }
          );
          this.#isOperational = true;
          this.#selectInitialActiveLlm();
        } else {
          this.#logger.error(
            'ConfigurableLLMAdapter: LLM configuration loading returned an unexpected structure.',
            { configResult }
          );
          // this.#isOperational remains false
        }
      } catch (error) {
        this.#logger.error(
          'ConfigurableLLMAdapter: Unexpected exception during LLM configuration loading.',
          {
            errorMessage: error.message,
            errorStack: error.stack,
          }
        );
        this.#isOperational = false; // Ensure this is set on exception
        this.#isInitialized = true; // Mark that an attempt was made
        throw error; // Re-throw to reject this.#initPromise
      }

      this.#isInitialized = true; // Mark that initialization attempt is complete
      if (!this.#isOperational) {
        this.#logger.warn(
          'ConfigurableLLMAdapter: Initialization attempt complete, but the adapter is NON-OPERATIONAL due to configuration loading issues.'
        );
      } else {
        this.#logger.info(
          `ConfigurableLLMAdapter: Initialization attempt complete and adapter is operational.`
        );
      }
    })();
    return this.#initPromise;
  }

  /**
   * @private
   * @async
   * @description Ensures that the adapter's asynchronous initialization has completed.
   * Throws an error if initialization was never started, or if it completed but the adapter is not operational.
   */
  async #ensureInitialized() {
    if (!this.#initPromise) {
      const msg =
        'ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter.';
      this.#logger.error(`ConfigurableLLMAdapter.#ensureInitialized: ${msg}`);
      throw new Error(msg); // Consistent with AC: "ensureInitialized throws"
    }
    // Await the promise. If it rejected (e.g., LlmConfigLoader.loadConfigs threw),
    // this await will re-throw that error.
    await this.#initPromise;

    // This check might seem redundant if #initPromise rejection is handled, but it's a safeguard.
    if (!this.#isInitialized) {
      const msg =
        'ConfigurableLLMAdapter: Initialization promise resolved, but adapter is not marked as initialized. Internal logic error.';
      this.#logger.error(`ConfigurableLLMAdapter.#ensureInitialized: ${msg}`);
      throw new Error(msg); // Consistent with AC
    }
    if (!this.#isOperational) {
      const msg =
        'ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.';
      this.#logger.error(`ConfigurableLLMAdapter.#ensureInitialized: ${msg}`);
      throw new Error(msg); // Consistent with AC
    }
  }

  /**
   * Sets the active LLM configuration by its ID.
   * This method allows changing the currently active LLM configuration at runtime.
   * It validates the provided llmId against the loaded configurations and updates the adapter's internal state.
   *
   * @param {string} llmId - The ID of the LLM configuration to set as active.
   * @returns {Promise<boolean>} True if the LLM configuration was successfully set as active, false otherwise.
   * @throws {Error} If the adapter is not initialized or not operational (propagated from #ensureInitialized).
   */
  async setActiveLlm(llmId) {
    await this.#ensureInitialized();

    // Use #allConfigsMap
    if (!this.#allConfigsMap) {
      this.#logger.error(
        `ConfigurableLLMAdapter.setActiveLlm: LLM configurations map is not available. Cannot set LLM ID '${llmId}'. This may indicate an issue post-initialization.`
      );
      return false;
    }

    if (typeof llmId !== 'string' || llmId.trim() === '') {
      this.#logger.error(
        `ConfigurableLLMAdapter.setActiveLlm: Invalid llmId provided (must be a non-empty string). Received: '${llmId}'. Active LLM remains '${this.#currentActiveLlmId || 'none'}'.`
      );
      return false;
    }

    // Use #allConfigsMap
    const targetConfig = this.#allConfigsMap[llmId];

    if (targetConfig) {
      const oldLlmId = this.#currentActiveLlmId;
      this.#currentActiveLlmId = llmId;
      this.#currentActiveLlmConfig = targetConfig; // targetConfig is already the new LLMModelConfig type
      const newDisplayName = targetConfig.displayName || 'N/A';
      this.#logger.info(
        `ConfigurableLLMAdapter.setActiveLlm: Active LLM configuration changed from '${oldLlmId || 'none'}' to '${llmId}' (${newDisplayName}).`
      );
      return true;
    } else {
      this.#logger.error(
        `ConfigurableLLMAdapter.setActiveLlm: No LLM configuration found with ID '${llmId}' in the configs map. Active LLM remains unchanged ('${this.#currentActiveLlmId || 'none'}').`
      );
      return false;
    }
  }

  /**
   * Retrieves the full configuration object for the currently active LLM.
   * The object returned is of type LLMModelConfig.
   *
   * @returns {Promise<LLMModelConfig | null>} The active LLMModelConfig object, or null if no LLM is active.
   * @throws {Error} If the adapter is not initialized or not operational (propagated from #ensureInitialized).
   */
  async getCurrentActiveLlmConfig() {
    await this.#ensureInitialized();

    if (!this.#currentActiveLlmConfig) {
      this.#logger.debug(
        'ConfigurableLLMAdapter.getCurrentActiveLlmConfig: No LLM configuration is currently active. Returning null.'
      );
      return null;
    }
    // this.#currentActiveLlmConfig is already updated to be an LLMModelConfig instance
    // by #selectInitialActiveLlm or setActiveLlm.
    return this.#currentActiveLlmConfig;
  }

  /**
   * Retrieves a list of available LLM configurations for UI selection.
   *
   * @public
   * @async
   * @returns {Promise<Array<{configId: string, displayName: string}>>} A promise that resolves to an array of LLM options.
   * Each option is an object with 'configId' and 'displayName'. Returns an empty array if not operational or no configs.
   */
  async getAvailableLlmOptions() {
    try {
      await this.#ensureInitialized();
    } catch (error) {
      this.#logger.warn(
        `ConfigurableLLMAdapter.getAvailableLlmOptions: Adapter not operational. Cannot retrieve LLM options. Error: ${error.message}`
      );
      return [];
    }

    // Use #allConfigsMap
    if (!this.#isOperational || !this.#allConfigsMap) {
      // Should be caught by #ensureInitialized if !this.#isOperational
      this.#logger.warn(
        'ConfigurableLLMAdapter.getAvailableLlmOptions: Adapter is not operational or LLM configurations map is not loaded. Returning empty array.'
      );
      return [];
    }

    // Use #allConfigsMap
    const configsArray = Object.values(this.#allConfigsMap);
    if (configsArray.length === 0) {
      this.#logger.warn(
        'ConfigurableLLMAdapter.getAvailableLlmOptions: No LLM configurations found in the configs map. Returning empty array.'
      );
      return [];
    }

    // Map to use dependencyInjection.configId and dependencyInjection.displayName
    // The schema and llm-configs.json example use "configId" (camelCase) inside each configuration object.
    const options = configsArray.map((config) => ({
      configId: config.configId, // Use 'configId' as the key
      displayName: config.displayName || config.configId,
    }));

    return options;
  }

  /**
   * Retrieves the ID of the currently active LLM.
   *
   * @public
   * @async
   * @returns {Promise<string | null>} A promise that resolves to the active LLM ID (string) or null if no LLM is active or adapter is not operational.
   * @throws {Error} If the adapter is not initialized or not operational (propagated from #ensureInitialized).
   */
  async getCurrentActiveLlmId() {
    try {
      await this.#ensureInitialized();
    } catch (error) {
      this.#logger.warn(
        `ConfigurableLLMAdapter.getCurrentActiveLlmId: Adapter not operational. Cannot retrieve current active LLM ID. Error: ${error.message}`
      );
      return null; // Return null on error, as expected by management tests
    }
    return this.#currentActiveLlmId;
  }

  /**
   * @private
   * Validates a single LLM configuration object.
   * @param {LLMModelConfig} config - Configuration to validate.
   * @returns {Array<{field: string, reason: string}>} Array of validation errors.
   */
  #validateConfig(config) {
    const errors = [];
    if (
      !config.configId ||
      typeof config.configId !== 'string' ||
      config.configId.trim() === ''
    ) {
      errors.push({ field: 'configId', reason: 'Missing or invalid' });
    }
    if (
      !config.endpointUrl ||
      typeof config.endpointUrl !== 'string' ||
      config.endpointUrl.trim() === ''
    ) {
      errors.push({ field: 'endpointUrl', reason: 'Missing or invalid' });
    }
    if (
      !config.modelIdentifier ||
      typeof config.modelIdentifier !== 'string' ||
      config.modelIdentifier.trim() === ''
    ) {
      errors.push({ field: 'modelIdentifier', reason: 'Missing or invalid' });
    }
    if (
      !config.apiType ||
      typeof config.apiType !== 'string' ||
      config.apiType.trim() === ''
    ) {
      errors.push({ field: 'apiType', reason: 'Missing or invalid' });
    }

    const jos = config.jsonOutputStrategy;
    if (typeof jos !== 'object' || jos === null) {
      errors.push({
        field: 'jsonOutputStrategy',
        reason: 'Is required and must be an object.',
      });
    } else if (typeof jos.method !== 'string' || jos.method.trim() === '') {
      errors.push({
        field: 'jsonOutputStrategy.method',
        reason: 'Is required and must be a non-empty string.',
      });
    } else {
      const method = jos.method;
      if (
        method === 'tool_calling' &&
        (typeof jos.toolName !== 'string' || jos.toolName.trim() === '')
      ) {
        errors.push({
          field: 'jsonOutputStrategy.toolName',
          reason: 'Required when jsonOutputStrategy.method is "tool_calling".',
        });
      } else if (
        method === 'gbnf_grammar' &&
        (typeof jos.grammar !== 'string' || jos.grammar.trim() === '')
      ) {
        errors.push({
          field: 'jsonOutputStrategy.grammar',
          reason: 'Required when jsonOutputStrategy.method is "gbnf_grammar".',
        });
      } else if (
        method === 'openrouter_json_schema' &&
        (typeof jos.jsonSchema !== 'object' || jos.jsonSchema === null)
      ) {
        errors.push({
          field: 'jsonOutputStrategy.jsonSchema',
          reason:
            'Required when jsonOutputStrategy.method is "openrouter_json_schema".',
        });
      }
    }

    return errors;
  }

  /**
   * @private
   * Retrieves an API key for the given dependencyInjection, enforcing required logic.
   * @param {LLMModelConfig} config - LLM configuration requiring a key.
   * @returns {Promise<string | undefined>} Resolved API key, if any.
   */
  async #getApiKeyForConfig(config) {
    this.#logger.debug(
      `Attempting to retrieve API key for LLM '${config.configId}'.`
    );
    const apiKey = await this.#apiKeyProvider.getKey(
      config,
      this.#environmentContext
    );
    const isCloudApi = CLOUD_API_TYPES.includes(config.apiType);
    const requiresApiKey = isCloudApi && this.#environmentContext.isServer();

    if (requiresApiKey && !apiKey) {
      const msg = `API key missing for server-side cloud LLM '${config.configId}'. Key is required in this context.`;
      throw new ConfigurationError(msg, {
        llmId: config.configId,
        problematicField: 'apiKey',
      });
    }

    if (apiKey) {
      this.#logger.debug(`API key retrieved for LLM '${config.configId}'.`);
    } else if (requiresApiKey) {
      throw new ConfigurationError(
        `Critical: API key for LLM '${config.configId}' required but unavailable.`,
        {
          llmId: config.configId,
          problematicField: 'apiKey',
        }
      );
    } else {
      this.#logger.info(
        `API key not required or not found for LLM '${config.configId}', proceeding. (Is Cloud API: ${isCloudApi}, Is Server: ${this.#environmentContext.isServer()})`
      );
    }

    return apiKey;
  }

  /**
   * @private
   * Creates an LLM strategy instance for the provided dependencyInjection.
   * @param {LLMModelConfig} config - LLM configuration used for strategy creation.
   * @returns {ILLMStrategy} Created strategy instance.
   */
  #createStrategy(config) {
    try {
      return this.#llmStrategyFactory.getStrategy(config);
    } catch (factoryError) {
      throw new ConfigurationError(
        `Failed to get strategy from factory for LLM '${config.configId}': ${factoryError.message}`,
        {
          llmId: config.configId,
          originalError: factoryError,
        }
      );
    }
  }

  /**
   * Estimates token count for a prompt using gpt-tokenizer.
   * Falls back to a rough word-count if the tokenizer blows up.
   */
  async #estimateTokenCount(promptString, llmConfig) {
    if (!promptString || typeof promptString !== 'string') return 0;

    try {
      // figure out which encoding we need
      const modelName = llmConfig?.modelIdentifier ?? 'gpt-3.5-turbo';
      const encodingName = MODEL_TO_ENCODING[modelName] ?? 'cl100k_base';

      // CL100K encoder is already imported at the top
      let encodeFn = cl100kEncode;

      // lazy-load any other encoder the first time it’s needed
      if (encodingName !== 'cl100k_base') {
        encodeFn = (
          await import(
            /* @vite-ignore */ `gpt-tokenizer/encoding/${encodingName}`
          )
        ).encode;
      }

      return encodeFn(promptString).length;
    } catch (err) {
      this.#logger.warn(
        `Tokenization failed for model '${llmConfig?.modelIdentifier}': ${err.message}`
      );
      return promptString.split(/\s+/).filter(Boolean).length; // crude fallback
    }
  }

  /**
   * Generates an action and speech based on the provided game summary using a configured LLM.
   *
   * @async
   * @param {string} gameSummary - A string providing a summarized representation of the game state.
   * @returns {Promise<string>} A Promise that resolves to a JSON string representing the LLM's decision.
   * @throws {PromptTooLongError | Error | ConfigurationError} If issues occur or the prompt exceeds available space.
   */
  async getAIDecision(gameSummary) {
    // #ensureInitialized will throw if not initialized or not operational.
    await this.#ensureInitialized();

    this.#logger.debug('ConfigurableLLMAdapter.getAIDecision called.', {
      activeLlmId: this.#currentActiveLlmId,
      gameSummaryLength: gameSummary ? gameSummary.length : 0,
    });

    const activeConfig = this.#currentActiveLlmConfig;
    if (!activeConfig) {
      const msg =
        'No active LLM configuration is set. Use setActiveLlm() or ensure a valid defaultConfigId is in the dependencyInjection file.';
      this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
      // Ensure #currentActiveLlmId is used for the llmId in error if activeConfig is null
      throw new ConfigurationError(msg, {
        llmId: this.#currentActiveLlmId || 'unknown',
      });
    }

    try {
      if (this.#environmentContext.isClient()) {
        const llmIdForPromptLog =
          activeConfig.modelIdentifier || activeConfig.configId || 'unknown';
        this.#logger.info(
          `[PromptLog][Model: ${llmIdForPromptLog}] Final assembled prompt being sent to proxy:\n${gameSummary}`
        );
      }

      const validationErrors = this.#validateConfig(activeConfig);
      if (validationErrors.length > 0) {
        const errorDetailsMessage = validationErrors
          .map((err) => `${err.field}: ${err.reason}`)
          .join('; ');
        const msg = `Active LLM config '${activeConfig.configId || 'unknown'}' is invalid: ${errorDetailsMessage}`;
        throw new ConfigurationError(msg, {
          llmId: activeConfig.configId,
          problematicFields: validationErrors,
        });
      }

      const estimatedTokens = await this.#estimateTokenCount(
        gameSummary,
        activeConfig
      );
      this.#logger.info(
        `ConfigurableLLMAdapter.getAIDecision: Estimated prompt token count for LLM '${activeConfig.configId}': ${estimatedTokens}`
      );

      if (
        typeof activeConfig.contextTokenLimit === 'number' &&
        activeConfig.contextTokenLimit > 0
      ) {
        const maxTokensForOutput =
          typeof activeConfig.defaultParameters?.max_tokens === 'number'
            ? activeConfig.defaultParameters.max_tokens
            : 150;
        const promptTokenSpace =
          activeConfig.contextTokenLimit - maxTokensForOutput;
        const warningThreshold = 0.9 * promptTokenSpace;

        if (estimatedTokens >= promptTokenSpace) {
          const msg = `Estimated prompt tokens (${estimatedTokens}) exceed available space (${promptTokenSpace}) for LLM '${activeConfig.configId}'.`;
          this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
          throw new PromptTooLongError(msg, {
            estimatedTokens,
            promptTokenSpace,
            contextTokenLimit: activeConfig.contextTokenLimit,
            maxTokensForOutput,
          });
        } else if (estimatedTokens >= warningThreshold) {
          this.#logger.warn(
            `ConfigurableLLMAdapter.getAIDecision: Estimated prompt token count (${estimatedTokens}) is nearing the limit (${promptTokenSpace}) for LLM '${activeConfig.configId}'.`
          );
        }
      }

      const apiKey = await this.#getApiKeyForConfig(activeConfig);
      const strategy = this.#createStrategy(activeConfig);

      if (!strategy) {
        const msg = `No suitable LLM strategy could be created for the active configuration '${activeConfig.configId}'. Check factory logic and LLM config apiType.`;
        this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`, {
          llmId: activeConfig.configId,
        });
        throw new ConfigurationError(msg, { llmId: activeConfig.configId });
      }

      this.#logger.info(
        `ConfigurableLLMAdapter.getAIDecision: Executing strategy for LLM '${activeConfig.configId}'.`
      );
      return await strategy.execute({
        gameSummary,
        llmConfig: activeConfig,
        apiKey,
        environmentContext: this.#environmentContext,
      });
    } catch (error) {
      const llmIdForLog =
        (activeConfig && activeConfig.configId) ||
        error.llmId ||
        this.#currentActiveLlmId ||
        'unknown'; // Use configId
      const logDetails = { llmId: llmIdForLog, errorName: error.name };

      if (error instanceof ConfigurationError) {
        logDetails.problematicFields =
          error.problematicFields || error.problematicField;
        logDetails.originalErrorMessage = error.originalError
          ? error.originalError.message
          : undefined;
      } else {
        logDetails.errorDetails = {
          message: error.message,
          stack: error.stack,
          ...error,
        };
      }

      if (
        error.name === 'HttpClientError' ||
        Object.prototype.hasOwnProperty.call(error, 'status')
      ) {
        logDetails.status = error.status;
        logDetails.parsedErrorBody = error.responseBody || error.body;
        this.#logger.error(
          `ConfigurableLLMAdapter.getAIDecision: LLM API error for LLM '${llmIdForLog}'. Status: ${error.status}. Message: ${error.message}`,
          logDetails
        );

        const status = error.status;
        if (status === 401) {
          throw new ApiKeyError(error.message, {
            status,
            llmId: llmIdForLog,
            responseBody: logDetails.parsedErrorBody,
          });
        }
        if (status === 402) {
          throw new InsufficientCreditsError(error.message, {
            status,
            llmId: llmIdForLog,
            responseBody: logDetails.parsedErrorBody,
          });
        }
        if (status === 403) {
          const bodyStr = JSON.stringify(
            logDetails.parsedErrorBody || ''
          ).toLowerCase();
          if (bodyStr.includes('policy')) {
            throw new ContentPolicyError(error.message, {
              status,
              llmId: llmIdForLog,
              responseBody: logDetails.parsedErrorBody,
            });
          }
          throw new PermissionError(error.message, {
            status,
            llmId: llmIdForLog,
            responseBody: logDetails.parsedErrorBody,
          });
        }
        if (status === 400) {
          throw new BadRequestError(error.message, {
            status,
            llmId: llmIdForLog,
            responseBody: logDetails.parsedErrorBody,
          });
        }
        throw new LLMInteractionError(error.message, {
          status,
          llmId: llmIdForLog,
          responseBody: logDetails.parsedErrorBody,
        });
      } else {
        this.#logger.error(
          `ConfigurableLLMAdapter.getAIDecision: Error during getAIDecision for LLM '${llmIdForLog}': ${error.message}`,
          logDetails
        );
        if (error.name === 'JsonProcessingError') {
          throw new MalformedResponseError(error.message, {
            llmId: llmIdForLog,
          });
        }
        throw error;
      }
    }
  }

  /**
   * @public
   * @returns {boolean} True if the adapter has attempted initialization (successfully or not), false otherwise.
   */
  isInitialized() {
    return this.#isInitialized;
  }

  /**
   * @public
   * @returns {boolean} True if the adapter has been successfully initialized and is ready for operations, false otherwise.
   */
  isOperational() {
    return this.#isOperational;
  }

  // --- Methods for Testing ---
  /**
   * FOR TESTING ONLY: Retrieves the loaded LLM configurations (the root object).
   *
   * @returns {LLMConfigurationFile | null} The loaded configuration file or null.
   */
  getLoadedConfigs_FOR_TESTING_ONLY() {
    // Return the root configuration object which includes defaultConfigId and the configs map
    return this.#llmRootConfig;
  }

  /**
   * FOR TESTING ONLY: Retrieves the ID of the currently active LLM.
   *
   * @returns {string | null} The active LLM ID or null.
   */
  getActiveLlmId_FOR_TESTING_ONLY() {
    return this.#currentActiveLlmId;
  }

  /**
   * FOR TESTING ONLY: Retrieves the execution environment string.
   *
   * @returns {string} The current execution environment.
   */
  getExecutionEnvironment_FOR_TESTING_ONLY() {
    return this.#environmentContext
      ? this.#environmentContext.getExecutionEnvironment()
      : 'unknown';
  }

  /**
   * FOR TESTING ONLY: Retrieves the project root path from environment context.
   *
   * @returns {string | null} The project root path.
   */
  getProjectRootPath_FOR_TESTING_ONLY() {
    return this.#environmentContext
      ? this.#environmentContext.getProjectRootPath()
      : null;
  }

  /**
   * FOR TESTING ONLY: Retrieves the proxy server URL from environment context.
   *
   * @returns {string} The proxy server URL.
   */
  getProxyServerUrl_FOR_TESTING_ONLY() {
    return this.#environmentContext
      ? this.#environmentContext.getProxyServerUrl()
      : '';
  }

  /**
   * FOR TESTING ONLY: Retrieves the EnvironmentContext instance.
   *
   * @returns {EnvironmentContext | null} The environment context instance.
   */
  getEnvironmentContext_FOR_TESTING_ONLY() {
    return this.#environmentContext;
  }

  /**
   * FOR TESTING ONLY: Retrieves the IApiKeyProvider instance.
   *
   * @returns {IApiKeyProvider | null} The API key provider in use.
   */
  getApiKeyProvider_FOR_TESTING_ONLY() {
    return this.#apiKeyProvider;
  }

  /**
   * FOR TESTING ONLY: Retrieves the LLMStrategyFactory instance.
   *
   * @returns {LLMStrategyFactory | null} The strategy factory instance.
   */
  getLlmStrategyFactory_FOR_TESTING_ONLY() {
    return this.#llmStrategyFactory;
  }

  /**
   * FOR TESTING ONLY: Exposes the private #estimateTokenCount method.
   *
   * @param {string} promptString - Prompt to estimate.
   * @param {LLMModelConfig} llmConfig - Configuration used for estimation.
   * @returns {number} Estimated token count.
   */
  async estimateTokenCount_FOR_TESTING_ONLY(promptString, llmConfig) {
    return await this.#estimateTokenCount(promptString, llmConfig);
  }
}

// --- FILE END ---
