/**
 * @file Main UI controller for character builder step 1
 * @see ../services/characterBuilderService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../services/characterBuilderService.js').CharacterBuilderService} CharacterBuilderService
 * @typedef {import('../models/characterConcept.js').CharacterConcept} CharacterConcept
 * @typedef {import('../models/thematicDirection.js').ThematicDirection} ThematicDirection
 */

/**
 * UI states for the character builder
 */
const UI_STATES = {
  EMPTY: 'empty',
  LOADING: 'loading',
  RESULTS: 'results',
  ERROR: 'error',
};

/**
 * Main UI controller for character builder interface
 */
export class CharacterBuilderController {
  #logger;
  #characterBuilderService;
  #eventBus;
  #currentConcept = null;
  #currentDirections = [];
  #confirmResolver = null;

  // DOM element references
  #elements = {};

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {CharacterBuilderService} dependencies.characterBuilderService - Character builder service
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event dispatcher
   */
  constructor({ logger, characterBuilderService, eventBus }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(
      characterBuilderService,
      'CharacterBuilderService',
      logger,
      {
        requiredMethods: [
          'initialize',
          'createCharacterConcept',
          'generateThematicDirections',
          'getAllCharacterConcepts',
          'getCharacterConcept',
          'deleteCharacterConcept',
        ],
      }
    );
    validateDependency(eventBus, 'ISafeEventDispatcher', logger, {
      requiredMethods: ['dispatch'],
    });

    this.#logger = logger;
    this.#characterBuilderService = characterBuilderService;
    this.#eventBus = eventBus;
  }

  /**
   * Initialize the character builder UI
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Initialize the service
      await this.#characterBuilderService.initialize();

      // Cache DOM elements
      this.#cacheElements();

      // Set up event listeners
      this.#setupEventListeners();

      // Initialize UI state
      this.#initializeUI();

      // Load saved concepts
      await this.#loadSavedConcepts();

      this.#logger.info('CharacterBuilderController: Successfully initialized');
    } catch (error) {
      this.#logger.error(
        'CharacterBuilderController: Failed to initialize',
        error
      );
      this.#showError(
        'Failed to initialize character builder. Please refresh the page.'
      );
    }
  }

  /**
   * Cache DOM element references
   *
   * @private
   */
  #cacheElements() {
    // Form elements
    this.#elements.form = document.getElementById('character-concept-form');
    this.#elements.textarea = document.getElementById(
      'character-concept-input'
    );
    this.#elements.charCount = document.querySelector('.char-count');
    this.#elements.errorMessage = document.getElementById('concept-error');

    // Buttons
    this.#elements.generateBtn = document.getElementById(
      'generate-directions-btn'
    );
    this.#elements.saveBtn = document.getElementById('save-concept-btn');
    this.#elements.retryBtn = document.getElementById('retry-btn');
    this.#elements.regenerateBtn = document.getElementById('regenerate-btn');
    this.#elements.exportBtn = document.getElementById('export-directions-btn');
    this.#elements.continueBtn = document.getElementById('continue-step2-btn');
    this.#elements.backBtn = document.getElementById('back-to-menu-btn');

    // State containers
    this.#elements.emptyState = document.getElementById('empty-state');
    this.#elements.loadingState = document.getElementById('loading-state');
    this.#elements.errorState = document.getElementById('error-state');
    this.#elements.resultsState = document.getElementById('directions-results');
    this.#elements.directionsList = document.getElementById('directions-list');

    // Sidebar
    this.#elements.sidebar = document.getElementById('saved-concepts-sidebar');
    this.#elements.toggleSidebarBtn =
      document.getElementById('toggle-sidebar-btn');
    this.#elements.conceptsList = document.getElementById(
      'saved-concepts-list'
    );
    this.#elements.refreshBtn = document.getElementById('refresh-concepts-btn');
    this.#elements.clearAllBtn = document.getElementById(
      'clear-all-concepts-btn'
    );

    // Modals
    this.#elements.helpLink = document.getElementById('help-link');
    this.#elements.helpModal = document.getElementById('help-modal');
    this.#elements.confirmModal = document.getElementById('confirm-modal');

    // Accessibility
    this.#elements.liveRegion = document.getElementById('live-region');

    this.#logger.debug('CharacterBuilderController: Cached DOM elements');
  }

  /**
   * Set up event listeners
   *
   * @private
   */
  #setupEventListeners() {
    // Form events
    this.#elements.form.addEventListener(
      'submit',
      this.#handleFormSubmit.bind(this)
    );
    this.#elements.textarea.addEventListener(
      'input',
      this.#handleTextareaInput.bind(this)
    );
    this.#elements.textarea.addEventListener(
      'blur',
      this.#handleTextareaBlur.bind(this)
    );

    // Button events
    this.#elements.saveBtn.addEventListener(
      'click',
      this.#handleSaveClick.bind(this)
    );
    this.#elements.retryBtn.addEventListener(
      'click',
      this.#handleRetryClick.bind(this)
    );
    this.#elements.regenerateBtn.addEventListener(
      'click',
      this.#handleRegenerateClick.bind(this)
    );
    this.#elements.exportBtn.addEventListener(
      'click',
      this.#handleExportClick.bind(this)
    );
    this.#elements.continueBtn.addEventListener(
      'click',
      this.#handleContinueClick.bind(this)
    );
    this.#elements.backBtn.addEventListener(
      'click',
      this.#handleBackClick.bind(this)
    );

    // Sidebar events
    this.#elements.toggleSidebarBtn.addEventListener(
      'click',
      this.#handleToggleSidebar.bind(this)
    );
    this.#elements.refreshBtn.addEventListener(
      'click',
      this.#handleRefreshConcepts.bind(this)
    );
    this.#elements.clearAllBtn.addEventListener(
      'click',
      this.#handleClearAllConcepts.bind(this)
    );

    // Modal events
    this.#elements.helpLink.addEventListener(
      'click',
      this.#handleHelpClick.bind(this)
    );
    this.#setupModalEvents();

    // Error details
    const errorDetailsBtn = document.getElementById('error-details-btn');
    if (errorDetailsBtn) {
      errorDetailsBtn.addEventListener(
        'click',
        this.#handleErrorDetailsClick.bind(this)
      );
    }

    this.#logger.debug('CharacterBuilderController: Set up event listeners');
  }

  /**
   * Initialize UI state
   *
   * @private
   */
  #initializeUI() {
    this.#showState(UI_STATES.EMPTY);
    this.#updateCharacterCount();
    this.#updateButtonStates();
  }

  /**
   * Handle form submission
   *
   * @private
   * @param {Event} event - Form submit event
   */
  async #handleFormSubmit(event) {
    event.preventDefault();

    const concept = this.#elements.textarea.value.trim();
    if (!this.#validateInput(concept)) {
      return;
    }

    try {
      this.#showState(UI_STATES.LOADING);
      this.#announceToScreenReader('Generating thematic directions...');

      // Create and generate directions
      const characterConcept =
        await this.#characterBuilderService.createCharacterConcept(concept);
      this.#currentConcept = characterConcept;

      const directions =
        await this.#characterBuilderService.generateThematicDirections(
          characterConcept.id
        );
      this.#currentDirections = directions;

      // Display results
      this.#displayResults(directions);
      this.#updateButtonStates();
      this.#announceToScreenReader(
        `Generated ${directions.length} thematic directions for your character.`
      );

      // Refresh sidebar
      await this.#loadSavedConcepts();
    } catch (error) {
      this.#logger.error(
        'CharacterBuilderController: Failed to generate directions',
        error
      );
      this.#showError(
        error.message || 'Failed to generate thematic directions'
      );
    }
  }

  /**
   * Handle textarea input changes
   *
   * @private
   */
  #handleTextareaInput() {
    this.#updateCharacterCount();
    this.#updateButtonStates();
    this.#clearValidationError();
  }

  /**
   * Handle textarea blur for validation
   *
   * @private
   */
  #handleTextareaBlur() {
    const concept = this.#elements.textarea.value.trim();
    this.#validateInput(concept, true);
  }

  /**
   * Handle save concept button click
   *
   * @private
   */
  async #handleSaveClick() {
    const concept = this.#elements.textarea.value.trim();
    if (!this.#validateInput(concept)) {
      return;
    }

    try {
      const characterConcept =
        await this.#characterBuilderService.createCharacterConcept(concept);
      this.#currentConcept = characterConcept;
      this.#announceToScreenReader('Character concept saved successfully.');
      await this.#loadSavedConcepts();
    } catch (error) {
      this.#logger.error(
        'CharacterBuilderController: Failed to save concept',
        error
      );
      this.#announceToScreenReader('Failed to save character concept.');
    }
  }

  /**
   * Handle retry button click
   *
   * @private
   */
  #handleRetryClick() {
    this.#elements.form.requestSubmit();
  }

  /**
   * Handle regenerate button click
   *
   * @private
   */
  #handleRegenerateClick() {
    if (this.#currentConcept) {
      this.#generateDirectionsForConcept(this.#currentConcept.id);
    }
  }

  /**
   * Handle export button click
   *
   * @private
   */
  #handleExportClick() {
    if (this.#currentDirections.length === 0) {
      return;
    }

    const data = {
      concept: this.#currentConcept,
      thematicDirections: this.#currentDirections,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `character-concept-${this.#currentConcept.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.#announceToScreenReader('Character concept exported successfully.');
  }

  /**
   * Handle continue to step 2 button click
   *
   * @private
   */
  #handleContinueClick() {
    // TODO: Implement navigation to step 2
    this.#announceToScreenReader('Step 2 is not yet implemented.');
  }

  /**
   * Handle back to menu button click
   *
   * @private
   */
  #handleBackClick() {
    window.location.href = 'index.html';
  }

  /**
   * Handle sidebar toggle
   *
   * @private
   */
  #handleToggleSidebar() {
    const isCollapsed = this.#elements.sidebar.classList.contains('collapsed');

    if (isCollapsed) {
      this.#elements.sidebar.classList.remove('collapsed');
      this.#elements.toggleSidebarBtn.setAttribute('aria-expanded', 'true');
    } else {
      this.#elements.sidebar.classList.add('collapsed');
      this.#elements.toggleSidebarBtn.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Handle refresh concepts button click
   *
   * @private
   */
  async #handleRefreshConcepts() {
    await this.#loadSavedConcepts();
    this.#announceToScreenReader('Saved concepts refreshed.');
  }

  /**
   * Handle clear all concepts button click
   *
   * @private
   */
  async #handleClearAllConcepts() {
    const confirmed = await this.#showConfirmDialog(
      'Clear All Concepts',
      'Are you sure you want to delete all saved character concepts? This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    try {
      const concepts =
        await this.#characterBuilderService.getAllCharacterConcepts();
      for (const concept of concepts) {
        await this.#characterBuilderService.deleteCharacterConcept(concept.id);
      }

      await this.#loadSavedConcepts();
      this.#announceToScreenReader('All character concepts deleted.');
    } catch (error) {
      this.#logger.error(
        'CharacterBuilderController: Failed to clear concepts',
        error
      );
      this.#announceToScreenReader('Failed to delete character concepts.');
    }
  }

  /**
   * Handle help link click
   *
   * @private
   * @param {Event} event
   */
  #handleHelpClick(event) {
    event.preventDefault();
    this.#showModal(this.#elements.helpModal);
  }

  /**
   * Handle error details button click
   *
   * @private
   */
  #handleErrorDetailsClick() {
    const errorDetails = document.getElementById('error-details');
    const isVisible = errorDetails.style.display !== 'none';

    errorDetails.style.display = isVisible ? 'none' : 'block';
    event.target.textContent = isVisible ? 'Show Details' : 'Hide Details';
  }

  /**
   * Generate directions for a specific concept
   *
   * @private
   * @param {string} conceptId - Concept ID
   */
  async #generateDirectionsForConcept(conceptId) {
    try {
      this.#showState(UI_STATES.LOADING);
      this.#announceToScreenReader('Regenerating thematic directions...');

      const directions =
        await this.#characterBuilderService.generateThematicDirections(
          conceptId
        );
      this.#currentDirections = directions;

      this.#displayResults(directions);
      this.#updateButtonStates();
      this.#announceToScreenReader(
        `Regenerated ${directions.length} thematic directions.`
      );
    } catch (error) {
      this.#logger.error(
        'CharacterBuilderController: Failed to regenerate directions',
        error
      );
      this.#showError(
        error.message || 'Failed to regenerate thematic directions'
      );
    }
  }

  /**
   * Validate user input
   *
   * @private
   * @param {string} concept - Concept text to validate
   * @param {boolean} [showError] - Whether to show error message
   * @returns {boolean} True if valid
   */
  #validateInput(concept, showError = false) {
    this.#clearValidationError();

    if (!concept) {
      if (showError) {
        this.#showValidationError('Please enter a character concept.');
      }
      return false;
    }

    if (concept.length < 10) {
      if (showError) {
        this.#showValidationError(
          'Character concept must be at least 10 characters long.'
        );
      }
      return false;
    }

    if (concept.length > 1000) {
      if (showError) {
        this.#showValidationError(
          'Character concept must be no more than 1000 characters long.'
        );
      }
      return false;
    }

    return true;
  }

  /**
   * Show validation error message
   *
   * @private
   * @param {string} message - Error message
   */
  #showValidationError(message) {
    this.#elements.errorMessage.textContent = message;
    this.#elements.textarea.setAttribute('aria-invalid', 'true');
  }

  /**
   * Clear validation error
   *
   * @private
   */
  #clearValidationError() {
    this.#elements.errorMessage.textContent = '';
    this.#elements.textarea.removeAttribute('aria-invalid');
  }

  /**
   * Update character count display
   *
   * @private
   */
  #updateCharacterCount() {
    const count = this.#elements.textarea.value.length;
    this.#elements.charCount.textContent = `${count}/1000`;

    if (count > 900) {
      this.#elements.charCount.style.color = 'var(--status-warning)';
    } else if (count > 950) {
      this.#elements.charCount.style.color = 'var(--status-error)';
    } else {
      this.#elements.charCount.style.color = 'var(--text-secondary)';
    }
  }

  /**
   * Update button states based on input
   *
   * @private
   */
  #updateButtonStates() {
    const concept = this.#elements.textarea.value.trim();
    const isValid = concept.length >= 10 && concept.length <= 1000;

    this.#elements.generateBtn.disabled = !isValid;
    this.#elements.saveBtn.disabled = !isValid;

    this.#elements.continueBtn.disabled = this.#currentDirections.length === 0;
  }

  /**
   * Show specific UI state
   *
   * @private
   * @param {string} state - State to show
   */
  #showState(state) {
    // Hide all states
    this.#elements.emptyState.style.display = 'none';
    this.#elements.loadingState.style.display = 'none';
    this.#elements.errorState.style.display = 'none';
    this.#elements.resultsState.style.display = 'none';

    // Show requested state
    switch (state) {
      case UI_STATES.EMPTY:
        this.#elements.emptyState.style.display = 'flex';
        break;
      case UI_STATES.LOADING:
        this.#elements.loadingState.style.display = 'flex';
        break;
      case UI_STATES.ERROR:
        this.#elements.errorState.style.display = 'flex';
        break;
      case UI_STATES.RESULTS:
        this.#elements.resultsState.style.display = 'block';
        break;
    }
  }

  /**
   * Display thematic directions results
   *
   * @private
   * @param {ThematicDirection[]} directions - Directions to display
   */
  #displayResults(directions) {
    this.#elements.directionsList.innerHTML = '';

    directions.forEach((direction, index) => {
      const card = this.#createDirectionCard(direction, index + 1);
      this.#elements.directionsList.appendChild(card);
    });

    this.#showState(UI_STATES.RESULTS);
  }

  /**
   * Create a direction card element
   *
   * @private
   * @param {ThematicDirection} direction - Direction data
   * @param {number} index - Direction index
   * @returns {HTMLElement} Card element
   */
  #createDirectionCard(direction, index) {
    const card = document.createElement('div');
    card.className = 'direction-card';
    card.setAttribute('role', 'article');
    card.setAttribute('aria-labelledby', `direction-title-${direction.id}`);

    card.innerHTML = `
      <div class="direction-card-header">
        <h4 id="direction-title-${direction.id}" class="direction-title">${this.#escapeHtml(direction.title)}</h4>
        <span class="direction-badge">Direction ${index}</span>
      </div>
      <div class="direction-content">
        <div class="direction-section">
          <h5 class="direction-section-title">Description</h5>
          <p class="direction-section-content">${this.#escapeHtml(direction.description)}</p>
        </div>
        <div class="direction-section">
          <h5 class="direction-section-title">Core Tension</h5>
          <p class="direction-section-content">${this.#escapeHtml(direction.coreTension)}</p>
        </div>
        <div class="direction-section">
          <h5 class="direction-section-title">Unique Twist</h5>
          <p class="direction-section-content">${this.#escapeHtml(direction.uniqueTwist)}</p>
        </div>
        <div class="direction-section">
          <h5 class="direction-section-title">Narrative Potential</h5>
          <p class="direction-section-content">${this.#escapeHtml(direction.narrativePotential)}</p>
        </div>
      </div>
    `;

    return card;
  }

  /**
   * Show error state with message
   *
   * @private
   * @param {string} message - Error message
   * @param {Error} [error] - Optional error object
   */
  #showError(message, error = null) {
    const errorMessage =
      this.#elements.errorState.querySelector('.error-message');
    errorMessage.textContent = message;

    if (error) {
      const errorDetails = document.getElementById('error-details-content');
      if (errorDetails) {
        errorDetails.textContent = error.stack || error.toString();
      }
    }

    this.#showState(UI_STATES.ERROR);
    this.#announceToScreenReader(`Error: ${message}`);
  }

  /**
   * Load saved concepts into sidebar
   *
   * @private
   */
  async #loadSavedConcepts() {
    try {
      const concepts =
        await this.#characterBuilderService.getAllCharacterConcepts();
      this.#displaySavedConcepts(concepts);
    } catch (error) {
      this.#logger.error(
        'CharacterBuilderController: Failed to load saved concepts',
        error
      );
    }
  }

  /**
   * Display saved concepts in sidebar
   *
   * @private
   * @param {CharacterConcept[]} concepts - Concepts to display
   */
  #displaySavedConcepts(concepts) {
    if (concepts.length === 0) {
      this.#elements.conceptsList.innerHTML = `
        <div class="concepts-empty">
          <p>No saved concepts yet.</p>
        </div>
      `;
      return;
    }

    this.#elements.conceptsList.innerHTML = concepts
      .map(
        (concept) => `
      <div class="concept-item" data-concept-id="${concept.id}">
        <div class="concept-item-header">
          <span class="concept-item-date">${this.#formatDate(concept.createdAt)}</span>
          <span class="concept-item-status ${concept.status}">${concept.status}</span>
        </div>
        <p class="concept-item-text">${this.#escapeHtml(concept.concept)}</p>
      </div>
    `
      )
      .join('');

    // Add click handlers for concept items
    this.#elements.conceptsList
      .querySelectorAll('.concept-item')
      .forEach((item) => {
        item.addEventListener('click', this.#handleConceptItemClick.bind(this));
      });
  }

  /**
   * Handle concept item click
   *
   * @private
   * @param {Event} event
   */
  async #handleConceptItemClick(event) {
    const conceptId = event.currentTarget.dataset.conceptId;
    if (!conceptId) return;

    try {
      const concept = await this.#characterBuilderService.getCharacterConcept(
        conceptId,
        { includeDirections: true }
      );
      if (concept) {
        this.#elements.textarea.value = concept.concept;
        this.#currentConcept = concept;
        this.#updateCharacterCount();
        this.#updateButtonStates();

        if (
          concept.thematicDirections &&
          concept.thematicDirections.length > 0
        ) {
          this.#currentDirections = concept.thematicDirections;
          this.#displayResults(concept.thematicDirections);
        } else {
          this.#showState(UI_STATES.EMPTY);
        }

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
          this.#elements.sidebar.classList.add('collapsed');
        }
      }
    } catch (error) {
      this.#logger.error(
        'CharacterBuilderController: Failed to load concept',
        error
      );
    }
  }

  /**
   * Setup modal event listeners
   *
   * @private
   */
  #setupModalEvents() {
    // Close buttons
    document.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        const modal = event.target.closest('.modal');
        this.#hideModal(modal);
      });
    });

    // Overlay clicks
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          const modal = overlay.closest('.modal');
          this.#hideModal(modal);
        }
      });
    });

    // Escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const openModal = document.querySelector('.modal[style*="block"]');
        if (openModal) {
          this.#hideModal(openModal);
        }
      }
    });

    // Confirm modal buttons
    document.getElementById('confirm-yes')?.addEventListener('click', () => {
      this.#resolveConfirmDialog(true);
    });

    document.getElementById('confirm-no')?.addEventListener('click', () => {
      this.#resolveConfirmDialog(false);
    });
  }

  /**
   * Show modal dialog
   *
   * @private
   * @param {HTMLElement} modal - Modal element
   */
  #showModal(modal) {
    modal.style.display = 'flex';

    // Focus management
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }

  /**
   * Hide modal dialog
   *
   * @private
   * @param {HTMLElement} modal - Modal element
   */
  #hideModal(modal) {
    modal.style.display = 'none';
  }

  /**
   * Show confirmation dialog
   *
   * @private
   * @param {string} title - Dialog title
   * @param {string} message - Dialog message
   * @returns {Promise<boolean>} User's choice
   */
  #showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-message').textContent = message;

      this.#confirmResolver = resolve;
      this.#showModal(this.#elements.confirmModal);
    });
  }

  /**
   * Resolve confirmation dialog
   *
   * @private
   * @param {boolean} result - User's choice
   */
  #resolveConfirmDialog(result) {
    if (this.#confirmResolver) {
      this.#confirmResolver(result);
      this.#confirmResolver = null;
    }
    this.#hideModal(this.#elements.confirmModal);
  }

  /**
   * Announce message to screen readers
   *
   * @private
   * @param {string} message - Message to announce
   */
  #announceToScreenReader(message) {
    if (this.#elements.liveRegion) {
      this.#elements.liveRegion.textContent = message;

      // Clear after announcement
      setTimeout(() => {
        this.#elements.liveRegion.textContent = '';
      }, 1000);
    }
  }

  /**
   * Escape HTML characters
   *
   * @private
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format date for display
   *
   * @private
   * @param {Date} date - Date to format
   * @returns {string} Formatted date
   */
  #formatDate(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }

    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffHours < 24 * 7) {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}
