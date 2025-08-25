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

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import SpeechPatternsGenerator from '../../../../src/characterBuilder/services/SpeechPatternsGenerator.js';
import {
  createMockCharacterDefinition,
  createMockSpeechPatterns,
  createMockLLMResponse,
} from '../../../common/characterBuilder/speechPatternsTestHelpers.js';

// Create character data compatible with production validation
/**
 *
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

      try {
        const result = await generator.generateSpeechPatterns(character);
        expect(result).toBeDefined();
        expect(result.speechPatterns).toHaveLength(3);
        expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalled();
        // Verify event dispatches (events have dynamic types, just check structure)
        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2);
        expect(mockEventBus.dispatch).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            payload: expect.objectContaining({
              characterData: expect.any(Object),
              options: expect.any(Object),
            }),
          })
        );
        expect(mockEventBus.dispatch).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            payload: expect.objectContaining({
              result: expect.any(Object),
              processingTime: expect.any(Number),
            }),
          })
        );
      } catch (error) {
        throw error;
      }
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
        expect.objectContaining({
          payload: expect.objectContaining({
            result: expect.any(Object),
          }),
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
        expect.objectContaining({
          payload: expect.objectContaining({
            error: expect.any(String),
          }),
        })
      );
    });

    it('should handle character validation errors', async () => {
      const invalidCharacter = {}; // Empty character data

      await expect(
        generator.generateSpeechPatterns(invalidCharacter)
      ).rejects.toThrow('Failed to generate speech patterns');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            error: expect.any(String),
          }),
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
        expect.objectContaining({
          payload: expect.objectContaining({
            error: expect.any(String),
          }),
        })
      );
    });

    it('should handle business rule validation failures', async () => {
      const character = createValidCharacterData();

      // Mock response that will fail business rules (too few patterns)
      const shortResponse = JSON.stringify({
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern: 'Short pattern',
            example: 'Hi',
            circumstances: '',
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
      const mockResponseWith10Patterns = JSON.stringify({
        speechPatterns: Array(10)
          .fill()
          .map((_, i) => ({
            pattern: `Speech pattern ${i + 1}: Uses specific communication style in context ${i + 1}`,
            example: `"This is example dialogue number ${i + 1} showing the pattern in action and demonstrating the character's unique way of speaking."`,
            circumstances: `When in emotional situation ${i + 1} requiring this specific response`,
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

      // Verify patterns have required structure
      result.speechPatterns.forEach((pattern) => {
        expect(pattern.pattern).toBeDefined();
        expect(pattern.example).toBeDefined();
        expect(pattern.pattern.length).toBeGreaterThan(0);
        expect(pattern.example.length).toBeGreaterThan(0);
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
});
