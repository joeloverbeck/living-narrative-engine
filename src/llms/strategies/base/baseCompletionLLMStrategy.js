// src/llm/strategies/base/BaseCompletionLLMStrategy.js
// --- FILE START ---

import {BaseLLMStrategy} from './BaseLLMStrategy.js';

/**
 * @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 */

/**
 * @class BaseCompletionLLMStrategy
 * @extends BaseLLMStrategy
 * @description Base strategy for LLMs that use a completion-based API structure (single prompt string).
 */
export class BaseCompletionLLMStrategy extends BaseLLMStrategy {
    /**
     * Constructs a new BaseCompletionLLMStrategy.
     * @param {ILogger} logger - The logger instance.
     */
    constructor(logger) {
        super(logger);
    }

    /**
     * Constructs the prompt payload for completion-based LLM APIs.
     * This method uses the `promptFrame` from the LLM configuration to structure
     * the `gameSummary` into a single `prompt` string.
     *
     * @protected
     * @param {string} gameSummary - The detailed textual representation of the game state.
     * @param {object | string | undefined} promptFrame - The promptFrame object from the LLM configuration.
     * @param {LLMModelConfig} llmConfig - The full LLM configuration, including apiType.
     * @returns {{prompt: string}} An object containing a `prompt` string.
     */
    _constructPromptPayload(gameSummary, promptFrame, llmConfig) {
        this.logger.debug(`BaseCompletionLLMStrategy._constructPromptPayload: Constructing prompt. apiType: '${llmConfig.apiType}'.`, {promptFrame});

        let finalPromptString = gameSummary;

        const hasActualPromptFrameObject = promptFrame && typeof promptFrame === 'object' && Object.keys(promptFrame).length > 0;
        const isNonEmptyStringPromptFrame = typeof promptFrame === 'string' && promptFrame.trim() !== '';

        if (isNonEmptyStringPromptFrame) {
            finalPromptString = `${promptFrame.trim()}\n\n${finalPromptString}`;
        } else if (hasActualPromptFrameObject) {
            // For completion APIs, a 'system' field in an object promptFrame is less standard.
            // If provided, prepend it. user_prefix and user_suffix are more common.
            let prefix = '';
            let suffix = '';

            if (typeof promptFrame.system === 'string' && promptFrame.system.trim() !== '') {
                // Original logic didn't explicitly push system prompts for completion APIs if promptFrame was an object,
                // but a string promptFrame (which could act as a system prompt) was prepended.
                // Prepending system here if it exists in object form for consistency.
                prefix = `${promptFrame.system.trim()}\n\n`;
                this.logger.debug(`BaseCompletionLLMStrategy._constructPromptPayload: Applying 'promptFrame.system' as a prefix for apiType '${llmConfig.apiType}'.`);
            }
            if (typeof promptFrame.user_prefix === 'string' && promptFrame.user_prefix.trim() !== '') {
                prefix = `${prefix}${promptFrame.user_prefix.trim()} `;
            }
            if (typeof promptFrame.user_suffix === 'string' && promptFrame.user_suffix.trim() !== '') {
                suffix = ` ${promptFrame.user_suffix.trim()}`;
            }
            finalPromptString = `${prefix}${finalPromptString}${suffix}`;

        } else {
            // Replicating original warning logic:
            // Warn if promptFrame is missing for non-chat, non-common-local APIs.
            const chatApiTypes = ['openai', 'openrouter', 'anthropic'];
            const localApiTypesForLogging = ['ollama', 'llama_cpp_server_openai_compatible', 'tgi_openai_compatible'];

            if (llmConfig.apiType && !chatApiTypes.includes(llmConfig.apiType) && !localApiTypesForLogging.includes(llmConfig.apiType)) {
                this.logger.warn(`BaseCompletionLLMStrategy._constructPromptPayload: promptFrame is missing or effectively empty for apiType '${llmConfig.apiType}' which might benefit from it. Applying default prompt string structure.`);
            }
        }

        const trimmedPrompt = finalPromptString.trim();
        this.logger.debug(`BaseCompletionLLMStrategy._constructPromptPayload: Constructed single 'prompt' string. Preview: ${trimmedPrompt.substring(0, 70) + (trimmedPrompt.length > 70 ? '...' : '')}`);

        return {prompt: trimmedPrompt};
    }
}

// --- FILE END ---