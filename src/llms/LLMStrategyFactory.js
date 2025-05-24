// src/llms/factories/LLMStrategyFactory.js
// --- NEW FILE START ---
import {IHttpClient} from './interfaces/IHttpClient.js';
import {ILogger} from '../interfaces/ILogger.js';
import {ILLMStrategy} from './interfaces/ILLMStrategy.js';
import {ConfigurationError} from '../turns/adapters/configurableLLMAdapter.js';
import {LLMStrategyFactoryError} from './errors/LLMStrategyFactoryError.js';

// Import concrete strategy implementations
import {OpenAIToolCallingStrategy} from './strategies/openAIToolCallingStrategy.js';
import {AnthropicToolCallingStrategy} from './strategies/anthropicToolCallingStrategy.js';
import {OpenRouterJsonSchemaStrategy} from './strategies/openRouterJsonSchemaStrategy.js';
import {OpenAINativeJsonStrategy} from './strategies/openAINativeJsonStrategy.js';
import {OllamaNativeJsonStrategy} from './strategies/ollamaNativeJsonStrategy.js';
import {DefaultPromptEngineeringStrategy} from './strategies/defaultPromptEngineeringStrategy.js';

/**
 * @typedef {import('../../src/services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 */

const strategyMappings = {
    'openai': {
        'tool_calling': OpenAIToolCallingStrategy,
        'native_json_mode': OpenAINativeJsonStrategy,
    },
    'anthropic': {
        'tool_calling': AnthropicToolCallingStrategy,
    },
    'openrouter': {
        'openrouter_json_schema': OpenRouterJsonSchemaStrategy,
    },
    'ollama': {
        'native_json_mode': OllamaNativeJsonStrategy,
    }
};

const KNOWN_API_TYPES_FOR_FACTORY = Object.keys(strategyMappings);

/**
 * @class LLMStrategyFactory
 * @description Creates and returns concrete ILLMStrategy instances based on LLMModelConfig.
 * This factory decouples the ConfigurableLLMAdapter from specific strategy implementations.
 */
export class LLMStrategyFactory {
    /**
     * @private
     * @type {IHttpClient}
     */
    #httpClient;

    /**
     * @private
     * @type {ILogger}
     */
    #logger;

    /**
     * Creates an instance of LLMStrategyFactory.
     * @param {object} dependencies - The dependencies for this factory.
     * @param {IHttpClient} dependencies.httpClient - An instance conforming to IHttpClient.
     * @param {ILogger} dependencies.logger - An instance conforming to ILogger.
     * @throws {Error} If httpClient or logger dependencies are invalid.
     */
    constructor({httpClient, logger}) {
        if (!logger ||
            typeof logger.info !== 'function' ||
            typeof logger.warn !== 'function' ||
            typeof logger.error !== 'function' ||
            typeof logger.debug !== 'function') {
            const errorMsg = "LLMStrategyFactory: Constructor requires a valid logger instance with info, warn, error, and debug methods.";
            console.error(errorMsg); // Use console.error as logger is unusable
            throw new Error(errorMsg);
        }
        this.#logger = logger;

        if (!httpClient || typeof httpClient.request !== 'function') {
            const errorMsg = "LLMStrategyFactory: Constructor requires a valid httpClient instance conforming to IHttpClient (must have a request method).";
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#httpClient = httpClient;

        this.#logger.debug("LLMStrategyFactory: Instance created and dependencies stored.");
    }

    /**
     * Creates and returns the appropriate concrete ILLMStrategy instance.
     * @param {LLMModelConfigType} llmConfig - The configuration for the LLM model.
     * @returns {ILLMStrategy} An instance of the selected concrete ILLMStrategy.
     * @throws {ConfigurationError} If llmConfig is invalid (e.g., missing apiType).
     * @throws {LLMStrategyFactoryError} If no suitable strategy can be determined for the given llmConfig.
     */
    getStrategy(llmConfig) {
        if (!llmConfig || typeof llmConfig.apiType !== 'string' || !llmConfig.apiType.trim()) {
            const errorMsg = "LLMStrategyFactory: llmConfig is invalid or missing a non-empty apiType.";
            this.#logger.error(errorMsg, {receivedConfig: llmConfig});
            throw new ConfigurationError(errorMsg, {
                problematicField: 'apiType',
                fieldValue: llmConfig?.apiType
            });
        }

        const llmId = llmConfig.id || 'UnknownLLM';
        const apiType = llmConfig.apiType.trim().toLowerCase();
        const configuredMethod = llmConfig.jsonOutputStrategy?.method?.trim()?.toLowerCase();

        this.#logger.debug(`LLMStrategyFactory: Determining strategy for LLM ID: '${llmId}', apiType: '${apiType}'.`, {
            configuredJsonMethod: configuredMethod || 'N/A',
            fullConfigJsonStrategy: llmConfig.jsonOutputStrategy
        });

        let effectiveMethod = configuredMethod;
        if (!effectiveMethod) {
            effectiveMethod = 'prompt_engineering';
            this.#logger.info(`LLMStrategyFactory: jsonOutputStrategy.method is missing or empty for LLM ID '${llmId}' (apiType: '${apiType}'). Defaulting to '${effectiveMethod}'.`);
        }

        let StrategyClass = null;

        if (effectiveMethod === 'prompt_engineering') {
            StrategyClass = DefaultPromptEngineeringStrategy;
        } else {
            const apiStrategies = strategyMappings[apiType];
            if (apiStrategies) {
                StrategyClass = apiStrategies[effectiveMethod];
            }
        }

        if (!StrategyClass) {
            if (KNOWN_API_TYPES_FOR_FACTORY.includes(apiType)) {
                this.#logger.warn(`LLMStrategyFactory: Unrecognized jsonOutputStrategy.method '${configuredMethod}' for apiType '${apiType}' (LLM ID: '${llmId}'). Falling back to DefaultPromptEngineeringStrategy.`);
                StrategyClass = DefaultPromptEngineeringStrategy;
                effectiveMethod = 'prompt_engineering';
            } else {
                const errorMessage = `Unsupported apiType: '${apiType}' (LLM ID: '${llmId}'). No strategy can be determined. Supported API types for specialized strategies are: ${KNOWN_API_TYPES_FOR_FACTORY.join(', ')}.`;
                this.#logger.error(`LLMStrategyFactory: ${errorMessage}`);
                throw new LLMStrategyFactoryError(errorMessage, {
                    apiType: apiType,
                    jsonOutputMethod: configuredMethod
                });
            }
        }

        this.#logger.info(`LLMStrategyFactory: Selected strategy '${StrategyClass.name}' for LLM ID '${llmId}'. Details: apiType='${apiType}', effectiveMethod='${effectiveMethod}', configuredMethod='${configuredMethod || "N/A"}'.`);

        return new StrategyClass({
            httpClient: this.#httpClient,
            logger: this.#logger
        });
    }
}

// --- CORRECTED FILE END ---