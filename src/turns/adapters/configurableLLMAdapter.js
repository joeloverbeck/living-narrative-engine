// src/turns/adapters/configurableLLMAdapter.js
// --- FILE START ---

import {ILLMAdapter} from '../interfaces/ILLMAdapter.js';
// getApiKeyFromFileSystem import removed as per Ticket 21
// import {getApiKeyFromFile as getApiKeyFromFileSystem} from '../../utils/apiKeyFileRetriever.js';

// Base strategy imports are removed as they are no longer directly used here.
// Strategies are now handled by LLMStrategyFactory.

import {
    CLOUD_API_TYPES, // Added import for CLOUD_API_TYPES
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
    /** @private @type {string | null} */
    #initialLlmIdFromConstructor = null;


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
     * @param {string} [dependencies.initialLlmId] - Optional. The ID of the LLM to activate initially.
     * @throws {Error} If any critical dependency is missing or invalid.
     */
    constructor({logger, environmentContext, apiKeyProvider, llmStrategyFactory, initialLlmId = null}) {
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

        if (initialLlmId !== null && typeof initialLlmId !== 'string') {
            this.#logger.warn(`ConfigurableLLMAdapter: Constructor received an invalid type for initialLlmId (expected string or null). Received: ${typeof initialLlmId}. Ignoring.`);
            this.#initialLlmIdFromConstructor = null;
        } else if (initialLlmId && initialLlmId.trim() === '') {
            this.#logger.warn(`ConfigurableLLMAdapter: Constructor received an empty string for initialLlmId. It will be treated as if no initialLlmId was provided.`);
            this.#initialLlmIdFromConstructor = null;
        } else {
            this.#initialLlmIdFromConstructor = initialLlmId;
        }

        this.#logger.info(`ConfigurableLLMAdapter: Instance created. Execution environment: ${this.#environmentContext.getExecutionEnvironment()}. Initial LLM ID from constructor: '${this.#initialLlmIdFromConstructor || 'not set'}'. Ready for initialization call.`);
    }

    /**
     * @private
     * @description Sets the active LLM configuration based on initialLlmId (from constructor)
     * and defaultLlmId (from loaded config), adhering to specified priorities.
     * This method is called internally after configurations are successfully loaded.
     */
    #selectInitialActiveLlm() {
        if (!this.#llmConfigs || !this.#llmConfigs.llms || typeof this.#llmConfigs.llms !== 'object') {
            this.#logger.warn('ConfigurableLLMAdapter.#selectInitialActiveLlm: Cannot select active LLM because configurations are not loaded or llms object is invalid.');
            this.#currentActiveLlmId = null;
            this.#currentActiveLlmConfig = null;
            return;
        }

        const allLlms = this.#llmConfigs.llms;
        const defaultLlmIdFromConfig = this.#llmConfigs.defaultLlmId;
        let llmSelected = false;
        let specificWarningForDefaultNotFoundLogged = false;

        // Priority 1: initialLlmId from constructor
        if (this.#initialLlmIdFromConstructor && typeof this.#initialLlmIdFromConstructor === 'string' && this.#initialLlmIdFromConstructor.trim() !== '') {
            const targetConfig = allLlms[this.#initialLlmIdFromConstructor];
            if (targetConfig) {
                this.#currentActiveLlmId = this.#initialLlmIdFromConstructor;
                this.#currentActiveLlmConfig = targetConfig;
                this.#logger.info(`ConfigurableLLMAdapter: LLM configuration '${this.#currentActiveLlmId}' (${targetConfig.displayName || 'N/A'}) set as active by initialLlmId.`);
                llmSelected = true;
            } else {
                this.#logger.warn(`ConfigurableLLMAdapter.#selectInitialActiveLlm: initialLlmId ('${this.#initialLlmIdFromConstructor}') was provided to constructor, but no LLM configuration with this ID exists. Falling back to defaultLlmId logic.`);
            }
        }

        // Priority 2: defaultLlmId from configuration file
        if (!llmSelected) {
            if (defaultLlmIdFromConfig && typeof defaultLlmIdFromConfig === 'string' && defaultLlmIdFromConfig.trim() !== '') {
                const targetConfig = allLlms[defaultLlmIdFromConfig];
                if (targetConfig) {
                    this.#currentActiveLlmId = defaultLlmIdFromConfig;
                    this.#currentActiveLlmConfig = targetConfig;
                    this.#logger.info(`ConfigurableLLMAdapter: LLM configuration '${this.#currentActiveLlmId}' (${targetConfig.displayName || 'N/A'}) set as active by default.`);
                    llmSelected = true;
                } else { // DefaultLlmId specified but not found
                    this.#logger.warn(`ConfigurableLLMAdapter: 'defaultLlmId' ("${defaultLlmIdFromConfig}") is specified in configurations, but no LLM configuration with this ID exists. No default LLM set.`);
                    specificWarningForDefaultNotFoundLogged = true;
                }
            } else if (defaultLlmIdFromConfig) { // defaultLlmId is present but e.g. empty string or wrong type
                this.#logger.warn(`ConfigurableLLMAdapter.#selectInitialActiveLlm: 'defaultLlmId' found in configurations but it is not a valid non-empty string ("${defaultLlmIdFromConfig}").`);
            } else { // defaultLlmId is null or undefined
                this.#logger.info(`ConfigurableLLMAdapter: No "defaultLlmId" specified in configurations. No LLM is set as active by default.`);
            }
        }

        if (!llmSelected) {
            this.#currentActiveLlmId = null;
            this.#currentActiveLlmConfig = null;
            if (Object.keys(allLlms).length === 0) {
                this.#logger.warn('ConfigurableLLMAdapter.#selectInitialActiveLlm: No LLM configurations found in llmConfigs.llms. No LLM can be set as active.');
            } else if (!specificWarningForDefaultNotFoundLogged) {
                this.#logger.warn('ConfigurableLLMAdapter.#selectInitialActiveLlm: No default LLM set. Neither initialLlmId nor defaultLlmId resulted in a valid active LLM selection.');
            }
        }
    }


    /**
     * Asynchronously initializes the ConfigurableLLMAdapter if not already initiated.
     * This method is idempotent and manages an internal promise for the async initialization process.
     * It loads LLM configurations using the provided LlmConfigLoader
     * and sets the initial active LLM based on constructor parameter and config file default.
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
            return this.#initPromise;
        }

        // Path 2: Previously initialized (i.e., an init cycle completed) but NOT operational.
        if (this.#isInitialized && !this.#isOperational) {
            const errorMsg = 'ConfigurableLLMAdapter: Cannot re-initialize after a critical configuration loading failure from a previous attempt.';
            this.#logger.error(errorMsg);
            return Promise.reject(new Error(errorMsg));
        }

        // Path 3: Initialization is already in progress.
        if (this.#initPromise) {
            this.#logger.info('ConfigurableLLMAdapter: Initialization is already in progress. Returning existing promise.');
            return this.#initPromise;
        }

        // Path 4: Synchronous validation for llmConfigLoader.
        if (!llmConfigLoader || typeof llmConfigLoader.loadConfigs !== 'function') {
            const errorMsg = 'ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.';
            this.#logger.error(errorMsg, {providedLoader: llmConfigLoader});
            this.#isInitialized = true;
            this.#isOperational = false;
            throw new Error(errorMsg);
        }

        // Path 5: Create and return the promise for the main asynchronous initialization process.
        this.#initPromise = (async () => {
            this.#configLoader = llmConfigLoader;
            this.#logger.info('ConfigurableLLMAdapter: Actual asynchronous initialization started with LlmConfigLoader.');
            this.#currentActiveLlmId = null;
            this.#currentActiveLlmConfig = null;
            this.#isOperational = false;

            try {
                const configResult = await this.#configLoader.loadConfigs();

                if (configResult && 'error' in configResult && configResult.error === true) {
                    const loadError = /** @type {LoadConfigsErrorResult} */ (configResult);
                    this.#logger.error('ConfigurableLLMAdapter: Critical error loading LLM configurations.', {
                        message: loadError.message, stage: loadError.stage, path: loadError.path,
                        originalErrorMessage: loadError.originalError ? loadError.originalError.message : 'N/A'
                    });
                    this.#llmConfigs = null;
                } else if (configResult && typeof configResult.llms === 'object' && configResult.llms !== null) {
                    this.#llmConfigs = /** @type {LLMConfigurationFile} */ (configResult);
                    this.#logger.info('ConfigurableLLMAdapter: LLM configurations loaded successfully.', {
                        numberOfConfigs: Object.keys(this.#llmConfigs.llms).length,
                        defaultLlmId: this.#llmConfigs.defaultLlmId || 'Not set'
                    });
                    this.#isOperational = true;
                    this.#selectInitialActiveLlm();
                } else {
                    this.#logger.error('ConfigurableLLMAdapter: LLM configuration loading returned an unexpected structure.', {configResult});
                    this.#llmConfigs = null;
                }
            } catch (error) {
                this.#logger.error('ConfigurableLLMAdapter: Unexpected exception during LLM configuration loading.', {
                    errorMessage: error.message, errorStack: error.stack
                });
                this.#llmConfigs = null;
                this.#isOperational = false; // Ensure this is set on exception
                this.#isInitialized = true; // Mark that an attempt was made
                throw error; // Re-throw to reject this.#initPromise
            }

            this.#isInitialized = true; // Mark that initialization attempt is complete
            if (!this.#isOperational) {
                this.#logger.warn('ConfigurableLLMAdapter: Initialization attempt complete, but the adapter is NON-OPERATIONAL due to configuration loading issues.');
            } else {
                this.#logger.info(`ConfigurableLLMAdapter: Initialization attempt complete and adapter is operational.`);
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
            const msg = "ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter.";
            this.#logger.error(`ConfigurableLLMAdapter.#ensureInitialized: ${msg}`);
            throw new Error(msg); // Consistent with AC: "ensureInitialized throws"
        }
        // Await the promise. If it rejected (e.g., LlmConfigLoader.loadConfigs threw),
        // this await will re-throw that error.
        await this.#initPromise;

        // This check might seem redundant if #initPromise rejection is handled, but it's a safeguard.
        if (!this.#isInitialized) {
            const msg = "ConfigurableLLMAdapter: Initialization promise resolved, but adapter is not marked as initialized. Internal logic error.";
            this.#logger.error(`ConfigurableLLMAdapter.#ensureInitialized: ${msg}`);
            throw new Error(msg); // Consistent with AC
        }
        if (!this.#isOperational) {
            const msg = "ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.";
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
        // Per AC: "Calling setActiveLlm first ensures the adapter is initialized and operational by awaiting this.#ensureInitialized().
        // If not operational, an error is logged, and false is returned (or ensureInitialized throws)."
        // #ensureInitialized will throw if not operational. The catch block below was removed to allow propagation.
        // If #ensureInitialized throws, this method will reject as per test expectations.
        // If it doesn't throw, the adapter is operational.
        try {
            await this.#ensureInitialized();
        } catch (error) {
            // Log the error as per AC "an error is logged" if ensureInitialized throws.
            // #ensureInitialized already logs its specific error.
            // This additional log can indicate context if desired, but might be redundant if #ensureInitialized logging is sufficient.
            // For test alignment, tests expect #ensureInitialized's log.
            // If we return false here, it contradicts tests expecting a throw. So, re-throw.
            // this.#logger.error(`ConfigurableLLMAdapter.setActiveLlm: Prerequisite check failed. Error: ${error.message}`);
            throw error; // Re-throw to make setActiveLlm reject as per failing tests.
        }


        // Per AC: "The method handles cases where this.#llmConfigs or this.#llmConfigs.llms might be null/undefined
        // (though ensureInitialized should prevent this if operational), logging an error and returning false."
        if (!this.#llmConfigs || !this.#llmConfigs.llms) {
            this.#logger.error(`ConfigurableLLMAdapter.setActiveLlm: LLM configurations object or llms map is not available. Cannot set LLM ID '${llmId}'. This may indicate an issue post-initialization.`);
            return false;
        }

        // Per AC: "If llmId is invalid (e.g., not a string, empty string, or not found in this.#llmConfigs.llms)"
        // Validate llmId: ensure it's a non-empty string. Log error and return false if not.
        if (typeof llmId !== 'string' || llmId.trim() === '') {
            // Test expects: StringContaining "Invalid llmId provided (must be a non-empty string). Received: '...'")
            // Test also expects logger.error
            this.#logger.error(`ConfigurableLLMAdapter.setActiveLlm: Invalid llmId provided (must be a non-empty string). Received: '${llmId}'. Active LLM remains '${this.#currentActiveLlmId || 'none'}'.`);
            return false;
        }

        const targetConfig = this.#llmConfigs.llms[llmId];

        if (targetConfig) {
            const oldLlmId = this.#currentActiveLlmId;
            this.#currentActiveLlmId = llmId;
            this.#currentActiveLlmConfig = targetConfig;
            const newDisplayName = targetConfig.displayName || 'N/A';
            // Test expects: "ConfigurableLLMAdapter.setActiveLlm: Active LLM configuration changed from 'test-llm-1' to 'test-llm-2' (Test LLM 2 (Cloud))."
            this.#logger.info(`ConfigurableLLMAdapter.setActiveLlm: Active LLM configuration changed from '${oldLlmId || 'none'}' to '${llmId}' (${newDisplayName}).`);
            return true;
        } else {
            // Test expects: "ConfigurableLLMAdapter.setActiveLlm: No LLM configuration found with ID 'non-existent-llm'. Active LLM remains unchanged ('test-llm-1')."
            // Test also expects logger.error
            this.#logger.error(`ConfigurableLLMAdapter.setActiveLlm: No LLM configuration found with ID '${llmId}'. Active LLM remains unchanged ('${this.#currentActiveLlmId || 'none'}').`);
            return false;
        }
    }

    /**
     * Retrieves the full configuration object for the currently active LLM.
     *
     * @returns {Promise<LLMModelConfig | null>} The active LLMModelConfig object, or null if no LLM is active.
     * @throws {Error} If the adapter is not initialized or not operational (propagated from #ensureInitialized).
     */
    async getCurrentActiveLlmConfig() {
        // #ensureInitialized will throw if not operational.
        // If it throws, this method will reject as per failing tests.
        try {
            await this.#ensureInitialized();
        } catch (error) {
            // As per test: "should throw error if adapter is not operational when calling getCurrentActiveLlmConfig"
            // #ensureInitialized already logs its error. Re-throwing.
            // this.#logger.warn(`ConfigurableLLMAdapter.getCurrentActiveLlmConfig: Adapter not ready. Error: ${error.message}. Returning null.`);
            throw error;
        }

        if (!this.#currentActiveLlmConfig) {
            this.#logger.debug('ConfigurableLLMAdapter.getCurrentActiveLlmConfig: No LLM configuration is currently active. Returning null.');
            // This case is valid if operational but no LLM is selected (e.g. no default, setActiveLlm not called)
            return null;
        }
        return this.#currentActiveLlmConfig;
    }

    /**
     * Retrieves a list of available LLM configurations for UI selection.
     *
     * @public
     * @async
     * @returns {Promise<Array<{id: string, displayName: string}>>} A promise that resolves to an array of LLM options.
     * Each option is an object with 'id' and 'displayName'. Returns an empty array if not operational or no configs.
     */
    async getAvailableLlmOptions() {
        try {
            await this.#ensureInitialized();
        } catch (error) {
            // #ensureInitialized already logs. This specific method's AC: "If not operational...it logs a warning and returns an empty array."
            // #ensureInitialized throws, so this catch block handles the "not operational" case.
            this.#logger.warn(`ConfigurableLLMAdapter.getAvailableLlmOptions: Adapter not operational. Cannot retrieve LLM options. Error: ${error.message}`);
            return [];
        }

        if (!this.#isOperational || !this.#llmConfigs || !this.#llmConfigs.llms) {
            this.#logger.warn('ConfigurableLLMAdapter.getAvailableLlmOptions: Adapter is not operational or LLM configurations are not loaded. Returning empty array.');
            return [];
        }

        const llmsArray = Object.values(this.#llmConfigs.llms);
        if (llmsArray.length === 0) {
            this.#logger.warn('ConfigurableLLMAdapter.getAvailableLlmOptions: No LLM configurations found in this.#llmConfigs.llms. Returning empty array.');
            return [];
        }

        const options = llmsArray.map(config => ({
            id: config.id,
            displayName: config.displayName || config.id // Fallback to id if displayName is not present
        }));

        return options;
    }

    /**
     * Retrieves the ID of the currently active LLM.
     *
     * @public
     * @async
     * @returns {Promise<string | null>} A promise that resolves to the active LLM ID (string) or null if no LLM is active or adapter is not operational.
     */
    async getCurrentActiveLlmId() {
        try {
            await this.#ensureInitialized();
        } catch (error) {
            // #ensureInitialized already logs. AC: "If not operational, it logs a warning and returns null."
            this.#logger.warn(`ConfigurableLLMAdapter.getCurrentActiveLlmId: Adapter not operational. Cannot retrieve current active LLM ID. Error: ${error.message}`);
            return null;
        }

        // After #ensureInitialized, if it didn't throw, #isOperational is true.
        // So, we don't need an explicit check for this.#isOperational here again for returning null based on that,
        // as the catch block handles it. The main task is to return the ID.
        return this.#currentActiveLlmId;
    }


    /**
     * Generates an action and speech based on the provided game summary using a configured LLM.
     *
     * @async
     * @param {string} gameSummary - A string providing a summarized representation of the game state.
     * @returns {Promise<string>} A Promise that resolves to a JSON string representing the LLM's decision.
     * @throws {Error | ConfigurationError} If issues occur.
     */
    async getAIDecision(gameSummary) {
        // #ensureInitialized will throw if not initialized or not operational.
        // This is the desired behavior as getAIDecision cannot proceed otherwise.
        await this.#ensureInitialized();

        this.#logger.debug('ConfigurableLLMAdapter.getAIDecision called.', {
            activeLlmId: this.#currentActiveLlmId,
            gameSummaryLength: gameSummary ? gameSummary.length : 0
        });

        const activeConfig = this.#currentActiveLlmConfig; // Already retrieved by getCurrentActiveLlmConfig if needed, or directly accessible
        if (!activeConfig) {
            const msg = "No active LLM configuration is set. Use setActiveLlm() or ensure a valid defaultLlmId is in config.";
            this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
            throw new ConfigurationError(msg, {llmId: this.#currentActiveLlmId || 'unknown'});
        }

        try {
            // Validate critical fields of the active LLM configuration.
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
            // Enhanced validation for jsonOutputStrategy based on its method
            if (typeof activeConfig.jsonOutputStrategy !== 'object' || activeConfig.jsonOutputStrategy === null) {
                validationErrors.push({field: 'jsonOutputStrategy', reason: 'Is required and must be an object.'});
            } else {
                if (typeof activeConfig.jsonOutputStrategy.method !== 'string' || activeConfig.jsonOutputStrategy.method.trim() === '') {
                    validationErrors.push({
                        field: 'jsonOutputStrategy.method',
                        reason: 'Is required and must be a non-empty string.'
                    });
                } else {
                    const method = activeConfig.jsonOutputStrategy.method;
                    if (method === "tool_calling" && (typeof activeConfig.jsonOutputStrategy.toolName !== 'string' || activeConfig.jsonOutputStrategy.toolName.trim() === '')) {
                        validationErrors.push({
                            field: 'jsonOutputStrategy.toolName',
                            reason: 'Is required and must be a non-empty string when jsonOutputStrategy.method is "tool_calling".'
                        });
                    } else if (method === "gbnf_grammar" && (typeof activeConfig.jsonOutputStrategy.grammar !== 'string' || activeConfig.jsonOutputStrategy.grammar.trim() === '')) {
                        validationErrors.push({
                            field: 'jsonOutputStrategy.grammar',
                            reason: 'Is required and must be a non-empty string (representing grammar content or a path) when jsonOutputStrategy.method is "gbnf_grammar".'
                        });
                    }
                    // Add checks for other methods like "native_json_mode", "openrouter_json_schema" if they have specific required sub-properties.
                }
            }

            if (validationErrors.length > 0) {
                const errorDetailsMessage = validationErrors.map(err => `${err.field}: ${err.reason}`).join('; ');
                const msg = `Active LLM config '${activeConfig.id || 'unknown'}' is invalid: ${errorDetailsMessage}`;
                throw new ConfigurationError(msg, {llmId: activeConfig.id, problematicFields: validationErrors});
            }

            this.#logger.debug(`Attempting to retrieve API key for LLM '${activeConfig.id}'.`);
            const apiKey = await this.#apiKeyProvider.getKey(activeConfig, this.#environmentContext);
            const isCloudApi = CLOUD_API_TYPES.includes(activeConfig.apiType);

            // Determine if API key is strictly required
            const requiresApiKey = isCloudApi && this.#environmentContext.isServer();

            if (requiresApiKey && !apiKey) {
                const msg = `API key missing for server-side cloud LLM '${activeConfig.id}'. Key is required in this context.`;
                throw new ConfigurationError(msg, {llmId: activeConfig.id, problematicField: 'apiKey'});
            }

            if (apiKey) {
                this.#logger.info(`API key retrieved for LLM '${activeConfig.id}'.`);
            } else if (requiresApiKey) {
                // This case should ideally be caught by the block above, but as a safeguard:
                throw new ConfigurationError(`Critical: API key for LLM '${activeConfig.id}' required but unavailable.`, {
                    llmId: activeConfig.id,
                    problematicField: 'apiKey'
                });
            } else {
                // API key not required or not found, but not critical in this context (e.g., local LLM, or client-side with CORS)
                this.#logger.info(`API key not required or not found for LLM '${activeConfig.id}', proceeding. (Is Cloud API: ${isCloudApi}, Is Server: ${this.#environmentContext.isServer()})`);
            }


            let strategy;
            try {
                strategy = this.#llmStrategyFactory.getStrategy(activeConfig);
            } catch (factoryError) {
                // MODIFICATION START: Comment out or remove the logger call below
                /*
                this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: Failed to get strategy from factory for LLM '${activeConfig.id}'. Error: ${factoryError.message}`, {
                    llmId: activeConfig.id,
                    factoryError
                });
                */
                // MODIFICATION END
                throw new ConfigurationError(`Failed to get strategy from factory for LLM '${activeConfig.id}': ${factoryError.message}`, {
                    llmId: activeConfig.id,
                    originalError: factoryError
                });
            }

            if (!strategy) {
                // This should ideally be caught by the factory's error handling, but as a safeguard:
                const msg = `No suitable LLM strategy could be created for the active configuration '${activeConfig.id}'. Check factory logic and LLM config apiType.`;
                this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`, {llmId: activeConfig.id});
                throw new ConfigurationError(msg, {llmId: activeConfig.id});
            }

            this.#logger.info(`ConfigurableLLMAdapter.getAIDecision: Executing strategy for LLM '${activeConfig.id}'.`);
            return await strategy.execute({
                gameSummary,
                llmConfig: activeConfig,
                apiKey, // May be null if not required/found, strategy should handle this.
                environmentContext: this.#environmentContext
            });

        } catch (error) {
            const llmIdForLog = (activeConfig && activeConfig.id) || (error.llmId) || this.#currentActiveLlmId || 'unknown';
            const logDetails = {llmId: llmIdForLog, errorName: error.name};

            if (error instanceof ConfigurationError) {
                // ConfigurationErrors are more structured and likely have 'problematicFields' or 'problematicField'
                logDetails.problematicFields = error.problematicFields || error.problematicField;
                logDetails.originalErrorMessage = error.originalError ? error.originalError.message : undefined;
            } else {
                // For generic errors, include more raw details
                logDetails.errorDetails = {message: error.message, stack: error.stack, ...error};
            }
            this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: Error during getAIDecision for LLM '${llmIdForLog}': ${error.message}`, logDetails);
            throw error; // Re-throw the original error to be handled by the caller
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
     * FOR TESTING ONLY: Retrieves the loaded LLM configurations.
     * @returns {LLMConfigurationFile | null}
     */
    getLoadedConfigs_FOR_TESTING_ONLY() {
        return this.#llmConfigs;
    }

    /**
     * FOR TESTING ONLY: Retrieves the ID of the currently active LLM.
     * @returns {string | null}
     */
    getActiveLlmId_FOR_TESTING_ONLY() {
        return this.#currentActiveLlmId;
    }

    /**
     * FOR TESTING ONLY: Retrieves the execution environment string.
     * @returns {string}
     */
    getExecutionEnvironment_FOR_TESTING_ONLY() {
        return this.#environmentContext ? this.#environmentContext.getExecutionEnvironment() : 'unknown';
    }

    /**
     * FOR TESTING ONLY: Retrieves the project root path from environment context.
     * @returns {string | null}
     */
    getProjectRootPath_FOR_TESTING_ONLY() {
        return this.#environmentContext ? this.#environmentContext.getProjectRootPath() : null;
    }

    /**
     * FOR TESTING ONLY: Retrieves the proxy server URL from environment context.
     * @returns {string}
     */
    getProxyServerUrl_FOR_TESTING_ONLY() {
        return this.#environmentContext ? this.#environmentContext.getProxyServerUrl() : "";
    }

    /**
     * FOR TESTING ONLY: Retrieves the EnvironmentContext instance.
     * @returns {EnvironmentContext | null}
     */
    getEnvironmentContext_FOR_TESTING_ONLY() {
        return this.#environmentContext;
    }

    /**
     * FOR TESTING ONLY: Retrieves the IApiKeyProvider instance.
     * @returns {IApiKeyProvider | null}
     */
    getApiKeyProvider_FOR_TESTING_ONLY() {
        return this.#apiKeyProvider;
    }

    /**
     * FOR TESTING ONLY: Retrieves the LLMStrategyFactory instance.
     * @returns {LLMStrategyFactory | null}
     */
    getLlmStrategyFactory_FOR_TESTING_ONLY() {
        return this.#llmStrategyFactory;
    }
}

// --- FILE END ---