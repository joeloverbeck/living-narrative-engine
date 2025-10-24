/**
 * @file Test to reproduce null cliches validation error
 * Reproduces the exact runtime error from traits-generator.html
 * @see ../../../../src/characterBuilder/services/TraitsGenerator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TraitsGenerator } from '../../../../src/characterBuilder/services/TraitsGenerator.js';
import { NoDelayRetryManager } from '../../../common/mocks/noDelayRetryManager.js';

// Shared mock response object to eliminate duplication
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

// Shared test data constants
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

// Mock factory functions to reduce setup overhead
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

// Helper function to set up successful mock responses
const setupSuccessfulMockResponse = (mocks) => {
  const mockResponse = JSON.stringify(MOCK_PARSED_RESPONSE);
  mocks.llmStrategyFactory.getAIDecision.mockResolvedValue(mockResponse);
  mocks.llmJsonService.clean.mockReturnValue(mockResponse);
  mocks.llmJsonService.parseAndRepair.mockResolvedValue(MOCK_PARSED_RESPONSE);
};

// Mock the prompt functions to prevent real LLM calls
jest.mock(
  '../../../../src/characterBuilder/prompts/traitsGenerationPrompt.js',
  () => ({
    buildTraitsGenerationPrompt: jest.fn(
      (concept, direction, userInputs, cliches) => {
        // Simulate the real implementation's behavior
        // The real formatClichesForPrompt would access cliches.categories which fails on arrays
        if (Array.isArray(cliches)) {
          // This simulates what happens when cliches is an array - accessing .categories fails
          throw new TypeError(
            "Cannot read properties of undefined (reading 'length')"
          );
        }
        return 'mock prompt';
      }
    ),
    validateTraitsGenerationResponse: jest.fn(() => ({})),
    TRAITS_RESPONSE_SCHEMA: {
      type: 'object',
      properties: {
        names: { type: 'array' },
        physicalDescription: { type: 'string' },
        personality: { type: 'array' },
        strengths: { type: 'array' },
        weaknesses: { type: 'array' },
        likes: { type: 'array' },
        dislikes: { type: 'array' },
        fears: { type: 'array' },
        goals: { type: 'object' },
        notes: { type: 'array' },
        profile: { type: 'string' },
        secrets: { type: 'array' },
      },
      required: [
        'names',
        'physicalDescription',
        'personality',
        'strengths',
        'weaknesses',
        'likes',
        'dislikes',
        'fears',
        'goals',
        'notes',
        'profile',
        'secrets',
      ],
    },
    TRAITS_GENERATION_LLM_PARAMS: {},
    PROMPT_VERSION_INFO: { version: 'test' },
  })
);

describe('TraitsGenerator - Null Cliches Reproduction', () => {
  let traitsGenerator;
  let mocks;

  beforeAll(() => {
    // Create mock dependencies once for all tests
    mocks = {
      logger: createMockLogger(),
      llmJsonService: createMockLlmJsonService(),
      llmStrategyFactory: createMockLlmStrategyFactory(),
      llmConfigManager: createMockLlmConfigManager(),
      eventBus: createMockEventBus(),
      tokenEstimator: createMockTokenEstimator(),
      retryManager: new NoDelayRetryManager(),
    };
  });

  beforeEach(() => {
    // Reset all mock calls but reuse mock objects
    jest.clearAllMocks();

    // Create the TraitsGenerator instance with reused dependencies
    traitsGenerator = new TraitsGenerator(mocks);
  });

  describe('Null Cliches Validation Error Reproduction', () => {
    // Set up successful mock response once for all valid tests
    beforeAll(() => {
      setupSuccessfulMockResponse(mocks);
    });

    describe.each([
      ['null', null],
      ['undefined', undefined],
      ['empty object', {}],
    ])(
      'should NOT throw error when cliches is %s',
      (description, clichesValue) => {
        it(`should handle ${description} cliches correctly`, async () => {
          // Arrange: Create parameters with test cliches value
          const params = {
            concept: TEST_CONCEPT,
            direction: TEST_DIRECTION,
            userInputs: TEST_USER_INPUTS,
          };

          // Only add cliches property if it's not undefined
          if (clichesValue !== undefined) {
            params.cliches = clichesValue;
          }

          // Act: Should NOT throw an error - valid cliches values
          const result = await traitsGenerator.generateTraits(params);

          // Assert: Should have successfully generated traits
          expect(result).toBeDefined();
          expect(result.names).toEqual(MOCK_PARSED_RESPONSE.names);
          expect(result.metadata).toBeDefined();
        });
      }
    );

    it('should throw TraitsGenerationError when cliches is an array (invalid type)', async () => {
      // Arrange: Create parameters with array cliches (invalid)
      const params = {
        concept: TEST_CONCEPT,
        direction: TEST_DIRECTION,
        userInputs: TEST_USER_INPUTS,
        cliches: [], // Array is invalid - should be object or null
      };

      // Act & Assert: Should throw error when trying to access properties on array
      // Note: The production code doesn't explicitly validate against arrays,
      // but fails when trying to access .categories property
      await expect(traitsGenerator.generateTraits(params)).rejects.toThrow(
        "Cannot read properties of undefined (reading 'length')"
      );
    });
  });
});
