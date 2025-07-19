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

// Mock new services
const mockConfigurationManager = {
  init: jest.fn().mockResolvedValue(undefined),
  getActiveConfiguration: jest.fn(),
  setActiveConfiguration: jest.fn(),
  getAvailableOptions: jest.fn(),
  getActiveConfigId: jest.fn(),
  validateConfiguration: jest.fn().mockReturnValue([]),
  isOperational: jest.fn().mockReturnValue(true),
};

const mockRequestExecutor = {
  executeRequest: jest.fn(),
};

const mockErrorMapper = {
  mapHttpError: jest.fn(),
  logError: jest.fn(),
};

const mockTokenEstimator = {
  estimateTokens: jest.fn().mockResolvedValue(100),
  getTokenBudget: jest.fn().mockReturnValue({
    totalLimit: 4096,
    reservedTokens: 150,
    availableForPrompt: 3946,
  }),
  validateTokenLimit: jest.fn().mockResolvedValue({
    isValid: true,
    estimatedTokens: 100,
    availableTokens: 3946,
    isNearLimit: false,
  }),
};

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
    // Set up mock behaviors for this test suite
    mockConfigurationManager.getActiveConfiguration.mockResolvedValue(
      baseConfig('a')
    );

    adapter = new ConfigurableLLMAdapter({
      logger: mockLogger,
      environmentContext: mockEnvironmentContext,
      apiKeyProvider: mockApiKeyProvider,
      llmStrategyFactory: mockLlmStrategyFactory,
      configurationManager: mockConfigurationManager,
      requestExecutor: mockRequestExecutor,
      errorMapper: mockErrorMapper,
      tokenEstimator: mockTokenEstimator,
    });
    await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
  });

  test('maps 401 HttpClientError to ApiKeyError', async () => {
    const err = new Error('unauthorized');
    err.name = 'HttpClientError';
    err.status = 401;
    err.responseBody = { message: 'bad key' };

    // Mock the request executor to throw the error
    mockRequestExecutor.executeRequest.mockRejectedValueOnce(err);

    // Mock the error mapper to return ApiKeyError
    const apiKeyError = new ApiKeyError('API key is invalid', {
      status: 401,
      llmId: 'a',
    });
    mockErrorMapper.mapHttpError.mockReturnValueOnce(apiKeyError);

    const caught = await adapter.getAIDecision(summary).catch((e) => e);
    expect(caught).toBeInstanceOf(ApiKeyError);
    expect(mockErrorMapper.logError).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ llmId: 'a', operation: 'getAIDecision' })
    );
  });

  test('maps 402 HttpClientError to InsufficientCreditsError', async () => {
    const err = new Error('payment');
    err.name = 'HttpClientError';
    err.status = 402;
    err.responseBody = { message: 'pay up' };

    // Mock the request executor to throw the error
    mockRequestExecutor.executeRequest.mockRejectedValueOnce(err);

    // Mock the error mapper to return InsufficientCreditsError
    const creditsError = new InsufficientCreditsError('Insufficient credits', {
      status: 402,
      llmId: 'a',
    });
    mockErrorMapper.mapHttpError.mockReturnValueOnce(creditsError);

    const caught = await adapter.getAIDecision(summary).catch((e) => e);
    expect(caught).toBeInstanceOf(InsufficientCreditsError);
  });

  test('maps 400 HttpClientError to BadRequestError', async () => {
    const err = new Error('bad');
    err.name = 'HttpClientError';
    err.status = 400;
    err.responseBody = { oops: true };

    // Mock the request executor to throw the error
    mockRequestExecutor.executeRequest.mockRejectedValueOnce(err);

    // Mock the error mapper to return BadRequestError
    const badRequestError = new BadRequestError('Bad request', {
      status: 400,
      llmId: 'a',
    });
    mockErrorMapper.mapHttpError.mockReturnValueOnce(badRequestError);

    const caught = await adapter.getAIDecision(summary).catch((e) => e);
    expect(caught).toBeInstanceOf(BadRequestError);
  });
});
