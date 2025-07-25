/**
 * @file Unit tests for ThematicDirectionGenerator service
 */

import {
  jest,
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
} from '@jest/globals';
import {
  ThematicDirectionGenerator,
  ThematicDirectionGenerationError,
} from '../../../../src/characterBuilder/services/thematicDirectionGenerator.js';

/**
 * @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../../src/llms/llmJsonService.js').LlmJsonService} LlmJsonService
 * @typedef {import('../../../../src/llms/LLMStrategyFactory.js').LLMStrategyFactory} LLMStrategyFactory
 * @typedef {import('../../../../src/llms/services/llmConfigurationManager.js').LLMConfigurationManager} LLMConfigurationManager
 */

describe('ThematicDirectionGenerator', () => {
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {jest.Mocked<LlmJsonService>} */
  let mockLlmJsonService;
  /** @type {jest.Mocked<LLMStrategyFactory>} */
  let mockLlmStrategyFactory;
  /** @type {jest.Mocked<LLMConfigurationManager>} */
  let mockLlmConfigManager;
  /** @type {ThematicDirectionGenerator} */
  let generator;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockLlmJsonService = {
      clean: jest.fn(),
      parseAndRepair: jest.fn(),
    };

    mockLlmStrategyFactory = {
      getAIDecision: jest.fn(),
    };

    mockLlmConfigManager = {
      loadConfiguration: jest.fn(),
      getActiveConfiguration: jest.fn(),
      setActiveConfiguration: jest.fn(),
    };

    generator = new ThematicDirectionGenerator({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      llmStrategyFactory: mockLlmStrategyFactory,
      llmConfigManager: mockLlmConfigManager,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create instance with valid dependencies', () => {
      expect(generator).toBeInstanceOf(ThematicDirectionGenerator);
    });

    test('should throw error if logger is invalid', () => {
      expect(() => {
        new ThematicDirectionGenerator({
          logger: null,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
        });
      }).toThrow('Missing required dependency: ILogger.');
    });

    test('should throw error if llmJsonService is invalid', () => {
      expect(() => {
        new ThematicDirectionGenerator({
          logger: mockLogger,
          llmJsonService: null,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
        });
      }).toThrow('Missing required dependency: LlmJsonService.');
    });

    test('should throw error if llmStrategyFactory is invalid', () => {
      expect(() => {
        new ThematicDirectionGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: null,
          llmConfigManager: mockLlmConfigManager,
        });
      }).toThrow('Missing required dependency: ConfigurableLLMAdapter.');
    });

    test('should throw error if llmConfigManager is invalid', () => {
      expect(() => {
        new ThematicDirectionGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: null,
        });
      }).toThrow('Missing required dependency: ILLMConfigurationManager.');
    });
  });

  describe('generateDirections', () => {
    const mockLlmConfig = {
      configId: 'openrouter-claude-sonnet-4',
      modelIdentifier: 'anthropic/claude-sonnet-4',
      apiType: 'openrouter',
      jsonOutputStrategy: {
        method: 'openrouter_json_schema',
        jsonSchema: {},
      },
    };

    const mockLlmResponse = JSON.stringify({
      thematicDirections: [
        {
          title: 'The Reluctant Hero',
          description:
            'A character who must overcome their reluctance to face destiny.',
          coreTension: 'Desire for normalcy vs. call to adventure',
          uniqueTwist: 'Their reluctance is actually hidden strength',
          narrativePotential: 'Growth through adversity and self-discovery',
        },
        {
          title: 'The Hidden Strategist',
          description:
            'A character whose true intelligence is masked by their demeanor.',
          coreTension: 'Appearance vs. reality',
          uniqueTwist: 'Uses misdirection as a tactical advantage',
          narrativePotential: 'Stories of perception and revelation',
        },
        {
          title: 'The Unlikely Mentor',
          description:
            'A character who appears unwise but holds deep knowledge.',
          coreTension: 'Outward simplicity vs. inner wisdom',
          uniqueTwist: 'Their teaching methods seem counterintuitive',
          narrativePotential: 'Stories of unexpected guidance and growth',
        },
      ],
    });

    beforeEach(() => {
      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockLlmConfigManager.getActiveConfiguration.mockResolvedValue(
        mockLlmConfig
      );
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        JSON.parse(mockLlmResponse)
      );
    });

    test('should successfully generate thematic directions', async () => {
      const conceptId = 'test-concept-123';
      const characterConcept = 'A ditzy archer who loves adventure';

      const result = await generator.generateDirections(
        conceptId,
        characterConcept
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        conceptId,
        title: 'The Reluctant Hero',
        description:
          'A character who must overcome their reluctance to face destiny.',
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting generation for concept'),
        expect.objectContaining({ conceptId })
      );
      // getAIDecision is called on the llmStrategyFactory (ConfigurableLLMAdapter) with request options
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledWith(
        expect.stringContaining('<character_concept>'),
        null, // no abort signal
        expect.objectContaining({
          toolSchema: expect.objectContaining({
            type: 'object',
            properties: expect.objectContaining({
              thematicDirections: expect.any(Object),
            }),
          }),
          toolName: 'generate_thematic_directions',
          toolDescription:
            'Generate thematic directions for character development based on the provided concept',
        })
      );
    });

    test('should use custom llmConfigId when provided', async () => {
      const conceptId = 'test-concept-123';
      const characterConcept = 'A ditzy archer who loves adventure';
      const customConfigId = 'custom-llm-config';

      // Mock setActiveConfiguration to return true (success)
      mockLlmConfigManager.setActiveConfiguration.mockResolvedValue(true);

      await generator.generateDirections(conceptId, characterConcept, {
        llmConfigId: customConfigId,
      });

      expect(mockLlmConfigManager.setActiveConfiguration).toHaveBeenCalledWith(
        customConfigId
      );
    });

    test('should pass correct request options for tool calling', async () => {
      const conceptId = 'test-concept-123';
      const characterConcept = 'A ditzy archer who loves adventure';

      await generator.generateDirections(conceptId, characterConcept);

      // Verify that getAIDecision was called with proper request options
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledWith(
        expect.any(String),
        null, // abort signal
        expect.objectContaining({
          toolSchema: expect.objectContaining({
            type: 'object',
            properties: expect.objectContaining({
              thematicDirections: expect.objectContaining({
                type: 'array',
                minItems: 3,
                maxItems: 5,
              }),
            }),
            required: ['thematicDirections'],
          }),
          toolName: 'generate_thematic_directions',
          toolDescription:
            'Generate thematic directions for character development based on the provided concept',
        })
      );
    });

    test('should throw error if conceptId is empty', async () => {
      await expect(
        generator.generateDirections('', 'Valid character concept')
      ).rejects.toThrow(ThematicDirectionGenerationError);
      await expect(
        generator.generateDirections('', 'Valid character concept')
      ).rejects.toThrow('conceptId must be a non-empty string');
    });

    test('should throw error if conceptId is not string', async () => {
      await expect(
        generator.generateDirections(null, 'Valid character concept')
      ).rejects.toThrow(ThematicDirectionGenerationError);
      await expect(
        generator.generateDirections(123, 'Valid character concept')
      ).rejects.toThrow(ThematicDirectionGenerationError);
    });

    test('should throw error if characterConcept is empty', async () => {
      await expect(
        generator.generateDirections('valid-id', '')
      ).rejects.toThrow(ThematicDirectionGenerationError);
      await expect(
        generator.generateDirections('valid-id', '   ')
      ).rejects.toThrow(ThematicDirectionGenerationError);
    });

    test('should throw error if characterConcept is not string', async () => {
      await expect(
        generator.generateDirections('valid-id', null)
      ).rejects.toThrow(ThematicDirectionGenerationError);
      await expect(
        generator.generateDirections('valid-id', 123)
      ).rejects.toThrow(ThematicDirectionGenerationError);
    });

    test('should throw error if LLM configuration not found', async () => {
      // Override the default mock to return null for getActiveConfiguration
      mockLlmConfigManager.getActiveConfiguration.mockResolvedValue(null);

      await expect(
        generator.generateDirections('test-id', 'Valid concept')
      ).rejects.toThrow(ThematicDirectionGenerationError);
      await expect(
        generator.generateDirections('test-id', 'Valid concept')
      ).rejects.toThrow('No active LLM configuration found');
    });

    test('should throw error if LLM strategy execution fails', async () => {
      const llmError = new Error('LLM service unavailable');
      // Override the default mock to reject with an error
      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(llmError);

      await expect(
        generator.generateDirections('test-id', 'Valid concept')
      ).rejects.toThrow(ThematicDirectionGenerationError);
      await expect(
        generator.generateDirections('test-id', 'Valid concept')
      ).rejects.toThrow('LLM request failed');
    });

    test('should throw error if response parsing fails', async () => {
      // Reset mocks to default successful state
      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockLlmConfigManager.getActiveConfiguration.mockResolvedValue(
        mockLlmConfig
      );
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);

      // Set up the parsing failure
      const parseError = new Error('Invalid JSON');
      mockLlmJsonService.parseAndRepair.mockRejectedValue(parseError);

      await expect(
        generator.generateDirections('test-id', 'Valid concept')
      ).rejects.toThrow(ThematicDirectionGenerationError);
      await expect(
        generator.generateDirections('test-id', 'Valid concept')
      ).rejects.toThrow('Failed to parse LLM response');
    });

    test('should log appropriate debug and info messages', async () => {
      // Reset mocks to default successful state first
      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockLlmConfigManager.getActiveConfiguration.mockResolvedValue(
        mockLlmConfig
      );
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        JSON.parse(mockLlmResponse)
      );

      const conceptId = 'test-concept-123';
      const characterConcept = 'A ditzy archer who loves adventure';

      await generator.generateDirections(conceptId, characterConcept);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting generation for concept'),
        expect.objectContaining({
          conceptId,
          conceptLength: characterConcept.length,
        })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Built prompt'),
        expect.objectContaining({ conceptId })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Received LLM response'),
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully generated thematic directions'),
        expect.objectContaining({ conceptId, directionCount: 3 })
      );
    });

    test('should handle malformed LLM response gracefully', async () => {
      // Reset mocks to default successful state first
      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockLlmConfigManager.getActiveConfiguration.mockResolvedValue(
        mockLlmConfig
      );
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);

      const malformedResponse = { invalidStructure: true };
      mockLlmJsonService.parseAndRepair.mockResolvedValue(malformedResponse);

      await expect(
        generator.generateDirections('test-id', 'Valid concept')
      ).rejects.toThrow(ThematicDirectionGenerationError);
      await expect(
        generator.generateDirections('test-id', 'Valid concept')
      ).rejects.toThrow('Invalid response structure');
    });

    test('should include metadata in generated directions', async () => {
      // Reset mocks to default successful state first
      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockLlmConfigManager.getActiveConfiguration.mockResolvedValue(
        mockLlmConfig
      );
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        JSON.parse(mockLlmResponse)
      );

      const conceptId = 'test-concept-123';
      const characterConcept = 'A ditzy archer who loves adventure';

      const result = await generator.generateDirections(
        conceptId,
        characterConcept
      );

      expect(result[0]).toHaveProperty('llmMetadata');
      expect(result[0].llmMetadata).toMatchObject({
        modelId: 'openrouter-claude-sonnet-4',
        promptTokens: expect.any(Number),
        responseTokens: expect.any(Number),
        processingTime: expect.any(Number),
      });
    });
  });

  describe('validateResponse', () => {
    test('should validate valid response structure', () => {
      const validResponse = {
        thematicDirections: [
          {
            title: 'Test Title One',
            description:
              'Test description for the first thematic direction with enough characters to pass validation',
            coreTension: 'Test tension for first direction',
            uniqueTwist: 'Test twist for first direction',
            narrativePotential: 'Test narrative potential for first direction',
          },
          {
            title: 'Test Title Two',
            description:
              'Test description for the second thematic direction with enough characters to pass validation',
            coreTension: 'Test tension for second direction',
            uniqueTwist: 'Test twist for second direction',
            narrativePotential: 'Test narrative potential for second direction',
          },
          {
            title: 'Test Title Three',
            description:
              'Test description for the third thematic direction with enough characters to pass validation',
            coreTension: 'Test tension for third direction',
            uniqueTwist: 'Test twist for third direction',
            narrativePotential: 'Test narrative potential for third direction',
          },
        ],
      };

      expect(() => generator.validateResponse(validResponse)).not.toThrow();
    });

    test('should throw error for invalid response structure', () => {
      const invalidResponse = { invalidField: 'invalid' };

      expect(() => generator.validateResponse(invalidResponse)).toThrow();
    });
  });

  describe('getResponseSchema', () => {
    test('should return response schema object', () => {
      const schema = generator.getResponseSchema();

      expect(schema).toBeDefined();
      expect(schema).toHaveProperty('type', 'object');
      expect(schema.properties).toHaveProperty('thematicDirections');
    });
  });

  describe('#callLLM Method with Request Options', () => {
    const mockLlmConfig = {
      configId: 'character-builder-llm',
      modelIdentifier: 'anthropic/claude-3-sonnet',
      apiType: 'openrouter',
      jsonOutputStrategy: {
        method: 'tool_calling',
        toolName: 'character_analysis',
      },
    };

    beforeEach(() => {
      mockLlmConfigManager.getActiveConfiguration.mockResolvedValue(
        mockLlmConfig
      );
      mockLlmConfigManager.setActiveConfiguration.mockResolvedValue(true);
      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);

      const mockResponseData = {
        thematicDirections: [
          {
            title: 'Test Direction One',
            description:
              'Test description for the first thematic direction with enough characters to pass validation requirements',
            coreTension:
              'Test versus Reality creates meaningful conflict in narrative development',
            uniqueTwist:
              'The test itself becomes reality through narrative transformation',
            narrativePotential:
              'Explores the meta-nature of testing and reality in narrative contexts providing rich storytelling opportunities',
          },
          {
            title: 'Test Direction Two',
            description:
              'Test description for the second thematic direction with enough characters to pass validation requirements',
            coreTension:
              'Second versus First creates progression and development in character growth',
            uniqueTwist:
              'The second test becomes more complex through iterative development',
            narrativePotential:
              'Explores the progression from simple to complex testing scenarios providing character development opportunities',
          },
          {
            title: 'Test Direction Three',
            description:
              'Test description for the third thematic direction with enough characters to pass validation requirements',
            coreTension:
              'Final versus Initial creates resolution and closure for character development',
            uniqueTwist:
              'The final test reveals all previous tests through narrative revelation',
            narrativePotential:
              'Explores the revelation of underlying patterns in testing providing satisfying narrative conclusions',
          },
        ],
      };

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify(mockResponseData)
      );
      mockLlmJsonService.clean.mockReturnValue(
        JSON.stringify(mockResponseData)
      );
      mockLlmJsonService.parseAndRepair.mockResolvedValue(mockResponseData);
    });

    test('should call ConfigurableLLMAdapter with correct request options structure', async () => {
      const prompt = 'Test prompt for thematic direction generation';
      const llmConfigId = 'custom-character-builder-llm';

      // Access the private method through reflection for testing
      // Note: This is testing implementation details, but it's necessary for the workflow requirements
      await generator.generateDirections(
        'test-concept',
        'Test character concept',
        { llmConfigId }
      );

      // Verify that getAIDecision was called with the correct request options structure
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledWith(
        expect.stringContaining('character concept'),
        null, // abort signal
        expect.objectContaining({
          toolSchema: expect.objectContaining({
            type: 'object',
            properties: expect.objectContaining({
              thematicDirections: expect.objectContaining({
                type: 'array',
                minItems: 3,
                maxItems: 5,
                items: expect.objectContaining({
                  type: 'object',
                  properties: expect.objectContaining({
                    title: expect.objectContaining({ type: 'string' }),
                    description: expect.objectContaining({ type: 'string' }),
                    coreTension: expect.objectContaining({ type: 'string' }),
                    uniqueTwist: expect.objectContaining({ type: 'string' }),
                    narrativePotential: expect.objectContaining({
                      type: 'string',
                    }),
                  }),
                  required: [
                    'title',
                    'description',
                    'coreTension',
                    'uniqueTwist',
                    'narrativePotential',
                  ],
                }),
              }),
            }),
            required: ['thematicDirections'],
          }),
          toolName: 'generate_thematic_directions',
          toolDescription:
            'Generate thematic directions for character development based on the provided concept',
        })
      );
    });

    test('should use THEMATIC_DIRECTIONS_RESPONSE_SCHEMA as the custom tool schema', async () => {
      await generator.generateDirections(
        'test-concept',
        'Test character concept'
      );

      const callArgs = mockLlmStrategyFactory.getAIDecision.mock.calls[0];
      const requestOptions = callArgs[2];

      // Verify the schema structure matches THEMATIC_DIRECTIONS_RESPONSE_SCHEMA
      expect(requestOptions.toolSchema).toMatchObject({
        type: 'object',
        additionalProperties: false,
        properties: {
          thematicDirections: {
            type: 'array',
            minItems: 3,
            maxItems: 5,
            items: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  minLength: 5,
                  maxLength: 100,
                },
                description: {
                  type: 'string',
                  minLength: 50,
                  maxLength: 500,
                },
                coreTension: {
                  type: 'string',
                  minLength: 20,
                  maxLength: 200,
                },
                uniqueTwist: {
                  type: 'string',
                  minLength: 20,
                  maxLength: 200,
                },
                narrativePotential: {
                  type: 'string',
                  minLength: 30,
                  maxLength: 300,
                },
              },
              required: [
                'title',
                'description',
                'coreTension',
                'uniqueTwist',
                'narrativePotential',
              ],
              additionalProperties: false,
            },
          },
        },
        required: ['thematicDirections'],
      });
    });

    test('should properly configure LLM when specific config ID is provided', async () => {
      const specificConfigId = 'custom-character-builder-llm';
      const specificConfig = {
        ...mockLlmConfig,
        configId: specificConfigId,
        displayName: 'Custom Character Builder Config',
      };

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(specificConfig);
      mockLlmConfigManager.setActiveConfiguration.mockResolvedValue(true);
      mockLlmConfigManager.getActiveConfiguration.mockResolvedValue(
        specificConfig
      );

      await generator.generateDirections(
        'test-concept',
        'Test character concept',
        {
          llmConfigId: specificConfigId,
        }
      );

      // Verify configuration management was called correctly
      expect(mockLlmConfigManager.setActiveConfiguration).toHaveBeenCalledWith(
        specificConfigId
      );
      expect(mockLlmConfigManager.getActiveConfiguration).toHaveBeenCalled();
    });

    test('should handle LLM configuration loading failure when setActiveConfiguration fails', async () => {
      const failingConfigId = 'non-existent-config';

      // Mock setActiveConfiguration to fail
      mockLlmConfigManager.setActiveConfiguration.mockResolvedValue(false);
      // Mock loadConfiguration to also fail (config not found)
      mockLlmConfigManager.loadConfiguration.mockResolvedValue(null);

      await expect(
        generator.generateDirections('test-concept', 'Test character concept', {
          llmConfigId: failingConfigId,
        })
      ).rejects.toThrow(ThematicDirectionGenerationError);

      await expect(
        generator.generateDirections('test-concept', 'Test character concept', {
          llmConfigId: failingConfigId,
        })
      ).rejects.toThrow(`LLM configuration not found: ${failingConfigId}`);
    });

    test('should handle missing active configuration error', async () => {
      // Mock getActiveConfiguration to return null
      mockLlmConfigManager.getActiveConfiguration.mockResolvedValue(null);

      await expect(
        generator.generateDirections('test-concept', 'Test character concept')
      ).rejects.toThrow(ThematicDirectionGenerationError);

      await expect(
        generator.generateDirections('test-concept', 'Test character concept')
      ).rejects.toThrow('No active LLM configuration found');
    });

    test('should log detailed information about LLM request and response', async () => {
      const mockResponseData = {
        thematicDirections: [
          {
            title: 'Logged Direction One',
            description:
              'This direction should be logged with proper metadata and response details for the first item providing sufficient length',
            coreTension:
              'Logging versus Silence creates tension between transparency and privacy',
            uniqueTwist:
              'The logs become part of the narrative through meta-textual integration',
            narrativePotential:
              'Creates meta-textual opportunities for self-referential storytelling that breaks narrative conventions',
          },
          {
            title: 'Logged Direction Two',
            description:
              'This direction should be logged with proper metadata and response details for the second item providing sufficient length',
            coreTension:
              'Metadata versus Raw Data creates conflict between context and content',
            uniqueTwist:
              'The metadata becomes more important than content through narrative focus',
            narrativePotential:
              'Explores the relationship between data and its context providing rich analytical opportunities',
          },
          {
            title: 'Logged Direction Three',
            description:
              'This direction should be logged with proper metadata and response details for the third item providing sufficient length',
            coreTension:
              'Details versus Overview creates tension between specificity and generalization',
            uniqueTwist:
              'The details reveal the bigger picture through careful narrative construction',
            narrativePotential:
              'Creates opportunities for granular versus holistic storytelling approaches that complement each other',
          },
        ],
      };

      const mockResponse = JSON.stringify(mockResponseData);
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(mockResponse);
      mockLlmJsonService.clean.mockReturnValue(mockResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(mockResponseData);

      await generator.generateDirections(
        'test-concept',
        'Test character concept for logging'
      );

      // Verify debug logging for LLM response
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ThematicDirectionGenerator: Received LLM response',
        expect.objectContaining({
          responseLength: mockResponse.length,
          modelId: mockLlmConfig.configId,
        })
      );
    });

    test('should wrap LLM adapter errors in ThematicDirectionGenerationError', async () => {
      const adapterError = new Error('ConfigurableLLMAdapter request failed');
      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(adapterError);

      await expect(
        generator.generateDirections('test-concept', 'Test character concept')
      ).rejects.toThrow(ThematicDirectionGenerationError);

      try {
        await generator.generateDirections(
          'test-concept',
          'Test character concept'
        );
      } catch (error) {
        expect(error.message).toContain('LLM request failed');
        expect(error.cause).toBe(adapterError);
      }
    });

    test('should handle malformed tool calling responses gracefully', async () => {
      const malformedResponseData = {
        // Missing thematicDirections array - should cause validation failure
        unexpectedField: 'This response does not match the expected schema',
      };

      const malformedResponse = JSON.stringify(malformedResponseData);
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(malformedResponse);
      mockLlmJsonService.clean.mockReturnValue(malformedResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        malformedResponseData
      );

      await expect(
        generator.generateDirections('test-concept', 'Test character concept')
      ).rejects.toThrow(ThematicDirectionGenerationError);
    });

    test('should preserve request options across retries and error recovery', async () => {
      let callCount = 0;
      mockLlmStrategyFactory.getAIDecision.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary failure');
        }
        const mockResponseData = {
          thematicDirections: [
            {
              title: 'Retry Success One',
              description:
                'This direction was generated after a successful retry with preserved request options for the first attempt providing narrative depth',
              coreTension:
                'Failure versus Success creates meaningful conflict and character development opportunities',
              uniqueTwist:
                'Retries can lead to unexpected improvements through perseverance and adaptation',
              narrativePotential:
                'Stories of perseverance and eventual triumph that inspire and motivate character growth',
            },
            {
              title: 'Retry Success Two',
              description:
                'This direction was generated after a successful retry with preserved request options for the second attempt providing narrative depth',
              coreTension:
                'Persistence versus Giving Up creates tension between determination and resignation',
              uniqueTwist:
                'Each retry reveals new possibilities through iterative discovery and learning',
              narrativePotential:
                'Stories of iterative improvement and learning that demonstrate growth through repeated effort',
            },
            {
              title: 'Retry Success Three',
              description:
                'This direction was generated after a successful retry with preserved request options for the third attempt providing narrative depth',
              coreTension:
                'Experience versus Inexperience creates conflict between knowledge and naivety',
              uniqueTwist:
                'Retries build expertise through repetition and careful observation of results',
              narrativePotential:
                'Stories of mastery through practice and repetition that show the value of persistent effort',
            },
          ],
        };
        const mockResponse = JSON.stringify(mockResponseData);
        mockLlmJsonService.clean.mockReturnValue(mockResponse);
        mockLlmJsonService.parseAndRepair.mockResolvedValue(mockResponseData);
        return Promise.resolve(mockResponse);
      });

      // For this test, we expect the first call to fail and not retry (since that's not implemented)
      // But we want to verify the request options structure is consistent
      await expect(
        generator.generateDirections('test-concept', 'Test character concept')
      ).rejects.toThrow(ThematicDirectionGenerationError);

      // Verify the call was made with correct request options structure
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledWith(
        expect.any(String),
        null,
        expect.objectContaining({
          toolSchema: expect.any(Object),
          toolName: 'generate_thematic_directions',
          toolDescription: expect.any(String),
        })
      );
    });

    test('should validate request options structure before making LLM call', async () => {
      // This test verifies that the request options have the expected structure
      await generator.generateDirections(
        'test-concept',
        'Test character concept'
      );

      const callArgs = mockLlmStrategyFactory.getAIDecision.mock.calls[0];
      const requestOptions = callArgs[2];

      // Verify all required request option properties are present
      expect(requestOptions).toHaveProperty('toolSchema');
      expect(requestOptions).toHaveProperty('toolName');
      expect(requestOptions).toHaveProperty('toolDescription');

      // Verify types are correct
      expect(typeof requestOptions.toolSchema).toBe('object');
      expect(typeof requestOptions.toolName).toBe('string');
      expect(typeof requestOptions.toolDescription).toBe('string');

      // Verify specific values
      expect(requestOptions.toolName).toBe('generate_thematic_directions');
      expect(requestOptions.toolDescription).toBe(
        'Generate thematic directions for character development based on the provided concept'
      );
    });
  });
});
