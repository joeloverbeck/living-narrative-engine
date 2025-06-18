// src/llms/LLMStrategyFactory.js

// --- MODIFIED FILE START ---
import { IHttpClient } from './interfaces/IHttpClient.js'; // Assuming IHttpClient is in ./interfaces/
import { ILogger } from '../interfaces/ILogger.js'; // Assuming ILogger is in ../interfaces/
import { ILLMStrategy } from './interfaces/ILLMStrategy.js'; // Assuming ILLMStrategy is in ./interfaces/
import { ConfigurationError } from '../errors/configurationError';
import { LLMStrategyFactoryError } from './errors/LLMStrategyFactoryError.js';
import { initLogger } from '../utils/index.js';

// Import concrete strategy implementations
import { OpenRouterJsonSchemaStrategy } from './strategies/openRouterJsonSchemaStrategy.js';
import { OpenRouterToolCallingStrategy } from './strategies/openRouterToolCallingStrategy.js';
// DefaultPromptEngineeringStrategy import removed

/**
 * @typedef {import('./services/llmConfigLoader.js').LLMModelConfig} LLMModelConfigType
 */

const strategyMappings = {
  openrouter: {
    openrouter_json_schema: OpenRouterJsonSchemaStrategy,
    openrouter_tool_calling: OpenRouterToolCallingStrategy,
  },
  // Other API types and their specific strategies would be added here.
};

const KNOWN_API_TYPES_FOR_FACTORY = Object.keys(strategyMappings);

/**
 * @class LLMStrategyFactory
 * @description Creates and returns concrete ILLMStrategy instances based on LLMModelConfigType.
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
   *
   * @param {object} dependencies - The dependencies for this factory.
   * @param {IHttpClient} dependencies.httpClient - An instance conforming to IHttpClient.
   * @param {ILogger} dependencies.logger - An instance conforming to ILogger.
   * @throws {Error} If httpClient or logger dependencies are invalid.
   */
  constructor({ httpClient, logger }) {
    this.#logger = initLogger('LLMStrategyFactory', logger);

    if (!httpClient || typeof httpClient.request !== 'function') {
      const errorMsg =
        'LLMStrategyFactory: Constructor requires a valid httpClient instance conforming to IHttpClient (must have a request method).';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#httpClient = httpClient;

    this.#logger.debug(
      'LLMStrategyFactory: Instance created and dependencies stored.'
    );
  }

  /**
   * Creates and returns the appropriate concrete ILLMStrategy instance.
   *
   * @param {LLMModelConfigType} llmConfig - The configuration for the LLM model.
   * @returns {ILLMStrategy} An instance of the selected concrete ILLMStrategy.
   * @throws {ConfigurationError} If llmConfig is invalid (e.g., missing apiType).
   * @throws {LLMStrategyFactoryError} If no suitable strategy can be determined for the given llmConfig
   * (e.g., missing jsonOutputStrategy.method, unsupported method, or unsupported apiType).
   */
  getStrategy(llmConfig) {
    if (
      !llmConfig ||
      typeof llmConfig.apiType !== 'string' ||
      !llmConfig.apiType.trim()
    ) {
      const errorMsg =
        'LLMStrategyFactory: llmConfig is invalid or missing a non-empty apiType.';
      this.#logger.error(errorMsg, { receivedConfig: llmConfig });
      throw new ConfigurationError(errorMsg, {
        problematicField: 'apiType',
        fieldValue: llmConfig?.apiType,
      });
    }

    // MODIFICATION START: Use llmConfig.configId
    const llmId = llmConfig.configId || 'UnknownLLM';
    // MODIFICATION END
    const apiType = llmConfig.apiType.trim().toLowerCase();
    const configuredMethod = llmConfig.jsonOutputStrategy?.method
      ?.trim()
      ?.toLowerCase();

    this.#logger.debug(
      `LLMStrategyFactory: Determining strategy for LLM ID: '${llmId}', apiType: '${apiType}'.`,
      {
        configuredJsonMethod: configuredMethod || 'NOT SET',
        fullConfigJsonStrategy: llmConfig.jsonOutputStrategy,
      }
    );

    if (!configuredMethod) {
      const errorMsg = `LLMStrategyFactory: 'jsonOutputStrategy.method' is required in llmConfig for LLM ID '${llmId}' (apiType: '${apiType}') but was missing or empty. A specific method must be configured.`;
      this.#logger.error(errorMsg, {
        llmId,
        apiType,
        llmConfigJsonOutputStrategy: llmConfig.jsonOutputStrategy,
      });
      throw new LLMStrategyFactoryError(errorMsg, {
        apiType: apiType,
        jsonOutputMethod: configuredMethod,
      });
    }

    if (configuredMethod === 'prompt_engineering') {
      const errorMsg = `LLMStrategyFactory: 'jsonOutputStrategy.method' cannot be 'prompt_engineering' for LLM ID '${llmId}' (apiType: '${apiType}'). This strategy is no longer supported as an explicit choice. Please configure a specific JSON output strategy (e.g., 'openrouter_json_schema', 'openrouter_tool_calling', etc.).`;
      this.#logger.error(errorMsg, { llmId, apiType, configuredMethod });
      throw new LLMStrategyFactoryError(errorMsg, {
        apiType: apiType,
        jsonOutputMethod: configuredMethod,
      });
    }

    let StrategyClass = null;
    const apiTypeStrategies = strategyMappings[apiType];

    if (apiTypeStrategies) {
      StrategyClass = apiTypeStrategies[configuredMethod];
    }

    if (!StrategyClass) {
      let errorMessage;
      // Base context for logging, matching some test expectations.
      const errorLogContext = {
        apiType: apiType,
        jsonOutputMethod: configuredMethod,
        // llmId is part of the message string as per test expectations for some errors
      };

      if (!KNOWN_API_TYPES_FOR_FACTORY.includes(apiType)) {
        // Case 1: apiType itself is unknown/unsupported.
        // Adjusted to match test's expected error message string format.
        errorMessage = `Unsupported apiType: '${apiType}' (LLM ID: '${llmId}'). No strategy can be determined. Supported API types for specialized strategies are: ${KNOWN_API_TYPES_FOR_FACTORY.join(', ')}.`;
        // The llmId is included in the message string itself for these tests.
      } else {
        // Case 2: apiType is known, but the configuredMethod is not valid for it.
        const knownMethodsForCurrentApi =
          Object.keys(strategyMappings[apiType] || {}).join(', ') || 'none';
        const availableMethodsForLog = KNOWN_API_TYPES_FOR_FACTORY.map(
          (type) => {
            return `${type}: [${Object.keys(strategyMappings[type] || {}).join(', ') || 'none'}]`;
          }
        ).join('; ');
        errorMessage = `Unrecognized jsonOutputStrategy.method: '${configuredMethod}' for apiType '${apiType}' (LLM ID: '${llmId}'). Supported methods for this apiType are: [${knownMethodsForCurrentApi}]. Full list of supported API types and methods: ${availableMethodsForLog || 'None configured'}.`;
        // For more detailed internal logging, we can add more to the context here if desired,
        // but the test error log context for "unsupported apiType" is simpler.
        // Let's add llmId to the context explicitly for consistency in our internal logging.
        errorLogContext.llmId = llmId; // Ensure llmId (derived from configId) is in the log context
        errorLogContext.availableApiTypes = KNOWN_API_TYPES_FOR_FACTORY;
        errorLogContext.availableMethodsForApiType = strategyMappings[apiType]
          ? Object.keys(strategyMappings[apiType])
          : 'N/A';
      }

      this.#logger.error(
        `LLMStrategyFactory: ${errorMessage}`,
        errorLogContext
      );
      throw new LLMStrategyFactoryError(errorMessage, {
        apiType: apiType,
        jsonOutputMethod: configuredMethod,
      });
    }

    // Adjusted log message to include 'effectiveMethod' (same as configuredMethod here) to match test expectations.
    this.#logger.debug(
      `LLMStrategyFactory: Selected strategy '${StrategyClass.name}' for LLM ID '${llmId}'. Details: apiType='${apiType}', effectiveMethod='${configuredMethod}', configuredMethod='${configuredMethod}'.`
    );

    return new StrategyClass({
      httpClient: this.#httpClient,
      logger: this.#logger,
    });
  }
}

// --- MODIFIED FILE END ---
