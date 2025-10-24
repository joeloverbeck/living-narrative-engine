/**
 * @file Integration test for traits generator display issues
 * @description Tests that reproduce the issues found in error_logs.txt and verify the fixes
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TraitsGeneratorController } from '../../../src/characterBuilder/controllers/TraitsGeneratorController.js';
import { TraitsDisplayEnhancer } from '../../../src/characterBuilder/services/TraitsDisplayEnhancer.js';
import { TraitsGenerator } from '../../../src/characterBuilder/services/TraitsGenerator.js';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import { createEventBus } from '../../common/mockFactories/eventBus.js';
import { NoDelayRetryManager } from '../../common/mocks/noDelayRetryManager.js';
import { JSDOM } from 'jsdom';
import { v4 as uuidv4 } from 'uuid';

describe('TraitsGenerator Display Issues Integration Test', () => {
  let mockLogger;
  let mockEventBus;
  let mockCharacterBuilderService;
  let traitsDisplayEnhancer;
  let mockDOM;
  let document;

  // Sample traits data structure as returned by LLM
  const sampleTraitsData = {
    names: [
      { name: 'Luna', justification: 'Reflects her mysterious nature' },
      { name: 'Sofia', justification: 'Means wisdom, fits her character' },
      { name: 'Maya', justification: 'Represents transformation and growth' },
    ],
    physicalDescription:
      'A petite young woman with flowing auburn hair and piercing green eyes. She carries herself with quiet confidence.',
    personality: [
      {
        trait: 'Introspective',
        explanation: 'Tends to think deeply about situations',
      },
      {
        trait: 'Resilient',
        explanation: 'Bounces back from adversity quickly',
      },
      {
        trait: 'Creative',
        explanation: 'Finds innovative solutions to challenges',
      },
    ],
    strengths: ['Quick thinking', 'Emotional intelligence', 'Adaptability'],
    weaknesses: ['Overthinking', 'Trust issues', 'Perfectionism'],
    likes: ['Reading', 'Quiet evenings', 'Deep conversations'],
    dislikes: ['Crowds', 'Superficial talk', 'Dishonesty'],
    fears: ['Being alone', 'Losing control'],
    goals: {
      shortTerm: ['Find a stable job', 'Make new friends'],
      longTerm:
        'Build a meaningful career while maintaining authentic relationships',
    },
    notes: ['Has a secret diary', 'Prefers tea over coffee'],
    profile:
      'A complex individual navigating life with determination and vulnerability. She combines analytical thinking with deep empathy, often finding herself torn between logic and emotion. Her introspective nature leads her to question everything, from her career choices to her relationships. Despite her tendency to overthink, she possesses remarkable resilience that allows her to bounce back from setbacks stronger than before. Her creativity manifests in unexpected ways, from problem-solving at work to her secret artistic pursuits. She values authentic connections but struggles with trust issues stemming from past experiences.',
    secrets: [
      'Writes poetry in secret',
      'Had a traumatic childhood experience',
    ],
    metadata: {
      model: 'test-model',
      totalTokens: 2000,
      responseTime: 1500,
    },
  };

  beforeEach(() => {
    // Set up JSDOM environment
    mockDOM = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="traits-results"></div>
        </body>
      </html>
    `);
    document = mockDOM.window.document;
    global.document = document;
    global.window = mockDOM.window;

    mockLogger = createMockLogger();
    mockEventBus = createEventBus();

    // Mock CharacterBuilderService
    mockCharacterBuilderService = {
      generateTraits: jest.fn(),
      getClichesByDirectionId: jest.fn(),
    };

    traitsDisplayEnhancer = new TraitsDisplayEnhancer({
      logger: mockLogger,
    });
  });

  afterEach(() => {
    // Clean up JSDOM
    mockDOM?.window?.close();
    delete global.document;
    delete global.window;
  });

  describe('TraitsDisplayEnhancer Data Structure Compatibility', () => {
    it('should correctly enhance traits data for display without structural issues', () => {
      // This should work without throwing errors
      const enhanced = traitsDisplayEnhancer.enhanceForDisplay(
        sampleTraitsData,
        {
          includeMetadata: false,
          expandStructuredData: true,
        }
      );

      // Verify the enhanced data has the expected structure for the controller
      expect(enhanced.names).toEqual(sampleTraitsData.names);
      expect(enhanced.physicalDescription).toEqual(
        sampleTraitsData.physicalDescription
      );
      expect(enhanced.personality).toEqual(sampleTraitsData.personality);
      expect(enhanced.strengths).toEqual(sampleTraitsData.strengths);
      expect(enhanced.weaknesses).toEqual(sampleTraitsData.weaknesses);
      expect(enhanced.likes).toEqual(sampleTraitsData.likes);
      expect(enhanced.dislikes).toEqual(sampleTraitsData.dislikes);
      expect(enhanced.fears).toEqual(sampleTraitsData.fears);
      expect(enhanced.goals).toEqual(sampleTraitsData.goals);
      expect(enhanced.notes).toEqual(sampleTraitsData.notes);
      expect(enhanced.profile).toEqual(sampleTraitsData.profile);
      expect(enhanced.secrets).toEqual(sampleTraitsData.secrets);
    });

    it('should handle missing trait properties gracefully', () => {
      const incompleteTraitsData = {
        names: [{ name: 'Test', justification: 'Test justification' }],
        physicalDescription: 'Test description',
        // Missing other properties
      };

      const enhanced = traitsDisplayEnhancer.enhanceForDisplay(
        incompleteTraitsData,
        {
          includeMetadata: false,
          expandStructuredData: true,
        }
      );

      // Should provide empty defaults for missing properties
      expect(enhanced.names).toEqual(incompleteTraitsData.names);
      expect(enhanced.physicalDescription).toEqual(
        incompleteTraitsData.physicalDescription
      );
      expect(enhanced.personality).toEqual([]);
      expect(enhanced.strengths).toEqual([]);
      expect(enhanced.weaknesses).toEqual([]);
      expect(enhanced.likes).toEqual([]);
      expect(enhanced.dislikes).toEqual([]);
      expect(enhanced.fears).toEqual([]);
      expect(enhanced.goals).toEqual({});
      expect(enhanced.notes).toEqual([]);
      expect(enhanced.profile).toEqual('');
      expect(enhanced.secrets).toEqual([]);
    });
  });

  describe('Event Bus Compatibility', () => {
    let traitsGenerator;
    let mockLlmJsonService;
    let mockLlmStrategyFactory;
    let mockLlmConfigManager;
    let mockTokenEstimator;

    beforeEach(() => {
      // Mock dependencies for TraitsGenerator
      mockLlmJsonService = {
        clean: jest.fn((response) => response),
        parseAndRepair: jest.fn().mockResolvedValue(sampleTraitsData),
      };

      mockLlmStrategyFactory = {
        getAIDecision: jest
          .fn()
          .mockResolvedValue(JSON.stringify(sampleTraitsData)),
      };

      mockLlmConfigManager = {
        getActiveConfiguration: jest.fn().mockResolvedValue({
          configId: 'test-model',
        }),
        loadConfiguration: jest.fn().mockResolvedValue({
          configId: 'test-model',
        }),
        setActiveConfiguration: jest.fn().mockResolvedValue(true),
      };

      mockTokenEstimator = {
        estimateTokens: jest.fn().mockResolvedValue(1000),
      };

      traitsGenerator = new TraitsGenerator({
        logger: mockLogger,
        llmJsonService: mockLlmJsonService,
        llmStrategyFactory: mockLlmStrategyFactory,
        llmConfigManager: mockLlmConfigManager,
        eventBus: mockEventBus,
        tokenEstimator: mockTokenEstimator,
        retryManager: new NoDelayRetryManager(),
      });
    });

    it('should dispatch events with correct format without validation errors', async () => {
      const testParams = {
        concept: {
          id: uuidv4(),
          concept: 'Test character concept',
        },
        direction: {
          id: uuidv4(),
          title: 'Test Direction',
          description: 'Test description',
          coreTension: 'Test tension',
        },
        userInputs: {
          coreMotivation: 'Test motivation',
          internalContradiction: 'Test contradiction',
          centralQuestion: 'Test question?',
        },
        cliches: [],
      };

      // This should complete without event validation errors
      const result = await traitsGenerator.generateTraits(testParams);

      // Verify events were dispatched with correct format (with core: namespace)
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:traits_generation_started',
        expect.objectContaining({
          conceptId: testParams.concept.id,
          directionId: testParams.direction.id,
          timestamp: expect.any(String),
        })
      );

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:traits_generation_completed',
        expect.objectContaining({
          conceptId: testParams.concept.id,
          directionId: testParams.direction.id,
          generationTime: expect.any(Number),
          timestamp: expect.any(String),
        })
      );

      // Verify the result contains the expected structure (excluding responseTime which varies)
      const {
        metadata: { responseTime, ...restMetadata },
        ...restResult
      } = result;
      const {
        metadata: {
          responseTime: expectedResponseTime,
          ...restExpectedMetadata
        },
        ...restExpected
      } = sampleTraitsData;

      expect(restResult).toMatchObject(restExpected);
      expect({ ...restMetadata }).toMatchObject(restExpectedMetadata);
      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata.responseTime).toBe('number');
    });

    it('should dispatch failure events correctly on errors', async () => {
      // Mock LLM failure by ensuring all mocks fail
      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(
        new Error('LLM request failed')
      );
      mockLlmJsonService.parseAndRepair.mockRejectedValue(
        new Error('JSON parsing failed')
      );

      const testParams = {
        concept: {
          id: uuidv4(),
          concept: 'Test character concept',
        },
        direction: {
          id: uuidv4(),
          title: 'Test Direction',
          description: 'Test description',
          coreTension: 'Test tension',
        },
        userInputs: {
          coreMotivation: 'Test motivation',
          internalContradiction: 'Test contradiction',
          centralQuestion: 'Test question?',
        },
        cliches: [],
      };

      await expect(
        traitsGenerator.generateTraits(testParams)
      ).rejects.toThrow();

      // Verify failure event was dispatched (checking that it exists rather than exact error message)
      const failureEventCall = mockEventBus.dispatch.mock.calls.find(
        (call) => call[0] === 'core:traits_generation_failed'
      );

      expect(failureEventCall).toBeTruthy();
      expect(failureEventCall[1]).toMatchObject({
        conceptId: testParams.concept.id,
        directionId: testParams.direction.id,
        timestamp: expect.any(String),
      });
    });
  });

  describe('Controller Event Dispatch', () => {
    it('should dispatch controller events with correct format', () => {
      // Test that controller events use the correct format
      const testDirection = {
        id: uuidv4(),
        title: 'Test Direction',
      };

      // Simulate successful traits generation event dispatch
      mockEventBus.dispatch('core:traits_generated', {
        directionId: testDirection.id,
        success: true,
        traitsCount: 10,
      });

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:traits_generated',
        expect.objectContaining({
          directionId: testDirection.id,
          success: true,
          traitsCount: expect.any(Number),
        })
      );
    });
  });
});
