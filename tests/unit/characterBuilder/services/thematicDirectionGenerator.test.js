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
      getStrategy: jest.fn(),
    };

    mockLlmConfigManager = {
      loadConfiguration: jest.fn(),
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
      }).toThrow('Missing required dependency: LLMStrategyFactory.');
    });

    test('should throw error if llmConfigManager is invalid', () => {
      expect(() => {
        new ThematicDirectionGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: null,
        });
      }).toThrow('Missing required dependency: LLMConfigurationManager.');
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

    const mockStrategy = {
      execute: jest.fn().mockResolvedValue(mockLlmResponse),
    };

    beforeEach(() => {
      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockLlmStrategyFactory.getStrategy.mockReturnValue(mockStrategy);
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
      expect(mockLlmConfigManager.loadConfiguration).toHaveBeenCalledWith(
        'openrouter-claude-sonnet-4'
      );
      expect(mockLlmStrategyFactory.getStrategy).toHaveBeenCalledWith(
        expect.objectContaining({
          configId: 'openrouter-claude-sonnet-4',
          modelIdentifier: 'anthropic/claude-sonnet-4',
          apiType: 'openrouter',
          jsonOutputStrategy: expect.objectContaining({
            method: 'openrouter_json_schema',
            jsonSchema: expect.any(Object),
          }),
          defaultParameters: expect.objectContaining({
            temperature: 0.7,
            max_tokens: 2000,
          }),
        })
      );
    });

    test('should use custom llmConfigId when provided', async () => {
      const conceptId = 'test-concept-123';
      const characterConcept = 'A ditzy archer who loves adventure';
      const customConfigId = 'custom-llm-config';

      await generator.generateDirections(conceptId, characterConcept, {
        llmConfigId: customConfigId,
      });

      expect(mockLlmConfigManager.loadConfiguration).toHaveBeenCalledWith(
        customConfigId
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
      mockLlmConfigManager.loadConfiguration.mockResolvedValue(null);

      await expect(
        generator.generateDirections('test-id', 'Valid concept')
      ).rejects.toThrow(ThematicDirectionGenerationError);
      await expect(
        generator.generateDirections('test-id', 'Valid concept')
      ).rejects.toThrow('LLM configuration not found');
    });

    test('should throw error if LLM strategy execution fails', async () => {
      const llmError = new Error('LLM service unavailable');
      mockStrategy.execute.mockRejectedValue(llmError);

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
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmStrategyFactory.getStrategy.mockReturnValue(mockStrategy);
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
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmStrategyFactory.getStrategy.mockReturnValue(mockStrategy);
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
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmStrategyFactory.getStrategy.mockReturnValue(mockStrategy);
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
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmStrategyFactory.getStrategy.mockReturnValue(mockStrategy);
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
});
