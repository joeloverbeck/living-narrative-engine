/**
 * @file Integration tests for request-time schema injection functionality
 * @description Tests the complete flow from ConfigurableLLMAdapter through LLMRequestExecutor to OpenRouterToolCallingStrategy
 * Note: In v5, tool schemas must be explicitly provided - no default fallback schema exists.
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { ConfigurableLLMAdapter } from '../../../src/turns/adapters/configurableLLMAdapter.js';
import { LLMRequestExecutor } from '../../../src/llms/services/llmRequestExecutor.js';
import { OpenRouterToolCallingStrategy } from '../../../src/llms/strategies/openRouterToolCallingStrategy.js';
import {
  createMockLLMConfigurationManager,
  createMockLLMErrorMapper,
  createMockTokenEstimator,
} from '../../common/mockFactories/coreServices.js';

describe('Request-Time Schema Injection Integration', () => {
  let configurableLLMAdapter;
  let llmRequestExecutor;
  let openRouterStrategy;
  let mockLogger;
  let mockHttpClient;
  let mockEnvironmentContext;
  let mockApiKeyProvider;
  let mockLlmStrategyFactory;
  let mockLlmConfigLoader;
  let mockConfigurationManager;
  let mockErrorMapper;
  let mockTokenEstimator;

  const baseConfig = {
    configId: 'test-openrouter-config',
    displayName: 'Test OpenRouter Config',
    apiType: 'openrouter',
    modelIdentifier: 'anthropic/claude-3-sonnet',
    endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
    jsonOutputStrategy: {
      method: 'tool_calling',
      toolName: 'game_ai_action',
    },
    promptElements: [{ key: 'sys', prefix: '', suffix: '' }],
    promptAssemblyOrder: ['sys'],
  };

  const customSchema = {
    type: 'object',
    properties: {
      analysis: {
        type: 'string',
        description: 'Analysis result from custom tool',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence score for the analysis',
      },
      metadata: {
        type: 'object',
        properties: {
          timestamp: { type: 'string' },
          version: { type: 'string' },
        },
      },
    },
    required: ['analysis', 'confidence'],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock HTTP client
    mockHttpClient = {
      request: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: 'custom_analysis_tool',
                    arguments: JSON.stringify({
                      analysis: 'Test analysis result',
                      confidence: 0.95,
                      metadata: { timestamp: '2024-01-01', version: '1.0' },
                    }),
                  },
                },
              ],
            },
          },
        ],
      }),
    };

    // Create mock environment context
    mockEnvironmentContext = {
      getExecutionEnvironment: jest.fn().mockReturnValue('server'),
      getProjectRootPath: jest.fn().mockReturnValue('/test/path'),
      isClient: jest.fn().mockReturnValue(false),
      isServer: jest.fn().mockReturnValue(true),
    };

    // Create mock API key provider
    mockApiKeyProvider = {
      getKey: jest.fn().mockResolvedValue('test-api-key'),
    };

    // Create mock configuration loader
    mockLlmConfigLoader = {
      loadConfigs: jest.fn().mockResolvedValue({
        defaultConfigId: 'test-openrouter-config',
        configs: {
          'test-openrouter-config': baseConfig,
        },
      }),
    };

    // Create core service mocks
    mockConfigurationManager = createMockLLMConfigurationManager();
    mockErrorMapper = createMockLLMErrorMapper();
    mockTokenEstimator = createMockTokenEstimator();

    // Setup configuration manager behavior
    mockConfigurationManager.getActiveConfiguration.mockResolvedValue(
      baseConfig
    );
    mockConfigurationManager.setActiveConfiguration.mockResolvedValue(true);

    // Create strategy instance
    openRouterStrategy = new OpenRouterToolCallingStrategy({
      httpClient: mockHttpClient,
      logger: mockLogger,
    });

    // Create request executor
    llmRequestExecutor = new LLMRequestExecutor({ logger: mockLogger });

    // Create mock strategy factory
    mockLlmStrategyFactory = {
      getStrategy: jest.fn().mockReturnValue(openRouterStrategy),
    };

    // Create configurable LLM adapter
    configurableLLMAdapter = new ConfigurableLLMAdapter({
      logger: mockLogger,
      environmentContext: mockEnvironmentContext,
      apiKeyProvider: mockApiKeyProvider,
      llmStrategyFactory: mockLlmStrategyFactory,
      configurationManager: mockConfigurationManager,
      requestExecutor: llmRequestExecutor,
      errorMapper: mockErrorMapper,
      tokenEstimator: mockTokenEstimator,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should use custom schema from request options throughout the entire flow', async () => {
    // Initialize adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });
    await configurableLLMAdapter.setActiveLlm('test-openrouter-config');

    const requestOptions = {
      toolSchema: customSchema,
      toolName: 'custom_analysis_tool',
      toolDescription: 'Custom analysis tool for testing',
    };

    const gameSummary = 'Test game summary for custom schema integration';

    // Execute the request
    const result = await configurableLLMAdapter.getAIDecision(
      gameSummary,
      null,
      requestOptions
    );

    // Verify HTTP client was called with custom schema
    expect(mockHttpClient.request).toHaveBeenCalledTimes(1);

    // Verify result is properly extracted
    expect(result).toBe(
      JSON.stringify({
        analysis: 'Test analysis result',
        confidence: 0.95,
        metadata: { timestamp: '2024-01-01', version: '1.0' },
      })
    );

    // Verify logging shows custom schema usage
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Using tool schema from request options'),
      expect.objectContaining({
        llmId: 'test-openrouter-config',
        schemaProperties: ['analysis', 'confidence', 'metadata'],
      })
    );
  });

  it('should throw error when no toolSchema is provided in request options (v5 requirement)', async () => {
    // In v5, toolSchema must be explicitly provided - no default fallback exists.
    // Initialize adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });
    await configurableLLMAdapter.setActiveLlm('test-openrouter-config');

    const gameSummary = 'Test game summary without schema';

    // Execute without request options - should throw because toolSchema is required
    await expect(
      configurableLLMAdapter.getAIDecision(gameSummary)
    ).rejects.toThrow(/Missing 'toolSchema'/);

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("Missing 'toolSchema' in request options"),
      expect.objectContaining({ llmId: 'test-openrouter-config' })
    );
  });

  it('should handle tool name precedence correctly (request options > config)', async () => {
    // Initialize adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });
    await configurableLLMAdapter.setActiveLlm('test-openrouter-config');

    // Mock HTTP response with expected tool name
    mockHttpClient.request.mockResolvedValue({
      choices: [
        {
          message: {
            tool_calls: [
              {
                type: 'function',
                function: {
                  name: 'priority_test_tool',
                  arguments: JSON.stringify({
                    analysis: 'Test priority tool result',
                    confidence: 0.9,
                  }),
                },
              },
            ],
          },
        },
      ],
    });

    const requestOptions = {
      toolSchema: customSchema, // Required in v5
      toolName: 'priority_test_tool', // Should override config toolName
    };

    const gameSummary = 'Test tool name precedence';

    // Execute the request
    const result = await configurableLLMAdapter.getAIDecision(
      gameSummary,
      null,
      requestOptions
    );

    // Verify HTTP client was called
    expect(mockHttpClient.request).toHaveBeenCalledTimes(1);

    // Verify result is properly extracted
    expect(result).toBe(
      JSON.stringify({
        analysis: 'Test priority tool result',
        confidence: 0.9,
      })
    );
  });

  it('should handle partial request options with appropriate fallbacks', async () => {
    // Initialize adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });
    await configurableLLMAdapter.setActiveLlm('test-openrouter-config');

    // Mock HTTP response with expected tool name
    mockHttpClient.request.mockResolvedValue({
      choices: [
        {
          message: {
            tool_calls: [
              {
                type: 'function',
                function: {
                  name: 'game_ai_action',
                  arguments: JSON.stringify({
                    analysis: 'Test partial options result',
                    confidence: 0.8,
                  }),
                },
              },
            ],
          },
        },
      ],
    });

    const partialRequestOptions = {
      toolSchema: customSchema, // Only custom schema, no tool name or description
    };

    const gameSummary = 'Test partial request options';

    // Execute the request
    const result = await configurableLLMAdapter.getAIDecision(
      gameSummary,
      null,
      partialRequestOptions
    );

    // Verify HTTP client was called
    expect(mockHttpClient.request).toHaveBeenCalledTimes(1);

    // Verify result is properly extracted
    expect(result).toBe(
      JSON.stringify({
        analysis: 'Test partial options result',
        confidence: 0.8,
      })
    );
  });

  it('should validate and reject invalid custom schemas', async () => {
    // Initialize adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });
    await configurableLLMAdapter.setActiveLlm('test-openrouter-config');

    const invalidRequestOptions = {
      toolSchema: null, // Invalid schema
      toolName: 'invalid_schema_test',
    };

    const gameSummary = 'Test invalid schema validation';

    // Should throw validation error
    await expect(
      configurableLLMAdapter.getAIDecision(
        gameSummary,
        null,
        invalidRequestOptions
      )
    ).rejects.toThrow('Invalid tool parameters schema');

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid tool parameters schema'),
      expect.objectContaining({ llmId: 'test-openrouter-config' })
    );
  });

  it('should require explicit toolSchema - no backward compatibility without schema (v5 breaking change)', async () => {
    // In v5, all callers must provide explicit toolSchema.
    // This is a breaking change from v4 where default schema was used.
    // Initialize adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });
    await configurableLLMAdapter.setActiveLlm('test-openrouter-config');

    const gameSummary = 'Test backward compatibility';

    // Execute without any request options - should throw in v5
    await expect(
      configurableLLMAdapter.getAIDecision(gameSummary)
    ).rejects.toThrow(/Missing 'toolSchema'/);

    // Verify HTTP client was NOT called since schema validation fails early
    expect(mockHttpClient.request).not.toHaveBeenCalled();
  });

  it('should propagate request options through the entire execution chain', async () => {
    // Initialize adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });
    await configurableLLMAdapter.setActiveLlm('test-openrouter-config');

    // Mock HTTP response with expected tool name
    mockHttpClient.request.mockResolvedValue({
      choices: [
        {
          message: {
            tool_calls: [
              {
                type: 'function',
                function: {
                  name: 'propagation_test_tool',
                  arguments: JSON.stringify({
                    analysis: 'Test propagation result',
                    confidence: 0.95,
                    metadata: { source: 'propagation_test' },
                  }),
                },
              },
            ],
          },
        },
      ],
    });

    const requestOptions = {
      toolSchema: customSchema,
      toolName: 'propagation_test_tool',
      toolDescription: 'Test request options propagation',
    };

    // Spy on request executor to verify options are passed through
    const executeSpy = jest.spyOn(llmRequestExecutor, 'executeRequest');

    const gameSummary = 'Test request options propagation';

    const result = await configurableLLMAdapter.getAIDecision(
      gameSummary,
      null,
      requestOptions
    );

    // Verify request executor received the request options
    expect(executeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        requestOptions: expect.objectContaining(requestOptions),
      })
    );

    // Verify HTTP client was called
    expect(mockHttpClient.request).toHaveBeenCalledTimes(1);

    // Verify result is properly extracted
    expect(result).toBe(
      JSON.stringify({
        analysis: 'Test propagation result',
        confidence: 0.95,
        metadata: { source: 'propagation_test' },
      })
    );
  });
});
