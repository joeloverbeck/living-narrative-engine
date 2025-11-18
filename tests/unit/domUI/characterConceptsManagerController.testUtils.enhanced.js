/**
 * @file Enhanced test utilities for CharacterConceptsManagerController tests
 * @description Extends BaseCharacterBuilderControllerTestBase while preserving existing utilities
 */

import { jest } from '@jest/globals';
import { BaseCharacterBuilderControllerTestBase } from '../characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';
import {
  createTestContainer,
  resolveControllerDependencies,
} from '../../common/testContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { ControllerLifecycleOrchestrator } from '../../../src/characterBuilder/services/controllerLifecycleOrchestrator.js';
import {
  createMockElements,
  setupDocumentMock,
  createMockUIStateManager,
  flushPromises,
  createTestConcept,
  createTestDirection,
  createKeyboardEvent,
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

/**
 * Enhanced test base for CharacterConceptsManagerController
 * Integrates with BaseCharacterBuilderControllerTestBase while preserving existing utilities
 */
export class CharacterConceptsManagerTestBase extends BaseCharacterBuilderControllerTestBase {
  constructor() {
    super();
    this.mockUIStateManager = null;
    this.mockElements = null;
    this.controllerDependencies = null;
    this._controllerContainer = null;
  }

  /**
   * Setup before each test
   *
   * @returns {Promise<void>}
   */
  async setup() {
    // Call parent setup first
    await super.setup();

    // Setup UIStateManager mock
    this.mockUIStateManager = createMockUIStateManager();

    // Add concept-specific DOM elements using existing utilities
    this.mockElements = createMockElements();
    setupDocumentMock(this.mockElements);

    // Override base class DOM with more complete setup
    this.setupConceptsDOM();

    // Setup additional mocks
    this.setupAdditionalMocks();

    this._controllerContainer = await createTestContainer({
      mockServices: {
        [tokens.CharacterBuilderService]: this.mocks.characterBuilderService,
      },
    });
    this.controllerDependencies = resolveControllerDependencies(
      this._controllerContainer
    );

    // Ensure lifecycle orchestrator shares the mocked event bus so tests can observe dispatched events
    this.controllerDependencies.controllerLifecycleOrchestrator =
      new ControllerLifecycleOrchestrator({
        logger: this.mocks.logger,
        eventBus: this.mocks.eventBus,
      });
  }

  /**
   * Setup concept-specific DOM elements
   */
  setupConceptsDOM() {
    // Clear the basic DOM from base class
    document.body.innerHTML = '';

    // Use addDOMElement from base class for additional elements
    const conceptSpecificElements = [
      '<div id="concepts-container" class="cb-state-container"></div>',
      '<div id="concepts-results" class="concepts-grid"></div>',
      '<button id="create-concept-btn" class="btn btn-primary">Create</button>',
      '<button id="create-first-btn" class="btn btn-outline-primary">Create First</button>',
      '<input id="concept-search" type="text" class="form-control" />',
      '<span id="total-concepts" class="stat-value">0</span>',
      '<span id="concepts-with-directions" class="stat-value">0</span>',
      '<span id="total-directions" class="stat-value">0</span>',
      // Modal elements
      '<div id="concept-modal" class="modal"></div>',
      '<h5 id="concept-modal-title" class="modal-title"></h5>',
      '<form id="concept-form"></form>',
      '<textarea id="concept-text" class="form-control"></textarea>',
      '<span id="char-count" class="char-count">0/500</span>',
      '<div id="concept-error" class="error-message"></div>',
      '<div id="concept-help" class="help-text"></div>',
      '<button id="save-concept-btn" class="btn btn-primary">Save</button>',
      '<button id="cancel-concept-btn" class="btn btn-secondary">Cancel</button>',
      '<button id="close-concept-modal" class="btn-close">×</button>',
      // Delete modal
      '<div id="delete-confirmation-modal" class="modal"></div>',
      '<h5 id="delete-modal-title" class="modal-title">Confirm Delete</h5>',
      '<p id="delete-modal-message"></p>',
      '<button id="confirm-delete-btn" class="btn btn-danger">Delete</button>',
      '<button id="cancel-delete-btn" class="btn btn-secondary">Cancel</button>',
      '<button id="close-delete-modal" class="btn-close">×</button>',
      // State elements
      '<div id="empty-state" class="state-container"></div>',
      '<div id="loading-state" class="state-container" style="display: none;"></div>',
      '<div id="error-state" class="state-container" style="display: none;"></div>',
      '<div id="results-state" class="state-container" style="display: none;"></div>',
      '<span id="error-message-text" class="error-message-text"></span>',
      '<button id="retry-btn" class="btn btn-primary">Retry</button>',
      '<button id="back-to-menu-btn" class="btn btn-secondary">Back</button>',
      // Search elements
      '<input id="search-concepts" type="text" class="form-control" />',
      '<button id="clear-search-btn" class="btn btn-sm">Clear</button>',
      '<div id="search-status" class="search-status"></div>',
      // Create modal elements
      '<div id="create-modal" class="modal"></div>',
      '<div id="create-modal-overlay" class="modal-overlay"></div>',
      '<button id="close-create-modal" class="btn-close">×</button>',
      '<textarea id="create-concept-text" class="form-control"></textarea>',
      '<span id="create-char-count" class="char-count">0/500</span>',
      '<div id="create-error" class="error-message"></div>',
      '<button id="save-create-btn" class="btn btn-primary">Save</button>',
      // Edit modal elements
      '<div id="edit-modal" class="modal"></div>',
      '<div id="edit-modal-overlay" class="modal-overlay"></div>',
      '<button id="close-edit-modal" class="btn-close">×</button>',
      '<textarea id="edit-concept-text" class="form-control"></textarea>',
      '<span id="edit-char-count" class="char-count">0/500</span>',
      '<div id="edit-error" class="error-message"></div>',
      '<button id="save-edit-btn" class="btn btn-primary">Save</button>',
      // Delete modal elements
      '<div id="delete-modal" class="modal"></div>',
      '<div id="delete-modal-overlay" class="modal-overlay"></div>',
      '<div id="delete-message" class="delete-message"></div>',
      '<div id="delete-error" class="error-message"></div>',
      // Stats display
      '<div class="stats-display"></div>',
    ];

    conceptSpecificElements.forEach((html) => {
      this.addDOMElement(html);
    });

    // Add form reset method to concept-form
    const conceptForm = document.getElementById('concept-form');
    if (conceptForm) {
      conceptForm.reset = jest.fn();
    }

    // Setup concepts-results element with additional methods
    const conceptsResults = document.getElementById('concepts-results');
    if (conceptsResults) {
      conceptsResults.querySelector = jest.fn().mockReturnValue(null);
      conceptsResults.innerHTML = '';
      conceptsResults.appendChild = jest.fn();
      conceptsResults.classList = {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(),
      };
    }
  }

  /**
   * Setup additional mocks specific to CharacterConceptsManagerController
   */
  setupAdditionalMocks() {
    // Mock window.getComputedStyle
    global.window = global.window || {};
    global.window.getComputedStyle = jest.fn((element) => ({
      display: element.style.display || 'block',
      visibility: element.style.visibility || 'visible',
    }));

    // Mock document.activeElement
    Object.defineProperty(document, 'activeElement', {
      writable: true,
      value: document.getElementById('concept-text') || document.body,
    });
  }

  /**
   * Create controller instance with proper dependencies
   *
   * @param additionalDeps
   * @returns {CharacterConceptsManagerController}
   */
  createController(additionalDeps = {}) {
    return new CharacterConceptsManagerController({
      logger: this.mocks.logger,
      characterBuilderService: this.mocks.characterBuilderService,
      eventBus: this.mocks.eventBus,
      schemaValidator: this.mocks.schemaValidator,
      ...this.controllerDependencies,
      ...additionalDeps,
    });
  }

  /**
   * Helper to configure concept-specific mocks
   *
   * @param {Array<object>} concepts - Array of concept objects
   */
  configureConcepts(concepts = []) {
    this.mocks.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
      concepts
    );
  }

  /**
   * Configure thematic directions mock
   *
   * @param {Array<object>} directions - Array of direction objects
   */
  configureDirections(directions = []) {
    this.mocks.characterBuilderService.getThematicDirections.mockResolvedValue(
      directions
    );
  }

  /**
   * Configure concept creation response
   *
   * @param {object} concept - Concept object to return
   */
  configureConceptCreation(concept) {
    this.mocks.characterBuilderService.createCharacterConcept.mockResolvedValue(
      concept
    );
  }

  /**
   * Configure concept update response
   *
   * @param {object} concept - Updated concept object to return
   */
  configureConceptUpdate(concept) {
    this.mocks.characterBuilderService.updateCharacterConcept.mockResolvedValue(
      concept
    );
  }

  /**
   * Configure concept deletion response
   *
   * @param {boolean} success - Whether deletion should succeed
   */
  configureConceptDeletion(success = true) {
    if (success) {
      this.mocks.characterBuilderService.deleteCharacterConcept.mockResolvedValue(
        true
      );
    } else {
      this.mocks.characterBuilderService.deleteCharacterConcept.mockRejectedValue(
        new Error('Deletion failed')
      );
    }
  }

  /**
   * Preserve existing test utilities
   *
   * @returns {Promise<void>}
   */
  async flushPromises() {
    return flushPromises();
  }

  /**
   * Create test concept data
   *
   * @param {object} overrides - Properties to override
   * @returns {object} Test concept
   */
  createTestConcept(overrides = {}) {
    return createTestConcept(overrides);
  }

  /**
   * Create test direction data
   *
   * @param {object} overrides - Properties to override
   * @returns {object} Test direction
   */
  createTestDirection(overrides = {}) {
    return createTestDirection(overrides);
  }

  /**
   * Create keyboard event
   *
   * @param {string} key - Key to simulate
   * @param {object} options - Additional options
   * @returns {KeyboardEvent}
   */
  createKeyboardEvent(key, options = {}) {
    return createKeyboardEvent(key, options);
  }

  /**
   * Get mock UIStateManager
   *
   * @returns {object} Mock UIStateManager
   */
  getUIStateManager() {
    return this.mockUIStateManager;
  }

  /**
   * Get mock DOM elements
   *
   * @returns {object} Mock elements
   */
  getElements() {
    return this.mockElements;
  }

  /**
   * Populate controller's internal elements cache (for tests that need it)
   *
   * @param {CharacterConceptsManagerController} controller - Controller instance
   */
  populateControllerElements(controller) {
    if (controller._testExports) {
      controller._testExports.elements = {
        conceptsContainer: this.mockElements['concepts-container'],
        conceptsResults: this.mockElements['concepts-results'],
        emptyState: this.mockElements['empty-state'],
        loadingState: this.mockElements['loading-state'],
        errorState: this.mockElements['error-state'],
        resultsState: this.mockElements['results-state'],
        errorMessageText: this.mockElements['error-message-text'],
        createConceptBtn: this.mockElements['create-concept-btn'],
        createFirstBtn: this.mockElements['create-first-btn'],
        retryBtn: this.mockElements['retry-btn'],
        backToMenuBtn: this.mockElements['back-to-menu-btn'],
        conceptSearch: this.mockElements['concept-search'],
        statsDisplay: document.querySelector('.stats-display'),
        totalConcepts: this.mockElements['total-concepts'],
        conceptsWithDirections: this.mockElements['concepts-with-directions'],
        totalDirections: this.mockElements['total-directions'],
        conceptModal: this.mockElements['concept-modal'],
        conceptModalTitle: this.mockElements['concept-modal-title'],
        conceptForm: this.mockElements['concept-form'],
        conceptText: this.mockElements['concept-text'],
        charCount: this.mockElements['char-count'],
        conceptError: this.mockElements['concept-error'],
        saveConceptBtn: this.mockElements['save-concept-btn'],
        cancelConceptBtn: this.mockElements['cancel-concept-btn'],
        closeConceptModal: this.mockElements['close-concept-modal'],
        deleteModal: this.mockElements['delete-confirmation-modal'],
        deleteModalMessage: this.mockElements['delete-modal-message'],
        confirmDeleteBtn: this.mockElements['confirm-delete-btn'],
        cancelDeleteBtn: this.mockElements['cancel-delete-btn'],
        closeDeleteModal: this.mockElements['close-delete-modal'],
      };
    }
  }
}
