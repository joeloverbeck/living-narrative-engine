import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigurableLLMAdapter } from '../../../src/turns/adapters/configurableLLMAdapter.js';

jest.mock('gpt-3-encoder', () => ({
  __esModule: true,
  default: { encode: jest.fn() },
}));

import gptEncoder from 'gpt-3-encoder';

const sampleConfig = {
  configId: 'test-llm',
  displayName: 'Test LLM',
  apiType: 'openai',
  modelIdentifier: 'gpt-test',
  endpointUrl: 'https://example.com',
  jsonOutputStrategy: { method: 'native_json' },
  promptElements: [],
  promptAssemblyOrder: [],
};

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

describe('ConfigurableLLMAdapter token estimation', () => {
  let adapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new ConfigurableLLMAdapter({
      logger: mockLogger,
      environmentContext: mockEnvironmentContext,
      apiKeyProvider: mockApiKeyProvider,
      llmStrategyFactory: mockLlmStrategyFactory,
    });
  });

  it('returns token length from tokenizer when available', () => {
    gptEncoder.encode.mockReturnValue([1, 2, 3]);
    const count = adapter.estimateTokenCount_FOR_TESTING_ONLY(
      'test prompt',
      sampleConfig
    );
    expect(count).toBe(3);
  });

  it('falls back to word approximation when tokenizer throws', () => {
    gptEncoder.encode.mockImplementation(() => {
      throw new Error('boom');
    });
    const count = adapter.estimateTokenCount_FOR_TESTING_ONLY(
      'two words',
      sampleConfig
    );
    expect(count).toBe(2);
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});
