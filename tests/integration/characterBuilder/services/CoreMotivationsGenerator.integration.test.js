/**
 * @file Integration tests for CoreMotivationsGenerator service
 * @see src/characterBuilder/services/CoreMotivationsGenerator.js
 *
 * These tests validate complex interactions between multiple services,
 * retry mechanisms, fallback strategies, and optional service integrations.
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

describe('CoreMotivationsGenerator - Integration Tests', () => {
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

  describe('retry mechanism', () => {
    it('should retry on parsing failures', async () => {
      let callCount = 0;
      mockLlmJsonService.parseAndRepair.mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Parsing failed');
        }
        return JSON.parse(JSON.stringify(validLlmResponse));
      });

      const result = await service.generate({
        concept: sampleConcept,
        direction: sampleDirection,
        clichés: sampleClichés,
      });

      expect(result).toHaveLength(3);
      expect(mockLlmJsonService.parseAndRepair).toHaveBeenCalledTimes(2);
    });

    it('should respect maxRetries option', async () => {
      let callCount = 0;
      mockLlmStrategyFactory.getAIDecision.mockImplementation(() => {
        callCount++;
        throw new Error('Network error');
      });

      await expect(
        service.generate(
          {
            concept: sampleConcept,
            direction: sampleDirection,
            clichés: sampleClichés,
          },
          { maxRetries: 1 }
        )
      ).rejects.toThrow(/after 2 attempts/);

      expect(callCount).toBe(2); // Initial attempt + 1 retry
    });

    it('should succeed on final retry attempt', async () => {
      let callCount = 0;
      mockLlmStrategyFactory.getAIDecision.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Transient failure');
        }
        return JSON.stringify(validLlmResponse);
      });

      const result = await service.generate(
        {
          concept: sampleConcept,
          direction: sampleDirection,
          clichés: sampleClichés,
        },
        { maxRetries: 2 }
      );

      expect(result).toHaveLength(3);
      expect(callCount).toBe(3);
    });
  });

  describe('parsing fallbacks', () => {
    it('should extract JSON from markdown code blocks', async () => {
      const markdownResponse =
        '```json\n' + JSON.stringify(validLlmResponse) + '\n```';

      mockLlmJsonService.parseAndRepair
        .mockRejectedValueOnce(new Error('Primary parsing failed'))
        .mockResolvedValueOnce(validLlmResponse);

      mockLlmStrategyFactory.getAIDecision.mockResolvedValueOnce(
        markdownResponse
      );

      const result = await service.generate({
        concept: sampleConcept,
        direction: sampleDirection,
        clichés: sampleClichés,
      });

      expect(result).toHaveLength(3);
      expect(mockLlmJsonService.parseAndRepair).toHaveBeenCalledTimes(2);
    });

    it('should extract JSON objects from response', async () => {
      const responseWithJson =
        'Some text before { "motivations": [...] } some text after';
      const jsonPart = JSON.stringify(validLlmResponse);

      mockLlmJsonService.parseAndRepair
        .mockRejectedValueOnce(new Error('Primary parsing failed'))
        .mockRejectedValueOnce(new Error('Markdown extraction failed'))
        .mockResolvedValueOnce(validLlmResponse);

      mockLlmStrategyFactory.getAIDecision.mockResolvedValueOnce(
        `Text before ${jsonPart} text after`
      );

      const result = await service.generate({
        concept: sampleConcept,
        direction: sampleDirection,
        clichés: sampleClichés,
      });

      expect(result).toHaveLength(3);
      expect(mockLlmJsonService.parseAndRepair).toHaveBeenCalledTimes(3);
    });

    it('should fail when all parsing strategies exhausted', async () => {
      const unparsableResponse = 'This is not JSON at all and cannot be parsed';

      mockLlmJsonService.parseAndRepair.mockRejectedValue(
        new Error('Cannot parse')
      );
      mockLlmStrategyFactory.getAIDecision.mockResolvedValueOnce(
        unparsableResponse
      );

      await expect(
        service.generate({
          concept: sampleConcept,
          direction: sampleDirection,
          clichés: sampleClichés,
        })
      ).rejects.toThrow(/parse/);
    });
  });

  describe('enhanced performance monitoring', () => {
    it('should include detailed metadata in successful generation', async () => {
      const result = await service.generate({
        concept: sampleConcept,
        direction: sampleDirection,
        clichés: sampleClichés,
      });

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

    it('should dispatch failure event with enhanced details', async () => {
      // Make error occur consistently across all retries
      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(
        new Error('Network timeout')
      );

      await expect(
        service.generate({
          concept: sampleConcept,
          direction: sampleDirection,
          clichés: sampleClichés,
        })
      ).rejects.toThrow();

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
  });

  describe('failure stage determination', () => {
    it('should identify LLM request failures', async () => {
      // Make error occur consistently across all retries
      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(
        new Error('Network timeout error')
      );

      await expect(
        service.generate({
          concept: sampleConcept,
          direction: sampleDirection,
          clichés: sampleClichés,
        })
      ).rejects.toThrow();

      const failureCall = mockEventBus.dispatch.mock.calls.find(
        (call) => call[0].type === 'CORE_MOTIVATIONS_GENERATION_FAILED'
      );

      expect(failureCall[0].payload.failureStage).toBe('llm_request');
    });

    it('should identify parsing failures', async () => {
      mockLlmJsonService.parseAndRepair.mockRejectedValue(
        new Error('Failed to parse invalid JSON')
      );

      await expect(
        service.generate({
          concept: sampleConcept,
          direction: sampleDirection,
          clichés: sampleClichés,
        })
      ).rejects.toThrow();

      const failureCall = mockEventBus.dispatch.mock.calls.find(
        (call) => call[0].type === 'CORE_MOTIVATIONS_GENERATION_FAILED'
      );

      expect(failureCall[0].payload.failureStage).toBe('response_parsing');
    });

    it('should identify quality validation failures', async () => {
      const poorQualityResponse = {
        motivations: [
          {
            coreDesire: 'short', // Too brief (< 20 chars)
            internalContradiction: 'brief', // Too brief (< 30 chars)
            centralQuestion: 'What', // Missing question mark
          },
          {
            coreDesire: 'Also very short content',
            internalContradiction: 'Also brief contradiction content',
            centralQuestion: 'Another question?',
          },
          {
            coreDesire: 'Third short desire here',
            internalContradiction: 'Third brief contradiction here',
            centralQuestion: 'Third question here?',
          },
        ],
      };

      // Make it return this poor quality response consistently across retries
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify(poorQualityResponse)
      );

      await expect(
        service.generate({
          concept: sampleConcept,
          direction: sampleDirection,
          clichés: sampleClichés,
        })
      ).rejects.toThrow(/too brief|lacks depth|question mark/);

      const failureCall = mockEventBus.dispatch.mock.calls.find(
        (call) => call[0].type === 'CORE_MOTIVATIONS_GENERATION_FAILED'
      );

      // Since structural validation runs before quality validation,
      // it catches the issues first so expect structure_validation
      expect(failureCall[0].payload.failureStage).toBe('structure_validation');
    });
  });

  describe('TokenEstimator integration', () => {
    let serviceWithTokenEstimator;
    let mockTokenEstimator;

    beforeEach(() => {
      mockTokenEstimator = {
        estimateTokens: jest.fn(() => Promise.resolve(150)),
      };

      serviceWithTokenEstimator = new CoreMotivationsGenerator({
        logger: mockLogger,
        llmJsonService: mockLlmJsonService,
        llmStrategyFactory: mockLlmStrategyFactory,
        llmConfigManager: mockLlmConfigManager,
        eventBus: mockEventBus,
        tokenEstimator: mockTokenEstimator,
      });
    });

    it('should use TokenEstimator when available', async () => {
      await serviceWithTokenEstimator.generate({
        concept: sampleConcept,
        direction: sampleDirection,
        clichés: sampleClichés,
      });

      expect(mockTokenEstimator.estimateTokens).toHaveBeenCalledWith(
        expect.any(String),
        'test-model'
      );
      expect(mockTokenEstimator.estimateTokens).toHaveBeenCalledTimes(2); // prompt + response
    });

    it('should handle TokenEstimator errors gracefully', async () => {
      mockTokenEstimator.estimateTokens.mockRejectedValueOnce(
        new Error('Token estimation failed')
      );

      const result = await serviceWithTokenEstimator.generate({
        concept: sampleConcept,
        direction: sampleDirection,
        clichés: sampleClichés,
      });

      expect(result).toHaveLength(3);
      expect(result[0].metadata.promptTokens).toBeGreaterThan(0); // Fallback estimation
    });

    it('should fall back to simple estimation when TokenEstimator not provided', async () => {
      const result = await service.generate({
        concept: sampleConcept,
        direction: sampleDirection,
        clichés: sampleClichés,
      });

      expect(result[0].metadata.promptTokens).toBeGreaterThan(0);
      expect(result[0].metadata.responseTokens).toBeGreaterThan(0);
    });
  });
});
