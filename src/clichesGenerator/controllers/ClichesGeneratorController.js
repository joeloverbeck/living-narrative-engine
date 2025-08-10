/**
 * @file Controller for Clichés Generator page
 * @see BaseCharacterBuilderController.js
 */

import { BaseCharacterBuilderController } from '../../characterBuilder/controllers/BaseCharacterBuilderController.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { assertPresent } from '../../utils/validationCore.js';
import { Cliche } from '../../characterBuilder/models/cliche.js';
import { DomUtils } from '../../utils/domUtils.js';

/**
 * Controller for cliché generation and display
 */
export class ClichesGeneratorController extends BaseCharacterBuilderController {
  // Page-specific state
  #selectedDirectionId = null;
  #currentConcept = null;
  #currentDirection = null;
  #currentCliches = null;
  #directionsData = [];
  #isGenerating = false;

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

    this.#initializeState();
  }

  /**
   * Initialize page state
   *
   * @private
   */
  #initializeState() {
    this.#selectedDirectionId = null;
    this.#currentConcept = null;
    this.#currentDirection = null;
    this.#currentCliches = null;
    this.#directionsData = [];
    this.#isGenerating = false;
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
      this.logger.error('Failed to load initial data:', error);
      this._showError(
        'Failed to load thematic directions. Please refresh the page.'
      );
    }
  }

  // ============= Page-Specific Methods =============

  /**
   * Organize directions by their parent concepts
   *
   * @param directions
   * @private
   */
  async #organizeDirectionsByConcept(directions) {
    const organized = [];
    const conceptMap = new Map();

    for (const direction of directions) {
      if (!conceptMap.has(direction.conceptId)) {
        // Fetch the concept if not cached
        const concept = await this.characterBuilderService.getCharacterConcept(
          direction.conceptId
        );

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
   * Handle direction selection
   *
   * @param directionId
   * @private
   */
  async #handleDirectionSelection(directionId) {
    if (!directionId) {
      this.#clearSelection();
      return;
    }

    try {
      this._showLoading('Loading direction details...');

      // Find the selected direction
      const directionData = this.#findDirectionById(directionId);
      if (!directionData) {
        throw new Error('Direction not found');
      }

      this.#selectedDirectionId = directionId;
      this.#currentDirection = directionData.direction;
      this.#currentConcept = directionData.concept;

      // Display direction and concept info
      this.#displayDirectionInfo(this.#currentDirection);
      this.#displayConceptInfo(directionData.concept);

      // Check if clichés already exist
      const hasCliches =
        await this.characterBuilderService.hasClichesForDirection(directionId);

      if (hasCliches) {
        // Load and display existing clichés
        const cliches =
          await this.characterBuilderService.getClichesByDirectionId(
            directionId
          );
        this.#currentCliches = cliches;
        this.#displayCliches(cliches);
        this.#updateGenerateButton(false, 'Clichés Already Generated');
      } else {
        // Enable generation
        this.#showEmptyClichesState();
        this.#updateGenerateButton(true, 'Generate Clichés');
      }

      this._showState('idle');
    } catch (error) {
      this.logger.error('Failed to handle direction selection:', error);
      this._showError('Failed to load direction details');
      this.#clearSelection();
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
   * Handle generate clichés button click
   *
   * @private
   */
  async #handleGenerateCliches() {
    if (!this.#selectedDirectionId || this.#isGenerating) {
      return;
    }

    try {
      this.#isGenerating = true;
      this.#updateGenerateButton(false, 'Generating...');
      this._showLoading('Generating clichés... This may take a few moments.');

      // Clear any existing error messages

      // Generate clichés
      const cliches =
        await this.characterBuilderService.generateClichesForDirection(
          this.#currentConcept,
          this.#currentDirection
        );

      this.#currentCliches = cliches;

      // Display the generated clichés
      this.#displayCliches(cliches);

      // Update button state
      this.#updateGenerateButton(false, 'Clichés Generated');

      // Show success message
      this._showResults({
        message: `Generated ${cliches.getTotalCount()} clichés successfully!`,
      });
    } catch (error) {
      this.logger.error('Failed to generate clichés:', error);
      this._showError(
        error.message || 'Failed to generate clichés. Please try again.'
      );
      this.#updateGenerateButton(true, 'Retry Generation');
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
   * Subscribe to relevant events
   *
   * @private
   */
  _subscribeToEvents() {
    // Listen for cliché generation events
    this.eventBus.subscribe('CLICHES_GENERATION_STARTED', (event) => {
      this.logger.debug('Cliché generation started', event.payload);
    });

    this.eventBus.subscribe('CLICHES_GENERATION_COMPLETED', (event) => {
      this.logger.info('Cliché generation completed', event.payload);
    });

    this.eventBus.subscribe('CLICHES_GENERATION_FAILED', (event) => {
      this.logger.error('Cliché generation failed', event.payload);
    });
  }

  // ============= Cleanup =============

  /**
   * Clean up resources
   *
   * @public
   * @override
   */
  async cleanup() {
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

    // Call parent cleanup with error handling
    try {
      await super.cleanup();
    } catch (error) {
      this.logger.error('Error during parent cleanup:', error);
    }
  }
}

export default ClichesGeneratorController;
