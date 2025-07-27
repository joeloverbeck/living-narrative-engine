# Ticket 03: Controller Setup and Basic Structure

## Overview

Create the CharacterConceptsManagerController class with proper dependency injection, initialization, and basic structure for managing the Character Concepts Manager page.

## Dependencies

- Ticket 01: HTML Structure and Page Layout (must be completed)
- Ticket 02: CSS Styling (should be completed)

## Implementation Details

### 1. Create Controller File

Create a new file `src/domUI/characterConceptsManagerController.js`:

```javascript
/**
 * @file Controller for managing character concepts CRUD operations and UI
 * @see characterBuilderService.js
 */

import { validateDependency } from '../utils/validationUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';
import { debounce } from '../utils/timeUtils.js';

/** @typedef {import('../characterBuilder/characterBuilderService.js').CharacterBuilderService} CharacterBuilderService */
/** @typedef {import('../events/eventBus.js').EventBus} EventBus */
/** @typedef {import('../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('./uiStateManager.js').UIStateManager} UIStateManager */

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
   * @param {Object} deps
   * @param {ILogger} deps.logger
   * @param {CharacterBuilderService} deps.characterBuilderService
   * @param {EventBus} deps.eventBus
   */
  constructor({ logger, characterBuilderService, eventBus }) {
    // Validate dependencies
    this.#logger = ensureValidLogger(logger);
    validateDependency(
      characterBuilderService,
      'CharacterBuilderService',
      null,
      {
        requiredMethods: [
          'getAllCharacterConcepts',
          'createCharacterConcept',
          'updateCharacterConcept',
          'deleteCharacterConcept',
          'getThematicDirectionsByConceptId',
        ],
      }
    );
    validateDependency(eventBus, 'EventBus', null, {
      requiredMethods: ['on', 'off', 'dispatch'],
    });

    this.#characterBuilderService = characterBuilderService;
    this.#eventBus = eventBus;

    this.#logger.info('CharacterConceptsManagerController initialized');
  }

  /**
   * Initialize the controller and set up the page
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
    const { UIStateManager } = await import('./uiStateManager.js');

    this.#uiStateManager = new UIStateManager({
      container: this.#elements.conceptsContainer,
      states: {
        empty: this.#elements.emptyState,
        loading: this.#elements.loadingState,
        error: this.#elements.errorState,
        results: this.#elements.resultsState,
      },
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

    // Search input with debouncing
    const debouncedSearch = debounce(
      (searchTerm) => this.#handleSearch(searchTerm),
      300
    );
    this.#elements.conceptSearch.addEventListener('input', (e) => {
      debouncedSearch(e.target.value);
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
    // Character counter
    this.#elements.conceptText.addEventListener('input', () => {
      this.#updateCharacterCount();
      this.#validateConceptForm();
    });

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
    // Import event constants
    import('../characterBuilder/characterBuilderEvents.js').then(
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
   * @param {string} message
   */
  #showError(message) {
    this.#elements.errorMessageText.textContent = message;
    this.#uiStateManager.setState('error');
  }

  /**
   * Update character count display
   */
  #updateCharacterCount() {
    const length = this.#elements.conceptText.value.length;
    const max = 1000;

    this.#elements.charCount.textContent = `${length}/${max}`;

    // Update styling based on count
    if (length > max) {
      this.#elements.charCount.classList.add('error');
      this.#elements.charCount.classList.remove('warning');
    } else if (length > max * 0.9) {
      this.#elements.charCount.classList.add('warning');
      this.#elements.charCount.classList.remove('error');
    } else {
      this.#elements.charCount.classList.remove('warning', 'error');
    }
  }

  /**
   * Validate the concept form
   * @returns {boolean}
   */
  #validateConceptForm() {
    const conceptText = this.#elements.conceptText.value.trim();
    const minLength = 10;
    const maxLength = 1000;

    let isValid = true;
    let errorMessage = '';

    if (conceptText.length < minLength) {
      isValid = false;
      errorMessage = `Concept must be at least ${minLength} characters`;
    } else if (conceptText.length > maxLength) {
      isValid = false;
      errorMessage = `Concept must not exceed ${maxLength} characters`;
    }

    // Update UI
    this.#elements.conceptError.textContent = errorMessage;
    this.#elements.saveConceptBtn.disabled = !isValid;

    return isValid;
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
```

### 2. Create UIStateManager Import

Ensure the UIStateManager is available by verifying it exists or creating a simple version:

```javascript
// In src/domUI/uiStateManager.js
export class UIStateManager {
  #container;
  #states;
  #currentState;

  constructor({ container, states }) {
    this.#container = container;
    this.#states = states;
  }

  setState(stateName) {
    // Hide all states
    Object.values(this.#states).forEach((element) => {
      if (element) element.style.display = 'none';
    });

    // Show requested state
    if (this.#states[stateName]) {
      this.#states[stateName].style.display = 'block';
      this.#currentState = stateName;
    }
  }

  getCurrentState() {
    return this.#currentState;
  }
}
```

### 3. Add Character Builder Events Constants

Create or update `src/characterBuilder/characterBuilderEvents.js`:

```javascript
/**
 * Event constants for Character Builder operations
 */
export const CHARACTER_BUILDER_EVENTS = {
  // Character concepts
  CONCEPT_CREATED: 'character-builder:concept-created',
  CONCEPT_UPDATED: 'character-builder:concept-updated',
  CONCEPT_DELETED: 'character-builder:concept-deleted',

  // Thematic directions
  DIRECTIONS_GENERATED: 'character-builder:directions-generated',
  DIRECTION_CREATED: 'character-builder:direction-created',
  DIRECTION_UPDATED: 'character-builder:direction-updated',
  DIRECTION_DELETED: 'character-builder:direction-deleted',
};
```

## Acceptance Criteria

1. ✅ Controller class created with proper structure
2. ✅ Dependency injection implemented correctly
3. ✅ All dependencies validated with proper error messages
4. ✅ DOM elements cached on initialization
5. ✅ UIStateManager integrated for state management
6. ✅ Event listeners set up for all interactive elements
7. ✅ Service event listeners configured
8. ✅ Form validation logic implemented
9. ✅ Character counter functionality working
10. ✅ Modal escape key handling implemented
11. ✅ Debounced search handler configured
12. ✅ Proper logging throughout the controller

## Testing Requirements

1. Test constructor with missing dependencies
2. Test initialization flow
3. Verify all DOM elements are cached correctly
4. Test form validation with various inputs
5. Test character counter updates
6. Verify event listener setup
7. Test navigation back to menu
8. Test error state display

## Notes

- Follow existing controller patterns from the codebase
- Use the project's validation utilities
- Implement proper error handling and logging
- Keep methods focused and single-purpose
- Use private fields and methods appropriately
- Ensure all async operations are properly handled
