/**
 * @file Refactored ConfigurableLLMAdapter using modular services
 * @see src/turns/adapters/configurableLLMAdapter.js
 */

import { ILLMAdapter } from '../interfaces/ILLMAdapter.js';
import { CLOUD_API_TYPES } from '../../llms/constants/llmConstants.js';
import PromptTooLongError from '../../errors/promptTooLongError.js';
import { ConfigurationError } from '../../errors/configurationError.js';

/**
 * @typedef {import('../../llms/interfaces/ILLMConfigurationManager.js').ILLMConfigurationManager} ILLMConfigurationManager
 * @typedef {import('../../llms/interfaces/ILLMRequestExecutor.js').ILLMRequestExecutor} ILLMRequestExecutor
 * @typedef {import('../../llms/interfaces/ILLMErrorMapper.js').ILLMErrorMapper} ILLMErrorMapper
 * @typedef {import('../../llms/interfaces/ITokenEstimator.js').ITokenEstimator} ITokenEstimator
 * @typedef {import('../../llms/services/llmConfigLoader.js').LlmConfigLoader} LlmConfigLoader
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../llms/environmentContext.js').EnvironmentContext} EnvironmentContext
 * @typedef {import('../../llms/interfaces/IApiKeyProvider.js').IApiKeyProvider} IApiKeyProvider
 * @typedef {import('../../llms/LLMStrategyFactory.js').LLMStrategyFactory} LLMStrategyFactory
 */

/**
 * @class ConfigurableLLMAdapter
 * @implements {ILLMAdapter}
 * @description Refactored adapter using modular services for better maintainability
 */
class ConfigurableLLMAdapter extends ILLMAdapter {
  // --- Private Fields ---
  #logger;
  #environmentContext;
  #apiKeyProvider;
  #llmStrategyFactory;
  #configurationManager;
  #requestExecutor;
  #errorMapper;
  #tokenEstimator;
  #initialLlmId = null;
  #isInitialized = false;
  #isOperational = true; // Start as operational, becomes false on init failures

  /**
   * Creates an instance of ConfigurableLLMAdapter.
   *
   * @param {object} dependencies - The dependencies for this adapter.
   * @param {ILogger} dependencies.logger - A logger instance.
   * @param {EnvironmentContext} dependencies.environmentContext - An EnvironmentContext instance.
   * @param {IApiKeyProvider} dependencies.apiKeyProvider - An IApiKeyProvider instance.
   * @param {LLMStrategyFactory} dependencies.llmStrategyFactory - An LLMStrategyFactory instance.
   * @param {ILLMConfigurationManager} dependencies.configurationManager - Configuration manager instance.
   * @param {ILLMRequestExecutor} dependencies.requestExecutor - Request executor instance.
   * @param {ILLMErrorMapper} dependencies.errorMapper - Error mapper instance.
   * @param {ITokenEstimator} dependencies.tokenEstimator - Token estimator instance.
   * @param {string} [dependencies.initialLlmId] - Optional. The ID of the LLM to activate initially.
   * @throws {Error} If any critical dependency is missing or invalid.
   */
  constructor({
    logger,
    environmentContext,
    apiKeyProvider,
    llmStrategyFactory,
    configurationManager,
    requestExecutor,
    errorMapper,
    tokenEstimator,
    initialLlmId = null,
  }) {
    super();

    if (!logger || typeof logger.error !== 'function') {
      const errorMsg =
        'ConfigurableLLMAdapter: Constructor requires a valid ILogger instance.';
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

    // Validate new service dependencies
    if (
      !configurationManager ||
      typeof configurationManager.getActiveConfiguration !== 'function'
    ) {
      const errorMsg =
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMConfigurationManager instance.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#configurationManager = configurationManager;

    if (
      !requestExecutor ||
      typeof requestExecutor.executeRequest !== 'function'
    ) {
      const errorMsg =
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMRequestExecutor instance.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#requestExecutor = requestExecutor;

    if (!errorMapper || typeof errorMapper.mapHttpError !== 'function') {
      const errorMsg =
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMErrorMapper instance.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#errorMapper = errorMapper;

    if (
      !tokenEstimator ||
      typeof tokenEstimator.estimateTokens !== 'function'
    ) {
      const errorMsg =
        'ConfigurableLLMAdapter: Constructor requires a valid ITokenEstimator instance.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#tokenEstimator = tokenEstimator;

    // Validate and store initialLlmId
    if (initialLlmId !== null && typeof initialLlmId !== 'string') {
      this.#logger.warn(
        `Constructor received an invalid type for initialLlmId (expected string or null). Received: ${typeof initialLlmId}. Ignoring.`
      );
      this.#initialLlmId = null;
    } else if (initialLlmId !== null && initialLlmId.trim() === '') {
      this.#logger.warn(
        'Constructor received an empty string for initialLlmId. It will be treated as if no initialLlmId was provided.'
      );
      this.#initialLlmId = null;
    } else {
      this.#initialLlmId = initialLlmId;
    }

    this.#logger.debug(
      `ConfigurableLLMAdapter: Instance created. Execution environment: ${this.#environmentContext.getExecutionEnvironment()}. Ready for initialization.`
    );
  }

  /**
   * Asynchronously initializes the ConfigurableLLMAdapter.
   *
   * @param {object} initParams - Parameters for initialization.
   * @param {LlmConfigLoader} initParams.llmConfigLoader - An instance of LlmConfigLoader.
   * @returns {Promise<void>} A promise that resolves when initialization is complete.
   * @throws {Error} If initialization fails.
   */
  async init({ llmConfigLoader }) {
    if (this.#isInitialized) {
      this.#logger.debug(
        'ConfigurableLLMAdapter: Already initialized. Skipping re-initialization.'
      );
      return;
    }

    // Validate llmConfigLoader parameter
    if (!llmConfigLoader || typeof llmConfigLoader.loadConfigs !== 'function') {
      const errorMsg =
        'ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.';
      this.#logger.error(errorMsg, { providedLoader: llmConfigLoader });
      this.#isInitialized = true;
      this.#isOperational = false;
      throw new Error(errorMsg);
    }

    this.#logger.debug('ConfigurableLLMAdapter: Starting initialization.');

    try {
      // Initialize configuration manager with initialLlmId
      await this.#configurationManager.init({
        llmConfigLoader,
        initialLlmId: this.#initialLlmId,
      });
      this.#isInitialized = true;

      this.#logger.debug('ConfigurableLLMAdapter: Initialization complete.');
    } catch (error) {
      this.#logger.error('ConfigurableLLMAdapter: Initialization failed.', {
        errorMessage: error.message,
        errorStack: error.stack,
      });
      this.#isInitialized = true;
      this.#isOperational = false;
      throw error;
    }
  }

  /**
   * Sets the active LLM configuration by its ID.
   *
   * @param {string} llmId - The ID of the LLM configuration to set as active.
   * @returns {Promise<boolean>} True if the LLM configuration was successfully set as active, false otherwise.
   * @throws {Error} If the adapter is not initialized.
   */
  async setActiveLlm(llmId) {
    this.#ensureInitialized();
    return await this.#configurationManager.setActiveConfiguration(llmId);
  }

  /**
   * Retrieves the full configuration object for the currently active LLM.
   *
   * @returns {Promise<object | null>} The active LLM configuration object, or null if no LLM is active.
   * @throws {Error} If the adapter is not initialized.
   */
  async getCurrentActiveLlmConfig() {
    this.#ensureInitialized();
    return await this.#configurationManager.getActiveConfiguration();
  }

  /**
   * Retrieves a list of available LLM configurations for UI selection.
   *
   * @returns {Promise<Array<{configId: string, displayName: string}>>} Array of LLM options.
   */
  async getAvailableLlmOptions() {
    try {
      this.#ensureInitialized();
      return await this.#configurationManager.getAvailableOptions();
    } catch (error) {
      this.#logger.warn(
        `ConfigurableLLMAdapter.getAvailableLlmOptions: Error retrieving options. Error: ${error.message}`
      );
      return [];
    }
  }

  /**
   * Retrieves the ID of the currently active LLM.
   *
   * @returns {Promise<string | null>} The active LLM ID or null.
   */
  async getCurrentActiveLlmId() {
    try {
      this.#ensureInitialized();
      return await this.#configurationManager.getActiveConfigId();
    } catch (error) {
      this.#logger.warn(
        `ConfigurableLLMAdapter.getCurrentActiveLlmId: Error retrieving ID. Error: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Generates an action (and optional speech) from the active LLM.
   *
   * @async
   * @param {string} gameSummary – Fully-assembled prompt string.
   * @param {AbortSignal=} abortSignal – Optional cancellation signal.
   * @param {object} [requestOptions] - Optional request-specific options
   * @param {object} [requestOptions.toolSchema] - Custom tool schema for this request
   * @param {string} [requestOptions.toolName] - Custom tool name for this request
   * @param {string} [requestOptions.toolDescription] - Custom tool description for this request
   * @returns {Promise<string>} – Raw JSON returned by the LLM.
   * @throws {ConfigurationError|PromptTooLongError|Error}
   */
  async getAIDecision(
    gameSummary,
    abortSignal = undefined,
    requestOptions = {}
  ) {
    this.#ensureInitialized();

    // Validate request options
    this.#validateRequestOptions(requestOptions);

    this.#logger.debug('ConfigurableLLMAdapter.getAIDecision → called', {
      promptChars: gameSummary ? gameSummary.length : 0,
      abortSignalProvided: !!abortSignal,
      hasRequestOptions: Object.keys(requestOptions).length > 0,
      hasCustomSchema: !!requestOptions.toolSchema,
    });

    // Get active configuration
    const activeConfig =
      await this.#configurationManager.getActiveConfiguration();
    if (!activeConfig) {
      const msg =
        'No active LLM configuration is set. Use setActiveLlm() or ensure a valid defaultConfigId is in the dependencyInjection file.';
      this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
      throw new ConfigurationError(msg, { llmId: null });
    }

    // Browser-side prompt logging
    try {
      if (this.#environmentContext.isClient()) {
        const modelName =
          activeConfig.modelIdentifier || activeConfig.configId || 'unknown';
        this.#logger.info(
          `[PromptLog][Model: ${modelName}] Final prompt sent to proxy:\n${gameSummary}`
        );
      }
    } catch {
      /* never block on logging */
    }

    try {
      // Validate configuration
      const validationErrors =
        this.#configurationManager.validateConfiguration(activeConfig);
      if (validationErrors.length > 0) {
        const errDetails = validationErrors
          .map((e) => `${e.field}: ${e.reason}`)
          .join('; ');
        const msg = `Active LLM config '${activeConfig.configId || 'unknown'}' is invalid: ${errDetails}`;
        throw new ConfigurationError(msg, {
          llmId: activeConfig.configId,
          problematicFields: validationErrors,
        });
      }

      // Token validation
      await this.#validateTokenLimit(gameSummary, activeConfig);

      // Get API key
      const apiKey = await this.#getApiKeyForConfig(activeConfig);

      // Get strategy
      const strategy = this.#createStrategy(activeConfig);
      if (!strategy) {
        const msg = `No suitable LLM strategy could be created for the active configuration '${activeConfig.configId}'. Check factory logic and LLM config apiType.`;
        throw new ConfigurationError(msg, { llmId: activeConfig.configId });
      }

      // Execute request
      const result = await this.#requestExecutor.executeRequest({
        strategy,
        gameSummary,
        llmConfig: activeConfig,
        apiKey,
        environmentContext: this.#environmentContext,
        abortSignal,
        requestOptions, // NEW: Pass request options through
      });

      return result;
    } catch (error) {
      // Map error and re-throw
      const context = {
        llmId: activeConfig?.configId || 'unknown',
        operation: 'getAIDecision',
      };

      this.#errorMapper.logError(error, context);
      const mappedError = this.#errorMapper.mapHttpError(error, context);
      throw mappedError;
    }
  }

  /**
   * @private
   * @param {object} requestOptions - Request options to validate
   * @throws {Error} If request options are invalid
   */
  #validateRequestOptions(requestOptions) {
    if (!requestOptions) return; // Optional parameter

    if (
      Object.prototype.hasOwnProperty.call(requestOptions, 'toolSchema') &&
      typeof requestOptions.toolSchema !== 'object'
    ) {
      throw new Error('toolSchema must be an object');
    }

    if (
      Object.prototype.hasOwnProperty.call(requestOptions, 'toolName') &&
      typeof requestOptions.toolName !== 'string'
    ) {
      throw new Error('toolName must be a string');
    }

    if (
      Object.prototype.hasOwnProperty.call(requestOptions, 'toolDescription') &&
      typeof requestOptions.toolDescription !== 'string'
    ) {
      throw new Error('toolDescription must be a string');
    }
  }

  /**
   * @private
   * @description Ensures the adapter is initialized.
   * @throws {Error} If not initialized.
   */
  #ensureInitialized() {
    if (!this.#isInitialized) {
      const msg =
        'ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter.';
      this.#logger.error(msg);
      throw new Error(msg);
    }

    if (!this.isOperational()) {
      const msg =
        'ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.';
      this.#logger.error(msg);
      throw new Error(msg);
    }
  }

  /**
   * @private
   * @async
   * @param {string} gameSummary
   * @param {object} activeConfig
   * @throws {PromptTooLongError}
   */
  async #validateTokenLimit(gameSummary, activeConfig) {
    if (
      typeof activeConfig.contextTokenLimit === 'number' &&
      activeConfig.contextTokenLimit > 0
    ) {
      const maxTokensForOutput =
        typeof activeConfig.defaultParameters?.max_tokens === 'number'
          ? activeConfig.defaultParameters.max_tokens
          : 150;

      const tokenBudget = this.#tokenEstimator.getTokenBudget(
        activeConfig.contextTokenLimit,
        maxTokensForOutput
      );

      const validationResult = await this.#tokenEstimator.validateTokenLimit(
        gameSummary,
        tokenBudget.availableForPrompt,
        activeConfig.modelIdentifier
      );

      if (!validationResult.isValid) {
        this.#logger.error(
          `Estimated prompt tokens (${validationResult.estimatedTokens}) exceed available space (${tokenBudget.availableForPrompt}) for LLM '${activeConfig.configId}'.`
        );
        throw new PromptTooLongError(
          `Estimated prompt tokens (${validationResult.estimatedTokens}) exceed available space (${tokenBudget.availableForPrompt}) for LLM '${activeConfig.configId}'.`,
          {
            estimatedTokens: validationResult.estimatedTokens,
            promptTokenSpace: tokenBudget.availableForPrompt,
            contextTokenLimit: activeConfig.contextTokenLimit,
            maxTokensForOutput,
          }
        );
      } else if (validationResult.isNearLimit) {
        this.#logger.warn(
          `Estimated prompt token count (${validationResult.estimatedTokens}) is nearing the limit (${tokenBudget.availableForPrompt}) for LLM '${activeConfig.configId}'.`
        );
      }
    }
  }

  /**
   * @private
   * @async
   * @param {object} config
   * @returns {Promise<string | undefined>}
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
    } else {
      this.#logger.debug(
        `API key not required or not found for LLM '${config.configId}', proceeding. (Is Cloud API: ${isCloudApi}, Is Server: ${this.#environmentContext.isServer()})`
      );
    }

    return apiKey;
  }

  /**
   * @private
   * @param {object} config
   * @returns {object}
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

  // --- Methods for backward compatibility and testing ---

  /**
   * @public
   * @returns {boolean} True if the adapter has been initialized.
   */
  isInitialized() {
    return this.#isInitialized;
  }

  /**
   * @public
   * @returns {boolean} True if the adapter is operational.
   */
  isOperational() {
    return this.#isOperational && this.#configurationManager
      ? this.#configurationManager.isOperational()
      : this.#isOperational;
  }

  // --- Methods for Testing ---
  /**
   * FOR TESTING ONLY: Retrieves the loaded LLM configurations.
   *
   * @returns {Promise<object | null>} The loaded configuration file or null.
   */
  async getLoadedConfigs_FOR_TESTING_ONLY() {
    if (!this.#configurationManager) return null;
    try {
      return await this.#configurationManager.getAllConfigurations();
    } catch (error) {
      return null;
    }
  }

  /**
   * FOR TESTING ONLY: Retrieves the ID of the currently active LLM.
   *
   * @returns {string | null} The active LLM ID or null.
   */
  getActiveLlmId_FOR_TESTING_ONLY() {
    if (!this.#configurationManager) return null;
    try {
      const result = this.#configurationManager.getActiveConfigId();
      // Handle both Promise and non-Promise returns for backward compatibility
      if (result && typeof result.then === 'function') {
        return result.then((id) => id).catch(() => null);
      }
      return result;
    } catch (error) {
      return null;
    }
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
   * @returns {object | null} The environment context instance.
   */
  getEnvironmentContext_FOR_TESTING_ONLY() {
    return this.#environmentContext;
  }

  /**
   * FOR TESTING ONLY: Retrieves the IApiKeyProvider instance.
   *
   * @returns {object | null} The API key provider in use.
   */
  getApiKeyProvider_FOR_TESTING_ONLY() {
    return this.#apiKeyProvider;
  }

  /**
   * FOR TESTING ONLY: Retrieves the LLMStrategyFactory instance.
   *
   * @returns {object | null} The strategy factory instance.
   */
  getLlmStrategyFactory_FOR_TESTING_ONLY() {
    return this.#llmStrategyFactory;
  }

  /**
   * FOR TESTING ONLY: Exposes the private token estimation method.
   *
   * @param {string} promptString - Prompt to estimate.
   * @param {object} llmConfig - Configuration used for estimation.
   * @returns {Promise<number>} Estimated token count.
   */
  async estimateTokenCount_FOR_TESTING_ONLY(promptString, llmConfig) {
    return await this.#tokenEstimator.estimateTokens(
      promptString,
      llmConfig?.modelIdentifier
    );
  }
}

export { ConfigurableLLMAdapter };
