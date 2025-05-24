// src/llms/strategies/base/BaseChatLLMStrategy.js
// --- FILE START ---

import {BaseLLMStrategy} from './baseLLMStrategy.js';

/**
 * @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 */

/**
 * @class BaseChatLLMStrategy
 * @extends BaseLLMStrategy
 * @description Base strategy for LLMs that use a chat-based API structure (messages array).
 */
export class BaseChatLLMStrategy extends BaseLLMStrategy {
    /**
     * Constructs a new BaseChatLLMStrategy.
     * @param {ILogger} logger - The logger instance.
     */
    constructor(logger) {
        super(logger);
    }

    /**
     * Constructs the prompt payload for chat-based LLM APIs.
     * This method uses the `promptFrame` from the LLM configuration to structure
     * the `gameSummary` into a `messages` array.
     *
     * @protected
     * @param {string} gameSummary - The detailed textual representation of the game state.
     * @param {object | string | undefined} promptFrame - The promptFrame object from the LLM configuration.
     * @param {LLMModelConfig} llmConfig - The full LLM configuration, including apiType.
     * @returns {{messages: Array<object>}} An object containing a `messages` array.
     */
    _constructPromptPayload(gameSummary, promptFrame, llmConfig) {
        this.logger.debug(`BaseChatLLMStrategy._constructPromptPayload: Constructing prompt. apiType: '${llmConfig.apiType}'.`, {promptFrame});

        const messages = [];
        let finalGameSummaryContent = gameSummary;

        const hasActualPromptFrameObject = promptFrame && typeof promptFrame === 'object' && Object.keys(promptFrame).length > 0;
        const isNonEmptyStringPromptFrame = typeof promptFrame === 'string' && promptFrame.trim() !== '';

        if (isNonEmptyStringPromptFrame) {
            messages.push({role: "system", content: promptFrame.trim()});
        } else if (hasActualPromptFrameObject) {
            if (typeof promptFrame.system === 'string' && promptFrame.system.trim() !== '') {
                messages.push({role: "system", content: promptFrame.system.trim()});
            }
            if (typeof promptFrame.user_prefix === 'string' && promptFrame.user_prefix.trim() !== '') {
                finalGameSummaryContent = `${promptFrame.user_prefix.trim()} ${finalGameSummaryContent}`;
            }
            if (typeof promptFrame.user_suffix === 'string' && promptFrame.user_suffix.trim() !== '') {
                finalGameSummaryContent = `${finalGameSummaryContent} ${promptFrame.user_suffix.trim()}`;
            }
        } else {
            // This warning logic is specifically for chat-like APIs as per the original code.
            // Typically, 'openai', 'openrouter', 'anthropic' are the main ones designated as chat-like in ConfigurableLLMAdapter.
            if (['openai', 'openrouter', 'anthropic'].includes(llmConfig.apiType)) {
                this.logger.warn(`BaseChatLLMStrategy._constructPromptPayload: promptFrame is missing or effectively empty for chat-like apiType '${llmConfig.apiType}'. Applying default user message structure. Consider defining a promptFrame for optimal results.`);
            }
        }

        messages.push({role: "user", content: finalGameSummaryContent.trim()});

        this.logger.debug("BaseChatLLMStrategy._constructPromptPayload: Constructed 'messages' array:", messages.map(m => ({
            role: m.role,
            contentPreview: typeof m.content === 'string' ? m.content.substring(0, 70) + (m.content.length > 70 ? '...' : '') : '[Non-string content]'
        })));

        return {messages};
    }
}

// --- FILE END ---