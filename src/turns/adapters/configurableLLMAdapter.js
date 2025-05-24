// src/turns/adapters/configurableLLMAdapter.js
// --- FILE START ---

import {ILLMAdapter} from '../interfaces/ILLMAdapter.js';
// getApiKeyFromFileSystem import removed as per Ticket 21
// import {getApiKeyFromFile as getApiKeyFromFileSystem} from '../../utils/apiKeyFileRetriever.js';

// Base strategy imports are removed as they are no longer directly used here.
// Strategies are now handled by LLMStrategyFactory.

import {
    CLOUD_API_TYPES, // Added import for CLOUD_API_TYPES
    DEFAULT_FALLBACK_ACTION_JSON_STRING, // Kept in case of future use, though not directly by refactored getAIDecision
} from "../../llms/constants/llmConstants.js";


/**
 * @typedef {import('../../services/llmConfigLoader.js').LlmConfigLoader} LlmConfigLoader
 * @typedef {import('../../services/llmConfigLoader.js').LLMConfigurationFile} LLMConfigurationFile
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../../services/llmConfigLoader.js').LoadConfigsErrorResult} LoadConfigsErrorResult
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../schemas/llmOutputSchemas.js').LLM_TURN_ACTION_SCHEMA} LLM_TURN_ACTION_SCHEMA_TYPE
 * @typedef {import('../../llms/environmentContext.js').EnvironmentContext} EnvironmentContext
 * @typedef {import('../../llms/interfaces/IApiKeyProvider.js').IApiKeyProvider} IApiKeyProvider
 * @typedef {import('../../llms/LLMStrategyFactory.js').LLMStrategyFactory} LLMStrategyFactory
 * @typedef {import('../../llms/interfaces/ILLMStrategy.js').ILLMStrategy} ILLMStrategy
 */


/**
 * Custom error class for configuration-related issues within the ConfigurableLLMAdapter.
 */
export class ConfigurationError extends Error {
    /**
     * Creates an instance of ConfigurationError.
     * @param {string} message - The error message.
     * @param {object} [details] - Additional details about the error.
     * @param {string} [details.llmId] - The ID of the LLM configuration that caused the error.
     * @param {string | string[]} [details.problematicField] - The name(s) of the configuration field(s) that are problematic.
     * @param {any} [details.fieldValue] - The value of the problematic field.
     * @param {object[]} [details.problematicFields] - Array of problematic fields {field, reason}.
     */
    constructor(message, details = {}) {
        super(message);
        this.name = "ConfigurationError";
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
 * manages the active LLM configuration.
 */
export class ConfigurableLLMAdapter extends ILLMAdapter {
    /**
     * @private
     * @type {ILogger}
     */
    #logger;

    /**
     * @private
     * @type {EnvironmentContext}
     */
    #environmentContext;

    /**
     * @private
     * @type {IApiKeyProvider}
     */
    #apiKeyProvider;

    /**
     * @private
     * @type {LLMStrategyFactory}
     */
    #llmStrategyFactory;

    /**
     * @private
     * @type {LlmConfigLoader | null}
     */
    #configLoader = null;

    /**
     * @private
     * @type {LLMConfigurationFile | null}
     */
    #llmConfigs = null;

    /**
     * @private
     * @type {boolean}
     * @description Indicates if the adapter has been successfully initialized.
     */
    #isInitialized = false;

    /**
     * @private
     * @type {boolean}
     * @description Indicates if the adapter is in an operational state.
     * Set to false if critical initialization (like config loading) fails.
     */
    #isOperational = false;

    /**
     * @private
     * @type {string | null}
     * @description The ID of the currently active LLM configuration.
     */
    #currentActiveLlmId = null;

    /**
     * @private
     * @type {LLMModelConfig | null}
     * @description The currently active LLM configuration object.
     */
    #currentActiveLlmConfig = null;


    /**
     * Creates an instance of ConfigurableLLMAdapter.
     * @param {object} dependencies - The dependencies for this adapter.
     * @param {ILogger} dependencies.logger - A logger instance.
     * @param {EnvironmentContext} dependencies.environmentContext - An EnvironmentContext instance.
     * @param {IApiKeyProvider} dependencies.apiKeyProvider - An IApiKeyProvider instance.
     * @param {LLMStrategyFactory} dependencies.llmStrategyFactory - An LLMStrategyFactory instance.
     * @throws {Error} If any critical dependency is missing or invalid.
     */
    constructor({logger, environmentContext, apiKeyProvider, llmStrategyFactory}) {
        super();

        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            const errorMsg = 'ConfigurableLLMAdapter: Constructor requires a valid ILogger instance.';
            (logger && typeof logger.error === 'function' ? logger.error : console.error)(errorMsg);
            throw new Error(errorMsg);
        }
        this.#logger = logger;

        if (!environmentContext || typeof environmentContext.getExecutionEnvironment !== 'function') {
            const errorMsg = 'ConfigurableLLMAdapter: Constructor requires a valid EnvironmentContext instance.';
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#environmentContext = environmentContext;

        if (!apiKeyProvider || typeof apiKeyProvider.getKey !== 'function') {
            const errorMsg = 'ConfigurableLLMAdapter: Constructor requires a valid IApiKeyProvider instance.';
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#apiKeyProvider = apiKeyProvider;

        // Corrected method check from createStrategy to getStrategy as per Ticket 21 usage
        if (!llmStrategyFactory || typeof llmStrategyFactory.getStrategy !== 'function') {
            const errorMsg = 'ConfigurableLLMAdapter: Constructor requires a valid LLMStrategyFactory instance.';
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#llmStrategyFactory = llmStrategyFactory;

        this.#logger.info(`ConfigurableLLMAdapter: Instance created. Execution environment: ${this.#environmentContext.getExecutionEnvironment()}. Ready for initialization.`);
    }

    /**
     * @private
     * @description Sets the default active LLM configuration based on the loaded configs.
     * This method is called internally after configurations are successfully loaded.
     */
    #setDefaultActiveLlm() {
        if (!this.#llmConfigs || !this.#llmConfigs.llms) {
            this.#logger.warn('ConfigurableLLMAdapter: Cannot set default active LLM because configurations are not loaded.');
            this.#currentActiveLlmId = null;
            this.#currentActiveLlmConfig = null;
            return;
        }

        const defaultLlmId = this.#llmConfigs.defaultLlmId;

        if (defaultLlmId && typeof defaultLlmId === 'string' && defaultLlmId.trim() !== '') {
            const targetConfig = this.#llmConfigs.llms[defaultLlmId];
            if (targetConfig) {
                this.#currentActiveLlmId = defaultLlmId;
                this.#currentActiveLlmConfig = targetConfig;
                this.#logger.info(`ConfigurableLLMAdapter: LLM configuration '${defaultLlmId}' (${targetConfig.displayName || 'N/A'}) set as active by default.`);
            } else {
                this.#logger.warn(`ConfigurableLLMAdapter: 'defaultLlmId' ("${defaultLlmId}") is specified in configurations, but no LLM configuration with this ID exists. No default LLM set.`);
                this.#currentActiveLlmId = null;
                this.#currentActiveLlmConfig = null;
            }
        } else if (defaultLlmId) {
            this.#logger.warn(`ConfigurableLLMAdapter: 'defaultLlmId' found in configurations but it is not a valid non-empty string ("${defaultLlmId}"). No default LLM set.`);
            this.#currentActiveLlmId = null;
            this.#currentActiveLlmConfig = null;
        } else {
            this.#logger.info('ConfigurableLLMAdapter: No "defaultLlmId" specified in configurations. No LLM is set as active by default.');
            this.#currentActiveLlmId = null;
            this.#currentActiveLlmConfig = null;
        }
    }


    /**
     * Asynchronously initializes the ConfigurableLLMAdapter.
     * This method loads LLM configurations using the provided LlmConfigLoader
     * and sets the default active LLM if specified.
     * It must be called and awaited before the adapter can be used.
     *
     * @async
     * @param {object} initParams - Parameters for initialization.
     * @param {LlmConfigLoader} initParams.llmConfigLoader - An instance of LlmConfigLoader.
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     * @throws {Error} If llmConfigLoader is invalid or if a previous initialization attempt failed critically.
     */
    async init({llmConfigLoader}) {
        if (this.#isInitialized && !this.#isOperational) {
            const errorMsg = 'ConfigurableLLMAdapter: Cannot re-initialize after a critical configuration loading failure.';
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        if (this.#isInitialized && this.#isOperational) {
            this.#logger.info('ConfigurableLLMAdapter: Already initialized and operational. Skipping re-initialization.');
            return;
        }

        if (!llmConfigLoader || typeof llmConfigLoader.loadConfigs !== 'function') {
            const errorMsg = 'ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.';
            this.#logger.error(errorMsg, {providedLoader: llmConfigLoader});
            this.#isInitialized = true; // Mark as initialized even if failing
            this.#isOperational = false;
            this.#currentActiveLlmId = null;
            this.#currentActiveLlmConfig = null;
            throw new Error(errorMsg);
        }

        this.#configLoader = llmConfigLoader;
        this.#logger.info('ConfigurableLLMAdapter: Initialization started with LlmConfigLoader.');
        this.#currentActiveLlmId = null;
        this.#currentActiveLlmConfig = null;

        try {
            const configResult = await this.#configLoader.loadConfigs();

            if (configResult && 'error' in configResult && configResult.error === true) {
                const loadError = /** @type {LoadConfigsErrorResult} */ (configResult);
                this.#logger.error('ConfigurableLLMAdapter: Critical error loading LLM configurations.', {
                    message: loadError.message,
                    stage: loadError.stage,
                    path: loadError.path,
                    originalErrorMessage: loadError.originalError ? loadError.originalError.message : 'N/A'
                });
                this.#llmConfigs = null;
                this.#isOperational = false;
            } else if (configResult && typeof configResult.llms === 'object' && configResult.llms !== null) {
                this.#llmConfigs = /** @type {LLMConfigurationFile} */ (configResult);
                this.#logger.info('ConfigurableLLMAdapter: LLM configurations loaded successfully.', {
                    numberOfConfigs: Object.keys(this.#llmConfigs.llms).length,
                    defaultLlmId: this.#llmConfigs.defaultLlmId || 'Not set'
                });
                this.#isOperational = true;
                this.#setDefaultActiveLlm();
            } else {
                this.#logger.error('ConfigurableLLMAdapter: LLM configuration loading returned an unexpected structure.', {configResult});
                this.#llmConfigs = null;
                this.#isOperational = false;
            }
        } catch (error) {
            this.#logger.error('ConfigurableLLMAdapter: Unexpected exception during LLM configuration loading.', {
                errorMessage: error.message,
                errorStack: error.stack
            });
            this.#llmConfigs = null;
            this.#isOperational = false;
        }

        this.#isInitialized = true;
        if (!this.#isOperational) {
            this.#logger.warn('ConfigurableLLMAdapter: Initialization complete, but the adapter is NON-OPERATIONAL due to configuration loading issues.');
            this.#currentActiveLlmId = null;
            this.#currentActiveLlmConfig = null;
        } else {
            this.#logger.info('ConfigurableLLMAdapter: Initialization complete and adapter is operational.');
        }
    }

    /**
     * Sets the active LLM configuration by its ID.
     *
     * @param {string} llmId - The ID of the LLM configuration to set as active.
     * @returns {boolean} True if the LLM configuration was successfully set as active, false otherwise.
     * Returns false if the adapter is not operational, if the llmId is invalid,
     * or if no configuration with the given llmId exists.
     */
    setActiveLlm(llmId) {
        if (!this.#isOperational) {
            this.#logger.error(`ConfigurableLLMAdapter.setActiveLlm: Adapter is not operational. Cannot set LLM ID '${llmId}'.`);
            return false;
        }
        if (!this.#llmConfigs || !this.#llmConfigs.llms) {
            this.#logger.error(`ConfigurableLLMAdapter.setActiveLlm: LLM configurations are not loaded. Cannot set LLM ID '${llmId}'.`);
            return false;
        }
        if (!llmId || typeof llmId !== 'string' || llmId.trim() === '') {
            this.#logger.error(`ConfigurableLLMAdapter.setActiveLlm: Invalid llmId provided (must be a non-empty string). Received: '${llmId}'. Active LLM remains unchanged ('${this.#currentActiveLlmId || 'none'}').`);
            return false;
        }

        const targetConfig = this.#llmConfigs.llms[llmId];
        if (targetConfig) {
            const oldLlmId = this.#currentActiveLlmId;
            this.#currentActiveLlmId = llmId;
            this.#currentActiveLlmConfig = targetConfig;
            this.#logger.info(`ConfigurableLLMAdapter.setActiveLlm: Active LLM configuration changed from '${oldLlmId || 'none'}' to '${llmId}' (${targetConfig.displayName || 'N/A'}).`);
            return true;
        } else {
            this.#logger.error(`ConfigurableLLMAdapter.setActiveLlm: No LLM configuration found with ID '${llmId}'. Active LLM remains unchanged ('${this.#currentActiveLlmId || 'none'}').`);
            return false;
        }
    }

    /**
     * Retrieves the full configuration object for the currently active LLM.
     *
     * @returns {LLMModelConfig | null} The active LLMModelConfig object, or null if no LLM is active or
     * if the adapter is not operational.
     */
    getCurrentActiveLlmConfig() {
        if (!this.#isOperational) {
            this.#logger.warn('ConfigurableLLMAdapter.getCurrentActiveLlmConfig: Adapter is not operational. Returning null.');
            return null;
        }
        if (!this.#currentActiveLlmConfig) {
            this.#logger.debug('ConfigurableLLMAdapter.getCurrentActiveLlmConfig: No LLM configuration is currently active. Returning null.');
        }
        return this.#currentActiveLlmConfig;
    }

    // _getFallbackActionPromise is removed as it's no longer used by the refactored getAIDecision.
    // _executeApiCallThroughHttpClient is removed as it's no longer used.
    // All _handle* methods (_handleToolCalling, _handleOpenRouterJsonSchema, _handleNativeJsonMode, _handleGbnfGrammar, _handlePromptEngineering)
    // are removed as their logic is now delegated to strategies obtained via LLMStrategyFactory.


    /**
     * Generates an action and speech based on the provided game summary using a configured LLM.
     * This method orchestrates fetching the configuration, API key, and appropriate LLM strategy,
     * then executes the strategy.
     *
     * @async
     * @param {string} gameSummary - A string providing a summarized representation
     * of the current game state and relevant actor information.
     * @returns {Promise<string>} A Promise that resolves to a JSON string representing the LLM's decision.
     * @throws {Error | ConfigurationError} If initialization/configuration issues occur,
     * or if the LLM strategy execution fails.
     */
    async getAIDecision(gameSummary) {
        this.#logger.debug('ConfigurableLLMAdapter.getAIDecision called.', {
            isInitialized: this.#isInitialized,
            isOperational: this.#isOperational,
            activeLlmId: this.#currentActiveLlmId,
            gameSummaryLength: gameSummary ? gameSummary.length : 0
        });

        // Step 1: Initial State Checks
        if (!this.#isInitialized) {
            const msg = "Adapter not initialized. Call init() first.";
            this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
            throw new Error(msg);
        }

        if (!this.#isOperational) {
            const msg = "Adapter is not operational due to configuration loading issues.";
            this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
            throw new Error(msg);
        }

        const activeConfig = this.getCurrentActiveLlmConfig();
        if (!activeConfig) {
            const msg = "No active LLM configuration is set. Use setActiveLlm() or set a defaultLlmId.";
            this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
            throw new ConfigurationError(msg);
        }

        let llmJsonOutput;

        try {
            // Step 2: Validate Active Configuration (Basic)
            const validationErrors = [];
            if (!activeConfig.id || typeof activeConfig.id !== 'string' || activeConfig.id.trim() === '') {
                validationErrors.push({field: 'id', reason: 'Missing or invalid'});
            }
            if (!activeConfig.endpointUrl || typeof activeConfig.endpointUrl !== 'string' || activeConfig.endpointUrl.trim() === '') {
                // Endpoint URL might be optional for some apiTypes if fully managed by strategy/provider,
                // but for now, let's consider it essential for most.
                validationErrors.push({field: 'endpointUrl', reason: 'Missing or invalid'});
            }
            if (!activeConfig.modelIdentifier || typeof activeConfig.modelIdentifier !== 'string' || activeConfig.modelIdentifier.trim() === '') {
                validationErrors.push({field: 'modelIdentifier', reason: 'Missing or invalid'});
            }
            if (!activeConfig.apiType || typeof activeConfig.apiType !== 'string' || activeConfig.apiType.trim() === '') {
                validationErrors.push({field: 'apiType', reason: 'Missing or invalid'});
            }

            // Validate jsonOutputStrategy structure (if present)
            if (activeConfig.jsonOutputStrategy) {
                if (typeof activeConfig.jsonOutputStrategy !== 'object') {
                    validationErrors.push({field: 'jsonOutputStrategy', reason: 'Must be an object if provided'});
                } else {
                    // Method is a key part of the strategy object if the object itself exists.
                    // If jsonOutputStrategy is present, its method should also be valid or let factory default.
                    // For this basic check, if method is there, it should be a non-empty string.
                    if (activeConfig.jsonOutputStrategy.method &&
                        (typeof activeConfig.jsonOutputStrategy.method !== 'string' || activeConfig.jsonOutputStrategy.method.trim() === '')) {
                        validationErrors.push({
                            field: 'jsonOutputStrategy.method',
                            reason: 'Must be a non-empty string if provided'
                        });
                    }
                }
            }
            // Depending on requirements, jsonOutputStrategy itself might be mandatory.
            // The ticket says "Optional: if jsonOutputStrategy itself is mandatory",
            // for now, we are not making it mandatory here, LLMStrategyFactory can default.

            if (validationErrors.length > 0) {
                const errorDetailsMessage = validationErrors.map(err => `${err.field}: ${err.reason}`).join('; ');
                const msg = `Active LLM config '${activeConfig.id}' is missing essential field(s) or has invalid structure: ${errorDetailsMessage}`;
                this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
                throw new ConfigurationError(msg, {llmId: activeConfig.id, problematicFields: validationErrors});
            }

            // Step 3: Retrieve API Key
            this.#logger.debug(`ConfigurableLLMAdapter.getAIDecision: Attempting to retrieve API key for LLM '${activeConfig.id}' using ApiKeyProvider.`);
            const apiKey = await this.#apiKeyProvider.getKey(activeConfig, this.#environmentContext);

            // API Key Validation (Conditional)
            const isCloudApi = CLOUD_API_TYPES.includes(activeConfig.apiType);
            const requiresApiKey = isCloudApi && this.#environmentContext.isServer(); // Example condition

            if (requiresApiKey && !apiKey) {
                const msg = `API key retrieval failed or key is missing for LLM '${activeConfig.id}' which requires it in the current environment (server-side cloud API).`;
                this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
                throw new ConfigurationError(msg, {llmId: activeConfig.id});
            }
            if (apiKey) {
                this.#logger.info(`ConfigurableLLMAdapter.getAIDecision: API key retrieved successfully for LLM '${activeConfig.id}'.`);
            } else if (requiresApiKey) {
                // This case should have been caught above, but as a safeguard:
                const msg = `Critical: API key for LLM '${activeConfig.id}' is required but was not available.`;
                this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
                throw new ConfigurationError(msg, {llmId: activeConfig.id});
            } else {
                this.#logger.info(`ConfigurableLLMAdapter.getAIDecision: API key not required or not found for LLM '${activeConfig.id}' in current context, proceeding without it.`);
            }


            // Step 4: Get LLM Strategy Instance
            this.#logger.info(`ConfigurableLLMAdapter.getAIDecision: Working LLM strategy for config '${activeConfig.id}' (apiType: ${activeConfig.apiType}, strategyMethod: ${activeConfig.jsonOutputStrategy?.method || 'default'}).`);

            let strategy;
            try {
                strategy = this.#llmStrategyFactory.getStrategy(activeConfig);
            } catch (factoryError) {
                // If factory throws, catch it and re-throw as ConfigurationError or let it propagate
                this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: LLMStrategyFactory failed to provide a strategy for LLM '${activeConfig.id}'. Error: ${factoryError.message}`, {
                    llmId: activeConfig.id,
                    originalError: factoryError
                });
                throw new ConfigurationError(`Failed to get strategy from factory for LLM '${activeConfig.id}': ${factoryError.message}`, {llmId: activeConfig.id});
            }

            if (!strategy) {
                // This case should ideally be handled by the factory throwing an error.
                const msg = `No suitable LLM strategy found for configuration '${activeConfig.id}'. LLMStrategyFactory returned null/undefined.`;
                this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
                throw new ConfigurationError(msg, {llmId: activeConfig.id});
            }

            // Step 5: Execute Strategy
            this.#logger.info(`ConfigurableLLMAdapter.getAIDecision: Executing strategy for LLM '${activeConfig.id}'.`);
            llmJsonOutput = await strategy.execute({
                gameSummary,
                llmConfig: activeConfig,
                apiKey, // Will be null if not applicable/found and not strictly required
                environmentContext: this.#environmentContext
            });

            return llmJsonOutput;

        } catch (error) {
            // Step 6: Overall Error Handling
            // Log and re-throw the error to allow higher-level components to handle it.
            this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: Error during decision processing for LLM '${activeConfig?.id || 'unknown'}'. Error: ${error.message}`, {
                llmId: activeConfig?.id || 'unknown',
                errorName: error.name,
                // originalError: error // Avoid logging the full error object here if it might be too verbose or contain sensitive data from deeper down. error.message and error.name should suffice for this level.
            });
            throw error; // Re-throw the original error
        }
    }

    /**
     * Checks if the adapter has been initialized.
     * @returns {boolean} True if init() has been called, false otherwise.
     */
    isInitialized() {
        return this.#isInitialized;
    }

    /**
     * Checks if the adapter is operational (i.e., initialized successfully with valid configurations).
     * @returns {boolean} True if operational, false otherwise.
     */
    isOperational() {
        return this.#isOperational;
    }

    /**
     * Retrieves the loaded LLM configurations.
     * Primarily for testing or debugging purposes.
     * @returns {LLMConfigurationFile | null} The loaded configurations or null if not loaded/failed.
     */
    getLoadedConfigs_FOR_TESTING_ONLY() {
        return this.#llmConfigs;
    }

    /**
     * Retrieves the ID of the currently active LLM configuration.
     * Primarily for testing or debugging purposes.
     * @returns {string | null} The ID of the active LLM or null.
     */
    getActiveLlmId_FOR_TESTING_ONLY() {
        return this.#currentActiveLlmId;
    }

    /**
     * Retrieves the current execution environment of the adapter via EnvironmentContext.
     * Primarily for testing or debugging purposes.
     * @returns {'client' | 'server' | 'unknown'} The execution environment.
     */
    getExecutionEnvironment_FOR_TESTING_ONLY() {
        if (!this.#environmentContext) {
            this.#logger.error("getExecutionEnvironment_FOR_TESTING_ONLY: #environmentContext is not initialized.");
            return 'unknown';
        }
        return this.#environmentContext.getExecutionEnvironment();
    }

    /**
     * Retrieves the project root path via EnvironmentContext.
     * Primarily for testing or debugging purposes.
     * @returns {string | null} The project root path.
     */
    getProjectRootPath_FOR_TESTING_ONLY() {
        if (!this.#environmentContext) {
            this.#logger.error("getProjectRootPath_FOR_TESTING_ONLY: #environmentContext is not initialized.");
            return null;
        }
        return this.#environmentContext.getProjectRootPath();
    }

    /**
     * Retrieves the configured proxy server URL via EnvironmentContext.
     * Primarily for testing or debugging purposes.
     * @returns {string} The proxy server URL.
     */
    getProxyServerUrl_FOR_TESTING_ONLY() {
        if (!this.#environmentContext) {
            this.#logger.error("getProxyServerUrl_FOR_TESTING_ONLY: #environmentContext is not initialized.");
            return "";
        }
        return this.#environmentContext.getProxyServerUrl();
    }

    /**
     * Retrieves the EnvironmentContext instance.
     * Primarily for testing or debugging purposes.
     * @returns {EnvironmentContext | null} The EnvironmentContext instance.
     */
    getEnvironmentContext_FOR_TESTING_ONLY() {
        return this.#environmentContext;
    }

    /**
     * Retrieves the IApiKeyProvider instance.
     * Primarily for testing or debugging purposes.
     * @returns {IApiKeyProvider | null} The IApiKeyProvider instance.
     */
    getApiKeyProvider_FOR_TESTING_ONLY() {
        return this.#apiKeyProvider;
    }

    /**
     * Retrieves the LLMStrategyFactory instance.
     * Primarily for testing or debugging purposes.
     * @returns {LLMStrategyFactory | null} The LLMStrategyFactory instance.
     */
    getLlmStrategyFactory_FOR_TESTING_ONLY() {
        return this.#llmStrategyFactory;
    }
}

// --- FILE END ---