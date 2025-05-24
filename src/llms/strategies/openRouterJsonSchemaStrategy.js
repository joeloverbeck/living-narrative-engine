// src/llms/strategies/OpenRouterJsonSchemaStrategy.js
// --- UPDATED FILE START ---
import {BaseChatLLMStrategy} from './base/baseChatLLMStrategy.js';
import {ILLMStrategy} from '../interfaces/ILLMStrategy.js'; // Assuming ILLMStrategy is a class for type checking
import {LLMStrategyError} from '../errors/LLMStrategyError.js';
import {ConfigurationError} from '../../turns/adapters/configurableLLMAdapter.js'; // Adjust path if ConfigurationError is moved
import {OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA} from '../constants/llmConstants.js';

/**
 * @typedef {import('../../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../../interfaces/ILLMStrategy.js').LLMStrategyExecuteParams} LLMStrategyExecuteParams
 * @typedef {import('../../environmentContext.js').EnvironmentContext} EnvironmentContext
 */

/**
 * @class OpenRouterJsonSchemaStrategy
 * @extends {BaseChatLLMStrategy}
 * @implements {ILLMStrategy}
 * @description Strategy for OpenRouter JSON Schema compatible APIs.
 */
export class OpenRouterJsonSchemaStrategy extends BaseChatLLMStrategy {
    /** @type {IHttpClient} */
    #httpClient;

    // #logger is inherited as this.logger from BaseLLMStrategy

    /**
     * @param {object} deps
     * @param {IHttpClient} deps.httpClient
     * @param {ILogger} deps.logger
     */
    constructor({httpClient, logger}) {
        super(logger); // Pass logger to the BaseChatLLMStrategy constructor
        if (!httpClient) {
            const errorMsg = "OpenRouterJsonSchemaStrategy: httpClient dependency is required.";
            this.logger.error(errorMsg);
            throw new Error(errorMsg); // Or a specific dependency injection error
        }
        this.#httpClient = httpClient;
        this.logger.debug('OpenRouterJsonSchemaStrategy initialized.');
    }

    /**
     * Executes the OpenRouter JSON Schema strategy.
     * @param {LLMStrategyExecuteParams} params
     * @returns {Promise<string>}
     * @throws {ConfigurationError | LLMStrategyError | import('../../retryHttpClient.js').HttpClientError}
     */
    async execute(params) {
        const {gameSummary, llmConfig, apiKey, environmentContext} = params;
        const llmId = llmConfig?.id || 'UnknownLLM';
        this.logger.info(`OpenRouterJsonSchemaStrategy.execute called for LLM ID: ${llmId}.`);

        if (!llmConfig) {
            this.logger.error(`OpenRouterJsonSchemaStrategy (${llmId}): Missing llmConfig.`);
            throw new ConfigurationError(`Missing llmConfig for OpenRouterJsonSchemaStrategy`, {llmId});
        }
        if (!environmentContext) {
            this.logger.error(`OpenRouterJsonSchemaStrategy (${llmId}): Missing environmentContext.`);
            throw new ConfigurationError(`Missing environmentContext for OpenRouterJsonSchemaStrategy`, {llmId});
        }

        // 1. Pre-condition Check
        if (llmConfig.apiType !== 'openrouter') {
            const errorMsg = `OpenRouterJsonSchemaStrategy (${llmId}): Invalid apiType '${llmConfig.apiType}'. This strategy is specific to 'openrouter'.`;
            this.logger.error(errorMsg);
            throw new ConfigurationError(errorMsg, {llmId, problematicField: 'apiType', fieldValue: llmConfig.apiType});
        }

        // 2. Prompt Construction (utilizing BaseChatLLMStrategy's method)
        const baseMessagesPayload = this._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
        this.logger.debug(`OpenRouterJsonSchemaStrategy (${llmId}): Constructed prompt payload:`, baseMessagesPayload);

        // 3. JSON Schema Definition
        const responseFormat = {
            type: "json_schema", json_schema: OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA // Constant from llmConstants.js
        };
        this.logger.debug(`OpenRouterJsonSchemaStrategy (${llmId}): Using response_format with schema: ${OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.name}`); //

        // 4. Request Payload Construction
        const providerRequestPayload = {
            ...(llmConfig.defaultParameters || {}), model: llmConfig.modelIdentifier, ...baseMessagesPayload, // Contains { messages: [...] }
            response_format: responseFormat
        };
        this.logger.debug(`OpenRouterJsonSchemaStrategy (${llmId}): Assembled provider request payload.`);

        // 5. Determine Target URL and Headers
        let targetUrl = llmConfig.endpointUrl;
        let finalPayload = providerRequestPayload;
        const headers = {
            'Content-Type': 'application/json', ...(llmConfig.providerSpecificHeaders || {})
        };

        // 6. Proxy Handling
        if (environmentContext.isClient()) {
            targetUrl = environmentContext.getProxyServerUrl(); // http://localhost:3001/api/llm-request
            // Construct proxy payload ACCORDING TO THE API CONTRACT:
            finalPayload = {
                llmId: llmConfig.id,                         // The ID of the LLM configuration
                targetPayload: providerRequestPayload,       // The payload for the downstream LLM
                targetHeaders: llmConfig.providerSpecificHeaders || {} // Headers for the downstream LLM
            };
            this.logger.info(`OpenRouterJsonSchemaStrategy (${llmId}): Client-side execution. Using proxy URL: ${targetUrl}. Payload prepared according to API contract.`);
        } else { // Server-side or other non-client environments
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
                this.logger.debug(`OpenRouterJsonSchemaStrategy (${llmId}): Server-side/direct execution. Authorization header set.`);
            } else {
                const errorMsg = `OpenRouterJsonSchemaStrategy (${llmId}): API key is missing for server-side/direct OpenRouter call.`;
                this.logger.error(errorMsg);
                // It could be a ConfigurationError if the setup implies a key should always be present server-side
                // Or LLMStrategyError if it's a runtime issue of key not being passed.
                throw new ConfigurationError(errorMsg, {llmId, problematicField: 'apiKey'});
            }
        }

        let responseData;
        try {
            // 7. API Call
            this.logger.debug(`OpenRouterJsonSchemaStrategy (${llmId}): Making API call to '${targetUrl}'. Payload length: ${JSON.stringify(finalPayload)?.length}`);
            responseData = await this.#httpClient.request(targetUrl, { //
                method: 'POST', headers, body: JSON.stringify(finalPayload)
            });
            this.logger.debug(`OpenRouterJsonSchemaStrategy (${llmId}): Raw API response received. Preview: ${JSON.stringify(responseData)?.substring(0, 250)}...`);

            // 8. Response Extraction
            let extractedJsonString = null;
            const message = responseData?.choices?.[0]?.message;

            if (message) {
                // Primary Extraction (from message.content)
                if (message.content && typeof message.content === 'string' && message.content.trim() !== '') {
                    extractedJsonString = message.content.trim();
                    this.logger.info(`OpenRouterJsonSchemaStrategy (${llmId}): Extracted JSON string from message.content.`);
                } else if (message.content && typeof message.content === 'object') {
                    extractedJsonString = JSON.stringify(message.content);
                    this.logger.info(`OpenRouterJsonSchemaStrategy (${llmId}): Extracted JSON object from message.content and stringified it.`);
                } else {
                    if (message.content === '' || (typeof message.content === 'string' && message.content.trim() === '')) {
                        this.logger.warn(`OpenRouterJsonSchemaStrategy (${llmId}): message.content was an empty string. Will check tool_calls fallback.`);
                    } else if (message.hasOwnProperty('content')) { // content key exists but is null, undefined, or unexpected type
                        this.logger.warn(`OpenRouterJsonSchemaStrategy (${llmId}): message.content was present but not a non-empty string or object (type: ${typeof message.content}, value: ${message.content}). Will check tool_calls fallback.`);
                    } else { // message.content key is missing
                        this.logger.info(`OpenRouterJsonSchemaStrategy (${llmId}): message.content is missing. Will check tool_calls fallback.`);
                    }
                }

                // Fallback Extraction (from message.tool_calls)
                if (extractedJsonString === null && message.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
                    this.logger.info(`OpenRouterJsonSchemaStrategy (${llmId}): message.content not usable, attempting tool_calls fallback.`);
                    const toolCall = message.tool_calls[0];
                    if (toolCall?.type === "function" && toolCall.function?.name === OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.name && //
                        toolCall.function?.arguments && typeof toolCall.function.arguments === 'string' && toolCall.function.arguments.trim() !== '') {
                        extractedJsonString = toolCall.function.arguments.trim();
                        this.logger.info(`OpenRouterJsonSchemaStrategy (${llmId}): Extracted JSON string from tool_calls fallback (function: ${toolCall.function.name}).`);
                    } else {
                        this.logger.warn(`OpenRouterJsonSchemaStrategy (${llmId}): tool_calls structure did not match expected schema or arguments were empty. Expected function name '${OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.name}'.`, {toolCallDetails: toolCall}); //
                    }
                }
            } else {
                this.logger.warn(`OpenRouterJsonSchemaStrategy (${llmId}): Response structure did not contain 'choices[0].message'.`, {responseData});
            }

            // 9. Final Check
            if (extractedJsonString !== null) {
                this.logger.info(`OpenRouterJsonSchemaStrategy (${llmId}): Successfully extracted JSON string. Length: ${extractedJsonString.length}.`);
                return extractedJsonString;
            } else {
                const errorMsg = `OpenRouterJsonSchemaStrategy (${llmId}): Failed to extract JSON content from OpenRouter response. Neither message.content nor a valid tool_call fallback was usable.`;
                this.logger.error(errorMsg, {responseData});
                throw new LLMStrategyError(errorMsg, llmId, null, {responsePreview: JSON.stringify(responseData)?.substring(0, 500)}); //
            }

        } catch (error) {
            // Handle errors from httpClient.request (e.g., HttpClientError) or errors thrown within this strategy
            if (error instanceof ConfigurationError || error instanceof LLMStrategyError) { //
                // Re-throw specific errors if they are already what we want
                throw error;
            }
            // Check if it's likely an HttpClientError (assuming it might have properties like status, url)
            const isHttpClientError = error.name === 'HttpClientError' || (error.hasOwnProperty('status') && error.hasOwnProperty('url'));

            let finalError;
            if (isHttpClientError) {
                this.logger.error(`OpenRouterJsonSchemaStrategy (${llmId}): HttpClientError occurred during API call to '${targetUrl}'. Status: ${error.status}. Message: ${error.message}`, {originalError: error});
                // Propagate HttpClientError directly as it contains specific HTTP context
                finalError = error;
            } else {
                // For other types of errors (e.g., network issues not caught by HttpClientError, unexpected issues)
                const errorMsg = `OpenRouterJsonSchemaStrategy (${llmId}): An unexpected error occurred during API call or response processing for endpoint '${targetUrl}'. Message: ${error.message}`;
                this.logger.error(errorMsg, {originalError: error});
                finalError = new LLMStrategyError(errorMsg, llmId, error, {
                    requestUrl: targetUrl, payloadPreview: JSON.stringify(providerRequestPayload)?.substring(0, 200)
                }); //
            }
            throw finalError;
        }
    }
}

// --- UPDATED FILE END ---