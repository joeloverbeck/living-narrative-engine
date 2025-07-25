/**
 * @file Integration tests for Character Builder Thematic Direction Generation with request-time schema
 * @description Tests the integration between ThematicDirectionGenerator and ConfigurableLLMAdapter using custom tool schemas
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  ThematicDirectionGenerator,
  ThematicDirectionGenerationError,
} from '../../../src/characterBuilder/services/thematicDirectionGenerator.js';
import { ConfigurableLLMAdapter } from '../../../src/turns/adapters/configurableLLMAdapter.js';
import { LLMRequestExecutor } from '../../../src/llms/services/llmRequestExecutor.js';
import { OpenRouterToolCallingStrategy } from '../../../src/llms/strategies/openRouterToolCallingStrategy.js';
import { LlmJsonService } from '../../../src/llms/llmJsonService.js';
import { THEMATIC_DIRECTIONS_RESPONSE_SCHEMA } from '../../../src/characterBuilder/prompts/thematicDirectionsPrompt.js';
import {
  createMockLLMConfigurationManager,
  createMockLLMErrorMapper,
  createMockTokenEstimator,
} from '../../common/mockFactories/coreServices.js';

describe('Character Builder Thematic Direction Generation Integration', () => {
  let thematicDirectionGenerator;
  let configurableLLMAdapter;
  let llmRequestExecutor;
  let openRouterStrategy;
  let llmJsonService;
  let mockLogger;
  let mockHttpClient;
  let mockEnvironmentContext;
  let mockApiKeyProvider;
  let mockLlmStrategyFactory;
  let mockLlmConfigLoader;
  let mockConfigurationManager;
  let mockErrorMapper;
  let mockTokenEstimator;

  const testCharacterConcept =
    'A brilliant but morally ambiguous scientist who discovers a way to transfer consciousness between bodies';

  const mockThematicDirectionsResponse = {
    thematicDirections: [
      {
        title: 'The Price of Playing God',
        description:
          'The character grapples with the ethical implications of consciousness manipulation, walking the line between scientific breakthrough and moral corruption.',
        coreTension: 'Scientific ambition versus ethical responsibility',
        uniqueTwist:
          'Each consciousness transfer leaves a psychological imprint on both donor and recipient',
        narrativePotential:
          'Creates opportunities for identity crisis, moral dilemmas, and exploring what makes us human',
      },
      {
        title: 'Identity in Fragments',
        description:
          'The character experiences fragmented identity as residual memories from previous hosts influence their decisions and personality.',
        coreTension: 'Personal identity versus inherited memories',
        uniqueTwist:
          'The character cannot distinguish their own memories from those of previous consciousness transfers',
        narrativePotential:
          'Enables storylines about self-discovery, unreliable narrator perspectives, and questioning reality',
      },
      {
        title: "The Puppet Master's Dilemma",
        description:
          'With the power to control others through consciousness manipulation, the character must decide whether to use this ability for personal gain or greater good.',
        coreTension: 'Power and control versus freedom and autonomy',
        uniqueTwist:
          "The character realizes they may themselves be under someone else's consciousness control",
        narrativePotential:
          'Opens paths for conspiracy theories, power struggles, and questions about free will',
      },
    ],
  };

  const baseConfig = {
    configId: 'character-builder-llm',
    displayName: 'Character Builder LLM',
    apiType: 'openrouter',
    modelIdentifier: 'anthropic/claude-3-sonnet',
    endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
    jsonOutputStrategy: {
      method: 'tool_calling',
      toolName: 'character_analysis',
    },
    promptElements: [{ key: 'sys', prefix: '', suffix: '' }],
    promptAssemblyOrder: ['sys'],
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

    // Create mock HTTP client that returns valid thematic directions
    mockHttpClient = {
      request: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: 'generate_thematic_directions',
                    arguments: JSON.stringify(mockThematicDirectionsResponse),
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
        defaultConfigId: 'character-builder-llm',
        configs: {
          'character-builder-llm': baseConfig,
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
    mockConfigurationManager.loadConfiguration.mockResolvedValue(baseConfig);

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

    // Create LLM JSON service
    llmJsonService = new LlmJsonService({ logger: mockLogger });

    // Create thematic direction generator
    thematicDirectionGenerator = new ThematicDirectionGenerator({
      logger: mockLogger,
      llmJsonService: llmJsonService,
      llmStrategyFactory: configurableLLMAdapter,
      llmConfigManager: mockConfigurationManager,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should generate thematic directions using custom tool schema', async () => {
    // Initialize LLM adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });

    // Generate thematic directions
    const result = await thematicDirectionGenerator.generateDirections(
      'test-concept-123',
      testCharacterConcept
    );

    // Verify the HTTP client was called
    expect(mockHttpClient.request).toHaveBeenCalledTimes(1);

    // Verify that the request was made with the custom tool schema through the ConfigurableLLMAdapter
    // We don't need to check the exact HTTP request structure since that's handled by the adapter

    // Verify the result structure
    expect(result).toHaveLength(3);

    // Verify each direction has the expected structure
    result.forEach((direction) => {
      expect(direction).toHaveProperty('title');
      expect(direction).toHaveProperty('description');
      expect(direction).toHaveProperty('coreTension');
      expect(direction).toHaveProperty('uniqueTwist');
      expect(direction).toHaveProperty('narrativePotential');
      expect(direction).toHaveProperty('id');
      expect(direction).toHaveProperty('conceptId');
      expect(direction).toHaveProperty('createdAt');
      expect(direction).toHaveProperty('llmMetadata');
    });

    // Verify logging shows custom schema usage
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Using custom tool schema from request options'),
      expect.objectContaining({
        llmId: 'character-builder-llm',
        schemaProperties: expect.arrayContaining(['thematicDirections']),
      })
    );
  });

  it('should include concept metadata in the result', async () => {
    // Initialize LLM adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });

    // Generate thematic directions with specific options
    const options = {
      conceptId: 'test-concept-123',
      llmConfigId: 'character-builder-llm',
    };

    const result = await thematicDirectionGenerator.generateDirections(
      options.conceptId,
      testCharacterConcept,
      options
    );

    // Verify result is an array of directions
    expect(result).toHaveLength(3);

    // Verify each direction has proper structure and metadata
    result.forEach((direction) => {
      expect(direction).toHaveProperty('conceptId', 'test-concept-123');
      expect(direction).toHaveProperty('llmMetadata');
      expect(direction.llmMetadata).toHaveProperty(
        'modelId',
        'character-builder-llm'
      );
    });
  });

  it('should handle response parsing and validation correctly', async () => {
    // Initialize LLM adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });

    // Generate thematic directions
    const result = await thematicDirectionGenerator.generateDirections(
      'test-concept-456',
      testCharacterConcept
    );

    // Verify the response was properly parsed and validated
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'The Price of Playing God',
          description: expect.stringContaining('ethical implications'),
          coreTension: 'Scientific ambition versus ethical responsibility',
        }),
        expect.objectContaining({
          title: 'Identity in Fragments',
          description: expect.stringContaining('fragmented identity'),
          coreTension: 'Personal identity versus inherited memories',
        }),
        expect.objectContaining({
          title: "The Puppet Master's Dilemma",
          description: expect.stringContaining('consciousness manipulation'),
          coreTension: 'Power and control versus freedom and autonomy',
        }),
      ])
    );
  });

  it('should use specific LLM configuration when provided', async () => {
    // Initialize LLM adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });

    const specificConfigId = 'custom-character-builder-llm';
    const specificConfig = {
      ...baseConfig,
      configId: specificConfigId,
      displayName: 'Custom Character Builder LLM',
    };

    // Mock the specific configuration
    mockConfigurationManager.loadConfiguration.mockResolvedValue(
      specificConfig
    );
    mockConfigurationManager.setActiveConfiguration.mockResolvedValue(true);
    mockConfigurationManager.getActiveConfiguration.mockResolvedValue(
      specificConfig
    );

    // Generate with specific LLM config
    await thematicDirectionGenerator.generateDirections(
      'test-concept-789',
      testCharacterConcept,
      { llmConfigId: specificConfigId }
    );

    // Verify the correct configuration was set
    expect(
      mockConfigurationManager.setActiveConfiguration
    ).toHaveBeenCalledWith(specificConfigId);
  });

  it('should handle LLM request failures gracefully', async () => {
    // Initialize LLM adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });

    // Mock HTTP client to fail
    mockHttpClient.request.mockRejectedValue(new Error('LLM request failed'));

    // Should throw ThematicDirectionGenerationError
    await expect(
      thematicDirectionGenerator.generateDirections(
        'test-concept-error',
        testCharacterConcept
      )
    ).rejects.toThrow(ThematicDirectionGenerationError);

    await expect(
      thematicDirectionGenerator.generateDirections(
        'test-concept-error2',
        testCharacterConcept
      )
    ).rejects.toThrow('LLM request failed');
  });

  it('should handle invalid character concept input', async () => {
    // Initialize LLM adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });

    // Test with empty string
    await expect(
      thematicDirectionGenerator.generateDirections('concept-test', '')
    ).rejects.toThrow('characterConcept must be a non-empty string');

    // Test with null
    await expect(
      thematicDirectionGenerator.generateDirections('concept-test', null)
    ).rejects.toThrow('characterConcept must be a non-empty string');

    // Test with undefined
    await expect(
      thematicDirectionGenerator.generateDirections('concept-test', undefined)
    ).rejects.toThrow('characterConcept must be a non-empty string');

    // Test with empty conceptId
    await expect(
      thematicDirectionGenerator.generateDirections('', testCharacterConcept)
    ).rejects.toThrow('conceptId must be a non-empty string');

    // Test with null conceptId
    await expect(
      thematicDirectionGenerator.generateDirections(null, testCharacterConcept)
    ).rejects.toThrow('conceptId must be a non-empty string');
  });

  it('should handle malformed LLM responses', async () => {
    // Initialize LLM adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });

    // Mock malformed response
    mockHttpClient.request.mockResolvedValue({
      choices: [
        {
          message: {
            tool_calls: [
              {
                type: 'function',
                function: {
                  name: 'generate_thematic_directions',
                  arguments: JSON.stringify({
                    // Missing required thematicDirections array
                    invalidField: 'invalid data',
                  }),
                },
              },
            ],
          },
        },
      ],
    });

    // Should throw error due to invalid response structure
    await expect(
      thematicDirectionGenerator.generateDirections(
        'test-concept-malformed',
        testCharacterConcept
      )
    ).rejects.toThrow(ThematicDirectionGenerationError);
  });

  it('should validate response against custom schema requirements', async () => {
    // Initialize LLM adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });

    // Mock response with invalid schema (missing required fields)
    const invalidResponse = {
      thematicDirections: [
        {
          title: 'Invalid Direction',
          // Missing required fields: description, coreTension, uniqueTwist, narrativePotential
        },
      ],
    };

    mockHttpClient.request.mockResolvedValue({
      choices: [
        {
          message: {
            tool_calls: [
              {
                type: 'function',
                function: {
                  name: 'generate_thematic_directions',
                  arguments: JSON.stringify(invalidResponse),
                },
              },
            ],
          },
        },
      ],
    });

    // Should throw validation error
    await expect(
      thematicDirectionGenerator.generateDirections(
        'test-concept-invalid',
        testCharacterConcept
      )
    ).rejects.toThrow(ThematicDirectionGenerationError);
  });

  it('should log detailed information about the generation process', async () => {
    // Initialize LLM adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });

    await thematicDirectionGenerator.generateDirections(
      'test-concept-logging',
      testCharacterConcept
    );

    // Verify key logging points
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'ThematicDirectionGenerator: Built prompt',
      expect.objectContaining({
        promptLength: expect.any(Number),
      })
    );

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'ThematicDirectionGenerator: Received LLM response',
      expect.objectContaining({
        responseLength: expect.any(Number),
        modelId: 'character-builder-llm',
      })
    );
  });

  it('should properly integrate with ConfigurableLLMAdapter request options flow', async () => {
    // Initialize LLM adapter
    await configurableLLMAdapter.init({ llmConfigLoader: mockLlmConfigLoader });

    // Spy on ConfigurableLLMAdapter to verify request options are passed correctly
    const getAIDecisionSpy = jest.spyOn(
      configurableLLMAdapter,
      'getAIDecision'
    );

    await thematicDirectionGenerator.generateDirections(
      'test-concept-flow',
      testCharacterConcept
    );

    // Verify ConfigurableLLMAdapter was called with correct request options
    expect(getAIDecisionSpy).toHaveBeenCalledWith(
      expect.stringContaining('character concept'),
      null, // abort signal
      expect.objectContaining({
        toolSchema: THEMATIC_DIRECTIONS_RESPONSE_SCHEMA,
        toolName: 'generate_thematic_directions',
        toolDescription:
          'Generate thematic directions for character development based on the provided concept',
      })
    );
  });
});
