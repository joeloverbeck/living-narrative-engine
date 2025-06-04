import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigurableLLMAdapter } from '../../../src/turns/adapters/configurableLLMAdapter.js';
import PromptTooLongError from '../../../src/errors/promptTooLongError.js';

jest.mock('gpt-3-encoder', () => ({
  __esModule: true,
  default: { encode: jest.fn() },
}));

import gptEncoder from 'gpt-3-encoder';

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

describe('ConfigurableLLMAdapter context limit handling', () => {
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
    });
    mockLlmConfigLoader.loadConfigs.mockResolvedValue({
      defaultConfigId: config.configId,
      configs: { [config.configId]: config },
    });
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

    gptEncoder.encode.mockReturnValue(new Array(16).fill(0));

    await expect(adapter.getAIDecision('exceed')).rejects.toThrow(
      PromptTooLongError
    );
    expect(mockLlmStrategy.execute).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('logs a warning when estimated tokens approach the limit but do not exceed it', async () => {
    const config = {
      ...createBaseConfig(),
      contextTokenLimit: 20,
      defaultParameters: { max_tokens: 5 },
    };
    const adapter = await initAdapterWithConfig(config);

    gptEncoder.encode.mockReturnValue(new Array(14).fill(0));
    mockLlmStrategy.execute.mockResolvedValue('ok');

    const result = await adapter.getAIDecision('warn');
    expect(result).toBe('ok');
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockLlmStrategy.execute).toHaveBeenCalled();
  });

  it('uses default max_tokens of 150 when none is specified', async () => {
    const config = {
      ...createBaseConfig(),
      configId: 'no-max',
      contextTokenLimit: 200,
    };
    const adapter = await initAdapterWithConfig(config);

    gptEncoder.encode.mockReturnValue(new Array(60).fill(0));

    let caught;
    try {
      await adapter.getAIDecision('too long');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PromptTooLongError);
    expect(caught.promptTokenSpace).toBe(50);
    expect(caught.maxTokensForOutput).toBe(150);
  });
});
