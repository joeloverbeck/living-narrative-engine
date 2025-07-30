/**
 * @file Simplified controller for thematic direction generation
 * @description Manages UI for single-page thematic direction generator
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../characterBuilder/services/characterBuilderService.js').CharacterBuilderService} CharacterBuilderService
 * @typedef {import('../../characterBuilder/models/characterConcept.js').CharacterConcept} CharacterConcept
 * @typedef {import('../../characterBuilder/models/thematicDirection.js').ThematicDirection} ThematicDirection
 * @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 */

/**
 * UI states for the thematic direction generator
 */
const UI_STATES = {
  EMPTY: 'empty',
  LOADING: 'loading',
  RESULTS: 'results',
  ERROR: 'error',
};

/**
 * Controller for thematic direction generator interface
 */
export class ThematicDirectionController {
  #logger;
  #characterBuilderService;
  #eventBus;
  #schemaValidator;
  #currentConcept = null;
  #currentDirections = [];
  #selectedConceptId = null;
  #conceptsData = [];

  // DOM element references
  #elements = {};

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {CharacterBuilderService} dependencies.characterBuilderService - Character builder service
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event dispatcher
   * @param {ISchemaValidator} dependencies.schemaValidator - Schema validator
   */
  constructor({ logger, characterBuilderService, eventBus, schemaValidator }) {
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
          'getThematicDirections',
        ],
      }
    );
    validateDependency(eventBus, 'ISafeEventDispatcher', logger, {
      requiredMethods: ['dispatch'],
    });
    validateDependency(schemaValidator, 'ISchemaValidator', logger, {
      requiredMethods: ['validateAgainstSchema'],
    });

    this.#logger = logger;
    this.#characterBuilderService = characterBuilderService;
    this.#eventBus = eventBus;
    this.#schemaValidator = schemaValidator;
  }

  /**
   * Initialize the thematic direction generator UI
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Cache DOM elements first so they're available for error handling
      this.#cacheElements();

      // Initialize the service
      await this.#characterBuilderService.initialize();

      // Load character concepts for the new selector
      await this.#loadCharacterConcepts();

      // Set up event listeners
      this.#setupEventListeners();

      // Initialize UI state
      this.#showState(UI_STATES.EMPTY);

      this.#logger.info(
        'ThematicDirectionController: Successfully initialized'
      );
    } catch (error) {
      this.#logger.error(
        'ThematicDirectionController: Failed to initialize',
        error
      );
      this.#showError(
        'Failed to initialize thematic direction generator. Please refresh the page.'
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
    this.#elements.form = document.getElementById('concept-form');
    this.#elements.textarea = document.getElementById('concept-input'); // Legacy - may not exist
    this.#elements.charCount = document.querySelector('.char-count'); // Legacy - may not exist
    this.#elements.errorMessage = document.getElementById('concept-error'); // Legacy - may not exist

    // New concept selector elements
    this.#elements.conceptSelector =
      document.getElementById('concept-selector');
    this.#elements.selectedConceptDisplay = document.getElementById(
      'selected-concept-display'
    );
    this.#elements.conceptContent = document.getElementById('concept-content');
    this.#elements.conceptDirectionsCount = document.getElementById(
      'concept-directions-count'
    );
    this.#elements.conceptCreatedDate = document.getElementById(
      'concept-created-date'
    );
    this.#elements.conceptSelectorError = document.getElementById(
      'concept-selector-error'
    );

    // Buttons
    this.#elements.generateBtn = document.getElementById('generate-btn');
    this.#elements.retryBtn = document.getElementById('retry-btn');
    this.#elements.backBtn = document.getElementById('back-to-menu-btn');

    // State containers
    this.#elements.emptyState = document.getElementById('empty-state');
    this.#elements.loadingState = document.getElementById('loading-state');
    this.#elements.errorState = document.getElementById('error-state');
    this.#elements.resultsState = document.getElementById('results-state');
    this.#elements.directionsResults =
      document.getElementById('directions-results');

    // Error display
    this.#elements.errorMessageText =
      document.getElementById('error-message-text');
  }

  /**
   * Set up event listeners
   *
   * @private
   */
  #setupEventListeners() {
    // Form submission
    if (this.#elements.form) {
      this.#elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.#handleGenerate();
      });
    }

    // Text input validation
    if (this.#elements.textarea) {
      this.#elements.textarea.addEventListener('input', () => {
        this.#validateInput();
        this.#updateCharCount();
      });
    }

    // New concept selector
    if (this.#elements.conceptSelector) {
      this.#elements.conceptSelector.addEventListener('change', () => {
        this.#handleConceptSelection();
      });
    }

    // Retry button
    if (this.#elements.retryBtn) {
      this.#elements.retryBtn.addEventListener('click', () => {
        this.#showState(UI_STATES.EMPTY);
      });
    }

    // Back to menu button
    if (this.#elements.backBtn) {
      this.#elements.backBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    // Initial validation
    this.#validateInput();
  }

  /**
   * Handle generate button click
   *
   * @private
   */
  async #handleGenerate() {
    // Use new validation method
    if (!this.#validateForm()) {
      return;
    }

    // Get selected concept
    const concept = this.#conceptsData.find(
      (c) => c.id === this.#selectedConceptId
    );
    if (!concept) {
      this.#showError('Selected concept not found. Please select again.');
      return;
    }

    this.#showState(UI_STATES.LOADING);

    try {
      // Generate directions with the selected concept
      this.#logger.debug(
        'ThematicDirectionController: Generating thematic directions for selected concept',
        { conceptId: this.#selectedConceptId }
      );
      const directions =
        await this.#characterBuilderService.generateThematicDirections(
          this.#selectedConceptId
        );
      this.#currentDirections = directions;
      this.#currentConcept = concept;

      // Update UI
      this.#showResults(directions);

      // Refresh direction count in the concept display
      await this.#loadDirectionCount(this.#selectedConceptId);

      // Dispatch success event
      this.#eventBus.dispatch('thematic:thematic_directions_generated', {
        conceptId: this.#selectedConceptId,
        directionCount: directions.length,
        autoSaved: true,
      });
    } catch (error) {
      this.#logger.error(
        'ThematicDirectionController: Failed to generate directions',
        error
      );
      this.#showError(
        error.message ||
          'Failed to generate thematic directions. Please try again.'
      );
    }
  }

  /**
   * Handle concept selection change from new selector
   *
   * @private
   */
  async #handleConceptSelection() {
    const selectedId = this.#elements.conceptSelector?.value;

    if (!selectedId) {
      // No concept selected
      this.#selectedConceptId = null;
      if (this.#elements.selectedConceptDisplay) {
        this.#elements.selectedConceptDisplay.style.display = 'none';
      }
      this.#validateForm();
      return;
    }

    // Find selected concept
    const concept = this.#conceptsData.find((c) => c.id === selectedId);
    if (!concept) {
      this.#logger.error('Selected concept not found', { selectedId });
      return;
    }

    this.#selectedConceptId = selectedId;

    // Display concept details
    this.#displaySelectedConcept(concept);

    // Load direction count
    await this.#loadDirectionCount(selectedId);

    // Validate form
    this.#validateForm();
  }

  /**
   * Display the selected concept
   *
   * @param {object} concept - The selected concept
   * @private
   */
  #displaySelectedConcept(concept) {
    if (
      !this.#elements.selectedConceptDisplay ||
      !this.#elements.conceptContent
    ) {
      return;
    }

    // Show display area
    this.#elements.selectedConceptDisplay.style.display = 'block';

    // Set concept text
    this.#elements.conceptContent.textContent = concept.concept;

    // Set creation date
    if (this.#elements.conceptCreatedDate && concept.createdAt) {
      const createdDate = new Date(concept.createdAt).toLocaleDateString();
      this.#elements.conceptCreatedDate.textContent = `Created on ${createdDate}`;
    }

    // Scroll into view
    this.#elements.selectedConceptDisplay.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }

  /**
   * Load direction count for selected concept
   *
   * @param {string} conceptId - The concept ID
   * @private
   */
  async #loadDirectionCount(conceptId) {
    if (!this.#elements.conceptDirectionsCount) {
      return;
    }

    try {
      const directions =
        await this.#characterBuilderService.getThematicDirections(conceptId);
      const count = directions.length;

      let text;
      if (count === 0) {
        text = 'No existing directions';
      } else if (count === 1) {
        text = '1 existing direction';
      } else {
        text = `${count} existing directions`;
      }

      this.#elements.conceptDirectionsCount.textContent = text;

      // Add warning if many directions exist
      if (count >= 10) {
        this.#elements.conceptDirectionsCount.innerHTML +=
          ' <span class="warning">(consider if more are needed)</span>';
      }
    } catch (error) {
      this.#logger.error('Failed to load direction count', error);
      this.#elements.conceptDirectionsCount.textContent =
        'Unable to load directions';
    }
  }

  /**
   * Load available character concepts for selection
   *
   * @private
   */
  async #loadCharacterConcepts() {
    this.#logger.info('Loading character concepts for selection');

    try {
      // Show loading state
      if (this.#elements.conceptSelector) {
        this.#elements.conceptSelector.classList.add('loading');
        this.#elements.conceptSelector.disabled = true;
      }

      // Load concepts
      const concepts =
        await this.#characterBuilderService.getAllCharacterConcepts();
      this.#conceptsData = concepts;

      // Sort by creation date (newest first)
      concepts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Populate dropdown
      this.#populateConceptSelector(concepts);

      // Check URL parameters for pre-selection
      this.#checkForPreselection();

      this.#logger.info(`Loaded ${concepts.length} character concepts`);
    } catch (error) {
      this.#logger.error('Failed to load character concepts', error);
      this.#showConceptError(
        'Failed to load character concepts. Please refresh the page.'
      );
    } finally {
      if (this.#elements.conceptSelector) {
        this.#elements.conceptSelector.classList.remove('loading');
        this.#elements.conceptSelector.disabled = false;
      }
    }
  }

  /**
   * Populate the concept selector dropdown
   *
   * @param {Array} concepts - Array of concept objects
   * @private
   */
  #populateConceptSelector(concepts) {
    if (!this.#elements.conceptSelector) {
      this.#logger.warn(
        'Concept selector element not found, skipping population'
      );
      return;
    }

    // Clear existing options except the first
    while (this.#elements.conceptSelector.options.length > 1) {
      this.#elements.conceptSelector.remove(1);
    }

    if (concepts.length === 0) {
      // Show no concepts message
      this.#showNoConceptsMessage();
      return;
    }

    // Add concepts as options
    concepts.forEach((concept) => {
      const option = document.createElement('option');
      option.value = concept.id;
      option.textContent = this.#truncateText(concept.concept, 80);

      // Add data attributes for quick access
      option.dataset.fullText = concept.concept;
      option.dataset.createdAt = concept.createdAt;

      this.#elements.conceptSelector.appendChild(option);
    });
  }

  /**
   * Truncate text for display
   *
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   * @private
   */
  #truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Show message when no concepts exist
   *
   * @private
   */
  #showNoConceptsMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'no-concepts-message';
    messageDiv.innerHTML = `
      <h3>No Character Concepts Available</h3>
      <p>You need to create at least one character concept before generating thematic directions.</p>
      <a href="character-concepts-manager.html" class="cb-button-primary">
        Create Your First Concept
      </a>
    `;

    // Insert after the form group
    if (this.#elements.conceptSelector) {
      const formGroup =
        this.#elements.conceptSelector.closest('.cb-form-group');
      if (formGroup) {
        formGroup.insertAdjacentElement('afterend', messageDiv);
      }

      // Disable form submission
      this.#elements.conceptSelector.disabled = true;
      if (this.#elements.generateBtn) {
        this.#elements.generateBtn.disabled = true;
      }
    }
  }

  /**
   * Check URL for concept pre-selection
   *
   * @private
   */
  #checkForPreselection() {
    if (typeof window === 'undefined') return; // Guard for testing

    const urlParams = new URLSearchParams(window.location.search);
    const conceptId = urlParams.get('conceptId');

    if (conceptId && this.#conceptsData.some((c) => c.id === conceptId)) {
      if (this.#elements.conceptSelector) {
        this.#elements.conceptSelector.value = conceptId;
        this.#handleConceptSelection();
      }
    }
  }

  /**
   * Validate the entire form
   *
   * @returns {boolean} - True if form is valid
   * @private
   */
  #validateForm() {
    let isValid = true;

    // Validate concept selection
    if (!this.#selectedConceptId) {
      this.#showConceptError('Please select a character concept');
      isValid = false;
    } else {
      this.#clearConceptError();
    }

    // Update generate button state
    if (this.#elements.generateBtn) {
      this.#elements.generateBtn.disabled = !isValid;
    }

    return isValid;
  }

  /**
   * Validate the input field (legacy)
   *
   * @private
   */
  #validateInput() {
    if (!this.#elements.textarea || !this.#elements.generateBtn) {
      // Use new validation if old elements don't exist
      return this.#validateForm();
    }

    const value = this.#elements.textarea.value.trim();
    const isValid = value.length >= 10 && value.length <= 1000;

    this.#elements.generateBtn.disabled = !isValid;

    if (!isValid && value.length > 0) {
      if (value.length < 10) {
        this.#showFieldError('Please enter at least 10 characters.');
      } else if (value.length > 1000) {
        this.#showFieldError('Please keep your concept under 1000 characters.');
      }
    } else {
      this.#clearFieldError();
    }
  }

  /**
   * Update character count display
   *
   * @private
   */
  #updateCharCount() {
    if (!this.#elements.textarea || !this.#elements.charCount) {
      return; // Skip if required elements are missing
    }

    const length = this.#elements.textarea.value.length;
    this.#elements.charCount.textContent = `${length}/1000`;
  }

  /**
   * Show field-level error
   *
   * @private
   * @param {string} message - Error message
   */
  #showFieldError(message) {
    if (this.#elements.errorMessage) {
      this.#elements.errorMessage.textContent = message;
    }
    if (this.#elements.textarea) {
      this.#elements.textarea.setAttribute('aria-invalid', 'true');
    }
  }

  /**
   * Clear field-level error
   *
   * @private
   */
  #clearFieldError() {
    if (this.#elements.errorMessage) {
      this.#elements.errorMessage.textContent = '';
    }
    if (this.#elements.textarea) {
      this.#elements.textarea.setAttribute('aria-invalid', 'false');
    }
  }

  /**
   * Show concept selection error
   *
   * @param {string} message - Error message
   * @private
   */
  #showConceptError(message) {
    if (this.#elements.conceptSelectorError) {
      this.#elements.conceptSelectorError.textContent = message;
    }
    if (this.#elements.conceptSelector) {
      this.#elements.conceptSelector.classList.add('error');
    }
  }

  /**
   * Clear concept selection error
   *
   * @private
   */
  #clearConceptError() {
    if (this.#elements.conceptSelectorError) {
      this.#elements.conceptSelectorError.textContent = '';
    }
    if (this.#elements.conceptSelector) {
      this.#elements.conceptSelector.classList.remove('error');
    }
  }

  /**
   * Show UI state
   *
   * @private
   * @param {string} state - UI state to show
   */
  #showState(state) {
    // Hide all state containers
    if (this.#elements.emptyState)
      this.#elements.emptyState.style.display = 'none';
    if (this.#elements.loadingState)
      this.#elements.loadingState.style.display = 'none';
    if (this.#elements.errorState)
      this.#elements.errorState.style.display = 'none';
    if (this.#elements.resultsState)
      this.#elements.resultsState.style.display = 'none';

    // Show requested state
    switch (state) {
      case UI_STATES.EMPTY:
        if (this.#elements.emptyState) {
          this.#elements.emptyState.style.display = 'block';
        }
        break;
      case UI_STATES.LOADING:
        if (this.#elements.loadingState) {
          this.#elements.loadingState.style.display = 'block';
        }
        break;
      case UI_STATES.ERROR:
        if (this.#elements.errorState) {
          this.#elements.errorState.style.display = 'block';
        }
        break;
      case UI_STATES.RESULTS:
        if (this.#elements.resultsState) {
          this.#elements.resultsState.style.display = 'block';
        }
        break;
    }
  }

  /**
   * Show error state with message
   *
   * @private
   * @param {string} message - Error message to display
   */
  #showError(message) {
    if (this.#elements.errorMessageText) {
      this.#elements.errorMessageText.textContent = message;
    }
    this.#showState(UI_STATES.ERROR);
  }

  /**
   * Show results
   *
   * @private
   * @param {ThematicDirection[]} directions - Generated directions
   */
  #showResults(directions) {
    // Clear previous results
    this.#elements.directionsResults.innerHTML = '';

    // Create results container
    const container = document.createElement('div');
    container.className = 'directions-container';

    // Add each direction
    directions.forEach((direction, index) => {
      const directionElement = this.#createDirectionElement(
        direction,
        index + 1
      );
      container.appendChild(directionElement);
    });

    // Append to results
    this.#elements.directionsResults.appendChild(container);

    // Show results state
    this.#showState(UI_STATES.RESULTS);
  }

  /**
   * Create a direction element
   *
   * @private
   * @param {ThematicDirection} direction - Direction data
   * @param {number} index - Direction index (1-based)
   * @returns {HTMLElement} Direction element
   */
  #createDirectionElement(direction, index) {
    const article = document.createElement('article');
    article.className = 'direction-card';
    article.setAttribute('role', 'article');
    article.setAttribute('aria-labelledby', `direction-title-${index}`);

    // Title
    const title = document.createElement('h3');
    title.id = `direction-title-${index}`;
    title.className = 'direction-title';
    title.textContent = `${index}. ${direction.title}`;
    article.appendChild(title);

    // Description
    const description = document.createElement('p');
    description.className = 'direction-description';
    description.textContent = direction.description;
    article.appendChild(description);

    // Core Tension
    if (direction.coreTension) {
      const tensionContainer = document.createElement('div');
      tensionContainer.className = 'direction-tension';

      const tensionLabel = document.createElement('strong');
      tensionLabel.textContent = 'Core Tension: ';
      tensionContainer.appendChild(tensionLabel);

      const tensionText = document.createElement('span');
      tensionText.textContent = direction.coreTension;
      tensionContainer.appendChild(tensionText);

      article.appendChild(tensionContainer);
    }

    // Unique Twist
    if (direction.uniqueTwist) {
      const twistContainer = document.createElement('div');
      twistContainer.className = 'direction-twist';

      const twistLabel = document.createElement('strong');
      twistLabel.textContent = 'Unique Twist: ';
      twistContainer.appendChild(twistLabel);

      const twistText = document.createElement('span');
      twistText.textContent = direction.uniqueTwist;
      twistContainer.appendChild(twistText);

      article.appendChild(twistContainer);
    }

    // Narrative Potential
    if (direction.narrativePotential) {
      const potentialContainer = document.createElement('div');
      potentialContainer.className = 'direction-potential';

      const potentialLabel = document.createElement('strong');
      potentialLabel.textContent = 'Narrative Potential: ';
      potentialContainer.appendChild(potentialLabel);

      const potentialText = document.createElement('span');
      potentialText.textContent = direction.narrativePotential;
      potentialContainer.appendChild(potentialText);

      article.appendChild(potentialContainer);
    }

    return article;
  }
}

export default ThematicDirectionController;
