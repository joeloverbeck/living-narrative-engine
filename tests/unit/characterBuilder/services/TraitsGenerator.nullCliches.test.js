/**
 * @file Test to reproduce null cliches validation error
 * Reproduces the exact runtime error from traits-generator.html
 * @see ../../../../src/characterBuilder/services/TraitsGenerator.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TraitsGenerator } from '../../../../src/characterBuilder/services/TraitsGenerator.js';
import { TraitsGenerationError } from '../../../../src/characterBuilder/errors/TraitsGenerationError.js';

// Mock the prompt functions to prevent real LLM calls
jest.mock(
  '../../../../src/characterBuilder/prompts/traitsGenerationPrompt.js',
  () => ({
    buildTraitsGenerationPrompt: jest.fn(() => 'mock prompt'),
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
  let mockLogger;
  let mockLlmJsonService;
  let mockLlmStrategyFactory;
  let mockLlmConfigManager;
  let mockEventBus;
  let mockTokenEstimator;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock dependencies
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockLlmJsonService = {
      clean: jest.fn(),
      parseAndRepair: jest.fn(),
    };

    mockLlmStrategyFactory = {
      getAIDecision: jest.fn(),
    };

    mockLlmConfigManager = {
      loadConfiguration: jest.fn(),
      getActiveConfiguration: jest.fn().mockResolvedValue({ configId: 'test-config' }),
      setActiveConfiguration: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    mockTokenEstimator = {
      estimateTokens: jest.fn().mockReturnValue(100),
    };

    // Create the TraitsGenerator instance with correct dependencies
    traitsGenerator = new TraitsGenerator({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      llmStrategyFactory: mockLlmStrategyFactory,
      llmConfigManager: mockLlmConfigManager,
      eventBus: mockEventBus,
      tokenEstimator: mockTokenEstimator,
    });
  });

  describe('Null Cliches Validation Error Reproduction', () => {
    it('should throw TraitsGenerationError when cliches is null', async () => {
      // Arrange: Create parameters with null cliches (reproduces the actual runtime error)
      const params = {
        concept: {
          id: '9f5e16fb-3cd8-42a3-891d-22c078a24762',
          concept: 'Test concept',
        },
        direction: {
          id: 'bd1409eb-7e2a-4d4f-abd5-10af53d28df6',
          title: 'Test direction',
          description: 'Test direction description',
          coreTension: 'Test core tension',
          uniqueTwist: 'Test unique twist',
          narrativePotential: 'Test narrative potential',
        },
        userInputs: {
          coreMotivation: 'To find redemption through helping others',
          internalContradiction: 'Wants to help but fears discovery of dark past',
          centralQuestion: 'Can someone truly change their nature?',
          additionalNotes: 'Test notes',
        },
        cliches: null, // This is the exact issue - null instead of array
      };

      // Act & Assert: Should throw the exact error from the logs
      await expect(traitsGenerator.generateTraits(params)).rejects.toThrow(
        TraitsGenerationError
      );

      await expect(traitsGenerator.generateTraits(params)).rejects.toThrow(
        'Validation failed for cliches: must be an array'
      );
    });

    it('should throw TraitsGenerationError when cliches is undefined', async () => {
      // Arrange: Create parameters with undefined cliches
      const params = {
        concept: {
          id: '9f5e16fb-3cd8-42a3-891d-22c078a24762',
          concept: 'Test concept',
        },
        direction: {
          id: 'bd1409eb-7e2a-4d4f-abd5-10af53d28df6',
          title: 'Test direction',
          description: 'Test direction description',
          coreTension: 'Test core tension',
          uniqueTwist: 'Test unique twist',
          narrativePotential: 'Test narrative potential',
        },
        userInputs: {
          coreMotivation: 'To find redemption through helping others',
          internalContradiction: 'Wants to help but fears discovery of dark past',
          centralQuestion: 'Can someone truly change their nature?',
          additionalNotes: 'Test notes',
        },
        // cliches is undefined (missing property)
      };

      // Act & Assert: Should throw validation error
      await expect(traitsGenerator.generateTraits(params)).rejects.toThrow(
        TraitsGenerationError
      );

      await expect(traitsGenerator.generateTraits(params)).rejects.toThrow(
        'Validation failed for cliches: must be an array'
      );
    });

    it('should NOT throw error when cliches is empty array', async () => {
      // Arrange: Create parameters with empty array cliches (should work)
      const mockParsedResponse = {
        names: [{ name: 'Test Name', justification: 'This is a test justification that meets the minimum length requirement.' }],
        physicalDescription: 'This is a test physical description that meets the minimum length requirement of 100 characters for validation purposes.',
        personality: [{ trait: 'friendly', explanation: 'This person is naturally friendly and welcoming to others' }],
        strengths: ['brave'],
        weaknesses: ['stubborn'],
        likes: ['reading'],
        dislikes: ['noise'],
        fears: ['heights'],
        goals: { primary: 'test goal', longTerm: 'What will they achieve in life?' },
        notes: ['test note'],
        profile: 'This is a comprehensive test profile that meets the minimum 200 character requirement for validation. It provides detailed information about the character including their background, personality traits, and motivations.',
        secrets: ['test secret'],
      };
      
      const mockResponse = JSON.stringify(mockParsedResponse);
      
      // Mock the correct LLM strategy factory method
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(mockResponse);
      
      // Mock the JSON service to return parsed response
      mockLlmJsonService.clean.mockReturnValue(mockResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(mockParsedResponse);

      const params = {
        concept: {
          id: '9f5e16fb-3cd8-42a3-891d-22c078a24762',
          concept: 'Test concept',
        },
        direction: {
          id: 'bd1409eb-7e2a-4d4f-abd5-10af53d28df6',
          title: 'Test direction',
          description: 'Test direction description',
          coreTension: 'Test core tension',
          uniqueTwist: 'Test unique twist',
          narrativePotential: 'Test narrative potential',
        },
        userInputs: {
          coreMotivation: 'To find redemption through helping others',
          internalContradiction: 'Wants to help but fears discovery of dark past',
          centralQuestion: 'Can someone truly change their nature?',
          additionalNotes: 'Test notes',
        },
        cliches: [], // Empty array should be valid
      };

      // Act: Should not throw an error
      const result = await traitsGenerator.generateTraits(params);

      // Assert: Should have successfully generated traits
      expect(result).toBeDefined();
      expect(result.names).toEqual([{ name: 'Test Name', justification: 'This is a test justification that meets the minimum length requirement.' }]);
      expect(result.metadata).toBeDefined();
    });
  });
});