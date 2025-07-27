/**
 * @file Controller for managing character concepts CRUD operations and UI
 * @see characterBuilderService.js
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { FormValidationHelper, ValidationPatterns } from '../shared/characterBuilder/formValidationHelper.js';

/** @typedef {import('../characterBuilder/services/characterBuilderService.js').CharacterBuilderService} CharacterBuilderService */
/** @typedef {import('../events/eventBus.js').EventBus} EventBus */
/** @typedef {import('../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../shared/characterBuilder/uiStateManager.js').UIStateManager} UIStateManager */

/**
 * Controller for the Character Concepts Manager page
 */
export class CharacterConceptsManagerController {
  #logger;
  #characterBuilderService;
  #eventBus;
  #uiStateManager;

  // Internal state
  #searchFilter = '';
  #conceptsData = [];
  #editingConceptId = null;
  #isInitialized = false;

  // DOM element references
  #elements = {};

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {CharacterBuilderService} deps.characterBuilderService
   * @param {EventBus} deps.eventBus
   */
  constructor({ logger, characterBuilderService, eventBus }) {
    // Validate dependencies
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(
      characterBuilderService,
      'CharacterBuilderService',
      logger,
      {
        requiredMethods: [
          'getAllCharacterConcepts',
          'createCharacterConcept',
          'updateCharacterConcept',
          'deleteCharacterConcept',
          'getThematicDirections',
        ],
      }
    );
    validateDependency(eventBus, 'EventBus', logger, {
      requiredMethods: ['on', 'off', 'dispatch'],
    });

    this.#logger = logger;
    this.#characterBuilderService = characterBuilderService;
    this.#eventBus = eventBus;

    this.#logger.info('CharacterConceptsManagerController initialized');
  }

  /**
   * Initialize the controller and set up the page
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.#isInitialized) {
      this.#logger.warn('Controller already initialized');
      return;
    }

    try {
      this.#logger.info('Initializing Character Concepts Manager');

      // Cache DOM elements
      this.#cacheElements();

      // Initialize UI state manager
      await this.#initializeUIStateManager();

      // Initialize service if needed
      await this.#initializeService();

      // Set up event listeners
      this.#setupEventListeners();

      // Load initial data
      await this.#loadConceptsData();

      this.#isInitialized = true;
      this.#logger.info('Character Concepts Manager initialization complete');
    } catch (error) {
      this.#logger.error(
        'Failed to initialize Character Concepts Manager',
        error
      );
      this.#showError(
        'Failed to initialize the page. Please refresh and try again.'
      );
      throw error;
    }
  }

  /**
   * Cache DOM element references
   */
  #cacheElements() {
    this.#elements = {
      // Main containers
      conceptsContainer: document.getElementById('concepts-container'),
      conceptsResults: document.getElementById('concepts-results'),

      // State containers
      emptyState: document.getElementById('empty-state'),
      loadingState: document.getElementById('loading-state'),
      errorState: document.getElementById('error-state'),
      resultsState: document.getElementById('results-state'),
      errorMessageText: document.getElementById('error-message-text'),

      // Controls
      createConceptBtn: document.getElementById('create-concept-btn'),
      createFirstBtn: document.getElementById('create-first-btn'),
      retryBtn: document.getElementById('retry-btn'),
      backToMenuBtn: document.getElementById('back-to-menu-btn'),
      conceptSearch: document.getElementById('concept-search'),

      // Statistics
      totalConcepts: document.getElementById('total-concepts'),
      conceptsWithDirections: document.getElementById(
        'concepts-with-directions'
      ),
      totalDirections: document.getElementById('total-directions'),

      // Create/Edit Modal
      conceptModal: document.getElementById('concept-modal'),
      conceptModalTitle: document.getElementById('concept-modal-title'),
      conceptForm: document.getElementById('concept-form'),
      conceptText: document.getElementById('concept-text'),
      charCount: document.getElementById('char-count'),
      conceptError: document.getElementById('concept-error'),
      saveConceptBtn: document.getElementById('save-concept-btn'),
      cancelConceptBtn: document.getElementById('cancel-concept-btn'),
      closeConceptModal: document.getElementById('close-concept-modal'),

      // Delete Modal
      deleteModal: document.getElementById('delete-confirmation-modal'),
      deleteModalMessage: document.getElementById('delete-modal-message'),
      confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
      cancelDeleteBtn: document.getElementById('cancel-delete-btn'),
      closeDeleteModal: document.getElementById('close-delete-modal'),
    };

    // Validate all elements exist
    for (const [key, element] of Object.entries(this.#elements)) {
      if (!element) {
        throw new Error(`Required element not found: ${key}`);
      }
    }
  }

  /**
   * Initialize the UI state manager
   */
  async #initializeUIStateManager() {
    const { UIStateManager } = await import('../shared/characterBuilder/uiStateManager.js');

    this.#uiStateManager = new UIStateManager({
      emptyState: this.#elements.emptyState,
      loadingState: this.#elements.loadingState,
      errorState: this.#elements.errorState,
      resultsState: this.#elements.resultsState,
    });
  }

  /**
   * Initialize the character builder service
   */
  async #initializeService() {
    try {
      await this.#characterBuilderService.initialize();
    } catch (error) {
      this.#logger.error(
        'Failed to initialize character builder service',
        error
      );
      throw error;
    }
  }

  /**
   * Set up all event listeners
   */
  #setupEventListeners() {
    // Button click handlers
    this.#elements.createConceptBtn.addEventListener('click', () =>
      this.#showCreateModal()
    );
    this.#elements.createFirstBtn.addEventListener('click', () =>
      this.#showCreateModal()
    );
    this.#elements.retryBtn.addEventListener('click', () =>
      this.#loadConceptsData()
    );
    this.#elements.backToMenuBtn.addEventListener('click', () =>
      this.#navigateToMenu()
    );

    // Search input with debouncing using FormValidationHelper
    let searchTimeout;
    this.#elements.conceptSearch.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.#handleSearch(e.target.value);
      }, 300);
    });

    // Modal handlers
    this.#setupModalHandlers();

    // Form handlers
    this.#setupFormHandlers();

    // Service event listeners
    this.#setupServiceEventListeners();
  }

  /**
   * Set up modal-specific event handlers
   */
  #setupModalHandlers() {
    // Create/Edit modal
    this.#elements.closeConceptModal.addEventListener('click', () =>
      this.#closeConceptModal()
    );
    this.#elements.cancelConceptBtn.addEventListener('click', () =>
      this.#closeConceptModal()
    );

    // Delete modal
    this.#elements.closeDeleteModal.addEventListener('click', () =>
      this.#closeDeleteModal()
    );
    this.#elements.cancelDeleteBtn.addEventListener('click', () =>
      this.#closeDeleteModal()
    );

    // Close modals on background click
    this.#elements.conceptModal.addEventListener('click', (e) => {
      if (e.target === this.#elements.conceptModal) {
        this.#closeConceptModal();
      }
    });

    this.#elements.deleteModal.addEventListener('click', (e) => {
      if (e.target === this.#elements.deleteModal) {
        this.#closeDeleteModal();
      }
    });

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.#elements.conceptModal.style.display !== 'none') {
          this.#closeConceptModal();
        }
        if (this.#elements.deleteModal.style.display !== 'none') {
          this.#closeDeleteModal();
        }
      }
    });
  }

  /**
   * Set up form-specific event handlers
   */
  #setupFormHandlers() {
    // Set up real-time validation using FormValidationHelper
    FormValidationHelper.setupRealTimeValidation(
      this.#elements.conceptText,
      ValidationPatterns.concept,
      {
        debounceMs: 300,
        countElement: this.#elements.charCount,
        maxLength: 1000,
      }
    );

    // Form submission
    this.#elements.conceptForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.#handleConceptSave();
    });
  }

  /**
   * Set up service event listeners
   */
  #setupServiceEventListeners() {
    // Import event constants from CharacterBuilderService
    import('../characterBuilder/services/characterBuilderService.js').then(
      ({ CHARACTER_BUILDER_EVENTS }) => {
        // Listen for concept events
        this.#eventBus.on(
          CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED,
          this.#handleConceptCreated.bind(this)
        );
        this.#eventBus.on(
          CHARACTER_BUILDER_EVENTS.CONCEPT_UPDATED,
          this.#handleConceptUpdated.bind(this)
        );
        this.#eventBus.on(
          CHARACTER_BUILDER_EVENTS.CONCEPT_DELETED,
          this.#handleConceptDeleted.bind(this)
        );
        this.#eventBus.on(
          CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED,
          this.#handleDirectionsGenerated.bind(this)
        );
      }
    );
  }

  /**
   * Navigate back to main menu
   */
  #navigateToMenu() {
    window.location.href = 'index.html';
  }

  /**
   * Show error state
   *
   * @param {string} message
   */
  #showError(message) {
    if (this.#uiStateManager) {
      this.#uiStateManager.showError(message);
    } else {
      this.#logger.error(`Error state: ${message}`);
    }
  }

  /**
   * Validate the concept form using FormValidationHelper
   *
   * @returns {boolean}
   */
  #validateConceptForm() {
    return FormValidationHelper.validateField(
      this.#elements.conceptText,
      ValidationPatterns.concept,
      'Concept'
    );
  }

  // Placeholder methods for operations (to be implemented in subsequent tickets)
  async #loadConceptsData() {
    this.#logger.info('Loading concepts data...');
    // Implementation in Ticket 05
  }

  #showCreateModal() {
    this.#logger.info('Showing create modal');
    // Implementation in Ticket 04
  }

  #closeConceptModal() {
    this.#logger.info('Closing concept modal');
    // Implementation in Ticket 04
  }

  #closeDeleteModal() {
    this.#logger.info('Closing delete modal');
    // Implementation in Ticket 07
  }

  #handleConceptSave() {
    this.#logger.info('Handling concept save');
    // Implementation in Ticket 04/06
  }

  #handleSearch(searchTerm) {
    this.#logger.info('Handling search', { searchTerm });
    // Implementation in Ticket 08
  }

  #handleConceptCreated(event) {
    this.#logger.info('Concept created event received', event.detail);
    // Implementation in Ticket 10
  }

  #handleConceptUpdated(event) {
    this.#logger.info('Concept updated event received', event.detail);
    // Implementation in Ticket 10
  }

  #handleConceptDeleted(event) {
    this.#logger.info('Concept deleted event received', event.detail);
    // Implementation in Ticket 10
  }

  #handleDirectionsGenerated(event) {
    this.#logger.info('Directions generated event received', event.detail);
    // Implementation in Ticket 10
  }
}

export default CharacterConceptsManagerController;