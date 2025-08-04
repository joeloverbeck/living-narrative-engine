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
      CONCEPT_CREATED: 'core:character_concept_created',
      CONCEPT_UPDATED: 'core:character_concept_updated',
      CONCEPT_DELETED: 'core:character_concept_deleted',
      DIRECTIONS_GENERATED: 'core:thematic_directions_generated',
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

    it('should log warning when required element is missing', async () => {
      // Remove a required element
      delete mockElements['concepts-container'];

      // Should not throw but log a warning
      await controller.initialize();

      // Verify that warn was called for the missing element
      const warnCalls = mockLogger.warn.mock.calls;
      const hasWarningForMissingElement = warnCalls.some(
        (call) =>
          call[0].includes('Failed to cache element') &&
          call[0].includes('conceptsContainer')
      );
      expect(hasWarningForMissingElement).toBe(true);
    });
  });

  describe('UIStateManager Integration', () => {
    it('should initialize UIStateManager with correct elements', async () => {
      await controller.initialize();

      // Verify UIStateManager was created
      const UIStateManager =
        require('../../../src/shared/characterBuilder/uiStateManager.js').UIStateManager;
      expect(UIStateManager).toHaveBeenCalled();

      // Get the call arguments
      const callArgs = UIStateManager.mock.calls[0][0];

      // Verify the correct element properties were passed
      expect(callArgs).toHaveProperty('emptyState');
      expect(callArgs).toHaveProperty('loadingState');
      expect(callArgs).toHaveProperty('errorState');
      expect(callArgs).toHaveProperty('resultsState');

      // Verify the structure was passed
      expect(callArgs).toHaveProperty('emptyState');
      expect(callArgs).toHaveProperty('loadingState');
      expect(callArgs).toHaveProperty('errorState');
      expect(callArgs).toHaveProperty('resultsState');
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

      await expect(controller.initialize()).rejects.toThrow(
        'service initialization failed'
      );

      // The error is logged differently by the base class
      const errorCalls = mockLogger.error.mock.calls;
      const hasServiceError = errorCalls.some(
        (call) =>
          call[0].includes('Failed service initialization') && call[1] === error
      );
      expect(hasServiceError).toBe(true);
    });
  });

  describe('Event Listeners Setup', () => {
    it('should set up event listeners for all interactive elements', async () => {
      await controller.initialize();

      // Verify event listeners were added - check specific elements that should have listeners
      const backBtn = mockElements['back-to-menu-btn'];
      const searchInput = mockElements['concept-search'];
      const createBtn = mockElements['create-concept-btn'];
      const closeModal = mockElements['close-concept-modal'];
      const form = mockElements['concept-form'];

      // At least verify that addEventListener was called on these elements
      expect(backBtn.addEventListener).toHaveBeenCalled();
      expect(searchInput.addEventListener).toHaveBeenCalled();
      expect(createBtn.addEventListener).toHaveBeenCalled();
      expect(closeModal.addEventListener).toHaveBeenCalled();
      expect(form.addEventListener).toHaveBeenCalled();
    });

    it('should set up service event listeners', async () => {
      await controller.initialize();

      // Need to wait for the dynamic import to complete
      await flushPromises();

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'core:character_concept_created',
        expect.any(Function)
      );

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'core:character_concept_updated',
        expect.any(Function)
      );

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'core:character_concept_deleted',
        expect.any(Function)
      );
    });
  });

  describe('Form Validation Setup', () => {
    it('should have form validation ready but not set up until modal is shown', async () => {
      await controller.initialize();

      const FormValidationHelper =
        require('../../../src/shared/characterBuilder/formValidationHelper.js').FormValidationHelper;

      // FormValidationHelper should not be called during initialization
      expect(
        FormValidationHelper.setupRealTimeValidation
      ).not.toHaveBeenCalled();

      // It will be called when the modal is shown (tested in modal display tests)
    });
  });

  describe('Initialization Flow', () => {
    it('should complete full initialization successfully', async () => {
      await controller.initialize();

      // Check that initialization completed by looking at the info calls
      const infoCalls = mockLogger.info.mock.calls;
      const completionCall = infoCalls.find((call) =>
        call[0].includes('Initialization completed')
      );
      expect(completionCall).toBeTruthy();
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

      await expect(controller.initialize()).rejects.toThrow(
        'service initialization failed'
      );
    });
  });

  describe('Navigation and Error Handling', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should handle back button click without errors', () => {
      const backBtn = mockElements['back-to-menu-btn'];

      // Verify the button has addEventListener called
      expect(backBtn.addEventListener).toHaveBeenCalled();

      // Find the click handler call
      const clickCalls = backBtn.addEventListener.mock.calls.filter(
        (call) => call[0] === 'click'
      );

      // Should have at least one click handler
      expect(clickCalls.length).toBeGreaterThan(0);

      if (clickCalls.length > 0) {
        const clickHandler = clickCalls[0][1];
        // Should not throw when called
        expect(() => clickHandler()).not.toThrow();
      }
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
