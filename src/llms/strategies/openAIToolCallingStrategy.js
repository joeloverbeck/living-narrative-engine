// llmStrategies/OpenAIToolCallingStrategy.js
// --- FILE START ---

import {ILLMStrategy} from '../interfaces/ILLMStrategy.js';
import {LLMStrategyError} from '../errors/LLMStrategyError.js'; // Assuming this custom error exists
// Assuming constants are moved to a shared file as per Ticket 18
import {OPENAI_TOOL_NAME, GAME_AI_ACTION_SPEECH_TOOL_PARAMETERS_SCHEMA} from '../constants/llmConstants.js'; // Adjust path as needed
import {BaseChatLLMStrategy} from './base/BaseChatLLMStrategy.js'; // For prompt construction logic

/**
 * @typedef {import('../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/ILLMStrategy.js').LLMStrategyExecuteParams} LLMStrategyExecuteParams
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../environmentContext.js').EnvironmentContext} EnvironmentContext
 */

/**
 * @class OpenAIToolCallingStrategy
 * @implements {ILLMStrategy}
 * @description Strategy for interacting with OpenAI-compatible APIs that support "tool calling"
 * for structured JSON output.
 */
export class OpenAIToolCallingStrategy extends ILLMStrategy {
    #httpClient;
    #logger;
    #promptBuilder;

    constructor({httpClient, logger}) {
        super();
        if (!httpClient || typeof httpClient.request !== 'function') {
            const errorMsg = 'OpenAIToolCallingStrategy: Constructor requires a valid IHttpClient instance.';
            // Use the provided logger if it's valid (enough for .error), otherwise console
            ((logger && typeof logger.error === 'function') ? logger : console).error(errorMsg);
            throw new Error(errorMsg);
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            const errorMsg = 'OpenAIToolCallingStrategy: Constructor requires a valid ILogger instance.';
            // Logger is confirmed invalid here, so use console directly.
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        this.#httpClient = httpClient;
        this.#logger = logger;
        this.#promptBuilder = new BaseChatLLMStrategy(this.#logger);
        this.#logger.debug('OpenAIToolCallingStrategy: Instance created.');
    }

    async execute(params) {
        const {gameSummary, llmConfig, apiKey, environmentContext} = params;

        // Moved llmId initialization after llmConfig validation
        if (!llmConfig || typeof llmConfig !== 'object') {
            const msg = `'llmConfig' is required and must be an object.`;
            this.#logger.error(`OpenAIToolCallingStrategy: ${msg}`, {llmConfig});
            // llmId is not available yet, so pass 'UNKNOWN_LLM' or derive if possible
            throw new LLMStrategyError(msg, llmConfig?.id || 'UNKNOWN_LLM_CONFIG_ERROR');
        }
        const llmId = llmConfig.id || 'UNKNOWN_LLM';

        this.#logger.info(`OpenAIToolCallingStrategy: Executing for LLM '${llmId}'.`);

        if (!gameSummary || typeof gameSummary !== 'string') {
            this.#logger.error(`OpenAIToolCallingStrategy: 'gameSummary' is required and must be a string for LLM '${llmId}'.`, {gameSummary});
            throw new LLMStrategyError(`'gameSummary' is required for LLM '${llmId}'.`, llmId);
        }
        // llmConfig already validated for being an object, further specific checks can be added if needed.
        if (!environmentContext || typeof environmentContext.isClient !== 'function') {
            this.#logger.error(`OpenAIToolCallingStrategy: 'environmentContext' is required for LLM '${llmId}'.`, {environmentContext});
            throw new LLMStrategyError(`'environmentContext' is required for LLM '${llmId}'.`, llmId);
        }

        let baseMessagesPayload;
        try {
            const constructedPrompt = this.#promptBuilder._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            if (!constructedPrompt.messages || !Array.isArray(constructedPrompt.messages)) {
                this.#logger.error(`OpenAIToolCallingStrategy: Prompt construction for LLM '${llmId}' did not yield a 'messages' array.`, {constructedPrompt});
                throw new LLMStrategyError(`Prompt construction failed to produce messages for LLM '${llmId}'.`, llmId);
            }
            baseMessagesPayload = {messages: constructedPrompt.messages};
            this.#logger.debug(`OpenAIToolCallingStrategy: Prompt messages constructed for LLM '${llmId}'. Message count: ${baseMessagesPayload.messages.length}`);
        } catch (error) {
            this.#logger.error(`OpenAIToolCallingStrategy: Error during prompt construction for LLM '${llmId}'. Error: ${error.message}`, {errorDetails: error});
            if (error instanceof LLMStrategyError) { // Re-throw if it's already our specific type
                throw error;
            }
            throw new LLMStrategyError(`Prompt construction failed for LLM '${llmId}': ${error.message}`, llmId, error);
        }

        const openAiTool = {
            type: "function",
            function: {
                name: OPENAI_TOOL_NAME,
                description: llmConfig.jsonOutputStrategy?.toolDescription || "Extracts the character's next game action and speech based on the situation. Both action and speech are required.",
                parameters: GAME_AI_ACTION_SPEECH_TOOL_PARAMETERS_SCHEMA
            }
        };
        this.#logger.debug(`OpenAIToolCallingStrategy: OpenAI tool defined for LLM '${llmId}'. Tool name: '${OPENAI_TOOL_NAME}'.`);

        const providerRequestPayload = {
            ...(llmConfig.defaultParameters || {}),
            model: llmConfig.modelIdentifier,
            ...baseMessagesPayload,
            tools: [openAiTool],
            tool_choice: {type: "function", function: {name: OPENAI_TOOL_NAME}}
        };
        this.#logger.debug(`OpenAIToolCallingStrategy: OpenAI API request payload constructed for LLM '${llmId}'.`, {
            model: providerRequestPayload.model,
            toolCount: providerRequestPayload.tools.length,
            forcedTool: providerRequestPayload.tool_choice.function.name,
        });

        let targetUrl = llmConfig.endpointUrl;
        let finalPayload = providerRequestPayload;
        const headers = {
            'Content-Type': 'application/json',
            ...(llmConfig.providerSpecificHeaders || {})
        };

        if (apiKey && typeof apiKey === 'string' && apiKey.trim() !== '') {
            if (!environmentContext.isClient() || !llmConfig.apiKeyEnvVar && !llmConfig.apiKeyFileName) {
                headers['Authorization'] = `Bearer ${apiKey}`;
                this.#logger.debug(`OpenAIToolCallingStrategy: Authorization header set for direct/server call for LLM '${llmId}'.`);
            } else if (environmentContext.isClient()) {
                this.#logger.debug(`OpenAIToolCallingStrategy: Client-side call for LLM '${llmId}'. API key provided but will be handled by proxy based on config (apiKeyEnvVar/apiKeyFileName). Authorization header not set by client.`);
            }
        }

        if (environmentContext.isClient() && (llmConfig.apiKeyEnvVar || llmConfig.apiKeyFileName)) {
            targetUrl = environmentContext.getProxyServerUrl();
            if (!targetUrl) {
                this.#logger.error(`OpenAIToolCallingStrategy: Client-side proxy call required for LLM '${llmId}', but proxy server URL is not configured in environmentContext.`);
                throw new LLMStrategyError(`Client-side proxy URL not configured for LLM '${llmId}'.`, llmId);
            }
            finalPayload = {
                targetLlmConfig: {
                    endpointUrl: llmConfig.endpointUrl,
                    modelIdentifier: llmConfig.modelIdentifier,
                    apiType: llmConfig.apiType,
                    apiKeyEnvVar: llmConfig.apiKeyEnvVar,
                    apiKeyFileName: llmConfig.apiKeyFileName,
                    providerSpecificHeaders: llmConfig.providerSpecificHeaders
                },
                llmRequestPayload: providerRequestPayload
            };
            delete headers['Authorization'];
            this.#logger.info(`OpenAIToolCallingStrategy: Client-side call for LLM '${llmId}'. Routing through proxy: ${targetUrl}.`);
        } else if (environmentContext.isClient() && !(llmConfig.apiKeyEnvVar || llmConfig.apiKeyFileName) && !apiKey) {
            this.#logger.error(`OpenAIToolCallingStrategy: Client-side call for LLM '${llmId}' requires proxy, but no apiKeyEnvVar or apiKeyFileName configured, and no direct apiKey provided.`);
            throw new LLMStrategyError(`API key configuration missing for client-side proxied call to LLM '${llmId}'.`, llmId);
        }

        let responseData;
        try {
            this.#logger.debug(`OpenAIToolCallingStrategy: Making API call to '${targetUrl}' for LLM '${llmId}'. Payload size: ~${JSON.stringify(finalPayload)?.length} chars.`);
            responseData = await this.#httpClient.request(targetUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(finalPayload)
            });
            this.#logger.debug(`OpenAIToolCallingStrategy: Raw API response received for LLM '${llmId}'. Preview: ${JSON.stringify(responseData)?.substring(0, 200)}...`);
        } catch (error) {
            this.#logger.error(`OpenAIToolCallingStrategy: API call to '${targetUrl}' failed for LLM '${llmId}'. Error: ${error.message}`, {error});
            if (error.name === 'HttpClientError') {
                throw error;
            }
            throw new LLMStrategyError(`API call failed for LLM '${llmId}': ${error.message}`, llmId, error);
        }

        try {
            const message = responseData?.choices?.[0]?.message;
            if (message && message.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
                const toolCall = message.tool_calls[0];
                if (toolCall.type === "function" &&
                    toolCall.function &&
                    typeof toolCall.function.name === 'string' &&
                    toolCall.function.name.trim() === OPENAI_TOOL_NAME &&
                    typeof toolCall.function.arguments === 'string') {

                    const argumentsString = toolCall.function.arguments;
                    this.#logger.info(`OpenAIToolCallingStrategy: Extracted tool arguments string for LLM '${llmId}'. Length: ${argumentsString.length}.`);
                    this.#logger.debug(`OpenAIToolCallingStrategy: Arguments string for LLM '${llmId}': ${argumentsString}`);
                    return argumentsString;
                } else {
                    let detail = `Unexpected tool_call structure or name for LLM '${llmId}'. Expected function name '${OPENAI_TOOL_NAME}'.`;
                    if (!toolCall.function) detail += ` 'function' property missing in tool_call.`;
                    else {
                        if (toolCall.type !== "function") detail += ` Got type: ${toolCall.type}.`;
                        if (toolCall.function.name !== OPENAI_TOOL_NAME) detail += ` Got name: ${toolCall.function.name}.`;
                        if (typeof toolCall.function.arguments !== 'string') detail += ` Arguments not a string.`;
                    }

                    this.#logger.error(`OpenAIToolCallingStrategy: ${detail}`, {toolCall});
                    throw new LLMStrategyError(detail, llmId, null, {responseData});
                }
            } else {
                let errorDetail = `OpenAI response for LLM '${llmId}' did not contain expected tool_calls structure.`;
                if (!responseData?.choices || !responseData.choices.length) errorDetail = `OpenAI response for LLM '${llmId}' missing 'choices' array or it's empty.`;
                else if (!message) errorDetail = `OpenAI response for LLM '${llmId}' missing 'message' in choices[0].`;
                else if (!message.tool_calls) errorDetail = `OpenAI response for LLM '${llmId}' missing 'tool_calls' in message.`;
                else if (!Array.isArray(message.tool_calls) || message.tool_calls.length === 0) errorDetail = `OpenAI response for LLM '${llmId}' 'tool_calls' is empty or not an array.`;

                this.#logger.error(errorDetail, {responseBrief: JSON.stringify(responseData)?.substring(0, 500)});
                throw new LLMStrategyError(errorDetail, llmId, null, {responseData});
            }
        } catch (error) {
            if (error instanceof LLMStrategyError) {
                throw error;
            }
            this.#logger.error(`OpenAIToolCallingStrategy: Error processing API response for LLM '${llmId}'. Error: ${error.message}`, {error});
            throw new LLMStrategyError(`Response processing failed for LLM '${llmId}': ${error.message}`, llmId, error, {responseData});
        }
    }
}

// --- FILE END ---