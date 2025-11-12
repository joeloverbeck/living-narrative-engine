import { describe, it, expect, jest } from '@jest/globals';
import { BaseOpenRouterStrategy } from '../../../../src/llms/strategies/base/baseOpenRouterStrategy.js';
import { EnvironmentContext } from '../../../../src/llms/environmentContext.js';
import { ConfigurationError } from '../../../../src/errors/configurationError.js';
import { InvalidEnvironmentContextError } from '../../../../src/errors/invalidEnvironmentContextError.js';
import { LLMStrategyError } from '../../../../src/llms/errors/LLMStrategyError.js';
import { DefaultToolSchemaHandler } from '../../../../src/llms/strategies/toolSchemaHandlers/defaultToolSchemaHandler.js';
import { HttpClientError } from '../../../../src/llms/retryHttpClient.js';
import { createEnhancedMockLogger } from '../../../common/mockFactories/loggerMocks.js';

const GAME_SUMMARY = 'The scout studies the cavern entrance before making a move.';

const BASE_CONFIG = Object.freeze({
  configId: 'integration-base-openrouter',
  endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
  modelIdentifier: 'meta/llama-guard-3.1',
  apiType: 'openrouter',
  defaultParameters: {
    temperature: 0.65,
    top_p: 0.75,
  },
  providerSpecificHeaders: {
    'HTTP-Referer': 'http://localhost',
    'X-Title': 'Living Narrative Engine',
  },
});

class RecordingHttpClient {
  constructor(onRequest) {
    this.onRequest = onRequest;
    this.calls = [];
  }

  async request(url, options) {
    const call = { url, options };
    this.calls.push(call);
    if (typeof this.onRequest === 'function') {
      return await this.onRequest(url, options);
    }
    return {};
  }
}

class TestOpenRouterStrategy extends BaseOpenRouterStrategy {
  constructor(deps, overrides = {}) {
    super(deps);
    this.payloadAdditionsFactory =
      overrides.payloadAdditionsFactory ||
      ((baseMessagesPayload, llmConfig, requestOptions) => ({
        strategyMarker: `${llmConfig.configId}-payload`,
        requestOptionsSnapshot: { ...requestOptions },
        baseMessagesCount: baseMessagesPayload.messages.length,
      }));
    this.extractResponse =
      overrides.extractResponse ||
      (async (responseData) => responseData?.extractedJson ?? null);
  }

  _buildProviderRequestPayloadAdditions(
    baseMessagesPayload,
    llmConfig,
    requestOptions
  ) {
    return this.payloadAdditionsFactory(
      baseMessagesPayload,
      llmConfig,
      requestOptions
    );
  }

  async _extractJsonOutput(responseData, llmConfig, providerRequestPayload) {
    return this.extractResponse(responseData, llmConfig, providerRequestPayload);
  }
}

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

describe('Integration: BaseOpenRouterStrategy core behavior', () => {
  it('requires an httpClient dependency', () => {
    const logger = createEnhancedMockLogger();
    expect(() => new BaseOpenRouterStrategy({ logger })).toThrow(
      'BaseOpenRouterStrategy: httpClient dependency is required.'
    );
  });

  it('throws when _buildProviderRequestPayloadAdditions is not overridden', () => {
    const logger = createEnhancedMockLogger();
    const httpClient = new RecordingHttpClient();
    const strategy = new BaseOpenRouterStrategy({ httpClient, logger });

    expect(() =>
      strategy._buildProviderRequestPayloadAdditions(
        { messages: [] },
        { configId: 'missing-method', apiType: 'openrouter' }
      )
    ).toThrow('Method not implemented');
  });

  it('throws when _extractJsonOutput is not overridden', async () => {
    const logger = createEnhancedMockLogger();
    const httpClient = new RecordingHttpClient();
    const strategy = new BaseOpenRouterStrategy({ httpClient, logger });

    await expect(
      strategy._extractJsonOutput({}, { configId: 'missing-method' })
    ).rejects.toThrow('Method not implemented');
  });

  it('buildToolSchema returns null when no tools are provided', () => {
    const logger = createEnhancedMockLogger();
    const httpClient = new RecordingHttpClient();
    const strategy = new BaseOpenRouterStrategy({ httpClient, logger });

    expect(strategy.buildToolSchema()).toBeNull();
    expect(strategy.buildToolSchema([])).toBeNull();
  });

  it('buildToolSchema delegates to DefaultToolSchemaHandler when tools exist', () => {
    const logger = createEnhancedMockLogger();
    const httpClient = new RecordingHttpClient();
    const strategy = new BaseOpenRouterStrategy({ httpClient, logger });

    const schema = strategy.buildToolSchema([{}], {
      toolName: 'custom_tool',
      toolDescription: 'Used in integration tests',
    });

    expect(schema).toEqual({
      type: 'function',
      function: expect.objectContaining({
        name: 'custom_tool',
        description: 'Used in integration tests',
      }),
    });
    expect(strategy._getToolSchemaHandler()).toBeInstanceOf(
      DefaultToolSchemaHandler
    );
    expect(strategy.requiresCustomToolSchema()).toBe(true);
  });

  it('returns null when the default tool schema handler throws an error', () => {
    const logger = createEnhancedMockLogger();
    const httpClient = new RecordingHttpClient();
    const strategy = new BaseOpenRouterStrategy({ httpClient, logger });

    const handler = strategy._getToolSchemaHandler();
    const spy = jest
      .spyOn(handler, 'buildDefaultToolSchema')
      .mockImplementation(() => {
        throw new Error('schema failure');
      });

    try {
      const schema = strategy.buildToolSchema([{}]);
      expect(schema).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error building default tool schema'),
        expect.objectContaining({ error: 'schema failure' })
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe('Integration: BaseOpenRouterStrategy execution pipeline', () => {
  it('builds a complete provider payload and sends a direct server-side request', async () => {
    const abortController = new AbortController();
    const httpClient = new RecordingHttpClient(async () => ({
      extractedJson: '{"action":"advance","speech":"Moving out."}',
    }));
    const logger = createEnhancedMockLogger();
    const strategy = new TestOpenRouterStrategy({ httpClient, logger });
    const { environmentContext } = createServerEnvironment();

    const requestOptions = {
      temperature: 0.2,
      maxTokens: 256,
      topP: 0.92,
      topK: 30,
      frequencyPenalty: 0.1,
      presencePenalty: 0.3,
    };

    const result = await strategy.execute({
      gameSummary: GAME_SUMMARY,
      llmConfig: { ...BASE_CONFIG },
      apiKey: 'server-api-key',
      environmentContext,
      requestOptions,
      abortSignal: abortController.signal,
    });

    expect(result).toBe('{"action":"advance","speech":"Moving out."}');
    expect(httpClient.calls).toHaveLength(1);
    const [call] = httpClient.calls;
    expect(call.url).toBe(BASE_CONFIG.endpointUrl);
    expect(call.options.abortSignal).toBe(abortController.signal);
    expect(call.options.method).toBe('POST');
    expect(call.options.headers.Authorization).toBe('Bearer server-api-key');
    expect(call.options.headers['HTTP-Referer']).toBe(
      BASE_CONFIG.providerSpecificHeaders['HTTP-Referer']
    );

    const body = JSON.parse(call.options.body);
    expect(body.model).toBe(BASE_CONFIG.modelIdentifier);
    expect(body.strategyMarker).toBe(
      `${BASE_CONFIG.configId}-payload`
    );
    expect(body.requestOptionsSnapshot).toEqual(requestOptions);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]).toEqual({
      role: 'user',
      content: GAME_SUMMARY,
    });
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(256);
    expect(body.top_p).toBe(0.92);
    expect(body.top_k).toBe(30);
    expect(body.frequency_penalty).toBe(0.1);
    expect(body.presence_penalty).toBe(0.3);
  });

  it('routes through the proxy when executed in a client environment', async () => {
    const proxyUrl = 'https://proxy.integration.test/llm';
    const httpClient = new RecordingHttpClient(async () => ({
      extractedJson: '{"action":"wave","speech":"Hello."}',
    }));
    const logger = createEnhancedMockLogger();
    const strategy = new TestOpenRouterStrategy({ httpClient, logger });
    const { environmentContext } = createClientEnvironment(proxyUrl);

    const result = await strategy.execute({
      gameSummary: GAME_SUMMARY,
      llmConfig: { ...BASE_CONFIG },
      apiKey: null,
      environmentContext,
    });

    expect(result).toBe('{"action":"wave","speech":"Hello."}');
    expect(httpClient.calls).toHaveLength(1);
    const [call] = httpClient.calls;
    expect(call.url).toBe(proxyUrl);
    expect(call.options.headers.Authorization).toBeUndefined();
    expect(call.options.headers['HTTP-Referer']).toBe(
      BASE_CONFIG.providerSpecificHeaders['HTTP-Referer']
    );

    const payload = JSON.parse(call.options.body);
    expect(payload.llmId).toBe(BASE_CONFIG.configId);
    expect(payload.targetPayload.model).toBe(BASE_CONFIG.modelIdentifier);
    expect(payload.targetPayload.messages[0].content).toBe(GAME_SUMMARY);
    expect(payload.targetHeaders).toEqual(BASE_CONFIG.providerSpecificHeaders);
  });

  it('throws a ConfigurationError when the API key is missing for server execution', async () => {
    const httpClient = new RecordingHttpClient();
    const logger = createEnhancedMockLogger();
    const strategy = new TestOpenRouterStrategy({ httpClient, logger });
    const { environmentContext } = createServerEnvironment();

    await expect(
      strategy.execute({
        gameSummary: GAME_SUMMARY,
        llmConfig: { ...BASE_CONFIG },
        apiKey: null,
        environmentContext,
      })
    ).rejects.toBeInstanceOf(ConfigurationError);
  });

  it('validates execute parameters and surfaces configuration issues early', async () => {
    const httpClient = new RecordingHttpClient();
    const logger = createEnhancedMockLogger();
    const strategy = new TestOpenRouterStrategy({ httpClient, logger });
    const { environmentContext } = createServerEnvironment();

    await expect(
      strategy.execute({
        gameSummary: GAME_SUMMARY,
        llmConfig: null,
        apiKey: 'key',
        environmentContext,
      })
    ).rejects.toBeInstanceOf(ConfigurationError);

    await expect(
      strategy.execute({
        gameSummary: GAME_SUMMARY,
        llmConfig: { ...BASE_CONFIG },
        apiKey: 'key',
        environmentContext: null,
      })
    ).rejects.toBeInstanceOf(ConfigurationError);

    await expect(
      strategy.execute({
        gameSummary: GAME_SUMMARY,
        llmConfig: { ...BASE_CONFIG, apiType: 'openai' },
        apiKey: 'key',
        environmentContext,
      })
    ).rejects.toBeInstanceOf(ConfigurationError);

    await expect(
      strategy.execute({
        gameSummary: GAME_SUMMARY,
        llmConfig: { ...BASE_CONFIG },
        apiKey: 'key',
        environmentContext: { isClient: () => true },
      })
    ).rejects.toBeInstanceOf(InvalidEnvironmentContextError);
  });

  it('wraps unexpected extraction failures in an LLMStrategyError', async () => {
    const underlyingError = new Error('unexpected parser issue');
    const httpClient = new RecordingHttpClient(async () => ({ extractedJson: null }));
    const logger = createEnhancedMockLogger();
    const strategy = new TestOpenRouterStrategy(
      { httpClient, logger },
      {
        extractResponse: async () => {
          throw underlyingError;
        },
      }
    );
    const { environmentContext } = createServerEnvironment();

    const error = await strategy
      .execute({
        gameSummary: GAME_SUMMARY,
        llmConfig: { ...BASE_CONFIG },
        apiKey: 'key',
        environmentContext,
      })
      .catch((err) => err);

    expect(error).toBeInstanceOf(LLMStrategyError);
    expect(error.originalError).toBe(underlyingError);
  });

  it('rethrows ConfigurationError and LLMStrategyError without wrapping', async () => {
    const httpClient = new RecordingHttpClient(async () => ({ extractedJson: null }));
    const logger = createEnhancedMockLogger();

    const configurationFailure = new ConfigurationError('bad config');
    const configurationStrategy = new TestOpenRouterStrategy(
      { httpClient, logger },
      {
        extractResponse: async () => {
          throw configurationFailure;
        },
      }
    );

    const { environmentContext } = createServerEnvironment();

    await expect(
      configurationStrategy.execute({
        gameSummary: GAME_SUMMARY,
        llmConfig: { ...BASE_CONFIG },
        apiKey: 'key',
        environmentContext,
      })
    ).rejects.toBe(configurationFailure);

    const llmFailure = new LLMStrategyError('llm fail', BASE_CONFIG.configId);
    const llmStrategy = new TestOpenRouterStrategy(
      { httpClient, logger },
      {
        extractResponse: async () => {
          throw llmFailure;
        },
      }
    );

    await expect(
      llmStrategy.execute({
        gameSummary: GAME_SUMMARY,
        llmConfig: { ...BASE_CONFIG },
        apiKey: 'key',
        environmentContext,
      })
    ).rejects.toBe(llmFailure);
  });

  it('rethrows HttpClientError instances without wrapping them', async () => {
    const httpError = new HttpClientError('network fail', {
      url: BASE_CONFIG.endpointUrl,
      status: 503,
      responseBody: 'Service Unavailable',
      attempts: 2,
      isRetryableFailure: true,
    });
    const httpClient = new RecordingHttpClient(async () => {
      throw httpError;
    });
    const logger = createEnhancedMockLogger();
    const strategy = new TestOpenRouterStrategy({ httpClient, logger });
    const { environmentContext } = createServerEnvironment();

    await expect(
      strategy.execute({
        gameSummary: GAME_SUMMARY,
        llmConfig: { ...BASE_CONFIG },
        apiKey: 'key',
        environmentContext,
      })
    ).rejects.toBe(httpError);
  });

  it('throws an LLMStrategyError when extraction returns null or blank content', async () => {
    const httpClient = new RecordingHttpClient(async () => ({ extractedJson: null }));
    const logger = createEnhancedMockLogger();
    const strategy = new TestOpenRouterStrategy(
      { httpClient, logger },
      {
        extractResponse: async () => '   ',
      }
    );
    const { environmentContext } = createServerEnvironment();

    await expect(
      strategy.execute({
        gameSummary: GAME_SUMMARY,
        llmConfig: { ...BASE_CONFIG },
        apiKey: 'key',
        environmentContext,
      })
    ).rejects.toBeInstanceOf(LLMStrategyError);
  });
});
