/**
 * @file Controller for Clichés Generator page with enhanced state management
 *
 * This controller implements a comprehensive state management and data flow system that includes:
 * - Multi-level caching for concepts, directions, and clichés
 * - State transition validation and history tracking
 * - Enhanced event dispatching with proper EventBus integration
 * - Robust error handling with user-friendly recovery mechanisms
 * - Performance optimizations through intelligent caching strategies
 * @see BaseCharacterBuilderController.js
 * @see UIStateManager.js
 */

import { BaseCharacterBuilderController } from '../../characterBuilder/controllers/BaseCharacterBuilderController.js';
import {
  validateDependency,
  assertPresent,
} from '../../utils/dependencyUtils.js';
import { Cliche } from '../../characterBuilder/models/cliche.js';
import { DomUtils } from '../../utils/domUtils.js';

// Enhanced error handling imports
import {
  ClicheError,
  ClicheGenerationError,
  ClicheValidationError,
  ClicheStorageError,
  ClicheLLMError,
  ClicheDataIntegrityError,
} from '../../errors/clicheErrors.js';
import {
  validateDirectionSelection,
  validateGenerationPrerequisites,
  validateLLMResponse,
  validateClicheData,
  validateAndSanitizeDirectionSelection,
} from '../../characterBuilder/validators/clicheValidator.js';
import { ClicheErrorHandler } from '../../characterBuilder/services/clicheErrorHandler.js';

/**
 * Enhanced controller for cliché generation and display with comprehensive state management
 *
 * Features:
 * - **Data Caching**: Intelligent caching of concepts (10min TTL) and clichés (30min TTL)
 * - **State Management**: Complete state history tracking with validation
 * - **Event System**: Full EventBus integration with proper event dispatching
 * - **Error Handling**: Enhanced error recovery with detailed logging and user feedback
 * - **Performance**: Optimized service calls through cache-first strategies
 *
 * State Flow:
 * 1. Initialize → Load directions → Cache concepts
 * 2. Direction Selection → Validate transition → Update state → Cache data
 * 3. Cliché Generation → Validate prerequisites → Generate → Cache results
 * 4. Error Handling → Log context → Dispatch events → Execute recovery
 *
 * @augments {BaseCharacterBuilderController}
 */
export class ClichesGeneratorController extends BaseCharacterBuilderController {
  // Page-specific state
  #selectedDirectionId = null;
  #currentConcept = null;
  #currentDirection = null;
  #currentCliches = null;
  #directionsData = [];
  #isGenerating = false;

  // Data caching layer
  #conceptsCache = new Map();
  #directionsCache = new Map();
  #clichesCache = new Map();
  #cacheTimestamps = new Map();

  // State validation and consistency
  #stateHistory = [];
  #maxHistorySize = 10;

  // Enhanced error handling
  #errorHandler = null;
  #retryAttempts = new Map();
  #errorRecoveryState = new Map();

  // DOM element cache
  #directionSelector = null;
  #generateBtn = null;
  #directionDisplay = null;
  #conceptDisplay = null;
  #clichesContainer = null;
  #statusMessages = null;
  #loadingOverlay = null;

  /**
   * Constructor
   *
   * @param {object} dependencies - Controller dependencies
   */
  constructor(dependencies) {
    super(dependencies);

    // Validate page-specific dependencies
    validateDependency(dependencies.clicheGenerator, 'IClicheGenerator');

    // Initialize enhanced error handling
    this.#initializeErrorHandler(dependencies);
    this.#initializeState();
  }

  /**
   * Initialize enhanced error handler
   *
   * @param {object} dependencies - Controller dependencies
   * @private
   */
  #initializeErrorHandler(dependencies) {
    try {
      this.#errorHandler = new ClicheErrorHandler({
        logger: this.logger,
        eventBus: this.eventBus,
        retryConfig: {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 10000,
        },
      });

      this.logger.debug('ClicheErrorHandler initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize error handler:', error);
      // Fallback to basic error handling if initialization fails
      this.#errorHandler = null;
    }
  }

  /**
   * Initialize page state and caches
   *
   * @private
   */
  #initializeState() {
    // Reset page state
    this.#selectedDirectionId = null;
    this.#currentConcept = null;
    this.#currentDirection = null;
    this.#currentCliches = null;
    this.#directionsData = [];
    this.#isGenerating = false;

    // Initialize caches
    this.#conceptsCache = new Map();
    this.#directionsCache = new Map();
    this.#clichesCache = new Map();
    this.#cacheTimestamps = new Map();

    // Initialize state tracking
    this.#stateHistory = [];
    this.#recordStateChange('initialized', null);

    // Initialize error handling maps
    this.#retryAttempts = new Map();
    this.#errorRecoveryState = new Map();
  }

  // ============= Required Abstract Method Implementations =============

  /**
   * Cache DOM elements for efficient access
   *
   * @protected
   * @override
   */
  _cacheElements() {
    // Cache form elements
    this.#directionSelector = document.getElementById('direction-selector');
    this.#generateBtn = document.getElementById('generate-btn');

    // Cache display elements
    this.#directionDisplay = document.getElementById(
      'selected-direction-display'
    );
    this.#conceptDisplay = document.getElementById('original-concept-display');
    this.#clichesContainer = document.getElementById('cliches-container');
    this.#statusMessages = document.getElementById('status-messages');

    // Cache specific display areas using proper base class method
    this._cacheElement('directionContent', '#direction-content');
    this._cacheElement('directionMeta', '#direction-meta');
    this._cacheElement('conceptContent', '#concept-content');

    // Create loading overlay if not exists
    this.#loadingOverlay =
      document.getElementById('loading-overlay') ||
      this.#createLoadingOverlay();

    // Validate required elements
    this.#validateRequiredElements();
  }

  /**
   * Set up event listeners
   *
   * @protected
   * @override
   */
  _setupEventListeners() {
    // Direction selection
    this.#directionSelector?.addEventListener('change', (e) => {
      this.#handleDirectionSelection(e.target.value);
    });

    // Generate button
    this.#generateBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.#handleGenerateCliches();
    });

    // Form submission
    const form = document.getElementById('cliches-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.#handleGenerateCliches();
    });

    // Back to menu button
    const backBtn = document.getElementById('back-to-menu-btn');
    backBtn?.addEventListener('click', () => {
      window.location.href = '/character-builder-menu.html';
    });

    // Listen for cliché-related events
    this._subscribeToEvents();
  }

  /**
   * Load initial data
   *
   * @protected
   * @override
   */
  async _loadInitialData() {
    try {
      this._showLoading('Loading thematic directions...');

      // Load all thematic directions with their concepts
      const directions =
        await this.characterBuilderService.getAllThematicDirections();

      if (!directions || directions.length === 0) {
        this._showEmpty();
        return;
      }

      // Group directions by concept for better organization
      this.#directionsData =
        await this.#organizeDirectionsByConcept(directions);

      // Populate dropdown
      this.#populateDirectionSelector(this.#directionsData);

      this._showState('idle');
    } catch (error) {
      this.#handleError(
        error,
        'Failed to load initial data. Please refresh the page.'
      );
    }
  }

  // ============= Page-Specific Methods =============

  /**
   * Organize directions by their parent concepts with caching
   *
   * @param directions
   * @private
   */
  async #organizeDirectionsByConcept(directions) {
    const organized = [];
    const conceptMap = new Map();

    for (const direction of directions) {
      if (!conceptMap.has(direction.conceptId)) {
        // Check cache first
        let concept = this.#getCachedConcept(direction.conceptId);

        if (!concept) {
          // Fetch and cache the concept
          concept = await this.characterBuilderService.getCharacterConcept(
            direction.conceptId
          );

          if (concept) {
            this.#cacheConcept(direction.conceptId, concept);
          }
        }

        if (concept) {
          conceptMap.set(direction.conceptId, {
            concept,
            directions: [],
          });
        }
      }

      conceptMap.get(direction.conceptId)?.directions.push(direction);
    }

    // Convert to array for easier handling
    for (const [conceptId, data] of conceptMap) {
      organized.push({
        conceptId,
        conceptText: data.concept.text,
        conceptTitle: this.#extractConceptTitle(data.concept.text),
        directions: data.directions,
      });
    }

    return organized;
  }

  /**
   * Extract title from concept text (first line or first sentence)
   *
   * @param conceptText
   * @private
   */
  #extractConceptTitle(conceptText) {
    const firstLine = conceptText.split('\n')[0];
    const firstSentence = conceptText.split('.')[0];
    const title = (
      firstLine.length < firstSentence.length ? firstLine : firstSentence
    ).trim();
    return title.length > 50 ? title.substring(0, 47) + '...' : title;
  }

  /**
   * Populate direction selector dropdown
   *
   * @param organizedData
   * @private
   */
  #populateDirectionSelector(organizedData) {
    if (!this.#directionSelector) return;

    // Clear existing options
    this.#directionSelector.innerHTML =
      '<option value="">-- Choose a thematic direction --</option>';

    // Add optgroups for each concept
    for (const conceptGroup of organizedData) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = conceptGroup.conceptTitle;

      for (const direction of conceptGroup.directions) {
        const option = document.createElement('option');
        option.value = direction.id;
        option.textContent = direction.title;
        option.dataset.conceptId = conceptGroup.conceptId;
        optgroup.appendChild(option);
      }

      this.#directionSelector.appendChild(optgroup);
    }
  }

  /**
   * Handle direction selection with enhanced validation and error handling
   *
   * @param directionId
   * @private
   */
  async #handleDirectionSelection(directionId) {
    if (!directionId) {
      this.#clearSelection();
      return;
    }

    const operationContext = {
      operation: 'directionSelection',
      directionId,
      attempt: 1,
    };

    try {
      // Enhanced validation with sanitization
      const validationResult = validateAndSanitizeDirectionSelection(
        directionId,
        this.#directionsData
      );
      const { direction, concept, sanitizedDirectionId } = validationResult;

      // Dispatch selection started event
      this.eventBus.dispatch({
        type: 'DIRECTION_SELECTION_STARTED',
        payload: { directionId: sanitizedDirectionId },
      });

      this._showLoading('Loading direction details...');

      // Update state with validation
      const previousState = {
        selectedDirectionId: this.#selectedDirectionId,
        currentDirection: this.#currentDirection,
        currentConcept: this.#currentConcept,
      };

      this.#selectedDirectionId = sanitizedDirectionId;
      this.#currentDirection = direction;
      this.#currentConcept = concept;
      this.#recordStateChange('direction_selected', {
        directionId: sanitizedDirectionId,
        previousState,
      });

      // Display direction and concept info
      this.#displayDirectionInfo(this.#currentDirection);
      this.#displayConceptInfo(concept);

      // Check for existing clichés with error handling
      await this.#loadExistingClichesWithErrorHandling(sanitizedDirectionId);

      // Dispatch selection completed event
      this.eventBus.dispatch({
        type: 'DIRECTION_SELECTION_COMPLETED',
        payload: {
          directionId: sanitizedDirectionId,
          hasExistingCliches: !!this.#currentCliches,
        },
      });

      this._showState('idle');
    } catch (error) {
      await this.#handleDirectionSelectionError(error, operationContext);
    }
  }

  /**
   * Find direction by ID from organized data
   *
   * @param directionId
   * @private
   */
  #findDirectionById(directionId) {
    for (const conceptGroup of this.#directionsData) {
      for (const direction of conceptGroup.directions) {
        if (direction.id === directionId) {
          return {
            direction,
            concept: {
              id: conceptGroup.conceptId,
              text: conceptGroup.conceptText,
            },
          };
        }
      }
    }
    return null;
  }

  /**
   * Display direction information
   *
   * @param direction
   * @private
   */
  #displayDirectionInfo(direction) {
    const directionContent = this._getElement('directionContent');
    if (!this.#directionDisplay || !directionContent) return;

    directionContent.innerHTML = `
      <div class="direction-info">
        <h4>${DomUtils.escapeHtml(direction.title)}</h4>
        <p class="description">${DomUtils.escapeHtml(direction.description)}</p>
        ${
          direction.coreTension
            ? `
          <div class="core-tension">
            <strong>Core Tension:</strong> ${DomUtils.escapeHtml(direction.coreTension)}
          </div>
        `
            : ''
        }
      </div>
    `;

    const directionMeta = this._getElement('directionMeta');
    if (directionMeta) {
      directionMeta.innerHTML = `
        <div class="meta-info">
          <span class="meta-item">ID: ${direction.id.slice(0, 8)}...</span>
          <span class="meta-item">Created: ${new Date(direction.createdAt).toLocaleDateString()}</span>
        </div>
      `;
    }

    this.#directionDisplay.style.display = 'block';
  }

  /**
   * Display concept information
   *
   * @param concept
   * @private
   */
  #displayConceptInfo(concept) {
    const conceptContent = this._getElement('conceptContent');
    if (!this.#conceptDisplay || !conceptContent) return;

    conceptContent.innerHTML = `
      <div class="concept-text">
        ${DomUtils.escapeHtml(concept.text)}
      </div>
    `;

    this.#conceptDisplay.style.display = 'block';
  }

  /**
   * Handle generate clichés button click with comprehensive error handling
   *
   * @private
   */
  async #handleGenerateCliches() {
    const operationKey = `generate-${this.#selectedDirectionId}`;
    const currentAttempt = (this.#retryAttempts.get(operationKey) || 0) + 1;

    const operationContext = {
      operation: 'generateCliches',
      attempt: currentAttempt,
      directionId: this.#selectedDirectionId,
      conceptId: this.#currentConcept?.id,
      state: this.#getCurrentState(),
    };

    try {
      // Validate prerequisites with enhanced validation
      validateGenerationPrerequisites(
        this.#currentDirection,
        this.#currentConcept,
        this.#isGenerating,
        {
          requiresLLMAvailability: true,
          llmAvailable: true, // Assume available unless we have health checks
        }
      );

      this.#isGenerating = true;
      this.#recordStateChange('generation_started', {
        directionId: this.#selectedDirectionId,
        attempt: currentAttempt,
      });

      // Dispatch generation started event
      this.eventBus.dispatch({
        type: 'CLICHES_GENERATION_STARTED',
        payload: {
          directionId: this.#selectedDirectionId,
          concept: this.#currentConcept,
          direction: this.#currentDirection,
          attempt: currentAttempt,
        },
      });

      this.#updateGenerateButton(
        false,
        currentAttempt > 1
          ? `Retrying (${currentAttempt}/3)...`
          : 'Generating...'
      );
      this._showLoading(
        currentAttempt > 1
          ? `Retrying generation (attempt ${currentAttempt})... This may take a few moments.`
          : 'Generating clichés... This may take a few moments.'
      );

      // Generate clichés with validation
      const result =
        await this.characterBuilderService.generateClichesForDirection(
          this.#currentConcept,
          this.#currentDirection
        );

      // Validate the generated result
      if (result.llmResponse) {
        validateLLMResponse(result.llmResponse);
      }

      if (
        result instanceof Cliche ||
        (result && typeof result.getTotalCount === 'function')
      ) {
        validateClicheData(result);
      }

      this.#currentCliches = result;

      // Cache the generated clichés
      this.#cacheCliches(this.#selectedDirectionId, result);
      this.#recordStateChange('generation_completed', {
        directionId: this.#selectedDirectionId,
        clichesCount: result.getTotalCount(),
        attempt: currentAttempt,
      });

      // Clear retry attempts on success
      this.#retryAttempts.delete(operationKey);
      this.#errorRecoveryState.delete(operationKey);

      // Display the generated clichés
      this.#displayCliches(result);
      this.#updateGenerateButton(false, 'Clichés Generated');

      // Dispatch success event
      this.eventBus.dispatch({
        type: 'CLICHES_GENERATION_COMPLETED',
        payload: {
          directionId: this.#selectedDirectionId,
          count: result.getTotalCount(),
          attempt: currentAttempt,
          timestamp: new Date().toISOString(),
        },
      });

      this._showResults({
        message: `Generated ${result.getTotalCount()} clichés successfully!`,
      });
    } catch (error) {
      await this.#handleGenerationError(error, operationContext, operationKey);
    } finally {
      this.#isGenerating = false;
      this._showState('idle');
    }
  }

  /**
   * Display clichés in categorized format
   *
   * @param cliches
   * @private
   */
  #displayCliches(cliches) {
    if (!this.#clichesContainer || !cliches) return;

    const displayData = cliches.getDisplayData();

    // Build HTML for cliché display
    let html = '<div class="cliches-results">';

    // Display categories
    html += '<div class="cliche-categories">';
    for (const category of displayData.categories) {
      html += this.#renderClicheCategory(category);
    }
    html += '</div>';

    // Display overall tropes
    if (
      displayData.tropesAndStereotypes &&
      displayData.tropesAndStereotypes.length > 0
    ) {
      html += `
        <div class="tropes-section">
          <h3>Overall Tropes & Stereotypes</h3>
          <ul class="tropes-list">
            ${displayData.tropesAndStereotypes
              .map((trope) => `<li>${DomUtils.escapeHtml(trope)}</li>`)
              .join('')}
          </ul>
        </div>
      `;
    }

    // Display metadata
    html += `
      <div class="cliche-metadata">
        <p>Generated on ${displayData.metadata.createdAt}</p>
        <p>Total clichés: ${displayData.metadata.totalCount}</p>
      </div>
    `;

    html += '</div>';

    this.#clichesContainer.innerHTML = html;
    this.#clichesContainer.classList.remove('empty-state');
    this.#clichesContainer.classList.add('has-content');
  }

  /**
   * Render a single cliché category
   *
   * @param category
   * @private
   */
  #renderClicheCategory(category) {
    return `
      <div class="cliche-category" data-category="${category.id}">
        <h4 class="category-title">
          ${DomUtils.escapeHtml(category.title)}
          <span class="category-count">(${category.count})</span>
        </h4>
        <ul class="cliche-list">
          ${category.items
            .map(
              (item) =>
                `<li class="cliche-item">${DomUtils.escapeHtml(item)}</li>`
            )
            .join('')}
        </ul>
      </div>
    `;
  }

  /**
   * Show empty clichés state
   *
   * @private
   */
  #showEmptyClichesState() {
    if (!this.#clichesContainer) return;

    this.#clichesContainer.innerHTML = `
      <div class="empty-state">
        <p>No clichés generated yet for this direction.</p>
        <p>Click "Generate Clichés" to identify common tropes to avoid.</p>
      </div>
    `;

    this.#clichesContainer.classList.add('empty-state');
    this.#clichesContainer.classList.remove('has-content');
  }

  /**
   * Show initial empty state when no direction is selected
   *
   * @private
   */
  #showInitialEmptyState() {
    if (!this.#clichesContainer) return;

    this.#clichesContainer.innerHTML = `
      <div class="empty-state">
        <p>Select a thematic direction to view or generate clichés.</p>
      </div>
    `;

    this.#clichesContainer.classList.add('empty-state');
    this.#clichesContainer.classList.remove('has-content');
  }

  /**
   * Update generate button state
   *
   * @param enabled
   * @param text
   * @private
   */
  #updateGenerateButton(enabled, text) {
    if (!this.#generateBtn) return;

    this.#generateBtn.disabled = !enabled;
    this.#generateBtn.textContent = text;

    if (enabled) {
      this.#generateBtn.classList.remove('disabled');
      this.#generateBtn.classList.add('primary');
    } else {
      this.#generateBtn.classList.add('disabled');
      this.#generateBtn.classList.remove('primary');
    }
  }

  /**
   * Clear selection and reset UI
   *
   * @private
   */
  #clearSelection() {
    this.#selectedDirectionId = null;
    this.#currentDirection = null;
    this.#currentConcept = null;
    this.#currentCliches = null;

    if (this.#directionDisplay) {
      this.#directionDisplay.style.display = 'none';
    }

    if (this.#conceptDisplay) {
      this.#conceptDisplay.style.display = 'none';
    }

    this.#showInitialEmptyState();
    this.#updateGenerateButton(false, 'Generate Clichés');
  }

  /**
   * Create loading overlay element
   *
   * @private
   */
  #createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="spinner"></div>
        <p class="loading-message">Loading...</p>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  /**
   * Validate required DOM elements
   *
   * @private
   */
  #validateRequiredElements() {
    const required = [
      { element: this.#directionSelector, name: 'Direction selector' },
      { element: this.#generateBtn, name: 'Generate button' },
      { element: this.#clichesContainer, name: 'Clichés container' },
    ];

    for (const { element, name } of required) {
      if (!element) {
        this.logger.error(`Required element missing: ${name}`);
      }
    }
  }

  /**
   * Subscribe to relevant events using correct EventBus API
   *
   * @private
   */
  _subscribeToEvents() {
    // Listen for cliché generation events
    this.eventBus.on('CLICHES_GENERATION_STARTED', (event) => {
      this.logger.debug('Cliché generation started', event.payload);
    });

    this.eventBus.on('CLICHES_GENERATION_COMPLETED', (event) => {
      this.logger.info('Cliché generation completed', event.payload);
    });

    this.eventBus.on('CLICHES_GENERATION_FAILED', (event) => {
      this.logger.debug('Cliché generation failed', event.payload);
    });

    // Listen for direction selection events
    this.eventBus.on('DIRECTION_SELECTION_STARTED', (event) => {
      this.logger.debug('Direction selection started', event.payload);
    });

    this.eventBus.on('DIRECTION_SELECTION_COMPLETED', (event) => {
      this.logger.debug('Direction selection completed', event.payload);
    });

    this.eventBus.on('DIRECTION_SELECTION_FAILED', (event) => {
      this.logger.warn('Direction selection failed', event.payload);
    });

    // Listen for data loading events
    this.eventBus.on('EXISTING_CLICHES_LOADED', (event) => {
      this.logger.debug(
        'Existing clichés loaded from cache/storage',
        event.payload
      );
    });
  }

  // ============= Data Caching Methods =============

  /**
   * Get cached concept by ID
   *
   * @param {string} conceptId - Concept ID
   * @returns {object|null} Cached concept or null
   * @private
   */
  #getCachedConcept(conceptId) {
    const cached = this.#conceptsCache.get(conceptId);
    if (cached && this.#isCacheValid(conceptId, 'concept')) {
      return cached;
    }
    return null;
  }

  /**
   * Cache a concept
   *
   * @param {string} conceptId - Concept ID
   * @param {object} concept - Concept data
   * @private
   */
  #cacheConcept(conceptId, concept) {
    this.#conceptsCache.set(conceptId, concept);
    this.#cacheTimestamps.set(`concept_${conceptId}`, Date.now());
  }

  /**
   * Get cached clichés by direction ID
   *
   * @param {string} directionId - Direction ID
   * @returns {object|null} Cached clichés or null
   * @private
   */
  #getCachedCliches(directionId) {
    const cached = this.#clichesCache.get(directionId);
    if (cached && this.#isCacheValid(directionId, 'cliches')) {
      return cached;
    }
    return null;
  }

  /**
   * Cache clichés for a direction
   *
   * @param {string} directionId - Direction ID
   * @param {object} cliches - Clichés data
   * @private
   */
  #cacheCliches(directionId, cliches) {
    this.#clichesCache.set(directionId, cliches);
    this.#cacheTimestamps.set(`cliches_${directionId}`, Date.now());
  }

  /**
   * Check if cache entry is valid (not expired)
   *
   * @param {string} key - Cache key
   * @param {string} type - Cache type ('concept', 'cliches', 'direction')
   * @returns {boolean} True if cache is valid
   * @private
   */
  #isCacheValid(key, type) {
    const timestamp = this.#cacheTimestamps.get(`${type}_${key}`);
    if (!timestamp) return false;

    // Cache expires after 10 minutes for concepts/directions, 30 minutes for clichés
    const expirationTime = type === 'cliches' ? 30 * 60 * 1000 : 10 * 60 * 1000;
    return Date.now() - timestamp < expirationTime;
  }

  /**
   * Clear all caches
   *
   * @private
   */
  #clearCaches() {
    this.#conceptsCache.clear();
    this.#directionsCache.clear();
    this.#clichesCache.clear();
    this.#cacheTimestamps.clear();
  }

  // ============= State Validation & Management =============

  /**
   * Record a state change for debugging and validation
   *
   * @param {string} action - Action that caused the state change
   * @param {object} data - Additional data about the change
   * @private
   */
  #recordStateChange(action, data) {
    const stateSnapshot = {
      timestamp: new Date().toISOString(),
      action,
      data,
      state: {
        selectedDirectionId: this.#selectedDirectionId,
        hasCurrentConcept: !!this.#currentConcept,
        hasCurrentDirection: !!this.#currentDirection,
        hasCurrentCliches: !!this.#currentCliches,
        isGenerating: this.#isGenerating,
      },
    };

    this.#stateHistory.push(stateSnapshot);

    // Keep history size manageable
    if (this.#stateHistory.length > this.#maxHistorySize) {
      this.#stateHistory.shift();
    }

    this.logger.debug('State change recorded:', stateSnapshot);
  }

  /**
   * Validate state transition
   *
   * @param {string} transition - Type of transition
   * @param {object} context - Context data for validation
   * @returns {boolean} True if transition is valid
   * @private
   */
  #validateStateTransition(transition, context) {
    switch (transition) {
      case 'direction_selection':
        return this.#validateDirectionSelection(context);
      case 'cliche_generation':
        return this.#validateClicheGeneration(context);
      default:
        this.logger.warn(`Unknown state transition: ${transition}`);
        return true; // Allow unknown transitions
    }
  }

  /**
   * Validate direction selection state
   *
   * @param {object} context - Validation context
   * @returns {boolean} True if valid
   * @private
   */
  #validateDirectionSelection(context) {
    if (!context.directionId) {
      this.logger.error('Direction selection: Missing directionId');
      return false;
    }

    if (this.#directionsData.length === 0) {
      this.logger.error('Direction selection: No directions data loaded');
      return false;
    }

    return true;
  }

  /**
   * Validate cliché generation state
   *
   * @param {object} context - Validation context
   * @returns {boolean} True if valid
   * @private
   */
  #validateClicheGeneration(context) {
    if (!context.selectedDirectionId) {
      this.logger.error('Cliché generation: No direction selected');
      return false;
    }

    if (!context.currentConcept || !context.currentDirection) {
      this.logger.error('Cliché generation: Missing concept or direction data');
      return false;
    }

    if (this.#isGenerating) {
      this.logger.warn('Cliché generation: Already generating');
      return false;
    }

    return true;
  }

  /**
   * Get current state for debugging
   *
   * @returns {object} Current state snapshot
   * @private
   */
  #getCurrentState() {
    return {
      selectedDirectionId: this.#selectedDirectionId,
      currentConcept: this.#currentConcept,
      currentDirection: this.#currentDirection,
      currentCliches: this.#currentCliches,
      directionsDataLength: this.#directionsData.length,
      isGenerating: this.#isGenerating,
      cacheStats: {
        conceptsCacheSize: this.#conceptsCache.size,
        directionsCacheSize: this.#directionsCache.size,
        clichesCacheSize: this.#clichesCache.size,
      },
      stateHistoryLength: this.#stateHistory.length,
    };
  }

  /**
   * Get cache statistics (for testing purposes)
   *
   * @returns {object} Cache statistics
   * @public
   */
  getCacheStats() {
    return {
      conceptsCacheSize: this.#conceptsCache.size,
      directionsCacheSize: this.#directionsCache.size,
      clichesCacheSize: this.#clichesCache.size,
      cacheTimestampsSize: this.#cacheTimestamps.size,
    };
  }

  /**
   * Get state history (for testing purposes)
   *
   * @returns {Array} State history array
   * @public
   */
  getStateHistory() {
    return [...this.#stateHistory];
  }

  // ============= Enhanced Error Handling =============

  /**
   * Load existing clichés with error handling
   *
   * @param {string} directionId - Direction ID to load clichés for
   * @private
   */
  async #loadExistingClichesWithErrorHandling(directionId) {
    try {
      // Check cache first for existing clichés
      let cliches = this.#getCachedCliches(directionId);
      let hasCliches = !!cliches;

      if (!cliches) {
        // Check database for existing clichés
        hasCliches =
          await this.characterBuilderService.hasClichesForDirection(
            directionId
          );

        if (hasCliches) {
          cliches =
            await this.characterBuilderService.getClichesByDirectionId(
              directionId
            );

          // Validate retrieved clichés
          if (
            cliches &&
            (cliches instanceof Cliche ||
              typeof cliches.getTotalCount === 'function')
          ) {
            validateClicheData(cliches);
            this.#cacheCliches(directionId, cliches);
          }
        }
      }

      if (hasCliches && cliches) {
        this.#currentCliches = cliches;
        this.#displayCliches(cliches);
        this.#updateGenerateButton(false, 'Clichés Already Generated');

        // Dispatch clichés loaded event
        this.eventBus.dispatch({
          type: 'EXISTING_CLICHES_LOADED',
          payload: { directionId, count: cliches.getTotalCount() },
        });
      } else {
        // Enable generation
        this.#showEmptyClichesState();
        this.#updateGenerateButton(true, 'Generate Clichés');
      }
    } catch (error) {
      this.logger.warn(
        'Failed to load existing clichés, proceeding with generation option:',
        error
      );

      // Show empty state and allow generation as fallback
      this.#showEmptyClichesState();
      this.#updateGenerateButton(true, 'Generate Clichés');

      // Show warning message to user
      this.#showStatusMessage(
        'Could not load existing clichés. You can generate new ones.',
        'warning'
      );
    }
  }

  /**
   * Handle direction selection errors with recovery
   *
   * @param {Error} error - The selection error
   * @param {object} context - Error context
   * @private
   */
  async #handleDirectionSelectionError(error, context) {
    // Dispatch selection failed event
    this.eventBus.dispatch({
      type: 'DIRECTION_SELECTION_FAILED',
      payload: {
        directionId: context.directionId,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });

    if (this.#errorHandler) {
      const recovery = await this.#errorHandler.handleError(error, context);

      this.#showErrorMessage(recovery.userMessage || error.message, 'error');

      if (recovery.requiresRefresh) {
        this.#showRefreshOption();
      } else if (
        recovery.actionableSteps &&
        recovery.actionableSteps.length > 0
      ) {
        this.#showActionableSteps(recovery.actionableSteps);
      }
    } else {
      // Fallback error handling
      this.#showErrorMessage(
        'Failed to load direction details. Please try selecting a different direction.',
        'error'
      );
    }

    // Clear selection on error
    this.#clearSelection();
  }

  /**
   * Handle generation errors with retry logic
   *
   * @param {Error} error - The generation error
   * @param {object} context - Error context
   * @param {string} operationKey - Key for tracking retries
   * @private
   */
  async #handleGenerationError(error, context, operationKey) {
    // Update retry attempts
    this.#retryAttempts.set(operationKey, context.attempt);

    // Dispatch generation failed event
    this.eventBus.dispatch({
      type: 'CLICHES_GENERATION_FAILED',
      payload: {
        directionId: context.directionId,
        error: error.message,
        attempt: context.attempt,
        timestamp: new Date().toISOString(),
      },
    });

    this.#recordStateChange('generation_failed', {
      directionId: context.directionId,
      error: error.message,
      attempt: context.attempt,
    });

    if (this.#errorHandler) {
      const recovery = await this.#errorHandler.handleError(error, context);

      if (recovery.shouldRetry && context.attempt < 3) {
        // Schedule retry with delay
        setTimeout(() => {
          if (!this.#isGenerating) {
            // Only retry if not currently generating
            this.#handleGenerateCliches();
          }
        }, recovery.delay || 2000);

        this.#showStatusMessage(recovery.userMessage, 'info');
        this.#updateGenerateButton(
          false,
          `Retrying in ${Math.round((recovery.delay || 2000) / 1000)}s...`
        );

        return;
      }

      // Handle different recovery scenarios
      if (recovery.fallbackOptions && recovery.fallbackOptions.length > 0) {
        this.#showFallbackOptions(recovery.fallbackOptions, error);
      } else if (recovery.fallbackAction === 'USE_MEMORY_STORAGE') {
        this.#showStorageFallbackMessage();
      } else {
        this.#showErrorMessage(recovery.userMessage || error.message, 'error');
      }
    } else {
      // Fallback error handling without error handler
      this.#showErrorMessage(
        'Failed to generate clichés. Please try again.',
        'error'
      );
    }

    // Reset button for retry
    this.#updateGenerateButton(true, 'Retry Generation');
  }

  /**
   * Show status message to user
   *
   * @param {string} message - Message to display
   * @param {string} [type] - Message type (info, warning, error, success)
   * @private
   */
  #showStatusMessage(message, type = 'info') {
    if (!this.#statusMessages) return;

    const iconMap = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅',
    };

    const messageHtml = `
      <div class="cb-message cb-message--${type}" role="alert">
        <span class="cb-message__icon" aria-hidden="true">${iconMap[type] || 'ℹ️'}</span>
        <span class="cb-message__text">${this.#sanitizeForDisplay(message)}</span>
        <button class="cb-message__close" aria-label="Close message" onclick="this.parentElement.remove()">×</button>
      </div>
    `;

    this.#statusMessages.innerHTML = messageHtml;

    // Auto-dismiss non-error messages after 8 seconds
    if (type !== 'error') {
      setTimeout(() => {
        const messageEl = this.#statusMessages.querySelector('.cb-message');
        if (messageEl) {
          messageEl.remove();
        }
      }, 8000);
    }
  }

  /**
   * Show refresh option to user
   *
   * @private
   */
  #showRefreshOption() {
    if (!this.#statusMessages) return;

    const refreshHtml = `
      <div class="cb-error-action">
        <button class="cb-btn cb-btn--primary" onclick="location.reload()">
          Refresh Page
        </button>
      </div>
    `;

    this.#statusMessages.innerHTML += refreshHtml;
  }

  /**
   * Show actionable steps to user
   *
   * @param {Array<string>} steps - Steps to display
   * @private
   */
  #showActionableSteps(steps) {
    if (!this.#statusMessages || !steps.length) return;

    const stepsHtml = `
      <div class="cb-actionable-steps">
        <h4>Please try the following:</h4>
        <ul>
          ${steps.map((step) => `<li>${this.#sanitizeForDisplay(step)}</li>`).join('')}
        </ul>
      </div>
    `;

    this.#statusMessages.innerHTML += stepsHtml;
  }

  /**
   * Show fallback options to user
   *
   * @param {Array<object>} options - Fallback options
   * @param {Error} error - Original error
   * @private
   */
  #showFallbackOptions(options, error) {
    if (!this.#statusMessages || !options.length) return;

    const optionsHtml = `
      <div class="cb-fallback-options">
        <h4>Alternative options:</h4>
        <div class="cb-option-buttons">
          ${options
            .map(
              (option) => `
            <button class="cb-btn cb-btn--secondary" data-action="${option.action}">
              ${option.label}
            </button>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    this.#statusMessages.innerHTML += optionsHtml;

    // Add event listeners for fallback options
    this.#statusMessages.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const action = e.target.getAttribute('data-action');
        this.#handleFallbackAction(action, error);
      });
    });
  }

  /**
   * Handle fallback action selection
   *
   * @param {string} action - Selected action
   * @param {Error} error - Original error
   * @private
   */
  #handleFallbackAction(action, error) {
    switch (action) {
      case 'MANUAL_ENTRY':
        this.#showManualEntryOption();
        break;
      case 'TRY_LATER':
        this.#showTryLaterMessage();
        break;
      case 'CONTACT_SUPPORT':
        this.#showSupportContact();
        break;
      default:
        this.logger.warn('Unknown fallback action:', action);
    }
  }

  /**
   * Show storage fallback message
   *
   * @private
   */
  #showStorageFallbackMessage() {
    this.#showStatusMessage(
      'Clichés generated successfully but could not be saved permanently. They will be available for this session only.',
      'warning'
    );
  }

  /**
   * Show manual entry option
   *
   * @private
   */
  #showManualEntryOption() {
    this.#showStatusMessage(
      'Manual cliché entry is not yet available. Please try again later or contact support.',
      'info'
    );
  }

  /**
   * Show try later message
   *
   * @private
   */
  #showTryLaterMessage() {
    this.#showStatusMessage(
      'Please try again in a few minutes. The service may be temporarily busy.',
      'info'
    );
  }

  /**
   * Show support contact information
   *
   * @private
   */
  #showSupportContact() {
    this.#showStatusMessage(
      'If this problem persists, please report it through the application feedback system.',
      'info'
    );
  }

  /**
   * Handle errors with enhanced user feedback and recovery
   *
   * @param {Error} error - The error that occurred
   * @param {string} userMessage - User-friendly error message
   * @param {Function} [recoveryAction] - Optional recovery action
   * @private
   * @deprecated Use specific error handling methods instead
   */
  #handleError(error, userMessage, recoveryAction) {
    // Log detailed error information
    this.logger.error('Controller error occurred:', {
      error: error.message,
      stack: error.stack,
      state: this.#getCurrentState(),
      timestamp: new Date().toISOString(),
    });

    // Record error in state history
    this.#recordStateChange('error_occurred', {
      error: error.message,
      userMessage,
    });

    // Show user-friendly error message
    this.#showErrorMessage(userMessage, 'error');

    // Execute recovery action if provided
    if (recoveryAction && typeof recoveryAction === 'function') {
      try {
        recoveryAction();
      } catch (recoveryError) {
        this.logger.error('Recovery action failed:', recoveryError);
      }
    }
  }

  /**
   * Display user-friendly error messages
   *
   * @param {string} message - Error message
   * @param {string} [severity] - Message severity
   * @private
   */
  #showErrorMessage(message, severity = 'error') {
    this.#showStatusMessage(message, severity);
  }

  /**
   * Utility: Sanitize text for safe display
   *
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   * @private
   */
  #sanitizeForDisplay(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============= Cleanup =============

  /**
   * Clean up resources
   *
   * @public
   * @override
   */
  async cleanup() {
    // Record cleanup in state history
    this.#recordStateChange('cleanup_started', {});

    // Clear caches first
    this.#clearCaches();

    // Clear error handling state
    this.#retryAttempts.clear();
    this.#errorRecoveryState.clear();

    // Clear state
    this.#initializeState();

    // Clear DOM state before clearing references
    if (this.#directionSelector) {
      this.#directionSelector.value = '';
    }

    if (this.#generateBtn) {
      this.#generateBtn.disabled = true;
    }

    // Clear DOM references
    this.#directionSelector = null;
    this.#generateBtn = null;
    this.#directionDisplay = null;
    this.#conceptDisplay = null;
    this.#clichesContainer = null;
    this.#statusMessages = null;
    this.#loadingOverlay = null;
    this.#errorHandler = null;

    // Call parent cleanup with error handling
    try {
      await super.cleanup();
    } catch (error) {
      this.logger.error('Error during parent cleanup:', error);
    }
  }
}

export default ClichesGeneratorController;
