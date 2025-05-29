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
     * The `gameSummary` parameter is now the `finalPromptString` produced by `PromptBuilder`.
     * The `promptFrame.system` from `llmConfig` can still provide a system message.
     * Other parts of `promptFrame` (like user_prefix/suffix) are ignored as `PromptBuilder` handles the main content.
     *
     * @protected
     * @param {string} gameSummary - The `finalPromptString` from `PromptBuilder`.
     * @param {object | string | undefined} promptFrame - The promptFrame object from the LLM configuration (adapter's config).
     * @param {LLMModelConfig} llmConfig - The full LLM configuration.
     * @returns {{messages: Array<object>}} An object containing a `messages` array.
     */
    _constructPromptPayload(gameSummary, promptFrame, llmConfig) {
        this.logger.debug(`BaseChatLLMStrategy._constructPromptPayload for apiType '${llmConfig.apiType}'. gameSummary (finalPromptString) length: ${gameSummary.length}.`);

        const messages = [];
        let systemMessageAdded = false;

        // Use promptFrame.system from the adapter's llmConfig if available
        if (promptFrame && typeof promptFrame === 'object' && typeof promptFrame.system === 'string' && promptFrame.system.trim() !== '') {
            messages.push({role: "system", content: promptFrame.system.trim()});
            systemMessageAdded = true;
            this.logger.debug(`BaseChatLLMStrategy: Added system message from llmConfig.promptFrame.system.`);
        } else if (typeof promptFrame === 'string' && promptFrame.trim() !== '') {
            // If promptFrame is a string, assume it's a system message (legacy or simple config)
            messages.push({role: "system", content: promptFrame.trim()});
            systemMessageAdded = true;
            this.logger.debug(`BaseChatLLMStrategy: Added system message from llmConfig.promptFrame (string).`);
        }

        // The gameSummary (finalPromptString from PromptBuilder) is now the user message content.
        // User prefix/suffix from promptFrame are ignored as PromptBuilder handled the user message's full content.
        messages.push({role: "user", content: gameSummary.trim()});

        if (!systemMessageAdded && ['openai', 'openrouter', 'anthropic'].includes(llmConfig.apiType)) {
            this.logger.warn(`BaseChatLLMStrategy: No system message added from llmConfig.promptFrame for apiType '${llmConfig.apiType}'. The prompt built by PromptBuilder will be the sole user message content.`);
        }

        this.logger.debug("BaseChatLLMStrategy._constructPromptPayload: Constructed 'messages' array:", messages.map(m => ({
            role: m.role,
            contentPreview: typeof m.content === 'string' ? m.content.substring(0, 70) + (m.content.length > 70 ? '...' : '') : '[Non-string content]'
        })));

        return {messages};
    }
}

// --- FILE END ---