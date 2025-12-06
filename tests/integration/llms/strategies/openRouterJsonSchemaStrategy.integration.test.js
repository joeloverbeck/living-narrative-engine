import { describe, it, expect } from '@jest/globals';
import { OpenRouterJsonSchemaStrategy } from '../../../../src/llms/strategies/openRouterJsonSchemaStrategy.js';
import { EnvironmentContext } from '../../../../src/llms/environmentContext.js';
import { OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA } from '../../../../src/llms/constants/llmConstants.js';
import { LLMStrategyError } from '../../../../src/llms/errors/LLMStrategyError.js';
import { createEnhancedMockLogger } from '../../../common/mockFactories/loggerMocks.js';

class RecordingHttpClient {
  constructor(responseFactory) {
    this.responseFactory = responseFactory;
    this.calls = [];
  }

  async request(url, options) {
    const call = { url, options };
    this.calls.push(call);
    const result =
      typeof this.responseFactory === 'function'
        ? await this.responseFactory(call)
        : this.responseFactory;
    return result ?? {};
  }
}

const BASE_CONFIG = Object.freeze({
  configId: 'openrouter-integration-test',
  endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
  modelIdentifier: 'google/gemma-7b-it',
  apiType: 'openrouter',
  defaultParameters: {
    temperature: 0.6,
    top_p: 0.8,
  },
  providerSpecificHeaders: {
    'HTTP-Referer': 'http://localhost',
    'X-Title': 'Living Narrative Engine',
  },
  jsonOutputStrategy: {
    method: 'openrouter_json_schema',
    jsonSchema: OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.schema,
  },
});

const GAME_SUMMARY = 'The hero studies the maze before choosing a path.';

/**
 *
 * @param loggerOverrides
 */
function createServerEnvironment(loggerOverrides = {}) {
  const envLogger = createEnhancedMockLogger(loggerOverrides);
  return {
    environmentContext: new EnvironmentContext({
      logger: envLogger,
      executionEnvironment: 'server',
      projectRootPath: process.cwd(),
    }),
    envLogger,
  };
}

/**
 *
 * @param proxyUrl
 */
function createClientEnvironment(proxyUrl = 'https://proxy.lne.test/llm') {
  const envLogger = createEnhancedMockLogger();
  return {
    environmentContext: new EnvironmentContext({
      logger: envLogger,
      executionEnvironment: 'client',
      proxyServerUrl: proxyUrl,
    }),
    envLogger,
  };
}

describe('Integration: OpenRouterJsonSchemaStrategy', () => {
  it('sends a server-side request with JSON schema and returns trimmed message content', async () => {
    const httpClient = new RecordingHttpClient(() => ({
      choices: [
        {
          message: {
            content: '  {"action":"move_north","speech":"Heading out."}  ',
          },
        },
      ],
    }));

    const strategyLogger = createEnhancedMockLogger();
    const strategy = new OpenRouterJsonSchemaStrategy({
      httpClient,
      logger: strategyLogger,
    });
    const { environmentContext } = createServerEnvironment();

    const result = await strategy.execute({
      gameSummary: GAME_SUMMARY,
      llmConfig: { ...BASE_CONFIG },
      apiKey: 'server-test-key',
      environmentContext,
      requestOptions: { temperature: 0.2, maxTokens: 256 },
    });

    expect(result).toBe('{"action":"move_north","speech":"Heading out."}');
    expect(httpClient.calls).toHaveLength(1);

    const [call] = httpClient.calls;
    expect(call.url).toBe(BASE_CONFIG.endpointUrl);
    expect(call.options.method).toBe('POST');
    expect(call.options.headers['Content-Type']).toBe('application/json');
    expect(call.options.headers.Authorization).toBe('Bearer server-test-key');
    expect(call.options.headers['HTTP-Referer']).toBe(
      BASE_CONFIG.providerSpecificHeaders['HTTP-Referer']
    );

    const parsedBody = JSON.parse(call.options.body);
    expect(parsedBody.model).toBe(BASE_CONFIG.modelIdentifier);
    expect(parsedBody.response_format).toEqual({
      type: 'json_schema',
      json_schema: BASE_CONFIG.jsonOutputStrategy.jsonSchema,
    });
    expect(parsedBody.temperature).toBe(0.2);
    expect(parsedBody.max_tokens).toBe(256);
    expect(parsedBody.messages).toHaveLength(1);
    expect(parsedBody.messages[0]).toEqual({
      role: 'user',
      content: GAME_SUMMARY,
    });
  });

  it('stringifies object content returned by the provider', async () => {
    const structuredContent = {
      action: 'move_east',
      speech: 'On my way.',
    };
    const httpClient = new RecordingHttpClient(() => ({
      choices: [
        {
          message: {
            content: structuredContent,
          },
        },
      ],
    }));

    const strategyLogger = createEnhancedMockLogger();
    const strategy = new OpenRouterJsonSchemaStrategy({
      httpClient,
      logger: strategyLogger,
    });
    const { environmentContext } = createServerEnvironment();

    const jsonString = await strategy.execute({
      gameSummary: GAME_SUMMARY,
      llmConfig: { ...BASE_CONFIG },
      apiKey: 'server-test-key',
      environmentContext,
    });

    expect(jsonString).toBe(JSON.stringify(structuredContent));
    expect(strategyLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Extracted JSON object from message.content and stringified it.'
      ),
      expect.objectContaining({ llmId: BASE_CONFIG.configId })
    );
  });

  it('falls back to tool_calls when message content is blank', async () => {
    const fallbackJson = '  {"action":"wave","speech":"Hello there."}  ';
    const httpClient = new RecordingHttpClient(() => ({
      choices: [
        {
          message: {
            content: '',
            tool_calls: [
              {
                type: 'function',
                function: {
                  name: OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.name,
                  arguments: fallbackJson,
                },
              },
            ],
          },
        },
      ],
    }));

    const strategyLogger = createEnhancedMockLogger();
    const strategy = new OpenRouterJsonSchemaStrategy({
      httpClient,
      logger: strategyLogger,
    });
    const { environmentContext } = createServerEnvironment();

    const result = await strategy.execute({
      gameSummary: GAME_SUMMARY,
      llmConfig: { ...BASE_CONFIG },
      apiKey: 'server-test-key',
      environmentContext,
    });

    expect(result).toBe('{"action":"wave","speech":"Hello there."}');
    expect(strategyLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'message.content was an empty string. Will check tool_calls fallback.'
      ),
      expect.objectContaining({ llmId: BASE_CONFIG.configId })
    );
    expect(strategyLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'message.content not usable, attempting tool_calls fallback.'
      ),
      expect.objectContaining({ llmId: BASE_CONFIG.configId })
    );
  });

  it('routes through the proxy in client environments and surfaces extraction failures', async () => {
    const proxyUrl = 'https://proxy.example.com/llm';
    const httpClient = new RecordingHttpClient(() => ({
      choices: [
        {
          message: {},
        },
      ],
    }));

    const strategyLogger = createEnhancedMockLogger();
    const strategy = new OpenRouterJsonSchemaStrategy({
      httpClient,
      logger: strategyLogger,
    });
    const { environmentContext } = createClientEnvironment(proxyUrl);

    const configWithEmptySchema = {
      ...BASE_CONFIG,
      jsonOutputStrategy: {
        method: 'openrouter_json_schema',
        jsonSchema: {},
      },
    };

    await expect(
      strategy.execute({
        gameSummary: GAME_SUMMARY,
        llmConfig: configWithEmptySchema,
        apiKey: null,
        environmentContext,
      })
    ).rejects.toBeInstanceOf(LLMStrategyError);

    expect(strategyLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('jsonSchema'),
      expect.objectContaining({ llmId: BASE_CONFIG.configId })
    );

    expect(httpClient.calls).toHaveLength(1);
    const [call] = httpClient.calls;
    expect(call.url).toBe(proxyUrl);
    const payload = JSON.parse(call.options.body);
    expect(payload.llmId).toBe(configWithEmptySchema.configId);
    expect(payload.targetPayload.response_format).toEqual({
      type: 'json_schema',
      json_schema: {},
    });
    expect(call.options.headers.Authorization).toBeUndefined();
  });
});
