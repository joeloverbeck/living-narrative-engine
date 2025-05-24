// src/llms/strategies/OpenRouterJsonSchemaStrategy.js
// --- NEW FILE START ---
import {ILLMStrategy} from '../interfaces/ILLMStrategy.js';

/**
 * @typedef {import('../../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../interfaces/ILLMStrategy.js').LLMStrategyExecuteParams} LLMStrategyExecuteParams
 */

/**
 * @class OpenRouterJsonSchemaStrategy
 * @implements {ILLMStrategy}
 * @description Stub implementation for OpenRouter JSON Schema strategy.
 * Actual implementation will be in a future ticket.
 */
export class OpenRouterJsonSchemaStrategy extends ILLMStrategy {
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
        this.#logger.debug('OpenRouterJsonSchemaStrategy initialized (stub).');
    }

    /**
     * @param {LLMStrategyExecuteParams} params
     * @returns {Promise<string>}
     */
    async execute(params) {
        const llmId = params.llmConfig?.id || 'UnknownLLM';
        this.#logger.info(`OpenRouterJsonSchemaStrategy.execute called for LLM ID: ${llmId}. THIS IS A STUB.`);
        if (!params.gameSummary || !params.llmConfig) {
            this.#logger.error(`OpenRouterJsonSchemaStrategy (${llmId}): Missing gameSummary or llmConfig.`);
            throw new Error(`OpenRouterJsonSchemaStrategy (${llmId}): Missing gameSummary or llmConfig for stub strategy.`);
        }
        return Promise.resolve(JSON.stringify({
            action: "stub_action_from_OpenRouterJsonSchemaStrategy",
            speech: `Stub response from OpenRouterJsonSchemaStrategy for ${llmId}`
        }));
    }
}

// --- NEW FILE END ---