/**
 * @file Traits generator controller for character building
 * @description Manages UI for traits generation with concept selection and user input
 * @see BaseCharacterBuilderController.js
 */

import { BaseCharacterBuilderController } from './BaseCharacterBuilderController.js';
import { DomUtils } from '../../utils/domUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('./BaseCharacterBuilderController.js').BaseCharacterBuilderController} BaseCharacterBuilderController
 * @typedef {import('../services/characterBuilderService.js').CharacterBuilderService} CharacterBuilderService
 * @typedef {import('../services/TraitsDisplayEnhancer.js').TraitsDisplayEnhancer} TraitsDisplayEnhancer
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../shared/characterBuilder/uiStateManager.js').UIStateManager} UIStateManager
 * @typedef {import('../models/thematicDirection.js').ThematicDirection} ThematicDirection
 * @typedef {import('../models/coreMotivation.js').CoreMotivation} CoreMotivation
 * @typedef {import('../models/trait.js').TraitData} TraitData
 */

/**
 * Controller for traits generator interface
 * Handles concept selection, user input validation, generation workflow, and results display
 */
export class TraitsGeneratorController extends BaseCharacterBuilderController {
  // Traits-specific dependencies
  /** @private @type {TraitsDisplayEnhancer} */
  #traitsDisplayEnhancer;

  // UI state
  /** @private @type {ThematicDirection|null} */
  #selectedDirection = null;

  /** @private @type {object|null} */
  #selectedConcept = null;

  /** @private @type {TraitData|null} */
  #lastGeneratedTraits = null;

  /** @private @type {Array<{direction: ThematicDirection, concept: object|null}>} */
  #eligibleDirections = [];

  /** @private @type {Array<CoreMotivation>} */
  #loadedCoreMotivations = [];

  /**
   * Create a new TraitsGeneratorController instance
   *
   * @param {object} dependencies - Service dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {CharacterBuilderService} dependencies.characterBuilderService - Character builder service
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event bus for dispatching events
   * @param {UIStateManager} dependencies.uiStateManager - UI state manager
   * @param {TraitsDisplayEnhancer} dependencies.traitsDisplayEnhancer - Traits display enhancer
   */
  constructor(dependencies) {
    super(dependencies);

    // Validate traits-specific dependencies
    validateDependency(
      dependencies.traitsDisplayEnhancer,
      'TraitsDisplayEnhancer',
      null,
      {
        requiredMethods: [
          'enhanceForDisplay',
          'generateExportFilename',
          'formatForExport',
        ],
      }
    );

    this.#traitsDisplayEnhancer = dependencies.traitsDisplayEnhancer;
  }

  /**
   * Cache DOM elements specific to traits generation
   *
   * @protected
   */
  _cacheElements() {
    this._cacheElementsFromMap({
      // Direction selector elements
      directionSelector: '#direction-selector',
      selectedDirectionDisplay: '#selected-direction-display',
      directionTitle: '#direction-title',
      directionDescription: '#direction-description',
      directionSelectorError: '#direction-selector-error',

      // User input elements
      coreMotivationInput: '#core-motivation-input',
      internalContradictionInput: '#internal-contradiction-input',
      centralQuestionInput: '#central-question-input',
      inputValidationError: '#input-validation-error',

      // Core motivations display (right panel)
      coreMotivationsPanel: '#core-motivations-panel',
      coreMotivationsList: '#core-motivations-list',
      userInputSummary: '#user-input-summary',

      // Buttons
      generateBtn: '#generate-btn',
      exportBtn: '#export-btn',
      clearBtn: '#clear-btn',
      backBtn: '#back-btn',

      // State containers
      emptyState: '#empty-state',
      loadingState: '#loading-state',
      resultsState: '#results-state',
      errorState: '#error-state',
      errorMessageText: '#error-message-text',

      // Results elements
      traitsResults: '#traits-results',
      loadingMessage: '#loading-message',

      // Accessibility elements
      screenReaderAnnouncement: {
        selector: '#screen-reader-announcement',
        required: false,
      },
    });
  }

  /**
   * Set up event listeners for traits generation UI
   *
   * @protected
   */
  _setupEventListeners() {
    // Direction selector change
    if (this._getElement('directionSelector')) {
      this._addEventListener('directionSelector', 'change', (e) => {
        Promise.resolve()
          .then(() => this.#handleDirectionSelection(e.target.value))
          .catch((error) => {
            this._handleServiceError(
              error,
              'select direction',
              'Failed to load direction data. Please try selecting another direction.'
            );
          });
      });
    }

    // User input validation on change
    this.#setupInputValidation();

    // Generate button click
    if (this._getElement('generateBtn')) {
      this._addEventListener('generateBtn', 'click', () => {
        this.#generateTraits();
      });
    }

    // Export button click
    if (this._getElement('exportBtn')) {
      this._addEventListener('exportBtn', 'click', () => {
        this.#exportToText();
      });
    }

    // Clear/reset button
    if (this._getElement('clearBtn')) {
      this._addEventListener('clearBtn', 'click', () => {
        this.#clearDirection();
      });
    }

    // Back button
    if (this._getElement('backBtn')) {
      this._addEventListener('backBtn', 'click', () => {
        window.location.href = 'index.html';
      });
    }

    // Setup keyboard shortcuts
    this.#setupKeyboardShortcuts();
  }

  /**
   * Load initial data for traits generation
   *
   * @protected
   */
  async _loadInitialData() {
    try {
      // Load eligible directions (with both clichés and core motivations)
      await this.#loadEligibleDirections();
      this.#populateDirectionSelector();

      // Check for direction pre-selection from URL
      this.#checkForPreselection();
    } catch (error) {
      this._handleServiceError(
        error,
        'load thematic directions',
        'Failed to load thematic directions. Please refresh the page.'
      );
    }
  }

  /**
   * Initialize UI state for traits generation
   *
   * @protected
   */
  async _initializeUIState() {
    await super._initializeUIState();

    // Set initial state based on selection
    if (this.#selectedDirection) {
      this._showState('empty');
      this.#updateUIState();
    } else {
      this._showState('empty');
      this.#updateGenerateButton(false);
    }
  }

  /**
   * Load thematic directions that have both clichés AND core motivations
   * Implements dual filtering requirement from specification
   *
   * @private
   */
  async #loadEligibleDirections() {
    try {
      // Get all thematic directions WITH concept data (matching core motivations generator)
      const allDirectionsWithConcepts =
        await this.characterBuilderService.getAllThematicDirectionsWithConcepts();

      // Filter out directions with invalid concepts
      const directionsWithValidConcepts = allDirectionsWithConcepts.filter(
        (item) => {
          // Concept must exist and have required properties
          if (!item.concept || typeof item.concept !== 'object') {
            this.logger.debug(
              `Filtering out direction ${item.direction.id}: missing or invalid concept`
            );
            return false;
          }

          // Concept must have id and concept text
          if (!item.concept.id || !item.concept.concept) {
            this.logger.debug(
              `Filtering out direction ${item.direction.id}: concept missing required fields`
            );
            return false;
          }

          return true;
        }
      );

      this.logger.debug(
        `Filtered ${allDirectionsWithConcepts.length - directionsWithValidConcepts.length} directions with invalid concepts`
      );

      // Filter for directions with clichés (using efficient existence check)
      const directionsWithCliches = [];
      for (const item of directionsWithValidConcepts) {
        try {
          const hasClichés =
            await this.characterBuilderService.hasClichesForDirection(
              item.direction.id
            );
          if (hasClichés) {
            directionsWithCliches.push(item);
          }
        } catch (error) {
          this.logger.debug(
            `No clichés found for direction ${item.direction.id}:`,
            error
          );
        }
      }

      // Filter for directions with core motivations
      this.#eligibleDirections = [];
      for (const item of directionsWithCliches) {
        try {
          const coreMotivations =
            await this.characterBuilderService.getCoreMotivationsByDirectionId(
              item.direction.id
            );
          if (coreMotivations && coreMotivations.length > 0) {
            // Store the full item with direction and concept data
            this.#eligibleDirections.push(item);
          }
        } catch (error) {
          this.logger.debug(
            `No core motivations found for direction ${item.direction.id}:`,
            error
          );
        }
      }

      this.logger.info(
        `Loaded ${this.#eligibleDirections.length} eligible directions with both clichés and core motivations`
      );
    } catch (error) {
      this.logger.error('Failed to load eligible directions:', error);
      throw error;
    }
  }

  /**
   * Populate direction selector with organized options
   *
   * @private
   */
  #populateDirectionSelector() {
    if (!this._getElement('directionSelector')) {
      this.logger.warn('Direction selector element not found');
      return;
    }

    const selector = this._getElement('directionSelector');

    // Show loading state
    selector.classList.add('loading');
    selector.disabled = true;

    try {
      // Clear existing options except the first (placeholder)
      while (selector.options.length > 1) {
        selector.remove(1);
      }

      if (this.#eligibleDirections.length === 0) {
        this.#showNoDirectionsMessage();
        return;
      }

      // Group directions by concept
      const directionsByConcept = this.#groupDirectionsByConcept(
        this.#eligibleDirections
      );

      // Add optgroups and options
      Object.entries(directionsByConcept).forEach(
        ([conceptName, directions]) => {
          if (directions.length === 1) {
            // Single direction - add directly
            const option = document.createElement('option');
            option.value = directions[0].id;
            option.textContent = `${conceptName}: ${this.#truncateText(directions[0].title, 60)}`;
            selector.appendChild(option);
          } else {
            // Multiple directions - use optgroup
            const optgroup = document.createElement('optgroup');
            optgroup.label = conceptName;

            directions.forEach((direction, index) => {
              const option = document.createElement('option');
              option.value = direction.id;
              option.textContent = `${index + 1}. ${this.#truncateText(direction.title, 50)}`;
              optgroup.appendChild(option);
            });

            selector.appendChild(optgroup);
          }
        }
      );

      this.logger.info(
        `Populated direction selector with ${this.#eligibleDirections.length} eligible directions`
      );
    } finally {
      selector.classList.remove('loading');
      selector.disabled = false;
    }
  }

  /**
   * Group directions by their concept
   *
   * @private
   * @param {Array<{direction: ThematicDirection, concept: object|null}>} items
   * @returns {object} Directions grouped by concept name
   */
  #groupDirectionsByConcept(items) {
    const groups = {};

    items.forEach((item) => {
      // Get concept name from the concept object, or use the conceptId as fallback
      const conceptName =
        item.concept?.name || item.direction.concept || 'Unknown Concept';
      if (!groups[conceptName]) {
        groups[conceptName] = [];
      }
      groups[conceptName].push(item.direction);
    });

    // Sort directions within each group by creation date (newest first)
    Object.values(groups).forEach((groupDirections) => {
      groupDirections.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    });

    return groups;
  }

  /**
   * Handle direction selection and load associated data
   *
   * @private
   * @param {string} directionId
   */
  async #handleDirectionSelection(directionId) {
    if (!directionId) {
      this.#clearDirection();
      return;
    }

    try {
      await this.#selectDirection(directionId);
    } catch (error) {
      this._handleServiceError(
        error,
        'select direction',
        'Failed to load direction data. Please try selecting another direction.'
      );
    }
  }

  /**
   * Select a direction by ID and load associated core motivations
   *
   * @private
   * @param {string} directionId
   */
  async #selectDirection(directionId) {
    const item = this.#eligibleDirections.find(
      (item) => item.direction.id === directionId
    );

    if (!item) {
      this.logger.warn(`Direction not found: ${directionId}`);
      this.#showDirectionError('Selected direction not found');
      return;
    }

    // Set selected direction and concept
    this.#selectedDirection = item.direction;
    this.#selectedConcept = item.concept;

    // Display selected direction
    this.#displaySelectedDirection(item.direction);

    // Load and display core motivations
    await this.#loadAndDisplayCoreMotivations(directionId);

    // Clear previous user inputs
    this.#clearUserInputs();

    // Update UI state
    this.#updateUIState();

    // Clear any previous errors
    this.#clearDirectionError();

    this.logger.debug(`Selected direction: ${item.direction.title}`);
  }

  /**
   * Display the selected direction information
   *
   * @private
   * @param {ThematicDirection} direction
   */
  #displaySelectedDirection(direction) {
    if (this._getElement('selectedDirectionDisplay')) {
      this._getElement('selectedDirectionDisplay').style.display = 'block';
    }

    if (this._getElement('directionTitle')) {
      this._setElementText('directionTitle', direction.title);
    }

    if (this._getElement('directionDescription')) {
      this._setElementText('directionDescription', direction.description);
    }

    // Scroll into view
    if (this._getElement('selectedDirectionDisplay')) {
      this._getElement('selectedDirectionDisplay').scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }

  /**
   * Load and display core motivations for selected direction
   *
   * @private
   * @param {string} directionId
   */
  async #loadAndDisplayCoreMotivations(directionId) {
    try {
      this.#loadedCoreMotivations =
        await this.characterBuilderService.getCoreMotivationsByDirectionId(
          directionId
        );
      this.#displayCoreMotivations(this.#loadedCoreMotivations);
    } catch (error) {
      this.logger.error('Failed to load core motivations:', error);
      this.#displayCoreMotivationsError();
    }
  }

  /**
   * Display core motivations in the right panel (read-only)
   *
   * @private
   * @param {Array<CoreMotivation>} coreMotivations
   */
  #displayCoreMotivations(coreMotivations) {
    if (!this._getElement('coreMotivationsList')) {
      return;
    }

    const container = this._getElement('coreMotivationsList');

    if (!coreMotivations || coreMotivations.length === 0) {
      container.innerHTML =
        '<p class="no-motivations">No core motivations available</p>';
      return;
    }

    container.innerHTML = coreMotivations
      .map(
        (motivation, index) => `
      <div class="core-motivation-item" data-index="${index}">
        <h4 class="motivation-title">Core Motivation ${index + 1}</h4>
        <p class="motivation-text">${DomUtils.escapeHtml(motivation.coreDesire)}</p>
        <div class="motivation-details">
          <div class="internal-contradiction">
            <strong>Internal Contradiction:</strong>
            <span>${DomUtils.escapeHtml(motivation.internalContradiction)}</span>
          </div>
          <div class="central-question">
            <strong>Central Question:</strong>
            <span>${DomUtils.escapeHtml(motivation.centralQuestion)}</span>
          </div>
        </div>
      </div>
    `
      )
      .join('');

    // Show the panel
    if (this._getElement('coreMotivationsPanel')) {
      this._getElement('coreMotivationsPanel').style.display = 'block';
    }
  }

  /**
   * Display error message for core motivations loading
   *
   * @private
   */
  #displayCoreMotivationsError() {
    if (this._getElement('coreMotivationsList')) {
      this._getElement('coreMotivationsList').innerHTML =
        '<p class="error-message">Failed to load core motivations</p>';
    }
  }

  /**
   * Clear direction selection and reset form
   *
   * @private
   */
  #clearDirection() {
    // Clear selection state
    this.#selectedDirection = null;
    this.#selectedConcept = null;
    this.#loadedCoreMotivations = [];

    // Clear UI elements
    if (this._getElement('directionSelector')) {
      this._getElement('directionSelector').value = '';
    }

    if (this._getElement('selectedDirectionDisplay')) {
      this._getElement('selectedDirectionDisplay').style.display = 'none';
    }

    if (this._getElement('coreMotivationsPanel')) {
      this._getElement('coreMotivationsPanel').style.display = 'none';
    }

    // Clear user inputs
    this.#clearUserInputs();

    // Update UI state
    this.#updateUIState();

    // Clear errors
    this.#clearDirectionError();
    this.#clearInputValidationError();

    this.logger.debug('Cleared direction selection');
  }

  /**
   * Clear all user input fields
   *
   * @private
   */
  #clearUserInputs() {
    const inputs = [
      'coreMotivationInput',
      'internalContradictionInput',
      'centralQuestionInput',
    ];

    inputs.forEach((inputId) => {
      if (this._getElement(inputId)) {
        this._getElement(inputId).value = '';
      }
    });

    this.#updateUserInputSummary();
  }

  /**
   * Setup input validation for user input fields
   *
   * @private
   */
  #setupInputValidation() {
    const inputs = [
      'coreMotivationInput',
      'internalContradictionInput',
      'centralQuestionInput',
    ];

    inputs.forEach((inputId) => {
      if (this._getElement(inputId)) {
        this._addEventListener(inputId, 'input', () => {
          this.#updateUserInputs();
          this.#validateUserInputs();
          this.#updateUIState();
          this.#updateUserInputSummary();
        });

        this._addEventListener(inputId, 'blur', () => {
          this.#validateUserInputs();
        });
      }
    });
  }

  /**
   * Update user inputs object from form fields
   *
   * @private
   */
  #updateUserInputs() {
    // This method is called when input values change
    // We don't need to store values since #getUserInputs() gets them directly from DOM
  }

  /**
   * Validate all required user input fields
   *
   * @private
   * @returns {boolean} True if all inputs valid
   */
  #validateUserInputs() {
    if (!this.#selectedDirection) {
      return false;
    }

    const inputs = this.#getUserInputs();
    const validationResults = {
      isValid: true,
      errors: [],
    };

    // Validate each required field
    if (!inputs.coreMotivation || inputs.coreMotivation.trim().length < 10) {
      validationResults.isValid = false;
      validationResults.errors.push(
        'Core motivation must be at least 10 characters'
      );
    }

    if (
      !inputs.internalContradiction ||
      inputs.internalContradiction.trim().length < 10
    ) {
      validationResults.isValid = false;
      validationResults.errors.push(
        'Internal contradiction must be at least 10 characters'
      );
    }

    if (!inputs.centralQuestion || inputs.centralQuestion.trim().length < 10) {
      validationResults.isValid = false;
      validationResults.errors.push(
        'Central question must be at least 10 characters'
      );
    }

    // Show validation errors
    if (!validationResults.isValid) {
      this.#showInputValidationError(validationResults.errors);
    } else {
      this.#clearInputValidationError();
    }

    return validationResults.isValid;
  }

  /**
   * Get user input values from form fields
   *
   * @private
   * @returns {object} User input values
   */
  #getUserInputs() {
    return {
      coreMotivation: this.#getCoreMotivationInput(),
      internalContradiction: this.#getInternalContradictionInput(),
      centralQuestion: this.#getCentralQuestionInput(),
    };
  }

  /**
   * Get core motivation input value
   *
   * @private
   * @returns {string}
   */
  #getCoreMotivationInput() {
    return this._getElement('coreMotivationInput')?.value?.trim() || '';
  }

  /**
   * Get internal contradiction input value
   *
   * @private
   * @returns {string}
   */
  #getInternalContradictionInput() {
    return this._getElement('internalContradictionInput')?.value?.trim() || '';
  }

  /**
   * Get central question input value
   *
   * @private
   * @returns {string}
   */
  #getCentralQuestionInput() {
    return this._getElement('centralQuestionInput')?.value?.trim() || '';
  }

  /**
   * Update user input summary in right panel
   *
   * @private
   */
  #updateUserInputSummary() {
    if (!this._getElement('userInputSummary')) {
      return;
    }

    const inputs = this.#getUserInputs();
    const container = this._getElement('userInputSummary');

    if (
      !inputs.coreMotivation &&
      !inputs.internalContradiction &&
      !inputs.centralQuestion
    ) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    container.innerHTML = `
      <div class="user-input-summary">
        <h4>Your Inputs</h4>
        ${
          inputs.coreMotivation
            ? `
          <div class="input-item">
            <strong>Core Motivation:</strong>
            <p>${DomUtils.escapeHtml(inputs.coreMotivation)}</p>
          </div>
        `
            : ''
        }
        ${
          inputs.internalContradiction
            ? `
          <div class="input-item">
            <strong>Internal Contradiction:</strong>
            <p>${DomUtils.escapeHtml(inputs.internalContradiction)}</p>
          </div>
        `
            : ''
        }
        ${
          inputs.centralQuestion
            ? `
          <div class="input-item">
            <strong>Central Question:</strong>
            <p>${DomUtils.escapeHtml(inputs.centralQuestion)}</p>
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  /**
   * Main traits generation workflow
   *
   * @private
   */
  async #generateTraits() {
    try {
      // Validate direction selection
      if (!this.#selectedDirection) {
        this.#showDirectionError('Please select a thematic direction first');
        return;
      }

      // Validate user inputs
      if (!this.#validateUserInputs()) {
        this.#announceToScreenReader(
          'Please fix validation errors before generating traits'
        );
        return;
      }

      // Show loading state
      this.#showLoadingState(true, 'Generating character traits...');
      this.#clearInputValidationError();

      // Prepare generation parameters
      const clicheData =
        await this.characterBuilderService.getClichesByDirectionId(
          this.#selectedDirection.id
        );

      // Pass cliche data as-is (object format) to TraitsGenerator
      // If no cliches found, pass null to trigger proper validation
      const cliches = clicheData || null;

      const params = {
        concept: this.#selectedConcept,
        direction: this.#selectedDirection,
        userInputs: this.#getUserInputs(),
        cliches: cliches,
      };

      // Call generation service
      this.logger.debug('Starting traits generation with params:', params);
      const traits = await this._executeWithErrorHandling(
        () => this.characterBuilderService.generateTraits(params),
        'generate character traits',
        {
          userErrorMessage:
            'Failed to generate character traits. Please try again.',
          retries: 2,
          retryDelay: 1000,
        }
      );

      // Store results
      this.#lastGeneratedTraits = traits;

      // Process and display results
      await this.#displayResults(traits);

      // Update UI state and enable export
      this.#updateUIState();

      // Announce success to screen readers
      this.#announceToScreenReader('Character traits generated successfully');

      // Dispatch success event
      this.eventBus.dispatch('core:traits_generated', {
        directionId: this.#selectedDirection.id,
        success: true,
        traitsCount: this.#getTraitsCount(traits),
      });

      this.logger.info('Traits generation completed successfully');
    } catch (error) {
      this.logger.error('Traits generation failed:', error);
      this.#handleGenerationError(error);
    }
  }

  /**
   * Display generated traits results
   *
   * @private
   * @param {TraitData} traits
   */
  async #displayResults(traits) {
    try {
      // Enhance traits for display
      const enhancedTraits = this.#traitsDisplayEnhancer.enhanceForDisplay(
        traits,
        {
          includeMetadata: false,
          expandStructuredData: true,
        }
      );

      // Render results
      this.#renderTraitsResults(enhancedTraits);

      // Show results state
      this._showState('results');

      // Scroll to results
      setTimeout(() => {
        if (this._getElement('traitsResults')) {
          this._getElement('traitsResults').scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      }, 100);
    } catch (error) {
      this.logger.error('Failed to display results:', error);
      throw error;
    }
  }

  /**
   * Render complete traits results for all categories
   *
   * @private
   * @param {object} enhancedTraits
   */
  #renderTraitsResults(enhancedTraits) {
    const container = this._getElement('traitsResults');
    if (!container) {
      this.logger.warn('Traits results container not found');
      return;
    }

    container.innerHTML = `
      <div class="traits-results-container">
        <header class="results-header">
          <h2>Generated Character Traits</h2>
          <p class="results-subtitle">Based on: ${DomUtils.escapeHtml(this.#selectedDirection.title)}</p>
        </header>
        
        <div class="traits-categories">
          ${this.#renderNames(enhancedTraits.names)}
          ${this.#renderPhysicalDescription(enhancedTraits.physicalDescription)}
          ${this.#renderPersonality(enhancedTraits.personality)}
          ${this.#renderStrengthsWeaknesses(enhancedTraits.strengths, enhancedTraits.weaknesses)}
          ${this.#renderLikesDisclikes(enhancedTraits.likes, enhancedTraits.dislikes)}
          ${this.#renderFears(enhancedTraits.fears)}
          ${this.#renderGoals(enhancedTraits.goals)}
          ${this.#renderNotes(enhancedTraits.notes)}
          ${this.#renderProfile(enhancedTraits.profile)}
          ${this.#renderSecrets(enhancedTraits.secrets)}
          ${this.#renderUserInputSummaryResults(this.#getUserInputs())}
        </div>
      </div>
    `;
  }

  /**
   * Render names with justifications
   *
   * @private
   * @param {Array} names
   * @returns {string}
   */
  #renderNames(names) {
    if (!names || !Array.isArray(names)) return '';

    return `
      <section class="trait-category names-category">
        <h3>Character Names</h3>
        <div class="names-list">
          ${names
            .map(
              (nameItem, index) => `
            <div class="name-item" data-index="${index}">
              <h4 class="name-value">${DomUtils.escapeHtml(nameItem.name || nameItem)}</h4>
              ${
                nameItem.justification
                  ? `
                <p class="name-justification">${DomUtils.escapeHtml(nameItem.justification)}</p>
              `
                  : ''
              }
            </div>
          `
            )
            .join('')}
        </div>
      </section>
    `;
  }

  /**
   * Render physical description
   *
   * @private
   * @param {string} physicalDescription
   * @returns {string}
   */
  #renderPhysicalDescription(physicalDescription) {
    if (!physicalDescription) return '';

    return `
      <section class="trait-category physical-description-category">
        <h3>Physical Description</h3>
        <p class="physical-description">${DomUtils.escapeHtml(physicalDescription)}</p>
      </section>
    `;
  }

  /**
   * Render personality traits with explanations
   *
   * @private
   * @param {Array} personality
   * @returns {string}
   */
  #renderPersonality(personality) {
    if (!personality || !Array.isArray(personality)) return '';

    return `
      <section class="trait-category personality-category">
        <h3>Personality Traits</h3>
        <div class="personality-list">
          ${personality
            .map(
              (traitItem, index) => `
            <div class="personality-item" data-index="${index}">
              <h4 class="trait-name">${DomUtils.escapeHtml(traitItem.trait || traitItem)}</h4>
              ${
                traitItem.explanation
                  ? `
                <p class="trait-explanation">${DomUtils.escapeHtml(traitItem.explanation)}</p>
              `
                  : ''
              }
            </div>
          `
            )
            .join('')}
        </div>
      </section>
    `;
  }

  /**
   * Render strengths and weaknesses
   *
   * @private
   * @param {Array} strengths
   * @param {Array} weaknesses
   * @returns {string}
   */
  #renderStrengthsWeaknesses(strengths, weaknesses) {
    if (!strengths && !weaknesses) return '';

    return `
      <section class="trait-category strengths-weaknesses-category">
        <div class="two-column-layout">
          ${
            strengths && strengths.length > 0
              ? `
            <div class="strengths-column">
              <h3>Strengths</h3>
              <ul class="strengths-list">
                ${strengths
                  .map(
                    (strength) => `
                  <li class="strength-item">${DomUtils.escapeHtml(strength)}</li>
                `
                  )
                  .join('')}
              </ul>
            </div>
          `
              : ''
          }
          ${
            weaknesses && weaknesses.length > 0
              ? `
            <div class="weaknesses-column">
              <h3>Weaknesses</h3>
              <ul class="weaknesses-list">
                ${weaknesses
                  .map(
                    (weakness) => `
                  <li class="weakness-item">${DomUtils.escapeHtml(weakness)}</li>
                `
                  )
                  .join('')}
              </ul>
            </div>
          `
              : ''
          }
        </div>
      </section>
    `;
  }

  /**
   * Render likes and dislikes
   *
   * @private
   * @param {Array} likes
   * @param {Array} dislikes
   * @returns {string}
   */
  #renderLikesDisclikes(likes, dislikes) {
    if (!likes && !dislikes) return '';

    return `
      <section class="trait-category likes-dislikes-category">
        <div class="two-column-layout">
          ${
            likes && likes.length > 0
              ? `
            <div class="likes-column">
              <h3>Likes</h3>
              <ul class="likes-list">
                ${likes
                  .map(
                    (like) => `
                  <li class="like-item">${DomUtils.escapeHtml(like)}</li>
                `
                  )
                  .join('')}
              </ul>
            </div>
          `
              : ''
          }
          ${
            dislikes && dislikes.length > 0
              ? `
            <div class="dislikes-column">
              <h3>Dislikes</h3>
              <ul class="dislikes-list">
                ${dislikes
                  .map(
                    (dislike) => `
                  <li class="dislike-item">${DomUtils.escapeHtml(dislike)}</li>
                `
                  )
                  .join('')}
              </ul>
            </div>
          `
              : ''
          }
        </div>
      </section>
    `;
  }

  /**
   * Render character fears
   *
   * @private
   * @param {Array} fears
   * @returns {string}
   */
  #renderFears(fears) {
    if (!fears || !Array.isArray(fears) || fears.length === 0) return '';

    return `
      <section class="trait-category fears-category">
        <h3>Fears</h3>
        <ul class="fears-list">
          ${fears
            .map(
              (fear) => `
            <li class="fear-item">${DomUtils.escapeHtml(fear)}</li>
          `
            )
            .join('')}
        </ul>
      </section>
    `;
  }

  /**
   * Render character goals
   *
   * @private
   * @param {object} goals
   * @returns {string}
   */
  #renderGoals(goals) {
    if (!goals) return '';

    return `
      <section class="trait-category goals-category">
        <h3>Goals</h3>
        ${
          goals.shortTerm && goals.shortTerm.length > 0
            ? `
          <div class="short-term-goals">
            <h4>Short-term Goals</h4>
            <ul class="short-term-goals-list">
              ${goals.shortTerm
                .map(
                  (goal) => `
                <li class="short-term-goal">${DomUtils.escapeHtml(goal)}</li>
              `
                )
                .join('')}
            </ul>
          </div>
        `
            : ''
        }
        ${
          goals.longTerm
            ? `
          <div class="long-term-goals">
            <h4>Long-term Goal</h4>
            <p class="long-term-goal">${DomUtils.escapeHtml(goals.longTerm)}</p>
          </div>
        `
            : ''
        }
      </section>
    `;
  }

  /**
   * Render additional notes
   *
   * @private
   * @param {Array} notes
   * @returns {string}
   */
  #renderNotes(notes) {
    if (!notes || !Array.isArray(notes) || notes.length === 0) return '';

    return `
      <section class="trait-category notes-category">
        <h3>Additional Notes</h3>
        <ul class="notes-list">
          ${notes
            .map(
              (note) => `
            <li class="note-item">${DomUtils.escapeHtml(note)}</li>
          `
            )
            .join('')}
        </ul>
      </section>
    `;
  }

  /**
   * Render character profile
   *
   * @private
   * @param {string} profile
   * @returns {string}
   */
  #renderProfile(profile) {
    if (!profile) return '';

    return `
      <section class="trait-category profile-category">
        <h3>Character Profile</h3>
        <p class="character-profile">${DomUtils.escapeHtml(profile)}</p>
      </section>
    `;
  }

  /**
   * Render character secrets
   *
   * @private
   * @param {Array} secrets
   * @returns {string}
   */
  #renderSecrets(secrets) {
    if (!secrets || !Array.isArray(secrets) || secrets.length === 0) return '';

    return `
      <section class="trait-category secrets-category">
        <h3>Character Secrets</h3>
        <ul class="secrets-list">
          ${secrets
            .map(
              (secret) => `
            <li class="secret-item">${DomUtils.escapeHtml(secret)}</li>
          `
            )
            .join('')}
        </ul>
      </section>
    `;
  }

  /**
   * Render user input summary in results
   *
   * @private
   * @param {object} userInputs
   * @returns {string}
   */
  #renderUserInputSummaryResults(userInputs) {
    if (
      !userInputs ||
      (!userInputs.coreMotivation &&
        !userInputs.internalContradiction &&
        !userInputs.centralQuestion)
    ) {
      return '';
    }

    return `
      <section class="trait-category user-inputs-category">
        <h3>Based on Your Inputs</h3>
        <div class="user-inputs-summary">
          ${
            userInputs.coreMotivation
              ? `
            <div class="input-summary-item">
              <h4>Core Motivation</h4>
              <p>${DomUtils.escapeHtml(userInputs.coreMotivation)}</p>
            </div>
          `
              : ''
          }
          ${
            userInputs.internalContradiction
              ? `
            <div class="input-summary-item">
              <h4>Internal Contradiction</h4>
              <p>${DomUtils.escapeHtml(userInputs.internalContradiction)}</p>
            </div>
          `
              : ''
          }
          ${
            userInputs.centralQuestion
              ? `
            <div class="input-summary-item">
              <h4>Central Question</h4>
              <p>${DomUtils.escapeHtml(userInputs.centralQuestion)}</p>
            </div>
          `
              : ''
          }
        </div>
      </section>
    `;
  }

  /**
   * Export traits to text file
   *
   * @private
   */
  #exportToText() {
    if (!this.#lastGeneratedTraits) {
      this.logger.warn('No traits available for export');
      this.#announceToScreenReader('No traits available to export');
      return;
    }

    try {
      // Format traits for export
      const exportText = this.#traitsDisplayEnhancer.formatForExport(
        this.#lastGeneratedTraits,
        {
          includeUserInputs: this.#getUserInputs(),
          includeDirection: this.#selectedDirection,
          includeTimestamp: true,
        }
      );

      // Generate filename
      const filename = this.#traitsDisplayEnhancer.generateExportFilename(
        this.#selectedDirection.title
      );

      // Create and download file
      this.#downloadTextFile(exportText, filename);

      // Announce success
      this.#announceToScreenReader(`Traits exported to ${filename}`);

      this.logger.info('Traits exported successfully:', filename);
    } catch (error) {
      this.logger.error('Export failed:', error);
      this.#announceToScreenReader('Export failed. Please try again.');
    }
  }

  /**
   * Download text content as file
   *
   * @private
   * @param {string} content
   * @param {string} filename
   */
  #downloadTextFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up URL object
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Setup keyboard shortcuts
   *
   * @private
   */
  #setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Enter: Generate traits
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (this.#selectedDirection && this.#validateUserInputs()) {
          this.#generateTraits();
        }
      }

      // Ctrl+E: Export to text
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        if (this.#lastGeneratedTraits) {
          this.#exportToText();
        }
      }

      // Ctrl+Shift+Del: Clear all
      if (e.ctrlKey && e.shiftKey && e.key === 'Delete') {
        e.preventDefault();
        this.#clearDirection();
      }
    });
  }

  /**
   * Update UI state based on current conditions
   *
   * @private
   */
  #updateUIState() {
    const hasDirection = this.#selectedDirection !== null;
    const hasValidInputs = this.#validateUserInputs();
    const hasResults = this.#lastGeneratedTraits !== null;

    // Enable/disable generate button
    this.#updateGenerateButton(hasDirection && hasValidInputs);

    // Show/hide export button
    if (this._getElement('exportBtn')) {
      this._getElement('exportBtn').style.display = hasResults
        ? 'inline-block'
        : 'none';
    }
  }

  /**
   * Update generate button state
   *
   * @private
   * @param {boolean} enabled
   */
  #updateGenerateButton(enabled) {
    if (this._getElement('generateBtn')) {
      this._getElement('generateBtn').disabled = !enabled;
      this._getElement('generateBtn').setAttribute(
        'aria-disabled',
        !enabled ? 'true' : 'false'
      );
    }
  }

  /**
   * Show loading state with message
   *
   * @private
   * @param {boolean} show
   * @param {string} message
   */
  #showLoadingState(show, message = 'Loading...') {
    if (show) {
      this._showState('loading');
      if (this._getElement('loadingMessage')) {
        this._setElementText('loadingMessage', message);
      }

      // Disable form inputs during generation
      this.#setFormInputsEnabled(false);
    } else {
      this.#setFormInputsEnabled(true);
    }
  }

  /**
   * Enable/disable form inputs
   *
   * @private
   * @param {boolean} enabled
   */
  #setFormInputsEnabled(enabled) {
    const inputs = [
      'directionSelector',
      'coreMotivationInput',
      'internalContradictionInput',
      'centralQuestionInput',
      'generateBtn',
      'clearBtn',
    ];

    inputs.forEach((inputId) => {
      const element = this._getElement(inputId);
      if (element) {
        element.disabled = !enabled;
      }
    });
  }

  /**
   * Show message when no directions are available
   *
   * @private
   */
  #showNoDirectionsMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'no-directions-message';
    messageDiv.innerHTML = `
      <h3>No Eligible Directions Available</h3>
      <p>You need thematic directions with both clichés and core motivations to generate traits.</p>
      <div class="directions-help">
        <p>To create eligible directions:</p>
        <ol>
          <li><a href="thematic-direction-generator.html" class="cb-button-secondary">Generate thematic directions</a></li>
          <li><a href="cliches-generator.html" class="cb-button-secondary">Create clichés for your directions</a></li>
          <li><a href="core-motivations-generator.html" class="cb-button-secondary">Generate core motivations</a></li>
        </ol>
      </div>
    `;

    // Insert after the direction selector
    if (this._getElement('directionSelector')) {
      const formGroup =
        this._getElement('directionSelector').closest('.cb-form-group');
      if (formGroup) {
        formGroup.insertAdjacentElement('afterend', messageDiv);
      }

      // Disable form
      this._getElement('directionSelector').disabled = true;
      this.#updateGenerateButton(false);
    }
  }

  /**
   * Check URL for direction pre-selection
   *
   * @private
   */
  #checkForPreselection() {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const directionId = urlParams.get('directionId');

    if (
      directionId &&
      this.#eligibleDirections.some((item) => item.direction.id === directionId)
    ) {
      this.#selectDirection(directionId);

      // Update selector if element exists
      if (this._getElement('directionSelector')) {
        this._getElement('directionSelector').value = directionId;
      }
    }
  }

  /**
   * Show direction selection error
   *
   * @private
   * @param {string} message
   */
  #showDirectionError(message) {
    if (this._getElement('directionSelectorError')) {
      this._setElementText('directionSelectorError', message);
      this._addElementClass('directionSelector', 'error');
    }
  }

  /**
   * Clear direction selection error
   *
   * @private
   */
  #clearDirectionError() {
    if (this._getElement('directionSelectorError')) {
      this._setElementText('directionSelectorError', '');
      this._removeElementClass('directionSelector', 'error');
    }
  }

  /**
   * Show input validation error
   *
   * @private
   * @param {Array<string>} errors
   */
  #showInputValidationError(errors) {
    if (this._getElement('inputValidationError')) {
      const errorText = errors.join('. ') + '.';
      this._setElementText('inputValidationError', errorText);
    }
  }

  /**
   * Clear input validation error
   *
   * @private
   */
  #clearInputValidationError() {
    if (this._getElement('inputValidationError')) {
      this._setElementText('inputValidationError', '');
    }
  }

  /**
   * Handle generation errors with user-friendly messages
   *
   * @private
   * @param {Error} error
   */
  #handleGenerationError(error) {
    this.logger.error('Traits generation failed:', error);

    // Hide loading state
    this.#showLoadingState(false);

    // Show user-friendly error message
    let userMessage = 'Failed to generate character traits. Please try again.';

    if (
      error.message.includes('network') ||
      error.message.includes('timeout')
    ) {
      userMessage =
        'Network error occurred. Please check your connection and try again.';
    } else if (error.message.includes('validation')) {
      userMessage =
        'Invalid input provided. Please check your entries and try again.';
    }

    this._showError(userMessage, {
      showRetry: true,
      showClear: true,
    });

    // Announce error to screen readers
    this.#announceToScreenReader('Generation failed: ' + userMessage);

    // Dispatch error event
    this.eventBus.dispatch('core:traits_generation_failed', {
      directionId: this.#selectedDirection?.id,
      error: error.message,
    });
  }

  /**
   * Announce messages to screen readers
   *
   * @private
   * @param {string} message
   */
  #announceToScreenReader(message) {
    if (this._getElement('screenReaderAnnouncement')) {
      const announcement = this._getElement('screenReaderAnnouncement');
      announcement.textContent = message;

      // Clear after a short delay
      setTimeout(() => {
        announcement.textContent = '';
      }, 1000);
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
  #truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Count total traits for analytics
   *
   * @private
   * @param {TraitData} traits
   * @returns {number}
   */
  #getTraitsCount(traits) {
    if (!traits) return 0;

    let count = 0;
    if (traits.names)
      count += Array.isArray(traits.names) ? traits.names.length : 1;
    if (traits.personality)
      count += Array.isArray(traits.personality)
        ? traits.personality.length
        : 1;
    if (traits.strengths)
      count += Array.isArray(traits.strengths) ? traits.strengths.length : 1;
    if (traits.weaknesses)
      count += Array.isArray(traits.weaknesses) ? traits.weaknesses.length : 1;
    if (traits.likes)
      count += Array.isArray(traits.likes) ? traits.likes.length : 1;
    if (traits.dislikes)
      count += Array.isArray(traits.dislikes) ? traits.dislikes.length : 1;
    if (traits.fears)
      count += Array.isArray(traits.fears) ? traits.fears.length : 1;
    if (traits.notes)
      count += Array.isArray(traits.notes) ? traits.notes.length : 1;
    if (traits.secrets)
      count += Array.isArray(traits.secrets) ? traits.secrets.length : 1;

    return count;
  }
}

export default TraitsGeneratorController;
