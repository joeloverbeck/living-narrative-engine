// tests/turns/adapters/configurableLLMAdapter.tokenEstimator.test.js
// -----------------------------------------------------------------------------
// Verifies the internal token-count helper in ConfigurableLLMAdapter.
//
// 2025-06-04 – switched to “gpt-tokenizer”; we stub its encoder so the test
// suite can dictate the exact token count (or make it blow up) without
// depending on the real WASM build.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigurableLLMAdapter } from '../../../src/turns/adapters/configurableLLMAdapter.js';

// ---------- MOCK gpt-tokenizer -----------------------------------------------
jest.mock('gpt-tokenizer', () => {
  const encodeSpy = jest.fn(); // shared spy for all pathways
  return {
    __esModule: true,
    encode: encodeSpy, // ← NEW: match adapter’s `import { encode … }`
    encoding_for_model: jest.fn(() => ({ encode: encodeSpy, free: jest.fn() })),
    get_encoding: jest.fn(() => ({ encode: encodeSpy, free: jest.fn() })),
    _encodeSpy: encodeSpy, // re-export so tests can reach it
  };
});
import { _encodeSpy as encodeSpy } from 'gpt-tokenizer';

// ---------- Static fixtures ---------------------------------------------------
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

// ---------- Tests -------------------------------------------------------------
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

  it('returns token length from tokenizer when available', async () => {
    encodeSpy.mockReturnValue([1, 2, 3]); // 3 tokens
    const count = await adapter.estimateTokenCount_FOR_TESTING_ONLY(
      'test prompt',
      sampleConfig
    );
    expect(count).toBe(3);
  });

  it('falls back to word approximation when tokenizer throws', async () => {
    encodeSpy.mockImplementation(() => {
      throw new Error('boom');
    });

    const count = await adapter.estimateTokenCount_FOR_TESTING_ONLY(
      'two words',
      sampleConfig
    );
    expect(count).toBe(2); // word-count fallback
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});
