/**
 * @file LLM configuration management service implementation
 * @see src/llms/services/llmConfigurationManager.js
 */

import { ILLMConfigurationManager } from '../interfaces/ILLMConfigurationManager.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { assertNonBlankString } from '../../utils/dependencyUtils.js';
import { LLMSelectionPersistence } from './llmSelectionPersistence.js';

/**
 * @typedef {import('../services/llmConfigLoader.js').LlmConfigLoader} LlmConfigLoader
 * @typedef {import('../services/llmConfigLoader.js').LoadConfigsErrorResult} LoadConfigsErrorResult
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {object} LLMModelConfig
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
 * @property {string} [comment] - Optional: Human-readable notes about this configuration (e.g., roleplaying strengths).
 * @property {Array<{key: string, prefix: string, suffix: string}>} promptElements - Defines named prompt parts.
 * @property {string[]} promptAssemblyOrder - Ordered list of 'promptElements' keys.
 * @property {number} [contextTokenLimit] - Optional: Maximum context tokens for the model.
 * @typedef {object} LLMConfigurationFile
 * @property {string} defaultConfigId - The ID of the default LLM configuration to use.
 * @property {{[key: string]: LLMModelConfig}} configs - A map of LLM configurations, where each key is a configId.
 */

/**
 * @class LLMConfigurationManager
 * @implements {ILLMConfigurationManager}
 * @description Manages LLM configurations including loading, validation, and selection
 */
export class LLMConfigurationManager extends ILLMConfigurationManager {
  #logger;
  #configLoader;
  #isInitialized = false;
  #isOperational = false;
  #initPromise = null;
  #llmRootConfig = null;
  #defaultConfigId = null;
  #allConfigsMap = null;
  #currentActiveConfigId = null;
  #currentActiveConfig = null;
  #initialLlmId = null;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {string} [dependencies.initialLlmId] - Initial LLM ID to activate
   */
  constructor({ logger, initialLlmId = null }) {
    super();
    validateDependency(logger, 'ILogger');
    this.#logger = logger;

    if (initialLlmId !== null && typeof initialLlmId !== 'string') {
      this.#logger.warn(
        `LLMConfigurationManager: Invalid initialLlmId type (expected string or null). Received: ${typeof initialLlmId}. Ignoring.`
      );
      this.#initialLlmId = null;
    } else if (initialLlmId && initialLlmId.trim() === '') {
      this.#logger.warn(
        `LLMConfigurationManager: Empty string for initialLlmId. Treating as null.`
      );
      this.#initialLlmId = null;
    } else {
      this.#initialLlmId = initialLlmId;
    }

    this.#logger.debug(
      `LLMConfigurationManager: Instance created. Initial LLM ID: '${this.#initialLlmId || 'not set'}'.`
    );
  }

  /**
   * Initializes the configuration manager
   *
   * @param {object} initParams
   * @param {LlmConfigLoader} initParams.llmConfigLoader - Configuration loader
   * @returns {Promise<void>}
   */
  async init({ llmConfigLoader }) {
    if (this.#isInitialized && this.#isOperational) {
      this.#logger.debug(
        'LLMConfigurationManager: Already initialized and operational.'
      );
      return this.#initPromise;
    }

    if (this.#isInitialized && !this.#isOperational) {
      const errorMsg =
        'LLMConfigurationManager: Cannot re-initialize after critical configuration loading failure.';
      this.#logger.error(errorMsg);
      return Promise.reject(new Error(errorMsg));
    }

    if (this.#initPromise) {
      this.#logger.debug(
        'LLMConfigurationManager: Initialization already in progress.'
      );
      return this.#initPromise;
    }

    if (!llmConfigLoader || typeof llmConfigLoader.loadConfigs !== 'function') {
      const errorMsg =
        'LLMConfigurationManager: Initialization requires valid LlmConfigLoader instance.';
      this.#logger.error(errorMsg);
      this.#isInitialized = true;
      this.#isOperational = false;
      throw new Error(errorMsg);
    }

    this.#initPromise = this.#performInitialization(llmConfigLoader);
    return this.#initPromise;
  }

  async #performInitialization(llmConfigLoader) {
    this.#configLoader = llmConfigLoader;
    this.#logger.debug(
      'LLMConfigurationManager: Starting asynchronous initialization.'
    );

    try {
      const configResult = await this.#configLoader.loadConfigs();

      if (configResult?.error === true) {
        const loadError = /** @type {LoadConfigsErrorResult} */ (configResult);
        this.#logger.error(
          'LLMConfigurationManager: Critical error loading configurations.',
          {
            message: loadError.message,
            stage: loadError.stage,
            path: loadError.path,
            originalError: loadError.originalError?.message || 'N/A',
          }
        );
      } else if (
        configResult &&
        typeof configResult.configs === 'object' &&
        configResult.configs !== null &&
        typeof configResult.defaultConfigId === 'string'
      ) {
        this.#llmRootConfig = /** @type {LLMConfigurationFile} */ (
          configResult
        );
        this.#defaultConfigId = this.#llmRootConfig.defaultConfigId;
        this.#allConfigsMap = this.#llmRootConfig.configs;

        this.#logger.debug(
          'LLMConfigurationManager: Configurations loaded successfully.',
          {
            numberOfConfigs: Object.keys(this.#allConfigsMap).length,
            defaultConfigId: this.#defaultConfigId || 'Not set',
          }
        );
        this.#isOperational = true;
        this.#selectInitialActiveConfig();
      } else {
        this.#logger.error(
          'LLMConfigurationManager: Configuration loading returned unexpected structure.',
          { configResult }
        );
      }
    } catch (error) {
      this.#logger.error(
        'LLMConfigurationManager: Exception during configuration loading.',
        {
          errorMessage: error.message,
          errorStack: error.stack,
        }
      );
      this.#isOperational = false;
      this.#isInitialized = true;
      throw error;
    }

    this.#isInitialized = true;
    if (!this.#isOperational) {
      this.#logger.warn(
        'LLMConfigurationManager: Initialization complete but NON-OPERATIONAL.'
      );
    } else {
      this.#logger.debug(
        'LLMConfigurationManager: Initialization complete and operational.'
      );
    }
  }

  #selectInitialActiveConfig() {
    let configSelected = false;

    // Priority 1: initialLlmId from constructor
    if (this.#initialLlmId && this.#initialLlmId.trim() !== '') {
      const targetConfig = this.#allConfigsMap[this.#initialLlmId];
      if (targetConfig) {
        this.#currentActiveConfigId = this.#initialLlmId;
        this.#currentActiveConfig = targetConfig;
        this.#logger.debug(
          `LLMConfigurationManager: Config '${this.#currentActiveConfigId}' set as active from initialLlmId.`
        );
        configSelected = true;
        // Save the selection to persistence
        LLMSelectionPersistence.save(this.#currentActiveConfigId);
      } else {
        this.#logger.warn(
          `LLMConfigurationManager: initialLlmId '${this.#initialLlmId}' not found. Falling back to persisted or default.`
        );
      }
    }

    // Priority 2: persisted selection from localStorage
    if (!configSelected) {
      let persistedLlmId = LLMSelectionPersistence.load();

      // MIGRATION: Update old Claude Sonnet 4 ID to new 4.5 ID
      if (persistedLlmId === 'openrouter-claude-sonnet-4-toolcalling') {
        this.#logger.info(
          `LLMConfigurationManager: Migrating persisted LLM from 'openrouter-claude-sonnet-4-toolcalling' to 'claude-sonnet-4.5'`
        );
        persistedLlmId = 'claude-sonnet-4.5';
        LLMSelectionPersistence.save(persistedLlmId);
      }

      if (persistedLlmId) {
        const targetConfig = this.#allConfigsMap[persistedLlmId];
        if (targetConfig) {
          this.#currentActiveConfigId = persistedLlmId;
          this.#currentActiveConfig = targetConfig;
          this.#logger.debug(
            `LLMConfigurationManager: Config '${this.#currentActiveConfigId}' set as active from persisted selection.`
          );
          configSelected = true;
        } else {
          this.#logger.warn(
            `LLMConfigurationManager: Persisted LLM ID '${persistedLlmId}' not found in current configs. Clearing persistence.`
          );
          LLMSelectionPersistence.clear();
        }
      }
    }

    // Priority 3: defaultConfigId from configuration file
    if (
      !configSelected &&
      this.#defaultConfigId &&
      this.#defaultConfigId.trim() !== ''
    ) {
      const targetConfig = this.#allConfigsMap[this.#defaultConfigId];
      if (targetConfig) {
        this.#currentActiveConfigId = this.#defaultConfigId;
        this.#currentActiveConfig = targetConfig;
        this.#logger.debug(
          `LLMConfigurationManager: Config '${this.#currentActiveConfigId}' set as active from defaultConfigId.`
        );
        configSelected = true;
        // Save the default selection to persistence
        LLMSelectionPersistence.save(this.#currentActiveConfigId);
      } else {
        this.#logger.warn(
          `LLMConfigurationManager: defaultConfigId '${this.#defaultConfigId}' not found in configs.`
        );
      }
    }

    if (!configSelected) {
      this.#currentActiveConfigId = null;
      this.#currentActiveConfig = null;
      if (Object.keys(this.#allConfigsMap).length === 0) {
        this.#logger.warn('LLMConfigurationManager: No configurations found.');
      } else {
        this.#logger.warn(
          'LLMConfigurationManager: No default configuration set.'
        );
      }
    }
  }

  async #ensureInitialized() {
    if (!this.#initPromise) {
      const msg =
        'LLMConfigurationManager: Not initialized. Call init() first.';
      this.#logger.error(msg);
      throw new Error(msg);
    }
    await this.#initPromise;

    if (!this.#isOperational) {
      const msg = 'LLMConfigurationManager: Initialized but not operational.';
      this.#logger.error(msg);
      throw new Error(msg);
    }
  }

  /**
   * @async
   * @param {string} configId
   * @returns {Promise<LLMModelConfig|null>}
   */
  async loadConfiguration(configId) {
    await this.#ensureInitialized();
    assertNonBlankString(
      configId,
      'configId',
      'LLMConfigurationManager.loadConfiguration',
      this.#logger
    );

    const config = this.#allConfigsMap[configId];
    if (config) {
      this.#logger.debug(
        `LLMConfigurationManager: Configuration '${configId}' loaded.`
      );
      return config;
    }

    this.#logger.warn(
      `LLMConfigurationManager: Configuration '${configId}' not found.`
    );
    return null;
  }

  /**
   * @async
   * @returns {Promise<LLMModelConfig|null>}
   */
  async getActiveConfiguration() {
    await this.#ensureInitialized();

    if (!this.#currentActiveConfig) {
      this.#logger.debug(
        'LLMConfigurationManager: No active configuration set.'
      );
      return null;
    }
    return this.#currentActiveConfig;
  }

  /**
   * @async
   * @param {string} configId
   * @returns {Promise<boolean>}
   */
  async setActiveConfiguration(configId) {
    await this.#ensureInitialized();

    if (typeof configId !== 'string' || configId.trim() === '') {
      this.#logger.error(
        `LLMConfigurationManager: Invalid configId (must be non-empty string). Received: '${configId}'.`
      );
      return false;
    }

    const targetConfig = this.#allConfigsMap[configId];
    if (targetConfig) {
      const oldConfigId = this.#currentActiveConfigId;
      this.#currentActiveConfigId = configId;
      this.#currentActiveConfig = targetConfig;
      this.#logger.debug(
        `LLMConfigurationManager: Active config changed from '${oldConfigId || 'none'}' to '${configId}'.`
      );

      // Persist the new selection
      const saved = LLMSelectionPersistence.save(configId);
      if (!saved) {
        this.#logger.warn(
          `LLMConfigurationManager: Failed to persist LLM selection '${configId}' to localStorage.`
        );
      }

      return true;
    }

    this.#logger.error(
      `LLMConfigurationManager: Configuration '${configId}' not found. Active config unchanged.`
    );
    return false;
  }

  /**
   * @param {LLMModelConfig} config
   * @returns {Array<{field: string, reason: string}>}
   */
  validateConfiguration(config) {
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
        (!jos.toolName ||
          typeof jos.toolName !== 'string' ||
          jos.toolName.trim() === '')
      ) {
        errors.push({
          field: 'jsonOutputStrategy.toolName',
          reason: 'Required when jsonOutputStrategy.method is "tool_calling".',
        });
      } else if (
        method === 'gbnf_grammar' &&
        (!jos.grammar ||
          typeof jos.grammar !== 'string' ||
          jos.grammar.trim() === '')
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
   * @async
   * @returns {Promise<LLMConfigurationFile|null>}
   */
  async getAllConfigurations() {
    await this.#ensureInitialized();
    return this.#llmRootConfig;
  }

  /**
   * @async
   * @returns {Promise<Array<{configId: string, displayName: string}>>}
   */
  async getAvailableOptions() {
    try {
      await this.#ensureInitialized();
    } catch (error) {
      this.#logger.warn(
        `LLMConfigurationManager: Not operational. Cannot retrieve options. Error: ${error.message}`
      );
      return [];
    }

    const configsArray = Object.values(this.#allConfigsMap);
    if (configsArray.length === 0) {
      this.#logger.warn('LLMConfigurationManager: No configurations found.');
      return [];
    }

    return configsArray.map((config) => ({
      configId: config.configId,
      displayName: config.displayName || config.configId,
    }));
  }

  /**
   * @async
   * @returns {Promise<string|null>}
   */
  async getActiveConfigId() {
    try {
      await this.#ensureInitialized();
    } catch (error) {
      this.#logger.warn(
        `LLMConfigurationManager: Not operational. Cannot retrieve active config ID. Error: ${error.message}`
      );
      return null;
    }
    return this.#currentActiveConfigId;
  }

  // Methods for operational status
  isInitialized() {
    return this.#isInitialized;
  }

  isOperational() {
    return this.#isOperational;
  }
}

export default LLMConfigurationManager;
