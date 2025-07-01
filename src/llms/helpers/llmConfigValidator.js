/**
 * @file Helper class for validating LLM configuration objects.
 */

import { ConfigurationError } from '../../errors/configurationError';
import { LLMStrategyFactoryError } from '../errors/LLMStrategyFactoryError.js';
import { getLlmId } from '../utils/llmUtils.js';

/**
 * @typedef {import('../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfigType
 */

/**
 * @class LLMConfigValidator
 * @description Validates LLMModelConfig objects for use by LLMStrategyFactory.
 */
export class LLMConfigValidator {
  /** @type {import('../../interfaces/ILogger.js').ILogger} */
  #logger;

  /**
   * @param {import('../../interfaces/ILogger.js').ILogger} logger
   */
  constructor(logger) {
    this.#logger = logger;
  }

  /**
   * Validates and normalizes the given configuration.
   *
   * @param {LLMModelConfigType} llmConfig - Configuration to validate.
   * @returns {{ llmId: string, apiType: string, configuredMethod: string }} Normalized config values.
   * @throws {ConfigurationError|LLMStrategyFactoryError}
   */
  validate(llmConfig) {
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

    const llmId = getLlmId(llmConfig);
    const apiType = llmConfig.apiType.trim().toLowerCase();
    const configuredMethod = llmConfig.jsonOutputStrategy?.method
      ?.trim()
      ?.toLowerCase();

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

    return { llmId, apiType, configuredMethod };
  }
}
