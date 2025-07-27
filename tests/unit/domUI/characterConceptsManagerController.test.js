/**
 * @file Unit tests for CharacterConceptsManagerController
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
  })),
  UI_STATES: {
    EMPTY: 'empty',
    LOADING: 'loading',
    RESULTS: 'results',
    ERROR: 'error',
  },
}));

// Mock FormValidationHelper
jest.mock('../../../src/shared/characterBuilder/formValidationHelper.js', () => ({
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
}));

// Mock the CharacterBuilderService events import
jest.mock('../../../src/characterBuilder/services/characterBuilderService.js', () => ({
  CHARACTER_BUILDER_EVENTS: {
    CONCEPT_CREATED: 'thematic:character_concept_created',
    CONCEPT_UPDATED: 'thematic:character_concept_updated',
    CONCEPT_DELETED: 'thematic:character_concept_deleted',
    DIRECTIONS_GENERATED: 'thematic:thematic_directions_generated',
  },
}));

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
      on: jest.fn(),
      off: jest.fn(),
      dispatch: jest.fn(),
    };
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
      }).toThrow('Missing required dependency: EventBus');
    });

    it('should throw error when eventBus is missing required methods', () => {
      const invalidEventBus = { on: jest.fn() }; // Missing off, dispatch

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

describe('CharacterConceptsManagerController - Initialization', () => {
  let controller;
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockElements;
  let mockElementsById;

  // Helper to create mock DOM elements
  const createMockElement = (id, tagName = 'DIV') => {
    return {
      id,
      tagName,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      style: { display: 'block' },
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn().mockReturnValue(false),
      },
    };
  };

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
      on: jest.fn(),
      off: jest.fn(),
      dispatch: jest.fn(),
    };

    // Mock DOM elements - using exact IDs from the controller
    mockElementsById = {
      'concepts-container': createMockElement('concepts-container'),
      'concepts-results': createMockElement('concepts-results'),
      'empty-state': createMockElement('empty-state'),
      'loading-state': createMockElement('loading-state'),
      'error-state': createMockElement('error-state'),
      'results-state': createMockElement('results-state'),
      'error-message-text': createMockElement('error-message-text'),
      'create-concept-btn': createMockElement('create-concept-btn', 'BUTTON'),
      'create-first-btn': createMockElement('create-first-btn', 'BUTTON'),
      'retry-btn': createMockElement('retry-btn', 'BUTTON'),
      'back-to-menu-btn': createMockElement('back-to-menu-btn', 'BUTTON'),
      'concept-search': createMockElement('concept-search', 'INPUT'),
      'total-concepts': createMockElement('total-concepts', 'SPAN'),
      'concepts-with-directions': createMockElement('concepts-with-directions', 'SPAN'),
      'total-directions': createMockElement('total-directions', 'SPAN'),
      'concept-modal': createMockElement('concept-modal'),
      'concept-modal-title': createMockElement('concept-modal-title'),
      'concept-form': createMockElement('concept-form', 'FORM'),
      'concept-text': createMockElement('concept-text', 'TEXTAREA'),
      'char-count': createMockElement('char-count', 'SPAN'),
      'concept-error': createMockElement('concept-error'),
      'save-concept-btn': createMockElement('save-concept-btn', 'BUTTON'),
      'cancel-concept-btn': createMockElement('cancel-concept-btn', 'BUTTON'),
      'close-concept-modal': createMockElement('close-concept-modal', 'BUTTON'),
      'delete-confirmation-modal': createMockElement('delete-confirmation-modal'),
      'delete-modal-message': createMockElement('delete-modal-message'),
      'confirm-delete-btn': createMockElement('confirm-delete-btn', 'BUTTON'),
      'cancel-delete-btn': createMockElement('cancel-delete-btn', 'BUTTON'),
      'close-delete-modal': createMockElement('close-delete-modal', 'BUTTON'),
    };

    // Create a lookup that matches the controller's camelCase property names to kebab-case IDs
    mockElements = {
      conceptsContainer: mockElementsById['concepts-container'],
      conceptsResults: mockElementsById['concepts-results'],
      emptyState: mockElementsById['empty-state'],
      loadingState: mockElementsById['loading-state'],
      errorState: mockElementsById['error-state'],
      resultsState: mockElementsById['results-state'],
      errorMessageText: mockElementsById['error-message-text'],
      createConceptBtn: mockElementsById['create-concept-btn'],
      createFirstBtn: mockElementsById['create-first-btn'],
      retryBtn: mockElementsById['retry-btn'],
      backToMenuBtn: mockElementsById['back-to-menu-btn'],
      conceptSearch: mockElementsById['concept-search'],
      totalConcepts: mockElementsById['total-concepts'],
      conceptsWithDirections: mockElementsById['concepts-with-directions'],
      totalDirections: mockElementsById['total-directions'],
      conceptModal: mockElementsById['concept-modal'],
      conceptModalTitle: mockElementsById['concept-modal-title'],
      conceptForm: mockElementsById['concept-form'],
      conceptText: mockElementsById['concept-text'],
      charCount: mockElementsById['char-count'],
      conceptError: mockElementsById['concept-error'],
      saveConceptBtn: mockElementsById['save-concept-btn'],
      cancelConceptBtn: mockElementsById['cancel-concept-btn'],
      closeConceptModal: mockElementsById['close-concept-modal'],
      deleteModal: mockElementsById['delete-confirmation-modal'],
      deleteModalMessage: mockElementsById['delete-modal-message'],
      confirmDeleteBtn: mockElementsById['confirm-delete-btn'],
      cancelDeleteBtn: mockElementsById['cancel-delete-btn'],
      closeDeleteModal: mockElementsById['close-delete-modal'],
    };

    // Mock document.getElementById to return elements by their kebab-case IDs
    const mockGetElementById = jest.fn((id) => {
      return mockElementsById[id] || null;
    });
    
    // Mock document in jsdom environment
    Object.defineProperty(document, 'getElementById', {
      value: mockGetElementById,
      writable: true,
      configurable: true,
    });
    
    // Mock addEventListener as well
    const mockAddEventListener = jest.fn();
    Object.defineProperty(document, 'addEventListener', {
      value: mockAddEventListener,
      writable: true,
      configurable: true,
    });
    
    // Also ensure a complete document mock
    global.document = {
      ...document,
      getElementById: mockGetElementById,
      addEventListener: mockAddEventListener,
    };

    controller = new CharacterConceptsManagerController({
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
    });
  });

  afterEach(() => {
    delete global.document;
  });

  describe('DOM Element Caching', () => {
    it('should cache all required DOM elements during initialization', async () => {
      await controller.initialize();

      // Verify all elements were requested
      expect(document.getElementById).toHaveBeenCalledWith('concepts-container');
      expect(document.getElementById).toHaveBeenCalledWith('concepts-results');
      expect(document.getElementById).toHaveBeenCalledWith('empty-state');
      expect(document.getElementById).toHaveBeenCalledWith('loading-state');
      expect(document.getElementById).toHaveBeenCalledWith('error-state');
      expect(document.getElementById).toHaveBeenCalledWith('results-state');
      expect(document.getElementById).toHaveBeenCalledWith('create-concept-btn');
      expect(document.getElementById).toHaveBeenCalledWith('concept-search');
      expect(document.getElementById).toHaveBeenCalledWith('concept-modal');
      expect(document.getElementById).toHaveBeenCalledWith('delete-confirmation-modal');
    });

    it('should throw error when required element is missing', async () => {
      // Remove one required element from the mock
      mockElementsById['concepts-container'] = null;
      // Update the mock function to return null for this element
      const originalMock = document.getElementById;
      document.getElementById = jest.fn((id) => {
        return mockElementsById[id] || null;
      });

      await expect(controller.initialize()).rejects.toThrow(
        'Required element not found: conceptsContainer'
      );
      
      // Restore original mock
      document.getElementById = originalMock;
    });
  });

  describe('UIStateManager Integration', () => {
    it('should initialize UIStateManager with correct elements', async () => {
      const { UIStateManager } = await import('../../../src/shared/characterBuilder/uiStateManager.js');

      await controller.initialize();

      expect(UIStateManager).toHaveBeenCalledWith({
        emptyState: mockElements.emptyState,
        loadingState: mockElements.loadingState,
        errorState: mockElements.errorState,
        resultsState: mockElements.resultsState,
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

      // Verify button event listeners
      expect(mockElements.createConceptBtn.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
      expect(mockElements.createFirstBtn.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
      expect(mockElements.retryBtn.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
      expect(mockElements.backToMenuBtn.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );

      // Verify search input listener
      expect(mockElements.conceptSearch.addEventListener).toHaveBeenCalledWith(
        'input',
        expect.any(Function)
      );

      // Verify modal listeners
      expect(mockElements.closeConceptModal.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
      expect(mockElements.cancelConceptBtn.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
      expect(mockElements.closeDeleteModal.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
      expect(mockElements.cancelDeleteBtn.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );

      // Verify form submission listener
      expect(mockElements.conceptForm.addEventListener).toHaveBeenCalledWith(
        'submit',
        expect.any(Function)
      );

      // Verify modal background click listeners
      expect(mockElements.conceptModal.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
      expect(mockElements.deleteModal.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );

      // Verify document keydown listener for Escape key
      expect(document.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    it('should set up service event listeners', async () => {
      await controller.initialize();

      // Need to wait for the dynamic import to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockEventBus.on).toHaveBeenCalledWith(
        'thematic:character_concept_created',
        expect.any(Function)
      );
      expect(mockEventBus.on).toHaveBeenCalledWith(
        'thematic:character_concept_updated',
        expect.any(Function)
      );
      expect(mockEventBus.on).toHaveBeenCalledWith(
        'thematic:character_concept_deleted',
        expect.any(Function)
      );
      expect(mockEventBus.on).toHaveBeenCalledWith(
        'thematic:thematic_directions_generated',
        expect.any(Function)
      );
    });
  });

  describe('Form Validation Setup', () => {
    it('should set up real-time validation using FormValidationHelper', async () => {
      const { FormValidationHelper, ValidationPatterns } = await import('../../../src/shared/characterBuilder/formValidationHelper.js');

      await controller.initialize();

      expect(FormValidationHelper.setupRealTimeValidation).toHaveBeenCalledWith(
        mockElements.conceptText,
        ValidationPatterns.concept,
        {
          debounceMs: 300,
          countElement: mockElements.charCount,
          maxLength: 3000,
        }
      );
    });
  });

  describe('Initialization Flow', () => {
    it('should complete full initialization successfully', async () => {
      await controller.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('Initializing Character Concepts Manager');
      expect(mockLogger.info).toHaveBeenCalledWith('Character Concepts Manager initialization complete');
    });

    it('should not reinitialize if already initialized', async () => {
      await controller.initialize();
      jest.clearAllMocks();

      await controller.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith('Controller already initialized');
      expect(mockCharacterBuilderService.initialize).not.toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      const error = new Error('Initialization failed');
      mockCharacterBuilderService.initialize.mockRejectedValue(error);

      await expect(controller.initialize()).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize Character Concepts Manager',
        error
      );
    });
  });

  describe('Navigation and Error Handling', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should handle back button click without errors', () => {
      // Simulate back button click
      const backButtonHandler = mockElements.backToMenuBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];

      // The navigation method should execute without throwing an error
      expect(() => {
        backButtonHandler();
      }).not.toThrow();
      
      // Verify the handler was found and is a function
      expect(backButtonHandler).toBeInstanceOf(Function);
    });
  });

  describe('Form Validation', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should set up FormValidationHelper for real-time validation', () => {
      // Test that validation setup was called during initialization
      const { FormValidationHelper, ValidationPatterns } = require('../../../src/shared/characterBuilder/formValidationHelper.js');

      expect(FormValidationHelper.setupRealTimeValidation).toHaveBeenCalledWith(
        mockElements.conceptText,
        ValidationPatterns.concept,
        {
          debounceMs: 300,
          countElement: mockElements.charCount,
          maxLength: 3000,
        }
      );
    });
  });

  describe('Placeholder Methods', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should log appropriate messages for placeholder methods', () => {
      // These methods are placeholders and should log their intent
      const createBtnHandler = mockElements.createConceptBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      const retryBtnHandler = mockElements.retryBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];

      createBtnHandler();
      retryBtnHandler();

      expect(mockLogger.info).toHaveBeenCalledWith('Showing create modal');
      expect(mockLogger.info).toHaveBeenCalledWith('Loading concepts data...');
    });
  });

  describe('Error State Display', () => {
    let mockUIStateManager;

    beforeEach(async () => {
      await controller.initialize();
      mockUIStateManager = require('../../../src/shared/characterBuilder/uiStateManager.js').UIStateManager.mock.results[0].value;
    });

    it('should initialize UIStateManager for error handling', () => {
      // Test that UIStateManager was initialized during setup
      expect(mockUIStateManager).toBeDefined();
      expect(mockUIStateManager.showError).toBeDefined();
      expect(mockUIStateManager.showLoading).toBeDefined();
      expect(mockUIStateManager.showState).toBeDefined();
      expect(mockUIStateManager.getCurrentState).toBeDefined();
    });
  });
});