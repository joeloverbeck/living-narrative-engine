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
import * as promptModule from '../../../../src/characterBuilder/prompts/coreMotivationsGenerationPrompt.js';

const { PROMPT_VERSION_INFO } = promptModule;

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
    jest.restoreAllMocks();
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
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:core_motivations_generation_started',
        {
          conceptId: sampleConcept.id,
          directionId: sampleDirection.id,
        }
      );

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:core_motivations_generation_completed',
        {
          conceptId: sampleConcept.id,
          directionId: sampleDirection.id,
          motivationIds: expect.any(Array),
          totalCount: 3,
        }
      );
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

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:core_motivations_generation_failed',
        expect.objectContaining({
          conceptId: sampleConcept.id,
          directionId: sampleDirection.id,
          error: expect.stringContaining('Invalid JSON'),
          processingTime: expect.any(Number),
          failureStage: expect.any(String),
        })
      );
    });

    it('should handle LLM request failures', async () => {
      // Make LLM requests fail consistently across all retry attempts
      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(
        new Error('Network timeout')
      );

      await expect(
        service.generate(validParams, { maxRetries: 0 })
      ).rejects.toThrow(CoreMotivationsGenerationError);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:core_motivations_generation_failed',
        expect.objectContaining({
          conceptId: sampleConcept.id,
          directionId: sampleDirection.id,
          error: expect.stringContaining('Network timeout'),
          processingTime: expect.any(Number),
          failureStage: expect.any(String),
        })
      );
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

  describe('edge cases and extreme scenarios', () => {
    const validParams = {
      concept: sampleConcept,
      direction: sampleDirection,
      clichés: sampleClichés,
    };

    it('should handle extremely long concept descriptions', async () => {
      const longConcept = {
        id: 'concept-long',
        concept: 'A'.repeat(10000), // Very long description
      };

      const result = await service.generate({
        concept: longConcept,
        direction: sampleDirection,
        clichés: sampleClichés,
      });

      expect(result).toHaveLength(3);
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalled();
    });

    it('should handle special characters in input', async () => {
      const specialCharConcept = {
        id: 'concept-special',
        concept:
          'A character with "quotes", \'apostrophes\', and \n newlines \t tabs',
      };

      const result = await service.generate({
        concept: specialCharConcept,
        direction: sampleDirection,
        clichés: sampleClichés,
      });

      expect(result).toHaveLength(3);
    });

    it('should handle Unicode characters in responses', async () => {
      const unicodeResponse = {
        motivations: [
          {
            coreDesire: 'To find 愛 (love) in a world of chaos 🌍',
            internalContradiction:
              'Seeks connection but fears vulnerability ❤️',
            centralQuestion: '¿Can one truly love without losing oneself?',
          },
          {
            coreDesire: 'To discover the meaning of existence ∞',
            internalContradiction: 'Pursues knowledge but fears the truth',
            centralQuestion: 'What price is too high for enlightenment?',
          },
          {
            coreDesire:
              'To transcend mortal limitations and become something more',
            internalContradiction:
              'Seeks power but maintains humanity and compassion',
            centralQuestion: 'Is godhood worth the isolation it brings?',
          },
        ],
      };

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify(unicodeResponse)
      );

      const result = await service.generate(validParams);

      expect(result).toHaveLength(3);
      expect(result[0].coreDesire).toContain('愛');
      expect(result[0].internalContradiction).toContain('❤️');
    });

    it('should handle concurrent generation requests', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(service.generate(validParams));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toHaveLength(3);
      });
    });

    it('should handle malformed JSON with recovery', async () => {
      // First attempt returns malformed JSON
      mockLlmStrategyFactory.getAIDecision
        .mockResolvedValueOnce('{"motivations": [invalid json')
        .mockResolvedValueOnce(JSON.stringify(validLlmResponse));

      mockLlmJsonService.parseAndRepair
        .mockRejectedValueOnce(new Error('Parse failed'))
        .mockResolvedValueOnce(validLlmResponse);

      const result = await service.generate(validParams, { maxRetries: 2 });

      expect(result).toHaveLength(3);
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledTimes(2);
    });

    it('should handle partial response with missing fields', async () => {
      const partialResponse = {
        motivations: [
          {
            coreDesire: 'Valid desire',
            // Missing internalContradiction
            centralQuestion: 'Valid question?',
          },
          {
            coreDesire: 'Another desire',
            internalContradiction: 'Valid contradiction',
            centralQuestion: 'Another question?',
          },
          {
            coreDesire: 'Third desire',
            internalContradiction: 'Third contradiction',
            centralQuestion: 'Third question?',
          },
        ],
      };

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify(partialResponse)
      );

      await expect(
        service.generate(validParams, { maxRetries: 0 })
      ).rejects.toThrow(/internalContradiction/);
    });

    it('should handle response with duplicate motivations', async () => {
      const duplicateResponse = {
        motivations: [
          {
            coreDesire: 'To achieve greatness and leave a lasting legacy',
            internalContradiction:
              'Wants recognition but fears being truly seen',
            centralQuestion: 'What defines a meaningful existence?',
          },
          {
            coreDesire: 'To achieve greatness and leave a lasting legacy', // Duplicate
            internalContradiction:
              'Wants recognition but fears being truly seen',
            centralQuestion: 'What defines a meaningful existence?',
          },
          {
            coreDesire: 'To find peace in a world of constant conflict',
            internalContradiction: 'Seeks tranquility but thrives in chaos',
            centralQuestion:
              'Can one find peace without first experiencing war?',
          },
        ],
      };

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify(duplicateResponse)
      );

      const result = await service.generate(validParams);

      // Should still process but each should have unique ID
      expect(result).toHaveLength(3);
      const ids = result.map((m) => m.id);
      expect(new Set(ids).size).toBe(3); // All IDs should be unique
    });

    it('should handle null/undefined in cliché categories', async () => {
      const clichésWithNulls = {
        categories: {
          personalityTraits: null,
          genericGoals: undefined,
          validCategory: ['item1', 'item2'],
        },
        tropesAndStereotypes: null,
      };

      const result = await service.generate({
        concept: sampleConcept,
        direction: sampleDirection,
        clichés: clichésWithNulls,
      });

      expect(result).toHaveLength(3);
      expect(result[0].metadata.clicheIds).toEqual([
        'validCategory_0',
        'validCategory_1',
      ]);
    });

    it('should handle LLM timeout with retry', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ETIMEDOUT';

      mockLlmStrategyFactory.getAIDecision
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce(JSON.stringify(validLlmResponse));

      const result = await service.generate(validParams, { maxRetries: 2 });

      expect(result).toHaveLength(3);
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledTimes(2);
    });

    it('should handle response with extra unexpected fields', async () => {
      const responseWithExtras = {
        motivations: validLlmResponse.motivations,
        unexpectedField: 'should be ignored',
        anotherExtra: { nested: 'data' },
      };

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify(responseWithExtras)
      );

      const result = await service.generate(validParams);

      expect(result).toHaveLength(3);
      // Extra fields should not cause issues
      expect(result[0]).not.toHaveProperty('unexpectedField');
    });

    it('should handle empty strings in required fields', async () => {
      const emptyStringResponse = {
        motivations: [
          {
            coreDesire: '', // Empty string
            internalContradiction: 'Valid contradiction',
            centralQuestion: 'Valid question?',
          },
          {
            coreDesire: 'Valid desire',
            internalContradiction: 'Valid contradiction',
            centralQuestion: 'Valid question?',
          },
          {
            coreDesire: 'Another valid desire',
            internalContradiction: 'Another contradiction',
            centralQuestion: 'Another question?',
          },
        ],
      };

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify(emptyStringResponse)
      );

      await expect(
        service.generate(validParams, { maxRetries: 0 })
      ).rejects.toThrow(/empty/i);
    });

    it('should handle whitespace-only strings in fields', async () => {
      const whitespaceResponse = {
        motivations: [
          {
            coreDesire: '   \n\t   ', // Only whitespace
            internalContradiction: 'Valid contradiction',
            centralQuestion: 'Valid question?',
          },
          {
            coreDesire: 'Valid desire',
            internalContradiction: 'Valid contradiction',
            centralQuestion: 'Valid question?',
          },
          {
            coreDesire: 'Another valid desire',
            internalContradiction: 'Another contradiction',
            centralQuestion: 'Another question?',
          },
        ],
      };

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify(whitespaceResponse)
      );

      await expect(
        service.generate(validParams, { maxRetries: 0 })
      ).rejects.toThrow(/empty/i);
    });

    it('should handle extremely large response', async () => {
      // Test that responses with more than 5 motivations are rejected
      const largeResponse = {
        motivations: Array(6)
          .fill(null)
          .map((_, i) => ({
            coreDesire: `Desire ${i}: To seek understanding in a complex world full of mysteries`,
            internalContradiction: `Contradiction ${i}: Wants answers but fears what truth might reveal`,
            centralQuestion: `Question ${i}: What is the nature of reality and our place within it?`,
          })),
      };

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify(largeResponse)
      );

      // Should reject responses with more than 5 motivations
      await expect(
        service.generate(validParams, { maxRetries: 0 })
      ).rejects.toThrow(/cannot contain more than 5 motivations/);
    });

    it('should handle configuration switching mid-generation', async () => {
      const configSwitchPromise = service.generate(validParams, {
        llmConfigId: 'config-1',
      });

      // Attempt to switch config during generation
      const secondPromise = service.generate(validParams, {
        llmConfigId: 'config-2',
      });

      const [result1, result2] = await Promise.all([
        configSwitchPromise,
        secondPromise,
      ]);

      expect(result1).toHaveLength(3);
      expect(result2).toHaveLength(3);
      expect(mockLlmConfigManager.setActiveConfiguration).toHaveBeenCalledWith(
        'config-1'
      );
      expect(mockLlmConfigManager.setActiveConfiguration).toHaveBeenCalledWith(
        'config-2'
      );
    });
  });

  describe('generate - advanced coverage scenarios', () => {
    const validParams = {
      concept: sampleConcept,
      direction: sampleDirection,
      clichés: sampleClichés,
    };

    const buildValidMotivation = (index = 1) => ({
      coreDesire:
        `Motivation ${index} core desire contains sufficient descriptive language to surpass validation requirements easily.`,
      internalContradiction:
        `Motivation ${index} internal contradiction clearly explains the nuanced conflict with more than enough characters to pass validation.`,
      centralQuestion: `How will motivation ${index} reconcile its core dilemma?`,
    });

    const buildValidResponse = () => ({
      motivations: [
        buildValidMotivation(1),
        buildValidMotivation(2),
        buildValidMotivation(3),
      ],
    });

    const createDependencies = (overrides = {}) => {
      const rawResponse = JSON.stringify(buildValidResponse());

      const dependencies = {
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        },
        llmJsonService: {
          clean: jest.fn(async (response) => response),
          parseAndRepair: jest.fn(async () => buildValidResponse()),
        },
        llmStrategyFactory: {
          getAIDecision: jest.fn(async () => rawResponse),
        },
        llmConfigManager: {
          loadConfiguration: jest.fn(async () => ({ configId: 'fallback-config' })),
          getActiveConfiguration: jest.fn(async () => ({ configId: 'active-config' })),
          setActiveConfiguration: jest.fn(async () => true),
        },
        eventBus: {
          dispatch: jest.fn(async () => undefined),
        },
        tokenEstimator: undefined,
      };

      return {
        ...dependencies,
        ...overrides,
        logger: overrides.logger || dependencies.logger,
        llmJsonService: overrides.llmJsonService || dependencies.llmJsonService,
        llmStrategyFactory:
          overrides.llmStrategyFactory || dependencies.llmStrategyFactory,
        llmConfigManager:
          overrides.llmConfigManager || dependencies.llmConfigManager,
        eventBus: overrides.eventBus || dependencies.eventBus,
        tokenEstimator:
          overrides.hasOwnProperty('tokenEstimator')
            ? overrides.tokenEstimator
            : dependencies.tokenEstimator,
      };
    };

    it('should include token estimator metadata and gracefully handle missing prompt text when estimating tokens', async () => {
      const buildSpy = jest
        .spyOn(promptModule, 'buildCoreMotivationsGenerationPrompt')
        .mockImplementationOnce(() => 'initial prompt for llm')
        .mockImplementationOnce(() => null)
        .mockImplementation(() => 'final prompt for metadata');

      const tokenEstimator = {
        estimateTokens: jest.fn().mockResolvedValueOnce(128),
      };

      const dependencies = createDependencies({ tokenEstimator });
      const service = new CoreMotivationsGenerator(dependencies);

      const result = await service.generate(validParams, {
        llmConfigId: 'config-with-estimator',
      });

      expect(result).toHaveLength(3);
      expect(tokenEstimator.estimateTokens).toHaveBeenCalledTimes(1);
      expect(result[0].metadata.promptTokens).toBe(0);
      expect(result[0].metadata.responseTokens).toBe(128);
      expect(result[0].metadata.clicheIds).toContain('personalityTraits_0');
      expect(buildSpy).toHaveBeenCalledTimes(3);
      expect(dependencies.logger.debug).toHaveBeenCalledWith(
        'CoreMotivationsGenerator: Token estimation (TokenEstimator)',
        expect.objectContaining({ method: 'TokenEstimator', estimatedTokens: 128 })
      );
    });

    it('should fall back to simple token estimation when estimator is not provided', async () => {
      const dependencies = createDependencies();
      const service = new CoreMotivationsGenerator(dependencies);

      const result = await service.generate(validParams, { maxRetries: 0 });

      const promptLength =
        promptModule
          .buildCoreMotivationsGenerationPrompt(
            validParams.concept.concept,
            validParams.direction,
            validParams.clichés
          )
          .length;
      const expectedTokens = Math.ceil(promptLength / 4);

      expect(result[0].metadata.promptTokens).toBe(expectedTokens);
      expect(result[0].metadata.responseTokens).toBeGreaterThan(0);
      expect(dependencies.logger.debug).toHaveBeenCalledWith(
        'CoreMotivationsGenerator: Token estimation (fallback)',
        expect.objectContaining({ method: 'fallback', estimatedTokens: expectedTokens })
      );
    });

    it('should recover with fallback estimation when the token estimator throws', async () => {
      const failingEstimator = {
        estimateTokens: jest.fn().mockRejectedValue(new Error('estimation failed')),
      };

      const dependencies = createDependencies({ tokenEstimator: failingEstimator });
      const service = new CoreMotivationsGenerator(dependencies);

      const result = await service.generate(validParams);

      expect(failingEstimator.estimateTokens).toHaveBeenCalled();
      expect(dependencies.logger.warn).toHaveBeenCalledWith(
        'CoreMotivationsGenerator: Token estimation failed, using fallback',
        expect.objectContaining({ error: 'estimation failed' })
      );
      const promptLength =
        promptModule
          .buildCoreMotivationsGenerationPrompt(
            validParams.concept.concept,
            validParams.direction,
            validParams.clichés
          )
          .length;
      const expectedPromptTokens = Math.ceil(promptLength / 4);
      const expectedResponseTokens = Math.ceil(
        JSON.stringify(buildValidResponse()).length / 4
      );

      expect(result[0].metadata.promptTokens).toBe(expectedPromptTokens);
      expect(result[0].metadata.responseTokens).toBe(expectedResponseTokens);
    });

    it('should wrap completion dispatch errors in CoreMotivationsGenerationError and report processing stage', async () => {
      const dependencies = createDependencies();
      dependencies.eventBus.dispatch = jest
        .fn()
        .mockResolvedValueOnce(undefined) // generation started
        .mockRejectedValueOnce(new Error('dispatch failure'))
        .mockResolvedValueOnce(undefined); // failure event

      const service = new CoreMotivationsGenerator(dependencies);

      await expect(
        service.generate(validParams, { maxRetries: 0 })
      ).rejects.toThrow(CoreMotivationsGenerationError);

      const failureCall = dependencies.eventBus.dispatch.mock.calls[2];
      expect(failureCall[1].failureStage).toBe('processing');
    });

    it('should surface configuration errors when the requested llmConfigId is unknown', async () => {
      const dependencies = createDependencies();
      dependencies.llmConfigManager.setActiveConfiguration = jest
        .fn()
        .mockResolvedValue(false);
      dependencies.llmConfigManager.loadConfiguration = jest
        .fn()
        .mockResolvedValue(null);

      const service = new CoreMotivationsGenerator(dependencies);

      await expect(
        service.generate(validParams, {
          llmConfigId: 'missing-config',
          maxRetries: 0,
        })
      ).rejects.toThrow(/LLM configuration not found: missing-config/);
    });

    it('should rethrow existing CoreMotivationsGenerationError instances from LLM calls', async () => {
      const dependencies = createDependencies();
      dependencies.llmStrategyFactory.getAIDecision = jest
        .fn()
        .mockRejectedValue(new CoreMotivationsGenerationError('llm down'));

      const service = new CoreMotivationsGenerator(dependencies);

      await expect(
        service.generate(validParams, { maxRetries: 0 })
      ).rejects.toThrow(/llm down/);
    });

    it('should rethrow CoreMotivationsGenerationError from schema validation without wrapping it twice', async () => {
      const validateSpy = jest
        .spyOn(promptModule, 'validateCoreMotivationsGenerationResponse')
        .mockImplementation(() => {
          throw new CoreMotivationsGenerationError('structural issue');
        });

      const dependencies = createDependencies();
      const service = new CoreMotivationsGenerator(dependencies);

      await expect(
        service.generate(validParams, { maxRetries: 0 })
      ).rejects.toThrow(/structural issue/);

      expect(validateSpy).toHaveBeenCalled();
    });

    it('should report detailed quality validation issues when motivations are weak', async () => {
      const poorResponse = {
        motivations: [
          {
            coreDesire: 'Too short',
            internalContradiction: 'Brief conflict',
            centralQuestion: 'Is redemption possible?',
          },
          {
            coreDesire: 'Barely enough words',
            internalContradiction: 'Still quite short',
            centralQuestion: 'Can hope survive?',
          },
          {
            coreDesire: 'Short desire text',
            internalContradiction: 'Simple conflict',
            centralQuestion: 'Will they change?',
          },
        ],
      };

      const dependencies = createDependencies({
        llmJsonService: {
          clean: jest.fn(async () => JSON.stringify(poorResponse)),
          parseAndRepair: jest.fn(async () => poorResponse),
        },
        llmStrategyFactory: {
          getAIDecision: jest.fn(async () => JSON.stringify(poorResponse)),
        },
      });

      const service = new CoreMotivationsGenerator(dependencies);

      await expect(
        service.generate(validParams, { maxRetries: 0 })
      ).rejects.toThrow(/Response quality issues/);

      expect(dependencies.logger.warn).toHaveBeenCalledWith(
        'CoreMotivationsGenerator: Response quality issues detected',
        expect.objectContaining({ issueCount: expect.any(Number) })
      );
    });

    it('should map diverse failure messages to meaningful failure stages', async () => {
      const scenarios = [
        {
          name: 'llm_request',
          configure(deps) {
            deps.llmStrategyFactory.getAIDecision = jest
              .fn()
              .mockRejectedValue(new Error('Network outage during call'));
          },
          expected: 'llm_request',
        },
        {
          name: 'response_parsing',
          configure(deps) {
            deps.llmJsonService.parseAndRepair = jest
              .fn()
              .mockRejectedValue(new Error('Parsing issue occurred'));
          },
          expected: 'response_parsing',
        },
        {
          name: 'structure_validation',
          configure() {
            jest
              .spyOn(promptModule, 'validateCoreMotivationsGenerationResponse')
              .mockImplementation(() => {
                throw new Error('Schema validation failed');
              });
          },
          expected: 'structure_validation',
        },
        {
          name: 'quality_validation',
          configure(deps) {
            const almostValid = buildValidResponse();
            almostValid.motivations[0].coreDesire = 'Short desire';
            almostValid.motivations[0].internalContradiction = 'Brief conflict';
            deps.llmJsonService.parseAndRepair = jest
              .fn()
              .mockResolvedValue(almostValid);
            deps.llmStrategyFactory.getAIDecision = jest
              .fn()
              .mockResolvedValue(JSON.stringify(almostValid));
          },
          expected: 'quality_validation',
        },
        {
          name: 'configuration',
          configure(deps) {
            deps.llmConfigManager.getActiveConfiguration = jest
              .fn()
              .mockResolvedValue(null);
          },
          expected: 'llm_request',
        },
        {
          name: 'unknown',
          configure(deps) {
            deps.eventBus.dispatch = jest
              .fn()
              .mockResolvedValueOnce(undefined)
              .mockRejectedValueOnce({})
              .mockResolvedValueOnce(undefined);
          },
          expected: 'unknown',
        },
        {
          name: 'recursive',
          configure(deps) {
            deps.eventBus.dispatch = jest
              .fn()
              .mockResolvedValueOnce(undefined)
              .mockRejectedValueOnce(
                new CoreMotivationsGenerationError(
                  'outer error',
                  new Error('Timeout while waiting for response')
                )
              )
              .mockResolvedValueOnce(undefined);
          },
          expected: 'llm_request',
        },
      ];

      for (const { name, configure, expected } of scenarios) {
        jest.restoreAllMocks();
        const dependencies = createDependencies();
        configure(dependencies);
        const service = new CoreMotivationsGenerator(dependencies);

        await expect(
          service.generate(validParams, { maxRetries: 0 })
        ).rejects.toThrow(CoreMotivationsGenerationError);

        const failureCall = dependencies.eventBus.dispatch.mock.calls.at(-1);

        const stage = failureCall[1].failureStage;
        if (stage !== expected) {
          throw new Error(
            `Scenario ${name} expected stage ${expected} but received ${stage}`
          );
        }
      }
    });
  });
});
