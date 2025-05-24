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
 * manages the active LLM configuration. It ensures its own initialization is complete
 * before executing core logic.
 */
export class ConfigurableLLMAdapter extends ILLMAdapter {
    // --- Private Fields ---
    /** @private @type {ILogger} */
    #logger;
    /** @private @type {EnvironmentContext} */
    #environmentContext;
    /** @private @type {IApiKeyProvider} */
    #apiKeyProvider;
    /** @private @type {LLMStrategyFactory} */
    #llmStrategyFactory;
    /** @private @type {LlmConfigLoader | null} */
    #configLoader = null;
    /** @private @type {LLMConfigurationFile | null} */
    #llmConfigs = null;
    /** @private @type {boolean} */
    #isInitialized = false; // Tracks if init attempt has been made and core logic run
    /** @private @type {boolean} */
    #isOperational = false;
    /** @private @type {string | null} */
    #currentActiveLlmId = null;
    /** @private @type {LLMModelConfig | null} */
    #currentActiveLlmConfig = null;

    /**
     * @private
     * @type {Promise<void> | null}
     * @description Stores the promise returned by the actual initialization logic.
     */
    #initPromise = null;

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

        if (!llmStrategyFactory || typeof llmStrategyFactory.getStrategy !== 'function') {
            const errorMsg = 'ConfigurableLLMAdapter: Constructor requires a valid LLMStrategyFactory instance.';
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#llmStrategyFactory = llmStrategyFactory;

        this.#logger.info(`ConfigurableLLMAdapter: Instance created. Execution environment: ${this.#environmentContext.getExecutionEnvironment()}. Ready for initialization call.`);
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
     * Asynchronously initializes the ConfigurableLLMAdapter if not already initiated.
     * This method is idempotent and manages an internal promise for the async initialization process.
     * It loads LLM configurations using the provided LlmConfigLoader
     * and sets the default active LLM if specified.
     *
     * @param {object} initParams - Parameters for initialization.
     * @param {LlmConfigLoader} initParams.llmConfigLoader - An instance of LlmConfigLoader.
     * @returns {Promise<void>} A promise that resolves when initialization is complete,
     * or rejects if it fails. This promise is shared across calls to init.
     * @throws {Error} (Synchronously) If llmConfigLoader is invalid when init is first called seriously.
     */
    init({llmConfigLoader}) {
        // Path 1: Already successfully initialized AND operational from a completed previous call.
        if (this.#isInitialized && this.#isOperational) {
            this.#logger.info('ConfigurableLLMAdapter: Already initialized and operational from a previous successful call. Skipping re-initialization logic.');
            // this.#initPromise should be the promise from that successful run.
            return this.#initPromise;
        }

        // Path 2: Previously initialized (i.e., an init cycle completed) but NOT operational.
        // This is a critical failure state that prevents re-initialization.
        if (this.#isInitialized && !this.#isOperational) {
            const errorMsg = 'ConfigurableLLMAdapter: Cannot re-initialize after a critical configuration loading failure from a previous attempt.';
            this.#logger.error(errorMsg);
            // For this specific re-attempt, return a new rejected promise.
            // The original #initPromise might have resolved if the async IIFE didn't throw.
            return Promise.reject(new Error(errorMsg));
        }

        // Path 3: Initialization is already in progress (this.#initPromise exists but conditions for Path 1 & 2 weren't met).
        // This means #isInitialized is still false.
        if (this.#initPromise) {
            this.#logger.info('ConfigurableLLMAdapter: Initialization is already in progress. Returning existing promise.');
            return this.#initPromise;
        }

        // Path 4: This is the first actual call to init that will proceed to the async part,
        // or a call after a synchronous throw in a previous init attempt (where #initPromise would be null).
        // Perform synchronous validation for llmConfigLoader.
        if (!llmConfigLoader || typeof llmConfigLoader.loadConfigs !== 'function') {
            const errorMsg = 'ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.';
            this.#logger.error(errorMsg, {providedLoader: llmConfigLoader});
            // Mark this synchronous failure as an init attempt that concluded without starting async part.
            this.#isInitialized = true;
            this.#isOperational = false;
            // #initPromise remains null.
            throw new Error(errorMsg); // Synchronous throw.
        }

        // Path 5: Create and return the promise for the main asynchronous initialization process.
        // This part is reached only if it's a genuine first attempt to run the async logic.
        this.#initPromise = (async () => {
            this.#configLoader = llmConfigLoader;
            this.#logger.info('ConfigurableLLMAdapter: Actual asynchronous initialization started with LlmConfigLoader.');
            this.#currentActiveLlmId = null;
            this.#currentActiveLlmConfig = null;
            this.#isOperational = false; // Reset before trying

            try {
                const configResult = await this.#configLoader.loadConfigs();

                if (configResult && 'error' in configResult && configResult.error === true) {
                    const loadError = /** @type {LoadConfigsErrorResult} */ (configResult);
                    this.#logger.error('ConfigurableLLMAdapter: Critical error loading LLM configurations.', {
                        message: loadError.message, stage: loadError.stage, path: loadError.path,
                        originalErrorMessage: loadError.originalError ? loadError.originalError.message : 'N/A'
                    });
                    this.#llmConfigs = null;
                    // #isOperational remains false
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
                    // #isOperational remains false
                }
            } catch (error) {
                this.#logger.error('ConfigurableLLMAdapter: Unexpected exception during LLM configuration loading.', {
                    errorMessage: error.message, errorStack: error.stack
                });
                this.#llmConfigs = null;
                this.#isOperational = false; // Ensure isOperational is false on error
                this.#isInitialized = true; // Mark that an attempt was made (async part ran)
                throw error; // Re-throw to reject the #initPromise itself
            }

            this.#isInitialized = true; // Mark that this async process completed.
            if (!this.#isOperational) {
                this.#logger.warn('ConfigurableLLMAdapter: Initialization attempt complete, but the adapter is NON-OPERATIONAL due to configuration loading issues.');
                // DO NOT throw an error here like "Adapter initialized but not operational".
                // The fact that the promise resolves but #isOperational is false is the state
                // that Path 2 (re-init check) will use on a subsequent call.
            } else {
                this.#logger.info('ConfigurableLLMAdapter: Initialization attempt complete and adapter is operational.');
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
            // This would mean init() was never called, which is a programming error
            // if the adapter is being used.
            const msg = "ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter.";
            this.#logger.error(`ConfigurableLLMAdapter.#ensureInitialized: ${msg}`);
            throw new Error(msg);
        }

        await this.#initPromise; // Wait for the stored initialization promise to settle

        // After awaiting, check the final state.
        // #isInitialized should be true if #initPromise resolved (even if operational is false).
        // If #initPromise rejected, await would have thrown, and we wouldn't reach here.
        if (!this.#isInitialized) {
            // This state should ideally not be reached if #initPromise resolves correctly
            // and sets #isInitialized = true.
            const msg = "ConfigurableLLMAdapter: Initialization promise resolved, but adapter is not marked as initialized. Internal logic error.";
            this.#logger.error(`ConfigurableLLMAdapter.#ensureInitialized: ${msg}`);
            throw new Error(msg);
        }

        if (!this.#isOperational) {
            const msg = "ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.";
            this.#logger.error(`ConfigurableLLMAdapter.#ensureInitialized: ${msg}`);
            // Depending on how strictly you want to enforce operational status:
            throw new Error(msg); // Or just log a warning and proceed if some methods can work non-operationally
        }
    }

    /**
     * Sets the active LLM configuration by its ID.
     *
     * @param {string} llmId - The ID of the LLM configuration to set as active.
     * @returns {boolean} True if the LLM configuration was successfully set as active, false otherwise.
     * Returns false if the adapter is not operational (checked after ensuring initialization),
     * if the llmId is invalid, or if no configuration with the given llmId exists.
     */
    async setActiveLlm(llmId) { // Made async due to #ensureInitialized
        await this.#ensureInitialized(); // Ensure operational status is confirmed

        // The #isOperational check here is somewhat redundant if #ensureInitialized throws on non-operational,
        // but kept for clarity or if #ensureInitialized is changed to not throw.
        if (!this.#isOperational) {
            this.#logger.error(`ConfigurableLLMAdapter.setActiveLlm: Adapter is not operational. Cannot set LLM ID '${llmId}'.`);
            return false;
        }
        if (!this.#llmConfigs || !this.#llmConfigs.llms) {
            this.#logger.error(`ConfigurableLLMAdapter.setActiveLlm: LLM configurations are not loaded. Cannot set LLM ID '${llmId}'.`);
            return false; // Should be caught by #isOperational if loading failed
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
     * if the adapter is not operational (checked after ensuring initialization).
     */
    async getCurrentActiveLlmConfig() { // Made async due to #ensureInitialized
        await this.#ensureInitialized(); // Ensure operational status is confirmed

        if (!this.#isOperational) { // Redundant if #ensureInitialized throws, but safe
            this.#logger.warn('ConfigurableLLMAdapter.getCurrentActiveLlmConfig: Adapter is not operational. Returning null.');
            return null;
        }
        if (!this.#currentActiveLlmConfig) {
            this.#logger.debug('ConfigurableLLMAdapter.getCurrentActiveLlmConfig: No LLM configuration is currently active. Returning null.');
        }
        return this.#currentActiveLlmConfig;
    }

    /**
     * Generates an action and speech based on the provided game summary using a configured LLM.
     * This method orchestrates fetching the configuration, API key, and appropriate LLM strategy,
     * then executes the strategy. It ensures the adapter is initialized and operational first.
     *
     * @async
     * @param {string} gameSummary - A string providing a summarized representation
     * of the current game state and relevant actor information.
     * @returns {Promise<string>} A Promise that resolves to a JSON string representing the LLM's decision.
     * @throws {Error | ConfigurationError} If initialization/configuration issues occur,
     * or if the LLM strategy execution fails.
     */
    async getAIDecision(gameSummary) {
        // Step 0: Ensure the adapter is initialized and operational.
        await this.#ensureInitialized();

        this.#logger.debug('ConfigurableLLMAdapter.getAIDecision called (post-internal-initialization-check).', {
            isInitialized: this.#isInitialized, // Should be true here
            isOperational: this.#isOperational, // Should be true here
            activeLlmId: this.#currentActiveLlmId,
            gameSummaryLength: gameSummary ? gameSummary.length : 0
        });

        const activeConfig = this.#currentActiveLlmConfig; // #ensureInitialized + getCurrentActiveLlmConfig implies this is set if operational
        if (!activeConfig) {
            // This should ideally be caught by #ensureInitialized if no defaultLlmId leads to non-operational,
            // or by getCurrentActiveLlmConfig if called directly. But as a final check if an LLM must be active:
            const msg = "No active LLM configuration is set (activeConfig is null post-init). Use setActiveLlm() or set a defaultLlmId that successfully loads.";
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
                validationErrors.push({field: 'endpointUrl', reason: 'Missing or invalid'});
            }
            if (!activeConfig.modelIdentifier || typeof activeConfig.modelIdentifier !== 'string' || activeConfig.modelIdentifier.trim() === '') {
                validationErrors.push({field: 'modelIdentifier', reason: 'Missing or invalid'});
            }
            if (!activeConfig.apiType || typeof activeConfig.apiType !== 'string' || activeConfig.apiType.trim() === '') {
                validationErrors.push({field: 'apiType', reason: 'Missing or invalid'});
            }
            if (activeConfig.jsonOutputStrategy) {
                if (typeof activeConfig.jsonOutputStrategy !== 'object') {
                    validationErrors.push({field: 'jsonOutputStrategy', reason: 'Must be an object if provided'});
                } else {
                    if (activeConfig.jsonOutputStrategy.method &&
                        (typeof activeConfig.jsonOutputStrategy.method !== 'string' || activeConfig.jsonOutputStrategy.method.trim() === '')) {
                        validationErrors.push({
                            field: 'jsonOutputStrategy.method',
                            reason: 'Must be a non-empty string if provided'
                        });
                    }
                }
            }
            if (validationErrors.length > 0) {
                const errorDetailsMessage = validationErrors.map(err => `${err.field}: ${err.reason}`).join('; ');
                const msg = `Active LLM config '${activeConfig.id}' is missing essential field(s) or has invalid structure: ${errorDetailsMessage}`;
                this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
                throw new ConfigurationError(msg, {llmId: activeConfig.id, problematicFields: validationErrors});
            }

            // Step 3: Retrieve API Key
            this.#logger.debug(`ConfigurableLLMAdapter.getAIDecision: Attempting to retrieve API key for LLM '${activeConfig.id}' using ApiKeyProvider.`);
            const apiKey = await this.#apiKeyProvider.getKey(activeConfig, this.#environmentContext);
            const isCloudApi = CLOUD_API_TYPES.includes(activeConfig.apiType);
            const requiresApiKey = isCloudApi && this.#environmentContext.isServer();

            if (requiresApiKey && !apiKey) {
                const msg = `API key retrieval failed or key is missing for LLM '${activeConfig.id}' which requires it in the current environment (server-side cloud API).`;
                this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
                throw new ConfigurationError(msg, {llmId: activeConfig.id});
            }
            if (apiKey) {
                this.#logger.info(`ConfigurableLLMAdapter.getAIDecision: API key retrieved successfully for LLM '${activeConfig.id}'.`);
            } else if (requiresApiKey) {
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
                this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: LLMStrategyFactory failed to provide a strategy for LLM '${activeConfig.id}'. Error: ${factoryError.message}`, {
                    llmId: activeConfig.id, originalError: factoryError
                });
                throw new ConfigurationError(`Failed to get strategy from factory for LLM '${activeConfig.id}': ${factoryError.message}`, {llmId: activeConfig.id});
            }
            if (!strategy) {
                const msg = `No suitable LLM strategy found for configuration '${activeConfig.id}'. LLMStrategyFactory returned null/undefined.`;
                this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
                throw new ConfigurationError(msg, {llmId: activeConfig.id});
            }

            // Step 5: Execute Strategy
            this.#logger.info(`ConfigurableLLMAdapter.getAIDecision: Executing strategy for LLM '${activeConfig.id}'.`);
            llmJsonOutput = await strategy.execute({
                gameSummary,
                llmConfig: activeConfig,
                apiKey,
                environmentContext: this.#environmentContext
            });

            return llmJsonOutput;

        } catch (error) {
            // Step 6: Overall Error Handling
            this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: Error during decision processing for LLM '${activeConfig?.id || 'unknown'}'. Error: ${error.message}`, {
                llmId: activeConfig?.id || 'unknown', errorName: error.name,
            });
            throw error;
        }
    }

    /**
     * Checks if the adapter has made an initialization attempt and that attempt has concluded.
     * Note: This does not guarantee the adapter is operational, only that the init()
     * async logic has run to completion or failure. Use isOperational() for operational status.
     * @returns {boolean} True if init() core logic has run, false otherwise.
     */
    isInitialized() {
        return this.#isInitialized;
    }

    /**
     * Checks if the adapter is operational (i.e., initialized successfully with valid configurations
     * and is ready to process requests).
     * Note: This requires that the init() process has completed.
     * @returns {boolean} True if operational, false otherwise.
     */
    isOperational() {
        return this.#isOperational;
    }

    /**
     * Retrieves the loaded LLM configurations.
     * Primarily for testing or debugging purposes. Should be called after awaiting init().
     * @returns {LLMConfigurationFile | null} The loaded configurations or null if not loaded/failed.
     */
    getLoadedConfigs_FOR_TESTING_ONLY() {
        // Could optionally add: if (!this.#isInitialized) this.#logger.warn("...")
        return this.#llmConfigs;
    }

    /**
     * Retrieves the ID of the currently active LLM configuration.
     * Primarily for testing or debugging purposes. Should be called after awaiting init().
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