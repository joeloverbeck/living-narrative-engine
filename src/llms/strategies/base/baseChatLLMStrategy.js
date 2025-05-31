// src/llms/strategies/base/baseChatLLMStrategy.js
// --- FILE START ---

import {BaseLLMStrategy} from './baseLLMStrategy.js';

/**
 * @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
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
     * The `gameSummary` (the `finalPromptString` from `PromptBuilder`) is the primary content.
     *
     * @protected
     * @param {string} gameSummary - The `finalPromptString` from `PromptBuilder`.
     * @param {LLMModelConfig} llmConfig - The full LLM configuration.
     * @returns {{messages: Array<object>}} An object containing a `messages` array.
     */
    _constructPromptPayload(gameSummary, llmConfig) {
        this.logger.debug(`BaseChatLLMStrategy._constructPromptPayload for apiType '${llmConfig.apiType}'. gameSummary (finalPromptString) length: ${gameSummary.length}.`);

        const messages = [];

        // The gameSummary (finalPromptString from PromptBuilder) is now the user message content.
        // Any concept of a separate system message from a 'promptFrame' is removed.
        // The PromptBuilder is responsible for including all necessary instructions.
        messages.push({role: "user", content: gameSummary.trim()});

        this.logger.debug("BaseChatLLMStrategy._constructPromptPayload: Constructed 'messages' array. The prompt built by PromptBuilder is the sole user message content.", messages.map(m => ({
            role: m.role,
            contentPreview: typeof m.content === 'string' ? m.content.substring(0, 70) + (m.content.length > 70 ? '...' : '') : '[Non-string content]'
        })));

        return {messages};
    }
}

// --- FILE END ---