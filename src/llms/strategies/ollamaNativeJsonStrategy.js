// src/llms/strategies/ollamaNativeJsonStrategy.js
// --- FILE START ---

import {ILLMStrategy} from '../interfaces/ILLMStrategy.js';
import {LLMStrategyError} from '../errors/LLMStrategyError.js';
// Assuming ConfigurationError might be needed if not already available globally or via other imports.
// If it's defined in a shared module, adjust the import path.
// For now, we'll assume it's imported or accessible.
// import { ConfigurationError } from '../../turns/adapters/configurableLLMAdapter.js'; // Example path
import {BaseChatLLMStrategy} from './base/baseChatLLMStrategy.js';
import {BaseCompletionLLMStrategy} from './base/baseCompletionLLMStrategy.js';

/**
 * @typedef {import('../interfaces/ILLMStrategy.js').LLMStrategyExecuteParams} LLMStrategyExecuteParams
 * @typedef {import('../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../environmentContext.js').EnvironmentContext} EnvironmentContext
 */

/**
 * Custom error class for configuration-related issues within strategies.
 * Re-declared here if not imported from a shared module.
 * If ConfigurationError is imported from a shared module, this can be removed.
 */
class ConfigurationError extends Error {
    /**
     * Creates an instance of ConfigurationError.
     * @param {string} message - The error message.
     * @param {object} [details] - Additional details about the error.
     * @param {string} [details.llmId] - The ID of the LLM configuration that caused the error.
     * @param {string} [details.problematicField] - The name of the configuration field that is problematic.
     */
    constructor(message, details = {}) {
        super(message);
        this.name = "ConfigurationError";
        this.llmId = details.llmId;
        this.problematicField = details.problematicField;
        // Add any other relevant details if needed
    }
}


/**
 * @class OllamaNativeJsonStrategy
 * @implements {ILLMStrategy}
 * @description Strategy to handle interactions with Ollama instances
 * using Ollama's native JSON mode (format: "json").
 */
export class OllamaNativeJsonStrategy extends ILLMStrategy {
    /**
     * @private
     * @type {IHttpClient}
     */
    #httpClient;

    /**
     * @private
     * @type {ILogger}
     */
    #logger;

    /**
     * Constructor for OllamaNativeJsonStrategy.
     * @param {object} dependencies - The dependencies for this strategy.
     * @param {IHttpClient} dependencies.httpClient - An instance of IHttpClient.
     * @param {ILogger} dependencies.logger - An instance of ILogger.
     * @throws {Error} If httpClient or logger is not provided.
     */
    constructor({httpClient, logger}) {
        super();
        if (!httpClient || typeof httpClient.request !== 'function') {
            const errorMsg = 'OllamaNativeJsonStrategy: Constructor requires a valid IHttpClient instance.';
            (logger || console).error(errorMsg); // Log even if logger itself is invalid
            throw new Error(errorMsg);
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            const errorMsg = 'OllamaNativeJsonStrategy: Constructor requires a valid ILogger instance.';
            (httpClient ? logger || console : console).error(errorMsg); // Log if possible
            throw new Error(errorMsg);
        }

        this.#httpClient = httpClient;
        this.#logger = logger;
        this.#logger.debug('OllamaNativeJsonStrategy: Instance created.');
    }

    /**
     * Executes the Ollama API call with native JSON mode.
     * @param {LLMStrategyExecuteParams} params - The parameters for execution.
     * @returns {Promise<string>} A promise that resolves to the extracted JSON string from the LLM response.
     * @throws {ConfigurationError} If llmConfig.apiType is not 'ollama'.
     * @throws {LLMStrategyError} For API call failures or issues processing the response.
     */
    async execute(params) {
        const {gameSummary, llmConfig, apiKey, environmentContext} = params;
        // apiKey is typically null for local Ollama instances.
        // environmentContext might be less relevant here but passed for consistency.

        if (!llmConfig) {
            this.#logger.error("OllamaNativeJsonStrategy.execute: llmConfig is required.");
            throw new ConfigurationError("llmConfig is required.", {llmId: "N/A"});
        }
        const llmId = llmConfig.id || "UnknownOllamaLlm";

        this.#logger.debug(`OllamaNativeJsonStrategy.execute: Processing request for LLM ID '${llmId}'.`);

        if (llmConfig.apiType !== 'ollama') {
            const errorMsg = `Invalid apiType '${llmConfig.apiType}'. OllamaNativeJsonStrategy only supports 'ollama'.`;
            this.#logger.error(`OllamaNativeJsonStrategy.execute: ${errorMsg}`, {llmId});
            throw new ConfigurationError(errorMsg, {llmId, problematicField: 'apiType', fieldValue: llmConfig.apiType});
        }

        if (!gameSummary || typeof gameSummary !== 'string') {
            const errorMsg = `'gameSummary' is required and must be a string for LLM '${llmId}'.`;
            this.#logger.error(`OllamaNativeJsonStrategy.execute: ${errorMsg}`);
            throw new LLMStrategyError(errorMsg, llmId);
        }
        if (!llmConfig.endpointUrl || typeof llmConfig.endpointUrl !== 'string') {
            const errorMsg = `'endpointUrl' is missing or invalid in llmConfig for LLM '${llmId}'.`;
            this.#logger.error(`OllamaNativeJsonStrategy.execute: ${errorMsg}`);
            throw new ConfigurationError(errorMsg, {llmId, problematicField: 'endpointUrl'});
        }
        if (!llmConfig.modelIdentifier || typeof llmConfig.modelIdentifier !== 'string') {
            const errorMsg = `'modelIdentifier' is missing or invalid in llmConfig for LLM '${llmId}'.`;
            this.#logger.error(`OllamaNativeJsonStrategy.execute: ${errorMsg}`);
            throw new ConfigurationError(errorMsg, {llmId, problematicField: 'modelIdentifier'});
        }


        let basePromptPayloadPart;
        try {
            let promptBuilder;
            // For Ollama, decide based on endpoint or other config if it's chat or completion style
            // This logic is adapted from the existing ConfigurableLLMAdapter._handleNativeJsonMode
            if (llmConfig.endpointUrl && llmConfig.endpointUrl.includes('/api/chat')) {
                promptBuilder = new BaseChatLLMStrategy(this.#logger);
                this.#logger.debug(`OllamaNativeJsonStrategy.execute: Using BaseChatLLMStrategy for prompt construction (endpoint contains '/api/chat').`, {llmId});
            } else { // Default to completion for /api/generate or other Ollama endpoints
                promptBuilder = new BaseCompletionLLMStrategy(this.#logger);
                this.#logger.debug(`OllamaNativeJsonStrategy.execute: Using BaseCompletionLLMStrategy for prompt construction (endpoint likely '/api/generate' or other).`, {llmId});
            }
            basePromptPayloadPart = promptBuilder._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
        } catch (promptError) {
            this.#logger.error(`OllamaNativeJsonStrategy.execute: Error during prompt construction for LLM '${llmId}'. Error: ${promptError.message}`, {
                llmId,
                originalError: promptError
            });
            throw new LLMStrategyError(`Prompt construction failed for LLM '${llmId}': ${promptError.message}`, llmId, promptError);
        }


        const providerRequestPayload = {
            ...(llmConfig.defaultParameters || {}),
            model: llmConfig.modelIdentifier,
            ...basePromptPayloadPart, // This will be { messages: [...] } or { prompt: "..." }
            format: "json",
            stream: false // Ensure non-streaming for a single JSON object response
        };

        const targetUrl = llmConfig.endpointUrl;
        const headers = {
            'Content-Type': 'application/json',
            ...(llmConfig.providerSpecificHeaders || {})
        };

        // Authentication headers are generally not used with local Ollama.
        // If apiKey were provided for a remote/secured Ollama, standard Bearer token auth might be added,
        // but this is atypical for apiType: 'ollama' and not explicitly handled here without further spec.
        if (apiKey) {
            this.#logger.warn(`OllamaNativeJsonStrategy.execute: An apiKey was provided for Ollama LLM '${llmId}'. This is atypical for local Ollama and might not be used unless the endpoint is a secured remote instance requiring specific authentication (e.g., Bearer token). Standard Bearer token authentication is NOT automatically added by this strategy. If needed, configure it via 'providerSpecificHeaders'.`, {llmId});
            // Example if Bearer token was a common convention:
            // headers['Authorization'] = `Bearer ${apiKey}`;
        }

        this.#logger.debug(`OllamaNativeJsonStrategy: Making API call to '${targetUrl}' for LLM '${llmId}'.`, {
            payloadLength: JSON.stringify(providerRequestPayload)?.length,
            llmId
        });

        try {
            const responseData = await this.#httpClient.request(targetUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(providerRequestPayload)
            });

            this.#logger.debug(`OllamaNativeJsonStrategy: Raw API response received for LLM '${llmId}'. Preview: ${JSON.stringify(responseData)?.substring(0, 200)}...`, {llmId});

            let extractedJsonString = null;

            // Check for /api/chat style response
            if (responseData && responseData.message && typeof responseData.message.content === 'string' && responseData.message.content.trim() !== '') {
                extractedJsonString = responseData.message.content;
                this.#logger.info(`OllamaNativeJsonStrategy: Extracted JSON string from responseData.message.content (likely /api/chat) for LLM '${llmId}'.`, {llmId});
            }
            // Else, check for /api/generate style response
            else if (responseData && typeof responseData.response === 'string' && responseData.response.trim() !== '') {
                extractedJsonString = responseData.response;
                this.#logger.info(`OllamaNativeJsonStrategy: Extracted JSON string from responseData.response (likely /api/generate) for LLM '${llmId}'.`, {llmId});
            }

            if (extractedJsonString) {
                this.#logger.debug(`OllamaNativeJsonStrategy: Successfully extracted JSON string. Length: ${extractedJsonString.length}. Preview: ${extractedJsonString.substring(0, 100)}...`, {llmId});
                return extractedJsonString;
            } else {
                const errorMsg = `Failed to extract JSON content from expected fields (responseData.message.content or responseData.response) for LLM '${llmId}'.`;
                this.#logger.error(`OllamaNativeJsonStrategy.execute: ${errorMsg}`, {llmId, responseData});
                throw new LLMStrategyError(errorMsg, llmId, {responseData});
            }

        } catch (error) {
            if (error instanceof ConfigurationError || error instanceof LLMStrategyError) {
                // Propagate errors already handled or specific to this domain
                throw error;
            }
            // Handle HttpClientError or other generic errors
            const errorMessage = `API call or response processing failed for LLM '${llmId}'. Error: ${error.message}`;
            this.#logger.error(`OllamaNativeJsonStrategy.execute: ${errorMessage}`, {
                llmId,
                originalErrorName: error.name,
                originalErrorMessage: error.message,
                errorStack: error.stack
            });
            // Wrap in LLMStrategyError
            throw new LLMStrategyError(errorMessage, llmId, error);
        }
    }
}

// --- FILE END ---