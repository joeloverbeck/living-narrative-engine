/**
 * @file Controller for managing character concepts CRUD operations and UI
 * @see characterBuilderService.js
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { FormValidationHelper, ValidationPatterns } from '../shared/characterBuilder/formValidationHelper.js';
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
      payload: { modalType: 'create-concept' }
    });
  }

  /**
   * Close the concept modal and clean up
   */
  #closeConceptModal() {
    this.#logger.info('Closing concept modal');

    // Hide modal
    this.#elements.conceptModal.style.display = 'none';

    // Reset form
    this.#resetConceptForm();

    // Clear editing state
    this.#editingConceptId = null;

    // Restore previous focus
    if (this.#previousFocus && this.#previousFocus.focus) {
      this.#previousFocus.focus();
    }

    // Dispatch modal closed event
    this.#eventBus.dispatch({
      type: 'ui:modal-closed',
      payload: { modalType: 'concept' }
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
      const concepts = await this.#characterBuilderService.getAllCharacterConcepts();

      // Get direction counts for each concept
      const conceptsWithCounts = await Promise.all(
        concepts.map(async (concept) => {
          try {
            const directions = await this.#characterBuilderService
              .getThematicDirections(concept.id);

            return {
              concept,
              directionCount: directions.length
            };
          } catch (error) {
            this.#logger.error(`Failed to get directions for concept ${concept.id}`, error);
            // Return concept with 0 directions on error
            return {
              concept,
              directionCount: 0
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
            <p class="concept-text">${this.#escapeHtml(this.#truncateText(concept.text, 150))}</p>
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
    buttons.forEach(button => {
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
   * Filter concepts based on search term
   *
   * @param {Array<{concept: object, directionCount: number}>} concepts
   * @returns {Array<{concept: object, directionCount: number}>}
   */
  #filterConcepts(concepts) {
    if (!this.#searchFilter) {
      return concepts;
    }

    const searchLower = this.#searchFilter.toLowerCase();

    return concepts.filter(({ concept }) => {
      return concept.text.toLowerCase().includes(searchLower);
    });
  }

  /**
   * Update statistics display
   */
  #updateStatistics() {
    const totalConcepts = this.#conceptsData.length;
    const conceptsWithDirections = this.#conceptsData.filter(
      ({ directionCount }) => directionCount > 0
    ).length;
    const totalDirections = this.#conceptsData.reduce(
      (sum, { directionCount }) => sum + directionCount, 0
    );

    // Update UI
    this.#elements.totalConcepts.textContent = totalConcepts;
    this.#elements.conceptsWithDirections.textContent = conceptsWithDirections;
    this.#elements.totalDirections.textContent = totalDirections;

    // Log statistics
    this.#logger.info('Statistics updated', {
      totalConcepts,
      conceptsWithDirections,
      totalDirections
    });
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
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
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
    const scrollTop = maintainScroll ? this.#elements.conceptsResults.scrollTop : 0;

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
  #showEditModal(conceptId) {
    this.#logger.info('Showing edit modal', { conceptId });
    // Implementation in Ticket 06
  }

  /**
   * Show delete confirmation
   *
   * @param {object} concept
   * @param {number} directionCount
   */
  #showDeleteConfirmation(concept, directionCount) {
    this.#logger.info('Showing delete confirmation', { conceptId: concept.id, directionCount });
    // Implementation in Ticket 07
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

  #closeDeleteModal() {
    this.#logger.info('Closing delete modal');
    // Implementation in Ticket 07
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
      this.#elements.saveConceptBtn.textContent =
        this.#editingConceptId ? 'Update Concept' : 'Create Concept';
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
      const concept = await this.#characterBuilderService.createCharacterConcept(conceptText);

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

    try {
      // Disable form during save
      this.#setFormEnabled(false);
      this.#setSaveButtonLoading(true);

      if (this.#editingConceptId) {
        // Update existing concept (for future implementation)
        await this.#updateConcept(this.#editingConceptId, conceptText);
      } else {
        // Create new concept
        await this.#createConcept(conceptText);
      }

      // Close modal on success
      this.#closeConceptModal();

    } catch (error) {
      this.#logger.error('Failed to save concept', error);
      this.#showFormError('Failed to save concept. Please try again.');
    } finally {
      // Re-enable form
      this.#setFormEnabled(true);
      this.#setSaveButtonLoading(false);
    }
  }

  /**
   * Update an existing character concept (placeholder for future implementation)
   *
   * @param {string} conceptId - The concept ID
   * @param {string} conceptText - The updated concept text
   */
  async #updateConcept(conceptId, conceptText) {
    this.#logger.info('Update concept placeholder', { conceptId, length: conceptText.length });
    // Implementation in Ticket 06
    throw new Error('Update concept not yet implemented');
  }

  #handleSearch(searchTerm) {
    this.#logger.info('Handling search', { searchTerm });
    
    // Update search filter
    this.#searchFilter = searchTerm.trim();
    
    // Apply filter to existing data if available
    if (this.#conceptsData && this.#conceptsData.length >= 0) {
      const filteredConcepts = this.#filterConcepts(this.#conceptsData);
      this.#displayConcepts(filteredConcepts);
    }
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