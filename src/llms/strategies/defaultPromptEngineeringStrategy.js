// src/llms/strategies/DefaultPromptEngineeringStrategy.js
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
 * @class DefaultPromptEngineeringStrategy
 * @extends {BaseLLMStrategy} // Changed base class
 * @description Default Prompt Engineering strategy. This strategy dynamically chooses
 * between chat and completion prompt construction based on the LLM configuration.
 */
export class DefaultPromptEngineeringStrategy extends BaseLLMStrategy {
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
        this.logger.debug('DefaultPromptEngineeringStrategy initialized.');
    }

    /**
     * Executes the default prompt engineering strategy.
     * @param {LLMStrategyExecuteParams} params
     * @returns {Promise<string>}
     */
    async execute({gameSummary, llmConfig, apiKey}) {
        const llmId = llmConfig?.id || 'UnknownLLM';
        this.logger.info(`DefaultPromptEngineeringStrategy.execute called for LLM ID: ${llmId}.`);

        if (!gameSummary || !llmConfig) {
            this.logger.error(`DefaultPromptEngineeringStrategy (${llmId}): Missing gameSummary or llmConfig.`);
            throw new Error(`DefaultPromptEngineeringStrategy (${llmId}): Missing gameSummary or llmConfig.`);
        }

        let promptPayloadPart;
        let chosenPromptBuilder;

        // Decide whether to use chat or completion style prompt construction
        const isChatLikeApi = ['openai', 'openrouter', 'anthropic'].includes(llmConfig.apiType);
        const hasSystemInPromptFrame = typeof llmConfig.promptFrame === 'object' && llmConfig.promptFrame && typeof llmConfig.promptFrame.system === 'string' && llmConfig.promptFrame.system.trim() !== '';
        const isStringPromptFrame = typeof llmConfig.promptFrame === 'string' && llmConfig.promptFrame.trim() !== '';

        if (isChatLikeApi || hasSystemInPromptFrame || (isStringPromptFrame && isChatLikeApi)) {
            // Use BaseChatLLMStrategy if apiType is explicitly chat-like,
            // or if promptFrame has a system message (implying chat structure),
            // or if promptFrame is a string for a chat-like API (interpreted as system message).
            chosenPromptBuilder = new BaseChatLLMStrategy(this.logger);
            this.logger.debug(`DefaultPromptEngineeringStrategy (${llmId}): Using BaseChatLLMStrategy for prompt construction.`);
        } else {
            chosenPromptBuilder = new BaseCompletionLLMStrategy(this.logger);
            this.logger.debug(`DefaultPromptEngineeringStrategy (${llmId}): Using BaseCompletionLLMStrategy for prompt construction.`);
        }

        promptPayloadPart = chosenPromptBuilder._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
        this.logger.debug(`DefaultPromptEngineeringStrategy (${llmId}): Constructed prompt payload:`, promptPayloadPart);

        // TODO: Implement the actual API call logic in a future ticket.
        // This involves:
        // - Assembling the full request payload using promptPayloadPart (which could be {messages: ...} or {prompt: ...}),
        //   llmConfig.modelIdentifier, llmConfig.defaultParameters, etc.
        //   Example:
        //   const requestPayload = {
        //       model: llmConfig.modelIdentifier,
        //       ...llmConfig.defaultParameters,
        //       ...promptPayloadPart // Spreads either 'messages' or 'prompt'
        //   };
        // - Making the API call using this.#httpClient.post(...), including handling apiKey.
        // - Processing the response. The key challenge for "prompt engineering" is that the
        //   LLM is *instructed* to return JSON, but it's not guaranteed by the API contract
        //   like with tool calling or native JSON modes. Response parsing will need to be robust.

        this.logger.warn(`DefaultPromptEngineeringStrategy (${llmId}): API call and response processing is STUBBED.`);
        return Promise.resolve(JSON.stringify({
            action: `stub_action_from_DefaultPromptEngineeringStrategy_for_${llmId}`,
            speech: `Stub response from DefaultPromptEngineeringStrategy using ${chosenPromptBuilder.constructor.name} for ${llmId}`
        }));
    }
}

// --- UPDATED FILE END ---