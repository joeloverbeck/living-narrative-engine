// src/llms/LLMStrategyFactory.js
import { IHttpClient } from './interfaces/IHttpClient.js';
import { ILogger } from '../interfaces/ILogger.js';
import { ILLMStrategy } from './interfaces/ILLMStrategy.js';
import { ConfigurationError } from '../errors/configurationError';
import { LLMStrategyFactoryError } from './errors/LLMStrategyFactoryError.js';
import { initLogger } from '../utils/index.js';
import { LLMConfigValidator } from './helpers/llmConfigValidator.js';
import { LLMStrategyResolver } from './helpers/llmStrategyResolver.js';
import strategyRegistry from './strategies/strategyRegistry.js';

/** @typedef {import('./services/llmConfigLoader.js').LLMModelConfig} LLMModelConfigType */

/**
 * @class LLMStrategyFactory
 * @description Creates and returns concrete ILLMStrategy instances based on configuration.
 */
export class LLMStrategyFactory {
  /** @type {IHttpClient} */
  #httpClient;
  /** @type {ILogger} */
  #logger;
  /** @type {Record<string, Record<string, Function>>} */
  #strategyMap;
  #configValidator;
  #strategyResolver;
  /** @type {string[]} */
  #knownApiTypes;

  constructor({
    httpClient,
    logger,
    strategyMap = strategyRegistry,
    configValidator,
    strategyResolver,
  }) {
    this.#logger = initLogger('LLMStrategyFactory', logger);
    this.#configValidator = configValidator || new LLMConfigValidator(this.#logger);
    this.#strategyResolver = strategyResolver || new LLMStrategyResolver(strategyMap);

    if (!httpClient || typeof httpClient.request !== 'function') {
      const errorMsg =
        'LLMStrategyFactory: Constructor requires a valid httpClient instance conforming to IHttpClient (must have a request method).';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#httpClient = httpClient;
    this.#strategyMap = strategyMap;
    this.#knownApiTypes = Object.keys(strategyMap);

    this.#logger.debug('LLMStrategyFactory: Instance created and dependencies stored.');
  }

  /**
   * Creates and returns the appropriate concrete ILLMStrategy instance.
   * @param {LLMModelConfigType} llmConfig
   * @returns {ILLMStrategy}
   * @throws {ConfigurationError | LLMStrategyFactoryError}
   */
  getStrategy(llmConfig) {
    const { llmId, apiType, configuredMethod } = this.#configValidator.validate(llmConfig);

    this.#logger.debug(
      `LLMStrategyFactory: Determining strategy for LLM ID: '${llmId}', apiType: '${apiType}'.`,
      {
        configuredJsonMethod: configuredMethod || 'NOT SET',
        fullConfigJsonStrategy: llmConfig.jsonOutputStrategy,
      },
    );

    let StrategyClass = this.#strategyResolver.resolveStrategy(apiType, configuredMethod);

    if (!StrategyClass) {
      let errorMessage;
      const errorLogContext = {
        apiType: apiType,
        jsonOutputMethod: configuredMethod,
      };

      if (!this.#knownApiTypes.includes(apiType)) {
        errorMessage = `Unsupported apiType: '${apiType}' (LLM ID: '${llmId}'). No strategy can be determined. Supported API types for specialized strategies are: ${this.#knownApiTypes.join(', ')}.`;
      } else {
        const knownMethodsForCurrentApi =
          Object.keys(this.#strategyMap[apiType] || {}).join(', ') || 'none';
        const availableMethodsForLog = this.#knownApiTypes
          .map((type) => `${type}: [${Object.keys(this.#strategyMap[type] || {}).join(', ') || 'none'}]`)
          .join('; ');
        errorMessage = `Unrecognized jsonOutputStrategy.method: '${configuredMethod}' for apiType '${apiType}' (LLM ID: '${llmId}'). Supported methods for this apiType are: [${knownMethodsForCurrentApi}]. Full list of supported API types and methods: ${availableMethodsForLog || 'None configured'}.`;
        errorLogContext.llmId = llmId;
        errorLogContext.availableApiTypes = this.#knownApiTypes;
        errorLogContext.availableMethodsForApiType = this.#strategyMap[apiType]
          ? Object.keys(this.#strategyMap[apiType])
          : 'N/A';
      }

      this.#logger.error(`LLMStrategyFactory: ${errorMessage}`, errorLogContext);
      throw new LLMStrategyFactoryError(errorMessage, {
        apiType: apiType,
        jsonOutputMethod: configuredMethod,
      });
    }

    this.#logger.debug(
      `LLMStrategyFactory: Selected strategy '${StrategyClass.name}' for LLM ID '${llmId}'. Details: apiType='${apiType}', effectiveMethod='${configuredMethod}', configuredMethod='${configuredMethod}'.`,
    );

    return new StrategyClass({ httpClient: this.#httpClient, logger: this.#logger });
  }
}

