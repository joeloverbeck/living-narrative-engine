// src/turns/adapters/configurableLLMAdapter.js
// --- FILE START ---

import {ILLMAdapter} from '../interfaces/ILLMAdapter.js';
import {getApiKeyFromFile as getApiKeyFromFileSystem} from '../../utils/apiKeyFileRetriever.js';
import {Workspace_retry} from '../../utils/apiUtils.js';

// +++ ADD IMPORTS FOR BASE STRATEGIES +++
import {BaseChatLLMStrategy} from '../../llms/strategies/base/BaseChatLLMStrategy.js'; // Adjust path as per your structure
import {BaseCompletionLLMStrategy} from '../../llms/strategies/base/BaseCompletionLLMStrategy.js'; // Adjust path

/**
 * @typedef {import('../../services/llmConfigLoader.js').LlmConfigLoader} LlmConfigLoader
 * @typedef {import('../../services/llmConfigLoader.js').LLMConfigurationFile} LLMConfigurationFile
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../../services/llmConfigLoader.js').LoadConfigsErrorResult} LoadConfigsErrorResult
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../schemas/llmOutputSchemas.js').LLM_TURN_ACTION_SCHEMA} LLM_TURN_ACTION_SCHEMA_TYPE
 */

const DEFAULT_FALLBACK_ACTION = {
    actionDefinitionId: "core:wait",
    commandString: "wait",
    speech: "I am having trouble thinking right now."
};
const DEFAULT_FALLBACK_ACTION_JSON_STRING = JSON.stringify(DEFAULT_FALLBACK_ACTION);

const DEFAULT_PROXY_SERVER_URL = 'http://localhost:3001/api/llm-request';

const CLOUD_API_TYPES = ['openrouter', 'openai', 'anthropic'];

// MODIFICATION START (Ticket 2.2)
const OPENAI_TOOL_NAME = "game_ai_action_speech";
const ANTHROPIC_TOOL_NAME = "get_game_ai_action_speech";
const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";

const GAME_AI_ACTION_SPEECH_TOOL_PARAMETERS_SCHEMA = {
    type: "object",
    properties: {
        action: {
            type: "string",
            description: "The specific game command or action to be performed by the character (e.g., 'MOVE_NORTH', 'PICKUP_ITEM lantern'). Must be a valid game command."
        },
        speech: {
            type: "string",
            description: "The line of dialogue the character should speak. Can be an empty string if no speech is appropriate."
        }
    },
    required: ["action", "speech"]
};
// MODIFICATION END (Ticket 2.2)

// MODIFICATION START (Ticket 2.3)
const OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA = {
    name: "game_ai_action_speech_output", // A descriptive name for the schema
    strict: true, // Enforces strict adherence, disallowing additional properties
    schema: { // The JSON Schema object itself
        type: "object",
        properties: {
            action: {
                type: "string",
                description: "A concise game command string representing the character's action (e.g., 'USE_ITEM torch', 'LOOK_AROUND', 'SPEAK_TO goblin')." //
            },
            speech: {
                type: "string",
                description: "The exact line of dialogue the character should speak. Can be empty if no speech is appropriate." //
            }
        },
        required: ["action", "speech"] //
    }
};

// MODIFICATION END (Ticket 2.3)


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

    /**
     * @private
     * @type {string}
     * @description The URL of the backend proxy server for routing cloud LLM calls.
     */
    #proxyServerUrl;


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
    constructor({logger, executionEnvironment = 'unknown', projectRootPath = null, proxyServerUrl = null}) {
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
            this.#executionEnvironment = 'unknown';
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

        if (this.#executionEnvironment === 'client') {
            if (proxyServerUrl && typeof proxyServerUrl === 'string' && proxyServerUrl.trim() !== '') {
                try {
                    new URL(proxyServerUrl);
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
        } else {
            this.#proxyServerUrl = proxyServerUrl || DEFAULT_PROXY_SERVER_URL;
            if (proxyServerUrl) {
                this.#logger.debug(`ConfigurableLLMAdapter: executionEnvironment is '${this.#executionEnvironment}'. proxyServerUrl ('${proxyServerUrl}') was provided but primarily used for 'client' mode.`);
            } else {
                this.#logger.debug(`ConfigurableLLMAdapter: executionEnvironment is '${this.#executionEnvironment}'. proxyServerUrl not provided; default set internally but unlikely to be used in this mode.`);
            }
        }


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
            this.#isInitialized = true;
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

    // --- _constructPromptPayload method has been REMOVED ---

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

    // MODIFICATION START (Ticket 2.2)
    /**
     * @private
     * Executes an API call to an LLM provider, handling proxying for client-side calls
     * and direct calls for server-side or local LLMs.
     *
     * @param {LLMModelConfig} llmConfig - The active LLM configuration, potentially augmented with dynamic headers.
     * @param {object} llmApiPayload - The actual payload to be sent to the LLM API (or to the proxy).
     * @param {string | null} activeApiKeyForServerCall - The API key to use for server-side cloud calls; null otherwise.
     * @returns {Promise<any>} A promise resolving with the parsed JSON response from the LLM API or proxy.
     * @throws {Error | ConfigurationError} If the call fails after retries or due to configuration issues.
     */
    async _executeApiCall(llmConfig, llmApiPayload, activeApiKeyForServerCall) {
        const {id: configId, endpointUrl, apiType, apiKeyEnvVar, apiKeyFileName, providerSpecificHeaders} = llmConfig;
        const isCloudService = CLOUD_API_TYPES.includes(apiType);

        let finalEndpointUrl = endpointUrl;
        let finalHeaders = {'Content-Type': 'application/json', ...(providerSpecificHeaders || {})};
        let finalBodyPayload = llmApiPayload;

        const retryParams = {
            maxRetries: (apiType === 'ollama' || apiType.startsWith('local')) ? 2 : 3, // Fewer retries for local
            baseDelayMs: (apiType === 'ollama' || apiType.startsWith('local')) ? 500 : 1000,
            maxDelayMs: (apiType === 'ollama' || apiType.startsWith('local')) ? 2000 : 10000
        };

        if (isCloudService) {
            if (this.#executionEnvironment === 'client') {
                this.#logger.debug(`_executeApiCall: Client-side call for LLM '${configId}'. Using proxy: ${this.#proxyServerUrl}`);
                finalEndpointUrl = this.#proxyServerUrl;
                const proxyPayload = {
                    targetLlmConfig: {
                        endpointUrl: endpointUrl,
                        modelIdentifier: llmConfig.modelIdentifier,
                        apiType: apiType,
                        apiKeyEnvVar: apiKeyEnvVar,
                        apiKeyFileName: apiKeyFileName,
                        providerSpecificHeaders: providerSpecificHeaders // Proxy will use these
                    },
                    llmRequestPayload: llmApiPayload
                };
                finalBodyPayload = proxyPayload;
                // Client sends only Content-Type to proxy; proxy adds auth headers
                finalHeaders = {'Content-Type': 'application/json'};
            } else if (this.#executionEnvironment === 'server') {
                if (!activeApiKeyForServerCall) {
                    this.#logger.error(`_executeApiCall: Server-side call for cloud LLM '${configId}' but no API key provided.`);
                    throw new ConfigurationError(`Missing API key for server-side call to ${configId}`, {llmId: configId});
                }
                // For OpenRouter and OpenAI, Authorization: Bearer is standard.
                // For Anthropic, x-api-key is used without Bearer.
                if (apiType === 'anthropic') {
                    finalHeaders['x-api-key'] = activeApiKeyForServerCall;
                    // Anthropic might not use Bearer token, ensure it's not set if x-api-key is primary
                    delete finalHeaders['Authorization'];
                } else { // OpenAI, OpenRouter typically use Bearer token
                    finalHeaders['Authorization'] = `Bearer ${activeApiKeyForServerCall}`;
                }
            } else { // unknown environment
                this.#logger.error(`_executeApiCall: Unknown execution environment for cloud LLM '${configId}'. Cannot make call securely.`);
                throw new ConfigurationError(`Unknown execution environment for ${configId}`, {llmId: configId});
            }
        }
        // For local LLMs, finalEndpointUrl, finalHeaders, and finalBodyPayload are already set appropriately.

        this.#logger.debug(`_executeApiCall: Making API call to '${finalEndpointUrl}' for LLM '${configId}'.`, {
            method: 'POST',
            // headers: finalHeaders, // Be cautious logging headers if they contain sensitive info not managed by proxy
            payloadLength: JSON.stringify(finalBodyPayload)?.length
        });

        return Workspace_retry(
            finalEndpointUrl,
            {
                method: 'POST',
                headers: finalHeaders,
                body: JSON.stringify(finalBodyPayload)
            },
            retryParams.maxRetries,
            retryParams.baseDelayMs,
            retryParams.maxDelayMs
        );
    }


    /**
     * @private
     * Handles LLM interaction using the "Tool Calling" JSON output strategy.
     * This method constructs the API request with tool definitions for OpenAI or Anthropic
     * and processes the LLM's response to extract tool arguments.
     * @param {string} gameSummary - The current game state summary.
     * @param {LLMModelConfig} llmConfig - The active LLM configuration.
     * @param {string | null} activeApiKeyForServerCall - The API key for server-side cloud calls, or null.
     * @returns {Promise<string>} A promise resolving to a JSON string representing the tool arguments.
     * @throws {Error | ConfigurationError} If the API call fails, the response structure is unexpected,
     * or the apiType is not supported for tool calling.
     */
    async _handleToolCalling(gameSummary, llmConfig, activeApiKeyForServerCall) {
        this.#logger.info(`ConfigurableLLMAdapter._handleToolCalling invoked for LLM '${llmConfig.id}'. apiType: ${llmConfig.apiType}`);

        // Use new prompt construction via BaseChatLLMStrategy
        const promptBuilder = new BaseChatLLMStrategy(this.#logger);
        const basePayloadPromptPart = promptBuilder._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);

        let providerRequestPayload;
        let dynamicProviderHeaders = {}; // For headers like anthropic-version

        if (llmConfig.apiType === 'openai') {
            const openAiTool = {
                type: "function",
                function: {
                    name: OPENAI_TOOL_NAME,
                    description: "Extracts the character's next game action and speech based on the situation. Both action and speech are required.",
                    parameters: GAME_AI_ACTION_SPEECH_TOOL_PARAMETERS_SCHEMA
                }
            };
            providerRequestPayload = {
                ...llmConfig.defaultParameters,
                model: llmConfig.modelIdentifier,
                ...basePayloadPromptPart, // Should contain 'messages'
                tools: [openAiTool],
                tool_choice: {type: "function", function: {name: OPENAI_TOOL_NAME}} // Force use of this tool
            };
            this.#logger.debug(`_handleToolCalling (OpenAI): Constructed payload for LLM '${llmConfig.id}'.`, {payloadLength: JSON.stringify(providerRequestPayload)?.length});
        } else if (llmConfig.apiType === 'anthropic') {
            const anthropicTool = {
                name: ANTHROPIC_TOOL_NAME,
                description: "Extracts the character's next action command and spoken dialogue for the text adventure game, based on the current game situation. Both action and speech are required.",
                input_schema: GAME_AI_ACTION_SPEECH_TOOL_PARAMETERS_SCHEMA
            };
            providerRequestPayload = {
                ...llmConfig.defaultParameters,
                model: llmConfig.modelIdentifier,
                ...basePayloadPromptPart, // Should contain 'messages'
                tools: [anthropicTool],
                tool_choice: {type: "tool", name: ANTHROPIC_TOOL_NAME} // Force use of this tool
            };
            // Ensure anthropic-version header is present
            dynamicProviderHeaders['anthropic-version'] = (llmConfig.providerSpecificHeaders && llmConfig.providerSpecificHeaders['anthropic-version'])
                ? llmConfig.providerSpecificHeaders['anthropic-version']
                : DEFAULT_ANTHROPIC_VERSION;
            this.#logger.debug(`_handleToolCalling (Anthropic): Constructed payload for LLM '${llmConfig.id}'. Will use anthropic-version: ${dynamicProviderHeaders['anthropic-version']}`, {payloadLength: JSON.stringify(providerRequestPayload)?.length});
        } else {
            this.#logger.error(`_handleToolCalling: Unsupported apiType '${llmConfig.apiType}' for tool calling strategy for LLM '${llmConfig.id}'.`);
            throw new ConfigurationError(`Tool calling not supported for apiType: ${llmConfig.apiType}`, {llmId: llmConfig.id});
        }

        const LlmConfigWithDynamicHeaders = {
            ...llmConfig,
            providerSpecificHeaders: {
                ...(llmConfig.providerSpecificHeaders || {}),
                ...dynamicProviderHeaders
            }
        };

        try {
            const responseData = await this._executeApiCall(LlmConfigWithDynamicHeaders, providerRequestPayload, activeApiKeyForServerCall);
            this.#logger.debug(`_handleToolCalling: Raw API response received for LLM '${llmConfig.id}'. Preview: ${JSON.stringify(responseData)?.substring(0, 200)}...`);

            if (llmConfig.apiType === 'openai') {
                const message = responseData?.choices?.[0]?.message;
                if (message && message.tool_calls && message.tool_calls.length > 0) {
                    const toolCall = message.tool_calls[0];
                    if (toolCall.type === "function" && toolCall.function && toolCall.function.name === OPENAI_TOOL_NAME) {
                        const argumentsString = toolCall.function.arguments;
                        this.#logger.info(`_handleToolCalling (OpenAI): Extracted tool arguments string for LLM '${llmConfig.id}'.`);
                        this.#logger.debug(`_handleToolCalling (OpenAI): Arguments string: ${argumentsString}`);
                        return argumentsString;
                    } else {
                        this.#logger.error(`_handleToolCalling (OpenAI): Unexpected tool_call structure or name for LLM '${llmConfig.id}'. Expected function '${OPENAI_TOOL_NAME}'.`, {toolCall});
                        throw new Error(`OpenAI response for LLM '${llmConfig.id}' had unexpected tool_call structure or name.`);
                    }
                } else {
                    this.#logger.error(`_handleToolCalling (OpenAI): No tool_calls found in response for LLM '${llmConfig.id}'.`, {response: responseData});
                    throw new Error(`OpenAI response for LLM '${llmConfig.id}' did not contain expected tool_calls.`);
                }
            } else if (llmConfig.apiType === 'anthropic') {
                if (responseData.stop_reason === "tool_use" && Array.isArray(responseData.content)) {
                    const toolUseBlock = responseData.content.find(block =>
                        block.type === "tool_use" && block.name === ANTHROPIC_TOOL_NAME
                    );
                    if (toolUseBlock && typeof toolUseBlock.input === 'object' && toolUseBlock.input !== null) {
                        const argumentsObject = toolUseBlock.input;
                        this.#logger.info(`_handleToolCalling (Anthropic): Extracted tool input object for LLM '${llmConfig.id}'.`);
                        this.#logger.debug(`_handleToolCalling (Anthropic): Arguments object:`, argumentsObject);
                        return JSON.stringify(argumentsObject);
                    } else {
                        this.#logger.error(`_handleToolCalling (Anthropic): No matching tool_use block or valid input object found for LLM '${llmConfig.id}'. Expected tool name '${ANTHROPIC_TOOL_NAME}'.`, {content: responseData.content});
                        throw new Error(`Anthropic response for LLM '${llmConfig.id}' did not contain expected tool_use block or input object.`);
                    }
                } else {
                    this.#logger.error(`_handleToolCalling (Anthropic): Response stop_reason was not 'tool_use' or content was not as expected for LLM '${llmConfig.id}'.`, {response: responseData});
                    throw new Error(`Anthropic response for LLM '${llmConfig.id}' did not indicate tool_use correctly.`);
                }
            }
            // Should not be reached if apiType is validated before
            return DEFAULT_FALLBACK_ACTION_JSON_STRING;
        } catch (error) {
            this.#logger.error(`_handleToolCalling: API call or response processing failed for LLM '${llmConfig.id}'. Error: ${error.message}`, {
                llmId: llmConfig.id,
                originalErrorName: error.name,
                originalErrorMessage: error.message,
            });
            throw error;
        }
    }

    // MODIFICATION END (Ticket 2.2)

    // MODIFICATION START (Ticket 2.3)
    /**
     * @private
     * Handles LLM interaction using OpenRouter's `response_format: { type: 'json_schema' }` strategy.
     * @param {string} gameSummary - The current game state summary.
     * @param {LLMModelConfig} llmConfig - The active LLM configuration (must be for OpenRouter).
     * @param {string | null} activeApiKeyForServerCall - The API key for server-side cloud calls, or null.
     * @returns {Promise<string>} A promise resolving to a JSON string that represents the structured output.
     */
    async _handleOpenRouterJsonSchema(gameSummary, llmConfig, activeApiKeyForServerCall) {
        this.#logger.info(`ConfigurableLLMAdapter._handleOpenRouterJsonSchema invoked for LLM '${llmConfig.id}'.`);

        if (llmConfig.apiType !== 'openrouter') {
            this.#logger.error(`_handleOpenRouterJsonSchema: Invalid apiType '${llmConfig.apiType}' for this strategy. Expected 'openrouter'. LLM ID: '${llmConfig.id}'.`);
            throw new ConfigurationError(`_handleOpenRouterJsonSchema strategy only supports 'openrouter' apiType.`, {llmId: llmConfig.id});
        }

        // Use new prompt construction via BaseChatLLMStrategy (OpenRouter JSON schema uses chat messages)
        const promptBuilder = new BaseChatLLMStrategy(this.#logger);
        const basePayloadPromptPart = promptBuilder._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);

        const responseFormat = {
            type: "json_schema",
            json_schema: OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA
        };

        const providerRequestPayload = {
            ...llmConfig.defaultParameters,
            model: llmConfig.modelIdentifier,
            ...basePayloadPromptPart, // This should contain the 'messages' array
            response_format: responseFormat
        };

        this.#logger.debug(`_handleOpenRouterJsonSchema: Constructed payload for LLM '${llmConfig.id}'.`, {payloadLength: JSON.stringify(providerRequestPayload)?.length});

        try {
            const responseData = await this._executeApiCall(llmConfig, providerRequestPayload, activeApiKeyForServerCall);
            this.#logger.debug(`_handleOpenRouterJsonSchema: Raw API response received for LLM '${llmConfig.id}'. Preview: ${JSON.stringify(responseData)?.substring(0, 250)}...`);

            const message = responseData?.choices?.[0]?.message;
            let extractedJsonString = null;

            if (message) {
                if (message.content) {
                    if (typeof message.content === 'string' && message.content.trim() !== '') {
                        this.#logger.info(`_handleOpenRouterJsonSchema: Extracted JSON string from message.content for LLM '${llmConfig.id}'.`);
                        extractedJsonString = message.content;
                    } else if (typeof message.content === 'object') {
                        this.#logger.info(`_handleOpenRouterJsonSchema: Extracted JSON object from message.content for LLM '${llmConfig.id}'. Stringifying.`);
                        extractedJsonString = JSON.stringify(message.content);
                    } else if (typeof message.content === 'string' && message.content.trim() === '') {
                        this.#logger.warn(`_handleOpenRouterJsonSchema: message.content was an empty string for LLM '${llmConfig.id}'. Will check tool_calls fallback.`);
                    } else {
                        this.#logger.warn(`_handleOpenRouterJsonSchema: message.content was present but not a non-empty string or object for LLM '${llmConfig.id}'. Type: ${typeof message.content}. Will check tool_calls fallback.`);
                    }
                } else {
                    this.#logger.info(`_handleOpenRouterJsonSchema: message.content is null or undefined for LLM '${llmConfig.id}'. Checking tool_calls fallback.`);
                }

                if (!extractedJsonString && message.tool_calls && message.tool_calls.length > 0) {
                    this.#logger.info(`_handleOpenRouterJsonSchema: message.content was not usable, attempting tool_calls fallback for LLM '${llmConfig.id}'.`);
                    const toolCall = message.tool_calls[0];
                    if (toolCall?.type === "function" &&
                        toolCall.function?.name === OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.name &&
                        typeof toolCall.function?.arguments === 'string' &&
                        toolCall.function.arguments.trim() !== '') {
                        this.#logger.info(`_handleOpenRouterJsonSchema: Extracted JSON string from tool_calls fallback for LLM '${llmConfig.id}'.`);
                        extractedJsonString = toolCall.function.arguments;
                    } else {
                        this.#logger.warn(`_handleOpenRouterJsonSchema: tool_calls present but did not match expected structure/name ('${OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.name}') or arguments were empty for LLM '${llmConfig.id}'.`, {toolCallDetails: toolCall});
                    }
                }
            }

            if (extractedJsonString) {
                this.#logger.debug(`_handleOpenRouterJsonSchema: Returning extracted/processed JSON string for LLM '${llmConfig.id}'. Preview: ${extractedJsonString.substring(0, 100)}...`);
                return extractedJsonString;
            } else {
                this.#logger.error(`_handleOpenRouterJsonSchema: Failed to extract valid JSON content from message.content or tool_call arguments from OpenRouter response for LLM '${llmConfig.id}'.`, {response: responseData});
                throw new Error(`OpenRouter response for LLM '${llmConfig.id}' did not contain usable message.content or a valid tool_call fallback that matched the schema name '${OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.name}'.`);
            }

        } catch (error) {
            this.#logger.error(`_handleOpenRouterJsonSchema: API call or response processing failed for LLM '${llmConfig.id}'. Error: ${error.message}`, {
                llmId: llmConfig.id,
                originalErrorName: error.name,
                originalErrorMessage: error.message,
            });
            throw error;
        }
    }

    // MODIFICATION END (Ticket 2.3)

    // MODIFICATION START (Ticket 2.4)
    /**
     * @private
     * Handles LLM interaction using native "JSON mode" features.
     * @param {string} gameSummary - The current game state summary.
     * @param {LLMModelConfig} llmConfig - The active LLM configuration.
     * @param {string | null} activeApiKeyForServerCall - The API key for server-side cloud calls, or null.
     * @returns {Promise<string>} A promise resolving to a JSON string.
     */
    async _handleNativeJsonMode(gameSummary, llmConfig, activeApiKeyForServerCall) {
        this.#logger.info(`ConfigurableLLMAdapter._handleNativeJsonMode invoked for LLM '${llmConfig.id}'. apiType: ${llmConfig.apiType}`);

        let basePayloadPromptPart;
        let promptBuilder;

        if (llmConfig.apiType === 'openai') {
            promptBuilder = new BaseChatLLMStrategy(this.#logger);
            basePayloadPromptPart = promptBuilder._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
        } else if (llmConfig.apiType === 'ollama') {
            // For Ollama, decide based on endpoint or other config if it's chat or completion style
            if (llmConfig.endpointUrl && llmConfig.endpointUrl.includes('/api/chat')) {
                promptBuilder = new BaseChatLLMStrategy(this.#logger);
            } else { // Default to completion for /api/generate or other Ollama endpoints
                promptBuilder = new BaseCompletionLLMStrategy(this.#logger);
            }
            basePayloadPromptPart = promptBuilder._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
        } else {
            this.#logger.error(`_handleNativeJsonMode: Unsupported apiType '${llmConfig.apiType}' for native JSON mode strategy for LLM '${llmConfig.id}'.`);
            throw new ConfigurationError(`Native JSON mode not supported for apiType: ${llmConfig.apiType}`, {llmId: llmConfig.id});
        }

        let providerRequestPayload;
        let extractedJsonString = null;

        if (llmConfig.apiType === 'openai') {
            providerRequestPayload = {
                ...llmConfig.defaultParameters,
                model: llmConfig.modelIdentifier,
                ...basePayloadPromptPart, // Should contain 'messages'
                response_format: {type: "json_object"}
            };
            this.#logger.debug(`_handleNativeJsonMode (OpenAI): Constructed payload for LLM '${llmConfig.id}'. Note: Prompt must include 'JSON' for this mode to work correctly.`, {
                payloadLength: JSON.stringify(providerRequestPayload)?.length
            });

            try {
                const responseData = await this._executeApiCall(llmConfig, providerRequestPayload, activeApiKeyForServerCall);
                this.#logger.debug(`_handleNativeJsonMode (OpenAI): Raw API response received for LLM '${llmConfig.id}'. Preview: ${JSON.stringify(responseData)?.substring(0, 200)}...`);

                const content = responseData?.choices?.[0]?.message?.content;
                if (typeof content === 'string' && content.trim() !== '') {
                    extractedJsonString = content;
                    this.#logger.info(`_handleNativeJsonMode (OpenAI): Extracted JSON string from message.content for LLM '${llmConfig.id}'.`);
                } else {
                    this.#logger.error(`_handleNativeJsonMode (OpenAI): Expected JSON string not found in choices[0].message.content for LLM '${llmConfig.id}'.`, {response: responseData});
                    throw new Error(`OpenAI response for LLM '${llmConfig.id}' (JSON mode) did not contain expected content.`);
                }
            } catch (error) {
                this.#logger.error(`_handleNativeJsonMode (OpenAI): API call or response processing failed for LLM '${llmConfig.id}'. Error: ${error.message}`, {llmId: llmConfig.id});
                throw error;
            }

        } else if (llmConfig.apiType === 'ollama') {
            providerRequestPayload = {
                ...llmConfig.defaultParameters,
                model: llmConfig.modelIdentifier,
                ...basePayloadPromptPart, // Can be {messages} or {prompt}
                format: "json",
                stream: false
            };
            this.#logger.debug(`_handleNativeJsonMode (Ollama): Constructed payload for LLM '${llmConfig.id}'. Endpoint: ${llmConfig.endpointUrl}`, {
                payloadLength: JSON.stringify(providerRequestPayload)?.length
            });

            try {
                const responseData = await this._executeApiCall(llmConfig, providerRequestPayload, activeApiKeyForServerCall);
                this.#logger.debug(`_handleNativeJsonMode (Ollama): Raw API response received for LLM '${llmConfig.id}'. Preview: ${JSON.stringify(responseData)?.substring(0, 200)}...`);

                if (responseData?.message && typeof responseData.message.content === 'string' && responseData.message.content.trim() !== '') {
                    extractedJsonString = responseData.message.content;
                    this.#logger.info(`_handleNativeJsonMode (Ollama): Extracted JSON string from responseData.message.content (likely /api/chat) for LLM '${llmConfig.id}'.`);
                } else if (typeof responseData?.response === 'string' && responseData.response.trim() !== '') {
                    extractedJsonString = responseData.response;
                    this.#logger.info(`_handleNativeJsonMode (Ollama): Extracted JSON string from responseData.response (likely /api/generate) for LLM '${llmConfig.id}'.`);
                } else {
                    this.#logger.error(`_handleNativeJsonMode (Ollama): Expected JSON string not found in responseData.message.content or responseData.response for LLM '${llmConfig.id}'.`, {response: responseData});
                    throw new Error(`Ollama response for LLM '${llmConfig.id}' (JSON mode) did not contain expected content in .message.content or .response.`);
                }
            } catch (error) {
                this.#logger.error(`_handleNativeJsonMode (Ollama): API call or response processing failed for LLM '${llmConfig.id}'. Error: ${error.message}`, {llmId: llmConfig.id});
                throw error;
            }
        }
        // No 'else' here as unsupported apiTypes for this handler are caught at the beginning.

        if (extractedJsonString) {
            this.#logger.debug(`_handleNativeJsonMode: Returning extracted JSON string for LLM '${llmConfig.id}'. Preview: ${extractedJsonString.substring(0, 100)}...`);
            return extractedJsonString;
        } else {
            this.#logger.error(`_handleNativeJsonMode: Failed to extract JSON string for an unknown reason for LLM '${llmConfig.id}'. This indicates an issue in the provider-specific logic.`);
            throw new Error(`_handleNativeJsonMode failed to extract JSON string for LLM '${llmConfig.id}'.`);
        }
    }

    // MODIFICATION END (Ticket 2.4)

    /**
     * @private
     * Placeholder handler for "GBNF Grammar" output strategy.
     */
    async _handleGbnfGrammar(gameSummary, llmConfig, activeApiKey) {
        this.#logger.info(`ConfigurableLLMAdapter._handleGbnfGrammar invoked for LLM '${llmConfig.id}'. THIS IS A STUB.`);
        // When fleshed out, this would use BaseCompletionLLMStrategy or similar
        // const promptBuilder = new BaseCompletionLLMStrategy(this.#logger);
        // const promptPayload = promptBuilder._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
        // const apiPayload = { model: llmConfig.modelIdentifier, ...promptPayload, grammar: "...", ...llmConfig.defaultParameters };
        const stubbedResponse = {
            ...DEFAULT_FALLBACK_ACTION,
            speech: `Stub response from _handleGbnfGrammar for LLM ID: ${llmConfig.id}`
        };
        return Promise.resolve(JSON.stringify(stubbedResponse));
    }

    /**
     * @private
     * Placeholder handler for the "Prompt Engineering" JSON output strategy.
     */
    async _handlePromptEngineering(gameSummary, llmConfig, activeApiKey) {
        this.#logger.info(`ConfigurableLLMAdapter._handlePromptEngineering invoked for LLM '${llmConfig.id}'. THIS IS A STUB.`);
        let promptBuilder;
        // Decide if chat or completion based on apiType or promptFrame hints
        // This is a simplified choice for the stub.
        if (['openai', 'openrouter', 'anthropic'].includes(llmConfig.apiType) || (typeof llmConfig.promptFrame === 'object' && llmConfig.promptFrame && llmConfig.promptFrame.system)) {
            promptBuilder = new BaseChatLLMStrategy(this.#logger);
        } else {
            promptBuilder = new BaseCompletionLLMStrategy(this.#logger);
        }
        const promptPayload = promptBuilder._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
        // const apiPayload = { model: llmConfig.modelIdentifier, ...promptPayload, ...llmConfig.defaultParameters };
        // this.logger.debug(`_handlePromptEngineering: Constructed payload (stubbed call):`, { apiPayloadPreview: JSON.stringify(apiPayload)?.substring(0,100) });


        const stubbedResponse = {
            ...DEFAULT_FALLBACK_ACTION,
            speech: `Stub response from _handlePromptEngineering (using ${promptBuilder.constructor.name}) for LLM ID: ${llmConfig.id}`
        };
        return Promise.resolve(JSON.stringify(stubbedResponse));
    }


    /**
     * Generates an action and speech based on the provided game summary using a configured LLM.
     * @async
     * @param {string} gameSummary - A string providing a summarized representation
     * of the current game state and relevant actor information.
     * @returns {Promise<string>} A Promise that resolves to a JSON string.
     * @throws {Error | ConfigurationError} If issues occur.
     */
    async getAIDecision(gameSummary) {
        this.#logger.debug('ConfigurableLLMAdapter.getAIDecision called.', {
            isOperational: this.#isOperational,
            activeLlmId: this.#currentActiveLlmId,
            gameSummaryLength: gameSummary ? gameSummary.length : 0
        });

        if (!this.#isInitialized) {
            this.#logger.error("ConfigurableLLMAdapter.getAIDecision: Adapter not initialized. Call init() first.");
            throw new Error("Adapter not initialized. Call init() first.");
        }

        if (!this.#isOperational) {
            this.#logger.error("ConfigurableLLMAdapter.getAIDecision: Adapter is not operational due to configuration loading issues.");
            throw new Error("Adapter is not operational due to configuration loading issues.");
        }

        const activeConfig = this.getCurrentActiveLlmConfig();
        if (!activeConfig) {
            const msg = "No active LLM configuration is set. Use setActiveLlm() or set a defaultLlmId.";
            this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
            throw new ConfigurationError(msg);
        }

        const {
            id: configId,
            endpointUrl: llmProviderEndpointUrl,
            modelIdentifier,
            apiType,
            jsonOutputStrategy,
            apiKeyEnvVar,
            apiKeyFileName
        } = activeConfig;

        const validationErrors = [];
        if (!llmProviderEndpointUrl || typeof llmProviderEndpointUrl !== 'string' || llmProviderEndpointUrl.trim() === '') {
            validationErrors.push({field: 'endpointUrl', value: llmProviderEndpointUrl, reason: 'Missing or invalid'});
        }
        if (!modelIdentifier || typeof modelIdentifier !== 'string' || modelIdentifier.trim() === '') {
            validationErrors.push({field: 'modelIdentifier', value: modelIdentifier, reason: 'Missing or invalid'});
        }
        if (!apiType || typeof apiType !== 'string' || apiType.trim() === '') {
            validationErrors.push({field: 'apiType', value: apiType, reason: 'Missing or invalid'});
        }

        if (jsonOutputStrategy && typeof jsonOutputStrategy === 'object' && jsonOutputStrategy.method && typeof jsonOutputStrategy.method === 'string' && jsonOutputStrategy.method.trim() !== '') {
            // Looks okay
        } else if (jsonOutputStrategy && typeof jsonOutputStrategy === 'object' && (!jsonOutputStrategy.method || typeof jsonOutputStrategy.method !== 'string' || jsonOutputStrategy.method.trim() === '')) {
            validationErrors.push({
                field: 'jsonOutputStrategy.method',
                value: jsonOutputStrategy.method,
                reason: 'Missing or invalid'
            });
        } else if (!jsonOutputStrategy) {
            this.#logger.debug(`ConfigurableLLMAdapter.getAIDecision: 'jsonOutputStrategy' is missing for LLM '${configId}'. Will default to 'prompt_engineering'.`);
        }


        if (validationErrors.length > 0) {
            const errorDetailsMessage = validationErrors.map(err => `${err.field}: ${err.reason} (value: ${JSON.stringify(err.value)})`).join('; ');
            const msg = `Active LLM config '${configId}' is missing essential field(s): ${errorDetailsMessage}`;
            this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
            throw new ConfigurationError(msg, {
                llmId: configId,
                problematicFields: validationErrors.map(e => ({field: e.field, value: e.value, reason: e.reason}))
            });
        }

        let actualApiKeyForServer = null;
        const isCloudService = CLOUD_API_TYPES.includes(apiType);

        if (isCloudService && this.#executionEnvironment === 'server') {
            this.#logger.debug(`Adapter running in server-side mode for cloud service LLM '${configId}'. Key will be retrieved directly.`);
            let serverKeyRetrievalFailed = false;
            let keyRetrievalErrorMessage = "";

            if (apiKeyEnvVar && typeof apiKeyEnvVar === 'string' && apiKeyEnvVar.trim() !== '') {
                try {
                    if (typeof process === 'object' && process.env) {
                        actualApiKeyForServer = process.env[apiKeyEnvVar]?.trim() || null;
                        if (actualApiKeyForServer) this.#logger.info(`API key retrieved from env var '${apiKeyEnvVar}'.`);
                        else {
                            keyRetrievalErrorMessage = `Env var '${apiKeyEnvVar}' not found or empty.`;
                            this.#logger.error(keyRetrievalErrorMessage);
                            serverKeyRetrievalFailed = true;
                        }
                    } else {
                        keyRetrievalErrorMessage = "'process.env' not available for server-side key retrieval.";
                        this.#logger.error(keyRetrievalErrorMessage);
                        serverKeyRetrievalFailed = true;
                    }
                } catch (e) {
                    keyRetrievalErrorMessage = `Error accessing env var '${apiKeyEnvVar}': ${e.message}`;
                    this.#logger.error(keyRetrievalErrorMessage);
                    serverKeyRetrievalFailed = true;
                }
            } else if (apiKeyFileName && typeof apiKeyFileName === 'string' && apiKeyFileName.trim() !== '') {
                if (!this.#projectRootPath) {
                    keyRetrievalErrorMessage = "'projectRootPath' not set for file key retrieval.";
                    this.#logger.error(keyRetrievalErrorMessage);
                    serverKeyRetrievalFailed = true;
                } else {
                    try {
                        actualApiKeyForServer = await getApiKeyFromFileSystem(apiKeyFileName, this.#projectRootPath, this.#logger);
                        if (actualApiKeyForServer) this.#logger.info(`API key retrieved from file '${apiKeyFileName}'.`);
                        else {
                            keyRetrievalErrorMessage = `Failed to retrieve key from file '${apiKeyFileName}'.`;
                            this.#logger.error(keyRetrievalErrorMessage);
                            serverKeyRetrievalFailed = true;
                        }
                    } catch (e) {
                        keyRetrievalErrorMessage = `Error retrieving key from file '${apiKeyFileName}': ${e.message}`;
                        this.#logger.error(keyRetrievalErrorMessage);
                        serverKeyRetrievalFailed = true;
                    }
                }
            } else {
                keyRetrievalErrorMessage = `No apiKeyEnvVar or apiKeyFileName configured for cloud LLM '${configId}'.`;
                this.#logger.error(keyRetrievalErrorMessage);
                serverKeyRetrievalFailed = true;
            }

            if (serverKeyRetrievalFailed) {
                const msg = `Server-side API key retrieval failed for LLM '${configId}'. Reason: ${keyRetrievalErrorMessage}`;
                this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
                throw new ConfigurationError(msg, {llmId: configId});
            }

        } else if (isCloudService && this.#executionEnvironment === 'client') {
            if ((!apiKeyEnvVar || apiKeyEnvVar.trim() === '') && (!apiKeyFileName || apiKeyFileName.trim() === '')) {
                const msg = `Client-side - API key identifier (apiKeyEnvVar or apiKeyFileName) missing for cloud LLM '${configId}'. Proxy cannot retrieve key.`;
                this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
                throw new ConfigurationError(msg, {llmId: configId});
            }
            this.#logger.debug(`Client-side call for cloud LLM '${configId}'. Proxy will handle API key.`);
        } else if (isCloudService && this.#executionEnvironment === 'unknown') {
            const msg = `Execution environment 'unknown' for cloud LLM '${configId}'. API key security unclear.`;
            this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
            throw new ConfigurationError(msg, {llmId: configId});
        }


        let currentStrategyMethod = "prompt_engineering";
        const knownStrategies = ['tool_calling', 'openrouter_json_schema', 'native_json_mode', 'gbnf_grammar', 'prompt_engineering'];

        if (jsonOutputStrategy && jsonOutputStrategy.method && typeof jsonOutputStrategy.method === 'string') {
            const configuredMethod = jsonOutputStrategy.method.trim().toLowerCase();
            if (knownStrategies.includes(configuredMethod)) {
                currentStrategyMethod = configuredMethod;
            } else {
                this.#logger.warn(`ConfigurableLLMAdapter.getAIDecision: jsonOutputStrategy.method ('${configuredMethod}') for LLM '${configId}' is not a recognized strategy. Defaulting to 'prompt_engineering'. Recognized: ${knownStrategies.join(', ')}`);
            }
        } else {
            this.#logger.info(`ConfigurableLLMAdapter.getAIDecision: jsonOutputStrategy.method not specified or invalid for LLM '${configId}'. Defaulting to 'prompt_engineering'.`);
        }

        this.#logger.info(`ConfigurableLLMAdapter.getAIDecision: Dispatching to JSON strategy handler: '${currentStrategyMethod}' for LLM '${configId}'.`);

        try {
            switch (currentStrategyMethod) {
                case 'tool_calling':
                    return await this._handleToolCalling(gameSummary, activeConfig, actualApiKeyForServer);
                case 'openrouter_json_schema':
                    return await this._handleOpenRouterJsonSchema(gameSummary, activeConfig, actualApiKeyForServer);
                case 'native_json_mode':
                    return await this._handleNativeJsonMode(gameSummary, activeConfig, actualApiKeyForServer);
                case 'gbnf_grammar':
                    return await this._handleGbnfGrammar(gameSummary, activeConfig, actualApiKeyForServer);
                case 'prompt_engineering':
                default:
                    return await this._handlePromptEngineering(gameSummary, activeConfig, actualApiKeyForServer);
            }
        } catch (strategyError) {
            this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: Error during strategy '${currentStrategyMethod}' for LLM '${configId}'. Error: ${strategyError.message}`, {
                llmId: configId,
                strategy: currentStrategyMethod,
                originalErrorName: strategyError.name,
                originalErrorMessage: strategyError.message,
            });
            throw strategyError;
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

    /**
     * Retrieves the configured proxy server URL.
     * Primarily for testing or debugging purposes.
     * @returns {string} The proxy server URL.
     */
    getProxyServerUrl_FOR_TESTING_ONLY() {
        return this.#proxyServerUrl;
    }
}

// --- FILE END ---