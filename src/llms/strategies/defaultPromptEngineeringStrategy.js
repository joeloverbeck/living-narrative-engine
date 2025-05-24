// src/llms/strategies/DefaultPromptEngineeringStrategy.js
// --- NEW FILE START ---
import {ILLMStrategy} from '../interfaces/ILLMStrategy.js';

/**
 * @typedef {import('../../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../interfaces/ILLMStrategy.js').LLMStrategyExecuteParams} LLMStrategyExecuteParams
 */

/**
 * @class DefaultPromptEngineeringStrategy
 * @implements {ILLMStrategy}
 * @description Stub implementation for a default Prompt Engineering strategy.
 * This strategy is used as a fallback when no specialized JSON output method is
 * configured or recognized for a given LLM.
 * Actual implementation will be in a future ticket.
 */
export class DefaultPromptEngineeringStrategy extends ILLMStrategy {
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
        this.#logger.debug('DefaultPromptEngineeringStrategy initialized (stub).');
    }

    /**
     * @param {LLMStrategyExecuteParams} params
     * @returns {Promise<string>}
     */
    async execute(params) {
        const llmId = params.llmConfig?.id || 'UnknownLLM';
        this.#logger.info(`DefaultPromptEngineeringStrategy.execute called for LLM ID: ${llmId}. THIS IS A STUB.`);
        if (!params.gameSummary || !params.llmConfig) {
            this.#logger.error(`DefaultPromptEngineeringStrategy (${llmId}): Missing gameSummary or llmConfig.`);
            throw new Error(`DefaultPromptEngineeringStrategy (${llmId}): Missing gameSummary or llmConfig for stub strategy.`);
        }
        return Promise.resolve(JSON.stringify({
            action: "stub_action_from_DefaultPromptEngineeringStrategy",
            speech: `Stub response from DefaultPromptEngineeringStrategy for ${llmId}`
        }));
    }
}

// --- NEW FILE END ---