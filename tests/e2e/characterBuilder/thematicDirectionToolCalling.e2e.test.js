/**
 * @file End-to-end test for Character Builder Thematic Direction Tool Calling
 * @description Complete user workflow testing from concept input to thematic direction output using custom tool schemas
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ThematicDirectionGenerator } from '../../../src/characterBuilder/services/thematicDirectionGenerator.js';
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

describe('Character Builder Thematic Direction Tool Calling - E2E', () => {
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

  // Test data representing real-world character concepts
  const testScenarios = [
    {
      name: 'Complex Scientist Character',
      concept:
        'A brilliant but morally ambiguous quantum physicist who discovers a way to manipulate probability itself, but each use of this power fractures their sense of reality',
      expectedDirections: 3,
      expectedThemes: [
        'reality vs illusion',
        'scientific responsibility',
        'power corruption',
      ],
    },
    {
      name: 'Simple Adventurer Character',
      concept:
        'A cheerful baker who dreams of adventure but is afraid to leave their small village',
      expectedDirections: 4,
      expectedThemes: ['comfort vs growth', 'dreams vs reality', 'courage'],
    },
    {
      name: 'Mysterious Character',
      concept:
        'An immortal librarian who has witnessed the rise and fall of civilizations, now questioning whether knowledge is worth eternal loneliness',
      expectedDirections: 5,
      expectedThemes: [
        'knowledge vs wisdom',
        'immortality curse',
        'isolation vs connection',
      ],
    },
  ];

  const mockValidToolCallingResponse = {
    choices: [
      {
        message: {
          tool_calls: [
            {
              type: 'function',
              function: {
                name: 'generate_thematic_directions',
                arguments: JSON.stringify({
                  thematicDirections: [
                    {
                      title: 'The Weight of Knowledge',
                      description:
                        'A character burdened by understanding truths that others cannot comprehend, struggling with the isolation that comes from seeing beyond the veil of ordinary reality.',
                      coreTension: 'Enlightenment versus belonging',
                      uniqueTwist:
                        'Their knowledge grows stronger when they try to forget it',
                      narrativePotential:
                        'Explores themes of responsibility, isolation, and the price of awareness in complex moral scenarios',
                    },
                    {
                      title: 'The Fractured Mirror',
                      description:
                        'A character whose actions create ripple effects across multiple realities, forcing them to confront different versions of themselves and their choices.',
                      coreTension: 'Identity versus multiplicity',
                      uniqueTwist:
                        'Each decision splits them across dimensional boundaries',
                      narrativePotential:
                        'Enables exploration of choice, consequence, and self-identity through parallel narrative threads',
                    },
                    {
                      title: 'The Probability Paradox',
                      description:
                        'A character who can influence chance itself but discovers that eliminating randomness from their life removes all meaning and spontaneity.',
                      coreTension: 'Control versus serendipity',
                      uniqueTwist:
                        'Perfect control leads to perfect meaninglessness',
                      narrativePotential:
                        'Creates opportunities for stories about fate, free will, and the beauty of unpredictability',
                    },
                  ],
                }),
              },
            },
          ],
        },
      },
    ],
  };

  const baseConfig = {
    configId: 'e2e-character-builder-llm',
    displayName: 'E2E Character Builder LLM',
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

    // Create mock HTTP client that returns valid tool calling responses
    mockHttpClient = {
      request: jest.fn().mockResolvedValue(mockValidToolCallingResponse),
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
      getKey: jest.fn().mockResolvedValue('test-e2e-api-key'),
    };

    // Create mock configuration loader
    mockLlmConfigLoader = {
      loadConfigs: jest.fn().mockResolvedValue({
        defaultConfigId: 'e2e-character-builder-llm',
        configs: {
          'e2e-character-builder-llm': baseConfig,
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

  describe('Complete User Workflow', () => {
    it('should handle complete character concept to thematic directions workflow', async () => {
      // Initialize the system
      await configurableLLMAdapter.init({
        llmConfigLoader: mockLlmConfigLoader,
      });

      const testConcept = testScenarios[0].concept;
      const conceptId = 'e2e-test-concept-001';

      // Execute the complete workflow
      const result = await thematicDirectionGenerator.generateDirections(
        conceptId,
        testConcept
      );

      // Verify the complete workflow executed successfully
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);

      // Verify each direction has the expected structure
      result.forEach((direction, index) => {
        expect(direction).toHaveProperty('conceptId', conceptId);
        expect(direction).toHaveProperty('title');
        expect(direction).toHaveProperty('description');
        expect(direction).toHaveProperty('coreTension');
        expect(direction).toHaveProperty('uniqueTwist');
        expect(direction).toHaveProperty('narrativePotential');
        expect(direction).toHaveProperty('createdAt');
        expect(direction).toHaveProperty('llmMetadata');

        // Verify string length requirements are met
        expect(direction.title.length).toBeGreaterThanOrEqual(5);
        expect(direction.description.length).toBeGreaterThanOrEqual(50);
        expect(direction.coreTension.length).toBeGreaterThanOrEqual(20);
        expect(direction.uniqueTwist.length).toBeGreaterThanOrEqual(20);
        expect(direction.narrativePotential.length).toBeGreaterThanOrEqual(30);
      });

      // Verify HTTP request used custom schema
      expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
      const [requestUrl, requestOptions] = mockHttpClient.request.mock.calls[0];
      const requestPayload = JSON.parse(requestOptions.body);
      expect(requestPayload.tools).toHaveLength(1);
      expect(requestPayload.tools[0].function.name).toBe(
        'generate_thematic_directions'
      );
      expect(requestPayload.tools[0].function.parameters).toEqual(
        THEMATIC_DIRECTIONS_RESPONSE_SCHEMA
      );
    });

    it('should handle multiple character concepts with different complexity levels', async () => {
      // Initialize the system
      await configurableLLMAdapter.init({
        llmConfigLoader: mockLlmConfigLoader,
      });

      // Test multiple scenarios
      for (const scenario of testScenarios) {
        const conceptId = `e2e-test-${scenario.name.toLowerCase().replace(/\s+/g, '-')}`;

        // Customize the response based on expected directions count
        const customResponse = {
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    type: 'function',
                    function: {
                      name: 'generate_thematic_directions',
                      arguments: JSON.stringify({
                        thematicDirections: Array.from(
                          { length: scenario.expectedDirections },
                          (_, i) => ({
                            title: `${scenario.name} Direction ${i + 1}`,
                            description: `This is a detailed description for thematic direction ${i + 1} of the ${scenario.name.toLowerCase()} concept. It provides sufficient context to meet the minimum character requirements for validation.`,
                            coreTension: `Core tension ${i + 1} for ${scenario.name}`,
                            uniqueTwist: `Unique twist ${i + 1} that makes this direction distinctive`,
                            narrativePotential: `This direction offers rich narrative potential for storytelling with themes of ${scenario.expectedThemes.join(', ')} and character development opportunities`,
                          })
                        ),
                      }),
                    },
                  },
                ],
              },
            },
          ],
        };

        mockHttpClient.request.mockResolvedValueOnce(customResponse);

        const result = await thematicDirectionGenerator.generateDirections(
          conceptId,
          scenario.concept
        );

        expect(result).toHaveLength(scenario.expectedDirections);
        expect(result[0]).toHaveProperty('conceptId', conceptId);
      }

      // Verify all HTTP requests used the custom schema
      expect(mockHttpClient.request).toHaveBeenCalledTimes(
        testScenarios.length
      );
    });
  });

  describe('API Request Validation', () => {
    it('should verify API requests contain correct custom tool schema', async () => {
      // Initialize the system
      await configurableLLMAdapter.init({
        llmConfigLoader: mockLlmConfigLoader,
      });

      await thematicDirectionGenerator.generateDirections(
        'validation-test',
        'Test concept for schema validation'
      );

      // Verify the API request structure
      expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
      const [requestUrl, requestOptions] = mockHttpClient.request.mock.calls[0];
      const requestPayload = JSON.parse(requestOptions.body);

      // Verify request method and endpoint
      expect(requestOptions.method).toBe('POST');
      expect(requestUrl).toBe(baseConfig.endpointUrl);

      // Verify request headers
      expect(requestOptions.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-e2e-api-key',
      });

      // Verify tool calling structure
      expect(requestPayload).toHaveProperty('tools');
      expect(requestPayload).toHaveProperty('tool_choice');
      expect(requestPayload.tools).toHaveLength(1);

      const tool = requestPayload.tools[0];
      expect(tool).toEqual({
        type: 'function',
        function: {
          name: 'generate_thematic_directions',
          description:
            'Generate thematic directions for character development based on the provided concept',
          parameters: THEMATIC_DIRECTIONS_RESPONSE_SCHEMA,
        },
      });

      // Verify tool choice
      expect(requestPayload.tool_choice).toEqual({
        type: 'function',
        function: { name: 'generate_thematic_directions' },
      });
    });

    it('should handle API request with proper prompt formatting', async () => {
      // Initialize the system
      await configurableLLMAdapter.init({
        llmConfigLoader: mockLlmConfigLoader,
      });

      const testConcept =
        'A complex character concept for testing prompt formatting';
      await thematicDirectionGenerator.generateDirections(
        'prompt-test',
        testConcept
      );

      const [requestUrl, requestOptions] = mockHttpClient.request.mock.calls[0];
      const requestPayload = JSON.parse(requestOptions.body);
      const messages = requestPayload.messages;

      // Verify prompt structure
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);

      // Find the user message containing our concept
      const userMessage = messages.find(
        (msg) => msg.role === 'user' && msg.content.includes(testConcept)
      );
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toContain('<character_concept>');
      expect(userMessage.content).toContain(testConcept);
      expect(userMessage.content).toContain('</character_concept>');
    });
  });

  describe('Response Parsing and Validation', () => {
    it('should parse and validate tool calling responses correctly', async () => {
      // Initialize the system
      await configurableLLMAdapter.init({
        llmConfigLoader: mockLlmConfigLoader,
      });

      const result = await thematicDirectionGenerator.generateDirections(
        'parsing-test',
        'Test concept for response parsing'
      );

      // Verify the response was correctly parsed
      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('The Weight of Knowledge');
      expect(result[1].title).toBe('The Fractured Mirror');
      expect(result[2].title).toBe('The Probability Paradox');

      // Verify all required fields are present and valid
      result.forEach((direction) => {
        expect(direction.title).toMatch(/^.{5,100}$/);
        expect(direction.description).toMatch(/^.{50,500}$/);
        expect(direction.coreTension).toMatch(/^.{20,200}$/);
        expect(direction.uniqueTwist).toMatch(/^.{20,200}$/);
        expect(direction.narrativePotential).toMatch(/^.{30,300}$/);
      });
    });

    it('should handle malformed API responses gracefully', async () => {
      // Initialize the system
      await configurableLLMAdapter.init({
        llmConfigLoader: mockLlmConfigLoader,
      });

      // Mock malformed response
      const malformedResponse = {
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
                      invalidField: 'This should cause validation to fail',
                    }),
                  },
                },
              ],
            },
          },
        ],
      };

      mockHttpClient.request.mockResolvedValueOnce(malformedResponse);

      // Should handle malformed response gracefully
      await expect(
        thematicDirectionGenerator.generateDirections(
          'malformed-test',
          'Test concept'
        )
      ).rejects.toThrow('Invalid response structure');
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle network failures with appropriate error messages', async () => {
      // Initialize the system
      await configurableLLMAdapter.init({
        llmConfigLoader: mockLlmConfigLoader,
      });

      // Mock network failure
      mockHttpClient.request.mockRejectedValueOnce(
        new Error('Network timeout')
      );

      await expect(
        thematicDirectionGenerator.generateDirections(
          'network-error-test',
          'Test concept'
        )
      ).rejects.toThrow('LLM request failed');
    });

    it('should handle API authentication failures', async () => {
      // Initialize the system
      await configurableLLMAdapter.init({
        llmConfigLoader: mockLlmConfigLoader,
      });

      // Mock authentication failure
      mockHttpClient.request.mockRejectedValueOnce({
        response: { status: 401, statusText: 'Unauthorized' },
      });

      await expect(
        thematicDirectionGenerator.generateDirections(
          'auth-error-test',
          'Test concept'
        )
      ).rejects.toThrow('LLM request failed');
    });

    it('should handle API rate limiting gracefully', async () => {
      // Initialize the system
      await configurableLLMAdapter.init({
        llmConfigLoader: mockLlmConfigLoader,
      });

      // Mock rate limiting response
      mockHttpClient.request.mockRejectedValueOnce({
        response: {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'retry-after': '60' },
        },
      });

      await expect(
        thematicDirectionGenerator.generateDirections(
          'rate-limit-test',
          'Test concept'
        )
      ).rejects.toThrow('LLM request failed');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should complete requests within reasonable time limits', async () => {
      // Initialize the system
      await configurableLLMAdapter.init({
        llmConfigLoader: mockLlmConfigLoader,
      });

      const startTime = Date.now();
      await thematicDirectionGenerator.generateDirections(
        'performance-test',
        'Test concept for performance measurement'
      );
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      // Should complete within 5 seconds (generous for E2E test)
      expect(executionTime).toBeLessThan(5000);
    });

    it('should handle concurrent requests appropriately', async () => {
      // Initialize the system
      await configurableLLMAdapter.init({
        llmConfigLoader: mockLlmConfigLoader,
      });

      // Execute multiple concurrent requests
      const promises = [
        thematicDirectionGenerator.generateDirections(
          'concurrent-1',
          'First concurrent concept'
        ),
        thematicDirectionGenerator.generateDirections(
          'concurrent-2',
          'Second concurrent concept'
        ),
        thematicDirectionGenerator.generateDirections(
          'concurrent-3',
          'Third concurrent concept'
        ),
      ];

      const results = await Promise.all(promises);

      // All requests should succeed
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThanOrEqual(3);
      });

      // Should have made 3 separate HTTP requests
      expect(mockHttpClient.request).toHaveBeenCalledTimes(3);
    });
  });

  describe('Configuration Management', () => {
    it('should use different LLM configurations when specified', async () => {
      // Initialize the system
      await configurableLLMAdapter.init({
        llmConfigLoader: mockLlmConfigLoader,
      });

      const customConfigId = 'custom-e2e-character-builder-llm';
      const customConfig = {
        ...baseConfig,
        configId: customConfigId,
        modelIdentifier: 'anthropic/claude-3-haiku', // Different model
        displayName: 'Custom E2E Character Builder LLM',
      };

      // Mock custom configuration
      mockConfigurationManager.loadConfiguration.mockResolvedValue(
        customConfig
      );
      mockConfigurationManager.setActiveConfiguration.mockResolvedValue(true);
      mockConfigurationManager.getActiveConfiguration.mockResolvedValue(
        customConfig
      );

      const result = await thematicDirectionGenerator.generateDirections(
        'custom-config-test',
        'Test concept with custom configuration',
        { llmConfigId: customConfigId }
      );

      // Should succeed with custom configuration
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Verify configuration was set correctly
      expect(
        mockConfigurationManager.setActiveConfiguration
      ).toHaveBeenCalledWith(customConfigId);
    });
  });
});
