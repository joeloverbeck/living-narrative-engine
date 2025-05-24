// src/llms/strategies/openAINativeJsonStrategy.js
// --- FILE START ---

import {ILLMStrategy} from '../interfaces/ILLMStrategy.js';
import {ConfigurationError} from '../../turns/adapters/configurableLLMAdapter.js'; // Adjust path as needed
import {LLMStrategyError} from '../errors/LLMStrategyError.js';
import {BaseChatLLMStrategy} from './base/baseChatLLMStrategy.js'; // Assuming prompt construction is here

/**
 * @typedef {import('../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/ILLMStrategy.js').LLMStrategyExecuteParams} LLMStrategyExecuteParams
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../environmentContext.js').EnvironmentContext} EnvironmentContext
 */

/**
 * @class OpenAINativeJsonStrategy
 * @implements {ILLMStrategy}
 * @description Handles interactions with OpenAI-compatible APIs using OpenAI's native "JSON mode".
 * It sets `response_format: { type: "json_object" }` to ensure the model outputs a valid JSON string.
 * The prompt itself must also instruct the model to generate JSON.
 */
export class OpenAINativeJsonStrategy extends BaseChatLLMStrategy {
    /** @type {IHttpClient} */
    #httpClient;
    /** @type {ILogger} */
    #logger;

    /**
     * Creates an instance of OpenAINativeJsonStrategy.
     * @param {object} dependencies - The dependencies for this strategy.
     * @param {IHttpClient} dependencies.httpClient - An instance of IHttpClient.
     * @param {ILogger} dependencies.logger - An instance of ILogger.
     */
    constructor({httpClient, logger}) {
        super(logger); // Pass logger to BaseChatLLMStrategy if it expects one
        if (!httpClient || typeof httpClient.request !== 'function') {
            const errorMsg = 'OpenAINativeJsonStrategy: Constructor requires a valid IHttpClient instance.';
            // Use console if logger is unreliable or missing before this point
            (typeof logger?.error === 'function' ? logger : console).error(errorMsg);
            throw new Error(errorMsg);
        }
        // Corrected logger validation and fallback logging
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            const errorMsg = 'OpenAINativeJsonStrategy: Constructor requires a valid ILogger instance.';
            // If logger is partially invalid, it might not have .error. Fallback to console.
            // If logger is null/undefined, console.error.
            (logger && typeof logger.error === 'function' ? logger : console).error(errorMsg);
            throw new Error(errorMsg);
        }

        this.#httpClient = httpClient;
        this.#logger = logger;
        this.#logger.debug('OpenAINativeJsonStrategy: Instance created.');
    }

    /**
     * Executes the LLM interaction strategy for OpenAI native JSON mode.
     * @param {LLMStrategyExecuteParams} params - The parameters for executing the strategy.
     * @returns {Promise<string>} A promise that resolves to the JSON string output from the LLM.
     * @throws {ConfigurationError} If the configuration is invalid for this strategy.
     * @throws {LLMStrategyError} If the API call fails or the response is malformed.
     */
    async execute(params) {
        const {gameSummary, llmConfig, apiKey, environmentContext} = params;
        const llmId = llmConfig?.id || 'UnknownLLM';

        this.#logger.debug(`OpenAINativeJsonStrategy: Executing for LLM '${llmId}'.`);

        if (!llmConfig) {
            this.#logger.error(`OpenAINativeJsonStrategy (${llmId}): llmConfig is required.`);
            throw new ConfigurationError('llmConfig is required.', {llmId});
        }
        if (llmConfig.apiType !== 'openai') {
            const errorMsg = `Invalid apiType '${llmConfig.apiType}'. OpenAINativeJsonStrategy only supports 'openai'.`;
            this.#logger.error(`OpenAINativeJsonStrategy (${llmId}): ${errorMsg}`);
            throw new ConfigurationError(errorMsg, {
                llmId,
                problematicField: 'apiType',
                fieldValue: llmConfig.apiType
            });
        }
        if (!environmentContext) {
            this.#logger.error(`OpenAINativeJsonStrategy (${llmId}): environmentContext is required.`);
            throw new ConfigurationError('environmentContext is required.', {llmId});
        }
        if (typeof gameSummary !== 'string') {
            this.#logger.error(`OpenAINativeJsonStrategy (${llmId}): 'gameSummary' is required and must be a string.`);
            throw new LLMStrategyError(`'gameSummary' is required and must be a string for LLM '${llmId}'.`, llmId);
        }

        // Corrected prompt construction and validation
        let baseMessagesPayload;
        try {
            // Utilize prompt construction logic from BaseChatLLMStrategy
            baseMessagesPayload = this._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
        } catch (error) {
            this.#logger.error(`OpenAINativeJsonStrategy (${llmId}): Error during _constructPromptPayload call: ${error.message}`, {originalError: error});
            throw new LLMStrategyError(`Prompt construction failed for LLM '${llmId}': ${error.message}`, llmId, error);
        }

        if (!baseMessagesPayload || !Array.isArray(baseMessagesPayload.messages) || baseMessagesPayload.messages.length === 0) {
            this.#logger.error(`OpenAINativeJsonStrategy (${llmId}): Prompt construction did not produce a valid messages array.`);
            // This specific error message is expected by the tests that are currently failing
            throw new LLMStrategyError(`Prompt construction failed to produce messages for LLM '${llmId}'.`, llmId);
        }

        const providerRequestPayload = {
            ...llmConfig.defaultParameters,
            model: llmConfig.modelIdentifier,
            ...baseMessagesPayload, // Contains { messages: [...] }
            response_format: {type: "json_object"}
        };

        let targetUrl = llmConfig.endpointUrl;
        let finalPayload = providerRequestPayload;
        const headers = {
            'Content-Type': 'application/json',
            ...(llmConfig.providerSpecificHeaders || {})
        };

        const isClientSide = environmentContext.isClient();

        if (isClientSide) {
            const proxyUrl = environmentContext.getProxyServerUrl();
            if (!proxyUrl) {
                this.#logger.error(`OpenAINativeJsonStrategy (${llmId}): Client-side proxy URL not configured.`);
                throw new ConfigurationError('Client-side proxy URL not configured.', {
                    llmId,
                    missingConfig: 'proxyServerUrl'
                });
            }
            targetUrl = proxyUrl;
            finalPayload = {
                targetLlmConfig: {
                    endpointUrl: llmConfig.endpointUrl,
                    modelIdentifier: llmConfig.modelIdentifier,
                    apiType: llmConfig.apiType,
                    providerSpecificHeaders: llmConfig.providerSpecificHeaders,
                    // Pass key identifiers for the proxy to use
                    apiKeyEnvVar: llmConfig.apiKeyEnvVar,
                    apiKeyFileName: llmConfig.apiKeyFileName,
                },
                llmRequestPayload: providerRequestPayload
            };
            // Authorization header is NOT set by the client; proxy handles it.
            this.#logger.debug(`OpenAINativeJsonStrategy (${llmId}): Client-side call. Using proxy: ${targetUrl}`);
        } else { // Server-side or direct call
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            } else {
                this.#logger.warn(`OpenAINativeJsonStrategy (${llmId}): API key is not provided for a server-side/direct call. The API call might fail if authentication is required by '${llmConfig.endpointUrl}'.`);
            }
            this.#logger.debug(`OpenAINativeJsonStrategy (${llmId}): Server-side/direct call to: ${targetUrl}`);
        }

        this.#logger.debug(`OpenAINativeJsonStrategy (${llmId}): Making API call to '${targetUrl}'. Note: Prompt must instruct model to output JSON for this mode.`, {
            payloadLength: JSON.stringify(finalPayload)?.length
        });

        let responseData;
        try {
            responseData = await this.#httpClient.request(targetUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(finalPayload)
            });
        } catch (error) {
            this.#logger.error(`OpenAINativeJsonStrategy (${llmId}): API call failed. Error: ${error.message}`, {originalError: error});
            if (error.name === 'HttpClientError' || error.name === 'ConfigurationError') {
                throw error; // Propagate specific errors
            }
            throw new LLMStrategyError(`API call failed for LLM '${llmId}': ${error.message}`, llmId, error);
        }

        this.#logger.debug(`OpenAINativeJsonStrategy (${llmId}): Raw API response received. Preview: ${JSON.stringify(responseData)?.substring(0, 200)}...`);

        if (!responseData || !responseData.choices || !Array.isArray(responseData.choices) || responseData.choices.length === 0) {
            this.#logger.error(`OpenAINativeJsonStrategy (${llmId}): OpenAI response missing 'choices' array or it's empty.`, {responseData});
            throw new LLMStrategyError(`OpenAI response for LLM '${llmId}' missing 'choices' array or it's empty.`, llmId, null, {responseData});
        }

        const message = responseData.choices[0]?.message;
        if (!message) {
            this.#logger.error(`OpenAINativeJsonStrategy (${llmId}): OpenAI response missing 'message' in choices[0].`, {responseData});
            throw new LLMStrategyError(`OpenAI response for LLM '${llmId}' missing 'message' in choices[0].`, llmId, null, {responseData});
        }

        const content = message.content;
        if (typeof content === 'string' && content.trim() !== '') {
            this.#logger.info(`OpenAINativeJsonStrategy (${llmId}): Extracted JSON string from message.content.`);
            this.#logger.debug(`OpenAINativeJsonStrategy (${llmId}): JSON string preview: ${content.substring(0, 100)}...`);
            return content;
        } else {
            this.#logger.error(`OpenAINativeJsonStrategy (${llmId}): Expected JSON string not found or was empty in choices[0].message.content. Type: ${typeof content}`, {responseData});
            throw new LLMStrategyError(`OpenAI response for LLM '${llmId}' (JSON mode) did not contain expected string content. Received type: ${typeof content}`, llmId, null, {responseData});
        }
    }
}

// --- FILE END ---