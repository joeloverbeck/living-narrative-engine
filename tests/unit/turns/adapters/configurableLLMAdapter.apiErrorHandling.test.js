import { jest, beforeEach, describe, expect, test } from '@jest/globals';
import { ConfigurableLLMAdapter } from '../../../../src/turns/adapters/configurableLLMAdapter.js';
import {
  ApiKeyError,
  InsufficientCreditsError,
  BadRequestError,
} from '../../../../src/errors/llmInteractionErrors.js';
import { CLOUD_API_TYPES } from '../../../../src/llms/constants/llmConstants.js';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
const mockEnvironmentContext = {
  getExecutionEnvironment: jest.fn().mockReturnValue('server'),
  getProjectRootPath: jest.fn(),
  getProxyServerUrl: jest.fn(),
  isClient: jest.fn().mockReturnValue(false),
  isServer: jest.fn().mockReturnValue(true),
};
const mockApiKeyProvider = { getKey: jest.fn().mockResolvedValue('key') };
const mockLlmStrategyFactory = { getStrategy: jest.fn() };
const mockLlmConfigLoader = { loadConfigs: jest.fn() };
const mockStrategy = { execute: jest.fn() };

const baseConfig = (id) => ({
  configId: id,
  displayName: id,
  apiType: CLOUD_API_TYPES[0] || 'openai',
  modelIdentifier: 'model',
  endpointUrl: 'https://api.test',
  jsonOutputStrategy: { method: 'native_json' },
  promptElements: [{ key: 'sys', prefix: '', suffix: '' }],
  promptAssemblyOrder: ['sys'],
});

describe('ConfigurableLLMAdapter API error handling', () => {
  let adapter;
  const summary = 'hi';
  beforeEach(async () => {
    jest.clearAllMocks();
    mockLlmStrategyFactory.getStrategy.mockReturnValue(mockStrategy);
    mockLlmConfigLoader.loadConfigs.mockResolvedValue({
      defaultConfigId: 'a',
      configs: { a: baseConfig('a') },
    });
    adapter = new ConfigurableLLMAdapter({
      logger: mockLogger,
      environmentContext: mockEnvironmentContext,
      apiKeyProvider: mockApiKeyProvider,
      llmStrategyFactory: mockLlmStrategyFactory,
    });
    await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
  });

  test('maps 401 HttpClientError to ApiKeyError', async () => {
    const err = new Error('unauthorized');
    err.name = 'HttpClientError';
    err.status = 401;
    err.responseBody = { message: 'bad key' };
    mockStrategy.execute.mockRejectedValueOnce(err);

    const caught = await adapter.getAIDecision(summary).catch((e) => e);
    expect(caught).toBeInstanceOf(ApiKeyError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Status: 401'),
      expect.objectContaining({ status: 401, llmId: 'a' })
    );
  });

  test('maps 402 HttpClientError to InsufficientCreditsError', async () => {
    const err = new Error('payment');
    err.name = 'HttpClientError';
    err.status = 402;
    err.responseBody = { message: 'pay up' };
    mockStrategy.execute.mockRejectedValueOnce(err);
    const caught = await adapter.getAIDecision(summary).catch((e) => e);
    expect(caught).toBeInstanceOf(InsufficientCreditsError);
  });

  test('maps 400 HttpClientError to BadRequestError', async () => {
    const err = new Error('bad');
    err.name = 'HttpClientError';
    err.status = 400;
    err.responseBody = { oops: true };
    mockStrategy.execute.mockRejectedValueOnce(err);
    const caught = await adapter.getAIDecision(summary).catch((e) => e);
    expect(caught).toBeInstanceOf(BadRequestError);
  });
});
