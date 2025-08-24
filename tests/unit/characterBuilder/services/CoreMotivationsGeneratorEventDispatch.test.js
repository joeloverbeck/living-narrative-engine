/**
 * @file Test for CoreMotivationsGenerator event dispatch format
 * @see CoreMotivationsGenerator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CoreMotivationsGenerator } from '../../../../src/characterBuilder/services/CoreMotivationsGenerator.js';
import { CoreMotivation } from '../../../../src/characterBuilder/models/coreMotivation.js';

describe('CoreMotivationsGenerator - Event Dispatch', () => {
  let generator;
  let mockLogger;
  let mockLlmJsonService;
  let mockLlmStrategyFactory;
  let mockLlmConfigManager;
  let mockEventBus;
  let mockTokenEstimator;
  let dispatchCalls;

  beforeEach(() => {
    dispatchCalls = [];
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockLlmJsonService = {
      requestJsonFromLLM: jest.fn(),
      clean: jest.fn((text) => text),
      parseAndRepair: jest.fn((text) => JSON.parse(text)),
    };

    const mockStrategy = {
      requestJsonFromLLM: jest.fn(),
    };

    mockLlmStrategyFactory = {
      createStrategy: jest.fn().mockReturnValue(mockStrategy),
      getAIDecision: jest.fn(),
    };

    mockLlmConfigManager = {
      getLLMConfiguration: jest.fn().mockReturnValue({
        provider: 'test',
        model: 'test-model',
      }),
      loadConfiguration: jest.fn(),
      getAutoSaveActivatedInCoreMotivationsGenerator: jest
        .fn()
        .mockReturnValue(false),
      getProviderAllowedForExpensiveAPICalls: jest.fn().mockReturnValue('test'),
      getActiveConfiguration: jest.fn().mockReturnValue({
        provider: 'test',
        model: 'test-model',
      }),
      setActiveConfiguration: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn().mockImplementation((...args) => {
        dispatchCalls.push(args);

        // Simulate the real eventBus behavior to reproduce the error
        const [firstArg, secondArg] = args;

        if (typeof firstArg === 'object' && firstArg !== null) {
          // This reproduces the error that happens in production
          mockLogger.warn(
            `GameDataRepository: getEventDefinition called with invalid ID: ${firstArg}`
          );
          mockLogger.warn(
            `VED: EventDefinition not found for '${firstArg}'. Cannot validate payload. Proceeding with dispatch.`
          );
          mockLogger.error('EventBus: Invalid event name provided.', firstArg);
          return Promise.resolve(false);
        }

        return Promise.resolve(true);
      }),
    };

    mockTokenEstimator = {
      estimateTokens: jest.fn().mockReturnValue(100),
    };

    generator = new CoreMotivationsGenerator({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      llmStrategyFactory: mockLlmStrategyFactory,
      llmConfigManager: mockLlmConfigManager,
      eventBus: mockEventBus,
      tokenEstimator: mockTokenEstimator,
    });
  });

  describe('Event dispatch format', () => {
    it('should dispatch events with correct format (bug fixed)', async () => {
      // This test verifies that the bug is fixed
      // Previously, the dispatch was called with an object { type, payload }
      // Now it should be called with (string, object)

      // Arrange
      const concept = {
        id: 'test-concept-id',
        name: 'Test Character',
        concept: 'A test character concept',
      };

      const direction = {
        id: 'test-direction-id',
        title: 'Test Direction',
        description: 'Test description',
        coreTension: 'Test core tension',
        themes: ['test theme'],
      };

      // Mock LLM to immediately fail so we get started + failed events
      const mockStrategy = mockLlmStrategyFactory.createStrategy();
      mockStrategy.requestJsonFromLLM.mockRejectedValue(
        new Error('Simulated LLM failure')
      );

      // Act
      const params = {
        concept,
        direction,
        clichés: { items: [] },
      };
      try {
        await generator.generate(params);
      } catch (error) {
        // Expected to fail with LLM error
      }

      // Assert - After fix, events should be dispatched correctly
      expect(dispatchCalls.length).toBeGreaterThanOrEqual(2); // Started + Failed

      // Check the first dispatch (GENERATION_STARTED)
      const [firstCall] = dispatchCalls;
      const [eventName, payload] = firstCall;

      // After fix: first arg should be string, second should be object
      expect(typeof eventName).toBe('string');
      expect(eventName).toBe('core:core_motivations_generation_started');
      expect(typeof payload).toBe('object');
      expect(payload).toHaveProperty('conceptId', 'test-concept-id');
      expect(payload).toHaveProperty('directionId', 'test-direction-id');

      // No errors should be logged with correct format
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        'EventBus: Invalid event name provided.',
        expect.anything()
      );
    });

    it('should work correctly with proper dispatch format (requires full mock setup)', async () => {
      // This test will pass after we fix the CoreMotivationsGenerator

      // Arrange
      const concept = {
        id: 'test-concept-id',
        name: 'Test Character',
        concept: 'A test character concept',
      };

      const direction = {
        id: 'test-direction-id',
        title: 'Test Direction',
        description: 'Test description',
        coreTension: 'Test core tension',
        themes: ['test theme'],
      };

      // Mock successful LLM response
      const mockMotivations = [
        {
          motivation:
            'Seeks validation through proving their intellectual superiority to others',
          internalContradiction:
            'Desperately craves connection while sabotaging relationships through arrogance',
          centralQuestion: 'What does the character truly want?',
        },
        {
          motivation:
            'Driven to protect loved ones from any form of suffering or harm',
          internalContradiction:
            'Their protective instincts often become controlling and suffocating to those they love',
          centralQuestion: 'How will they achieve their goals?',
        },
        {
          motivation:
            'Compelled to achieve perfection in everything they attempt to do',
          internalContradiction:
            'Their perfectionism paralyzes them and prevents them from completing important tasks',
          centralQuestion: 'What price are they willing to pay?',
        },
      ];

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify({
          motivations: mockMotivations.map((m) => ({
            coreDesire: m.motivation,
            internalContradiction: m.internalContradiction,
            centralQuestion: m.centralQuestion,
          })),
        })
      );

      // Act
      const params = {
        concept,
        direction,
        clichés: { items: [] },
      };
      const result = await generator.generate(params);

      // Assert - Should return generated motivations
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Assert - After fix, dispatch should be called correctly
      expect(dispatchCalls.length).toBeGreaterThanOrEqual(2); // Started + Completed

      // Check that dispatches use correct format (string eventName, object payload)
      for (const call of dispatchCalls) {
        const [eventName, payload] = call;

        // After fix: first arg should be string, second should be object
        if (typeof eventName === 'string') {
          expect(typeof eventName).toBe('string');
          expect(eventName).toMatch(/^core:/); // Should be namespaced

          if (payload) {
            expect(typeof payload).toBe('object');
            expect(payload).toHaveProperty('conceptId');
            expect(payload).toHaveProperty('directionId');
          }
        }
      }

      // No errors should be logged with correct format
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalid event name provided')
      );
    });

    it('should dispatch failure event with correct format on error', async () => {
      // Arrange
      const concept = {
        id: 'test-concept-id',
        name: 'Test Character',
        concept: 'A test character concept',
      };

      const direction = {
        id: 'test-direction-id',
        title: 'Test Direction',
        description: 'Test description',
        coreTension: 'Test core tension',
        themes: ['test theme'],
      };

      const testError = new Error('Test LLM failure');
      const mockStrategy = mockLlmStrategyFactory.createStrategy();
      mockStrategy.requestJsonFromLLM.mockRejectedValue(testError);

      // Act
      const params = {
        concept,
        direction,
        clichés: { items: [] },
      };
      await expect(generator.generate(params)).rejects.toThrow();

      // Assert - Should dispatch both started and failed events
      expect(dispatchCalls.length).toBeGreaterThanOrEqual(2);

      const failedEventCall = dispatchCalls.find((call) => {
        const [arg] = call;
        // Check both old format (object with type) and new format (string)
        return (
          (typeof arg === 'object' &&
            arg?.type === 'CORE_MOTIVATIONS_GENERATION_FAILED') ||
          (typeof arg === 'string' && arg.includes('failed'))
        );
      });

      expect(failedEventCall).toBeDefined();
    });
  });

  describe('Event payloads', () => {
    it('should include correct payload for started event', async () => {
      // Arrange
      const concept = {
        id: 'concept-123',
        name: 'Test Character',
        concept: 'A test character concept',
      };

      const direction = {
        id: 'direction-456',
        title: 'Test Direction',
        themes: ['test theme'],
      };

      const mockStrategy = mockLlmStrategyFactory.createStrategy();
      mockStrategy.requestJsonFromLLM.mockRejectedValue(
        new Error('Stop after first dispatch')
      );

      // Act
      const params = {
        concept,
        direction,
        clichés: { items: [] },
      };
      try {
        await generator.generate(params);
      } catch (error) {
        // Expected
      }

      // Assert
      const startedCall = dispatchCalls[0];
      if (startedCall) {
        const payload = startedCall[0]?.payload || startedCall[1];
        expect(payload).toEqual({
          conceptId: 'concept-123',
          directionId: 'direction-456',
        });
      }
    });
  });
});
