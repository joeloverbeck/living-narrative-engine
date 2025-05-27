// src/llms/strategies/defaultPromptEngineeringStrategy.js
// --- FILE START ---

import {BaseLLMStrategy} from './base/baseLLMStrategy.js';
import {LLMStrategyError} from '../errors/LLMStrategyError.js';
import {ConfigurationError} from '../../turns/adapters/configurableLLMAdapter.js'; // Assuming this is the correct path
import {BaseChatLLMStrategy} from './base/baseChatLLMStrategy.js';
import {BaseCompletionLLMStrategy} from './base/baseCompletionLLMStrategy.js';
import {CLOUD_API_TYPES} from '../constants/llmConstants.js';

/**
 * @typedef {import('../interfaces/ILLMStrategy.js').ILLMStrategy} ILLMStrategy
 * @typedef {import('../interfaces/ILLMStrategy.js').LLMStrategyExecuteParams} LLMStrategyExecuteParams
 * @typedef {import('../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../environmentContext.js').EnvironmentContext} EnvironmentContext
 */

/**
 * @class DefaultPromptEngineeringStrategy
 * @implements {ILLMStrategy}
 * @description A strategy that relies on prompt engineering to instruct the LLM
 * to return a JSON response. It does not use specific API features like tool calling
 * or native JSON modes. Success depends heavily on the promptFrame's clarity.
 */
export class DefaultPromptEngineeringStrategy extends BaseLLMStrategy {
    /**
     * @private
     * @type {IHttpClient}
     */
    #httpClient;

    /**
     * Constructor for DefaultPromptEngineeringStrategy.
     * @param {object} dependencies - The dependencies for this strategy.
     * @param {IHttpClient} dependencies.httpClient - An HTTP client instance.
     * @param {ILogger} dependencies.logger - A logger instance.
     * @throws {Error} If dependencies are invalid.
     */
    constructor({httpClient, logger}) {
        // Validate logger FIRST for this specific class's requirement.
        if (!logger ||
            typeof logger.info !== 'function' ||
            typeof logger.error !== 'function' ||
            typeof logger.debug !== 'function' ||
            typeof logger.warn !== 'function') {
            // Cannot use logger if it's invalid, so console.error for this specific failure.
            console.error('DefaultPromptEngineeringStrategy Error: Constructor requires a valid ILogger instance with info, error, debug, and warn methods.');
            throw new Error('DefaultPromptEngineeringStrategy: Constructor requires a valid ILogger instance.');
        }

        super(logger); // Now logger is known to be valid for BaseLLMStrategy.

        if (!httpClient || typeof httpClient.request !== 'function') {
            this.logger.error('DefaultPromptEngineeringStrategy: Constructor requires a valid IHttpClient instance.');
            throw new Error('DefaultPromptEngineeringStrategy: Constructor requires a valid IHttpClient instance.');
        }

        this.#httpClient = httpClient;
        this.logger.debug('DefaultPromptEngineeringStrategy: Instance created.');
    }

    /**
     * Executes the LLM call using prompt engineering to request JSON output.
     * @param {LLMStrategyExecuteParams} params - The parameters for execution.
     * @returns {Promise<string>} A promise that resolves with the LLM's response content,
     * which is expected to be a JSON string based on the prompt.
     * @throws {LLMStrategyError} If the execution fails due to configuration, API errors,
     * or inability to extract a valid response string.
     */
    async execute(params) {
        const {gameSummary, llmConfig, apiKey, environmentContext} = params;
        const llmId = llmConfig?.id || 'UnknownLLM';

        try {
            // 1. Validate essential parameters
            if (!llmConfig || typeof llmConfig !== 'object') {
                this.logger.error(`DefaultPromptEngineeringStrategy (${llmId}): llmConfig is required and must be an object.`);
                throw new ConfigurationError('llmConfig is required.', {llmId});
            }
            if (!environmentContext || typeof environmentContext.isClient !== 'function') {
                this.logger.error(`DefaultPromptEngineeringStrategy (${llmId}): environmentContext is required.`);
                throw new ConfigurationError('environmentContext is required.', {llmId});
            }
            if (typeof gameSummary !== 'string') {
                this.logger.error(`DefaultPromptEngineeringStrategy (${llmId}): 'gameSummary' is required and must be a string.`);
                throw new LLMStrategyError(`'gameSummary' is required and must be a string for LLM '${llmId}'.`, llmId);
            }

            this.logger.info(`DefaultPromptEngineeringStrategy: Executing for LLM '${llmId}'. Success depends heavily on prompt quality for JSON output.`);

            // 2. Prompt Construction
            let promptBuilder;
            if (['openai', 'openrouter', 'anthropic'].includes(llmConfig.apiType) ||
                (typeof llmConfig.promptFrame === 'object' && llmConfig.promptFrame && llmConfig.promptFrame.system)) {
                promptBuilder = new BaseChatLLMStrategy(this.logger);
            } else {
                promptBuilder = new BaseCompletionLLMStrategy(this.logger);
            }

            const basePromptPayloadPart = promptBuilder._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);

            if (!basePromptPayloadPart || (basePromptPayloadPart.messages && basePromptPayloadPart.messages.length === 0) || (basePromptPayloadPart.prompt && basePromptPayloadPart.prompt.trim() === '')) {
                this.logger.error(`DefaultPromptEngineeringStrategy (${llmId}): Prompt construction failed to produce a valid prompt or messages.`);
                throw new LLMStrategyError(`Prompt construction failed to produce content for LLM '${llmId}'.`, llmId);
            }

            // 3. Request Payload Construction
            const providerRequestPayload = {
                ...(llmConfig.defaultParameters || {}),
                model: llmConfig.modelIdentifier,
                ...basePromptPayloadPart,
            };
            if (llmConfig.apiType === 'ollama' && basePromptPayloadPart.prompt && providerRequestPayload.stream === undefined) {
                providerRequestPayload.stream = false;
            }

            // 4. Determine Target URL and Headers
            let targetUrl = llmConfig.endpointUrl;
            let finalPayload = providerRequestPayload;
            const headers = {
                'Content-Type': 'application/json',
                ...(llmConfig.providerSpecificHeaders || {})
            };

            // 5. Authentication & Proxy Handling
            const isCloud = CLOUD_API_TYPES.includes(llmConfig.apiType);

            if (environmentContext.isClient() && isCloud) {
                targetUrl = environmentContext.getProxyServerUrl();
                if (!targetUrl) {
                    this.logger.error(`DefaultPromptEngineeringStrategy (${llmId}): Client-side proxy URL not configured.`);
                    throw new ConfigurationError('Client-side proxy URL not configured.', {
                        llmId,
                        missingConfig: 'proxyServerUrl'
                    });
                }
                if (!llmConfig.apiKeyEnvVar && !llmConfig.apiKeyFileName) {
                    this.logger.error(`DefaultPromptEngineeringStrategy (${llmId}): API key source (apiKeyEnvVar or apiKeyFileName) missing in llmConfig for client-side proxied call.`);
                    throw new ConfigurationError('API key configuration missing for client-side proxied call.', {llmId});
                }
                finalPayload = {
                    targetLlmConfig: {
                        endpointUrl: llmConfig.endpointUrl,
                        modelIdentifier: llmConfig.modelIdentifier,
                        apiType: llmConfig.apiType,
                        apiKeyEnvVar: llmConfig.apiKeyEnvVar,
                        apiKeyFileName: llmConfig.apiKeyFileName,
                        providerSpecificHeaders: llmConfig.providerSpecificHeaders || {},
                    },
                    llmRequestPayload: providerRequestPayload
                };
                Object.keys(headers).forEach(key => {
                    if (key.toLowerCase() === 'authorization' || key.toLowerCase() === 'x-api-key') {
                        delete headers[key];
                    }
                });
                this.logger.debug(`DefaultPromptEngineeringStrategy (${llmId}): Client-side call. Using proxy: ${targetUrl}`);
            } else if (isCloud) {
                if (!apiKey) {
                    this.logger.warn(`DefaultPromptEngineeringStrategy (${llmId}): API key is not provided for a server-side/direct cloud call to '${llmConfig.endpointUrl}'. The API call might fail.`);
                } else {
                    if (llmConfig.apiType === 'anthropic') {
                        headers['x-api-key'] = apiKey;
                        if (!headers['anthropic-version'] && llmConfig.providerSpecificHeaders?.['anthropic-version']) {
                            headers['anthropic-version'] = llmConfig.providerSpecificHeaders['anthropic-version'];
                        }
                    } else if (['openai', 'openrouter'].includes(llmConfig.apiType) || llmConfig.apiType.startsWith('azure')) {
                        headers['Authorization'] = `Bearer ${apiKey}`;
                    } else {
                        this.logger.debug(`DefaultPromptEngineeringStrategy (${llmId}): Using default Bearer token auth for apiType '${llmConfig.apiType}'.`);
                        headers['Authorization'] = `Bearer ${apiKey}`;
                    }
                }
            } else {
                if (apiKey) {
                    this.logger.warn(`DefaultPromptEngineeringStrategy (${llmId}): An apiKey was provided for a non-cloud or local LLM type '${llmConfig.apiType}'. It will likely be ignored.`, {llmId});
                }
            }

            // 6. API Call
            this.logger.debug(`DefaultPromptEngineeringStrategy (${llmId}): Making API call to '${targetUrl}'. Payload preview: ${JSON.stringify(finalPayload)?.substring(0, 100)}...`,
                {payloadLength: JSON.stringify(finalPayload)?.length}
            );

            const responseData = await this.#httpClient.request(targetUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(finalPayload)
            });

            // 7. Response Extraction
            this.logger.debug(`DefaultPromptEngineeringStrategy (${llmId}): Raw API response received. Preview: ${JSON.stringify(responseData)?.substring(0, 200)}...`);

            if (!responseData) {
                this.logger.error(`DefaultPromptEngineeringStrategy (${llmId}): API response was null or undefined.`);
                throw new LLMStrategyError('API response was null or undefined.', llmId, null, {responseData});
            }
            if (responseData.error) {
                this.logger.error(`DefaultPromptEngineeringStrategy (${llmId}): API returned an error object.`, {error: responseData.error});
                const message = typeof responseData.error === 'string' ? responseData.error : responseData.error.message || 'Unknown API error';
                throw new LLMStrategyError(`API Error: ${message}`, llmId, null, {apiError: responseData.error});
            }

            let content = null;
            if (responseData.choices?.[0]?.message?.content) { // OpenAI/chat-like
                content = responseData.choices[0].message.content;
            } else if (responseData.choices?.[0]?.text) { // OpenAI older completion
                content = responseData.choices[0].text;
            } else if (responseData.content?.[0]?.text && responseData.content[0].type === 'text') { // Anthropic
                content = responseData.content[0].text;
            } else if (responseData.message?.content) { // Ollama /api/chat
                content = responseData.message.content;
            } else if (typeof responseData.response === 'string') { // Ollama /api/generate
                content = responseData.response;
            } else if (typeof responseData === 'string') { // Direct string response
                content = responseData;
            }

            if (typeof content === 'string' && content.trim() !== '') {
                this.logger.info(`DefaultPromptEngineeringStrategy (${llmId}): Extracted content string. Length: ${content.length}`);
                return content.trim();
            } else {
                this.logger.error(`DefaultPromptEngineeringStrategy (${llmId}): Could not extract a non-empty content string from the API response.`, {responseData});
                throw new LLMStrategyError('Failed to extract usable content string from LLM response.', llmId, null, {responseData});
            }
        } catch (error) {
            if (error instanceof LLMStrategyError || error instanceof ConfigurationError) {
                throw error;
            }
            const errorMessage = `DefaultPromptEngineeringStrategy (${llmId}) failed: ${error.message}`;
            this.logger.error(errorMessage, {
                originalErrorName: error.name,
                originalErrorMessage: error.message,
                stack: error.stack // Keep stack for better debugging if needed
            });
            throw new LLMStrategyError(errorMessage, llmId, error);
        }
    }
}

// --- FILE END ---