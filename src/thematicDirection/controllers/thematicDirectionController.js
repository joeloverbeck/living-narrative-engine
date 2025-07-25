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
 * @typedef {import('../../interfaces/schema-validator.js').ISchemaValidator} ISchemaValidator
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

      // Set up event listeners
      this.#setupEventListeners();

      // Initialize UI state
      this.#showState(UI_STATES.EMPTY);

      // Load previous concepts into dropdown
      await this.#loadPreviousConcepts();

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
    this.#elements.textarea = document.getElementById('concept-input');
    this.#elements.charCount = document.querySelector('.char-count');
    this.#elements.errorMessage = document.getElementById('concept-error');

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

    // Previous concepts dropdown
    this.#elements.previousConceptsSelect =
      document.getElementById('previous-concepts');

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

    // Previous concepts dropdown
    if (this.#elements.previousConceptsSelect) {
      this.#elements.previousConceptsSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          this.#handleConceptSelection(e.target.value);
        }
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
    const conceptText = this.#elements.textarea.value.trim();

    if (!conceptText || conceptText.length < 10) {
      this.#showFieldError('Please enter at least 10 characters.');
      return;
    }

    this.#showState(UI_STATES.LOADING);

    try {
      // Create and store concept
      this.#logger.debug(
        'ThematicDirectionController: Creating character concept'
      );
      const concept =
        await this.#characterBuilderService.createCharacterConcept(conceptText);
      this.#currentConcept = concept;

      // Generate directions
      this.#logger.debug(
        'ThematicDirectionController: Generating thematic directions'
      );
      const directions =
        await this.#characterBuilderService.generateThematicDirections(
          concept.id
        );
      this.#currentDirections = directions;

      // Update UI
      this.#showResults(directions);

      // Refresh dropdown to include new concept
      await this.#loadPreviousConcepts();

      // Dispatch success event
      this.#eventBus.dispatch('THEMATIC_DIRECTIONS_GENERATED', {
        conceptId: concept.id,
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
   * Handle selection from previous concepts dropdown
   *
   * @private
   * @param {string} conceptId - Selected concept ID
   */
  async #handleConceptSelection(conceptId) {
    try {
      const concept =
        await this.#characterBuilderService.getCharacterConcept(conceptId);

      if (concept) {
        // Update textarea with concept text
        this.#elements.textarea.value = concept.concept;
        this.#updateCharCount();
        this.#validateInput();

        // If concept has directions, show them
        if (
          concept.thematicDirections &&
          concept.thematicDirections.length > 0
        ) {
          this.#currentConcept = concept;
          this.#currentDirections = concept.thematicDirections;
          this.#showResults(concept.thematicDirections);
        }
      }
    } catch (error) {
      this.#logger.error(
        'ThematicDirectionController: Failed to load concept',
        error
      );
      this.#showFieldError('Failed to load selected concept.');
    }
  }

  /**
   * Load previous concepts into dropdown
   *
   * @private
   */
  async #loadPreviousConcepts() {
    try {
      const concepts =
        await this.#characterBuilderService.getAllCharacterConcepts();

      // Check if dropdown element exists before updating DOM
      if (!this.#elements.previousConceptsSelect) {
        this.#logger.warn(
          'ThematicDirectionController: Previous concepts dropdown not found, skipping DOM updates but concepts loaded'
        );
        return;
      }

      // Clear existing options (except first)
      this.#elements.previousConceptsSelect.innerHTML =
        '<option value="">-- Select a saved concept --</option>';

      // Add concepts to dropdown
      concepts.forEach((concept) => {
        const option = document.createElement('option');
        option.value = concept.id;

        // Truncate long concepts for display
        const displayText =
          concept.concept.length > 60
            ? concept.concept.substring(0, 60) + '...'
            : concept.concept;

        option.textContent = displayText;

        // Select if it's the current concept
        if (this.#currentConcept && concept.id === this.#currentConcept.id) {
          option.selected = true;
        }

        this.#elements.previousConceptsSelect.appendChild(option);
      });
    } catch (error) {
      this.#logger.error(
        'ThematicDirectionController: Failed to load previous concepts',
        error
      );
      // Don't show error to user - dropdown will just remain empty
    }
  }

  /**
   * Validate the input field
   *
   * @private
   */
  #validateInput() {
    if (!this.#elements.textarea || !this.#elements.generateBtn) {
      return; // Skip validation if required elements are missing
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
