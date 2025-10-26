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
import { validateDependency } from '../../utils/dependencyUtils.js';
import { Cliche } from '../../characterBuilder/models/cliche.js';
import { DomUtils } from '../../utils/domUtils.js';
import { ClicheDisplayEnhancer } from '../services/ClicheDisplayEnhancer.js';

// Enhanced error handling imports
import { validateGenerationPrerequisites } from '../../characterBuilder/validators/clicheValidator.js';
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
  #directionsWithConceptsMap = new Map();
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

  // Display enhancement
  #displayEnhancer = null;

  // DOM element cache
  #directionSelector = null;
  #generateBtn = null;
  #directionDisplay = null;
  #conceptDisplay = null;
  #clichesContainer = null;
  #statusMessages = null;
  #loadingOverlay = null;
  #navigationHandler = (url) => {
    window.location.href = url;
  };

  /**
   * Constructor
   *
   * @param {object} _dependencies - Controller dependencies
   */
  constructor(_dependencies) {
    super(_dependencies);

    // Validate page-specific dependencies
    validateDependency(_dependencies.clicheGenerator, 'IClicheGenerator');

    // Initialize enhanced error handling
    this.#initializeErrorHandler(_dependencies);
    this.#initializeState();
  }

  /**
   * Initialize enhanced error handler
   *
   * @param {object} dependencies - Controller dependencies
   * @param _dependencies
   * @private
   */
  #initializeErrorHandler(_dependencies) {
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
   * Initialize services - override to initialize UIStateManager early
   *
   * @protected
   * @override
   */
  async _initializeServices() {
    // Initialize UIStateManager EARLY (right after elements are cached)
    // so it's available when _loadInitialData runs
    await this._initializeUIStateManager();

    // Call parent implementation if it exists
    if (super._initializeServices) {
      await super._initializeServices();
    }
  }

  /**
   * Initialize UI state - override to ensure proper state after data loading
   *
   * @protected
   * @override
   */
  async _initializeUIState() {
    // UIStateManager is already initialized in _initializeServices
    // Just ensure we're showing the correct state after data loads
    if (this.#directionsData && this.#directionsData.length > 0) {
      this._showState('empty');
    } else {
      this._showState('empty');
    }
  }

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

    // Cache UIStateManager required elements
    this._cacheElement('emptyState', '#empty-state', false);
    this._cacheElement('loadingState', '#loading-state', false);
    this._cacheElement('resultsState', '#results-state', false);
    this._cacheElement('errorState', '#error-state', false);

    // Create loading overlay if not exists
    this.#loadingOverlay =
      document.getElementById('loading-overlay') ||
      this.#createLoadingOverlay();

    // Initialize display enhancer with delete handlers
    if (this.#clichesContainer) {
      this.#displayEnhancer = new ClicheDisplayEnhancer({
        logger: this.logger,
        container: this.#clichesContainer,
        onDeleteItem: (categoryId, itemText) =>
          this.#handleDeleteClicheItem(categoryId, itemText),
        onDeleteTrope: (tropeText) => this.#handleDeleteClicheTrope(tropeText),
      });
    }

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
    const backBtn = document.getElementById('back-btn');
    backBtn?.addEventListener('click', () => {
      this.#navigationHandler('index.html');
    });

    // Setup keyboard shortcuts for improved UX
    this.#setupKeyboardShortcuts();

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
      // Don't show loading here - UIStateManager might not be ready yet
      // We'll handle state display after initialization is complete

      // Load all thematic directions with their concepts
      const directionsWithConcepts =
        await this.characterBuilderService.getAllThematicDirectionsWithConcepts();

      if (!directionsWithConcepts || directionsWithConcepts.length === 0) {
        this._showEmpty();
        return;
      }

      // Extract just the directions for organization
      const directions = directionsWithConcepts.map((item) => item.direction);

      // Store the full data for later use
      this.#directionsWithConceptsMap = new Map(
        directionsWithConcepts.map((item) => [item.direction.id, item])
      );

      // Group directions by concept for better organization
      this.#directionsData =
        await this.#organizeDirectionsByConcept(directions);

      // Populate dropdown
      this.#populateDirectionSelector(this.#directionsData);

      // Remove loading overlay after successful initialization
      if (this.#loadingOverlay && this.#loadingOverlay.parentNode) {
        this.#loadingOverlay.parentNode.removeChild(this.#loadingOverlay);
        this.#loadingOverlay = null;
      }

      // Use 'empty' state instead of invalid 'idle' state
      this._showState('empty');
    } catch (error) {
      // Remove loading overlay on error as well
      if (this.#loadingOverlay && this.#loadingOverlay.parentNode) {
        this.#loadingOverlay.parentNode.removeChild(this.#loadingOverlay);
        this.#loadingOverlay = null;
      }

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
        // First check if we have the concept from the getAllThematicDirectionsWithConcepts call
        let concept = null;
        const directionWithConcept = this.#directionsWithConceptsMap.get(
          direction.id
        );

        if (directionWithConcept && directionWithConcept.concept) {
          concept = directionWithConcept.concept;
          this.#cacheConcept(direction.conceptId, concept);
        } else {
          // Check cache as fallback
          concept = this.#getCachedConcept(direction.conceptId);

          if (!concept) {
            // Fetch and cache the concept
            concept = await this.characterBuilderService.getCharacterConcept(
              direction.conceptId
            );

            if (concept) {
              this.#cacheConcept(direction.conceptId, concept);
            }
          }
        }

          if (!concept) {
            // Use a placeholder concept so the direction still appears in the UI
            this.logger?.warn(
              `Concept ${direction.conceptId} not found - using fallback placeholder`
            );
            concept = {
              id: direction.conceptId,
              concept: '',
              text: '',
              metadata: {},
            };
          }

          conceptMap.set(direction.conceptId, {
            concept,
            directions: [],
          });
        }

      // Only push direction if the concept exists in the map
      if (conceptMap.has(direction.conceptId)) {
        conceptMap.get(direction.conceptId).directions.push(direction);
      }
    }

    // Convert to array for easier handling
      for (const [conceptId, data] of conceptMap) {
        const rawConceptText =
          typeof data.concept?.concept === 'string' ? data.concept.concept : '';

        if (!rawConceptText) {
          this.logger?.warn(
            `Concept ${conceptId} is missing text - displaying as Untitled Concept`
          );
        }

        organized.push({
          conceptId,
          conceptText: rawConceptText || 'Untitled Concept',
          conceptTitle: this.#extractConceptTitle(rawConceptText),
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
    // Handle null or undefined concept text
    if (!conceptText) {
      return 'Untitled Concept';
    }

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
      // Find direction and concept from organized data
      const foundDirection = this.#findDirectionById(directionId);
      if (!foundDirection) {
        // Dispatch direction selection failed event for not found case
        this.eventBus.dispatch('core:direction_selection_failed', {
          directionId,
          error: `Direction not found: ${directionId}`,
          timestamp: new Date().toISOString(),
        });

        // Clear selection and show error message
        this.#clearSelection();
        this.#showStatusMessage(`Direction not found: ${directionId}`, 'error');
        return;
      }

      const { direction, concept } = foundDirection;
      const sanitizedDirectionId = directionId;

      // Dispatch selection started event
      this.eventBus.dispatch('core:direction_selection_started', {
        directionId: sanitizedDirectionId,
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
      this.eventBus.dispatch('core:direction_selection_completed', {
        directionId: sanitizedDirectionId,
        hasExistingCliches: !!this.#currentCliches,
      });

      // Only show empty state if no existing clichés were found and displayed
      // If existing clichés were found, #displayCliches already set the state to 'results'
      if (!this.#currentCliches) {
        this._showState('empty');
      }

      this.#manageFocus('selection-made');
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
    // First try the organized directionsData structure
    for (const conceptGroup of this.#directionsData) {
      for (const direction of conceptGroup.directions || []) {
        if (direction.id === directionId) {
          return {
            direction,
            concept: {
              id: conceptGroup.conceptId,
              text: conceptGroup.conceptText,
              concept: conceptGroup.conceptText, // Add concept field for compatibility
            },
          };
        }
      }
    }

    // Fallback to the directionsWithConceptsMap for better test compatibility
    if (this.#directionsWithConceptsMap.has(directionId)) {
      const item = this.#directionsWithConceptsMap.get(directionId);
      return {
        direction: item.direction,
        concept: item.concept,
      };
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

    // Handle both text and concept field for compatibility
    const conceptText =
      concept.text || concept.concept || 'No concept text available';

    conceptContent.innerHTML = `
      <div class="concept-text">
        ${DomUtils.escapeHtml(conceptText)}
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
    // Prevent concurrent generation
    if (this.#isGenerating) {
      this.logger.warn(
        'Generation already in progress, ignoring duplicate request'
      );
      return;
    }

    // Check if regenerating and confirm with user
    const confirmed = await this.#confirmRegeneration();
    if (!confirmed) {
      return;
    }
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

      // Dispatch generation started event with correct payload structure
      this.eventBus.dispatch('core:cliches_generation_started', {
        conceptId: this.#currentConcept?.id, // Required field
        directionId: this.#selectedDirectionId, // Required field
        directionTitle: this.#currentDirection?.title, // Optional field
      });

      this.#updateGenerateButtonEnhanced();
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

      // Validate the generated result exists and has expected structure
      if (!result || (result && typeof result.getTotalCount !== 'function')) {
        throw new Error('Invalid cliché generation result');
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
      this.#updateGenerateButtonEnhanced();
      this.#manageFocus('generation-complete');

      // Dispatch success event with correct payload structure
      this.eventBus.dispatch('core:cliches_generation_completed', {
        conceptId: result.conceptId || this.#currentConcept?.id, // Required field
        directionId: this.#selectedDirectionId, // Required field
        clicheId: result.id, // Optional field
        totalCount: result.getTotalCount(), // Optional field (correct name per schema)
        generationTime: result.llmMetadata?.responseTime, // Optional field
      });

      this._showResults({
        message: `Generated ${result.getTotalCount()} clichés successfully!`,
      });
    } catch (error) {
      // Set generating flag to false BEFORE handling error to ensure proper button state
      this.#isGenerating = false;

      await this.#handleGenerationErrorEnhanced(
        error,
        operationContext,
        operationKey
      );
    } finally {
      // Ensure flag is false (redundant but safe)
      this.#isGenerating = false;
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

    // Display overall tropes with copy and delete buttons
    if (
      displayData.tropesAndStereotypes &&
      displayData.tropesAndStereotypes.length > 0
    ) {
      html += `
        <div class="tropes-section">
          <h3>Overall Tropes & Stereotypes</h3>
          <ul class="tropes-list">
            ${displayData.tropesAndStereotypes
              .map(
                (trope) => `
                <li class="trope-item">
                  ${DomUtils.escapeHtml(trope)}
                  <span class="item-controls">
                    <button 
                      class="copy-item-btn" 
                      title="Copy this trope"
                      aria-label="Copy: ${DomUtils.escapeHtml(trope)}"
                    >
                      📋
                    </button>
                    <button 
                      class="delete-trope-btn" 
                      data-text="${DomUtils.escapeHtml(trope)}"
                      title="Delete this trope"
                      aria-label="Delete: ${DomUtils.escapeHtml(trope)}"
                    >
                      🗑️
                    </button>
                  </span>
                </li>
              `
              )
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

    // Put the content in the results state element instead of destroying the container structure
    const resultsState = document.getElementById('results-state');
    if (resultsState) {
      resultsState.innerHTML = html;
    } else {
      // Fallback for backwards compatibility
      this.#clichesContainer.innerHTML = html;
    }
    this.#clichesContainer.classList.remove('empty-state');
    this.#clichesContainer.classList.add('has-content');

    // Show the results state to make the clichés visible
    this._showState('results');

    // Enhance display with interactive features
    if (this.#displayEnhancer) {
      this.#displayEnhancer.enhance(displayData);
    }
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
    // Use the UIStateManager to show empty state instead of destroying DOM structure
    this._showState('empty');
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

  // Note: Original #updateGenerateButton replaced by #updateGenerateButtonEnhanced
  // for improved UI state management (CLIGEN-011)

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
    this.#updateGenerateButtonEnhanced();
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
    this.eventBus.subscribe('core:cliches_generation_started', (event) => {
      this.logger.debug('Cliché generation started', event.payload);
    });

    this.eventBus.subscribe('core:cliches_generation_completed', (event) => {
      this.logger.info('Cliché generation completed', event.payload);
    });

    this.eventBus.subscribe('core:cliches_generation_failed', (event) => {
      this.logger.debug('Cliché generation failed', event.payload);
    });

    // Listen for direction selection events
    this.eventBus.subscribe('core:direction_selection_started', (event) => {
      this.logger.debug('Direction selection started', event.payload);
    });

    this.eventBus.subscribe('core:direction_selection_completed', (event) => {
      this.logger.debug('Direction selection completed', event.payload);
    });

    this.eventBus.subscribe('DIRECTION_SELECTION_FAILED', (event) => {
      this.logger.warn('Direction selection failed', event.payload);
    });

    // Listen for data loading events
    this.eventBus.subscribe('core:existing_cliches_loaded', (event) => {
      this.logger.debug(
        'Existing clichés loaded from cache/storage',
        event.payload
      );
    });
  }

  // ============= UI Enhancement Methods (CLIGEN-011) =============

  /**
   * Setup keyboard shortcuts for improved user experience
   * Implements CLIGEN-011 keyboard navigation requirements
   *
   * @private
   */
  #setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      this.#handleKeyboardShortcuts(event);
    });
  }

  /**
   * Handle keyboard shortcuts for improved user experience
   *
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  #handleKeyboardShortcuts(event) {
    // Generate shortcut: Ctrl/Cmd + Enter
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      const generateBtn = this.#generateBtn;
      if (generateBtn && !generateBtn.disabled) {
        event.preventDefault();
        this.#handleGenerateCliches();
      }
      return;
    }

    // Escape key: Clear current operation
    if (event.key === 'Escape') {
      this.#handleEscapeKey();
      return;
    }

    // F5 key: Refresh data (prevent default browser refresh)
    if (event.key === 'F5' && !event.shiftKey) {
      event.preventDefault();
      this.#handleRefresh();
      return;
    }

    // Tab navigation enhancement
    if (event.key === 'Tab') {
      this.#enhanceTabNavigation(event);
    }
  }

  /**
   * Handle escape key press for canceling operations
   *
   * @private
   */
  #handleEscapeKey() {
    // Clear form errors
    this.#clearFormErrors();

    // Clear status messages except critical ones
    const statusContainer = this.#statusMessages;
    if (statusContainer) {
      const nonCriticalMessages = statusContainer.querySelectorAll(
        '.cb-message:not(.cb-message--error)'
      );
      nonCriticalMessages.forEach((msg) => msg.remove());
    }

    // If generating, show info
    if (this.#isGenerating) {
      this.#showStatusMessage(
        'Generation in progress. Please wait for completion.',
        'info'
      );
    }
  }

  /**
   * Handle data refresh with F5 key
   *
   * @private
   */
  async #handleRefresh() {
    try {
      this.#showStatusMessage('Refreshing data...', 'info');

      // Re-populate direction selector
      await this.#populateDirectionSelector(this.#directionsData);

      // Clear current selection if no clichés exist
      if (!this.#currentCliches) {
        this.#selectedDirectionId = null;
        this.#currentDirection = null;
        this.#currentConcept = null;
      }

      this.#showStatusMessage('Data refreshed successfully', 'success');
    } catch (_error) {
      this.#showStatusMessage('Failed to refresh data', 'error');
    }
  }

  /**
   * Clear all form validation errors
   *
   * @private
   */
  #clearFormErrors() {
    // Remove error classes and attributes
    document.querySelectorAll('.cb-form-error').forEach((element) => {
      element.classList.remove('cb-form-error');
      element.removeAttribute('aria-invalid');
      element.removeAttribute('aria-describedby');
    });

    // Remove error messages
    document.querySelectorAll('.cb-field-error').forEach((element) => {
      element.remove();
    });
  }

  /**
   * Manage focus after state changes for accessibility
   *
   * @param {string} newState - New UI state
   * @private
   */
  #manageFocus(newState) {
    switch (newState) {
      case 'ready-to-generate': {
        const generateBtn = this.#generateBtn;
        if (generateBtn && !generateBtn.disabled) {
          generateBtn.focus();
        }
        break;
      }

      case 'generation-complete': {
        // Focus first result or status message
        const firstResult = document.querySelector('.cliche-category-card');
        if (firstResult) {
          firstResult.setAttribute('tabindex', '0');
          firstResult.focus();
        } else {
          const statusMessage = document.querySelector('.cb-message--success');
          if (statusMessage) {
            statusMessage.setAttribute('tabindex', '-1');
            statusMessage.focus();
          }
        }
        break;
      }

      case 'generation-error': {
        // Focus retry button if available
        const retryButton = document.querySelector('[data-action="retry"]');
        if (retryButton) {
          retryButton.focus();
        } else {
          const errorMessage = document.querySelector('.cb-message--error');
          if (errorMessage) {
            errorMessage.setAttribute('tabindex', '-1');
            errorMessage.focus();
          }
        }
        break;
      }

      case 'selection-made': {
        // Keep focus on selector unless generating
        if (!this.#isGenerating) {
          const generateBtn = this.#generateBtn;
          if (generateBtn && !generateBtn.disabled) {
            generateBtn.focus();
          }
        }
        break;
      }
    }
  }

  /**
   * Enhance tab navigation for better keyboard accessibility
   *
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  #enhanceTabNavigation(event) {
    const focusableElements = this.#getFocusableElements();
    const currentIndex = focusableElements.indexOf(document.activeElement);

    if (event.shiftKey) {
      // Shift+Tab: Move backwards
      if (currentIndex === 0) {
        event.preventDefault();
        focusableElements[focusableElements.length - 1].focus();
      }
    } else {
      // Tab: Move forwards
      if (currentIndex === focusableElements.length - 1) {
        event.preventDefault();
        focusableElements[0].focus();
      }
    }
  }

  /**
   * Get all focusable elements in the form
   *
   * @returns {Array<HTMLElement>} Array of focusable elements
   * @private
   */
  #getFocusableElements() {
    const selector =
      'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll(selector)).filter(
      (el) => el.offsetParent !== null
    ); // Filter out hidden elements
  }

  /**
   * Enhanced generate button state management
   * Extends existing #updateGenerateButton() method
   *
   * @private
   */
  #updateGenerateButtonEnhanced() {
    const button = this.#generateBtn;
    if (!button) return;

    // Remove all state classes
    button.classList.remove(
      'cb-button-loading',
      'cb-button-disabled',
      'cb-button-ready',
      'cb-button-exists'
    );

    if (this.#isGenerating) {
      // Generating state with spinner
      button.disabled = true;
      button.innerHTML = '<span class="cb-spinner"></span> Generating...';
      button.classList.add('cb-button-loading');
      button.setAttribute('aria-busy', 'true');
      button.setAttribute('aria-label', 'Generating clichés, please wait');
    } else if (!this.#selectedDirectionId) {
      // No selection state
      button.disabled = true;
      button.textContent = 'Select Direction First';
      button.classList.add('cb-button-disabled');
      button.setAttribute('aria-busy', 'false');
      button.setAttribute(
        'aria-label',
        'Please select a direction before generating'
      );
    } else if (this.#hasValidCliches()) {
      // Already has results state - use helper method for robust checking
      button.disabled = false;
      button.textContent = 'Regenerate Clichés';
      button.classList.add('cb-button-exists');
      button.setAttribute('aria-busy', 'false');
      button.setAttribute(
        'aria-label',
        'Regenerate clichés for current direction'
      );
    } else {
      // Ready to generate state (has direction but no clichés)
      button.disabled = false;
      button.textContent = 'Generate Clichés';
      button.classList.add('cb-button-ready');
      button.setAttribute('aria-busy', 'false');
      button.setAttribute(
        'aria-label',
        'Generate clichés for selected direction'
      );
    }

    // Update button tooltip
    this.#updateButtonTooltip(button);
  }

  /**
   * Helper method to check if we have valid clichés
   *
   * @returns {boolean} True if we have valid clichés with count > 0
   * @private
   */
  #hasValidCliches() {
    return (
      this.#currentCliches &&
      typeof this.#currentCliches.getTotalCount === 'function' &&
      this.#currentCliches.getTotalCount() > 0
    );
  }

  /**
   * Add helpful tooltips to the generate button
   *
   * @param {HTMLElement} button - Button element
   * @private
   */
  #updateButtonTooltip(button) {
    if (button.disabled) {
      button.title = button.textContent;
    } else {
      button.title = 'Click or press Ctrl+Enter to generate clichés';
    }
  }

  /**
   * Show confirmation dialog before regenerating
   *
   * @returns {Promise<boolean>} True if user confirms
   * @private
   */
  async #confirmRegeneration() {
    if (
      !this.#currentCliches ||
      !this.#currentCliches.getTotalCount ||
      this.#currentCliches.getTotalCount() === 0
    ) {
      return true; // No existing clichés, proceed without confirmation
    }

    return new Promise((resolve) => {
      const dialog = this.#createConfirmationDialog({
        title: 'Regenerate Clichés?',
        message:
          'This will replace the existing clichés. Are you sure you want to continue?',
        confirmText: 'Regenerate',
        cancelText: 'Cancel',
        type: 'warning',
      });

      dialog.addEventListener('confirm', () => {
        dialog.remove();
        resolve(true);
      });

      dialog.addEventListener('cancel', () => {
        dialog.remove();
        resolve(false);
      });

      document.body.appendChild(dialog);
      dialog.querySelector('[data-action="cancel"]').focus();
    });
  }

  /**
   * Create a confirmation dialog element
   *
   * @param {object} options - Dialog options
   * @returns {HTMLElement} Dialog element
   * @private
   */
  #createConfirmationDialog(options) {
    const dialog = document.createElement('div');
    dialog.className = 'cb-dialog-overlay';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'dialog-title');

    dialog.innerHTML = `
      <div class="cb-dialog">
        <h3 id="dialog-title" class="cb-dialog-title">${options.title}</h3>
        <p class="cb-dialog-message">${options.message}</p>
        <div class="cb-dialog-actions">
          <button class="cb-button cb-button-secondary" data-action="cancel">
            ${options.cancelText}
          </button>
          <button class="cb-button cb-button-${options.type || 'primary'}" data-action="confirm">
            ${options.confirmText}
          </button>
        </div>
      </div>
    `;

    // Handle dialog actions
    dialog
      .querySelector('[data-action="confirm"]')
      .addEventListener('click', () => {
        dialog.dispatchEvent(new Event('confirm'));
      });

    dialog
      .querySelector('[data-action="cancel"]')
      .addEventListener('click', () => {
        dialog.dispatchEvent(new Event('cancel'));
      });

    // Handle escape key
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dialog.dispatchEvent(new Event('cancel'));
      }
    });

    return dialog;
  }

  /**
   * Enhanced error handling with retry functionality
   * Extends existing #handleGenerationError() method
   *
   * @param {Error} error - The error that occurred
   * @param {object} context - Error context
   * @param {string} operationKey - Operation identifier
   * @private
   */
  async #handleGenerationErrorEnhanced(error, context, operationKey) {
    // Call existing error handler
    await this.#handleGenerationError(error, context, operationKey);

    // Add retry button to error message
    const errorContainer = this.#statusMessages;
    if (errorContainer) {
      const lastError = errorContainer.querySelector(
        '.cb-message--error:last-child'
      );
      if (lastError && !lastError.querySelector('[data-action="retry"]')) {
        const retryButton = document.createElement('button');
        retryButton.className = 'cb-button-small cb-button-retry';
        retryButton.setAttribute('data-action', 'retry');
        retryButton.textContent = 'Retry';
        retryButton.addEventListener('click', () =>
          this.#handleRetryGeneration()
        );
        lastError.appendChild(retryButton);
      }
    }

    // Update UI state
    this.#manageFocus('generation-error');
  }

  /**
   * Handle retry generation after error
   *
   * @private
   */
  async #handleRetryGeneration() {
    // Clear error messages
    const errorMessages = document.querySelectorAll('.cb-message--error');
    errorMessages.forEach((msg) => msg.remove());

    // Reset state
    this.#isGenerating = false;
    this.#updateGenerateButtonEnhanced();

    // Retry generation
    await this.#handleGenerateCliches();
  }

  /**
   * Handle deletion of a cliché item
   *
   * @param {string} categoryId - Category ID
   * @param {string} itemText - Item text to delete
   * @returns {Promise<void>}
   * @private
   */
  async #handleDeleteClicheItem(categoryId, itemText) {
    if (!this.#selectedDirectionId || !this.#currentCliches) {
      this.logger.warn('Cannot delete item: no direction or clichés loaded');
      throw new Error('No clichés loaded');
    }

    try {
      // Call service to remove the item
      const updatedCliche = await this.characterBuilderService.removeClicheItem(
        this.#selectedDirectionId,
        categoryId,
        itemText
      );

      // Update current clichés
      this.#currentCliches = updatedCliche;

      // Update cache
      this.#cacheCliches(this.#selectedDirectionId, updatedCliche);

      // Log success
      this.logger.info(
        `Deleted item from category ${categoryId}: ${itemText.substring(0, 30)}...`
      );

      // Show success message
      this.#showStatusMessage('Item deleted successfully', 'success');
    } catch (error) {
      this.logger.error('Failed to delete cliché item:', error);
      this.#showStatusMessage(
        `Failed to delete item: ${error.message}`,
        'error'
      );
      throw error;
    }
  }

  /**
   * Handle deletion of a trope
   *
   * @param {string} tropeText - Trope text to delete
   * @returns {Promise<void>}
   * @private
   */
  async #handleDeleteClicheTrope(tropeText) {
    if (!this.#selectedDirectionId || !this.#currentCliches) {
      this.logger.warn('Cannot delete trope: no direction or clichés loaded');
      throw new Error('No clichés loaded');
    }

    try {
      // Call service to remove the trope
      const updatedCliche =
        await this.characterBuilderService.removeClicheTrope(
          this.#selectedDirectionId,
          tropeText
        );

      // Update current clichés
      this.#currentCliches = updatedCliche;

      // Update cache
      this.#cacheCliches(this.#selectedDirectionId, updatedCliche);

      // Log success
      this.logger.info(`Deleted trope: ${tropeText.substring(0, 30)}...`);

      // Show success message
      this.#showStatusMessage('Trope deleted successfully', 'success');
    } catch (error) {
      this.logger.error('Failed to delete cliché trope:', error);
      this.#showStatusMessage(
        `Failed to delete trope: ${error.message}`,
        'error'
      );
      throw error;
    }
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

  /**
   * Test helper method to populate caches (for testing purposes only)
   *
   * @private
   */
  _populateTestCaches() {
    // Add dummy cache entries for testing
    this.#conceptsCache.set('test-concept', {
      id: 'test-concept',
      text: 'test',
    });
    this.#clichesCache.set('test-direction', [
      { id: 'test-cliche', text: 'test' },
    ]);
    this.#directionsCache.set('test-direction', {
      id: 'test-direction',
      title: 'test',
    });
  }

  /**
   * Test helper method to directly trigger direction selection (for testing purposes only)
   *
   * @param {string} directionId - Direction ID to select
   * @private
   */
  async _testDirectionSelection(directionId) {
    return await this.#handleDirectionSelection(directionId);
  }

  /**
   * Test helper method to directly trigger generation (for testing purposes only)
   *
   * @private
   */
  async _testGeneration() {
    return await this.#handleGenerateCliches();
  }

  /**
   * @description Test helper to validate state transitions
   * @param {string} transition - Transition identifier
   * @param {object} context - Transition context
   * @returns {boolean} Result of {@link #validateStateTransition}
   * @private
   */
  _testValidateStateTransition(transition, context) {
    return this.#validateStateTransition(transition, context);
  }

  /**
   * @description Test helper to invoke the legacy error handler
   * @param {Error} error - Error instance
   * @param {string} userMessage - Friendly message
   * @param {Function} [recoveryAction] - Optional recovery callback
   * @returns {void}
   * @private
   */
  _testInvokeHandleError(error, userMessage, recoveryAction) {
    this.#handleError(error, userMessage, recoveryAction);
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

          // Cache retrieved clichés if valid
          if (cliches && typeof cliches.getTotalCount === 'function') {
            this.#cacheCliches(directionId, cliches);
          }
        }
      }

      if (hasCliches && cliches) {
        this.#currentCliches = cliches;
        this.#displayCliches(cliches);
        this.#updateGenerateButtonEnhanced();

        // Dispatch clichés loaded event with proper namespace
        this.eventBus.dispatch('core:existing_cliches_loaded', {
          directionId,
          count: cliches.getTotalCount(),
        });
      } else {
        // Clear current clichés when direction has no clichés
        this.#currentCliches = null;
        // Enable generation
        this.#showEmptyClichesState();
        this.#updateGenerateButtonEnhanced();
        this.#manageFocus('ready-to-generate');
      }
    } catch (error) {
      this.logger.warn(
        'Failed to load existing clichés, proceeding with generation option:',
        error
      );

      // Clear current clichés on error and show empty state
      this.#currentCliches = null;
      this.#showEmptyClichesState();
      this.#updateGenerateButtonEnhanced();

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
    this.eventBus.dispatch('core:direction_selection_failed', {
      directionId: context.directionId,
      error: error.message,
      timestamp: new Date().toISOString(),
    });

    let recovery = null;

    if (this.#errorHandler) {
      recovery = await this.#errorHandler.handleError(error, context);

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

    // FOR DIRECTION SELECTION ERRORS: Only clear selection for "not found" errors
    // For other errors (like failed to load existing clichés), preserve the selection
    // and just show the direction with a warning that clichés couldn't be loaded
    if (error.message.includes('Direction not found')) {
      this.#clearSelection();
    } else {
      // Preserve direction selection but clear clichés and show empty state
      this.#currentCliches = null;
      this.#showEmptyClichesState();
      this.#updateGenerateButtonEnhanced();

      const fallbackWarning =
        'Could not load existing clichés. You can generate new ones.';

      if (
        recovery &&
        this.#statusMessages &&
        (recovery.requiresRefresh ||
          (recovery.actionableSteps && recovery.actionableSteps.length > 0))
      ) {
        this.#statusMessages.innerHTML += `
          <div class="cb-message cb-message--warning" role="alert">
            <span class="cb-message__icon" aria-hidden="true">⚠️</span>
            <span class="cb-message__text">${this.#sanitizeForDisplay(
              fallbackWarning
            )}</span>
            <button class="cb-message__close" aria-label="Close message" onclick="this.parentElement.remove()">×</button>
          </div>
        `;
      } else {
        this.#showStatusMessage(fallbackWarning, 'warning');
      }
    }
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

    // Dispatch generation failed event with correct payload
    this.eventBus.dispatch('core:cliches_generation_failed', {
      conceptId: context.conceptId || this.#currentConcept?.id, // Required field
      directionId: context.directionId || this.#selectedDirectionId, // Required field - use current selection as fallback
      error: error.message, // Required field
      // Removed non-schema fields: attempt, timestamp
    });

    this.#recordStateChange('generation_failed', {
      directionId: context.directionId,
      error: error.message,
      attempt: context.attempt,
    });

    // PRESERVE DIRECTION SELECTION STATE - don't clear it for generation errors
    // Only clear cliches since generation failed, but keep direction/concept state
    this.#currentCliches = null;

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
        // Button state will be handled by the enhanced method
        this.#updateGenerateButtonEnhanced();

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

    // Reset button for retry, but preserve selection state
    this.#updateGenerateButtonEnhanced();

    // Show empty cliches state but keep direction/concept visible
    this.#showEmptyClichesState();
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
   * @param _error
   * @private
   */
  #handleFallbackAction(action, _error) {
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

    // Cleanup display enhancer
    if (this.#displayEnhancer) {
      this.#displayEnhancer.cleanup();
      this.#displayEnhancer = null;
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

    // Reset initialization flag to allow re-initialization
    this._resetInitializationState();

    // Note: Parent class uses destroy() method, not cleanup()
    // We don't call super.destroy() here as that would fully destroy the controller
  }

  /**
   * Test helper method to set internal state for testing
   *
   * @param {object} state - State to set
   * @param {object} state.currentConcept - Current concept
   * @param {object} state.currentDirection - Current direction
   * @param {string} state.selectedDirectionId - Selected direction ID
   * @param {object} [state.currentCliches] - Current clichés data
   * @param {boolean} [state.isGenerating] - Generation in progress flag
   * @private
   */
  _testSetCurrentState({
    currentConcept,
    currentDirection,
    selectedDirectionId,
    currentCliches,
    isGenerating,
  }) {
    if (currentConcept !== undefined) {
      this.#currentConcept = currentConcept;
    }
    if (currentDirection !== undefined) {
      this.#currentDirection = currentDirection;
    }
    if (selectedDirectionId !== undefined) {
      this.#selectedDirectionId = selectedDirectionId;
    }
    if (currentCliches !== undefined) {
      this.#currentCliches = currentCliches;
    }
    if (isGenerating !== undefined) {
      this.#isGenerating = isGenerating;
    }
  }

  /**
   * @description Test helper to override direction caches for targeted scenarios
   * @param {object} [options] - Options to configure the caches
   * @param {Array<object>} [options.directionsData] - Pre-organized directions data
   * @param {Array<Array>} [options.directionsMapEntries] - Entries for directionsWithConceptsMap
   * @returns {void}
   * @private
   */
  _testSetDirectionCaches({ directionsData, directionsMapEntries } = {}) {
    if (Array.isArray(directionsData)) {
      this.#directionsData = directionsData;
    }

    if (Array.isArray(directionsMapEntries)) {
      this.#directionsWithConceptsMap = new Map(directionsMapEntries);
    }
  }

  /**
   * @description Test helper to override navigation handler for deterministic testing
   * @param {Function} handler - Custom navigation handler
   * @returns {void}
   * @private
   */
  _testSetNavigationHandler(handler) {
    if (typeof handler === 'function') {
      this.#navigationHandler = handler;
    }
  }

  /**
   * Test helper to get current state for debugging
   *
   * @private
   */
  _testGetCurrentState() {
    return {
      selectedDirectionId: this.#selectedDirectionId,
      currentConcept: this.#currentConcept,
      currentDirection: this.#currentDirection,
      currentCliches: this.#currentCliches,
      directionsDataLength: this.#directionsData.length,
      isGenerating: this.#isGenerating,
    };
  }
}

export default ClichesGeneratorController;
