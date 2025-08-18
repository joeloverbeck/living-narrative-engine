/**
 * @file Unit tests for CoreMotivationsGenerator service
 * @see src/characterBuilder/services/CoreMotivationsGenerator.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  CoreMotivationsGenerator,
  CoreMotivationsGenerationError,
} from '../../../../src/characterBuilder/services/CoreMotivationsGenerator.js';
import { PROMPT_VERSION_INFO } from '../../../../src/characterBuilder/prompts/coreMotivationsGenerationPrompt.js';

describe('CoreMotivationsGenerator', () => {
  let service;
  let mockLogger;
  let mockLlmJsonService;
  let mockLlmStrategyFactory;
  let mockLlmConfigManager;
  let mockEventBus;

  // Sample valid LLM response
  const validLlmResponse = {
    motivations: [
      {
        coreDesire: 'To find acceptance in a world that fears his differences',
        internalContradiction:
          'Desperately craves belonging yet pushes people away to protect himself',
        centralQuestion:
          'Can someone truly be loved if they hide their true nature?',
      },
      {
        coreDesire: 'To prove himself worthy of his inherited power',
        internalContradiction:
          'Believes in justice but must use morally questionable means to achieve it',
        centralQuestion:
          'Does the end justify the means when protecting innocents?',
      },
      {
        coreDesire: 'To break free from the expectations placed upon him',
        internalContradiction:
          'Wants freedom but is bound by duty and responsibility',
        centralQuestion:
          'Is personal happiness worth sacrificing the greater good?',
      },
    ],
  };

  // Sample concept
  const sampleConcept = {
    id: 'concept-123',
    concept:
      'A reluctant young mage struggling with immense power and societal expectations',
  };

  // Sample thematic direction
  const sampleDirection = {
    id: 'direction-456',
    title: 'The Burden of Power',
    description:
      'Exploring themes of responsibility, sacrifice, and the cost of great ability',
    coreTension:
      'The tension between personal desires and the greater good when wielding immense power',
    uniqueTwist: 'Power that grows stronger through emotional vulnerability',
    narrativePotential:
      'Rich exploration of identity, duty, and self-acceptance',
  };

  // Sample clichés
  const sampleClichés = {
    categories: {
      personalityTraits: ['brooding', 'mysterious', 'chosen one complex'],
      genericGoals: ['save the world', 'find true love'],
      overusedSecrets: ['secret royal bloodline', 'hidden magical power'],
    },
    tropesAndStereotypes: ['reluctant hero', 'dark and brooding protagonist'],
  };

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock LLM JSON service
    mockLlmJsonService = {
      clean: jest.fn((response) => response),
      parseAndRepair: jest.fn((response) => JSON.parse(response)),
    };

    // Mock LLM strategy factory
    mockLlmStrategyFactory = {
      getAIDecision: jest.fn(() =>
        Promise.resolve(JSON.stringify(validLlmResponse))
      ),
    };

    // Mock LLM config manager
    mockLlmConfigManager = {
      loadConfiguration: jest.fn(),
      getActiveConfiguration: jest.fn(() =>
        Promise.resolve({
          configId: 'test-model',
          temperature: 0.8,
        })
      ),
      setActiveConfiguration: jest.fn(() => Promise.resolve(true)),
    };

    // Mock event bus
    mockEventBus = {
      dispatch: jest.fn(),
    };

    // Create service instance
    service = new CoreMotivationsGenerator({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      llmStrategyFactory: mockLlmStrategyFactory,
      llmConfigManager: mockLlmConfigManager,
      eventBus: mockEventBus,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(service).toBeInstanceOf(CoreMotivationsGenerator);
    });

    it('should throw error with invalid logger', () => {
      expect(
        () =>
          new CoreMotivationsGenerator({
            logger: null,
            llmJsonService: mockLlmJsonService,
            llmStrategyFactory: mockLlmStrategyFactory,
            llmConfigManager: mockLlmConfigManager,
            eventBus: mockEventBus,
          })
      ).toThrow();
    });

    it('should throw error with invalid llmJsonService', () => {
      expect(
        () =>
          new CoreMotivationsGenerator({
            logger: mockLogger,
            llmJsonService: null,
            llmStrategyFactory: mockLlmStrategyFactory,
            llmConfigManager: mockLlmConfigManager,
            eventBus: mockEventBus,
          })
      ).toThrow();
    });

    it('should throw error with invalid eventBus', () => {
      expect(
        () =>
          new CoreMotivationsGenerator({
            logger: mockLogger,
            llmJsonService: mockLlmJsonService,
            llmStrategyFactory: mockLlmStrategyFactory,
            llmConfigManager: mockLlmConfigManager,
            eventBus: null,
          })
      ).toThrow();
    });
  });

  describe('generate', () => {
    const validParams = {
      concept: sampleConcept,
      direction: sampleDirection,
      clichés: sampleClichés,
    };

    it('should generate core motivations successfully', async () => {
      const result = await service.generate(validParams);

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('coreDesire');
      expect(result[0]).toHaveProperty('internalContradiction');
      expect(result[0]).toHaveProperty('centralQuestion');
      expect(result[0]).toHaveProperty('directionId', sampleDirection.id);
      expect(result[0]).toHaveProperty('conceptId', sampleConcept.id);
      expect(result[0]).toHaveProperty('metadata');

      // Verify event dispatching
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'CORE_MOTIVATIONS_GENERATION_STARTED',
        payload: {
          conceptId: sampleConcept.id,
          directionId: sampleDirection.id,
        },
      });

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'CORE_MOTIVATIONS_GENERATION_COMPLETED',
        payload: {
          conceptId: sampleConcept.id,
          directionId: sampleDirection.id,
          motivationIds: expect.any(Array),
          totalCount: 3,
        },
      });
    });

    it('should handle French spelling of clichés parameter', async () => {
      const paramsWithFrenchSpelling = {
        concept: sampleConcept,
        direction: sampleDirection,
        clichés: sampleClichés, // French spelling with accent
      };

      const result = await service.generate(paramsWithFrenchSpelling);
      expect(result).toHaveLength(3);
    });

    it('should validate concept parameter', async () => {
      await expect(
        service.generate({
          concept: null,
          direction: sampleDirection,
          clichés: sampleClichés,
        })
      ).rejects.toThrow(CoreMotivationsGenerationError);

      await expect(
        service.generate({
          concept: { id: 'test', concept: '' },
          direction: sampleDirection,
          clichés: sampleClichés,
        })
      ).rejects.toThrow(CoreMotivationsGenerationError);

      await expect(
        service.generate({
          concept: { id: '', concept: 'test' },
          direction: sampleDirection,
          clichés: sampleClichés,
        })
      ).rejects.toThrow(CoreMotivationsGenerationError);
    });

    it('should validate direction parameter', async () => {
      await expect(
        service.generate({
          concept: sampleConcept,
          direction: null,
          clichés: sampleClichés,
        })
      ).rejects.toThrow(CoreMotivationsGenerationError);

      await expect(
        service.generate({
          concept: sampleConcept,
          direction: {
            id: '',
            title: 'test',
            description: 'test',
            coreTension: 'test',
          },
          clichés: sampleClichés,
        })
      ).rejects.toThrow(CoreMotivationsGenerationError);
    });

    it('should validate clichés parameter', async () => {
      await expect(
        service.generate({
          concept: sampleConcept,
          direction: sampleDirection,
          clichés: null,
        })
      ).rejects.toThrow(CoreMotivationsGenerationError);
    });

    it('should handle LLM configuration options', async () => {
      const options = { llmConfigId: 'custom-config' };

      await service.generate(validParams, options);

      expect(mockLlmConfigManager.setActiveConfiguration).toHaveBeenCalledWith(
        'custom-config'
      );
    });

    it('should include proper metadata in result', async () => {
      const result = await service.generate(validParams);

      expect(result[0].metadata).toEqual(
        expect.objectContaining({
          model: 'test-model',
          promptTokens: expect.any(Number),
          responseTokens: expect.any(Number),
          totalTokens: expect.any(Number),
          responseTime: expect.any(Number),
          retryAttempts: expect.any(Number),
          promptVersion: PROMPT_VERSION_INFO.version,
          clicheIds: expect.any(Array),
          qualityChecks: expect.arrayContaining([
            'structure',
            'quality',
            'length',
            'format',
          ]),
          generationPrompt: expect.any(String),
        })
      );
    });

    it('should handle LLM response parsing errors', async () => {
      // Make parsing fail consistently across all retry attempts
      mockLlmJsonService.parseAndRepair.mockRejectedValue(
        new Error('Invalid JSON')
      );

      await expect(
        service.generate(validParams, { maxRetries: 0 })
      ).rejects.toThrow(CoreMotivationsGenerationError);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'CORE_MOTIVATIONS_GENERATION_FAILED',
        payload: expect.objectContaining({
          conceptId: sampleConcept.id,
          directionId: sampleDirection.id,
          error: expect.stringContaining('Invalid JSON'),
          processingTime: expect.any(Number),
          failureStage: expect.any(String),
        }),
      });
    });

    it('should handle LLM request failures', async () => {
      // Make LLM requests fail consistently across all retry attempts
      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(
        new Error('Network timeout')
      );

      await expect(
        service.generate(validParams, { maxRetries: 0 })
      ).rejects.toThrow(CoreMotivationsGenerationError);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'CORE_MOTIVATIONS_GENERATION_FAILED',
        payload: expect.objectContaining({
          conceptId: sampleConcept.id,
          directionId: sampleDirection.id,
          error: expect.stringContaining('Network timeout'),
          processingTime: expect.any(Number),
          failureStage: expect.any(String),
        }),
      });
    });

    it('should handle invalid response structure', async () => {
      const invalidResponse = { invalid: 'response' };
      // Make LLM return invalid response consistently for all retries
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify(invalidResponse)
      );

      await expect(
        service.generate(validParams, { maxRetries: 0 })
      ).rejects.toThrow(CoreMotivationsGenerationError);
    });

    it('should handle response with insufficient motivations', async () => {
      const invalidResponse = {
        motivations: [
          {
            coreDesire: 'Test desire',
            internalContradiction: 'Test contradiction',
            centralQuestion: 'Test question?',
          },
        ], // Only 1 motivation, but minimum is 3
      };

      // Make LLM return insufficient response consistently for all retries
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify(invalidResponse)
      );

      await expect(
        service.generate(validParams, { maxRetries: 0 })
      ).rejects.toThrow(CoreMotivationsGenerationError);
    });

    it('should handle missing LLM configuration', async () => {
      // Make configuration return null consistently for all retries
      mockLlmConfigManager.getActiveConfiguration.mockResolvedValue(null);

      await expect(
        service.generate(validParams, { maxRetries: 0 })
      ).rejects.toThrow(CoreMotivationsGenerationError);
    });

    it('should log generation progress', async () => {
      await service.generate(validParams);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting generation'),
        expect.objectContaining({
          conceptId: sampleConcept.id,
          directionId: sampleDirection.id,
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully generated'),
        expect.objectContaining({
          conceptId: sampleConcept.id,
          directionId: sampleDirection.id,
          motivationsCount: 3,
        })
      );
    });

    it('should call LLM with correct parameters', async () => {
      await service.generate(validParams);

      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledWith(
        expect.stringContaining('<role>'),
        null,
        expect.objectContaining({
          toolSchema: expect.any(Object),
          toolName: 'generate_core_motivations',
          toolDescription: expect.stringContaining('Generate core motivations'),
        })
      );
    });
  });

  describe('utility methods', () => {
    it('should validate response structure', () => {
      expect(service.validateResponse(validLlmResponse)).toBe(true);

      expect(() => service.validateResponse({ invalid: 'response' })).toThrow();
    });

    it('should return response schema', () => {
      const schema = service.getResponseSchema();
      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties');
      expect(schema.properties).toHaveProperty('motivations');
    });

    it('should return LLM parameters', () => {
      const params = service.getLLMParameters();
      expect(params).toHaveProperty('temperature', 0.8);
      expect(params).toHaveProperty('max_tokens', 3000);
    });

    it('should return prompt version info', () => {
      const versionInfo = service.getPromptVersionInfo();
      expect(versionInfo).toEqual(PROMPT_VERSION_INFO);
    });
  });

  describe('error handling', () => {
    it('should create custom error with cause', () => {
      const originalError = new Error('Original error');
      const customError = new CoreMotivationsGenerationError(
        'Custom message',
        originalError
      );

      expect(customError).toBeInstanceOf(Error);
      expect(customError).toBeInstanceOf(CoreMotivationsGenerationError);
      expect(customError.name).toBe('CoreMotivationsGenerationError');
      expect(customError.message).toBe('Custom message');
      expect(customError.cause).toBe(originalError);
    });

    it('should wrap non-CoreMotivationsGenerationError exceptions', async () => {
      const originalError = new Error('Unexpected error');
      // Make error occur consistently across all retries
      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(originalError);

      await expect(
        service.generate(
          {
            concept: sampleConcept,
            direction: sampleDirection,
            clichés: sampleClichés,
          },
          { maxRetries: 0 }
        )
      ).rejects.toThrow(CoreMotivationsGenerationError);
    });

    it('should preserve CoreMotivationsGenerationError instances', async () => {
      const customError = new CoreMotivationsGenerationError('Custom error');
      // Make custom error occur consistently across all retries
      mockLlmJsonService.parseAndRepair.mockRejectedValue(customError);

      await expect(
        service.generate(
          {
            concept: sampleConcept,
            direction: sampleDirection,
            clichés: sampleClichés,
          },
          { maxRetries: 0 }
        )
      ).rejects.toThrow(CoreMotivationsGenerationError);
    });
  });

  describe('cliché ID extraction', () => {
    it('should extract cliché IDs from categories and tropes', async () => {
      const clichésWithMultipleItems = {
        categories: {
          personalityTraits: ['brooding', 'mysterious'],
          genericGoals: ['save the world'],
        },
        tropesAndStereotypes: ['reluctant hero', 'chosen one'],
      };

      const result = await service.generate({
        concept: sampleConcept,
        direction: sampleDirection,
        clichés: clichésWithMultipleItems,
      });

      expect(result[0].metadata.clicheIds).toEqual([
        'personalityTraits_0',
        'personalityTraits_1',
        'genericGoals_0',
        'trope_0',
        'trope_1',
      ]);
    });

    it('should handle empty clichés object', async () => {
      const emptyClichés = {
        categories: {},
        tropesAndStereotypes: [],
      };

      const result = await service.generate({
        concept: sampleConcept,
        direction: sampleDirection,
        clichés: emptyClichés,
      });

      expect(result[0].metadata.clicheIds).toEqual([]);
    });
  });

  describe('retry behavior', () => {
    const validParams = {
      concept: sampleConcept,
      direction: sampleDirection,
      clichés: sampleClichés,
    };

    it('should respect maxRetries option of 0', async () => {
      const error = new Error('Test error');
      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(error);

      // maxRetries: 0 means only initial attempt, no retries
      await expect(
        service.generate(validParams, { maxRetries: 0 })
      ).rejects.toThrow(CoreMotivationsGenerationError);

      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledTimes(1);
    });

    it('should include retry count in error message', async () => {
      const error = new Error('Network error');
      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(error);

      try {
        await service.generate(validParams, { maxRetries: 0 });
      } catch (err) {
        expect(err.message).toContain('1 attempt');
      }

      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledTimes(1);
    });
  });

  describe('response quality validation', () => {
    it('should reject responses with insufficient content depth', async () => {
      const poorQualityResponse = {
        motivations: [
          {
            coreDesire: 'wants', // Too brief
            internalContradiction: 'conflict', // Too brief
            centralQuestion: 'What', // Missing question mark
          },
          {
            coreDesire: 'needs',
            internalContradiction: 'struggles',
            centralQuestion: 'How',
          },
          {
            coreDesire: 'seeks',
            internalContradiction: 'fights',
            centralQuestion: 'Why',
          },
        ],
      };

      // Make poor quality response return consistently for all retries
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify(poorQualityResponse)
      );

      await expect(
        service.generate(
          {
            concept: sampleConcept,
            direction: sampleDirection,
            clichés: sampleClichés,
          },
          { maxRetries: 0 }
        )
      ).rejects.toThrow(/question mark/);
    });

    it('should accept valid quality responses', async () => {
      const goodQualityResponse = {
        motivations: [
          {
            coreDesire: 'To find acceptance in a world that fears differences',
            internalContradiction:
              'Desperately craves belonging yet pushes people away to protect himself from rejection',
            centralQuestion:
              'Can someone truly be loved if they hide their true nature?',
          },
          {
            coreDesire: 'To prove himself worthy of his inherited power',
            internalContradiction:
              'Believes in justice but must use morally questionable means to achieve it',
            centralQuestion:
              'Does the end justify the means when protecting innocents?',
          },
          {
            coreDesire: 'To break free from the expectations placed upon him',
            internalContradiction:
              'Wants freedom but is bound by duty and responsibility',
            centralQuestion:
              'Is personal happiness worth sacrificing the greater good?',
          },
        ],
      };

      // Make good quality response return consistently for all retries
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify(goodQualityResponse)
      );

      const result = await service.generate({
        concept: sampleConcept,
        direction: sampleDirection,
        clichés: sampleClichés,
      });

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('coreDesire');
    });

    it('should validate central question has question mark', async () => {
      const noQuestionMarkResponse = {
        motivations: [
          {
            coreDesire: 'To find acceptance in a world that fears differences',
            internalContradiction:
              'Desperately craves belonging yet pushes people away to protect himself',
            centralQuestion: 'This is not a proper question', // No question mark
          },
          {
            coreDesire: 'To prove himself worthy of his inherited power',
            internalContradiction:
              'Believes in justice but must use morally questionable means to achieve it',
            centralQuestion:
              'Does the end justify the means when protecting innocents?',
          },
          {
            coreDesire: 'To break free from the expectations placed upon him',
            internalContradiction:
              'Wants freedom but is bound by duty and responsibility',
            centralQuestion:
              'Is personal happiness worth sacrificing the greater good?',
          },
        ],
      };

      // Make invalid response return consistently for all retries
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify(noQuestionMarkResponse)
      );

      await expect(
        service.generate(
          {
            concept: sampleConcept,
            direction: sampleDirection,
            clichés: sampleClichés,
          },
          { maxRetries: 0 }
        )
      ).rejects.toThrow(/question mark/);
    });

    it('should validate motivation array structure', async () => {
      const invalidStructureResponse = {
        motivations: 'not an array',
      };

      // Make invalid response return consistently for all retries
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify(invalidStructureResponse)
      );

      await expect(
        service.generate(
          {
            concept: sampleConcept,
            direction: sampleDirection,
            clichés: sampleClichés,
          },
          { maxRetries: 0 }
        )
      ).rejects.toThrow(/motivations array/);
    });
  });
});
