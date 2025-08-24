/**
 * @file Integration tests for TraitsGenerator integration with CharacterBuilderService
 * @see src/characterBuilder/services/characterBuilderService.js
 * @see src/characterBuilder/services/TraitsGenerator.js
 *
 * These tests validate the integration between CharacterBuilderService and TraitsGenerator,
 * ensuring proper delegation, error handling, and event flow.
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
  CharacterBuilderService,
  CHARACTER_BUILDER_EVENTS,
  CharacterBuilderError,
} from '../../../../src/characterBuilder/services/characterBuilderService.js';
import { TraitsGenerator } from '../../../../src/characterBuilder/services/TraitsGenerator.js';

describe('TraitsGenerator Integration with CharacterBuilderService', () => {
  let characterBuilderService;
  let traitsGenerator;
  let mockLogger;
  let mockStorageService;
  let mockDirectionGenerator;
  let mockEventBus;
  let mockLlmJsonService;
  let mockLlmStrategyFactory;
  let mockLlmConfigManager;
  let mockTokenEstimator;

  // Sample valid traits generation response matching the expected schema
  const validTraitsResponse = {
    names: [
      {
        name: 'Alaric Ironward',
        justification:
          'A strong name that suggests both nobility and military prowess, fitting for a battle-scarred veteran',
      },
      {
        name: 'Marcus Thornfield',
        justification:
          'Combines a classic warrior name with a field-based surname suggesting grounding and stability',
      },
      {
        name: 'Gareth Soulstone',
        justification:
          'Evokes both strength and the weight of past experiences, suitable for someone seeking redemption',
      },
    ],
    physicalDescription:
      'A weathered man in his early forties with silver-streaked dark hair and deep lines around steel-gray eyes that have seen too much. His broad shoulders carry themselves with military bearing despite the weight of old wounds, and a jagged scar runs from his left temple to his jaw. Calloused hands and a slight limp speak to years of combat, while his simple, well-maintained clothes suggest discipline despite his fall from grace.',
    personality: [
      {
        trait: 'Protective Instinct',
        explanation:
          'Driven by an overwhelming need to shield others from the pain he has caused and experienced',
        behavioral_examples: [
          'Always positions himself between danger and innocents',
          'Cannot walk past someone in distress without helping',
        ],
      },
      {
        trait: 'Self-Punishing',
        explanation:
          'Believes he deserves suffering for his past mistakes and actively seeks hardship as penance',
        behavioral_examples: [
          'Refuses comfortable accommodations',
          'Takes on the most dangerous assignments',
        ],
      },
      {
        trait: 'Reluctant Mentor',
        explanation:
          'Knows his experience could help others but fears corrupting them with his darkness',
        behavioral_examples: [
          'Offers cryptic warnings rather than direct advice',
          'Watches over younger fighters from a distance',
        ],
      },
    ],
  };

  // Sample concept
  const sampleConcept = {
    id: 'concept-123',
    concept:
      'A battle-scarred veteran seeking redemption after a tragic mistake',
  };

  // Sample thematic direction
  const sampleDirection = {
    id: 'direction-456',
    title: 'The Path to Redemption',
    description: 'Exploring themes of guilt, forgiveness, and second chances',
    coreTension: 'The struggle between self-punishment and self-forgiveness',
    uniqueTwist:
      'Redemption comes through helping others find their own redemption',
  };

  // Sample user inputs
  const sampleUserInputs = {
    coreMotivation: 'To atone for past mistakes by protecting the innocent',
    internalContradiction:
      'Believes they deserve punishment yet knows others need their protection',
    centralQuestion:
      'Can someone who has caused great harm ever truly be redeemed?',
  };

  // Sample clichés
  const sampleClichés = [
    { id: 'cliche-1', text: 'Brooding antihero with a dark past' },
    { id: 'cliche-2', text: 'Reluctant mentor figure' },
    { id: 'cliche-3', text: 'Sacrificial hero complex' },
  ];

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock storage service
    mockStorageService = {
      initialize: jest.fn().mockResolvedValue(),
      storeCharacterConcept: jest.fn(),
      listCharacterConcepts: jest.fn(),
      getCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      storeThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
    };

    // Mock direction generator
    mockDirectionGenerator = {
      generateDirections: jest.fn(),
    };

    // Mock event bus
    mockEventBus = {
      dispatch: jest.fn(),
    };

    // Mock TraitsGenerator directly for integration testing
    // This allows us to test the integration without dealing with LLM response format complexity
    traitsGenerator = {
      generateTraits: jest.fn().mockResolvedValue(validTraitsResponse),
    };

    // Create CharacterBuilderService with mocked TraitsGenerator
    characterBuilderService = new CharacterBuilderService({
      logger: mockLogger,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
      traitsGenerator: traitsGenerator,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('successful traits generation workflow', () => {
    it('should successfully integrate TraitsGenerator with CharacterBuilderService', async () => {
      const params = {
        concept: sampleConcept,
        direction: sampleDirection,
        userInputs: sampleUserInputs,
        cliches: sampleClichés,
      };

      const options = {
        llmConfigId: 'test-config',
        maxRetries: 2,
      };

      const result = await characterBuilderService.generateTraits(
        params,
        options
      );

      // Verify result structure matches the expected response format
      expect(result).toHaveProperty('names');
      expect(result).toHaveProperty('physicalDescription');
      expect(result).toHaveProperty('personality');
      expect(Array.isArray(result.names)).toBe(true);
      expect(Array.isArray(result.personality)).toBe(true);
      expect(result.names.length).toBeGreaterThanOrEqual(3);

      // Verify TraitsGenerator was called with correct parameters
      expect(traitsGenerator.generateTraits).toHaveBeenCalledTimes(1);
      expect(traitsGenerator.generateTraits).toHaveBeenCalledWith(
        params,
        options
      );

      // Verify CharacterBuilderService logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterBuilderService: Delegating traits generation',
        {
          conceptId: 'concept-123',
          directionId: 'direction-456',
          clichesCount: 3,
        }
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterBuilderService: Traits generation completed',
        {
          conceptId: 'concept-123',
          success: true,
        }
      );
    });

    it('should handle minimal parameters correctly', async () => {
      const params = {
        concept: { id: 'simple-concept', concept: 'A simple character' },
        direction: {
          id: 'simple-direction',
          title: 'Basic Direction',
          description: 'A simple thematic direction for testing',
          coreTension: 'Basic tension for minimal test',
        },
        userInputs: {
          coreMotivation: 'Simple motivation for testing',
          internalContradiction: 'Basic contradiction for testing',
          centralQuestion: 'Simple question for testing?',
        },
        cliches: [],
      };

      const result = await characterBuilderService.generateTraits(params);

      expect(result).toHaveProperty('names');
      expect(result).toHaveProperty('physicalDescription');
      expect(result).toHaveProperty('personality');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterBuilderService: Delegating traits generation',
        {
          conceptId: 'simple-concept',
          directionId: 'simple-direction',
          clichesCount: 0,
        }
      );
    });
  });

  describe('error handling and recovery', () => {
    it('should handle LLM service errors gracefully', async () => {
      const params = {
        concept: sampleConcept,
        direction: sampleDirection,
        userInputs: sampleUserInputs,
        cliches: sampleClichés,
      };

      const traitsError = new Error('LLM service temporarily unavailable');
      traitsGenerator.generateTraits.mockRejectedValue(traitsError);

      await expect(
        characterBuilderService.generateTraits(params)
      ).rejects.toThrow(CharacterBuilderError);

      await expect(
        characterBuilderService.generateTraits(params)
      ).rejects.toThrow('Failed to generate traits');

      // Verify error was logged by CharacterBuilderService
      expect(mockLogger.error).toHaveBeenCalledWith(
        'CharacterBuilderService: Traits generation failed',
        expect.any(Error)
      );

      // Verify error event was dispatched by CharacterBuilderService
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED,
        payload: {
          error: 'LLM service temporarily unavailable',
          operation: 'generateTraits',
          context: {
            conceptId: 'concept-123',
            directionId: 'direction-456',
          },
        },
      });
    });

    it('should handle TraitsGenerator validation errors', async () => {
      const params = {
        concept: sampleConcept,
        direction: sampleDirection,
        userInputs: sampleUserInputs,
        cliches: sampleClichés,
      };

      // Mock validation error from TraitsGenerator
      const validationError = new Error('Invalid response structure from LLM');
      traitsGenerator.generateTraits.mockRejectedValue(validationError);

      await expect(
        characterBuilderService.generateTraits(params)
      ).rejects.toThrow(CharacterBuilderError);

      // Verify error logging
      expect(mockLogger.error).toHaveBeenCalledWith(
        'CharacterBuilderService: Traits generation failed',
        validationError
      );
    });
  });

  describe('options and configuration', () => {
    it('should pass through options correctly to TraitsGenerator', async () => {
      const params = {
        concept: sampleConcept,
        direction: sampleDirection,
        userInputs: sampleUserInputs,
        cliches: sampleClichés,
      };

      const customOptions = {
        llmConfigId: 'custom-gpt-4',
        maxRetries: 5,
      };

      await characterBuilderService.generateTraits(params, customOptions);

      // Verify TraitsGenerator was called with the custom options
      expect(traitsGenerator.generateTraits).toHaveBeenCalledTimes(1);
      expect(traitsGenerator.generateTraits).toHaveBeenCalledWith(
        params,
        customOptions
      );
    });
  });

  describe('service integration verification', () => {
    it('should verify CharacterBuilderService successfully delegates to TraitsGenerator', async () => {
      const params = {
        concept: sampleConcept,
        direction: sampleDirection,
        userInputs: sampleUserInputs,
        cliches: sampleClichés,
      };

      const result = await characterBuilderService.generateTraits(params);

      // Verify delegation worked correctly
      expect(traitsGenerator.generateTraits).toHaveBeenCalledTimes(1);
      expect(traitsGenerator.generateTraits).toHaveBeenCalledWith(params, {});
      expect(result).toEqual(validTraitsResponse);
    });
  });

  describe('service integration without TraitsGenerator', () => {
    it('should throw appropriate error when TraitsGenerator is not injected', async () => {
      // Create CharacterBuilderService without TraitsGenerator
      const serviceWithoutTraits = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
        // traitsGenerator intentionally omitted
      });

      const params = {
        concept: sampleConcept,
        direction: sampleDirection,
        userInputs: sampleUserInputs,
        cliches: sampleClichés,
      };

      await expect(serviceWithoutTraits.generateTraits(params)).rejects.toThrow(
        CharacterBuilderError
      );

      await expect(serviceWithoutTraits.generateTraits(params)).rejects.toThrow(
        'TraitsGenerator service not available'
      );
    });
  });
});
