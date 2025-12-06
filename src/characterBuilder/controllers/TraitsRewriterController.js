/**
 * @file TraitsRewriterController - Complete controller for trait rewriting functionality
 * @description Manages the UI workflow for character trait rewriting, integrating
 * TraitsRewriterGenerator and TraitsRewriterDisplayEnhancer services
 * @see BaseCharacterBuilderController.js
 */

import { BaseCharacterBuilderController } from './BaseCharacterBuilderController.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { CHARACTER_BUILDER_EVENTS } from '../services/characterBuilderService.js';
import { TraitsRewriterError } from '../errors/TraitsRewriterError.js';

/**
 * @typedef {import('./BaseCharacterBuilderController.js').BaseCharacterBuilderController} BaseCharacterBuilderController
 * @typedef {import('../services/characterBuilderService.js').CharacterBuilderService} CharacterBuilderService
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../services/TraitsRewriterGenerator.js').TraitsRewriterGenerator} TraitsRewriterGenerator
 * @typedef {import('../services/TraitsRewriterDisplayEnhancer.js').TraitsRewriterDisplayEnhancer} TraitsRewriterDisplayEnhancer
 */

/**
 * Complete controller implementation for trait rewriting functionality
 * Manages the full workflow from character input to trait display and export
 */
export class TraitsRewriterController extends BaseCharacterBuilderController {
  // Private fields following codebase patterns
  /** @private @type {TraitsRewriterGenerator} */
  #traitsRewriterGenerator;

  /** @private @type {TraitsRewriterDisplayEnhancer} */
  #traitsRewriterDisplayEnhancer;

  /** @private @type {object|null} */
  #lastGeneratedTraits = null;

  /** @private @type {object|null} */
  #currentCharacterDefinition = null;

  /** @private @type {boolean} */
  #isGenerating = false;

  /**
   * Constructor with full dependency validation
   *
   * @param {object} dependencies - Service dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {CharacterBuilderService} dependencies.characterBuilderService - Character builder service
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event bus for dispatching events
   * @param {ISchemaValidator} dependencies.schemaValidator - Schema validator
   * @param {TraitsRewriterGenerator} dependencies.traitsRewriterGenerator - Traits rewriter generation service
   * @param {TraitsRewriterDisplayEnhancer} dependencies.traitsRewriterDisplayEnhancer - Traits display enhancement service
   */
  constructor(dependencies) {
    // Call parent constructor with core dependencies
    super(dependencies);

    // Validate traits-specific dependencies
    this.#validateTraitsRewriterDependencies(dependencies);

    this.#traitsRewriterGenerator = dependencies.traitsRewriterGenerator;
    this.#traitsRewriterDisplayEnhancer =
      dependencies.traitsRewriterDisplayEnhancer;

    // Logger call moved to _loadInitialData to avoid constructor timing issues
  }

  /**
   * Load initial data and setup UI state
   *
   * @protected
   * @returns {Promise<void>}
   */
  async _loadInitialData() {
    this.logger.info(
      'TraitsRewriterController: Complete implementation initialized'
    );
    this.logger.debug('TraitsRewriterController: Loading initial data');

    // Subscribe to generation events
    this.#subscribeToGenerationEvents();
  }

  /**
   * Cache all required DOM elements
   *
   * @protected
   */
  _cacheElements() {
    // Logger call moved to avoid test initialization issues

    this._cacheElementsFromMap({
      // Character input elements
      characterDefinition: '#character-definition',
      characterInputError: '#character-input-error',

      // Control buttons
      rewriteTraitsButton: '#rewrite-traits-button',
      exportJsonButton: '#export-json-button',
      exportTextButton: '#export-text-button',
      copyTraitsButton: '#copy-traits-button',
      clearInputButton: '#clear-input-button',
      retryButton: '#retry-button',

      // State containers
      generationProgress: '#generation-progress',
      rewrittenTraitsContainer: '#rewritten-traits-container',
      generationError: '#generation-error',
      emptyState: '#empty-state',

      // UI State Manager required elements
      loadingState: '#loading-state',
      resultsState: '#results-state',
      errorState: '#error-state',

      // Display elements
      characterNameDisplay: '#character-name-display',
      traitsSections: '#traits-sections',
      progressText: {
        selector: '.progress-text',
        required: false,
      },
      errorMessage: {
        selector: '.error-message',
        required: false,
      },

      // Optional elements for accessibility
      screenReaderAnnouncement: {
        selector: '#screen-reader-announcement',
        required: false,
      },
    });
  }

  /**
   * Initialize UI state for traits rewriting
   *
   * @protected
   * @returns {Promise<void>}
   */
  async _initializeUIState() {
    // Call parent implementation to initialize UIStateManager
    await super._initializeUIState();

    // Initialize UI with empty state (after UIStateManager is ready)
    this._showState('empty');
  }

  /**
   * Setup event listeners for UI interactions
   *
   * @protected
   */
  _setupEventListeners() {
    // Logger call moved to avoid test initialization issues

    // Character input validation
    this.#setupCharacterInputHandling();

    // Control button handlers
    this.#setupControlButtons();

    // Export functionality
    this.#setupExportHandling();
  }

  /**
   * Setup character input validation and handling
   *
   * @private
   */
  #setupCharacterInputHandling() {
    const inputElement = this._getElement('characterDefinition');
    if (inputElement) {
      // Create debounced validation handler
      // Uses AsyncUtilitiesToolkit for proper timer lifecycle management
      const debouncedInputHandler = this._getAsyncUtilitiesToolkit().debounce(
        this.#handleCharacterInput.bind(this),
        500,
        { trailing: true } // Execute validation after user stops typing
      );

      // Real-time validation on input with debouncing
      this._addEventListener(
        'characterDefinition',
        'input',
        debouncedInputHandler
      );

      // Validation on blur
      this._addEventListener(
        'characterDefinition',
        'blur',
        this.#handleCharacterInput.bind(this)
      );
    }
  }

  /**
   * Handle character input and validation
   *
   * @private
   * @returns {Promise<void>}
   */
  async #handleCharacterInput() {
    const inputElement = this._getElement('characterDefinition');

    try {
      const inputText = inputElement.value.trim();

      if (!inputText) {
        this.#currentCharacterDefinition = null;
        this.#updateGenerateButtonState(false);
        this._getDomManager().hideElement('characterInputError');
        return;
      }

      // Validate JSON and character definition
      const characterDefinition =
        await this.#validateCharacterDefinition(inputText);
      this.#currentCharacterDefinition = characterDefinition;

      // Clear errors and enable generation
      this._getDomManager().hideElement('characterInputError');
      this.#updateGenerateButtonState(true);

      this.logger.debug(
        'TraitsRewriterController: Valid character input received'
      );
    } catch (error) {
      this.#currentCharacterDefinition = null;
      this.#updateGenerateButtonState(false);
      this.#showValidationError(error.message);
    }
  }

  /**
   * Validate character definition JSON
   *
   * @private
   * @param {string} inputText - JSON input text
   * @returns {Promise<object>} Parsed and validated character definition
   * @throws {TraitsRewriterError} If validation fails
   */
  async #validateCharacterDefinition(inputText) {
    let parsed;

    // Parse JSON
    try {
      parsed = JSON.parse(inputText);
    } catch (error) {
      throw new TraitsRewriterError(
        'Invalid JSON format. Please check your character definition.',
        'INVALID_JSON',
        { parseError: error.message }
      );
    }

    // Validate components property exists
    if (!parsed.components || typeof parsed.components !== 'object') {
      throw new TraitsRewriterError(
        'Character definition must include a "components" property with character data',
        'MISSING_COMPONENTS',
        { characterData: parsed }
      );
    }

    // Validate required fields inside components
    if (!parsed.components['core:name']) {
      throw new TraitsRewriterError(
        'Character definition must include core:name component inside the components property',
        'MISSING_NAME',
        { characterData: parsed }
      );
    }

    // Check for at least one trait to rewrite
    const traitKeys = [
      'core:personality',
      'core:likes',
      'core:dislikes',
      'core:fears',
      'core:goals',
      'core:notes',
      'core:profile',
      'core:secrets',
      'core:strengths',
      'core:weaknesses',
      'core:internal_tensions',
      'core:motivations',
      'core:dilemmas',
    ];

    const hasTraits = traitKeys.some(
      (key) => parsed.components && parsed.components[key]
    );
    if (!hasTraits) {
      throw new TraitsRewriterError(
        'Character definition must include at least one trait to rewrite inside the components property',
        'NO_TRAITS',
        {
          availableComponents: Object.keys(parsed.components),
          expectedTraitKeys: traitKeys,
        }
      );
    }

    return parsed;
  }

  /**
   * Setup control button handlers
   *
   * @private
   */
  #setupControlButtons() {
    // Rewrite traits button
    this._addEventListener(
      'rewriteTraitsButton',
      'click',
      this.#generateRewrittenTraits.bind(this)
    );

    // Clear input button
    this._addEventListener(
      'clearInputButton',
      'click',
      this.#clearAll.bind(this)
    );

    // Retry button
    this._addEventListener(
      'retryButton',
      'click',
      this.#generateRewrittenTraits.bind(this)
    );
  }

  /**
   * Setup export handling functionality
   *
   * @private
   */
  #setupExportHandling() {
    // JSON export button
    this._addEventListener(
      'exportJsonButton',
      'click',
      this.#exportToJSON.bind(this)
    );

    // Text export button
    this._addEventListener(
      'exportTextButton',
      'click',
      this.#exportToText.bind(this)
    );

    // Copy to clipboard button
    this._addEventListener(
      'copyTraitsButton',
      'click',
      this.#copyToClipboard.bind(this)
    );
  }

  /**
   * Generate rewritten traits using the generation service
   *
   * @private
   * @returns {Promise<void>}
   */
  async #generateRewrittenTraits() {
    if (this.#isGenerating || !this.#currentCharacterDefinition) {
      return;
    }

    this.#isGenerating = true;

    try {
      // Update UI to loading state
      this._getDomManager().showElement('generationProgress');
      this._getDomManager().hideElement('emptyState');
      this._getDomManager().hideElement('rewrittenTraitsContainer');
      this._getDomManager().hideElement('generationError');

      // Update progress text
      const progressText = this._getElement('progressText');
      if (progressText) {
        progressText.textContent = 'Rewriting traits in character voice...';
      }

      // Disable controls during generation
      this.#updateControlsState(false);

      this.logger.info('TraitsRewriterController: Starting trait generation');

      // Generate rewritten traits
      const result =
        await this.#traitsRewriterGenerator.generateRewrittenTraits(
          this.#currentCharacterDefinition,
          { includeMetadata: true }
        );

      this.#lastGeneratedTraits = result;

      // Display results
      await this.#displayResults(result);
    } catch (error) {
      this.logger.error('TraitsRewriterController: Generation failed', error);
      this.#displayError(error);
    } finally {
      this.#isGenerating = false;
      this.#updateControlsState(true);
      this._getDomManager().hideElement('generationProgress');
    }
  }

  /**
   * Display generated results
   *
   * @private
   * @param {object} generatedTraits - Generated traits result
   * @returns {Promise<void>}
   */
  async #displayResults(generatedTraits) {
    try {
      // Enhance traits for display
      const displayData = this.#traitsRewriterDisplayEnhancer.enhanceForDisplay(
        generatedTraits.rewrittenTraits,
        {
          characterName: generatedTraits.characterName || 'Character',
          timestamp: new Date().toISOString(),
        }
      );

      // Update character name display
      const nameElement = this._getElement('characterNameDisplay');
      if (nameElement) {
        nameElement.textContent = displayData.characterName;
      }

      // Create trait sections in the correct container
      const sectionsContainer = this._getElement('traitsSections');
      if (sectionsContainer) {
        this.#createTraitSections(sectionsContainer, displayData.sections);
      }

      // Show results container
      this._getDomManager().showElement('rewrittenTraitsContainer');
      this._getDomManager().hideElement('emptyState');

      // Enable export buttons
      this._getDomManager().showElement('exportJsonButton');
      this._getDomManager().showElement('exportTextButton');
      this._getDomManager().showElement('copyTraitsButton');

      this.logger.info(
        'TraitsRewriterController: Results displayed successfully'
      );
    } catch (error) {
      this.logger.error('TraitsRewriterController: Display failed', error);
      throw new TraitsRewriterError(
        'Failed to display results',
        'DISPLAY_FAILED',
        { error }
      );
    }
  }

  /**
   * Create trait sections in the DOM
   *
   * @private
   * @param {HTMLElement} container - Container element
   * @param {Array<object>} sections - Trait sections data
   */
  #createTraitSections(container, sections) {
    // Clear existing sections
    container.innerHTML = '';

    sections.forEach((section) => {
      const sectionElement = document.createElement('div');
      sectionElement.className = 'trait-section';
      sectionElement.setAttribute('data-section-id', section.id);

      const titleElement = document.createElement('h4');
      titleElement.className = 'trait-section-title';
      titleElement.textContent = section.title;

      const contentElement = document.createElement('div');
      contentElement.className = 'trait-content';

      // Handle HTML-enhanced content if available
      if (section.htmlContent) {
        contentElement.innerHTML = section.htmlContent;
      } else {
        contentElement.textContent = section.content;
      }

      sectionElement.appendChild(titleElement);
      sectionElement.appendChild(contentElement);
      container.appendChild(sectionElement);
    });
  }

  /**
   * Export traits to JSON format
   *
   * @private
   * @returns {Promise<void>}
   */
  async #exportToJSON() {
    if (!this.#lastGeneratedTraits) {
      return;
    }

    try {
      // Format content for JSON export
      const exportContent = this.#traitsRewriterDisplayEnhancer.formatForExport(
        this.#lastGeneratedTraits.rewrittenTraits,
        'json'
      );

      // Generate filename
      const filename =
        this.#traitsRewriterDisplayEnhancer.generateExportFilename(
          this.#lastGeneratedTraits.characterName
        );

      // Trigger download
      this.#downloadFile(exportContent, filename, 'json');

      // Show success feedback
      this.#showExportSuccess(`${filename}.json`);

      this.logger.info('TraitsRewriterController: JSON export successful');
    } catch (error) {
      this.logger.error('TraitsRewriterController: JSON export failed', error);
      this.#displayError(
        new TraitsRewriterError('Export failed', 'EXPORT_FAILED', { error })
      );
    }
  }

  /**
   * Export traits to text format
   *
   * @private
   * @returns {Promise<void>}
   */
  async #exportToText() {
    if (!this.#lastGeneratedTraits) {
      return;
    }

    try {
      // Format content for text export
      const exportContent = this.#traitsRewriterDisplayEnhancer.formatForExport(
        this.#lastGeneratedTraits.rewrittenTraits,
        'text'
      );

      // Generate filename
      const filename =
        this.#traitsRewriterDisplayEnhancer.generateExportFilename(
          this.#lastGeneratedTraits.characterName
        );

      // Trigger download
      this.#downloadFile(exportContent, filename, 'text');

      // Show success feedback
      this.#showExportSuccess(`${filename}.txt`);

      this.logger.info('TraitsRewriterController: Text export successful');
    } catch (error) {
      this.logger.error('TraitsRewriterController: Text export failed', error);
      this.#displayError(
        new TraitsRewriterError('Export failed', 'EXPORT_FAILED', { error })
      );
    }
  }

  /**
   * Copy all traits to clipboard
   *
   * @private
   * @returns {Promise<void>}
   */
  async #copyToClipboard() {
    if (!this.#lastGeneratedTraits) {
      return;
    }

    try {
      // Format as text for clipboard
      const textContent = this.#traitsRewriterDisplayEnhancer.formatForExport(
        this.#lastGeneratedTraits.rewrittenTraits,
        'text'
      );

      // Use clipboard API
      await navigator.clipboard.writeText(textContent);

      // Show success feedback
      this.#showCopySuccess();

      this.logger.info(
        'TraitsRewriterController: Copy to clipboard successful'
      );
    } catch (error) {
      this.logger.error(
        'TraitsRewriterController: Copy to clipboard failed',
        error
      );
      this.#displayError(
        new TraitsRewriterError('Copy failed', 'COPY_FAILED', { error })
      );
    }
  }

  /**
   * Clear all input and reset UI
   *
   * @private
   */
  #clearAll() {
    // Clear input
    const inputElement = this._getElement('characterDefinition');
    if (inputElement) {
      inputElement.value = '';
    }

    // Reset state
    this.#currentCharacterDefinition = null;
    this.#lastGeneratedTraits = null;
    this.#isGenerating = false;

    // Reset UI
    this._getDomManager().hideElement('characterInputError');
    this._getDomManager().hideElement('rewrittenTraitsContainer');
    this._getDomManager().hideElement('generationError');
    this._getDomManager().showElement('emptyState');

    // Disable generate button
    this.#updateGenerateButtonState(false);

    this.logger.debug(
      'TraitsRewriterController: Cleared all input and reset UI'
    );
  }

  /**
   * Subscribe to generation events
   *
   * @private
   */
  #subscribeToGenerationEvents() {
    // Listen for generation started
    this._subscribeToEvent(
      CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_STARTED,
      this.#handleGenerationProgress.bind(this)
    );

    // Listen for generation completed
    this._subscribeToEvent(
      CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_COMPLETED,
      this.#handleGenerationComplete.bind(this)
    );

    // Listen for generation failed
    this._subscribeToEvent(
      CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_FAILED,
      this.#handleGenerationError.bind(this)
    );
  }

  /**
   * Handle generation progress events
   *
   * @private
   * @param {object} event - Generation progress event
   */
  #handleGenerationProgress(event) {
    this.logger.debug('TraitsRewriterController: Generation progress', event);

    // Update progress text if available
    const progressText = this._getElement('progressText');
    if (progressText && event.payload?.message) {
      progressText.textContent = event.payload.message;
    }
  }

  /**
   * Handle generation complete events
   *
   * @private
   * @param {object} event - Generation complete event
   */
  #handleGenerationComplete(event) {
    this.logger.debug('TraitsRewriterController: Generation complete', event);

    // Note: UI state management is handled by the UIStateManager
    // No additional event dispatching needed here
  }

  /**
   * Handle generation error events
   *
   * @private
   * @param {object} event - Generation error event
   */
  #handleGenerationError(event) {
    this.logger.error('TraitsRewriterController: Generation error', event);

    if (event.payload?.error) {
      this.#displayError(event.payload.error);
    }
  }

  /**
   * Display error message to user
   *
   * @private
   * @param {Error|string} error - Error to display
   */
  #displayError(error) {
    const errorMessage = error instanceof Error ? error.message : error;

    // Update error message element
    const errorElement = this._getElement('errorMessage');
    if (errorElement) {
      errorElement.textContent = errorMessage;
    }

    // Show error container
    this._getDomManager().showElement('generationError');
    this._getDomManager().hideElement('rewrittenTraitsContainer');
    this._getDomManager().hideElement('emptyState');
  }

  /**
   * Show validation error
   *
   * @private
   * @param {string} message - Error message
   */
  #showValidationError(message) {
    const errorElement = this._getElement('characterInputError');
    if (errorElement) {
      errorElement.textContent = message;
      this._getDomManager().showElement('characterInputError');
    }
  }

  /**
   * Update generate button state
   *
   * @private
   * @param {boolean} enabled - Whether to enable the button
   */
  #updateGenerateButtonState(enabled) {
    const button = this._getElement('rewriteTraitsButton');
    if (button) {
      button.disabled = !enabled;
      if (enabled) {
        button.classList.remove('cb-button--disabled');
      } else {
        button.classList.add('cb-button--disabled');
      }
    }
  }

  /**
   * Update controls state during generation
   *
   * @private
   * @param {boolean} enabled - Whether to enable controls
   */
  #updateControlsState(enabled) {
    const controls = [
      'rewriteTraitsButton',
      'clearInputButton',
      'characterDefinition',
    ];

    controls.forEach((controlId) => {
      const element = this._getElement(controlId);
      if (element) {
        element.disabled = !enabled;
      }
    });
  }

  /**
   * Download file helper
   *
   * @private
   * @param {string} content - File content
   * @param {string} filename - Base filename (without extension)
   * @param {string} format - File format (json or text)
   */
  #downloadFile(content, filename, format) {
    const mimeType = format === 'json' ? 'application/json' : 'text/plain';
    const extension = format === 'json' ? 'json' : 'txt';
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `${filename}.${extension}`;
    downloadLink.style.display = 'none';

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    URL.revokeObjectURL(url);
  }

  /**
   * Show export success feedback
   *
   * @private
   * @param {string} filename - Exported filename
   */
  #showExportSuccess(filename) {
    // Could dispatch an event or show a temporary notification
    this.logger.info(`TraitsRewriterController: Exported to ${filename}`);
  }

  /**
   * Show copy success feedback
   *
   * @private
   */
  #showCopySuccess() {
    // Could dispatch an event or show a temporary notification
    this.logger.info('TraitsRewriterController: Copied to clipboard');
  }

  /**
   * Validate TraitsRewriter-specific dependencies
   *
   * @private
   * @param {object} dependencies - Dependencies object
   * @throws {Error} If required dependencies are missing or invalid
   */
  #validateTraitsRewriterDependencies(dependencies) {
    // Use the logger from dependencies for validation
    const logger = dependencies.logger;

    // Validate TraitsRewriterGenerator
    validateDependency(
      dependencies.traitsRewriterGenerator,
      'TraitsRewriterGenerator',
      logger,
      {
        requiredMethods: ['generateRewrittenTraits'],
      }
    );

    // Validate TraitsRewriterDisplayEnhancer
    validateDependency(
      dependencies.traitsRewriterDisplayEnhancer,
      'TraitsRewriterDisplayEnhancer',
      logger,
      {
        requiredMethods: [
          'enhanceForDisplay',
          'formatForExport',
          'generateExportFilename',
        ],
      }
    );
  }
}
