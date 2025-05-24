// src/llms/strategies/OllamaNativeJsonStrategy.js
// --- UPDATED FILE START ---
import {BaseLLMStrategy} from './base/BaseLLMStrategy.js'; // Import general base
import {BaseChatLLMStrategy} from './base/BaseChatLLMStrategy.js'; // Import for chat-style prompts
import {BaseCompletionLLMStrategy} from './base/BaseCompletionLLMStrategy.js'; // Import for completion-style prompts

/**
 * @typedef {import('../../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger // Corrected path
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 */

/**
 * @typedef {object} LLMStrategyExecuteParams
 * @property {string} gameSummary - The detailed textual representation of the game state.
 * @property {LLMModelConfig} llmConfig - The active LLM configuration.
 * @property {string | null} apiKey - The API key for server-side cloud calls, or null.
 * @property {ILogger} [logger] - Optional logger instance.
 */

/**
 * @class OllamaNativeJsonStrategy
 * @extends {BaseLLMStrategy} // Changed base class
 * @description Strategy for Ollama Native JSON Mode. It dynamically chooses
 * prompt construction based on the endpoint URL.
 */
export class OllamaNativeJsonStrategy extends BaseLLMStrategy {
    /** @type {IHttpClient} */
    #httpClient;

    // #logger is inherited as this.logger from BaseLLMStrategy

    /**
     * @param {object} deps
     * @param {IHttpClient} deps.httpClient
     * @param {ILogger} deps.logger
     */
    constructor({httpClient, logger}) {
        super(logger); // Pass logger to the BaseLLMStrategy constructor
        this.#httpClient = httpClient;
        this.logger.debug('OllamaNativeJsonStrategy initialized.');
    }

    /**
     * Executes the Ollama native JSON mode strategy.
     * @param {LLMStrategyExecuteParams} params
     * @returns {Promise<string>}
     */
    async execute({gameSummary, llmConfig, apiKey}) {
        const llmId = llmConfig?.id || 'UnknownLLM';
        this.logger.info(`OllamaNativeJsonStrategy.execute called for LLM ID: ${llmId}.`);

        if (!gameSummary || !llmConfig) {
            this.logger.error(`OllamaNativeJsonStrategy (${llmId}): Missing gameSummary or llmConfig.`);
            throw new Error(`OllamaNativeJsonStrategy (${llmId}): Missing gameSummary or llmConfig.`);
        }

        let promptPayloadPart;
        let chosenPromptBuilder;

        // Decide whether to use chat or completion style prompt construction based on endpoint
        if (llmConfig.endpointUrl && llmConfig.endpointUrl.includes('/api/chat')) {
            chosenPromptBuilder = new BaseChatLLMStrategy(this.logger);
            this.logger.debug(`OllamaNativeJsonStrategy (${llmId}): Using BaseChatLLMStrategy for prompt construction (endpoint includes /api/chat).`);
        } else {
            chosenPromptBuilder = new BaseCompletionLLMStrategy(this.logger);
            this.logger.debug(`OllamaNativeJsonStrategy (${llmId}): Using BaseCompletionLLMStrategy for prompt construction (endpoint does not include /api/chat, e.g., /api/generate).`);
        }

        promptPayloadPart = chosenPromptBuilder._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
        this.logger.debug(`OllamaNativeJsonStrategy (${llmId}): Constructed prompt payload:`, promptPayloadPart);

        // TODO: Implement the actual API call logic in a future ticket.
        // This involves:
        // - Assembling the full request payload using promptPayloadPart (which could be {messages: ...} or {prompt: ...}),
        //   llmConfig.modelIdentifier, llmConfig.defaultParameters, format: "json", stream: false, etc.
        //   Example:
        //   const requestPayload = {
        //       model: llmConfig.modelIdentifier,
        //       ...llmConfig.defaultParameters,
        //       ...promptPayloadPart, // Spreads either 'messages' or 'prompt'
        //       format: "json",
        //       stream: false // Important for Ollama JSON mode to get a single object
        //   };
        // - Making the API call using this.#httpClient.post(llmConfig.endpointUrl, requestPayload, ...).
        // - Processing the response (Ollama returns JSON in `response.message.content` for /api/chat or `response.response` for /api/generate).

        this.logger.warn(`OllamaNativeJsonStrategy (${llmId}): API call and response processing is STUBBED.`);
        return Promise.resolve(JSON.stringify({
            action: `stub_action_from_OllamaNativeJsonStrategy_for_${llmId}`,
            speech: `Stub response from OllamaNativeJsonStrategy using ${chosenPromptBuilder.constructor.name} for ${llmId}`
        }));
    }
}

// --- UPDATED FILE END ---