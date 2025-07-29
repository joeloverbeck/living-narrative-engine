/**
 * @file Unit tests for CharacterConceptsManagerController - Constructor and Dependencies
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';

// Mock the UIStateManager
jest.mock('../../../src/shared/characterBuilder/uiStateManager.js', () => ({
  UIStateManager: jest.fn().mockImplementation(() => ({
    showState: jest.fn(),
    showError: jest.fn(),
    showLoading: jest.fn(),
    getCurrentState: jest.fn(),
    setState: jest.fn(),
  })),
  UI_STATES: {
    EMPTY: 'empty',
    LOADING: 'loading',
    RESULTS: 'results',
    ERROR: 'error',
  },
}));

// Mock FormValidationHelper
jest.mock(
  '../../../src/shared/characterBuilder/formValidationHelper.js',
  () => ({
    FormValidationHelper: {
      setupRealTimeValidation: jest.fn(),
      validateField: jest.fn().mockReturnValue(true),
      showFieldError: jest.fn(),
      clearFieldError: jest.fn(),
      validateTextInput: jest.fn().mockReturnValue({ isValid: true }),
      updateCharacterCount: jest.fn(),
      validateRequiredField: jest.fn().mockReturnValue(true),
    },
    ValidationPatterns: {
      concept: jest.fn().mockReturnValue({ isValid: true }),
      title: jest.fn().mockReturnValue({ isValid: true }),
      description: jest.fn().mockReturnValue({ isValid: true }),
      shortText: jest.fn().mockReturnValue({ isValid: true }),
      longText: jest.fn().mockReturnValue({ isValid: true }),
    },
  })
);

// Mock the CharacterBuilderService events import
jest.mock(
  '../../../src/characterBuilder/services/characterBuilderService.js',
  () => ({
    CHARACTER_BUILDER_EVENTS: {
      CONCEPT_CREATED: 'thematic:character_concept_created',
      CONCEPT_UPDATED: 'thematic:character_concept_updated',
      CONCEPT_DELETED: 'thematic:character_concept_deleted',
      DIRECTIONS_GENERATED: 'thematic:thematic_directions_generated',
    },
  })
);

describe('CharacterConceptsManagerController - Constructor and Dependencies', () => {
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;

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

    mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getThematicDirections: jest.fn().mockResolvedValue([]),
    };

    mockEventBus = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      dispatch: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor Validation', () => {
    it('should create controller with valid dependencies', () => {
      const controller = new CharacterConceptsManagerController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
      });

      expect(controller).toBeInstanceOf(CharacterConceptsManagerController);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterConceptsManagerController initialized'
      );
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new CharacterConceptsManagerController({
          logger: null,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
        });
      }).toThrow('Missing required dependency: ILogger');
    });

    it('should throw error when logger is missing required methods', () => {
      const invalidLogger = { info: jest.fn() }; // Missing debug, warn, error

      expect(() => {
        new CharacterConceptsManagerController({
          logger: invalidLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
        });
      }).toThrow('Invalid or missing method');
    });

    it('should throw error when characterBuilderService is missing', () => {
      expect(() => {
        new CharacterConceptsManagerController({
          logger: mockLogger,
          characterBuilderService: null,
          eventBus: mockEventBus,
        });
      }).toThrow('Missing required dependency: CharacterBuilderService');
    });

    it('should throw error when characterBuilderService is missing required methods', () => {
      const invalidService = { getAllCharacterConcepts: jest.fn() }; // Missing other methods

      expect(() => {
        new CharacterConceptsManagerController({
          logger: mockLogger,
          characterBuilderService: invalidService,
          eventBus: mockEventBus,
        });
      }).toThrow('Invalid or missing method');
    });

    it('should throw error when eventBus is missing', () => {
      expect(() => {
        new CharacterConceptsManagerController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: null,
        });
      }).toThrow('Missing required dependency: ISafeEventDispatcher');
    });

    it('should throw error when eventBus is missing required methods', () => {
      const invalidEventBus = { subscribe: jest.fn() }; // Missing unsubscribe, dispatch

      expect(() => {
        new CharacterConceptsManagerController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: invalidEventBus,
        });
      }).toThrow('Invalid or missing method');
    });
  });
});