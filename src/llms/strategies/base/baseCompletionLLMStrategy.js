// src/llms/strategies/base/baseCompletionLLMStrategy.js
// --- UPDATED FILE START ---

import {BaseLLMStrategy} from './baseLLMStrategy.js';

/**
 * @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
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
     * The `gameSummary` parameter is now the `finalPromptString` produced by `PromptBuilder`.
     * The `promptFrame` from `llmConfig` (adapter's config) is ignored for completion models,
     * as `PromptBuilder` is responsible for the entire prompt structure.
     *
     * @protected
     * @param {string} gameSummary - The `finalPromptString` from `PromptBuilder`.
     * @param {object | string | undefined} promptFrame - The promptFrame object from the LLM configuration (ignored).
     * @param {LLMModelConfig} llmConfig - The full LLM configuration.
     * @returns {{prompt: string}} An object containing a `prompt` string.
     */
    _constructPromptPayload(gameSummary, promptFrame, llmConfig) {
        this.logger.debug(`BaseCompletionLLMStrategy._constructPromptPayload for apiType '${llmConfig.apiType}'. gameSummary (finalPromptString) length: ${gameSummary.length}. llmConfig.promptFrame will be ignored.`);

        // The gameSummary is the final prompt string from PromptBuilder.
        // Trim it to remove any accidental leading/trailing whitespace from the build process,
        // unless the PromptBuilder is guaranteed to output perfectly trimmed strings.
        const finalPromptString = gameSummary.trim();

        this.logger.debug(`BaseCompletionLLMStrategy._constructPromptPayload: Using finalPromptString as the 'prompt'. Preview: ${finalPromptString.substring(0, 100) + (finalPromptString.length > 100 ? '...' : '')}`);
        return {prompt: finalPromptString};
    }
}

// --- UPDATED FILE END ---