import { describe, it, expect, beforeEach } from '@jest/globals';
import { LLMStrategyFactory } from '../../../src/llms/LLMStrategyFactory.js';
import { OpenRouterJsonSchemaStrategy } from '../../../src/llms/strategies/openRouterJsonSchemaStrategy.js';
import { ConfigurationError } from '../../../src/errors/configurationError.js';
import { LLMStrategyFactoryError } from '../../../src/llms/errors/LLMStrategyFactoryError.js';
import NoOpLogger from '../../../src/logging/noOpLogger.js';

class StaticHttpClient {
  constructor() {
    this.requests = [];
  }

  /**
   * @param {object} options
   * @returns {Promise<object>}
   */
  async request(options) {
    this.requests.push(options);
    return {
      choices: [
        {
          message: {
            content: JSON.stringify({ result: 'ok' }),
          },
        },
      ],
    };
  }
}

function createBaseConfig(overrides = {}) {
  return {
    configId: 'test-config',
    displayName: 'Test Config',
    modelIdentifier: 'test-model',
    endpointUrl: 'https://example.com/llm',
    apiType: 'openrouter',
    jsonOutputStrategy: {
      method: 'openrouter_json_schema',
      jsonSchema: {
        type: 'object',
        properties: {
          result: { type: 'string' },
        },
      },
    },
    promptElements: [],
    promptAssemblyOrder: [],
    ...overrides,
  };
}

describe('LLMStrategyFactory configuration validation integration', () => {
  let httpClient;
  let logger;
  let factory;

  beforeEach(() => {
    httpClient = new StaticHttpClient();
    logger = new NoOpLogger();
    factory = new LLMStrategyFactory({
      httpClient,
      logger,
    });
  });

  it('resolves a strategy when config contains mixed casing and whitespace', () => {
    const config = createBaseConfig({
      apiType: ' OpenRouter ',
      jsonOutputStrategy: {
        method: ' OPENROUTER_JSON_SCHEMA ',
        jsonSchema: {
          type: 'object',
          properties: {
            outcome: { type: 'string' },
          },
        },
      },
    });

    const strategy = factory.getStrategy(config);

    expect(strategy).toBeInstanceOf(OpenRouterJsonSchemaStrategy);
    expect(strategy.requiresCustomToolSchema()).toBe(true);

    const toolSchema = strategy.buildToolSchema([
      { name: 'game_ai_action_speech' },
    ]);
    expect(toolSchema).toBeTruthy();
    expect(toolSchema.function?.name).toBe('game_ai_action_speech');
  });

  it('throws ConfigurationError when apiType is missing or blank', () => {
    const config = createBaseConfig({ apiType: '  ' });

    expect(() => factory.getStrategy(config)).toThrow(ConfigurationError);
  });

  it('throws LLMStrategyFactoryError when jsonOutputStrategy.method is not provided', () => {
    const config = createBaseConfig({
      jsonOutputStrategy: {
        method: '   ',
      },
    });

    expect(() => factory.getStrategy(config)).toThrow(LLMStrategyFactoryError);
  });

  it("rejects 'prompt_engineering' as an explicit json output strategy", () => {
    const config = createBaseConfig({
      jsonOutputStrategy: {
        method: 'prompt_engineering',
      },
    });

    expect(() => factory.getStrategy(config)).toThrow(LLMStrategyFactoryError);
  });
});
