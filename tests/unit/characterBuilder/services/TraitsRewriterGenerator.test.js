/**
 * @file Unit tests for TraitsRewriterGenerator
 *
 * Tests the main generator service responsibilities:
 * - Generation workflow orchestration
 * - Trait extraction logic
 * - LLM integration
 * - Response validation
 * - Error handling
 * - Event dispatching
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import TraitsRewriterGenerator from '../../../../src/characterBuilder/services/TraitsRewriterGenerator.js';
import { TraitsRewriterError } from '../../../../src/characterBuilder/errors/TraitsRewriterError.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../../src/characterBuilder/services/characterBuilderService.js';
import * as traitsRewriterPrompts from '../../../../src/characterBuilder/prompts/traitsRewriterPrompts.js';

const { DEFAULT_TRAIT_KEYS } = traitsRewriterPrompts;

/**
 * Create valid character definition for testing
 *
 * @returns {object} Character definition
 */
function createValidCharacterDefinition() {
  return {
    'core:name': { text: 'Test Character' },
    'core:personality': {
      text: 'Analytical and methodical, but prone to overthinking. Has a dry sense of humor.',
    },
    'core:likes': {
      text: 'Books, puzzles, quiet evenings, intellectual conversations.',
    },
    'core:dislikes': {
      text: 'Loud noises, superficial conversations, being rushed.',
    },
    'core:fears': {
      text: 'Being misunderstood, making critical mistakes, social rejection.',
    },
    'core:goals': {
      text: 'To understand complex systems, to help others through knowledge sharing.',
    },
    'core:strengths': {
      text: 'Problem-solving, attention to detail, reliability.',
    },
    'core:weaknesses': {
      text: 'Overthinking, difficulty with spontaneity, can be overly critical.',
    },
    speechPatterns: [
      {
        pattern: 'thoughtful pauses',
        example: 'Well... I think the issue might be...',
      },
      {
        pattern: 'precise language',
        example: "That's not quite accurate. The correct term would be...",
      },
    ],
  };
}

/**
 * Create minimal character definition with only required fields
 *
 * @returns {object} Minimal character definition
 */
function createMinimalCharacterDefinition() {
  return {
    'core:name': { text: 'Minimal Character' },
    'core:personality': { text: 'Simple and direct.' },
  };
}

/**
 * Create expected LLM response
 */
function createValidLLMResponse() {
  return {
    characterName: 'Test Character',
    rewrittenTraits: {
      'core:personality':
        "I approach everything methodically - perhaps too much so. I tend to overthink things, analyzing every angle until I've tied myself in knots. At least my dry sense of humor helps me cope with my own neuroses.",
      'core:likes':
        'I love books and puzzles - anything that challenges my mind. I prefer quiet evenings where I can think deeply, and I cherish those rare intellectual conversations where ideas truly flow.',
      'core:dislikes':
        "Loud noises make me uncomfortable, and I can't stand superficial small talk. Being rushed is my nightmare - I need time to process and consider all angles.",
      'core:fears':
        "My greatest fear is being misunderstood. I'm terrified of making a critical mistake that could hurt someone, and social rejection... well, that keeps me up at night.",
      'core:goals':
        "I want to understand how complex systems work - it's like solving a grand puzzle. More importantly, I hope to help others by sharing what I've learned.",
      'core:strengths':
        "I'm good at solving problems, probably because I notice details others miss. People tell me I'm reliable, which I take as a compliment.",
      'core:weaknesses':
        "I overthink everything - it's both a blessing and a curse. I struggle with spontaneity, and I know I can be overly critical, both of myself and others.",
    },
    generatedAt: new Date().toISOString(),
  };
}

describe('TraitsRewriterGenerator', () => {
  let testBed;
  let generator;
  let mockLogger;
  let mockLlmJsonService;
  let mockLlmStrategyFactory;
  let mockLlmConfigManager;
  let mockEventBus;
  let mockTokenEstimator;

  beforeEach(() => {
    testBed = createTestBed();

    // Create mocks
    mockLogger = testBed.createMockLogger();

    mockLlmJsonService = testBed.createMock('LlmJsonService', [
      'clean',
      'parseAndRepair',
    ]);

    mockLlmStrategyFactory = testBed.createMock('ConfigurableLLMAdapter', [
      'getAIDecision',
    ]);

    mockLlmConfigManager = testBed.createMock('ILLMConfigurationManager', [
      'getActiveConfiguration',
      'getActiveConfigId',
      'setActiveConfiguration',
    ]);

    mockEventBus = testBed.createMock('ISafeEventDispatcher', ['dispatch']);

    mockTokenEstimator = testBed.createMock('ITokenEstimator', [
      'estimateTokens',
    ]);

    // Set up default mock behaviors
    mockLlmConfigManager.getActiveConfiguration.mockReturnValue({
      name: 'test-config',
      provider: 'test-provider',
    });
    mockLlmConfigManager.getActiveConfigId.mockResolvedValue('original-config');
    mockLlmConfigManager.setActiveConfiguration.mockResolvedValue();

    mockLlmStrategyFactory.getAIDecision.mockResolvedValue({
      content: JSON.stringify(createValidLLMResponse()),
    });

    mockLlmJsonService.parseAndRepair.mockImplementation((content) => {
      return JSON.parse(content);
    });

    mockTokenEstimator.estimateTokens.mockReturnValue(1500);

    // Create generator instance
    generator = new TraitsRewriterGenerator({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      llmStrategyFactory: mockLlmStrategyFactory,
      llmConfigManager: mockLlmConfigManager,
      eventBus: mockEventBus,
      tokenEstimator: mockTokenEstimator,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor Validation', () => {
    it('should validate all required dependencies', () => {
      expect(() => {
        new TraitsRewriterGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
          eventBus: mockEventBus,
        });
      }).not.toThrow();
    });

    it('should throw error for missing logger dependency', () => {
      expect(() => {
        new TraitsRewriterGenerator({
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
          eventBus: mockEventBus,
        });
      }).toThrow();
    });

    it('should throw error for missing llmJsonService dependency', () => {
      expect(() => {
        new TraitsRewriterGenerator({
          logger: mockLogger,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
          eventBus: mockEventBus,
        });
      }).toThrow();
    });

    it('should initialize with optional tokenEstimator', () => {
      expect(() => {
        new TraitsRewriterGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
          eventBus: mockEventBus,
          tokenEstimator: mockTokenEstimator,
        });
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'TraitsRewriterGenerator: Initialized successfully'
      );
    });
  });

  describe('Trait Extraction', () => {
    it('should extract all present trait types from character definition', async () => {
      const characterDef = createValidCharacterDefinition();

      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result).toBeDefined();
      expect(result.rewrittenTraits).toBeDefined();
      expect(result.originalTraitCount).toBe(7); // Number of traits in test data
    });

    it('should handle different trait data formats', async () => {
      const characterDef = {
        'core:name': { text: 'Format Test Character' },
        'core:personality': 'Direct string format',
        'core:likes': { text: 'Text property format' },
        'core:dislikes': { description: 'Description property format' },
      };

      mockLlmJsonService.parseAndRepair.mockReturnValue({
        characterName: 'Format Test Character',
        rewrittenTraits: {
          'core:personality': 'I am direct.',
          'core:likes': 'I like text properties.',
          'core:dislikes': 'I dislike description formats.',
        },
      });

      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result.originalTraitCount).toBe(3);
      expect(result.rewrittenTraits).toHaveProperty('core:personality');
      expect(result.rewrittenTraits).toHaveProperty('core:likes');
      expect(result.rewrittenTraits).toHaveProperty('core:dislikes');
    });

    it('should extract array-based traits such as goals and notes', async () => {
      const characterDef = {
        components: {
          'core:name': { text: 'Array Character' },
          'core:personality': { text: 'Contemplative.' },
          'core:goals': {
            goals: [{ text: 'Solve mysteries' }, 'Learn constantly'],
          },
          'core:notes': {
            notes: [{ text: 'Keeps a journal' }, 'Enjoys stargazing'],
          },
        },
      };

      mockLlmJsonService.parseAndRepair.mockReturnValue({
        characterName: 'Array Character',
        rewrittenTraits: {
          'core:personality': 'I am contemplative.',
          'core:goals': 'I will solve mysteries and keep learning.',
          'core:notes': 'I keep a journal and love stargazing.',
        },
      });

      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result.originalTraitCount).toBe(3);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TraitsRewriterGenerator: Extracted traits',
        expect.objectContaining({
          traitKeys: expect.arrayContaining(['core:goals', 'core:notes']),
        })
      );
    });

    it('should throw error when no extractable traits found', async () => {
      const characterDef = {
        'core:name': { text: 'Empty Character' },
        'nonsupported:trait': { text: 'Not supported' },
      };

      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow(TraitsRewriterError);
      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow('No extractable traits found');
    });

    it('should handle missing trait types gracefully', async () => {
      const characterDef = createMinimalCharacterDefinition();

      mockLlmJsonService.parseAndRepair.mockReturnValue({
        characterName: 'Minimal Character',
        rewrittenTraits: {
          'core:personality': 'I am simple and direct.',
        },
      });

      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result.originalTraitCount).toBe(1);
      expect(result.rewrittenTraitCount).toBe(1);
    });

    it('should ignore trait objects without recognized text fields', async () => {
      const characterDef = {
        ...createMinimalCharacterDefinition(),
        'core:weaknesses': { unsupported: 'value' },
      };

      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result.originalTraitCount).toBe(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TraitsRewriterGenerator: Extracted traits',
        expect.objectContaining({
          traitKeys: expect.not.arrayContaining(['core:weaknesses']),
        })
      );
    });
  });

  describe('LLM configuration management', () => {
    it('should temporarily switch and restore LLM configuration when an override is provided', async () => {
      const characterDef = createValidCharacterDefinition();

      await generator.generateRewrittenTraits(characterDef, {
        llmConfigId: 'temporary-config',
      });

      expect(mockLlmConfigManager.setActiveConfiguration).toHaveBeenNthCalledWith(
        1,
        'temporary-config'
      );
      expect(mockLlmConfigManager.setActiveConfiguration).toHaveBeenNthCalledWith(
        2,
        'original-config'
      );
    });

    it('should log an error if restoring the original LLM configuration fails after an error', async () => {
      const characterDef = createValidCharacterDefinition();

      mockLlmConfigManager.setActiveConfiguration
        .mockResolvedValueOnce()
        .mockRejectedValueOnce(new Error('Restore failed'));

      mockLlmJsonService.parseAndRepair.mockReturnValue({
        rewrittenTraits: { 'core:personality': 'Broken response' },
      });

      await expect(
        generator.generateRewrittenTraits(characterDef, {
          llmConfigId: 'temporary-config',
        })
      ).rejects.toThrow('Missing character name in response');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to restore original LLM configuration',
        expect.any(Error)
      );
    });
  });

  describe('LLM Integration', () => {
    it('should create proper prompts with character data', async () => {
      const characterDef = createValidCharacterDefinition();

      await generator.generateRewrittenTraits(characterDef);

      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledWith(
        expect.stringContaining('Test Character'), // First param: prompt string
        null, // Second param: abortSignal
        expect.objectContaining({
          temperature: 0.8,
          maxTokens: 16384,
        }) // Third param: requestOptions
      );
    });

    it('should call LLM service with correct parameters', async () => {
      const characterDef = createValidCharacterDefinition();

      await generator.generateRewrittenTraits(characterDef);

      expect(mockLlmConfigManager.getActiveConfiguration).toHaveBeenCalled();
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalled();
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalled();
    });

    it('should handle LLM service errors gracefully', async () => {
      const characterDef = createValidCharacterDefinition();
      const llmError = new Error('LLM service unavailable');

      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(llmError);

      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow(TraitsRewriterError);
      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow('LLM generation failed');
    });

    it('should handle empty LLM responses', async () => {
      const characterDef = createValidCharacterDefinition();

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue({
        content: null,
      });

      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow(TraitsRewriterError);
      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow('Empty response received from LLM');
    });

    it('should use token estimator when available', async () => {
      const characterDef = createValidCharacterDefinition();

      await generator.generateRewrittenTraits(characterDef);

      expect(mockTokenEstimator.estimateTokens).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TraitsRewriterGenerator: Token estimation',
        expect.objectContaining({
          estimatedTokens: 1500,
        })
      );
    });

    it('should generate traits when token estimation is not available', async () => {
      const characterDef = createValidCharacterDefinition();
      const generatorWithoutEstimator = new TraitsRewriterGenerator({
        logger: mockLogger,
        llmJsonService: mockLlmJsonService,
        llmStrategyFactory: mockLlmStrategyFactory,
        llmConfigManager: mockLlmConfigManager,
        eventBus: mockEventBus,
      });

      mockTokenEstimator.estimateTokens.mockClear();

      const result = await generatorWithoutEstimator.generateRewrittenTraits(
        characterDef
      );

      expect(result.rewrittenTraits).toBeDefined();
      expect(mockTokenEstimator.estimateTokens).not.toHaveBeenCalled();
    });

    it('should throw a descriptive error when prompt creation fails', async () => {
      const characterDef = createValidCharacterDefinition();
      const promptError = new Error('Prompt building exploded');

      const promptSpy = jest
        .spyOn(traitsRewriterPrompts, 'createTraitsRewriterPrompt')
        .mockImplementation(() => {
          throw promptError;
        });

      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow('Failed to create LLM prompt');

      promptSpy.mockRestore();
    });

    it('should unwrap responses returned inside a function_call wrapper', async () => {
      const characterDef = createValidCharacterDefinition();

      mockLlmJsonService.parseAndRepair.mockReturnValue({
        function_call: {
          characterName: 'Wrapped Character',
          rewrittenTraits: {
            'core:personality': 'I am wrapped.',
          },
        },
      });

      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result.characterName).toBe('Wrapped Character');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'TraitsRewriterGenerator: Extracting response from function_call wrapper',
        expect.objectContaining({
          wrapperKeys: expect.arrayContaining(['characterName', 'rewrittenTraits']),
        })
      );
    });

    it('should unwrap responses nested under alternate wrapper properties', async () => {
      const characterDef = createValidCharacterDefinition();

      mockLlmJsonService.parseAndRepair.mockReturnValue({
        tool_output: {
          characterName: 'Tool Character',
          rewrittenTraits: {
            'core:personality': 'Tool based response.',
          },
        },
      });

      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result.characterName).toBe('Tool Character');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'TraitsRewriterGenerator: Found response in wrapper property',
        expect.objectContaining({ wrapperProperty: 'tool_output' })
      );
    });

    it('should accept LLM responses provided as raw JSON strings', async () => {
      const characterDef = createValidCharacterDefinition();

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify({
          characterName: 'String Response',
          rewrittenTraits: {
            'core:personality': 'I was returned as a string.',
          },
        })
      );

      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result.characterName).toBe('String Response');
    });
  });

  describe('Response Validation', () => {
    it('should validate successful generation responses', async () => {
      const characterDef = createValidCharacterDefinition();

      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result).toHaveProperty('characterName');
      expect(result).toHaveProperty('rewrittenTraits');
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('originalTraitCount');
      expect(result).toHaveProperty('rewrittenTraitCount');
    });

    it('should throw error for missing character name in response', async () => {
      const characterDef = createValidCharacterDefinition();

      mockLlmJsonService.parseAndRepair.mockReturnValue({
        rewrittenTraits: { 'core:personality': 'I am someone.' },
      });

      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow(TraitsRewriterError);
      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow('Missing character name in response');
    });

    it('should throw error for missing rewritten traits in response', async () => {
      const characterDef = createValidCharacterDefinition();

      mockLlmJsonService.parseAndRepair.mockReturnValue({
        characterName: 'Test Character',
      });

      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow(TraitsRewriterError);
      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow('Missing or invalid rewritten traits object');
    });

    it('should throw error for empty rewritten traits', async () => {
      const characterDef = createValidCharacterDefinition();

      mockLlmJsonService.parseAndRepair.mockReturnValue({
        characterName: 'Test Character',
        rewrittenTraits: {},
      });

      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow(TraitsRewriterError);
      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow('No traits were rewritten');
    });

    it('should warn about invalid trait keys but continue processing', async () => {
      const characterDef = createValidCharacterDefinition();

      mockLlmJsonService.parseAndRepair.mockReturnValue({
        characterName: 'Test Character',
        rewrittenTraits: {
          'core:personality': 'I am valid.',
          'invalid:trait': 'This should cause a warning.',
        },
      });

      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'TraitsRewriterGenerator: Response contains unsupported trait keys',
        expect.objectContaining({
          invalidKeys: ['invalid:trait'],
        })
      );
    });

    it('should throw a validation error when the extracted response is null', async () => {
      const characterDef = createValidCharacterDefinition();

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue({
        content: 'null',
      });
      mockLlmJsonService.parseAndRepair.mockReturnValue(null);

      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow('Null or undefined response');
    });

    it('should handle wrapper candidates that do not contain the required fields', async () => {
      const characterDef = createValidCharacterDefinition();

      mockLogger.info.mockClear();
      mockLlmJsonService.parseAndRepair.mockReturnValue({
        wrapper: { irrelevant: true },
      });

      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow('Missing character name in response');

      expect(mockLogger.info).not.toHaveBeenCalledWith(
        'TraitsRewriterGenerator: Found response in wrapper property',
        expect.anything()
      );
    });
  });

  describe('Event Dispatching', () => {
    it('should dispatch GENERATION_STARTED event', async () => {
      const characterDef = createValidCharacterDefinition();

      await generator.generateRewrittenTraits(characterDef);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_STARTED,
        expect.objectContaining({
          characterName: 'Test Character',
          timestamp: expect.any(String),
        })
      );
    });

    it('should dispatch GENERATION_COMPLETED on success', async () => {
      const characterDef = createValidCharacterDefinition();

      await generator.generateRewrittenTraits(characterDef);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_COMPLETED,
        expect.objectContaining({
          characterName: 'Test Character',
          result: expect.any(Object),
          processingTime: expect.any(Number),
          timestamp: expect.any(String),
        })
      );
    });

    it('should dispatch GENERATION_FAILED on errors', async () => {
      const characterDef = createValidCharacterDefinition();
      const error = new Error('Test error');

      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(error);

      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow();

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_FAILED,
        expect.objectContaining({
          error: expect.stringContaining('Test error'),
          characterName: 'Test Character',
          timestamp: expect.any(String),
        })
      );
    });

    it('should handle event dispatch failures gracefully', async () => {
      const characterDef = createValidCharacterDefinition();

      mockEventBus.dispatch.mockImplementation(() => {
        throw new Error('Event dispatch failed');
      });

      // Should still complete generation successfully
      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TraitsRewriterGenerator: Event dispatch failed',
        expect.objectContaining({
          error: 'Event dispatch failed',
        })
      );
    });
  });

  describe('Character Name Extraction', () => {
    it('should extract character name from string format', async () => {
      const characterDef = {
        'core:name': 'String Name Character',
        'core:personality': { text: 'Has a string name.' },
      };

      mockLlmJsonService.parseAndRepair.mockReturnValue({
        characterName: 'String Name Character',
        rewrittenTraits: { 'core:personality': 'I have a string name.' },
      });

      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result.characterName).toBe('String Name Character');
    });

    it('should extract character name from text property', async () => {
      const characterDef = createValidCharacterDefinition();

      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result.characterName).toBe('Test Character');
    });

    it('should extract character name from name property', async () => {
      const characterDef = {
        'core:name': { name: 'Name Property Character' },
        'core:personality': { text: 'Has a name property.' },
      };

      mockLlmJsonService.parseAndRepair.mockReturnValue({
        characterName: 'Name Property Character',
        rewrittenTraits: { 'core:personality': 'I have a name property.' },
      });

      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result.characterName).toBe('Name Property Character');
    });

    it('should use fallback name when extraction fails', async () => {
      const characterDef = {
        'core:personality': { text: 'I have no name.' },
      };

      mockLlmJsonService.parseAndRepair.mockReturnValue({
        characterName: 'Unknown Character',
        rewrittenTraits: { 'core:personality': 'I have no name.' },
      });

      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result.characterName).toBe('Unknown Character');
    });

    it('should fall back when name object lacks text or name fields', async () => {
      const characterDef = {
        'core:name': { alias: 'Mysterious' },
        'core:personality': { text: 'Ambiguous identity.' },
      };

      mockLlmJsonService.parseAndRepair.mockReturnValue({
        characterName: 'Unknown Character',
        rewrittenTraits: { 'core:personality': 'Ambiguous identity.' },
      });

      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result.characterName).toBe('Unknown Character');
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM generation failures', async () => {
      const characterDef = createValidCharacterDefinition();

      // Mock LLM strategy to throw an error
      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(
        new Error('LLM generation failed')
      );

      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow(TraitsRewriterError);
    });

    it('should provide comprehensive error context', async () => {
      const characterDef = createValidCharacterDefinition();
      const originalError = new Error('Original failure');

      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(originalError);

      try {
        await generator.generateRewrittenTraits(characterDef);
      } catch (error) {
        expect(error).toBeInstanceOf(TraitsRewriterError);
        expect(error.message).toContain('LLM generation failed');
        expect(error.cause).toBe(originalError);
      }
    });

    it('should log errors with proper context', async () => {
      const characterDef = createValidCharacterDefinition();
      const error = new Error('Test error');

      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(error);

      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'TraitsRewriterGenerator: Generation failed',
        expect.objectContaining({
          error: expect.stringContaining('LLM generation failed: Test error'),
          characterName: 'Test Character',
          processingTime: expect.any(Number),
          timestamp: expect.any(String),
          errorType: 'TraitsRewriterError',
          errorMessage: expect.stringContaining(
            'LLM generation failed: Test error'
          ),
        })
      );
    });

    it('should convert unexpected errors during token estimation into TraitsRewriterError instances', async () => {
      const characterDef = createValidCharacterDefinition();

      mockTokenEstimator.estimateTokens.mockImplementation(() => {
        throw new Error('Token estimation failed');
      });

      await expect(
        generator.generateRewrittenTraits(characterDef)
      ).rejects.toThrow('Token estimation failed');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_FAILED,
        expect.objectContaining({ error: 'Token estimation failed' })
      );
    });
  });

  describe('Service Information', () => {
    it('should return correct service information', () => {
      const info = generator.getServiceInfo();

      expect(info).toEqual({
        name: 'TraitsRewriterGenerator',
        version: '1.0.0',
        status: 'active',
        supportedTraitTypes: DEFAULT_TRAIT_KEYS,
        implementationStatus: 'completed',
      });
    });

    it('should expose the JSON schema used for response validation', () => {
      expect(generator.getResponseSchema()).toBe(
        traitsRewriterPrompts.TRAITS_REWRITER_RESPONSE_SCHEMA
      );
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete generation workflow successfully', async () => {
      const characterDef = createValidCharacterDefinition();

      const result = await generator.generateRewrittenTraits(characterDef);

      // Verify complete workflow
      expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2); // Started + Completed
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalled();
      expect(mockLlmJsonService.parseAndRepair).toHaveBeenCalled();
      expect(result).toMatchObject({
        characterName: 'Test Character',
        rewrittenTraits: expect.any(Object),
        generatedAt: expect.any(String),
        processingTime: expect.any(Number),
        originalTraitCount: expect.any(Number),
        rewrittenTraitCount: expect.any(Number),
      });
    });

    it('should track processing time accurately', async () => {
      const characterDef = createValidCharacterDefinition();

      // Add a small delay to the LLM mock to ensure processing time > 0
      mockLlmStrategyFactory.getAIDecision.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5)); // 5ms delay
        return {
          content: JSON.stringify(createValidLLMResponse()),
        };
      });

      const result = await generator.generateRewrittenTraits(characterDef);

      expect(result.processingTime).toBeGreaterThan(0);
      expect(typeof result.processingTime).toBe('number');
    });

    it('should handle concurrent generation requests', async () => {
      const characterDef1 = createValidCharacterDefinition();
      const characterDef2 = {
        ...characterDef1,
        'core:name': { text: 'Character 2' },
      };

      mockLlmJsonService.parseAndRepair
        .mockReturnValueOnce({
          characterName: 'Test Character',
          rewrittenTraits: { 'core:personality': 'I am character 1.' },
        })
        .mockReturnValueOnce({
          characterName: 'Character 2',
          rewrittenTraits: { 'core:personality': 'I am character 2.' },
        });

      const [result1, result2] = await Promise.all([
        generator.generateRewrittenTraits(characterDef1),
        generator.generateRewrittenTraits(characterDef2),
      ]);

      expect(result1.characterName).toBe('Test Character');
      expect(result2.characterName).toBe('Character 2');
    });
  });
});
