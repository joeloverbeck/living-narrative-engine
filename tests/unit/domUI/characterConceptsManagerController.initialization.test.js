/**
 * @file Unit tests for CharacterConceptsManagerController - Initialization
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
import {
  createMockLogger,
  createMockCharacterBuilderService,
  createMockEventBus,
  createMockElements,
  setupDocumentMock,
  createMockUIStateManager,
  flushPromises,
} from './characterConceptsManagerController.testUtils.js';

// Mock the UIStateManager
const mockUIStateManager = createMockUIStateManager();
jest.mock('../../../src/shared/characterBuilder/uiStateManager.js', () => ({
  UIStateManager: jest.fn().mockImplementation(() => mockUIStateManager),
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

describe('CharacterConceptsManagerController - Initialization', () => {
  let controller;
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockElements;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock dependencies
    mockLogger = createMockLogger();
    mockCharacterBuilderService = createMockCharacterBuilderService();
    mockEventBus = createMockEventBus();

    // Create mock DOM elements
    mockElements = createMockElements();
    setupDocumentMock(mockElements);

    // Mock window.getComputedStyle
    global.window = global.window || {};
    global.window.getComputedStyle = jest.fn((element) => ({
      display: element.style.display || 'block',
      visibility: element.style.visibility || 'visible',
    }));

    // Create controller instance
    controller = new CharacterConceptsManagerController({
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('DOM Element Caching', () => {
    it('should cache all required DOM elements during initialization', async () => {
      await controller.initialize();

      // Verify document.getElementById was called for all required elements
      const requiredElements = [
        'concepts-container',
        'concepts-results',
        'empty-state',
        'loading-state',
        'error-state',
        'results-state',
        'create-concept-btn',
        'concept-modal',
        'delete-confirmation-modal',
      ];

      requiredElements.forEach((id) => {
        expect(document.getElementById).toHaveBeenCalledWith(id);
      });
    });

    it('should throw error when required element is missing', async () => {
      // Remove a required element
      delete mockElements['concepts-container'];

      await expect(controller.initialize()).rejects.toThrow(
        'Required element not found: conceptsContainer'
      );
    });
  });

  describe('UIStateManager Integration', () => {
    it('should initialize UIStateManager with correct elements', async () => {
      await controller.initialize();

      // Verify UIStateManager was created
      expect(
        require('../../../src/shared/characterBuilder/uiStateManager.js')
          .UIStateManager
      ).toHaveBeenCalledWith({
        emptyState: mockElements['empty-state'],
        loadingState: mockElements['loading-state'],
        errorState: mockElements['error-state'],
        resultsState: mockElements['results-state'],
      });
    });
  });

  describe('Service Initialization', () => {
    it('should initialize character builder service', async () => {
      await controller.initialize();

      expect(mockCharacterBuilderService.initialize).toHaveBeenCalled();
    });

    it('should handle service initialization failure', async () => {
      const error = new Error('Service initialization failed');
      mockCharacterBuilderService.initialize.mockRejectedValue(error);

      await expect(controller.initialize()).rejects.toThrow(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize character builder service',
        error
      );
    });
  });

  describe('Event Listeners Setup', () => {
    it('should set up event listeners for all interactive elements', async () => {
      await controller.initialize();

      // Verify event listeners were added
      expect(
        mockElements['back-to-menu-btn'].addEventListener
      ).toHaveBeenCalledWith('click', expect.any(Function));

      expect(
        mockElements['concept-search'].addEventListener
      ).toHaveBeenCalledWith('input', expect.any(Function));

      expect(
        mockElements['create-concept-btn'].addEventListener
      ).toHaveBeenCalledWith('click', expect.any(Function));

      expect(
        mockElements['close-concept-modal'].addEventListener
      ).toHaveBeenCalledWith('click', expect.any(Function));

      expect(
        mockElements['concept-form'].addEventListener
      ).toHaveBeenCalledWith('submit', expect.any(Function));
    });

    it('should set up service event listeners', async () => {
      await controller.initialize();

      // Need to wait for the dynamic import to complete
      await flushPromises();

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'thematic:character_concept_created',
        expect.any(Function)
      );

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'thematic:character_concept_updated',
        expect.any(Function)
      );

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'thematic:character_concept_deleted',
        expect.any(Function)
      );
    });
  });

  describe('Form Validation Setup', () => {
    it('should set up real-time validation using FormValidationHelper', async () => {
      await controller.initialize();

      const FormValidationHelper =
        require('../../../src/shared/characterBuilder/formValidationHelper.js').FormValidationHelper;

      expect(FormValidationHelper.setupRealTimeValidation).toHaveBeenCalledWith(
        mockElements['concept-text'],
        expect.any(Function),
        {
          debounceMs: 300,
          countElement: mockElements['char-count'],
          maxLength: 3000,
        }
      );
    });
  });

  describe('Initialization Flow', () => {
    it('should complete full initialization successfully', async () => {
      await controller.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Character Concepts Manager initialization complete'
      );
    });

    it('should not reinitialize if already initialized', async () => {
      await controller.initialize();
      jest.clearAllMocks();

      await controller.initialize();

      expect(mockCharacterBuilderService.initialize).not.toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      const error = new Error('Initialization failed');
      mockCharacterBuilderService.initialize.mockRejectedValue(error);

      await expect(controller.initialize()).rejects.toThrow(error);
    });
  });

  describe('Navigation and Error Handling', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should handle back button click without errors', () => {
      const backBtn = mockElements['back-to-menu-btn'];
      const clickHandler = backBtn.addEventListener.mock.calls.find(
        (call) => call[0] === 'click'
      )[1];

      // Should not throw
      expect(() => clickHandler()).not.toThrow();
    });
  });

  describe('Form Validation', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should set up FormValidationHelper for real-time validation', () => {
      const FormValidationHelper =
        require('../../../src/shared/characterBuilder/formValidationHelper.js').FormValidationHelper;

      // Check that validation was set up for create form
      expect(FormValidationHelper.setupRealTimeValidation).toHaveBeenCalledWith(
        mockElements['concept-text'],
        expect.any(Function),
        {
          debounceMs: 300,
          countElement: mockElements['char-count'],
          maxLength: 3000,
        }
      );
    });
  });

  describe('Error State Display', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should initialize UIStateManager for error handling', () => {
      // UIStateManager should be initialized and ready for error display
      expect(mockUIStateManager).toBeDefined();
      // The UIStateManager is created during initialization
      expect(
        require('../../../src/shared/characterBuilder/uiStateManager.js')
          .UIStateManager
      ).toHaveBeenCalled();
    });
  });
});
