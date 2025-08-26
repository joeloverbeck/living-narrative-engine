/**
 * @file Tests for event dispatch API usage in SpeechPatternsGenerator
 * @description Verifies that event dispatch follows the correct API pattern: dispatch(eventName, payload)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SpeechPatternsGenerator } from '../../../src/characterBuilder/services/SpeechPatternsGenerator.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../src/characterBuilder/services/characterBuilderService.js';

describe('SpeechPatternsGenerator - Event Dispatch API Usage', () => {
  let generator;
  let mockLogger;
  let mockLlmJsonService;
  let mockLlmStrategyFactory;
  let mockLlmConfigManager;
  let mockEventBus;
  let mockTokenEstimator;
  let mockSchemaValidator;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockLlmJsonService = {
      clean: jest.fn().mockImplementation((input) => input),
      parseAndRepair: jest
        .fn()
        .mockImplementation((input) => JSON.parse(input)),
    };

    mockLlmStrategyFactory = {
      getAIDecision: jest.fn(),
    };

    mockLlmConfigManager = {
      loadConfiguration: jest.fn(),
      getActiveConfiguration: jest.fn(),
      setActiveConfiguration: jest.fn(),
    };

    // Track all dispatch calls to verify the API usage
    mockEventBus = {
      dispatch: jest.fn().mockResolvedValue(true),
    };

    mockTokenEstimator = {
      estimateTokens: jest.fn().mockReturnValue(1000),
    };

    mockSchemaValidator = {
      validateAgainstSchema: jest.fn().mockReturnValue({ isValid: true }),
      validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
    };

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

  describe('Event Dispatch API Usage', () => {
    it('should use correct dispatch API format for start event', async () => {
      // Mock LLM response and processor to complete the generation (needs at least 3 patterns)
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify({
          characterName: 'Test Character',
          speechPatterns: [
            { pattern: 'Test pattern', example: '"Test example"' },
            { pattern: 'Second pattern', example: '"Second example"' },
            { pattern: 'Third pattern', example: '"Third example"' },
          ],
        })
      );

      const validCharacterData = {
        components: {
          'core:name': { text: 'Test Character' },
          'core:personality': {
            text: 'A test character with enough content for validation.',
          },
        },
      };

      try {
        await generator.generateSpeechPatterns(validCharacterData);
      } catch {
        // Generation might fail due to other mocked components, but we only care about event dispatch
      }

      // Verify that dispatch was called with the correct API format
      const dispatchCalls = mockEventBus.dispatch.mock.calls;

      // Should have at least one call for the start event
      expect(dispatchCalls.length).toBeGreaterThan(0);

      // Find the start event dispatch call
      const startEventCall = dispatchCalls.find(
        (call) =>
          call[0] === CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_STARTED
      );

      expect(startEventCall).toBeDefined();

      // Verify the CORRECT API format: dispatch(eventName, payload) - where eventName is first param, payload is second
      expect(startEventCall[0]).toBe(CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_STARTED);
      expect(startEventCall[1]).toEqual(
        expect.objectContaining({
          characterData: expect.any(Object),
          options: expect.any(Object),
          timestamp: expect.any(String),
        })
      );
    });

    it('should use correct dispatch API format for completion event', async () => {
      // Mock successful LLM response with enough patterns and proper format
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify({
          characterName: 'Test Character',
          speechPatterns: [
            {
              pattern: 'Uses confident assertive language',
              example: '"I know exactly what I\'m doing here."',
            },
            {
              pattern: 'Shifts between vulnerability and strength',
              example:
                "\"Maybe I'm scared, but that doesn't mean I'll back down.\"",
            },
            {
              pattern: 'Questions with underlying assumptions',
              example: '"You really think that\'s the best approach?"',
            },
            {
              pattern: 'Self-deprecating humor as defense',
              example: '"Well, I guess I\'m the expert at making mistakes."',
            },
          ],
        })
      );

      const validCharacterData = {
        components: {
          'core:name': { text: 'Test Character' },
          'core:personality': {
            text: 'A test character with enough content for validation.',
          },
        },
      };

      await generator.generateSpeechPatterns(validCharacterData);

      const dispatchCalls = mockEventBus.dispatch.mock.calls;

      // Find the completion event dispatch call
      const completionEventCall = dispatchCalls.find(
        (call) =>
          call[0] === CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_COMPLETED
      );

      expect(completionEventCall).toBeDefined();

      // Verify correct API format
      expect(completionEventCall[0]).toBe(CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_COMPLETED);
      expect(completionEventCall[1]).toEqual(
        expect.objectContaining({
          result: expect.any(Object),
          processingTime: expect.any(Number),
          timestamp: expect.any(String),
        })
      );
    });

    it('should use correct dispatch API format for failure event', async () => {
      // Mock LLM failure
      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(
        new Error('Simulated LLM failure')
      );

      const validCharacterData = {
        components: {
          'core:name': { text: 'Test Character' },
          'core:personality': {
            text: 'A test character with enough content for validation.',
          },
        },
      };

      try {
        await generator.generateSpeechPatterns(validCharacterData);
      } catch {
        // Expected to fail
      }

      const dispatchCalls = mockEventBus.dispatch.mock.calls;

      // Find the failure event dispatch call
      const failureEventCall = dispatchCalls.find(
        (call) =>
          call[0] === CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_FAILED
      );

      expect(failureEventCall).toBeDefined();

      // Verify correct API format
      expect(failureEventCall[0]).toBe(CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_FAILED);
      expect(failureEventCall[1]).toEqual(
        expect.objectContaining({
          error: expect.any(String),
          processingTime: expect.any(Number),
          timestamp: expect.any(String),
        })
      );
    });

    it('should use the correct dispatch API format with string event names and payload objects', async () => {
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify({
          characterName: 'Test Character',
          speechPatterns: [
            {
              pattern: 'Uses confident assertive language',
              example: '"I know exactly what I\'m doing here."',
            },
            {
              pattern: 'Shifts between vulnerability and strength',
              example:
                "\"Maybe I'm scared, but that doesn't mean I'll back down.\"",
            },
            {
              pattern: 'Questions with underlying assumptions',
              example: '"You really think that\'s the best approach?"',
            },
            {
              pattern: 'Self-deprecating humor as defense',
              example: '"Well, I guess I\'m the expert at making mistakes."',
            },
          ],
        })
      );

      const validCharacterData = {
        components: {
          'core:name': { text: 'Test Character' },
          'core:personality': {
            text: 'A test character with enough content for validation.',
          },
        },
      };

      await generator.generateSpeechPatterns(validCharacterData);

      const dispatchCalls = mockEventBus.dispatch.mock.calls;

      // Verify ALL calls use the CORRECT format: dispatch(eventName, payload)
      dispatchCalls.forEach((call) => {
        // First argument should be the event name as a string
        expect(typeof call[0]).toBe('string');
        expect(call[0].length).toBeGreaterThan(0);
        
        // Second argument should be the payload object
        expect(typeof call[1]).toBe('object');
        expect(call[1]).not.toBeNull();

        // The event name should be a valid string and not [object Object]
        expect(call[0]).not.toBe('[object Object]');
        
        // Event name should follow the expected pattern (contain 'core:')
        expect(call[0]).toMatch(/^core:/);
      });
    });
  });

  describe('Event Constant Validation', () => {
    it('should have all speech pattern events as valid string constants', () => {
      expect(
        typeof CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_STARTED
      ).toBe('string');
      expect(CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_STARTED).toBe(
        'core:speech_patterns_generation_started'
      );

      expect(
        typeof CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_COMPLETED
      ).toBe('string');
      expect(
        CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_COMPLETED
      ).toBe('core:speech_patterns_generation_completed');

      expect(
        typeof CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_FAILED
      ).toBe('string');
      expect(CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_FAILED).toBe(
        'core:speech_patterns_generation_failed'
      );
    });

    it('should not have undefined event constants that would cause [object Object] errors', () => {
      // All event constants should be properly defined strings
      const eventKeys = Object.keys(CHARACTER_BUILDER_EVENTS);
      const speechPatternEventKeys = eventKeys.filter((key) =>
        key.includes('SPEECH_PATTERNS')
      );

      speechPatternEventKeys.forEach((key) => {
        const eventValue = CHARACTER_BUILDER_EVENTS[key];
        expect(eventValue).toBeDefined();
        expect(typeof eventValue).toBe('string');
        expect(eventValue.length).toBeGreaterThan(0);
      });
    });
  });
});
