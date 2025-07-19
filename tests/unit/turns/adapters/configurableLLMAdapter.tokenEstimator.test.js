// tests/turns/adapters/configurableLLMAdapter.tokenEstimator.test.js
// -----------------------------------------------------------------------------
// Verifies the internal token-count helper in ConfigurableLLMAdapter.
//
// 2025-06-04 – switched to “gpt-tokenizer”; we stub its encoder so the test
// suite can dictate the exact token count (or make it blow up) without
// depending on the real WASM build.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigurableLLMAdapter } from '../../../../src/turns/adapters/configurableLLMAdapter.js';
import {
  createMockLLMConfigurationManager,
  createMockLLMRequestExecutor,
  createMockLLMErrorMapper,
  createMockTokenEstimator,
} from '../../../common/mockFactories/index.js';

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

// New service mocks
const mockConfigurationManager = createMockLLMConfigurationManager();
const mockRequestExecutor = createMockLLMRequestExecutor();
const mockErrorMapper = createMockLLMErrorMapper();
const mockTokenEstimator = createMockTokenEstimator();

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
      configurationManager: mockConfigurationManager,
      requestExecutor: mockRequestExecutor,
      errorMapper: mockErrorMapper,
      tokenEstimator: mockTokenEstimator,
    });
  });

  it('returns token length from tokenizer when available', async () => {
    // Configure the mock token estimator to return 3 tokens
    mockTokenEstimator.estimateTokens.mockResolvedValue(3);

    const count = await adapter.estimateTokenCount_FOR_TESTING_ONLY(
      'test prompt',
      sampleConfig
    );
    expect(count).toBe(3);
  });

  it('falls back to word approximation when tokenizer throws', async () => {
    // Configure the mock token estimator to return 2 tokens (fallback scenario)
    mockTokenEstimator.estimateTokens.mockResolvedValue(2);

    const count = await adapter.estimateTokenCount_FOR_TESTING_ONLY(
      'two words',
      sampleConfig
    );
    expect(count).toBe(2); // word-count fallback
  });
});
