// src/turns/adapters/configurableLLMAdapter.js
// --- FILE START ---

import {ILLMAdapter} from '../interfaces/ILLMAdapter.js';
import {getApiKeyFromFile as getApiKeyFromFileSystem} from '../../utils/apiKeyFileRetriever.js';
import {Workspace_retry} from '../../utils/apiUtils.js';


/**
 * @typedef {import('../../services/llmConfigLoader.js').LlmConfigLoader} LlmConfigLoader
 * @typedef {import('../../services/llmConfigLoader.js').LLMConfigurationFile} LLMConfigurationFile
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../../services/llmConfigLoader.js').LoadConfigsErrorResult} LoadConfigsErrorResult
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../schemas/llmOutputSchemas.js').LLM_TURN_ACTION_SCHEMA} LLM_TURN_ACTION_SCHEMA_TYPE
 */

// MODIFICATION START (Sub-Ticket 1.4.4.8)
const DEFAULT_FALLBACK_ACTION = {
    actionDefinitionId: "core:wait",
    commandString: "wait",
    speech: "I am having trouble thinking right now."
};
const DEFAULT_FALLBACK_ACTION_JSON_STRING = JSON.stringify(DEFAULT_FALLBACK_ACTION);

// MODIFICATION END (Sub-Ticket 1.4.4.8)

// MODIFICATION START (Ticket 1.5.12)
const DEFAULT_PROXY_SERVER_URL = 'http://localhost:3001/api/llm-request'; // Default proxy URL for local development
// MODIFICATION END (Ticket 1.5.12)

// Define API types considered as cloud services that require key handling via proxy or direct server access
const CLOUD_API_TYPES = ['openrouter', 'openai', 'anthropic']; // Add other cloud types as needed


/**
 * Custom error class for configuration-related issues within the ConfigurableLLMAdapter.
 */
export class ConfigurationError extends Error {
    /**
     * Creates an instance of ConfigurationError.
     * @param {string} message - The error message.
     * @param {object} [details] - Additional details about the error.
     * @param {string} [details.llmId] - The ID of the LLM configuration that caused the error.
     * @param {string} [details.problematicField] - The name of the configuration field that is problematic.
     * @param {any} [details.fieldValue] - The value of the problematic field.
     */
    constructor(message, details = {}) {
        super(message);
        this.name = "ConfigurationError";
        this.llmId = details.llmId;
        this.problematicField = details.problematicField;
        this.fieldValue = details.fieldValue;
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
     * @private
     * @type {'client' | 'server' | 'unknown'}
     * @description The execution environment of the adapter.
     * 'client' implies API keys for cloud services must be proxied.
     * 'server' implies API keys for cloud services can be accessed directly.
     */
    #executionEnvironment = 'unknown';

    /**
     * @private
     * @type {string | null}
     * @description The root path of the project, used for resolving file paths on the server-side.
     * This MUST be set securely if the adapter is running server-side and needs file access.
     */
    #projectRootPath = null;

    // MODIFICATION START (Ticket 1.5.12)
    /**
     * @private
     * @type {string}
     * @description The URL of the backend proxy server for routing cloud LLM calls.
     */
    #proxyServerUrl;

    // MODIFICATION END (Ticket 1.5.12)


    /**
     * Creates an instance of ConfigurableLLMAdapter.
     * @param {object} dependencies - The dependencies for this adapter.
     * @param {ILogger} dependencies.logger - A logger instance.
     * @param {'client' | 'server'} [dependencies.executionEnvironment='unknown'] - Specifies the execution context.
     * 'client' means it's running in a browser-like environment where direct cloud API key access is insecure.
     * 'server' means it's running in a trusted backend environment.
     * @param {string} [dependencies.projectRootPath] - The absolute root path of the project.
     * Required if `executionEnvironment` is 'server' and file-based API key retrieval might be used.
     * This path must be securely determined and provided.
     * @param {string} [dependencies.proxyServerUrl] - The URL for the backend proxy server.
     * Required if `executionEnvironment` is 'client' and cloud LLMs are used.
     * If not provided for 'client' mode, a default URL (e.g., for local development) will be used.
     * @throws {Error} If a valid logger is not provided, or if projectRootPath is missing for server environment.
     */
    constructor({logger, executionEnvironment = 'unknown', projectRootPath = null, proxyServerUrl = null}) { // MODIFICATION (Ticket 1.5.12)
        super();
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            const errorMsg = 'ConfigurableLLMAdapter: Constructor requires a valid logger instance.';
            (logger && typeof logger.error === 'function' ? logger : console).error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#logger = logger;

        if (executionEnvironment === 'client' || executionEnvironment === 'server') {
            this.#executionEnvironment = executionEnvironment;
        } else {
            this.#executionEnvironment = 'unknown'; // Default or if an invalid value is passed
            this.#logger.warn(`ConfigurableLLMAdapter: Invalid executionEnvironment provided: '${executionEnvironment}'. Defaulting to 'unknown'. This may impact API key handling.`);
        }

        if (this.#executionEnvironment === 'server') {
            if (!projectRootPath || typeof projectRootPath !== 'string' || projectRootPath.trim() === '') {
                const errorMsg = "ConfigurableLLMAdapter: Constructor requires 'projectRootPath' for server-side execution environment when file-based API key retrieval might be used.";
                this.#logger.error(errorMsg);
                throw new Error(errorMsg);
            }
            this.#projectRootPath = projectRootPath.trim();
            this.#logger.debug(`ConfigurableLLMAdapter: Server-side projectRootPath set to: '${this.#projectRootPath}'`);
        } else if (projectRootPath) {
            this.#logger.warn(`ConfigurableLLMAdapter: 'projectRootPath' was provided but executionEnvironment is not 'server'. It will be ignored. Environment: ${this.#executionEnvironment}`);
        }

        // MODIFICATION START (Ticket 1.5.12)
        if (this.#executionEnvironment === 'client') {
            if (proxyServerUrl && typeof proxyServerUrl === 'string' && proxyServerUrl.trim() !== '') {
                try {
                    new URL(proxyServerUrl); // Validate if it's a valid URL structure
                    this.#proxyServerUrl = proxyServerUrl.trim();
                    this.#logger.info(`ConfigurableLLMAdapter: Client-side proxy URL configured to: '${this.#proxyServerUrl}'.`);
                } catch (e) {
                    this.#logger.warn(`ConfigurableLLMAdapter: Provided proxyServerUrl '${proxyServerUrl}' is not a valid URL. Falling back to default: '${DEFAULT_PROXY_SERVER_URL}'. Error: ${e.message}`);
                    this.#proxyServerUrl = DEFAULT_PROXY_SERVER_URL;
                }
            } else {
                this.#proxyServerUrl = DEFAULT_PROXY_SERVER_URL;
                if (proxyServerUrl === null || proxyServerUrl === undefined) {
                    this.#logger.info(`ConfigurableLLMAdapter: Client-side proxyServerUrl not provided. Using default: '${this.#proxyServerUrl}'.`);
                } else {
                    this.#logger.warn(`ConfigurableLLMAdapter: Client-side proxyServerUrl provided but was empty or invalid ('${proxyServerUrl}'). Using default: '${this.#proxyServerUrl}'.`);
                }
            }
        } else { // server or unknown environment
            this.#proxyServerUrl = proxyServerUrl || DEFAULT_PROXY_SERVER_URL; // Store it anyway, might be useful for hybrid or testing.
            if (proxyServerUrl) {
                this.#logger.debug(`ConfigurableLLMAdapter: executionEnvironment is '${this.#executionEnvironment}'. proxyServerUrl ('${proxyServerUrl}') was provided but primarily used for 'client' mode.`);
            } else {
                this.#logger.debug(`ConfigurableLLMAdapter: executionEnvironment is '${this.#executionEnvironment}'. proxyServerUrl not provided; default set internally but unlikely to be used in this mode.`);
            }
        }
        // MODIFICATION END (Ticket 1.5.12)


        this.#logger.info(`ConfigurableLLMAdapter: Instance created. Execution environment: ${this.#executionEnvironment}. Ready for initialization.`);
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
                // Task 2.1: Handle invalid default LLM ID
                this.#logger.warn(`ConfigurableLLMAdapter: 'defaultLlmId' ("${defaultLlmId}") is specified in configurations, but no LLM configuration with this ID exists. No default LLM set.`);
                this.#currentActiveLlmId = null;
                this.#currentActiveLlmConfig = null;
            }
        } else if (defaultLlmId) { // defaultLlmId exists but is not a valid string
            // Task 2.1: Handle invalid default LLM ID (modified for clarity)
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
            this.#isInitialized = true;
            this.#isOperational = false;
            this.#currentActiveLlmId = null;
            this.#currentActiveLlmConfig = null;
            throw new Error(errorMsg);
        }

        this.#configLoader = llmConfigLoader;
        this.#logger.info('ConfigurableLLMAdapter: Initialization started with LlmConfigLoader.');
        this.#currentActiveLlmId = null; // Reset active LLM state before loading
        this.#currentActiveLlmConfig = null;

        try {
            const configResult = await this.#configLoader.loadConfigs();

            // Task 1.1: Handle Configuration Load Failures
            if (configResult && 'error' in configResult && configResult.error === true) {
                const loadError = /** @type {LoadConfigsErrorResult} */ (configResult);
                this.#logger.error('ConfigurableLLMAdapter: Critical error loading LLM configurations.', {
                    message: loadError.message,
                    stage: loadError.stage,
                    path: loadError.path,
                    originalErrorMessage: loadError.originalError ? loadError.originalError.message : 'N/A'
                });
                this.#llmConfigs = null;
                // Task 1.2: Set #isOperational to false
                this.#isOperational = false;
            } else if (configResult && typeof configResult.llms === 'object' && configResult.llms !== null) {
                this.#llmConfigs = /** @type {LLMConfigurationFile} */ (configResult);
                this.#logger.info('ConfigurableLLMAdapter: LLM configurations loaded successfully.', {
                    numberOfConfigs: Object.keys(this.#llmConfigs.llms).length,
                    defaultLlmId: this.#llmConfigs.defaultLlmId || 'Not set'
                });
                this.#isOperational = true;
                this.#setDefaultActiveLlm(); // Set default LLM after successful load
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
            this.#currentActiveLlmId = null; // Ensure no active LLM if not operational
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
            // This case should ideally be covered by #isOperational, but as a safeguard:
            this.#logger.error(`ConfigurableLLMAdapter.setActiveLlm: LLM configurations are not loaded. Cannot set LLM ID '${llmId}'.`);
            return false;
        }
        // Task 2.2.1: Handle invalid llmId
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
            // Task 2.2.2: Handle llmId not found
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
    getCurrentActiveLlmConfig() { // AC: 2 (Sub-Ticket 1.4.4.2 implies this)
        if (!this.#isOperational) {
            this.#logger.warn('ConfigurableLLMAdapter.getCurrentActiveLlmConfig: Adapter is not operational. Returning null.');
            return null;
        }
        if (!this.#currentActiveLlmConfig) {
            this.#logger.debug('ConfigurableLLMAdapter.getCurrentActiveLlmConfig: No LLM configuration is currently active. Returning null.');
        }
        return this.#currentActiveLlmConfig;
    }

    /**
     * Constructs the prompt-related part of the payload for an LLM API request.
     * This method uses the `promptFrame` from the LLM configuration to structure
     * the `gameSummary` appropriately for the target LLM's API. [cite: 778, 1119]
     *
     * @private
     * @param {string} gameSummary - The detailed textual representation of the game state.
     * @param {object | string | undefined} promptFrame - The promptFrame object from the LLM configuration. [cite: 778, 1119]
     * @param {string} apiType - The apiType string from the LLM configuration. [cite: 745, 1118]
     * @returns {object} An object containing either a `messages` array or a `prompt` string,
     * suitable for inclusion in the LLM API request payload.
     * Example: `{ messages: [...] }` or `{ prompt: "..." }`.
     */
    _constructPromptPayload(gameSummary, promptFrame, apiType) {
        this.#logger.debug(`ConfigurableLLMAdapter._constructPromptPayload: Constructing prompt. apiType: '${apiType}'.`, {promptFrame}); // Log promptFrame [Sub-Ticket 1.4.4.6.3 AC1.1]

        const messages = [];
        let finalGameSummary = gameSummary; // AC2.3 (gameSummary used as primary content)

        const hasActualPromptFrameObject = promptFrame && typeof promptFrame === 'object' && Object.keys(promptFrame).length > 0;
        const isNonEmptyStringPromptFrame = typeof promptFrame === 'string' && promptFrame.trim() !== '';
        const localApiTypesForLogging = ['ollama', 'llama_cpp_server_openai_compatible', 'tgi_openai_compatible']; // For logging warning

        if (isNonEmptyStringPromptFrame) {
            // If promptFrame is a non-empty string, it's treated as a system message for chat APIs,
            // or prepended for non-chat APIs.
            if (['openai', 'openrouter', 'anthropic'].includes(apiType)) { // AC2.2
                messages.push({role: "system", content: promptFrame.trim()}); // AC2.1
            } else {
                finalGameSummary = `${promptFrame.trim()}\n\n${gameSummary}`; // AC2.2
            }
        } else if (hasActualPromptFrameObject) { // promptFrame is an object with properties
            if (typeof promptFrame.system === 'string' && promptFrame.system.trim() !== '') { // AC2.1
                messages.push({role: "system", content: promptFrame.system.trim()});
            }
            if (typeof promptFrame.user_prefix === 'string' && promptFrame.user_prefix.trim() !== '') { // AC2.4
                finalGameSummary = `${promptFrame.user_prefix.trim()} ${finalGameSummary}`;
            }
            if (typeof promptFrame.user_suffix === 'string' && promptFrame.user_suffix.trim() !== '') { // AC2.4
                finalGameSummary = `${finalGameSummary} ${promptFrame.user_suffix.trim()}`;
            }
        } else { // promptFrame is missing, an empty object, or an empty string (AC2.5)
            if (apiType === 'openai' || apiType === 'openrouter' || apiType === 'anthropic') {
                this.#logger.warn(`ConfigurableLLMAdapter._constructPromptPayload: promptFrame is missing or effectively empty for chat-like apiType '${apiType}'. Applying default user message structure. Consider defining a promptFrame for optimal results.`);
            } else if (apiType && !localApiTypesForLogging.includes(apiType) && !['openai', 'openrouter', 'anthropic'].includes(apiType)) { // Non-local, non-chat, and no promptFrame but might benefit
                this.#logger.warn(`ConfigurableLLMAdapter._constructPromptPayload: promptFrame is missing or effectively empty for apiType '${apiType}' which might benefit from it. Applying default prompt string structure.`);
            }
        }


        if (['openai', 'openrouter', 'anthropic'].includes(apiType)) { // AC2.2, AC2.5 (Default)
            messages.push({role: "user", content: finalGameSummary.trim()}); // AC2.3
            // AC3.5 (Logging final prompt data)
            this.#logger.debug("ConfigurableLLMAdapter._constructPromptPayload: Constructed 'messages' array:", messages.map(m => ({
                role: m.role,
                contentPreview: typeof m.content === 'string' ? m.content.substring(0, 70) + (m.content.length > 70 ? '...' : '') : '[Non-string content]'
            })));
            return {messages};
        } else { // AC2.2, AC2.5 (Default)
            // AC3.5 (Logging final prompt data)
            this.#logger.debug(`ConfigurableLLMAdapter._constructPromptPayload: Constructed single 'prompt' string. Preview: ${finalGameSummary.trim().substring(0, 70) + (finalGameSummary.trim().length > 70 ? '...' : '')}`);
            return {prompt: finalGameSummary.trim()};
        }
    }

    // MODIFICATION START (Sub-Ticket 1.4.4.8)
    /**
     * @private
     * Logs a severe error and returns a Promise resolving to the default stubbed action JSON.
     * @param {string} reason - The reason for falling back to stub.
     * @param {object} [details={}] - Additional details for logging.
     * @returns {Promise<string>} A promise resolving to the default fallback action JSON string.
     */
    _getFallbackActionPromise(reason, details = {}) {
        this.#logger.error(`ConfigurableLLMAdapter: Critical failure - ${reason}. Returning stubbed fallback action.`, details);
        return Promise.resolve(DEFAULT_FALLBACK_ACTION_JSON_STRING);
    }

    // MODIFICATION END (Sub-Ticket 1.4.4.8)


    /**
     * Generates an action and speech based on the provided game summary using a configured LLM.
     *
     * @async
     * @param {string} gameSummary - A string providing a summarized representation
     * of the current game state and relevant actor information.
     * @returns {Promise<string>} A Promise that resolves to a JSON string
     * conforming to the LLM_TURN_ACTION_SCHEMA.
     * @throws {Error | ConfigurationError} If the adapter is not operational, not initialized, no active LLM is set,
     * essential configuration is missing/invalid, or if the method is not yet implemented or an API call fails critically.
     */
    async getAIDecision(gameSummary) {
        this.#logger.debug('ConfigurableLLMAdapter.getAIDecision called.', { // Renamed from generateAction to getAIDecision
            isOperational: this.#isOperational,
            activeLlmId: this.#currentActiveLlmId,
            gameSummaryLength: gameSummary ? gameSummary.length : 0
        });

        if (!this.#isInitialized) {
            return this._getFallbackActionPromise("Adapter not initialized. Call init() first.");
        }

        if (!this.#isOperational) {
            return this._getFallbackActionPromise("Adapter is not operational due to configuration loading issues.");
        }

        const activeConfig = this.getCurrentActiveLlmConfig();
        if (!activeConfig) {
            return this._getFallbackActionPromise("No active LLM configuration is set. Use setActiveLlm() or set a defaultLlmId.");
        }

        const {
            id: configId,
            endpointUrl: llmProviderEndpointUrl, // Renamed to avoid clash with call target
            modelIdentifier,
            defaultParameters,
            providerSpecificHeaders,
            promptFrame,
            apiType,
            jsonOutputStrategy,
            apiKeyEnvVar,
            apiKeyFileName // Added from research doc's config structure
        } = activeConfig;

        const validationErrors = [];

        if (!llmProviderEndpointUrl || typeof llmProviderEndpointUrl !== 'string' || llmProviderEndpointUrl.trim() === '') {
            validationErrors.push({
                field: 'endpointUrl',
                value: llmProviderEndpointUrl,
                reason: 'Missing or invalid (must be a non-empty string)'
            });
        }
        if (!modelIdentifier || typeof modelIdentifier !== 'string' || modelIdentifier.trim() === '') {
            validationErrors.push({
                field: 'modelIdentifier',
                value: modelIdentifier,
                reason: 'Missing or invalid (must be a non-empty string)'
            });
        }
        if (!apiType || typeof apiType !== 'string' || apiType.trim() === '') {
            validationErrors.push({
                field: 'apiType',
                value: apiType,
                reason: 'Missing or invalid (must be a non-empty string)'
            });
        }
        if (!jsonOutputStrategy || typeof jsonOutputStrategy !== 'object') {
            validationErrors.push({
                field: 'jsonOutputStrategy',
                value: jsonOutputStrategy,
                reason: 'Missing or invalid (must be an object)'
            });
        } else {
            if (!jsonOutputStrategy.method || typeof jsonOutputStrategy.method !== 'string' || jsonOutputStrategy.method.trim() === '') {
                validationErrors.push({
                    field: 'jsonOutputStrategy.method',
                    value: jsonOutputStrategy.method,
                    reason: 'Missing or invalid (must be a non-empty string)'
                });
            }
        }

        if (validationErrors.length > 0) {
            const errorDetailsMessage = validationErrors.map(err => `${err.field}: ${err.reason} (value: ${JSON.stringify(err.value)})`).join('; ');
            return this._getFallbackActionPromise(
                `Active LLM config '${configId}' is missing essential field(s): ${errorDetailsMessage}`,
                {
                    llmId: configId,
                    problematicFields: validationErrors.map(e => ({field: e.field, value: e.value, reason: e.reason}))
                }
            );
        }

        this.#logger.info(
            `ConfigurableLLMAdapter: Preparing API call for LLM ID: '${configId}' (${activeConfig.displayName || 'N/A'}). API Type: '${apiType}', JSON Strategy: '${jsonOutputStrategy?.method || 'N/A'}'.`
        );

        let currentStrategyMethod = jsonOutputStrategy.method.trim();
        let actualApiKeyForServer = null; // Used if server-side and cloud

        const isCloudService = CLOUD_API_TYPES.includes(apiType);
        let callGoesToProxy = false;
        // MODIFICATION START (Ticket 1.5.12)
        let finalEndpointForRetry = llmProviderEndpointUrl; // Default to direct call (provider's endpoint)
        // MODIFICATION END (Ticket 1.5.12)
        let finalPayloadForRetry; // Will be set below
        let finalHeadersForRetry; // Will be set below


        if (isCloudService) {
            if (this.#executionEnvironment === 'client') {
                this.#logger.debug(`Adapter running in client-side mode for cloud service LLM '${configId}'. Call will be proxied via '${this.#proxyServerUrl}'.`);
                if ((!apiKeyEnvVar || apiKeyEnvVar.trim() === '') && (!apiKeyFileName || apiKeyFileName.trim() === '')) {
                    return this._getFallbackActionPromise(
                        `Client-side - API key identifier (apiKeyEnvVar or apiKeyFileName) missing in config for cloud LLM '${configId}'. Proxy would not be ableto retrieve key.`,
                        {llmId: configId}
                    );
                }
                callGoesToProxy = true; // Mark that this call needs to go through the proxy
                // MODIFICATION START (Ticket 1.5.12)
                finalEndpointForRetry = this.#proxyServerUrl; // Use configured or default proxy URL
                // MODIFICATION END (Ticket 1.5.12)

            } else if (this.#executionEnvironment === 'server') {
                this.#logger.debug(`Adapter running in server-side mode for cloud service LLM '${configId}'. Key will be retrieved directly.`);
                let serverKeyRetrievalFailed = false;

                if (apiKeyEnvVar && typeof apiKeyEnvVar === 'string' && apiKeyEnvVar.trim() !== '') {
                    this.#logger.debug(`ConfigurableLLMAdapter: Server-side - Attempting API key retrieval from env var: '${apiKeyEnvVar}' for LLM '${configId}'.`);
                    try {
                        if (typeof process === 'object' && process !== null && typeof process.env === 'object' && process.env !== null) {
                            const envValue = process.env[apiKeyEnvVar];
                            if (envValue && typeof envValue === 'string' && envValue.trim() !== '') {
                                actualApiKeyForServer = envValue.trim();
                                this.#logger.info(`ConfigurableLLMAdapter: Server-side - API key retrieved from env var '${apiKeyEnvVar}' for LLM '${configId}'.`);
                            } else {
                                this.#logger.error(`ConfigurableLLMAdapter: Server-side - API key environment variable '${apiKeyEnvVar}' not found or empty for LLM '${configId}'.`);
                                serverKeyRetrievalFailed = true;
                            }
                        } else {
                            this.#logger.error(`ConfigurableLLMAdapter: Server-side - 'process.env' is not available. Cannot retrieve API key from env var '${apiKeyEnvVar}' for LLM '${configId}'.`);
                            serverKeyRetrievalFailed = true;
                        }
                    } catch (e) {
                        this.#logger.error(`ConfigurableLLMAdapter: Server-side - Error accessing process.env for env var '${apiKeyEnvVar}'. Error: ${e.message}`, {error: e});
                        serverKeyRetrievalFailed = true;
                    }
                } else if (apiKeyFileName && typeof apiKeyFileName === 'string' && apiKeyFileName.trim() !== '') {
                    this.#logger.debug(`ConfigurableLLMAdapter: Server-side - Attempting API key retrieval from file: '${apiKeyFileName}' for LLM '${configId}'.`);
                    if (!this.#projectRootPath) {
                        this.#logger.error("ConfigurableLLMAdapter: Server-side - 'projectRootPath' is not set. Cannot retrieve API key from file.");
                        serverKeyRetrievalFailed = true;
                    } else {
                        try {
                            const fileKey = await getApiKeyFromFileSystem(apiKeyFileName, this.#projectRootPath, this.#logger);
                            if (fileKey && typeof fileKey === 'string' && fileKey.trim() !== '') {
                                actualApiKeyForServer = fileKey.trim();
                                this.#logger.info(`ConfigurableLLMAdapter: Server-side - API key retrieved from file '${apiKeyFileName}' for LLM '${configId}'.`);
                            } else {
                                this.#logger.error(`ConfigurableLLMAdapter: Server-side - Failed to retrieve a valid API key from file '${apiKeyFileName}' for LLM '${configId}'. File retriever returned null or empty key.`);
                                serverKeyRetrievalFailed = true;
                            }
                        } catch (fileError) {
                            this.#logger.error(`ConfigurableLLMAdapter: Server-side - Error during API key retrieval from file '${apiKeyFileName}' for LLM '${configId}'. Error: ${fileError.message}`, {error: fileError});
                            serverKeyRetrievalFailed = true;
                        }
                    }
                } else {
                    this.#logger.error(`ConfigurableLLMAdapter: Server-side - No 'apiKeyEnvVar' or 'apiKeyFileName' specified for cloud service LLM '${configId}'. API key retrieval failed.`);
                    serverKeyRetrievalFailed = true;
                }

                if (serverKeyRetrievalFailed) {
                    return this._getFallbackActionPromise(
                        `Server-side - API key for cloud service LLM '${configId}' could not be retrieved. Source specified: ${apiKeyEnvVar ? `env var '${apiKeyEnvVar}'` : apiKeyFileName ? `file '${apiKeyFileName}'` : 'None'}.`,
                        {llmId: configId}
                    );
                }
            } else { // 'unknown' environment
                return this._getFallbackActionPromise(
                    `Execution environment is 'unknown' for cloud service LLM '${configId}'. API key cannot be securely handled or retrieved.`,
                    {llmId: configId}
                );
            }
        } else { // Not a cloud service (i.e., local)
            this.#logger.debug(`ConfigurableLLMAdapter: Active LLM '${configId}' (apiType: ${apiType}) is local. Direct API key handling is bypassed. Direct call will be made.`);
            // finalEndpointForRetry remains llmProviderEndpointUrl (set by default)
        }


        const promptPayloadContent = this._constructPromptPayload(gameSummary, promptFrame, apiType);

        // This is the payload intended for the actual LLM provider
        const payloadForLLMProvider = {
            ...(defaultParameters && typeof defaultParameters === 'object' ? defaultParameters : {}),
            model: modelIdentifier,
            ...promptPayloadContent
        };

        this.#logger.info(`ConfigurableLLMAdapter.getAIDecision: LLM '${configId}': Using JSON output strategy - ${currentStrategyMethod}.`);

        // TODO: Implement strategy-specific payload modifications for payloadForLLMProvider
        // The existing switch statement for currentStrategyMethod should modify payloadForLLMProvider
        // This part is from the original code and needs to be filled in based on other tickets.
        // For Ticket 1.5.11/1.5.12, we assume payloadForLLMProvider is correctly formed for the target LLM.
        switch (currentStrategyMethod) {
            case 'openrouter_json_schema':
                this.#logger.debug(`ConfigurableLLMAdapter.getAIDecision: Preparing for 'openrouter_json_schema' strategy for LLM '${configId}'.`);
                if (apiType === 'openrouter') {
                    // Example: payloadForLLMProvider.response_format = { type: 'json_schema', json_schema: {...} };
                    this.#logger.info(`ConfigurableLLMAdapter.getAIDecision: TODO - Implement payload modification for 'openrouter_json_schema' strategy. Current payload:`, payloadForLLMProvider);
                } else {
                    this.#logger.warn(`ConfigurableLLMAdapter.getAIDecision: 'openrouter_json_schema' strategy selected for non-OpenRouter apiType '${apiType}' for LLM '${configId}'. This strategy might not apply. Proceeding as if 'prompt_engineering'.`);
                }
                break;
            // ... other cases for tool_calling, gbnf_grammar, native_json_mode ...
            case 'tool_calling':
            case 'gbnf_grammar':
            case 'native_json_mode':
            case 'prompt_engineering':
            default:
                this.#logger.debug(`ConfigurableLLMAdapter.getAIDecision: Strategy '${currentStrategyMethod}' for LLM '${configId}'. Payload constructed from promptFrame used. TODO: Implement specific logic if needed.`);
                break;
        }

        this.#logger.debug(`ConfigurableLLMAdapter: Constructed payload for LLM provider '${configId}' (before proxy consideration):`, {
            payloadPreview: JSON.stringify(payloadForLLMProvider).substring(0, 200) + '...'
        });


        if (callGoesToProxy) {
            // finalEndpointForRetry is already set to this.#proxyServerUrl
            const targetHeadersForProxyPayload = (providerSpecificHeaders && typeof providerSpecificHeaders === 'object' ? providerSpecificHeaders : {});

            finalPayloadForRetry = {
                llmId: configId,
                targetPayload: payloadForLLMProvider,
                targetHeaders: targetHeadersForProxyPayload
            };
            finalHeadersForRetry = {
                'Content-Type': 'application/json'
                // Authorization is NOT included in the request to the proxy by the client adapter
            };
            this.#logger.info(`ConfigurableLLMAdapter: Client-side call to cloud LLM '${configId}' will be routed through proxy: ${finalEndpointForRetry}.`);
            this.#logger.debug("Proxy request payload:", {
                llmId: finalPayloadForRetry.llmId,
                targetPayloadKeys: Object.keys(finalPayloadForRetry.targetPayload),
                targetHeaderKeys: Object.keys(finalPayloadForRetry.targetHeaders),
            });

        } else { // Direct call (server-side or local LLM)
            // finalEndpointForRetry remains llmProviderEndpointUrl
            finalPayloadForRetry = payloadForLLMProvider;
            const baseHeadersDirect = {'Content-Type': 'application/json'};
            finalHeadersForRetry = {
                ...(providerSpecificHeaders && typeof providerSpecificHeaders === 'object' ? providerSpecificHeaders : {}),
                ...baseHeadersDirect
            };

            if (this.#executionEnvironment === 'server' && actualApiKeyForServer && isCloudService) {
                finalHeadersForRetry['Authorization'] = `Bearer ${actualApiKeyForServer}`;
                this.#logger.debug(`ConfigurableLLMAdapter: Server-side direct call to cloud LLM '${configId}'. Authorization header added.`);
            } else if (isCloudService) { // Client-side trying direct call to cloud (should not happen if proxy logic is correct) or unknown env
                this.#logger.warn(`ConfigurableLLMAdapter: Direct call to cloud service '${configId}' but API key handling might be misconfigured for current environment ('${this.#executionEnvironment}'). Authorization might be missing.`);
            } else { // Local LLM
                this.#logger.debug(`ConfigurableLLMAdapter: Direct call to local LLM '${configId}'. No Authorization header typically needed from adapter.`);
            }
        }


        this.#logger.debug(`ConfigurableLLMAdapter: Final parameters for Workspace_retry for '${configId}':`, {
            endpoint: finalEndpointForRetry,
            payloadKeys: finalPayloadForRetry ? Object.keys(finalPayloadForRetry) : 'N/A',
            headerKeys: finalHeadersForRetry ? Object.keys(finalHeadersForRetry) : 'N/A',
            isProxied: callGoesToProxy
        });


        let rawLlmResponse;
        const retryMaxRetries = defaultParameters?.maxRetries ?? 3;
        const retryBaseDelayMs = defaultParameters?.baseDelayMs ?? 1000;
        const retryMaxDelayMs = defaultParameters?.maxDelayMs ?? 10000;


        try {
            this.#logger.info(`ConfigurableLLMAdapter: Attempting API call to ${finalEndpointForRetry} for LLM '${configId}' (Strategy: '${currentStrategyMethod}', Proxied: ${callGoesToProxy})...`);
            rawLlmResponse = await Workspace_retry(
                finalEndpointForRetry,
                {
                    method: 'POST',
                    headers: finalHeadersForRetry,
                    body: JSON.stringify(finalPayloadForRetry)
                },
                retryMaxRetries,
                retryBaseDelayMs,
                retryMaxDelayMs
            );

            const responsePreview = JSON.stringify(rawLlmResponse)?.substring(0, 200) + (JSON.stringify(rawLlmResponse)?.length > 200 ? '...' : '');
            this.#logger.debug(`ConfigurableLLMAdapter: API call successful for ${configId}. Response preview: ${responsePreview}`);

            // Workspace_retry returns parsed JSON. The contract is to return a JSON string.
            // This part might need review based on ILLMResponseProcessor expectations.
            // For now, assuming it needs to be re-stringified if Workspace_retry already parsed.
            // If Workspace_retry returns string, then no change needed.
            // Based on apiUtils.js, Workspace_retry returns response.json(), so it's an object.
            if (typeof rawLlmResponse === 'object') {
                return JSON.stringify(rawLlmResponse);
            }
            return String(rawLlmResponse); // Fallback if not object, though not expected from Workspace_retry


        } catch (error) {
            this.#logger.error(`ConfigurableLLMAdapter: API call failed for ${configId} (Endpoint: ${finalEndpointForRetry}, Strategy: '${currentStrategyMethod}', Proxied: ${callGoesToProxy}). Error: ${error.message}`, {
                llmId: configId,
                endpoint: finalEndpointForRetry,
                strategy: currentStrategyMethod,
                isProxied: callGoesToProxy,
                originalError: error // Log the full error object for details from Workspace_retry
            });
            // The error from Workspace_retry should be propagated up.
            // If a fallback is desired here for API call failures, it would be:
            // return this._getFallbackActionPromise(`API call failed for ${configId}: ${error.message}`, { originalError: error });
            // However, current structure implies Workspace_retry errors propagate.
            throw error;
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
     * Retrieves the current execution environment of the adapter.
     * Primarily for testing or debugging purposes.
     * @returns {'client' | 'server' | 'unknown'} The execution environment.
     */
    getExecutionEnvironment_FOR_TESTING_ONLY() {
        return this.#executionEnvironment;
    }

    /**
     * Retrieves the project root path.
     * Primarily for testing or debugging purposes.
     * @returns {string | null} The project root path.
     */
    getProjectRootPath_FOR_TESTING_ONLY() {
        return this.#projectRootPath;
    }

    // MODIFICATION START (Ticket 1.5.12)
    /**
     * Retrieves the configured proxy server URL.
     * Primarily for testing or debugging purposes.
     * @returns {string} The proxy server URL.
     */
    getProxyServerUrl_FOR_TESTING_ONLY() {
        return this.#proxyServerUrl;
    }

    // MODIFICATION END (Ticket 1.5.12)
}

// --- FILE END ---