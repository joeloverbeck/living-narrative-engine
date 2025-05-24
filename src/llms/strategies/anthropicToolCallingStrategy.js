// src/llms/strategies/anthropicToolCallingStrategy.js
// --- FILE START ---

import {ILLMStrategy} from '../interfaces/ILLMStrategy.js';
import {LLMStrategyError} from '../errors/LLMStrategyError.js';
import {
    ANTHROPIC_TOOL_NAME,
    GAME_AI_ACTION_SPEECH_TOOL_PARAMETERS_SCHEMA,
    DEFAULT_ANTHROPIC_VERSION
} from '../constants/llmConstants.js';
import {BaseChatLLMStrategy} from './base/baseChatLLMStrategy.js';

/**
 * @typedef {import('../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/ILLMStrategy.js').LLMStrategyExecuteParams} LLMStrategyExecuteParams
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../environmentContext.js').EnvironmentContext} EnvironmentContext
 */

/**
 * Implements the ILLMStrategy interface for Anthropic's Claude APIs
 * that support the "tool use" feature for structured JSON output.
 * @class AnthropicToolCallingStrategy
 * @implements {ILLMStrategy}
 */
export class AnthropicToolCallingStrategy extends ILLMStrategy {
    /** @type {IHttpClient} */
    #httpClient;
    /** @type {ILogger} */
    #logger;
    /** @type {BaseChatLLMStrategy} */
    #promptBuilder;

    /**
     * Constructor for AnthropicToolCallingStrategy.
     * @param {object} dependencies - The dependencies for this strategy.
     * @param {IHttpClient} dependencies.httpClient - An instance of IHttpClient.
     * @param {ILogger} dependencies.logger - An instance of ILogger.
     */
    constructor({httpClient, logger}) {
        super();
        if (!httpClient) {
            const errMsg = 'AnthropicToolCallingStrategy: httpClient dependency is required.';
            (logger || console).error(errMsg);
            throw new Error(errMsg);
        }
        if (!logger) {
            const errMsg = 'AnthropicToolCallingStrategy: logger dependency is required.';
            (httpClient.logger || console).error(errMsg);
            throw new Error(errMsg);
        }
        this.#httpClient = httpClient;
        this.#logger = logger;
        this.#promptBuilder = new BaseChatLLMStrategy(this.#logger);
        this.#logger.debug('AnthropicToolCallingStrategy: Instance created.');
    }

    /**
     * Executes the Anthropic tool calling strategy.
     * @param {LLMStrategyExecuteParams} params - The parameters for execution.
     * @returns {Promise<string>} A promise that resolves to a JSON string of the tool input.
     * @throws {LLMStrategyError} If any error occurs during the process.
     */
    async execute(params) {
        const {gameSummary, llmConfig, apiKey, environmentContext} = params;

        if (!llmConfig) {
            this.#logger.error("AnthropicToolCallingStrategy: llmConfig parameter is null or undefined.");
            throw new LLMStrategyError("llmConfig is required.", {llmId: "N/A"});
        }
        if (!environmentContext) {
            this.#logger.error(`AnthropicToolCallingStrategy: environmentContext parameter is null or undefined for LLM '${llmConfig.id}'.`);
            throw new LLMStrategyError("environmentContext is required.", {llmId: llmConfig.id});
        }

        this.#logger.info(`AnthropicToolCallingStrategy: Executing for LLM '${llmConfig.id}'.`);

        try {
            // 1. Prompt Construction
            const baseMessagesPayload = this.#promptBuilder._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            this.#logger.debug(`AnthropicToolCallingStrategy: Prompt constructed for LLM '${llmConfig.id}'.`);

            // 2. Tool Definition
            const anthropicTool = {
                name: ANTHROPIC_TOOL_NAME,
                description: "Extracts the character's next action command and spoken dialogue for the text adventure game, based on the current game situation. Both action and speech are required.",
                input_schema: GAME_AI_ACTION_SPEECH_TOOL_PARAMETERS_SCHEMA
            };
            this.#logger.debug(`AnthropicToolCallingStrategy: Defined tool: ${ANTHROPIC_TOOL_NAME}`);

            // 3. Request Payload Construction
            const providerRequestPayload = {
                ...llmConfig.defaultParameters,
                model: llmConfig.modelIdentifier,
                ...baseMessagesPayload,
                tools: [anthropicTool],
                tool_choice: {type: "tool", name: ANTHROPIC_TOOL_NAME}
            };
            this.#logger.debug(`AnthropicToolCallingStrategy: Constructed provider request payload for LLM '${llmConfig.id}'. Model: ${llmConfig.modelIdentifier}`);

            let targetUrl = llmConfig.endpointUrl;
            const baseHeaders = {
                'Content-Type': 'application/json',
                ...(llmConfig.providerSpecificHeaders || {})
            };

            baseHeaders['anthropic-version'] = (llmConfig.providerSpecificHeaders && llmConfig.providerSpecificHeaders['anthropic-version'])
                ? llmConfig.providerSpecificHeaders['anthropic-version']
                : DEFAULT_ANTHROPIC_VERSION;

            let finalPayload = providerRequestPayload;
            let requestExecutionHeaders = {...baseHeaders};

            if (environmentContext.isClient()) {
                const proxyUrl = environmentContext.getProxyServerUrl();
                if (!proxyUrl) {
                    this.#logger.error("AnthropicToolCallingStrategy: Proxy server URL is not configured in environmentContext for client-side call.", {llmId: llmConfig.id});
                    throw new LLMStrategyError("Proxy server URL not configured for client-side Anthropic call.", {
                        llmId: llmConfig.id,
                        missingConfig: "proxyServerUrl"
                    });
                }
                targetUrl = proxyUrl;

                finalPayload = {
                    targetLlmConfig: {
                        endpointUrl: llmConfig.endpointUrl,
                        modelIdentifier: llmConfig.modelIdentifier,
                        apiType: llmConfig.apiType,
                        apiKeyEnvVar: llmConfig.apiKeyEnvVar,
                        apiKeyFileName: llmConfig.apiKeyFileName,
                        providerSpecificHeaders: {
                            ...(llmConfig.providerSpecificHeaders || {}),
                            'anthropic-version': baseHeaders['anthropic-version']
                        }
                    },
                    llmRequestPayload: providerRequestPayload
                };
                requestExecutionHeaders = {'Content-Type': 'application/json'};
                this.#logger.info(`AnthropicToolCallingStrategy: Client-side call detected. Routing through proxy: ${targetUrl}.`);
            } else {
                if (apiKey) {
                    requestExecutionHeaders['x-api-key'] = apiKey;
                    this.#logger.info("AnthropicToolCallingStrategy: Server-side/direct call. x-api-key header set from provided apiKey.");
                } else if (llmConfig.apiType !== 'local' && llmConfig.apiType !== 'ollama' && !llmConfig.endpointUrl.includes('localhost')) {
                    this.#logger.warn(`AnthropicToolCallingStrategy: API key is not provided for a server-side/direct cloud call to LLM '${llmConfig.id}' at '${llmConfig.endpointUrl}'. The API call might fail if authentication is required by the endpoint.`);
                }
            }

            this.#logger.debug(`AnthropicToolCallingStrategy: Making API call to '${targetUrl}'. Effective anthropic-version: ${baseHeaders['anthropic-version']}.`, {
                payloadLength: JSON.stringify(finalPayload)?.length,
            });

            const responseData = await this.#httpClient.request(targetUrl, {
                method: 'POST',
                headers: requestExecutionHeaders,
                body: JSON.stringify(finalPayload)
            });

            this.#logger.debug(`AnthropicToolCallingStrategy: Raw API response received. Preview: ${JSON.stringify(responseData)?.substring(0, 200)}...`);

            if (!responseData) {
                this.#logger.error("AnthropicToolCallingStrategy: API response was null or undefined.", {llmId: llmConfig.id});
                throw new LLMStrategyError("Anthropic API response was null or undefined.", {
                    llmId: llmConfig.id,
                    response: responseData
                });
            }

            if (responseData.error) {
                this.#logger.error(`AnthropicToolCallingStrategy: API returned an error for LLM '${llmConfig.id}'.`, {
                    llmId: llmConfig.id,
                    error: responseData.error
                });
                throw new LLMStrategyError(`Anthropic API Error: ${responseData.error.type} - ${responseData.error.message}`, {
                    llmId: llmConfig.id,
                    apiError: responseData.error
                });
            }

            if (responseData.stop_reason === "tool_use" && Array.isArray(responseData.content)) {
                const toolUseBlock = responseData.content.find(block =>
                    block.type === "tool_use" && block.name === ANTHROPIC_TOOL_NAME
                );

                if (toolUseBlock && typeof toolUseBlock.input === 'object' && toolUseBlock.input !== null) {
                    const argumentsObject = toolUseBlock.input;
                    this.#logger.info(`AnthropicToolCallingStrategy: Extracted tool input object for LLM '${llmConfig.id}'.`);
                    this.#logger.debug(`AnthropicToolCallingStrategy: Tool input arguments:`, argumentsObject);
                    return JSON.stringify(argumentsObject);
                } else {
                    this.#logger.error(`AnthropicToolCallingStrategy: No matching tool_use block or valid input object found for LLM '${llmConfig.id}'. Expected tool name '${ANTHROPIC_TOOL_NAME}'.`, {
                        llmId: llmConfig.id,
                        stopReason: responseData.stop_reason,
                        contentPreview: JSON.stringify(responseData.content)?.substring(0, 300),
                        expectedToolName: ANTHROPIC_TOOL_NAME
                    });
                    throw new LLMStrategyError(`Anthropic response for LLM '${llmConfig.id}' did not contain expected tool_use block or input object.`, {
                        llmId: llmConfig.id,
                        responsePreview: JSON.stringify(responseData)?.substring(0, 500)
                    });
                }
            } else {
                this.#logger.error(`AnthropicToolCallingStrategy: Response stop_reason was not 'tool_use' or content was not as expected for LLM '${llmConfig.id}'.`, {
                    llmId: llmConfig.id,
                    responsePreview: JSON.stringify(responseData)?.substring(0, 500),
                    expectedStopReason: "tool_use",
                });
                let errorMessage = `Anthropic response for LLM '${llmConfig.id}' did not indicate tool_use correctly or content was malformed.`;
                if (responseData.stop_reason !== "tool_use") {
                    errorMessage += ` Actual stop_reason: '${responseData.stop_reason}'.`;
                } else if (!Array.isArray(responseData.content)) {
                    errorMessage += ` Response content was not an array.`;
                }
                throw new LLMStrategyError(errorMessage, {
                    llmId: llmConfig.id,
                    responsePreview: JSON.stringify(responseData)?.substring(0, 500)
                });
            }

        } catch (error) {
            const currentLlmId = llmConfig ? llmConfig.id : "N/A";
            if (error instanceof LLMStrategyError) {
                throw error;
            }
            this.#logger.error(`AnthropicToolCallingStrategy: Unhandled error during execution for LLM '${currentLlmId}'. Error: ${error.message}`, {
                llmId: currentLlmId,
                originalErrorName: error.name,
                originalErrorMessage: error.message,
                errorStack: error.stack?.substring(0, 1000)
            });
            throw new LLMStrategyError(`AnthropicToolCallingStrategy failed: ${error.message}`, {
                llmId: currentLlmId,
                originalError: {name: error.name, message: error.message}
            });
        }
    }
}

// --- FILE END ---