/**
 * @file Tests for retry behavior in TraitsGenerator
 * Verifies retry logic with mock RetryManager
 * @see ../../../../src/characterBuilder/services/TraitsGenerator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TraitsGenerator } from '../../../../src/characterBuilder/services/TraitsGenerator.js';
import { NoDelayRetryManager } from '../../../common/mocks/noDelayRetryManager.js';

// Shared test data
const TEST_CONCEPT = {
  id: '9f5e16fb-3cd8-42a3-891d-22c078a24762',
  concept: 'Test concept',
};

const TEST_DIRECTION = {
  id: 'bd1409eb-7e2a-4d4f-abd5-10af53d28df6',
  title: 'Test direction',
  description: 'Test direction description',
  coreTension: 'Test core tension',
  uniqueTwist: 'Test unique twist',
  narrativePotential: 'Test narrative potential',
};

const TEST_USER_INPUTS = {
  coreMotivation: 'To find redemption through helping others',
  internalContradiction: 'Wants to help but fears discovery of dark past',
  centralQuestion: 'Can someone truly change their nature?',
  additionalNotes: 'Test notes',
};

const MOCK_PARSED_RESPONSE = {
  names: [
    {
      name: 'Test Name',
      justification:
        'This is a test justification that meets the minimum length requirement.',
    },
  ],
  physicalDescription:
    'This is a test physical description that meets the minimum length requirement of 100 characters for validation purposes.',
  personality: [
    {
      trait: 'friendly',
      explanation: 'This person is naturally friendly and welcoming to others',
    },
  ],
  strengths: ['brave'],
  weaknesses: ['stubborn'],
  likes: ['reading'],
  dislikes: ['noise'],
  fears: ['heights'],
  goals: {
    primary: 'test goal',
    longTerm: 'What will they achieve in life?',
  },
  notes: ['test note'],
  profile:
    'This is a comprehensive test profile that meets the minimum 200 character requirement for validation. It provides detailed information about the character including their background, personality traits, and motivations.',
  secrets: ['test secret'],
};

// Mock factory functions
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockLlmJsonService = () => ({
  clean: jest.fn(),
  parseAndRepair: jest.fn(),
});

const createMockLlmStrategyFactory = () => ({
  getAIDecision: jest.fn(),
});

const createMockLlmConfigManager = () => ({
  loadConfiguration: jest.fn(),
  getActiveConfiguration: jest
    .fn()
    .mockResolvedValue({ configId: 'test-config' }),
  setActiveConfiguration: jest.fn(),
});

const createMockEventBus = () => ({
  dispatch: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
});

const createMockTokenEstimator = () => ({
  estimateTokens: jest.fn().mockReturnValue(100),
});

// Mock the prompt functions
jest.mock(
  '../../../../src/characterBuilder/prompts/traitsGenerationPrompt.js',
  () => ({
    buildTraitsGenerationPrompt: jest.fn(() => 'mock prompt'),
    validateTraitsGenerationResponse: jest.fn(() => ({})),
    TRAITS_RESPONSE_SCHEMA: {
      type: 'object',
      properties: {},
    },
    TRAITS_GENERATION_LLM_PARAMS: {},
    PROMPT_VERSION_INFO: { version: 'test' },
  })
);

describe('TraitsGenerator - Retry Behavior', () => {
  let traitsGenerator;
  let mocks;
  let mockRetryManager;

  beforeEach(() => {
    mockRetryManager = new NoDelayRetryManager();
    jest.spyOn(mockRetryManager, 'retry');

    mocks = {
      logger: createMockLogger(),
      llmJsonService: createMockLlmJsonService(),
      llmStrategyFactory: createMockLlmStrategyFactory(),
      llmConfigManager: createMockLlmConfigManager(),
      eventBus: createMockEventBus(),
      tokenEstimator: createMockTokenEstimator(),
      retryManager: mockRetryManager,
    };

    // Setup successful mock response by default
    const mockResponse = JSON.stringify(MOCK_PARSED_RESPONSE);
    mocks.llmStrategyFactory.getAIDecision.mockResolvedValue(mockResponse);
    mocks.llmJsonService.clean.mockReturnValue(mockResponse);
    mocks.llmJsonService.parseAndRepair.mockResolvedValue(MOCK_PARSED_RESPONSE);

    traitsGenerator = new TraitsGenerator(mocks);
  });

  it('should delegate retry logic to RetryManager', async () => {
    // Arrange
    const params = {
      concept: TEST_CONCEPT,
      direction: TEST_DIRECTION,
      userInputs: TEST_USER_INPUTS,
      cliches: null,
    };

    // Act
    await traitsGenerator.generateTraits(params, { maxRetries: 2 });

    // Assert
    expect(mockRetryManager.retry).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxAttempts: 3, // maxRetries + 1
        delay: 1000,
        exponentialBackoff: true,
        maxDelay: 30000,
      })
    );
  });

  it('should respect maxRetries option', async () => {
    // Arrange
    const params = {
      concept: TEST_CONCEPT,
      direction: TEST_DIRECTION,
      userInputs: TEST_USER_INPUTS,
      cliches: null,
    };

    // Act
    await traitsGenerator.generateTraits(params, { maxRetries: 5 });

    // Assert
    expect(mockRetryManager.retry).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxAttempts: 6, // maxRetries + 1
      })
    );
  });

  it('should use default maxRetries when not specified', async () => {
    // Arrange
    const params = {
      concept: TEST_CONCEPT,
      direction: TEST_DIRECTION,
      userInputs: TEST_USER_INPUTS,
      cliches: null,
    };

    // Act
    await traitsGenerator.generateTraits(params);

    // Assert
    expect(mockRetryManager.retry).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxAttempts: 3, // default maxRetries (2) + 1
      })
    );
  });

  it('should throw TraitsGenerationError after exhausting retries', async () => {
    // Arrange
    const params = {
      concept: TEST_CONCEPT,
      direction: TEST_DIRECTION,
      userInputs: TEST_USER_INPUTS,
      cliches: null,
    };

    // Simulate all retries failing
    mocks.llmStrategyFactory.getAIDecision.mockRejectedValue(
      new Error('LLM failure')
    );

    // Act & Assert
    await expect(
      traitsGenerator.generateTraits(params, { maxRetries: 2 })
    ).rejects.toThrow('after 3 attempts');
  });

  it('should succeed on first attempt without retries', async () => {
    // Arrange
    const params = {
      concept: TEST_CONCEPT,
      direction: TEST_DIRECTION,
      userInputs: TEST_USER_INPUTS,
      cliches: null,
    };

    // Act
    const result = await traitsGenerator.generateTraits(params, {
      maxRetries: 2,
    });

    // Assert
    expect(result).toBeDefined();
    expect(mockRetryManager.retry).toHaveBeenCalledTimes(1);
  });

  it('should handle maxRetries: 0 (no retries)', async () => {
    // Arrange
    const params = {
      concept: TEST_CONCEPT,
      direction: TEST_DIRECTION,
      userInputs: TEST_USER_INPUTS,
      cliches: null,
    };

    // Act
    await traitsGenerator.generateTraits(params, { maxRetries: 0 });

    // Assert
    expect(mockRetryManager.retry).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxAttempts: 1, // maxRetries (0) + 1
      })
    );
  });
});
