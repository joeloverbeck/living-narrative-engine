/**
 * @file Thematic direction generation controller using base controller
 * @description Manages UI for thematic direction generator
 */

import { BaseCharacterBuilderController } from '../../characterBuilder/controllers/BaseCharacterBuilderController.js';
import { DomUtils } from '../../utils/domUtils.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../characterBuilder/services/characterBuilderService.js').CharacterBuilderService} CharacterBuilderService
 * @typedef {import('../../characterBuilder/models/characterConcept.js').CharacterConcept} CharacterConcept
 * @typedef {import('../../characterBuilder/models/thematicDirection.js').ThematicDirection} ThematicDirection
 * @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 */

/**
 * Controller for thematic direction generator interface
 */
export class ThematicDirectionController extends BaseCharacterBuilderController {
  // Page-specific state
  #currentConcept = null;
  #currentDirections = [];
  #selectedConceptId = null;
  #conceptsData = [];

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {CharacterBuilderService} dependencies.characterBuilderService
   * @param {ISafeEventDispatcher} dependencies.eventBus
   * @param {ISchemaValidator} dependencies.schemaValidator
   */
  constructor(dependencies) {
    super(dependencies);
    // Base class handles all validation
  }

  /**
   * Cache DOM elements
   *
   * @protected
   */
  _cacheElements() {
    this._cacheElementsFromMap({
      // Form elements
      form: '#concept-form',
      textarea: { selector: '#concept-input', required: false }, // Legacy
      charCount: { selector: '.char-count', required: false }, // Legacy
      errorMessage: { selector: '#concept-error', required: false }, // Legacy

      // Concept selector elements
      conceptSelector: '#concept-selector',
      selectedConceptDisplay: '#selected-concept-display',
      conceptContent: '#concept-content',
      conceptDirectionsCount: '#concept-directions-count',
      conceptCreatedDate: '#concept-created-date',
      conceptSelectorError: '#concept-selector-error',

      // Buttons
      generateBtn: '#generate-btn',
      retryBtn: '#retry-btn',
      backBtn: '#back-to-menu-btn',

      // State containers
      emptyState: '#empty-state',
      loadingState: '#loading-state',
      resultsState: '#results-state',
      errorState: '#error-state',
      errorMessageText: '#error-message-text',

      // Results elements
      directionsContainer: '#generated-directions',
      directionsList: '#directions-list',
      directionsResults: '#directions-results',
      generatedConcept: '#generated-concept',
      conceptText: '#concept-text',
      characterCount: '#character-count',
      timestamp: '#timestamp',
    });
  }

  /**
   * Set up event listeners
   *
   * @protected
   */
  _setupEventListeners() {
    // Form submission (if form exists)
    if (this._getElement('form')) {
      this._addEventListener('form', 'submit', (e) => {
        e.preventDefault();
        this._handleGenerateDirections();
      });
    }

    // Text input validation (legacy support)
    if (this._getElement('textarea')) {
      this._addEventListener('textarea', 'input', () => {
        this._validateInput();
        this._updateCharCount();
      });
    }

    // Concept selector change
    if (this._getElement('conceptSelector')) {
      this._addEventListener('conceptSelector', 'change', () => {
        this._handleConceptSelection();
      });
    }

    // Generate button click (backup)
    if (this._getElement('generateBtn')) {
      this._addEventListener('generateBtn', 'click', () => {
        this._handleGenerateDirections();
      });
    }

    // Retry button
    if (this._getElement('retryBtn')) {
      this._addEventListener('retryBtn', 'click', () => {
        this._resetToEmpty();
      });
    }

    // Back to menu button
    if (this._getElement('backBtn')) {
      this._addEventListener('backBtn', 'click', () => {
        window.location.href = 'index.html';
      });
    }

    // Initial validation (only if legacy elements exist)
    if (this._getElement('textarea')) {
      this._validateInput();
    }
  }

  /**
   * Load initial data
   *
   * @protected
   */
  async _loadInitialData() {
    try {
      const concepts =
        await this.characterBuilderService.getAllCharacterConcepts();
      this.#conceptsData = concepts;
      this._populateConceptSelector(concepts);

      // Check for concept in URL
      this._checkForPreselection();
    } catch (error) {
      this._handleServiceError(
        error,
        'load character concepts',
        'Failed to load character concepts. Please refresh the page.'
      );
    }
  }

  /**
   * Initialize UI state
   *
   * @protected
   */
  async _initializeUIState() {
    // Initialize UIStateManager first by calling parent method
    await super._initializeUIState();

    // Check if we have a preselected concept
    if (this.#selectedConceptId) {
      this._showState('empty');
      this._updateGenerateButton(true);
    } else {
      this._showState('empty');
      this._updateGenerateButton(false);
    }
  }

  /**
   * Handle generate directions button click
   *
   * @private
   */
  async _handleGenerateDirections() {
    if (!this.#selectedConceptId) {
      this._showSelectorError('Please select a character concept first');
      return;
    }

    this._showLoading('Generating thematic directions...');
    this._clearSelectorError();

    try {
      const directions = await this._executeWithErrorHandling(
        () =>
          this.characterBuilderService.generateThematicDirections(
            this.#selectedConceptId
          ),
        'generate thematic directions',
        {
          userErrorMessage:
            'Failed to generate thematic directions. Please try again.',
          retries: 2,
          retryDelay: 1000,
        }
      );

      this.#currentDirections = directions;
      this.#currentConcept = this.#conceptsData.find(
        (c) => c.id === this.#selectedConceptId
      );
      this._displayResults(this.#currentConcept, directions);

      // Dispatch success event
      this.eventBus.dispatch('core:thematic_directions_generated', {
        conceptId: this.#selectedConceptId,
        directionCount: directions.length,
        autoSaved: true,
      });
    } catch (error) {
      // Error already handled by _executeWithErrorHandling
      this.logger.error('Generation failed after retries', error);
    }
  }

  /**
   * Handle concept selection from dropdown
   *
   * @private
   */
  _handleConceptSelection() {
    const selectedId = this._getElement('conceptSelector').value;

    if (!selectedId) {
      this._clearConceptDisplay();
      this.#selectedConceptId = null;
      this._updateGenerateButton(false);
      return;
    }

    this._selectConcept(selectedId);
  }

  /**
   * Select a concept by ID
   *
   * @private
   * @param {string} conceptId
   */
  _selectConcept(conceptId) {
    const concept = this.#conceptsData.find((c) => c.id === conceptId);

    if (!concept) {
      this.logger.warn(`Concept not found: ${conceptId}`);
      return;
    }

    this.#selectedConceptId = conceptId;
    this.#currentConcept = concept;
    this._displaySelectedConcept(concept);
    this._updateGenerateButton(true);

    // Update selector if needed
    if (this._getElement('conceptSelector').value !== conceptId) {
      this._getElement('conceptSelector').value = conceptId;
    }

    // Load direction count
    this._loadDirectionCount(conceptId);
  }

  /**
   * Display the selected concept
   *
   * @private
   * @param {object} concept
   */
  _displaySelectedConcept(concept) {
    if (this._getElement('selectedConceptDisplay')) {
      this._getElement('selectedConceptDisplay').style.display = 'block';
    }

    if (this._getElement('conceptContent')) {
      this._setElementText('conceptContent', concept.concept);
    }

    if (this._getElement('conceptCreatedDate') && concept.createdAt) {
      const createdDate = new Date(concept.createdAt).toLocaleDateString();
      this._setElementText('conceptCreatedDate', `Created on ${createdDate}`);
    }

    // Scroll into view
    if (this._getElement('selectedConceptDisplay')) {
      this._getElement('selectedConceptDisplay').scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }

  /**
   * Clear concept display
   *
   * @private
   */
  _clearConceptDisplay() {
    if (this._getElement('selectedConceptDisplay')) {
      this._getElement('selectedConceptDisplay').style.display = 'none';
    }
  }

  /**
   * Load direction count for selected concept
   *
   * @private
   * @param {string} conceptId
   */
  async _loadDirectionCount(conceptId) {
    if (!this._getElement('conceptDirectionsCount')) {
      return;
    }

    try {
      const directions =
        await this.characterBuilderService.getThematicDirections(conceptId);
      const count = directions.length;

      let text;
      if (count === 0) {
        text = 'No existing directions';
      } else if (count === 1) {
        text = '1 existing direction';
      } else {
        text = `${count} existing directions`;
      }

      this._setElementText('conceptDirectionsCount', text);

      // Add warning if many directions exist
      if (count >= 10) {
        this._getElement('conceptDirectionsCount').innerHTML +=
          ' <span class="warning">(consider if more are needed)</span>';
      }
    } catch (error) {
      this.logger.error('Failed to load direction count', error);
      this._setElementText(
        'conceptDirectionsCount',
        'Unable to load directions'
      );
    }
  }

  /**
   * Populate the concept selector dropdown
   *
   * @private
   * @param {Array} concepts
   */
  _populateConceptSelector(concepts) {
    if (!this._getElement('conceptSelector')) {
      this.logger.warn(
        'Concept selector element not found, skipping population'
      );
      return;
    }

    // Show loading state
    this._getElement('conceptSelector').classList.add('loading');
    this._getElement('conceptSelector').disabled = true;

    try {
      // Sort by creation date (newest first)
      concepts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Clear existing options except the first
      while (this._getElement('conceptSelector').options.length > 1) {
        this._getElement('conceptSelector').remove(1);
      }

      if (concepts.length === 0) {
        this._showNoConceptsMessage();
        return;
      }

      // Add concepts as options
      concepts.forEach((concept) => {
        const option = document.createElement('option');
        option.value = concept.id;
        option.textContent = this._truncateText(concept.concept, 80);

        // Add data attributes for quick access
        option.dataset.fullText = concept.concept;
        option.dataset.createdAt = concept.createdAt;

        this._getElement('conceptSelector').appendChild(option);
      });

      this.logger.info(`Loaded ${concepts.length} character concepts`);
    } finally {
      this._getElement('conceptSelector').classList.remove('loading');
      this._getElement('conceptSelector').disabled = false;
    }
  }

  /**
   * Truncate text for display
   *
   * @private
   * @param {string} text
   * @param {number} maxLength
   * @returns {string}
   */
  _truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Show message when no concepts exist
   *
   * @private
   */
  _showNoConceptsMessage() {
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
    if (this._getElement('conceptSelector')) {
      const formGroup =
        this._getElement('conceptSelector').closest('.cb-form-group');
      if (formGroup) {
        formGroup.insertAdjacentElement('afterend', messageDiv);
      }

      // Disable form submission
      this._getElement('conceptSelector').disabled = true;
      this._updateGenerateButton(false);
    }
  }

  /**
   * Check URL for concept pre-selection
   *
   * @private
   */
  _checkForPreselection() {
    if (typeof window === 'undefined') return; // Guard for testing

    const urlParams = new URLSearchParams(window.location.search);
    const conceptId = urlParams.get('conceptId');

    if (conceptId && this.#conceptsData.some((c) => c.id === conceptId)) {
      this._selectConcept(conceptId);
    }
  }

  /**
   * Update generate button state
   *
   * @private
   * @param {boolean} enabled
   */
  _updateGenerateButton(enabled) {
    if (this._getElement('generateBtn')) {
      this._getElement('generateBtn').disabled = !enabled;
    }
  }

  /**
   * Clear selector error
   *
   * @private
   */
  _clearSelectorError() {
    if (this._getElement('conceptSelectorError')) {
      this._setElementText('conceptSelectorError', '');
      this._removeElementClass('conceptSelector', 'error');
    }
  }

  /**
   * Show selector error
   *
   * @private
   * @param {string} message
   */
  _showSelectorError(message) {
    if (this._getElement('conceptSelectorError')) {
      this._setElementText('conceptSelectorError', message);
      this._addElementClass('conceptSelector', 'error');
    }
  }

  /**
   * Reset to empty state
   *
   * @private
   */
  _resetToEmpty() {
    this._showState('empty');
    this._clearSelectorError();

    if (this.#selectedConceptId) {
      this._updateGenerateButton(true);
    }
  }

  /**
   * Validate the input field (legacy support)
   *
   * @private
   */
  _validateInput() {
    if (!this._getElement('textarea') || !this._getElement('generateBtn')) {
      return; // Skip if legacy elements don't exist
    }

    const value = this._getElement('textarea').value.trim();
    const isValid = value.length >= 10 && value.length <= 1000;

    this._getElement('generateBtn').disabled = !isValid;

    if (!isValid && value.length > 0) {
      if (value.length < 10) {
        this._showFieldError('Please enter at least 10 characters.');
      } else if (value.length > 1000) {
        this._showFieldError('Please keep your concept under 1000 characters.');
      }
    } else {
      this._clearFieldError();
    }
  }

  /**
   * Update character count display (legacy support)
   *
   * @private
   */
  _updateCharCount() {
    if (!this._getElement('textarea') || !this._getElement('charCount')) {
      return; // Skip if required elements are missing
    }

    const length = this._getElement('textarea').value.length;
    this._setElementText('charCount', `${length}/1000`);
  }

  /**
   * Show field-level error (legacy support)
   *
   * @private
   * @param {string} message
   */
  _showFieldError(message) {
    if (this._getElement('errorMessage')) {
      this._setElementText('errorMessage', message);
    }
    if (this._getElement('textarea')) {
      this._getElement('textarea').setAttribute('aria-invalid', 'true');
    }
  }

  /**
   * Clear field-level error (legacy support)
   *
   * @private
   */
  _clearFieldError() {
    if (this._getElement('errorMessage')) {
      this._setElementText('errorMessage', '');
    }
    if (this._getElement('textarea')) {
      this._getElement('textarea').setAttribute('aria-invalid', 'false');
    }
  }

  /**
   * Display generated results
   *
   * @private
   * @param {object} concept
   * @param {Array} directions
   */
  _displayResults(concept, directions) {
    // Update concept display in results
    if (this._getElement('conceptText')) {
      this._setElementText('conceptText', concept.concept);
    }

    if (this._getElement('characterCount')) {
      this._setElementText(
        'characterCount',
        `${concept.concept.length} characters`
      );
    }

    if (this._getElement('timestamp')) {
      this._setElementText('timestamp', new Date().toLocaleString());
    }

    // Display directions
    this._displayDirections(directions);

    // Update concept directions count
    const totalDirections =
      (concept.thematicDirections?.length || 0) + directions.length;
    if (this._getElement('conceptDirectionsCount')) {
      this._setElementText(
        'conceptDirectionsCount',
        totalDirections.toString()
      );
    }

    this._showResults();
  }

  /**
   * Display thematic directions
   *
   * @private
   * @param {Array} directions
   */
  _displayDirections(directions) {
    const container =
      this._getElement('directionsList') ||
      this._getElement('directionsResults');
    if (!container) return;

    if (!directions || directions.length === 0) {
      container.innerHTML =
        '<p class="no-directions">No directions generated</p>';
      return;
    }

    container.innerHTML = directions
      .map(
        (direction, index) => `
      <article class="direction-card" data-index="${index}">
        <header class="direction-header">
          <h3 class="direction-title">${DomUtils.escapeHtml(direction.title)}</h3>
          <span class="direction-number">#${index + 1}</span>
        </header>
        <p class="direction-description">
          ${DomUtils.escapeHtml(direction.description)}
        </p>
        ${this._renderThemes(direction.themes)}
        ${this._renderTone(direction.tone)}
        ${this._renderCoreTension(direction.coreTension)}
        ${this._renderUniqueTwist(direction.uniqueTwist)}
        ${this._renderNarrativePotential(direction.narrativePotential)}
      </article>
    `
      )
      .join('');
  }

  /**
   * Render themes list
   *
   * @private
   * @param {Array<string>} themes
   * @returns {string}
   */
  _renderThemes(themes) {
    if (!themes || themes.length === 0) return '';

    return `
      <div class="direction-themes">
        <span class="themes-label">Themes:</span>
        ${themes
          .map(
            (theme) =>
              `<span class="theme-tag">${DomUtils.escapeHtml(theme)}</span>`
          )
          .join('')}
      </div>
    `;
  }

  /**
   * Render tone
   *
   * @private
   * @param {string} tone
   * @returns {string}
   */
  _renderTone(tone) {
    if (!tone) return '';
    return `
      <div class="direction-tone">
        <strong>Tone:</strong> <span>${DomUtils.escapeHtml(tone)}</span>
      </div>
    `;
  }

  /**
   * Render core tension
   *
   * @private
   * @param {string} coreTension
   * @returns {string}
   */
  _renderCoreTension(coreTension) {
    if (!coreTension) return '';
    return `
      <div class="direction-tension">
        <strong>Core Tension:</strong> <span>${DomUtils.escapeHtml(coreTension)}</span>
      </div>
    `;
  }

  /**
   * Render unique twist
   *
   * @private
   * @param {string} uniqueTwist
   * @returns {string}
   */
  _renderUniqueTwist(uniqueTwist) {
    if (!uniqueTwist) return '';
    return `
      <div class="direction-twist">
        <strong>Unique Twist:</strong> <span>${DomUtils.escapeHtml(uniqueTwist)}</span>
      </div>
    `;
  }

  /**
   * Render narrative potential
   *
   * @private
   * @param {string} narrativePotential
   * @returns {string}
   */
  _renderNarrativePotential(narrativePotential) {
    if (!narrativePotential) return '';
    return `
      <div class="direction-potential">
        <strong>Narrative Potential:</strong> <span>${DomUtils.escapeHtml(narrativePotential)}</span>
      </div>
    `;
  }
}

export default ThematicDirectionController;
