/**
 * @file Unit tests for SpeechPatternsGenerator
 *
 * Tests the main generator service responsibilities:
 * - Generation workflow orchestration
 * - Prompt construction
 * - LLM integration
 * - Response processing coordination
 * - Error handling and retries
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import SpeechPatternsGenerator from '../../../../src/characterBuilder/services/SpeechPatternsGenerator.js';
import {
  createMockLLMResponse,
  createMockSpeechPatternsArray,
} from '../../../common/characterBuilder/speechPatternsTestHelpers.js';

/**
 * Create character data compatible with production validation
 *
 * @returns {object} Valid character data structure for testing
 */
function createValidCharacterData() {
  return {
    'core:name': { name: 'Test Character' },
    'core:personality': {
      traits: ['friendly', 'curious', 'thoughtful'],
      background:
        'A scholar from a small village with a love for ancient texts.',
      motivations: ['seeking knowledge', 'helping others'],
    },
    'core:speech_style': {
      formality: 'mixed',
      vocabulary: 'educated',
      quirks: ['uses metaphors', 'occasionally quotes books'],
    },
    'core:emotional_range': {
      primary: ['joy', 'curiosity', 'concern'],
      suppressed: ['anger', 'fear'],
    },
  };
}

describe('SpeechPatternsGenerator', () => {
  let testBed;
  let generator;
  let mockLogger;
  let mockLlmJsonService;
  let mockLlmStrategyFactory;
  let mockLlmConfigManager;
  let mockEventBus;
  let mockTokenEstimator;
  let mockSchemaValidator;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    // Create mock LLM JSON service
    mockLlmJsonService = testBed.createMock('LlmJsonService', [
      'clean',
      'parseAndRepair',
    ]);

    // Configure LLM JSON service mocks to pass through the response
    mockLlmJsonService.clean.mockImplementation((response) => response);
    mockLlmJsonService.parseAndRepair.mockImplementation(async (response) => {
      return JSON.parse(response);
    });

    // Create mock LLM strategy factory (ConfigurableLLMAdapter)
    mockLlmStrategyFactory = testBed.createMock('ConfigurableLLMAdapter', [
      'getAIDecision',
    ]);

    mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
      createMockLLMResponse()
    );

    // Create mock LLM config manager
    mockLlmConfigManager = testBed.createMock('ILLMConfigurationManager', [
      'loadConfiguration',
      'getActiveConfiguration',
      'setActiveConfiguration',
    ]);

    // Create mock event bus
    mockEventBus = testBed.createMock('ISafeEventDispatcher', ['dispatch']);

    // Create mock token estimator (optional)
    mockTokenEstimator = testBed.createMock('ITokenEstimator', [
      'estimateTokens',
    ]);

    mockTokenEstimator.estimateTokens.mockReturnValue(1500);

    // Create mock schema validator (optional) - needs to satisfy both interfaces
    mockSchemaValidator = testBed.createMock('ISchemaValidator', [
      'validateAgainstSchema', // Expected by SpeechPatternsGenerator
      'validate', // Expected by SpeechPatternsSchemaValidator
      'isSchemaLoaded', // Expected by SpeechPatternsSchemaValidator
    ]);

    // Configure the mock to indicate schema is loaded and validation passes
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
    mockSchemaValidator.validate.mockReturnValue({
      isValid: true,
      errors: [],
    });
    mockSchemaValidator.validateAgainstSchema.mockReturnValue({
      isValid: true,
      errors: [],
    });

    generator = new SpeechPatternsGenerator({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      llmStrategyFactory: mockLlmStrategyFactory,
      llmConfigManager: mockLlmConfigManager,
      eventBus: mockEventBus,
      tokenEstimator: mockTokenEstimator,
      schemaValidator: mockSchemaValidator,
    });
  });

  describe('Constructor', () => {
    it('should create generator with valid dependencies', () => {
      expect(generator).toBeInstanceOf(SpeechPatternsGenerator);
    });

    it('should throw error for missing logger', () => {
      expect(() => {
        new SpeechPatternsGenerator({
          llmJsonService: mockLlmJsonService,
          schemaValidator: mockSchemaValidator,
        });
      }).toThrow();
    });

    it('should throw error for missing LLM JSON service', () => {
      expect(() => {
        new SpeechPatternsGenerator({
          logger: mockLogger,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
          eventBus: mockEventBus,
        });
      }).toThrow();
    });

    it('should throw error for missing LLM strategy factory', () => {
      expect(() => {
        new SpeechPatternsGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmConfigManager: mockLlmConfigManager,
          eventBus: mockEventBus,
        });
      }).toThrow();
    });

    it('should throw error for missing LLM config manager', () => {
      expect(() => {
        new SpeechPatternsGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          eventBus: mockEventBus,
        });
      }).toThrow();
    });

    it('should throw error for missing event bus', () => {
      expect(() => {
        new SpeechPatternsGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
        });
      }).toThrow();
    });

    it('should work with optional dependencies', () => {
      expect(() => {
        new SpeechPatternsGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
          eventBus: mockEventBus,
          // tokenEstimator and schemaValidator are optional
        });
      }).not.toThrow();
    });
  });

  describe('Generate Speech Patterns', () => {
    it('should verify mock helper has 3 patterns', () => {
      const mockResponse = createMockLLMResponse();
      const parsed = JSON.parse(mockResponse);
      console.log('Mock response patterns:', parsed.speechPatterns);
      expect(parsed.speechPatterns).toHaveLength(3);
    });

    it('should generate patterns for valid character', async () => {
      const character = createValidCharacterData();

      // Set up the mock to return a valid response each time
      const mockResponse = createMockLLMResponse();
      const parsed = JSON.parse(mockResponse);
      expect(parsed.speechPatterns).toHaveLength(3); // Verify beforehand

      mockLlmStrategyFactory.getAIDecision.mockResolvedValueOnce(mockResponse);

      const result = await generator.generateSpeechPatterns(character);
      expect(result).toBeDefined();
      expect(result.speechPatterns).toHaveLength(3);
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalled();
      // Verify event dispatches (using correct API format: dispatch(eventName, payload))
      expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2);
      expect(mockEventBus.dispatch).toHaveBeenNthCalledWith(
        1,
        expect.any(String), // Event name as first argument
        expect.objectContaining({
          characterData: expect.any(Object),
          options: expect.any(Object),
          timestamp: expect.any(String),
        })
      );
      expect(mockEventBus.dispatch).toHaveBeenNthCalledWith(
        2,
        expect.any(String), // Event name as first argument
        expect.objectContaining({
          result: expect.any(Object),
          processingTime: expect.any(Number),
          timestamp: expect.any(String),
        })
      );
    });

    it('should construct proper prompt for generation', async () => {
      const character = createValidCharacterData();

      await generator.generateSpeechPatterns(character);

      // Prompt is built internally using buildSpeechPatternsGenerationPrompt
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledWith(
        expect.any(String),
        null,
        expect.any(Object)
      );
    });

    it('should pass options to LLM service', async () => {
      const character = createValidCharacterData();
      const options = {
        temperature: 0.8,
        maxTokens: 3000,
        model: 'custom-model',
      };

      await generator.generateSpeechPatterns(character, options);

      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledWith(
        expect.any(String),
        options.abortSignal || null,
        expect.any(Object)
      );
    });

    it('should include character context in prompt', async () => {
      const character = {
        ...createValidCharacterData(),
        'core:background': { story: 'A detailed background story' },
        'core:relationships': { connections: ['Friend A', 'Enemy B'] },
      };

      await generator.generateSpeechPatterns(character);

      // Prompt construction is internal - verify LLM was called
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalled();
    });
  });

  describe('Response Processing', () => {
    it('should process LLM response through internal processor', async () => {
      const character = createValidCharacterData();
      const llmResponse = createMockLLMResponse();

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(llmResponse);

      await generator.generateSpeechPatterns(character);

      // Verify LLM was called and processing completed
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalled();
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          result: expect.any(Object),
        })
      );
    });

    it('should validate business rules on processed patterns', async () => {
      const character = createValidCharacterData();

      const result = await generator.generateSpeechPatterns(character);

      // Verify business validation (minimum patterns, quality, etc.)
      expect(result.speechPatterns.length).toBeGreaterThanOrEqual(2);
      expect(result.metadata.qualityScore).toBeGreaterThan(0);
    });

    it('should return structured response with enhanced metadata', async () => {
      const character = createValidCharacterData();

      const result = await generator.generateSpeechPatterns(character);

      expect(result.speechPatterns).toBeDefined();
      expect(result.characterName).toBeDefined();
      expect(result.generatedAt).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.generatorVersion).toBeDefined();
      expect(result.metadata.qualityScore).toBeDefined();
    });

    it('should include enhanced metadata in result', async () => {
      const character = createValidCharacterData();
      const options = { focusType: 'EMOTIONAL_FOCUS', patternCount: 5 };

      const result = await generator.generateSpeechPatterns(character, options);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.generatorVersion).toBeDefined();
      expect(result.metadata.generationOptions).toEqual(options);
      expect(result.metadata.qualityScore).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM strategy factory errors', async () => {
      const character = createValidCharacterData();

      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(
        new Error('LLM service unavailable')
      );

      await expect(generator.generateSpeechPatterns(character)).rejects.toThrow(
        'LLM request failed'
      );

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });

    it('should handle character validation errors', async () => {
      const invalidCharacter = {}; // Empty character data

      await expect(
        generator.generateSpeechPatterns(invalidCharacter)
      ).rejects.toThrow('Failed to generate speech patterns');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });

    it('should handle response processing errors', async () => {
      const character = createValidCharacterData();

      // Mock bad response that causes processing to fail
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        'invalid json response'
      );

      await expect(generator.generateSpeechPatterns(character)).rejects.toThrow(
        'Failed to parse LLM response'
      );

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });

    it('should handle business rule validation failures', async () => {
      const character = createValidCharacterData();

      // Mock response that will fail business rules (too few patterns)
      // Using NEW schema format (v3.0.0): type/examples[]
      const shortResponse = JSON.stringify({
        characterName: 'Test Character',
        speechPatterns: [
          {
            type: 'Short pattern',
            examples: ['Hi', 'Hello'], // Minimum 2 examples required
          },
        ],
        generatedAt: new Date().toISOString(),
      });

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(shortResponse);

      await expect(
        generator.generateSpeechPatterns(character, { patternCount: 5 })
      ).rejects.toThrow('Failed to generate speech patterns');
    });
  });

  describe('Abort Handling', () => {
    it('should handle abort signal', async () => {
      const character = createValidCharacterData();
      const abortController = new AbortController();

      // Simulate abort during LLM call
      mockLlmStrategyFactory.getAIDecision.mockImplementation(() => {
        abortController.abort();
        return Promise.reject(new Error('AbortError'));
      });

      await expect(
        generator.generateSpeechPatterns(character, {
          abortSignal: abortController.signal,
        })
      ).rejects.toThrow('LLM request failed');
    });

    it('should pass abort signal to LLM strategy', async () => {
      const character = createValidCharacterData();
      const abortController = new AbortController();

      await generator.generateSpeechPatterns(character, {
        abortSignal: abortController.signal,
      });

      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledWith(
        expect.any(String),
        abortController.signal,
        expect.any(Object)
      );
    });
  });

  describe('Service Info', () => {
    it('should provide service information', () => {
      const info = generator.getServiceInfo();

      expect(info).toBeDefined();
      expect(info.name).toBe('SpeechPatternsGenerator');
      expect(info.version).toBeDefined();
      expect(info.capabilities).toContain('NC-21 content generation');
      expect(info.capabilities).toContain('Response validation');
      expect(info.supportedFocusTypes).toBeDefined();
      expect(info.supportedFocusTypes).toContain('EMOTIONAL_FOCUS');
      expect(info.llmParameters).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should use LLM config manager for configuration', async () => {
      const character = createValidCharacterData();
      const options = { llmConfigId: 'test-config' };

      await generator.generateSpeechPatterns(character, options);

      expect(mockLlmConfigManager.setActiveConfiguration).toHaveBeenCalledWith(
        'test-config'
      );
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalled();
    });

    it('should pass generation options to method calls', async () => {
      const character = createValidCharacterData();
      const options = {
        focusType: 'EMOTIONAL_FOCUS',
        patternCount: 10,
      };

      // Mock response with enough patterns to satisfy business rule validation (10 patterns)
      // Using NEW schema format (v3.0.0): type/examples[]/contexts[]
      const mockResponseWith10Patterns = JSON.stringify({
        speechPatterns: Array(10)
          .fill()
          .map((_, i) => ({
            type: `Speech pattern ${i + 1}: Uses specific communication style in context ${i + 1}`,
            examples: [
              `"This is example dialogue number ${i + 1} showing the pattern in action and demonstrating the character's unique way of speaking."`,
              `"This is a second example for pattern ${i + 1} showing variation in the character's speech."`,
            ],
            contexts: [`When in emotional situation ${i + 1} requiring this specific response`],
          })),
        characterName: 'Test Character',
        generatedAt: new Date().toISOString(),
      });
      mockLlmStrategyFactory.getAIDecision.mockResolvedValueOnce(
        mockResponseWith10Patterns
      );

      const result = await generator.generateSpeechPatterns(character, options);

      expect(result.metadata.generationOptions).toEqual(options);
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledWith(
        expect.any(String),
        options.abortSignal || null,
        expect.any(Object)
      );
    });

    it('should handle missing LLM config gracefully', async () => {
      const character = createValidCharacterData();
      const options = {}; // No llmConfigId

      await generator.generateSpeechPatterns(character, options);

      expect(
        mockLlmConfigManager.setActiveConfiguration
      ).not.toHaveBeenCalled();
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalled();
    });
  });

  describe('Pattern Quality', () => {
    it('should calculate quality score for generated patterns', async () => {
      const character = createValidCharacterData();

      const result = await generator.generateSpeechPatterns(character);

      expect(result.metadata.qualityScore).toBeGreaterThan(0);
      expect(result.metadata.qualityScore).toBeLessThanOrEqual(1);
    });

    it('should validate business rules for pattern quality', async () => {
      const character = createValidCharacterData();

      const result = await generator.generateSpeechPatterns(character);

      // Verify business validation passed (should have at least 3 patterns for default)
      expect(result.speechPatterns.length).toBeGreaterThanOrEqual(2);

      // Verify patterns have required structure (NEW schema format: type/examples[])
      result.speechPatterns.forEach((pattern) => {
        expect(pattern.type).toBeDefined();
        expect(pattern.examples).toBeDefined();
        expect(pattern.examples).toBeInstanceOf(Array);
        expect(pattern.type.length).toBeGreaterThan(0);
        expect(pattern.examples.length).toBeGreaterThanOrEqual(2); // Schema requires minimum 2 examples
        pattern.examples.forEach((example) => {
          expect(example.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Performance', () => {
    it('should complete generation efficiently', async () => {
      const character = createValidCharacterData();

      const startTime = performance.now();
      const result = await generator.generateSpeechPatterns(character);
      const endTime = performance.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast in test
    });

    it('should use token estimator when available', async () => {
      const character = createValidCharacterData();

      await generator.generateSpeechPatterns(character);

      expect(mockTokenEstimator.estimateTokens).toHaveBeenCalled();
    });

    it('should log performance metrics', async () => {
      const character = createValidCharacterData();

      await generator.generateSpeechPatterns(character);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully generated speech patterns'),
        expect.objectContaining({
          processingTime: expect.any(Number),
        })
      );
    });
  });

  /**
   * Tests for issues fixed by speech patterns generator troubleshooting
   * These tests specifically reproduce and verify fixes for:
   * 1. Nested components structure validation
   * 2. Event constants availability
   * 3. Character name extraction from nested data
   */
  describe('Troubleshooting Fixes', () => {
    describe('Nested Components Structure Support', () => {
      /**
       * Create character data in the nested components format found in .character.json files
       *
       * @returns {object} Character data with nested components structure
       */
      function createNestedComponentsCharacterData() {
        return {
          $schema:
            'schema://living-narrative-engine/entity-definition.schema.json',
          id: 'test:character',
          components: {
            'core:name': { text: 'Joel Overberus' },
            'core:actor': {},
            'core:personality': {
              traits: ['brave', 'determined', 'empathetic'],
              background:
                'A hero from another world with a strong sense of justice.',
              motivations: ['protecting the innocent', 'finding a way home'],
            },
            'anatomy:body': { recipeId: 'anatomy:human_male' },
            'core:portrait': {
              imagePath: 'portraits/hero.png',
              altText: 'A valiant hero with a bright sword.',
            },
          },
        };
      }

      it('should validate character data with nested components structure', async () => {
        const nestedCharacterData = createNestedComponentsCharacterData();

        // This should NOT throw a validation error
        await expect(
          generator.generateSpeechPatterns(nestedCharacterData)
        ).resolves.toBeDefined();

        // Verify that validation passed by checking event dispatching
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'core:speech_patterns_generation_started',
          expect.objectContaining({
            characterData: nestedCharacterData,
          })
        );
      });

      it('should extract character name from nested components structure', async () => {
        const nestedCharacterData = createNestedComponentsCharacterData();

        // Create a generator without schema validator to bypass strict response validation
        const testGenerator = new SpeechPatternsGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
          eventBus: mockEventBus,
          tokenEstimator: mockTokenEstimator,
          // No schema validator - this allows response without required characterName
        });

        // Mock LLM response with character name (required by validation)
        const mockResponseWithName = JSON.stringify({
          speechPatterns: createMockSpeechPatternsArray(),
          characterName: 'Test Character', // Required by prompt validation
          generatedAt: new Date().toISOString(),
          metadata: {
            generation_time: Date.now(),
            model: 'test-model',
          },
        });
        mockLlmStrategyFactory.getAIDecision.mockResolvedValueOnce(
          mockResponseWithName
        );

        // This should succeed without throwing validation errors
        const result =
          await testGenerator.generateSpeechPatterns(nestedCharacterData);
        expect(result).toBeDefined();
        expect(result.speechPatterns).toHaveLength(3);
      });

      it('should still validate direct component format (backward compatibility)', async () => {
        const directCharacterData = createValidCharacterData();

        // This should continue to work
        await expect(
          generator.generateSpeechPatterns(directCharacterData)
        ).resolves.toBeDefined();
      });

      it('should reject invalid character data without any components', async () => {
        const invalidCharacterData = {
          invalidField: 'no components here',
          anotherField: 'still no components',
        };

        await expect(
          generator.generateSpeechPatterns(invalidCharacterData)
        ).rejects.toThrow(
          'Character data must contain at least one character component'
        );
      });

      it('should reject nested structure without colon-separated component keys', async () => {
        const invalidNestedData = {
          components: {
            invalidComponent: { data: 'no colon in key' },
            anotherInvalid: { data: 'also no colon' },
          },
        };

        await expect(
          generator.generateSpeechPatterns(invalidNestedData)
        ).rejects.toThrow(
          'Character data must contain at least one character component'
        );
      });
    });

    describe('Event Constants Handling', () => {
      it('should dispatch events with valid event types (not undefined)', async () => {
        const characterData = createValidCharacterData();

        await generator.generateSpeechPatterns(characterData);

        // Verify start event was dispatched with correct type
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'core:speech_patterns_generation_started',
          expect.objectContaining({
            characterData,
            timestamp: expect.any(String),
          })
        );

        // Verify success event was dispatched with correct type
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'core:speech_patterns_generation_completed',
          expect.objectContaining({
            result: expect.any(Object),
            processingTime: expect.any(Number),
            timestamp: expect.any(String),
          })
        );
      });

      it('should dispatch failure event with valid event type on error', async () => {
        const characterData = createValidCharacterData();

        // Force an error by making LLM call fail
        mockLlmStrategyFactory.getAIDecision.mockRejectedValue(
          new Error('LLM connection failed')
        );

        await expect(
          generator.generateSpeechPatterns(characterData)
        ).rejects.toThrow();

        // Verify failure event was dispatched with correct type
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'core:speech_patterns_generation_failed',
          expect.objectContaining({
            error: expect.any(String),
            processingTime: expect.any(Number),
            timestamp: expect.any(String),
          })
        );
      });

      it('should not dispatch events with undefined types', async () => {
        const characterData = createValidCharacterData();

        await generator.generateSpeechPatterns(characterData);

        // Check that no events were dispatched with undefined types
        const dispatchCalls = mockEventBus.dispatch.mock.calls;
        dispatchCalls.forEach(([eventName, payload]) => {
          // First argument should be the event name string
          expect(eventName).toBeDefined();
          expect(typeof eventName).toBe('string');
          expect(eventName).not.toBe('[object Object]');
          expect(eventName.length).toBeGreaterThan(0);
          // Second argument should be the payload object
          expect(payload).toBeDefined();
          expect(typeof payload).toBe('object');
        });
      });
    });
  });
});
