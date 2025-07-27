/**
 * @file Controller for managing character concepts CRUD operations and UI
 * @see characterBuilderService.js
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import {
  FormValidationHelper,
  ValidationPatterns,
} from '../shared/characterBuilder/formValidationHelper.js';
import { UI_STATES } from '../shared/characterBuilder/uiStateManager.js';

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
  #previousFocus = null;

  // Enhanced search state
  #searchStateRestored = false;
  #searchAnalytics = {
    searches: [],
    noResultSearches: []
  };

  // Edit state tracking
  #originalConceptText = '';
  #hasUnsavedChanges = false;
  #lastEdit = null;

  // Delete state tracking
  #conceptToDelete = null;
  #deleteHandler = null;
  #deletedCard = null;

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

    // Expose internal state and methods for testing (only in non-production environments)
    if (process.env.NODE_ENV !== 'production') {
      const self = this;
      this._testExports = {
        // Properties (using getters/setters to maintain encapsulation)
        get conceptsData() {
          return self.#conceptsData;
        },
        set conceptsData(value) {
          self.#conceptsData = value;
        },

        get conceptToDelete() {
          return self.#conceptToDelete;
        },
        set conceptToDelete(value) {
          self.#conceptToDelete = value;
        },

        get deletedCard() {
          return self.#deletedCard;
        },
        set deletedCard(value) {
          self.#deletedCard = value;
        },

        get deleteHandler() {
          return self.#deleteHandler;
        },
        set deleteHandler(value) {
          self.#deleteHandler = value;
        },
        
        get searchFilter() {
          return self.#searchFilter;
        },
        set searchFilter(value) {
          self.#searchFilter = value;
        },
        
        get searchAnalytics() {
          return self.#searchAnalytics;
        },
        set searchAnalytics(value) {
          self.#searchAnalytics = value;
        },
        
        get searchStateRestored() {
          return self.#searchStateRestored;
        },
        set searchStateRestored(value) {
          self.#searchStateRestored = value;
        },
        
        get elements() {
          return self.#elements;
        },
        set elements(value) {
          self.#elements = value;
        },

        // Methods (bound to maintain correct 'this' context)
        showDeleteConfirmation: this.#showDeleteConfirmation.bind(this),
        setupDeleteHandler: this.#setupDeleteHandler.bind(this),
        deleteConcept: this.#deleteConcept.bind(this),
        closeDeleteModal: this.#closeDeleteModal.bind(this),
        setDeleteModalEnabled: this.#setDeleteModalEnabled.bind(this),
        showDeleteError: this.#showDeleteError.bind(this),
        applyOptimisticDelete: this.#applyOptimisticDelete.bind(this),
        revertOptimisticDelete: this.#revertOptimisticDelete.bind(this),
        handleConceptDeleted: this.#handleConceptDeleted.bind(this),
        updateStatistics: this.#updateStatistics.bind(this),
        
        // Enhanced search methods
        filterConcepts: this.#filterConcepts.bind(this),
        fuzzyMatch: this.#fuzzyMatch.bind(this),
        highlightSearchTerms: this.#highlightSearchTerms.bind(this),
        escapeRegex: this.#escapeRegex.bind(this),
        displayFilteredConcepts: this.#displayFilteredConcepts.bind(this),
        showNoSearchResults: this.#showNoSearchResults.bind(this),
        updateSearchState: this.#updateSearchState.bind(this),
        updateSearchStatus: this.#updateSearchStatus.bind(this),
        clearSearch: this.#clearSearch.bind(this),
        updateClearButton: this.#updateClearButton.bind(this),
        saveSearchState: this.#saveSearchState.bind(this),
        restoreSearchState: this.#restoreSearchState.bind(this),
        trackSearchAnalytics: this.#trackSearchAnalytics.bind(this),
        calculateAverageResults: this.#calculateAverageResults.bind(this),
        getDisplayText: this.#getDisplayText.bind(this),
        handleSearch: this.#handleSearch.bind(this),
        // Testing utility to set UIStateManager without full initialization
        set uiStateManager(value) {
          self.#uiStateManager = value;
        },
      };
    }

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

      // Set up keyboard shortcuts
      this.#setupKeyboardShortcuts();

      // Restore search state from session
      this.#restoreSearchState();

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
      statsDisplay: document.querySelector('.stats-display'),
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
    const { UIStateManager } = await import(
      '../shared/characterBuilder/uiStateManager.js'
    );

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

    // Search input keyboard enhancements
    this.#elements.conceptSearch.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Escape':
          // Clear search on Escape
          if (this.#searchFilter) {
            e.preventDefault();
            this.#clearSearch();
          }
          break;

        case 'Enter':
          // Focus first result on Enter
          if (this.#searchFilter) {
            e.preventDefault();
            const firstCard = this.#elements.conceptsResults.querySelector('.concept-card');
            if (firstCard) {
              firstCard.focus();
            }
          }
          break;
      }
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
        maxLength: 3000,
      }
    );

    // Form submission
    this.#elements.conceptForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.#handleConceptSave();
    });

    // Keyboard shortcut for form submission (Ctrl/Cmd + Enter)
    this.#elements.conceptText.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!this.#elements.saveConceptBtn.disabled) {
          this.#handleConceptSave();
        }
      }
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

  /**
   * Reset the concept form to initial state
   */
  #resetConceptForm() {
    // Clear form
    this.#elements.conceptForm.reset();

    // Reset character count (ValidationPatterns.concept uses 50-3000 chars)
    this.#elements.charCount.textContent = '0/3000';
    this.#elements.charCount.classList.remove('warning', 'error');

    // Clear any error messages using FormValidationHelper
    FormValidationHelper.clearFieldError(this.#elements.conceptText);

    // Disable save button initially
    this.#elements.saveConceptBtn.disabled = true;

    // Clear editing state
    this.#editingConceptId = null;
  }

  /**
   * Show the create concept modal
   */
  #showCreateModal() {
    this.#logger.info('Showing create concept modal');

    // Reset form for new concept
    this.#editingConceptId = null;
    this.#resetConceptForm();

    // Update modal title
    this.#elements.conceptModalTitle.textContent = 'Create Character Concept';
    this.#elements.saveConceptBtn.textContent = 'Create Concept';

    // Store previous focus
    this.#previousFocus = document.activeElement;

    // Show modal
    this.#elements.conceptModal.style.display = 'flex';

    // Focus on textarea
    setTimeout(() => {
      this.#elements.conceptText.focus();
    }, 100);

    // Track modal open for analytics
    this.#eventBus.dispatch({
      type: 'ui:modal-opened',
      payload: { modalType: 'create-concept' },
    });
  }

  /**
   * Close the concept modal and clean up
   */
  #closeConceptModal() {
    this.#logger.info('Closing concept modal');

    // Check for unsaved changes
    if (this.#hasUnsavedChanges && this.#editingConceptId) {
      const confirmClose = confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );

      if (!confirmClose) {
        return;
      }
    }

    // Hide modal
    this.#elements.conceptModal.style.display = 'none';

    // Reset form
    this.#resetConceptForm();

    // Clear editing state
    this.#editingConceptId = null;

    // Reset tracking
    this.#originalConceptText = '';
    this.#hasUnsavedChanges = false;

    // Restore previous focus
    if (this.#previousFocus && this.#previousFocus.focus) {
      this.#previousFocus.focus();
    }

    // Dispatch modal closed event
    this.#eventBus.dispatch({
      type: 'ui:modal-closed',
      payload: { modalType: 'concept' },
    });
  }

  /**
   * Load all character concepts with their direction counts
   */
  async #loadConceptsData() {
    this.#logger.info('Loading character concepts data');

    try {
      // Show loading state
      this.#uiStateManager.showState(UI_STATES.LOADING);

      // Get all concepts
      const concepts =
        await this.#characterBuilderService.getAllCharacterConcepts();

      // Get direction counts for each concept
      const conceptsWithCounts = await Promise.all(
        concepts.map(async (concept) => {
          try {
            const directions =
              await this.#characterBuilderService.getThematicDirections(
                concept.id
              );

            return {
              concept,
              directionCount: directions.length,
            };
          } catch (error) {
            this.#logger.error(
              `Failed to get directions for concept ${concept.id}`,
              error
            );
            // Return concept with 0 directions on error
            return {
              concept,
              directionCount: 0,
            };
          }
        })
      );

      // Store data
      this.#conceptsData = conceptsWithCounts;

      // Apply current filter if any
      const filteredConcepts = this.#filterConcepts(conceptsWithCounts);

      // Display concepts
      this.#displayConcepts(filteredConcepts);

      // Update statistics
      this.#updateStatistics();

      // Check if we need to restore search state
      if (this.#searchStateRestored) {
        const filteredConcepts = this.#filterConcepts(this.#conceptsData);
        this.#displayConcepts(filteredConcepts); // uses existing display method
        this.#updateSearchState(this.#elements.conceptSearch.value, filteredConcepts.length);
        this.#searchStateRestored = false;
      }

      this.#logger.info(`Loaded ${concepts.length} concepts`);
    } catch (error) {
      this.#logger.error('Failed to load concepts', error);
      this.#showError('Failed to load character concepts. Please try again.');
    }
  }

  /**
   * Display concepts in the UI
   *
   * @param {Array<{concept: object, directionCount: number}>} conceptsWithCounts
   */
  #displayConcepts(conceptsWithCounts) {
    // Clear existing content
    this.#elements.conceptsResults.innerHTML = '';

    if (conceptsWithCounts.length === 0) {
      // Show empty state
      this.#showEmptyState();
      return;
    }

    // Show results state
    this.#uiStateManager.showState(UI_STATES.RESULTS);

    // Create document fragment for performance
    const fragment = document.createDocumentFragment();

    // Create cards for each concept
    conceptsWithCounts.forEach(({ concept, directionCount }, index) => {
      const card = this.#createConceptCard(concept, directionCount, index);
      fragment.appendChild(card);
    });

    // Append all cards at once
    this.#elements.conceptsResults.appendChild(fragment);

    // Add entrance animation class
    requestAnimationFrame(() => {
      this.#elements.conceptsResults.classList.add('cards-loaded');
    });
  }

  /**
   * Create a concept card element
   *
   * @param {object} concept - The concept data
   * @param {number} directionCount - Number of thematic directions
   * @param {number} index - Card index for animation delay
   * @returns {HTMLElement}
   */
  #createConceptCard(concept, directionCount, index) {
    const card = document.createElement('div');
    card.className = 'concept-card';
    card.dataset.conceptId = concept.id;
    card.style.animationDelay = `${index * 0.05}s`;

    // Determine status
    const status = directionCount > 0 ? 'completed' : 'draft';

    // Create card HTML
    card.innerHTML = `
        <div class="concept-card-header">
            <span class="concept-status ${status}">
                ${status === 'completed' ? 'Has Directions' : 'No Directions'}
            </span>
            <button type="button" class="concept-menu-btn" aria-label="More options">
                ⋮
            </button>
        </div>
        <div class="concept-card-content">
            <p class="concept-text">${this.#getDisplayText(concept, 150)}</p>
            <div class="concept-meta">
                <span class="direction-count">
                    <strong>${directionCount}</strong> thematic ${directionCount === 1 ? 'direction' : 'directions'}
                </span>
                <span class="concept-date" title="${this.#formatFullDate(concept.createdAt)}">
                    Created ${this.#formatRelativeDate(concept.createdAt)}
                </span>
            </div>
        </div>
        <div class="concept-card-actions">
            <button type="button" class="edit-btn" aria-label="Edit concept" data-action="edit">
                ✏️ Edit
            </button>
            <button type="button" class="delete-btn" aria-label="Delete concept" data-action="delete">
                🗑️ Delete
            </button>
            <button type="button" class="view-directions-btn"
                    aria-label="View thematic directions" data-action="view-directions"
                    ${directionCount === 0 ? 'disabled' : ''}>
                📋 Directions
            </button>
        </div>
    `;

    // Add click handlers
    this.#attachCardEventHandlers(card, concept, directionCount);

    return card;
  }

  /**
   * Attach event handlers to a concept card
   *
   * @param {HTMLElement} card
   * @param {object} concept
   * @param {number} directionCount
   */
  #attachCardEventHandlers(card, concept, directionCount) {
    // Card click (excluding buttons)
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking on buttons
      if (e.target.closest('button')) return;

      // View concept details (could open edit modal in read-only mode)
      this.#viewConceptDetails(concept);
    });

    // Button click handlers
    const buttons = card.querySelectorAll('[data-action]');
    buttons.forEach((button) => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = button.dataset.action;

        switch (action) {
          case 'edit':
            this.#showEditModal(concept.id);
            break;
          case 'delete':
            this.#showDeleteConfirmation(concept, directionCount);
            break;
          case 'view-directions':
            this.#viewThematicDirections(concept.id);
            break;
        }
      });
    });

    // Menu button (for future expansion)
    const menuBtn = card.querySelector('.concept-menu-btn');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#showConceptMenu(concept, e.currentTarget);
    });
  }

  /**
   * Enhanced filter concepts with multi-term and fuzzy matching
   * Extends existing basic substring filtering
   *
   * @param {Array<{concept: object, directionCount: number}>} concepts
   * @returns {Array<{concept: object, directionCount: number}>}
   */
  #filterConcepts(concepts) {
    if (!this.#searchFilter || this.#searchFilter.length === 0) {
      return concepts;
    }

    const searchTerms = this.#searchFilter.toLowerCase().split(/\s+/).filter(term => term.length > 0);

    return concepts.filter(({ concept }) => {
      // Use correct property: concept.concept (not concept.text)
      const conceptText = concept.concept || concept.text;
      
      // Handle null/undefined conceptText gracefully
      if (!conceptText) {
        return false;
      }
      
      const conceptTextLower = conceptText.toLowerCase();

      // Check if all search terms are found (AND logic)
      return searchTerms.every(term => {
        // Direct substring match (existing logic)
        if (conceptTextLower.includes(term)) {
          return true;
        }

        // Enhanced fuzzy match for typos
        if (this.#fuzzyMatch(conceptTextLower, term)) {
          return true;
        }

        return false;
      });
    });
  }

  /**
   * Calculate all statistics
   *
   * @returns {object} Statistics object
   */
  #calculateStatistics() {
    const totalConcepts = this.#conceptsData.length;
    const conceptsWithDirections = this.#conceptsData.filter(
      ({ directionCount }) => directionCount > 0
    ).length;
    const totalDirections = this.#conceptsData.reduce(
      (sum, { directionCount }) => sum + directionCount,
      0
    );

    // Calculate additional statistics
    const averageDirectionsPerConcept = totalConcepts > 0
      ? (totalDirections / totalConcepts).toFixed(1)
      : '0';

    const completionRate = totalConcepts > 0
      ? Math.round((conceptsWithDirections / totalConcepts) * 100)
      : 0;

    const maxDirections = Math.max(
      0,
      ...this.#conceptsData.map(({ directionCount }) => directionCount)
    );

    return {
      totalConcepts,
      conceptsWithDirections,
      totalDirections,
      averageDirectionsPerConcept,
      completionRate,
      maxDirections,
      conceptsWithoutDirections: totalConcepts - conceptsWithDirections
    };
  }

  /**
   * Update statistics display with animations
   */
  #updateStatistics() {
    const stats = this.#calculateStatistics();

    // Animate number changes
    this.#animateStatValue(this.#elements.totalConcepts, stats.totalConcepts);
    this.#animateStatValue(this.#elements.conceptsWithDirections, stats.conceptsWithDirections);
    this.#animateStatValue(this.#elements.totalDirections, stats.totalDirections);

    // Update additional statistics
    this.#updateAdvancedStatistics(stats);

    // Log statistics
    this.#logger.info('Statistics updated', stats);

    // Dispatch statistics event for other components
    this.#eventBus.dispatch({
      type: 'statistics:updated',
      payload: stats
    });
  }

  /**
   * Animate stat value changes
   *
   * @param {HTMLElement} element - The element to update
   * @param {number} newValue - The target value
   */
  #animateStatValue(element, newValue) {
    if (!element) return;

    const currentValue = parseInt(element.textContent) || 0;

    if (currentValue === newValue) return;

    const duration = 500; // ms
    const steps = 20;
    const increment = (newValue - currentValue) / steps;
    const stepDuration = duration / steps;

    let step = 0;
    const animation = setInterval(() => {
      step++;

      if (step >= steps) {
        element.textContent = newValue;
        clearInterval(animation);

        // Add completion effect
        element.classList.add('stat-updated');
        setTimeout(() => {
          element.classList.remove('stat-updated');
        }, 300);
      } else {
        const value = Math.round(currentValue + (increment * step));
        element.textContent = value;
      }
    }, stepDuration);

    // Store animation reference for cleanup
    if (element.animationInterval) {
      clearInterval(element.animationInterval);
    }
    element.animationInterval = animation;
  }

  /**
   * Update advanced statistics display
   *
   * @param {object} stats - Statistics object
   */
  #updateAdvancedStatistics(stats) {
    // Check if advanced stats container exists
    let advancedStats = document.querySelector('.advanced-stats');

    if (!advancedStats) {
      // Create advanced stats section
      advancedStats = this.#createAdvancedStatsSection();
      this.#elements.statsDisplay = document.querySelector('.stats-display');
      this.#elements.statsDisplay.appendChild(advancedStats);
    }

    // Update values
    this.#updateAdvancedStatValue('avg-directions', stats.averageDirectionsPerConcept);
    this.#updateAdvancedStatValue('completion-rate', `${stats.completionRate}%`);
    this.#updateAdvancedStatValue('max-directions', stats.maxDirections);

    // Update progress bar
    this.#updateCompletionProgress(stats.completionRate);
  }

  /**
   * Create advanced statistics section
   *
   * @returns {HTMLElement}
   */
  #createAdvancedStatsSection() {
    const section = document.createElement('div');
    section.className = 'advanced-stats';
    section.innerHTML = `
        <h4>Insights</h4>
        <div class="stat-item">
            <span class="stat-label">Average Directions:</span>
            <span id="avg-directions" class="stat-value">0</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Completion Rate:</span>
            <span id="completion-rate" class="stat-value">0%</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Most Directions:</span>
            <span id="max-directions" class="stat-value">0</span>
        </div>
        <div class="completion-progress">
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
            <div class="progress-label">
                <span class="concepts-complete">0</span> of
                <span class="concepts-total">0</span> concepts have directions
            </div>
        </div>
        <button type="button" class="export-stats-btn" title="Export statistics as JSON">
            📊 Export Statistics
        </button>
    `;

    // Add export button handler
    const exportBtn = section.querySelector('.export-stats-btn');
    exportBtn.addEventListener('click', () => this.#exportStatistics('json'));

    return section;
  }

  /**
   * Update advanced stat value
   *
   * @param {string} id - Element ID
   * @param {string|number} value - New value
   */
  #updateAdvancedStatValue(id, value) {
    const element = document.getElementById(id);
    if (element && element.textContent !== String(value)) {
      element.textContent = value;
      element.classList.add('stat-updated');
      setTimeout(() => {
        element.classList.remove('stat-updated');
      }, 300);
    }
  }

  /**
   * Update completion progress bar
   *
   * @param {number} percentage - Completion percentage
   */
  #updateCompletionProgress(percentage) {
    const progressFill = document.querySelector('.progress-fill');
    const conceptsComplete = document.querySelector('.concepts-complete');
    const conceptsTotal = document.querySelector('.concepts-total');

    if (progressFill) {
      // Animate progress bar
      progressFill.style.width = `${percentage}%`;

      // Update color based on percentage
      progressFill.classList.remove('complete', 'good', 'moderate', 'low');
      if (percentage === 100) {
        progressFill.classList.add('complete');
      } else if (percentage >= 75) {
        progressFill.classList.add('good');
      } else if (percentage >= 50) {
        progressFill.classList.add('moderate');
      } else {
        progressFill.classList.add('low');
      }
    }

    // Update labels
    if (conceptsComplete && conceptsTotal) {
      const stats = this.#calculateStatistics();
      conceptsComplete.textContent = stats.conceptsWithDirections;
      conceptsTotal.textContent = stats.totalConcepts;
    }
  }

  /**
   * Celebrate creation milestones
   */
  #celebrateCreation() {
    const stats = this.#calculateStatistics();

    // Check for milestones
    if (stats.totalConcepts === 1) {
      this.#showMilestone('🎉 First Concept Created!');
    } else if (stats.totalConcepts % 10 === 0) {
      this.#showMilestone(`🎊 ${stats.totalConcepts} Concepts Created!`);
    } else if (stats.completionRate === 100 && stats.totalConcepts > 1) {
      this.#showMilestone('⭐ All Concepts Have Directions!');
    }
  }

  /**
   * Show milestone notification
   *
   * @param {string} message
   */
  #showMilestone(message) {
    const milestone = document.createElement('div');
    milestone.className = 'milestone-notification';
    milestone.textContent = message;

    document.body.appendChild(milestone);

    // Animate in
    setTimeout(() => {
      milestone.classList.add('show');
    }, 100);

    // Remove after delay
    setTimeout(() => {
      milestone.classList.remove('show');
      setTimeout(() => {
        milestone.remove();
      }, 500);
    }, 3000);
  }

  /**
   * Export statistics as JSON or CSV
   *
   * @param {string} format - 'json' or 'csv'
   */
  #exportStatistics(format = 'json') {
    const stats = this.#calculateStatistics();
    const timestamp = new Date().toISOString();

    const data = {
      exportDate: timestamp,
      statistics: stats,
      concepts: this.#conceptsData.map(({ concept, directionCount }) => ({
        id: concept.id,
        textLength: concept.concept.length,
        directionCount,
        createdAt: concept.createdAt,
        updatedAt: concept.updatedAt
      }))
    };

    let content, filename, mimeType;

    if (format === 'csv') {
      content = this.#convertToCSV(data);
      filename = `character-concepts-stats-${Date.now()}.csv`;
      mimeType = 'text/csv';
    } else {
      content = JSON.stringify(data, null, 2);
      filename = `character-concepts-stats-${Date.now()}.json`;
      mimeType = 'application/json';
    }

    // Create download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    this.#logger.info('Statistics exported', { format, filename });
  }

  /**
   * Convert statistics to CSV format
   *
   * @param {object} data
   * @returns {string}
   */
  #convertToCSV(data) {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Export Date', data.exportDate],
      ['Total Concepts', data.statistics.totalConcepts],
      ['Concepts with Directions', data.statistics.conceptsWithDirections],
      ['Total Directions', data.statistics.totalDirections],
      ['Average Directions per Concept', data.statistics.averageDirectionsPerConcept],
      ['Completion Rate', `${data.statistics.completionRate}%`],
      ['Maximum Directions', data.statistics.maxDirections]
    ];

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csv;
  }

  /**
   * Escape HTML to prevent XSS
   *
   * @param {string} text
   * @returns {string}
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Truncate text with ellipsis
   *
   * @param {string} text
   * @param {number} maxLength
   * @returns {string}
   */
  #truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;

    // Try to break at word boundary
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Format date as relative time
   *
   * @param {Date|string} date
   * @returns {string}
   */
  #formatRelativeDate(date) {
    const dateObj = new Date(date);
    const now = new Date();
    const diffMs = now - dateObj;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60)
      return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    // Fall back to date
    return dateObj.toLocaleDateString();
  }

  /**
   * Format full date for tooltip
   *
   * @param {Date|string} date
   * @returns {string}
   */
  #formatFullDate(date) {
    return new Date(date).toLocaleString();
  }

  /**
   * Refresh the concepts display
   *
   * @param {boolean} maintainScroll - Whether to maintain scroll position
   */
  async #refreshConceptsDisplay(maintainScroll = true) {
    // Save scroll position
    const scrollTop = maintainScroll
      ? this.#elements.conceptsResults.scrollTop
      : 0;

    // Reload data
    await this.#loadConceptsData();

    // Restore scroll position
    if (maintainScroll && scrollTop > 0) {
      this.#elements.conceptsResults.scrollTop = scrollTop;
    }
  }

  /**
   * Show appropriate empty state based on context
   */
  #showEmptyState() {
    const hasSearchFilter = this.#searchFilter && this.#searchFilter.length > 0;

    if (hasSearchFilter) {
      // No search results
      this.#elements.emptyState.innerHTML = `
            <p>No concepts match your search.</p>
            <p>Try adjusting your search terms.</p>
            <button type="button" class="cb-button-secondary" id="clear-search-btn">
                Clear Search
            </button>
        `;

      // Add clear search handler
      const clearBtn = document.getElementById('clear-search-btn');
      clearBtn?.addEventListener('click', () => {
        this.#elements.conceptSearch.value = '';
        this.#searchFilter = '';
        this.#displayConcepts(this.#conceptsData);
      });
    } else {
      // No concepts at all
      this.#elements.emptyState.innerHTML = `
            <p>No character concepts yet.</p>
            <p>Create your first concept to get started.</p>
            <button type="button" class="cb-button-primary" id="create-first-btn">
                ➕ Create First Concept
            </button>
        `;

      // Re-attach event listener
      const createBtn = document.getElementById('create-first-btn');
      createBtn?.addEventListener('click', () => this.#showCreateModal());
    }

    this.#uiStateManager.showState(UI_STATES.EMPTY);
  }

  /**
   * View concept details
   *
   * @param {object} concept
   */
  #viewConceptDetails(concept) {
    this.#logger.info('Viewing concept details', { id: concept.id });
    // Could show read-only modal or expand card
    // For now, just show edit modal in read-only mode
    this.#showEditModal(concept.id);
  }

  /**
   * Show edit modal for a concept
   *
   * @param {string} conceptId
   */
  async #showEditModal(conceptId) {
    this.#logger.info('Showing edit modal', { conceptId });

    try {
      // Find concept in cached data
      const conceptData = this.#conceptsData.find(
        ({ concept }) => concept.id === conceptId
      );

      if (!conceptData) {
        throw new Error(`Concept not found: ${conceptId}`);
      }

      const { concept } = conceptData;

      // Set editing state
      this.#editingConceptId = conceptId;

      // Update modal for editing
      this.#elements.conceptModalTitle.textContent = 'Edit Character Concept';
      this.#elements.saveConceptBtn.textContent = 'Update Concept';

      // Pre-populate form
      this.#elements.conceptText.value = concept.concept;

      // Store original text for comparison (add property if doesn't exist)
      this.#originalConceptText = concept.concept;
      this.#hasUnsavedChanges = false;

      // Add change tracking to textarea
      this.#elements.conceptText.addEventListener(
        'input',
        () => {
          this.#trackFormChanges();
        },
        { once: false }
      );

      // Validate form (should be valid since it's existing content)
      this.#validateConceptForm();

      // Show modal
      this.#elements.conceptModal.style.display = 'flex';

      // Focus and select text
      setTimeout(() => {
        this.#elements.conceptText.focus();
        this.#elements.conceptText.setSelectionRange(
          this.#elements.conceptText.value.length,
          this.#elements.conceptText.value.length
        );
      }, 100);

      // Track modal open
      this.#eventBus.dispatch({
        type: 'ui:modal-opened',
        payload: { modalType: 'edit-concept', conceptId },
      });
    } catch (error) {
      this.#logger.error('Failed to show edit modal', error);
      // Use existing UI state manager for error display
      this.#uiStateManager.showError(
        'Failed to load concept for editing. Please try again.'
      );
    }
  }

  /**
   * Show delete confirmation modal
   *
   * @param {object} concept - The concept to delete
   * @param {number} directionCount - Number of associated directions
   */
  #showDeleteConfirmation(concept, directionCount) {
    this.#logger.info('Showing delete confirmation', {
      conceptId: concept.id,
      directionCount,
    });

    // Store concept data for deletion
    this.#conceptToDelete = { concept, directionCount };

    // Build confirmation message
    let message = `Are you sure you want to delete this character concept?`;

    // Add concept preview
    const truncatedText = this.#truncateText(
      concept.text || concept.concept,
      100
    );
    message += `\n\n"${this.#escapeHtml(truncatedText)}"`;

    // Add warning about thematic directions
    if (directionCount > 0) {
      message += `\n\n⚠️ <strong>Warning:</strong> This will also delete `;
      message += `<strong>${directionCount}</strong> associated thematic `;
      message += `${directionCount === 1 ? 'direction' : 'directions'}.`;
      message += `\n\nThis action cannot be undone.`;
    }

    // Update modal content
    this.#elements.deleteModalMessage.innerHTML = message.replace(
      /\n/g,
      '<br>'
    );

    // Update delete button based on severity
    if (directionCount > 0) {
      this.#elements.confirmDeleteBtn.textContent = `Delete Concept & ${directionCount} Direction${directionCount === 1 ? '' : 's'}`;
      this.#elements.confirmDeleteBtn.classList.add('severe-action');
    } else {
      this.#elements.confirmDeleteBtn.textContent = 'Delete Concept';
      this.#elements.confirmDeleteBtn.classList.remove('severe-action');
    }

    // Show modal
    this.#elements.deleteModal.style.display = 'flex';

    // Focus on cancel button (safer default)
    setTimeout(() => {
      this.#elements.cancelDeleteBtn.focus();
    }, 100);

    // Set up delete handler
    this.#setupDeleteHandler();
  }

  /**
   * Set up delete confirmation handler
   */
  #setupDeleteHandler() {
    // Remove any existing handler
    if (this.#deleteHandler) {
      this.#elements.confirmDeleteBtn.removeEventListener(
        'click',
        this.#deleteHandler
      );
    }

    // Create new handler
    this.#deleteHandler = async () => {
      if (!this.#conceptToDelete) return;

      const { concept, directionCount } = this.#conceptToDelete;

      try {
        // Disable buttons during deletion
        this.#setDeleteModalEnabled(false);
        this.#elements.confirmDeleteBtn.textContent = 'Deleting...';

        // Perform deletion
        await this.#deleteConcept(concept.id, directionCount);

        // Close modal on success
        this.#closeDeleteModal();
      } catch (error) {
        this.#logger.error('Failed to delete concept', error);
        this.#showDeleteError('Failed to delete concept. Please try again.');
      } finally {
        // Re-enable buttons
        this.#setDeleteModalEnabled(true);
      }
    };

    // Attach handler
    this.#elements.confirmDeleteBtn.addEventListener(
      'click',
      this.#deleteHandler
    );
  }

  /**
   * Delete a character concept and its thematic directions
   *
   * @param {string} conceptId - The concept ID to delete
   * @param {number} directionCount - Number of directions (for logging)
   */
  async #deleteConcept(conceptId, directionCount) {
    this.#logger.info('Deleting concept', { conceptId, directionCount });

    try {
      // Apply optimistic UI update
      this.#applyOptimisticDelete(conceptId);

      // Delete via service (handles cascade deletion)
      await this.#characterBuilderService.deleteCharacterConcept(conceptId);

      this.#logger.info('Concept deleted successfully', {
        conceptId,
        directionsDeleted: directionCount,
      });

      // Show success notification (using logger since no notification system exists)
      const successMessage =
        directionCount > 0
          ? `Character concept deleted successfully (${directionCount} direction${directionCount === 1 ? '' : 's'} also deleted)`
          : 'Character concept deleted successfully';
      this.#logger.info(successMessage);

      // Remove from local cache
      this.#removeFromLocalCache(conceptId);

      // Update statistics
      this.#updateStatistics();

      // Check if we need to show empty state
      if (this.#conceptsData.length === 0) {
        this.#uiStateManager.setState('empty');
      }
    } catch (error) {
      // Revert optimistic delete on failure
      this.#revertOptimisticDelete();
      this.#logger.error('Failed to delete concept', error);
      throw error;
    }
  }

  /**
   * View thematic directions for a concept
   *
   * @param {string} conceptId
   */
  #viewThematicDirections(conceptId) {
    this.#logger.info('Viewing thematic directions', { conceptId });
    // Navigate to thematic directions manager with filter
    window.location.href = `thematic-directions-manager.html?conceptId=${conceptId}`;
  }

  /**
   * Show concept context menu
   *
   * @param {object} concept
   * @param {HTMLElement} button
   */
  #showConceptMenu(concept, button) {
    this.#logger.info('Showing concept menu', { conceptId: concept.id });
    // Future: show dropdown menu with additional options
  }

  /**
   * Close the delete confirmation modal
   */
  #closeDeleteModal() {
    this.#logger.info('Closing delete modal');

    // Hide modal
    this.#elements.deleteModal.style.display = 'none';

    // Clean up
    this.#conceptToDelete = null;

    // Remove handler
    if (this.#deleteHandler) {
      this.#elements.confirmDeleteBtn.removeEventListener(
        'click',
        this.#deleteHandler
      );
      this.#deleteHandler = null;
    }

    // Reset button text
    this.#elements.confirmDeleteBtn.textContent = 'Delete';
    this.#elements.confirmDeleteBtn.classList.remove('severe-action');

    // Dispatch modal closed event
    this.#eventBus.dispatch({
      type: 'ui:modal-closed',
      payload: { modalType: 'delete-confirmation' },
    });
  }

  /**
   * Enable or disable delete modal buttons
   *
   * @param {boolean} enabled
   */
  #setDeleteModalEnabled(enabled) {
    this.#elements.confirmDeleteBtn.disabled = !enabled;
    this.#elements.cancelDeleteBtn.disabled = !enabled;
    this.#elements.closeDeleteModal.disabled = !enabled;
  }

  /**
   * Show error in delete modal
   *
   * @param {string} message
   */
  #showDeleteError(message) {
    // Create or update error element
    let errorElement =
      this.#elements.deleteModal.querySelector('.delete-error');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.className = 'delete-error error-message';
      this.#elements.deleteModalMessage.parentElement.appendChild(errorElement);
    }

    errorElement.textContent = message;
    errorElement.style.display = 'block';

    // Hide after 5 seconds
    setTimeout(() => {
      if (errorElement) {
        errorElement.style.display = 'none';
      }
    }, 5000);
  }

  /**
   * Enable or disable form elements
   *
   * @param {boolean} enabled
   */
  #setFormEnabled(enabled) {
    this.#elements.conceptText.disabled = !enabled;
    this.#elements.saveConceptBtn.disabled = !enabled;
    this.#elements.cancelConceptBtn.disabled = !enabled;

    if (enabled) {
      // Re-validate if enabling
      this.#validateConceptForm();
    }
  }

  /**
   * Set save button loading state
   *
   * @param {boolean} isLoading
   */
  #setSaveButtonLoading(isLoading) {
    if (isLoading) {
      this.#elements.saveConceptBtn.disabled = true;
      this.#elements.saveConceptBtn.textContent = 'Saving...';
    } else {
      this.#elements.saveConceptBtn.textContent = this.#editingConceptId
        ? 'Update Concept'
        : 'Create Concept';
      // Re-validate to set correct disabled state
      this.#validateConceptForm();
    }
  }

  /**
   * Show error message using FormValidationHelper
   *
   * @param {string} message
   */
  #showFormError(message) {
    FormValidationHelper.showFieldError(this.#elements.conceptText, message);
  }

  /**
   * Show success via logging (no notification system in current architecture)
   *
   * @param {string} message
   */
  #showSuccessNotification(message) {
    // Log success - UI updates happen via event listeners
    this.#logger.info(message);
  }

  /**
   * Create a new character concept
   *
   * @param {string} conceptText - The concept text
   */
  async #createConcept(conceptText) {
    this.#logger.info('Creating new concept', { length: conceptText.length });

    try {
      const concept =
        await this.#characterBuilderService.createCharacterConcept(conceptText);

      this.#logger.info('Concept created successfully', { id: concept.id });

      // Show success message
      this.#showSuccessNotification('Character concept created successfully!');

      // The UI will be updated via service event (CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED)
    } catch (error) {
      this.#logger.error('Failed to create concept', error);
      throw error;
    }
  }

  /**
   * Handle concept form submission
   */
  async #handleConceptSave() {
    // Validate form
    if (!this.#validateConceptForm()) {
      this.#logger.warn('Form validation failed');
      return;
    }

    const conceptText = this.#elements.conceptText.value.trim();
    const isEditing = !!this.#editingConceptId;

    try {
      // Disable form during save
      this.#setFormEnabled(false);
      this.#setSaveButtonLoading(true);

      if (isEditing) {
        // Update existing concept
        await this.#updateConcept(this.#editingConceptId, conceptText);
      } else {
        // Create new concept
        await this.#createConcept(conceptText);
      }

      // Close modal on success
      this.#closeConceptModal();

      // Log success
      this.#logger.info(
        `Concept ${isEditing ? 'updated' : 'created'} successfully`
      );
    } catch (error) {
      this.#logger.error(
        `Failed to ${isEditing ? 'update' : 'create'} concept`,
        error
      );
      this.#uiStateManager.showError(
        `Failed to ${isEditing ? 'update' : 'save'} concept. Please try again.`
      );
    } finally {
      // Re-enable form
      this.#setFormEnabled(true);
      this.#setSaveButtonLoading(false);
    }
  }

  /**
   * Update an existing character concept
   *
   * @param {string} conceptId - The concept ID
   * @param {string} conceptText - The updated concept text
   */
  async #updateConcept(conceptId, conceptText) {
    this.#logger.info('Updating concept', {
      conceptId,
      length: conceptText.length,
    });

    try {
      // Check if text actually changed
      const currentConcept = this.#conceptsData.find(
        ({ concept }) => concept.id === conceptId
      )?.concept;

      if (currentConcept && currentConcept.concept === conceptText) {
        this.#logger.info('No changes detected, skipping update');
        return;
      }

      // Store last edit for undo functionality
      if (currentConcept) {
        this.#lastEdit = {
          conceptId,
          previousText: currentConcept.concept,
          newText: conceptText,
          timestamp: Date.now(),
        };
      }

      // Apply optimistic update
      this.#applyOptimisticUpdate(conceptId, conceptText);

      // Update via service (service expects updates object, not plain text)
      const updatedConcept =
        await this.#characterBuilderService.updateCharacterConcept(conceptId, {
          concept: conceptText,
        });

      this.#logger.info('Concept updated successfully', {
        id: updatedConcept.id,
      });

      // Show success notification (using existing UI patterns)
      this.#uiStateManager.showState(UI_STATES.RESULTS);

      // Update local cache immediately for better UX
      this.#updateLocalConceptCache(updatedConcept);

      // Remove updating class on success
      const card = this.#elements.conceptsResults.querySelector(
        `[data-concept-id="${conceptId}"]`
      );
      if (card) {
        card.classList.remove('concept-updating');
        card.classList.add('concept-updated');
        setTimeout(() => {
          card.classList.remove('concept-updated');
        }, 1000);
      }
    } catch (error) {
      this.#logger.error('Failed to update concept', error);
      // Revert optimistic update on failure
      this.#revertOptimisticUpdate(conceptId);
      throw error;
    }
  }

  /**
   * Update local concept cache immediately
   *
   * @param {object} updatedConcept
   */
  #updateLocalConceptCache(updatedConcept) {
    // Find and update in local data
    const index = this.#conceptsData.findIndex(
      ({ concept }) => concept.id === updatedConcept.id
    );

    if (index !== -1) {
      // Preserve direction count
      const directionCount = this.#conceptsData[index].directionCount;

      // Update concept
      this.#conceptsData[index] = {
        concept: updatedConcept,
        directionCount,
      };

      // Update UI immediately
      this.#updateConceptCard(updatedConcept, directionCount);
    }
  }

  /**
   * Update a single concept card in the UI
   *
   * @param {object} concept
   * @param {number} directionCount
   */
  #updateConceptCard(concept, directionCount) {
    // Find the card element
    const card = this.#elements.conceptsResults.querySelector(
      `[data-concept-id="${concept.id}"]`
    );

    if (!card) return;

    // Update card content
    const conceptTextElement = card.querySelector('.concept-text');
    if (conceptTextElement) {
      conceptTextElement.innerHTML = this.#getDisplayText(concept, 150);
    }

    // Update date if it changed
    const dateElement = card.querySelector('.concept-date');
    if (dateElement && concept.updatedAt) {
      dateElement.textContent = `Updated ${this.#formatRelativeDate(concept.updatedAt)}`;
      dateElement.title = this.#formatFullDate(concept.updatedAt);
    }

    // Add update animation
    card.classList.add('concept-updated');
    setTimeout(() => {
      card.classList.remove('concept-updated');
    }, 1000);
  }

  /**
   * Apply optimistic update to UI before server response
   *
   * @param {string} conceptId
   * @param {string} newText
   */
  #applyOptimisticUpdate(conceptId, newText) {
    // Update card immediately
    const card = this.#elements.conceptsResults.querySelector(
      `[data-concept-id="${conceptId}"]`
    );

    if (card) {
      const textElement = card.querySelector('.concept-text');
      if (textElement) {
        textElement.textContent = this.#truncateText(newText, 150);
        card.classList.add('concept-updating');
      }
    }
  }

  /**
   * Revert optimistic update on failure
   *
   * @param {string} conceptId
   */
  #revertOptimisticUpdate(conceptId) {
    // Find original concept
    const originalData = this.#conceptsData.find(
      ({ concept }) => concept.id === conceptId
    );

    if (originalData) {
      this.#updateConceptCard(
        originalData.concept,
        originalData.directionCount
      );
    }

    // Remove updating class
    const card = this.#elements.conceptsResults.querySelector(
      `[data-concept-id="${conceptId}"]`
    );
    if (card) {
      card.classList.remove('concept-updating');
      card.classList.add('concept-update-failed');
      setTimeout(() => {
        card.classList.remove('concept-update-failed');
      }, 2000);
    }
  }

  /**
   * Track changes to form
   */
  #trackFormChanges() {
    const currentText = this.#elements.conceptText.value.trim();
    this.#hasUnsavedChanges = currentText !== this.#originalConceptText;

    // Update save button state
    if (this.#hasUnsavedChanges) {
      this.#elements.saveConceptBtn.classList.add('has-changes');
    } else {
      this.#elements.saveConceptBtn.classList.remove('has-changes');
    }
  }

  /**
   * Add keyboard shortcuts for edit functionality
   * This method should be called during initialization
   */
  #setupKeyboardShortcuts() {
    // Add global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + F to focus search
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === 'f' &&
        !e.target.closest('input, textarea')
      ) {
        e.preventDefault();
        this.#elements.conceptSearch.focus();
        this.#elements.conceptSearch.select();
        return;
      }

      // Undo with Ctrl+Z (when not in form)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === 'z' &&
        !e.target.closest('input, textarea')
      ) {
        e.preventDefault();
        this.#undoLastEdit();
        return;
      }

      // Handle shortcuts for focused concept cards
      const focusedCard = document.activeElement.closest('[data-concept-id]');
      if (!focusedCard) return;

      const conceptId = focusedCard.dataset.conceptId;

      switch (e.key) {
        case 'Enter':
        case ' ':
          if (!e.target.closest('button')) {
            e.preventDefault();
            // Find concept and view details
            const conceptData = this.#conceptsData.find(
              ({ concept }) => concept.id === conceptId
            );
            if (conceptData) {
              this.#viewConceptDetails(conceptData.concept);
            }
          }
          break;
        case 'e':
        case 'E':
          if (!e.target.closest('input, textarea')) {
            e.preventDefault();
            this.#showEditModal(conceptId);
          }
          break;
        case 'Delete':
          if (!e.target.closest('input, textarea')) {
            e.preventDefault();
            // Find concept and show delete confirmation
            const conceptData = this.#conceptsData.find(
              ({ concept }) => concept.id === conceptId
            );
            if (conceptData) {
              this.#showDeleteConfirmation(
                conceptData.concept,
                conceptData.directionCount
              );
            }
          }
          break;
      }
    });
  }

  /**
   * Undo last edit if available
   */
  async #undoLastEdit() {
    if (!this.#lastEdit || Date.now() - this.#lastEdit.timestamp > 30000) {
      // No recent edit to undo (30 second window)
      this.#logger.info('No recent edit to undo');
      return;
    }

    try {
      await this.#updateConcept(
        this.#lastEdit.conceptId,
        this.#lastEdit.previousText
      );

      this.#uiStateManager.showState(UI_STATES.RESULTS);
      this.#lastEdit = null;
    } catch (error) {
      this.#logger.error('Failed to undo edit', error);
      this.#uiStateManager.showError('Failed to undo edit');
    }
  }

  /**
   * Apply optimistic delete to UI
   *
   * @param {string} conceptId
   */
  #applyOptimisticDelete(conceptId) {
    const card = this.#elements.conceptsResults.querySelector(
      `[data-concept-id="${conceptId}"]`
    );

    if (card) {
      // Store for potential revert
      this.#deletedCard = {
        element: card,
        nextSibling: card.nextSibling,
        parent: card.parentElement,
      };

      // Add deletion animation
      card.classList.add('concept-deleting');

      // Remove after animation
      setTimeout(() => {
        if (card.parentElement) {
          card.remove();
        }
      }, 300);
    }
  }

  /**
   * Revert optimistic delete on failure
   */
  #revertOptimisticDelete() {
    if (this.#deletedCard) {
      const { element, nextSibling, parent } = this.#deletedCard;

      // Remove deleting class
      element.classList.remove('concept-deleting');
      element.classList.add('concept-delete-failed');

      // Re-insert if removed
      if (!element.parentElement && parent) {
        if (nextSibling && nextSibling.parentElement === parent) {
          parent.insertBefore(element, nextSibling);
        } else {
          parent.appendChild(element);
        }
      }

      // Clean up after animation
      setTimeout(() => {
        element.classList.remove('concept-delete-failed');
      }, 2000);

      this.#deletedCard = null;
    }
  }

  /**
   * Remove concept from local cache
   *
   * @param {string} conceptId
   */
  #removeFromLocalCache(conceptId) {
    const index = this.#conceptsData.findIndex(
      ({ concept }) => concept.id === conceptId
    );

    if (index !== -1) {
      this.#conceptsData.splice(index, 1);
      this.#logger.info('Removed concept from local cache', { conceptId });
    }
  }

  /**
   * Enhanced search handling with analytics and state management
   * Extends existing basic implementation
   *
   * @param {string} searchTerm
   */
  #handleSearch(searchTerm) {
    this.#logger.info('Enhanced search handling', { searchTerm, length: searchTerm.length });

    // Update search filter (existing logic)
    this.#searchFilter = searchTerm.trim();

    // Filter concepts with enhanced logic
    const filteredConcepts = this.#filterConcepts(this.#conceptsData);

    // Update display with highlighting
    this.#displayFilteredConcepts(filteredConcepts);

    // Update search state UI with enhanced feedback
    this.#updateSearchState(searchTerm, filteredConcepts.length);

    // Save search state for session persistence
    this.#saveSearchState();

    // Enhanced analytics tracking
    this.#trackSearchAnalytics(searchTerm, filteredConcepts.length);

    // Dispatch enhanced search event
    if (searchTerm.length > 0) {
      this.#eventBus.dispatch({
        type: 'ui:search-performed',
        payload: {
          searchTerm,
          resultCount: filteredConcepts.length,
          totalConcepts: this.#conceptsData.length,
          searchMode: 'enhanced'
        }
      });
    }
  }

  #handleConceptCreated(event) {
    this.#logger.info('Concept created event received', event.detail);

    // Refresh data and statistics
    this.#loadConceptsData().then(() => {
      // Add creation celebration
      this.#celebrateCreation();
    });
  }

  #handleConceptUpdated(event) {
    this.#logger.info('Concept updated event received', event.detail);
    // Implementation in Ticket 10
  }

  /**
   * Handle concept deleted event
   *
   * @param {CustomEvent} event
   */
  #handleConceptDeleted(event) {
    this.#logger.info('Concept deleted event received', event.detail);

    const { conceptId } = event.detail;

    // Remove from local cache if not already removed
    this.#removeFromLocalCache(conceptId);

    // Remove card from UI if still present
    const card = this.#elements.conceptsResults.querySelector(
      `[data-concept-id="${conceptId}"]`
    );
    if (card) {
      card.remove();
    }

    // Update statistics
    this.#updateStatistics();

    // Check if empty
    if (this.#conceptsData.length === 0) {
      this.#uiStateManager.setState('empty');
    }
  }

  #handleDirectionsGenerated(event) {
    this.#logger.info('Directions generated event received', event.detail);
    // Implementation in Ticket 10
  }

  /**
   * Simple fuzzy matching for typo tolerance
   *
   * @param {string} text
   * @param {string} searchTerm
   * @returns {boolean}
   */
  #fuzzyMatch(text, searchTerm) {
    // Only apply fuzzy matching for terms longer than 3 characters
    if (searchTerm.length <= 3) {
      return false;
    }

    // Check if text contains all characters of search term in order
    let searchIndex = 0;
    for (let i = 0; i < text.length && searchIndex < searchTerm.length; i++) {
      if (text[i] === searchTerm[searchIndex]) {
        searchIndex++;
      }
    }

    return searchIndex === searchTerm.length;
  }

  /**
   * Enhanced display for filtered concepts
   * Leverages existing #displayConcepts and #showEmptyState methods
   *
   * @param {Array<{concept: object, directionCount: number}>} filteredConcepts
   */
  #displayFilteredConcepts(filteredConcepts) {
    if (filteredConcepts.length === 0 && this.#searchFilter) {
      // Use enhanced no search results state
      this.#showNoSearchResults();
    } else {
      // Use existing display logic with highlighting enhancements
      this.#displayConcepts(filteredConcepts);
    }
  }

  /**
   * Enhanced no search results state
   * Builds upon existing #showEmptyState architecture
   */
  #showNoSearchResults() {
    // Use existing empty state infrastructure but with search-specific content
    const hasSearchFilter = this.#searchFilter && this.#searchFilter.length > 0;
    
    if (hasSearchFilter) {
      // Enhanced no search results (leverages existing empty state pattern)
      this.#elements.conceptsResults.innerHTML = '';
      
      // Create enhanced search empty state
      const noResultsDiv = document.createElement('div');
      noResultsDiv.className = 'no-search-results cb-empty-state';
      noResultsDiv.innerHTML = `
        <div class="no-results-icon">🔍</div>
        <p class="no-results-title">No concepts match your search</p>
        <p class="no-results-message">
          No concepts found for "<strong>${this.#escapeHtml(this.#searchFilter)}</strong>"
        </p>
        <div class="search-suggestions">
          <p>Try:</p>
          <ul>
            <li>Using different keywords</li>
            <li>Checking for typos</li>
            <li>Using more general terms</li>
          </ul>
        </div>
        <button type="button" class="cb-button-secondary" id="clear-search-btn">
          Clear Search
        </button>
      `;

      // Add clear button handler
      const clearBtn = noResultsDiv.querySelector('#clear-search-btn');
      clearBtn.addEventListener('click', () => {
        this.#clearSearch();
      });

      // Use existing UI state management
      this.#uiStateManager.showState('results');
      this.#elements.conceptsResults.appendChild(noResultsDiv);
    } else {
      // Fall back to existing empty state logic
      this.#showEmptyState();
    }
  }

  /**
   * Update search-related UI elements
   *
   * @param {string} searchTerm
   * @param {number} resultCount
   */
  #updateSearchState(searchTerm, resultCount) {
    const hasSearch = searchTerm.length > 0;

    // Add search active class to container
    if (hasSearch) {
      this.#elements.conceptsContainer.classList.add('search-active');
    } else {
      this.#elements.conceptsContainer.classList.remove('search-active');
    }

    // Update or create search status element
    this.#updateSearchStatus(searchTerm, resultCount);

    // Update clear button visibility
    this.#updateClearButton(hasSearch);
  }

  /**
   * Update search status display
   *
   * @param {string} searchTerm
   * @param {number} resultCount
   */
  #updateSearchStatus(searchTerm, resultCount) {
    if (!searchTerm) {
      // Remove status if no search
      const existingStatus = document.querySelector('.search-status');
      if (existingStatus) {
        existingStatus.remove();
      }
      return;
    }

    // Find or create status element
    let statusElement = document.querySelector('.search-status');
    if (!statusElement) {
      statusElement = document.createElement('div');
      statusElement.className = 'search-status';
      // Insert after panel title
      const panelTitle = this.#elements.conceptsResults.parentElement.querySelector('.cb-panel-title');
      if (panelTitle) {
        panelTitle.insertAdjacentElement('afterend', statusElement);
      }
    }

    // Update status content
    const totalCount = this.#conceptsData.length;
    statusElement.innerHTML = `
      <span class="search-status-text">
        Showing <strong>${resultCount}</strong> of <strong>${totalCount}</strong> concepts
        matching "<strong>${this.#escapeHtml(searchTerm)}</strong>"
      </span>
      <button type="button" class="clear-search-inline" aria-label="Clear search">
        ✕
      </button>
    `;

    // Add clear handler
    const clearBtn = statusElement.querySelector('.clear-search-inline');
    clearBtn.addEventListener('click', () => this.#clearSearch());
  }

  /**
   * Enhanced clear search with state management
   * Builds on existing search architecture
   */
  #clearSearch() {
    this.#logger.info('Clearing enhanced search');

    // Clear input (existing logic)
    this.#elements.conceptSearch.value = '';
    this.#searchFilter = '';

    // Display all concepts using existing method
    this.#displayConcepts(this.#conceptsData);

    // Enhanced UI state updates
    this.#updateSearchState('', this.#conceptsData.length);

    // Clear search persistence
    this.#saveSearchState();

    // Focus back to search input (accessibility)
    this.#elements.conceptSearch.focus();

    // Dispatch clear event
    this.#eventBus.dispatch({
      type: 'ui:search-cleared',
      payload: { totalConcepts: this.#conceptsData.length }
    });
  }

  /**
   * Update clear button visibility
   *
   * @param {boolean} visible
   */
  #updateClearButton(visible) {
    // Find or create clear button
    let clearButton = this.#elements.conceptSearch.parentElement.querySelector('.search-clear-btn');

    if (visible && !clearButton) {
      // Create clear button
      clearButton = document.createElement('button');
      clearButton.type = 'button';
      clearButton.className = 'search-clear-btn';
      clearButton.innerHTML = '✕';
      clearButton.setAttribute('aria-label', 'Clear search');

      // Insert after search input
      this.#elements.conceptSearch.parentElement.style.position = 'relative';
      this.#elements.conceptSearch.parentElement.appendChild(clearButton);

      // Add handler
      clearButton.addEventListener('click', () => this.#clearSearch());
    } else if (!visible && clearButton) {
      // Remove clear button
      clearButton.remove();
    }
  }

  /**
   * Highlight search terms in text
   *
   * @param {string} text
   * @param {string} searchTerm
   * @returns {string} HTML with highlighted terms
   */
  #highlightSearchTerms(text, searchTerm) {
    if (!searchTerm || searchTerm.length === 0) {
      return this.#escapeHtml(text);
    }

    const searchTerms = searchTerm.split(/\s+/).filter(term => term.length > 0);
    let highlightedText = this.#escapeHtml(text);

    // Highlight each search term
    searchTerms.forEach(term => {
      const regex = new RegExp(`(${this.#escapeRegex(term)})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });

    return highlightedText;
  }

  /**
   * Escape special regex characters
   *
   * @param {string} string
   * @returns {string}
   */
  #escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Save search state to session storage
   */
  #saveSearchState() {
    if (this.#searchFilter) {
      sessionStorage.setItem('conceptsManagerSearch', this.#searchFilter);
    } else {
      sessionStorage.removeItem('conceptsManagerSearch');
    }
  }

  /**
   * Restore search state from session storage
   */
  #restoreSearchState() {
    const savedSearch = sessionStorage.getItem('conceptsManagerSearch');
    if (savedSearch && this.#elements.conceptSearch) {
      this.#elements.conceptSearch.value = savedSearch;
      this.#searchFilter = savedSearch;

      // Apply search after concepts load
      this.#searchStateRestored = true;
    }
  }

  /**
   * Track search analytics
   *
   * @param {string} searchTerm
   * @param {number} resultCount
   */
  #trackSearchAnalytics(searchTerm, resultCount) {
    if (!searchTerm) return;

    const searchData = {
      term: searchTerm,
      resultCount,
      timestamp: Date.now()
    };

    this.#searchAnalytics.searches.push(searchData);

    if (resultCount === 0) {
      this.#searchAnalytics.noResultSearches.push(searchData);
    }

    // Keep only last 100 searches
    if (this.#searchAnalytics.searches.length > 100) {
      this.#searchAnalytics.searches.shift();
    }

    // Log analytics periodically
    if (this.#searchAnalytics.searches.length % 10 === 0) {
      this.#logger.info('Search analytics', {
        totalSearches: this.#searchAnalytics.searches.length,
        noResultSearches: this.#searchAnalytics.noResultSearches.length,
        averageResults: this.#calculateAverageResults()
      });
    }
  }

  /**
   * Calculate average search results
   *
   * @returns {number}
   */
  #calculateAverageResults() {
    const searches = this.#searchAnalytics.searches;
    if (searches.length === 0) return 0;

    const sum = searches.reduce((acc, search) => acc + search.resultCount, 0);
    return Math.round(sum / searches.length);
  }

  /**
   * Get display text with search highlighting
   *
   * @param {object} concept
   * @param {number} maxLength
   * @returns {string}
   */
  #getDisplayText(concept, maxLength) {
    const conceptText = concept.concept || concept.text;
    const truncatedText = this.#truncateText(conceptText, maxLength);
    
    return this.#searchFilter
      ? this.#highlightSearchTerms(truncatedText, this.#searchFilter)
      : this.#escapeHtml(truncatedText);
  }
}

export default CharacterConceptsManagerController;
