// src/llms/strategies/AnthropicToolCallingStrategy.js
// --- NEW FILE START ---
import {ILLMStrategy} from '../interfaces/ILLMStrategy.js';

/**
 * @typedef {import('../../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../interfaces/ILLMStrategy.js').LLMStrategyExecuteParams} LLMStrategyExecuteParams
 */

/**
 * @class AnthropicToolCallingStrategy
 * @implements {ILLMStrategy}
 * @description Stub implementation for Anthropic Tool Calling strategy.
 * Actual implementation will be in a future ticket.
 */
export class AnthropicToolCallingStrategy extends ILLMStrategy {
    /** @type {IHttpClient} */
    #httpClient;
    /** @type {ILogger} */
    #logger;

    /**
     * @param {object} deps
     * @param {IHttpClient} deps.httpClient
     * @param {ILogger} deps.logger
     */
    constructor({httpClient, logger}) {
        super();
        this.#httpClient = httpClient;
        this.#logger = logger;
        this.#logger.debug('AnthropicToolCallingStrategy initialized (stub).');
    }

    /**
     * @param {LLMStrategyExecuteParams} params
     * @returns {Promise<string>}
     */
    async execute(params) {
        const llmId = params.llmConfig?.id || 'UnknownLLM';
        this.#logger.info(`AnthropicToolCallingStrategy.execute called for LLM ID: ${llmId}. THIS IS A STUB.`);
        if (!params.gameSummary || !params.llmConfig) {
            this.#logger.error(`AnthropicToolCallingStrategy (${llmId}): Missing gameSummary or llmConfig.`);
            throw new Error(`AnthropicToolCallingStrategy (${llmId}): Missing gameSummary or llmConfig for stub strategy.`);
        }
        return Promise.resolve(JSON.stringify({
            action: "stub_action_from_AnthropicToolCallingStrategy",
            speech: `Stub response from AnthropicToolCallingStrategy for ${llmId}`
        }));
    }
}

// --- NEW FILE END ---