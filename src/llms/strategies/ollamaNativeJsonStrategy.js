// src/llms/strategies/OllamaNativeJsonStrategy.js
// --- NEW FILE START ---
import {ILLMStrategy} from '../interfaces/ILLMStrategy.js';

/**
 * @typedef {import('../../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../interfaces/ILLMStrategy.js').LLMStrategyExecuteParams} LLMStrategyExecuteParams
 */

/**
 * @class OllamaNativeJsonStrategy
 * @implements {ILLMStrategy}
 * @description Stub implementation for Ollama Native JSON Mode strategy.
 * Actual implementation will be in a future ticket.
 */
export class OllamaNativeJsonStrategy extends ILLMStrategy {
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
        this.#logger.debug('OllamaNativeJsonStrategy initialized (stub).');
    }

    /**
     * @param {LLMStrategyExecuteParams} params
     * @returns {Promise<string>}
     */
    async execute(params) {
        const llmId = params.llmConfig?.id || 'UnknownLLM';
        this.#logger.info(`OllamaNativeJsonStrategy.execute called for LLM ID: ${llmId}. THIS IS A STUB.`);
        if (!params.gameSummary || !params.llmConfig) {
            this.#logger.error(`OllamaNativeJsonStrategy (${llmId}): Missing gameSummary or llmConfig.`);
            throw new Error(`OllamaNativeJsonStrategy (${llmId}): Missing gameSummary or llmConfig for stub strategy.`);
        }
        return Promise.resolve(JSON.stringify({
            action: "stub_action_from_OllamaNativeJsonStrategy",
            speech: `Stub response from OllamaNativeJsonStrategy for ${llmId}`
        }));
    }
}

// --- NEW FILE END ---