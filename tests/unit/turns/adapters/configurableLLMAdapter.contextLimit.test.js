// tests/turns/adapters/configurableLLMAdapter.contextLimit.test.js
// -----------------------------------------------------------------------------
// End-to-end tests for prompt-length handling in ConfigurableLLMAdapter.
// -----------------------------------------------------------------------------
//
// 2025-06-04  – updated to use the new “gpt-tokenizer” package instead of
// gpt-3-encoder.  We stub the tokenizer so we can precisely control the
// token-count returned to the adapter.
//
// How the stub works:
//
//   • encoding_for_model()  → returns { encode, free }
//   • get_encoding()        → returns { encode, free }
//
// Both pathways share the same Jest spy “encodeSpy”, so each test can decide
// how many tokens the adapter should “see” or make it throw.
//
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigurableLLMAdapter } from '../../../../src/turns/adapters/configurableLLMAdapter.js';
import PromptTooLongError from '../../../../src/errors/promptTooLongError.js';
import {
  createMockLLMConfigurationManager,
  createMockLLMRequestExecutor,
  createMockLLMErrorMapper,
  createMockTokenEstimator,
} from '../../../common/mockFactories/index.js';

// ---------- MOCK gpt-tokenizer ------------------------------------------------
jest.mock('gpt-tokenizer', () => {
  const encodeSpy = jest.fn(); // shared across all pathways
  return {
    __esModule: true,
    encode: encodeSpy, // ← NEW: matches adapter’s import
    encoding_for_model: jest.fn(() => ({ encode: encodeSpy, free: jest.fn() })),
    get_encoding: jest.fn(() => ({ encode: encodeSpy, free: jest.fn() })),
    _encodeSpy: encodeSpy, // expose for the tests
  };
});

import { _encodeSpy as encodeSpy } from 'gpt-tokenizer';

// ---------- Helper objects ----------------------------------------------------
const createBaseConfig = () => ({
  configId: 'test-llm',
  displayName: 'Test LLM',
  apiType: 'openai',
  modelIdentifier: 'gpt-test',
  endpointUrl: 'https://example.com',
  jsonOutputStrategy: { method: 'native_json' },
  promptElements: [],
  promptAssemblyOrder: [],
});

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockEnvironmentContext = {
  getExecutionEnvironment: jest.fn().mockReturnValue('test'),
  getProjectRootPath: jest.fn(),
  getProxyServerUrl: jest.fn(),
  isClient: jest.fn(),
  isServer: jest.fn(),
};

const mockApiKeyProvider = { getKey: jest.fn() };
const mockLlmStrategyFactory = { getStrategy: jest.fn() };
const mockLlmConfigLoader = { loadConfigs: jest.fn() };
const mockLlmStrategy = { execute: jest.fn() };

// New service mocks
const mockConfigurationManager = createMockLLMConfigurationManager();
const mockRequestExecutor = createMockLLMRequestExecutor();
const mockErrorMapper = createMockLLMErrorMapper();
const mockTokenEstimator = createMockTokenEstimator();

// ---------- Test suite --------------------------------------------------------
describe('ConfigurableLLMAdapter context-limit handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLlmStrategyFactory.getStrategy.mockReturnValue(mockLlmStrategy);
  });

  const initAdapterWithConfig = async (config) => {
    const adapter = new ConfigurableLLMAdapter({
      logger: mockLogger,
      environmentContext: mockEnvironmentContext,
      apiKeyProvider: mockApiKeyProvider,
      llmStrategyFactory: mockLlmStrategyFactory,
      configurationManager: mockConfigurationManager,
      requestExecutor: mockRequestExecutor,
      errorMapper: mockErrorMapper,
      tokenEstimator: mockTokenEstimator,
    });

    mockLlmConfigLoader.loadConfigs.mockResolvedValue({
      defaultConfigId: config.configId,
      configs: { [config.configId]: config },
    });

    // Configure mock configuration manager to return the active config
    mockConfigurationManager.getActiveConfiguration.mockResolvedValue(config);
    mockConfigurationManager.init.mockImplementation(
      async ({ llmConfigLoader }) => {
        await llmConfigLoader.loadConfigs();
      }
    );

    await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
    return adapter;
  };

  it('throws PromptTooLongError when estimated tokens exceed promptTokenSpace', async () => {
    const config = {
      ...createBaseConfig(),
      contextTokenLimit: 20,
      defaultParameters: { max_tokens: 5 },
    };
    const adapter = await initAdapterWithConfig(config);

    // Mock token budget: 20 context - 5 max_tokens = 15 available for prompt
    mockTokenEstimator.getTokenBudget.mockReturnValue({
      contextTokenLimit: 20,
      maxTokensForOutput: 5,
      availableForPrompt: 15,
    });

    // Mock validation result: 16 tokens > 15 space = invalid
    mockTokenEstimator.validateTokenLimit.mockResolvedValue({
      isValid: false,
      isNearLimit: false,
      estimatedTokens: 16,
      promptTokenSpace: 15,
    });

    await expect(adapter.getAIDecision('exceed')).rejects.toThrow(
      PromptTooLongError
    );
    expect(mockRequestExecutor.executeRequest).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('logs a warning when estimated tokens approach the limit but do not exceed it', async () => {
    const config = {
      ...createBaseConfig(),
      contextTokenLimit: 20,
      defaultParameters: { max_tokens: 5 },
    };
    const adapter = await initAdapterWithConfig(config);

    // Mock token budget: 20 context - 5 max_tokens = 15 available for prompt
    mockTokenEstimator.getTokenBudget.mockReturnValue({
      contextTokenLimit: 20,
      maxTokensForOutput: 5,
      availableForPrompt: 15,
    });

    // Mock validation result: 14 tokens < 15 space = valid but near limit
    mockTokenEstimator.validateTokenLimit.mockResolvedValue({
      isValid: true,
      isNearLimit: true,
      estimatedTokens: 14,
      promptTokenSpace: 15,
    });

    mockRequestExecutor.executeRequest.mockResolvedValue('ok');

    const result = await adapter.getAIDecision('warn');
    expect(result).toBe('ok');
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockRequestExecutor.executeRequest).toHaveBeenCalled();
  });

  it('uses default max_tokens of 150 when none is specified', async () => {
    const config = {
      ...createBaseConfig(),
      configId: 'no-max',
      contextTokenLimit: 200,
    };
    const adapter = await initAdapterWithConfig(config);

    // Mock token budget: 200 context - 150 default max_tokens = 50 available for prompt
    mockTokenEstimator.getTokenBudget.mockReturnValue({
      contextTokenLimit: 200,
      maxTokensForOutput: 150,
      availableForPrompt: 50,
    });

    // Mock validation result: 60 tokens > 50 space = invalid
    mockTokenEstimator.validateTokenLimit.mockResolvedValue({
      isValid: false,
      isNearLimit: false,
      estimatedTokens: 60,
      promptTokenSpace: 50,
    });

    let caught;
    try {
      await adapter.getAIDecision('too long');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PromptTooLongError);
    expect(caught.promptTokenSpace).toBe(50); // 200 – 150
    expect(caught.maxTokensForOutput).toBe(150);
  });
});
