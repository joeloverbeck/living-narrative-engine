// src/llms/strategies/openRouterToolCallingStrategy.js
// --- FILE START ---
import {BaseOpenRouterStrategy} from './base/baseOpenRouterStrategy.js';
import {LLMStrategyError} from '../errors/LLMStrategyError.js';
import {
    OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA,
    OPENROUTER_DEFAULT_TOOL_DESCRIPTION
} from '../constants/llmConstants.js';

/**
 * @typedef {import('../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 */

/**
 * @class OpenRouterToolCallingStrategy
 * @extends {BaseOpenRouterStrategy}
 * @description Strategy for OpenRouter-compatible LLMs using the OpenAI tool-calling mechanism.
 */
export class OpenRouterToolCallingStrategy extends BaseOpenRouterStrategy {
    /**
     * Constructs an instance of OpenRouterToolCallingStrategy.
     * @param {object} deps - The dependencies object.
     * @param {IHttpClient} deps.httpClient - The HTTP client for making API requests.
     * @param {ILogger} deps.logger - The logger instance.
     * (Logger validity is ensured by BaseLLMStrategy's constructor via super(logger) call)
     */
    constructor({httpClient, logger}) {
        super({httpClient, logger}); // Pass dependencies to the BaseOpenRouterStrategy constructor
        // this.logger is guaranteed to be valid here.
        this.logger.debug(`${this.constructor.name} initialized.`);
    }

    /**
     * Constructs the provider-specific part of the request payload for Tool Calling mode.
     * @override
     * @protected
     * @param {object} baseMessagesPayload - The base messages payload.
     * @param {LLMModelConfig} llmConfig - The LLM configuration.
     * @returns {object} An object containing the `tools` and `tool_choice` parameters.
     * @throws {LLMStrategyError} If tool schema configuration is invalid.
     */
    _buildProviderRequestPayloadAdditions(baseMessagesPayload, llmConfig) {
        const llmId = llmConfig?.id || 'UnknownLLM';
        const toolName = OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.name;
        const toolParameters = OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.schema || OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA;

        if (!toolName || typeof toolName !== 'string') {
            // this.logger is guaranteed.
            this.logger.error(`${this.constructor.name} (${llmId}): Invalid tool name in OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA. Expected a string.`, {
                llmId,
                toolName
            });
            throw new LLMStrategyError(`Invalid tool name for tool calling: ${toolName}`, llmId);
        }
        if (!toolParameters || typeof toolParameters !== 'object') {
            this.logger.error(`${this.constructor.name} (${llmId}): Invalid tool parameters schema in OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA. Expected an object.`, {
                llmId,
                toolParameters
            });
            throw new LLMStrategyError(`Invalid tool parameters schema for tool calling.`, llmId);
        }

        const tool = {
            type: "function",
            function: {
                name: toolName,
                description: OPENROUTER_DEFAULT_TOOL_DESCRIPTION,
                parameters: toolParameters,
            }
        };
        // this.logger is guaranteed.
        this.logger.debug(`${this.constructor.name} (${llmId}): Defined tool for use.`, {
            llmId,
            toolName: tool.function.name
        });

        return {
            tools: [tool],
            tool_choice: {type: "function", function: {name: tool.function.name}}
        };
    }

    /**
     * Extracts the JSON string from the OpenRouter response using `message.tool_calls`.
     * @override
     * @protected
     * @async
     * @param {any} responseData - The raw response data from the HTTP client.
     * @param {LLMModelConfig} llmConfig - The LLM configuration.
     * @param {object} [providerRequestPayload] - The request payload sent to the provider.
     * @returns {Promise<string>} A promise that resolves to the extracted JSON string.
     * @throws {LLMStrategyError} If JSON content cannot be extracted or validated.
     */
    async _extractJsonOutput(responseData, llmConfig, providerRequestPayload) {
        const llmId = llmConfig?.id || 'UnknownLLM';
        const message = responseData?.choices?.[0]?.message;
        const expectedToolName = OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.name;

        if (!message) {
            const errorMsg = `${this.constructor.name} (${llmId}): Response structure did not contain 'choices[0].message'.`;
            // this.logger is guaranteed.
            this.logger.warn(errorMsg, {llmId, responseDataPreview: JSON.stringify(responseData)?.substring(0, 500)});
            throw new LLMStrategyError(errorMsg, llmId, null, {responsePreview: JSON.stringify(responseData)?.substring(0, 500)});
        }

        if (!expectedToolName || typeof expectedToolName !== 'string') {
            const errorMsg = `${this.constructor.name} (${llmId}): Invalid expectedToolName from OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.name. Cannot proceed with extraction.`;
            this.logger.error(errorMsg, {llmId, expectedToolNameFromConstant: expectedToolName});
            throw new LLMStrategyError(errorMsg, llmId);
        }

        if (message.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];

            let reason = "";
            if (toolCall.type !== "function") {
                reason = `Expected toolCall.type to be "function", got "${toolCall.type}".`;
            } else if (!toolCall.function) {
                reason = "toolCall.function is missing.";
            } else if (toolCall.function.name !== expectedToolName) {
                reason = `Expected toolCall.function.name to be "${expectedToolName}", got "${toolCall.function.name}".`;
            } else if (toolCall.function.arguments === undefined || toolCall.function.arguments === null) {
                reason = "toolCall.function.arguments is missing or null.";
            } else if (typeof toolCall.function.arguments !== 'string') {
                reason = `Expected toolCall.function.arguments to be a string, got ${typeof toolCall.function.arguments}.`;
            } else if (toolCall.function.arguments.trim() === '') {
                reason = "toolCall.function.arguments was an empty string.";
            }

            if (reason) {
                const errorMsg = `${this.constructor.name} (${llmId}): Failed to extract JSON from tool_calls. ${reason}`;
                this.logger.error(errorMsg, {
                    llmId,
                    toolCallDetails: {
                        type: toolCall?.type,
                        functionName: toolCall?.function?.name,
                        hasArguments: toolCall?.function?.arguments !== undefined && toolCall?.function?.arguments !== null,
                        argumentsType: typeof toolCall?.function?.arguments,
                        argumentsIsEmpty: typeof toolCall?.function?.arguments === 'string' ? toolCall.function.arguments.trim() === '' : undefined,
                    },
                    expectedToolName,
                    responseDataPreview: JSON.stringify(responseData)?.substring(0, 500)
                });
                throw new LLMStrategyError(errorMsg, llmId, null, {
                    toolCallDetails: toolCall,
                    responsePreview: JSON.stringify(responseData)?.substring(0, 500)
                });
            }

            const extractedJsonString = toolCall.function.arguments.trim();
            this.logger.info(`${this.constructor.name} (${llmId}): Successfully extracted JSON string from tool_calls[0].function.arguments.`, {
                llmId,
                length: extractedJsonString.length
            });
            return extractedJsonString;

        } else {
            const errorMsg = `${this.constructor.name} (${llmId}): Response did not contain expected 'message.tool_calls' array, or it was empty.`;
            this.logger.error(errorMsg, {
                llmId,
                messageObjectPreview: {
                    has_tool_calls: message.hasOwnProperty('tool_calls'),
                    tool_calls_type: typeof message.tool_calls,
                    tool_calls_length: Array.isArray(message.tool_calls) ? message.tool_calls.length : undefined,
                },
                responseDataPreview: JSON.stringify(responseData)?.substring(0, 500)
            });
            throw new LLMStrategyError(errorMsg, llmId, null, {
                messageObject: message,
                responsePreview: JSON.stringify(responseData)?.substring(0, 500)
            });
        }
    }
}

// --- FILE END ---