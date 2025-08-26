/**
 * @file Test to reproduce and fix event dispatch format issue in SpeechPatternsGenerator
 * @description Tests that events are dispatched with correct format (eventName, payload)
 * not incorrect format ({type, payload})
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SpeechPatternsGenerator } from '../../../src/characterBuilder/services/SpeechPatternsGenerator.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../src/characterBuilder/services/characterBuilderService.js';

describe('SpeechPatternsGenerator - Event Dispatch Format', () => {
  let generator;
  let mockLogger;
  let mockEventBus;
  let mockLlmJsonService;
  let mockLlmStrategyFactory;
  let mockLlmConfigManager;
  let mockTokenEstimator;
  let mockSchemaValidator;
  let dispatchCalls;

  beforeEach(() => {
    dispatchCalls = [];
    
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn((...args) => {
        dispatchCalls.push(args);
        // Simple mock - just record the calls
        return Promise.resolve(true);
      }),
    };

    mockLlmJsonService = {
      getJsonFromLLM: jest.fn(),
      clean: jest.fn((text) => text),
      parseAndRepair: jest.fn((text) => JSON.parse(text)),
    };

    const mockStrategy = {
      requestJsonFromLLM: jest.fn().mockResolvedValue({
        patterns: [
          {
            pattern: 'Test pattern',
            circumstances: ['Test circumstance'],
            tags: ['greeting'],
          },
        ],
      }),
    };

    mockLlmStrategyFactory = {
      createStrategy: jest.fn().mockReturnValue(mockStrategy),
      getAIDecision: jest.fn(),
    };

    mockLlmConfigManager = {
      getActiveProfile: jest.fn().mockReturnValue('default'),
      loadConfiguration: jest.fn(),
      getActiveConfiguration: jest.fn().mockReturnValue({ model: 'test' }),
      setActiveConfiguration: jest.fn(),
    };

    mockTokenEstimator = {
      estimateTokens: jest.fn().mockReturnValue(100),
    };

    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({
        isValid: true,
        errors: [],
      }),
      validateAgainstSchema: jest.fn().mockReturnValue({
        isValid: true,
        errors: [],
      }),
    };

    generator = new SpeechPatternsGenerator({
      logger: mockLogger,
      eventBus: mockEventBus,
      llmJsonService: mockLlmJsonService,
      llmStrategyFactory: mockLlmStrategyFactory,
      llmConfigManager: mockLlmConfigManager,
      tokenEstimator: mockTokenEstimator,
      schemaValidator: mockSchemaValidator,
    });
  });

  describe('Event Dispatch Format Verification', () => {
    it('should dispatch events with correct format (string eventName, object payload)', async () => {
      const characterData = {
        'core:name': { text: 'Test Character' },
        'core:concept': { text: 'A test character' },
      };

      const options = {
        patternCount: 3,
        focusType: 'general',
      };

      try {
        await generator.generateSpeechPatterns(characterData, options);
      } catch (error) {
        // May fail due to LLM mock, but we're checking dispatch format
      }

      // Check that dispatch was called
      expect(dispatchCalls.length).toBeGreaterThan(0);

      // Verify all dispatch calls use correct format
      for (const call of dispatchCalls) {
        const [eventName, payload] = call;
        
        // First argument must be a string (the event name)
        expect(typeof eventName).toBe('string');
        expect(eventName).toMatch(/^core:/);
        
        // Second argument should be the payload object (if present)
        if (payload !== undefined) {
          expect(typeof payload).toBe('object');
          expect(payload).not.toBeNull();
        }
      }
    });

    it('should not dispatch events as objects with type property', async () => {
      const characterData = {
        'core:name': { text: 'Test Character' },
        'core:concept': { text: 'A test character' },
      };

      const options = {
        patternCount: 3,
        focusType: 'general',
      };

      try {
        await generator.generateSpeechPatterns(characterData, options);
      } catch (error) {
        // May fail due to LLM mock, but we're checking dispatch format
      }

      // Check that dispatch was called
      expect(dispatchCalls.length).toBeGreaterThan(0);

      // Verify no dispatch calls use incorrect object format
      for (const call of dispatchCalls) {
        const [firstArg] = call;
        
        // First argument should NOT be an object with a 'type' property
        if (typeof firstArg === 'object') {
          expect(firstArg).not.toHaveProperty('type');
        }
        
        // It should be a string
        expect(typeof firstArg).toBe('string');
      }
    });
  });

  describe('Event Types', () => {
    it('should dispatch SPEECH_PATTERNS_GENERATION_STARTED event correctly', async () => {
      dispatchCalls = [];
      
      const characterData = {
        'core:name': { text: 'Test Character' },
        'core:concept': { text: 'A test character' },
      };

      const options = {
        patternCount: 3,
        focusType: 'general',
      };

      try {
        await generator.generateSpeechPatterns(characterData, options);
      } catch (error) {
        // Expected - we're checking dispatch format
      }

      // Find the STARTED event dispatch
      const startedEventCall = dispatchCalls.find((call) => {
        const [firstArg] = call;
        return (
          firstArg === CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_STARTED ||
          (firstArg?.type === CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_STARTED)
        );
      });

      expect(startedEventCall).toBeDefined();
      
      // After fix, this should be in correct format
      const [eventName, payload] = startedEventCall;
      if (typeof eventName === 'string') {
        expect(eventName).toBe(CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_STARTED);
        expect(payload).toHaveProperty('characterData');
        expect(payload).toHaveProperty('options');
        expect(payload).toHaveProperty('timestamp');
      }
    });

    it('should dispatch cache-related events correctly', async () => {
      // Test with cached result
      mockEventBus.dispatch.mockClear();
      dispatchCalls = [];
      
      const characterData = {
        'core:name': { text: 'Test Character' },
        'core:concept': { text: 'A test character' },
      };
      
      try {
        // First call to populate cache
        await generator.generateSpeechPatterns(characterData, { patternCount: 3 });
      } catch (error) {
        // May fail due to LLM mock
      }
      
      // Clear dispatch calls
      dispatchCalls = [];
      
      try {
        // Second call should hit cache
        await generator.generateSpeechPatterns(characterData, { patternCount: 3 });
      } catch (error) {
        // May fail due to LLM mock
      }
      
      // Look for cache hit event
      const cacheHitCall = dispatchCalls.find((call) => {
        const [firstArg] = call;
        return (
          firstArg === CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_CACHE_HIT ||
          (firstArg?.type === CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_CACHE_HIT)
        );
      });
      
      if (cacheHitCall) {
        const [eventName, payload] = cacheHitCall;
        if (typeof eventName === 'string') {
          expect(eventName).toBe(CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_CACHE_HIT);
          expect(payload).toHaveProperty('cacheKey');
          expect(payload).toHaveProperty('timestamp');
        }
      }
    });
  });
});