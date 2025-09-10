/**
 * @file Runtime error reproduction test for TraitsRewriterGenerator
 *
 * This test reproduces the actual runtime error that occurs when
 * TraitsRewriterGenerator incorrectly calls ConfigurableLLMAdapter.getAIDecision
 * with an object instead of a string as the first parameter.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import TraitsRewriterGenerator from '../../../../src/characterBuilder/services/TraitsRewriterGenerator.js';
import { TraitsRewriterError } from '../../../../src/characterBuilder/errors/TraitsRewriterError.js';

describe('TraitsRewriterGenerator - Runtime Error Reproduction', () => {
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

    // Create a mock that simulates the actual ConfigurableLLMAdapter behavior
    mockLlmStrategyFactory = testBed.createMock('ConfigurableLLMAdapter', [
      'getAIDecision',
    ]);

    mockLlmConfigManager = testBed.createMock('ILLMConfigurationManager', [
      'getActiveConfiguration',
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

    mockTokenEstimator.estimateTokens.mockReturnValue(1500);

    // Simulate the actual ConfigurableLLMAdapter.getAIDecision behavior
    // It expects a string as the first parameter (gameSummary)
    mockLlmStrategyFactory.getAIDecision.mockImplementation(
      async (gameSummary, abortSignal, requestOptions) => {
        // This mimics the actual validation in llmRequestExecutor.js
        if (typeof gameSummary !== 'string') {
          throw new Error('LLMRequestExecutor: gameSummary must be a string');
        }

        // Return a successful response if validation passes
        return {
          content: JSON.stringify({
            characterName: 'Test Character',
            rewrittenTraits: {
              'core:personality': 'I am analytical and methodical...',
            },
            generatedAt: new Date().toISOString(),
          }),
        };
      }
    );

    mockLlmJsonService.parseAndRepair.mockImplementation((content) => {
      return JSON.parse(content);
    });

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

  describe('Runtime Error - Fixed API Call', () => {
    it('should now work correctly after fixing getAIDecision to be called with correct parameters', async () => {
      // This is the actual character definition from the error scenario
      const characterDef = {
        'core:name': { text: 'Juan Mendarte' },
        'core:personality': {
          text: 'Juan approaches his manipulation of Julen with the same systematic approach...',
        },
        'core:likes': {
          text: 'Spending time after work at home to be around Julen...',
        },
        'core:speech_patterns': {
          patterns: [
            {
              pattern: 'planning his manipulation strategies',
              example: 'The boy just needs the right pressure applied...',
            },
          ],
        },
      };

      // After the fix, this should work correctly
      const result = await generator.generateRewrittenTraits(characterDef);

      // Verify the result has the expected structure
      expect(result).toHaveProperty('characterName');
      expect(result).toHaveProperty('rewrittenTraits');
      expect(result.rewrittenTraits).toHaveProperty('core:personality');

      // Verify that getAIDecision was called correctly (with string as first param)
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalled();

      // The first argument should now be a string (the prompt)
      const firstCallArgs = mockLlmStrategyFactory.getAIDecision.mock.calls[0];
      expect(typeof firstCallArgs[0]).toBe('string');
      expect(firstCallArgs[0]).toContain('Juan Mendarte'); // The prompt should contain the character name

      // The second argument should be null (abort signal)
      expect(firstCallArgs[1]).toBeNull();

      // The third argument should be the request options object
      expect(typeof firstCallArgs[2]).toBe('object');
      expect(firstCallArgs[2]).toHaveProperty('temperature');
      expect(firstCallArgs[2]).toHaveProperty('maxTokens');
    });

    it('should handle the Juan Mendarte character definition without errors', async () => {
      // Use the full character definition from the .private file
      const fullCharacterDef = {
        'core:name': { text: 'Juan Mendarte' },
        'core:personality': {
          text: 'Juan approaches his manipulation of Julen with the same systematic approach he uses for complex plumbing jobs—identifying weak points, applying gradual pressure, and making incremental adjustments until the desired outcome is achieved.',
        },
        'core:likes': {
          text: 'Spending time after work at home to be around Julen. Watching Julen bend over while cleaning. Traditional Spanish cooking.',
        },
        'core:dislikes': {
          text: "Julen showing any signs of independence. Reminders of María's argumentative nature.",
        },
        'core:fears': {
          text: 'That Julen will mature enough to recognize the predatory nature of their relationship and leave him completely alone.',
        },
        'core:goals': {
          goals: [
            {
              text: 'Gradually increase physical contact with Julen through seemingly innocent gestures.',
            },
            {
              text: 'To get Julen used to serving Juan whenever the older man wants.',
            },
          ],
        },
        'core:speech_patterns': {
          patterns: [
            {
              pattern: 'planning his manipulation strategies',
              example:
                'The boy just needs the right pressure applied... gentle but steady.',
            },
          ],
        },
      };

      // This should work without throwing the gameSummary error
      const result = await generator.generateRewrittenTraits(fullCharacterDef);

      expect(result).toHaveProperty('characterName');
      expect(result).toHaveProperty('rewrittenTraits');
      expect(result.originalTraitCount).toBeGreaterThan(0);
      expect(result.rewrittenTraitCount).toBeGreaterThan(0);
    });
  });
});
