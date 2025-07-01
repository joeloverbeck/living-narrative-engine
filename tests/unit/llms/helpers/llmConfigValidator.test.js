import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { LLMConfigValidator } from '../../../../src/llms/helpers/llmConfigValidator.js';
import { ConfigurationError } from '../../../../src/errors/configurationError';
import { LLMStrategyFactoryError } from '../../../../src/llms/errors/LLMStrategyFactoryError.js';

/** @typedef {import('../../../../src/interfaces/ILogger.js').ILogger} ILogger */

describe('LLMConfigValidator', () => {
  /** @type {jest.Mocked<ILogger>} */
  let logger;
  /** @type {LLMConfigValidator} */
  let validator;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    validator = new LLMConfigValidator(logger);
  });

  test('throws ConfigurationError when apiType missing', () => {
    expect(() => validator.validate({})).toThrow(ConfigurationError);
    expect(logger.error).toHaveBeenCalled();
  });

  test('throws LLMStrategyFactoryError when jsonOutputStrategy.method missing', () => {
    const cfg = { apiType: 'openrouter', jsonOutputStrategy: {} };
    expect(() => validator.validate(cfg)).toThrow(LLMStrategyFactoryError);
    expect(logger.error).toHaveBeenCalled();
  });

  test('throws LLMStrategyFactoryError when method is prompt_engineering', () => {
    const cfg = {
      apiType: 'openrouter',
      jsonOutputStrategy: { method: 'prompt_engineering' },
    };
    expect(() => validator.validate(cfg)).toThrow(LLMStrategyFactoryError);
  });

  test('returns normalized config when valid', () => {
    const cfg = {
      configId: 'ID',
      apiType: 'OpenRouter',
      jsonOutputStrategy: { method: 'openrouter_json_schema' },
    };
    const result = validator.validate(cfg);
    expect(result).toEqual({
      llmId: 'ID',
      apiType: 'openrouter',
      configuredMethod: 'openrouter_json_schema',
    });
  });
});
