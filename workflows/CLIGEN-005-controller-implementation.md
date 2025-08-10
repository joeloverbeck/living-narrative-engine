# CLIGEN-005: ClichesGeneratorController Implementation

## Summary

Implement the main controller for the Clichés Generator page, extending BaseCharacterBuilderController to handle page lifecycle, user interactions, and data flow. This controller orchestrates the entire cliché generation workflow from direction selection to results display.

## Status

- **Type**: Implementation
- **Priority**: High
- **Complexity**: High
- **Estimated Time**: 6 hours
- **Dependencies**: CLIGEN-001 through CLIGEN-004 (Data layer and services)

## Objectives

### Primary Goals

1. **Extend BaseCharacterBuilderController** - Inherit common functionality
2. **Implement Page Lifecycle** - Initialize, load data, cleanup
3. **Handle User Interactions** - Direction selection, generation trigger
4. **Manage State** - Track current concept, direction, clichés
5. **Display Management** - Update UI based on state changes
6. **Error Handling** - User-friendly error messages

### Success Criteria

- [ ] Controller properly extends base class
- [ ] Page loads with populated direction dropdown
- [ ] Direction selection updates UI correctly
- [ ] Generation button triggers LLM generation
- [ ] Results display in categorized format
- [ ] Loading states shown during operations
- [ ] Errors displayed gracefully
- [ ] Memory leaks prevented on cleanup

## Technical Specification

### 1. Main Controller Implementation

#### File: `src/clichesGenerator/controllers/ClichesGeneratorController.js`

```javascript
/**
 * @file Controller for Clichés Generator page
 * @see BaseCharacterBuilderController.js
 */

import { BaseCharacterBuilderController } from '../../characterBuilder/controllers/BaseCharacterBuilderController.js';
import {
  validateDependency,
  assertPresent,
} from '../../utils/validationUtils.js';
import { Cliche } from '../../characterBuilder/models/cliche.js';

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

    // Cache specific display areas
    this._elements.directionContent =
      document.getElementById('direction-content');
    this._elements.directionMeta = document.getElementById('direction-meta');
    this._elements.conceptContent = document.getElementById('concept-content');

    // Create loading overlay if not exists
    this.#loadingOverlay =
      document.getElementById('loading-overlay') ||
      this.#createLoadingOverlay();

    // Validate required elements
    this.#validateRequiredElements();
  }

  /**
   * Set up event listeners
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
   * @protected
   * @override
   */
  async _loadInitialData() {
    try {
      this._showLoadingState('Loading thematic directions...');

      // Load all thematic directions with their concepts
      const directions =
        await this._services.characterBuilderService.getAllThematicDirections();

      if (!directions || directions.length === 0) {
        this._showEmptyState(
          'No thematic directions found. Please create some first.'
        );
        return;
      }

      // Group directions by concept for better organization
      this.#directionsData = await this.#organizeDirectionsByC;

      // Populate dropdown
      this.#populateDirectionSelector(this.#directionsData);

      this._hideLoadingState();
      this._showInfoMessage(
        'Select a thematic direction to view or generate clichés'
      );
    } catch (error) {
      this._logger.error('Failed to load initial data:', error);
      this._showErrorState(
        'Failed to load thematic directions. Please refresh the page.'
      );
    }
  }

  // ============= Page-Specific Methods =============

  /**
   * Organize directions by their parent concepts
   * @private
   */
  async #organizeDirectionsByConcept(directions) {
    const organized = [];
    const conceptMap = new Map();

    for (const direction of directions) {
      if (!conceptMap.has(direction.conceptId)) {
        // Fetch the concept if not cached
        const concept =
          await this._services.characterBuilderService.getCharacterConcept(
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
   * @private
   */
  async #handleDirectionSelection(directionId) {
    if (!directionId) {
      this.#clearSelection();
      return;
    }

    try {
      this._showLoadingState('Loading direction details...');

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
        await this._services.characterBuilderService.hasClichesForDirection(
          directionId
        );

      if (hasCliches) {
        // Load and display existing clichés
        const cliches =
          await this._services.characterBuilderService.getClichesByDirectionId(
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

      this._hideLoadingState();
    } catch (error) {
      this._logger.error('Failed to handle direction selection:', error);
      this._showErrorMessage('Failed to load direction details');
      this.#clearSelection();
    }
  }

  /**
   * Find direction by ID from organized data
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
   * @private
   */
  #displayDirectionInfo(direction) {
    if (!this.#directionDisplay || !this._elements.directionContent) return;

    this._elements.directionContent.innerHTML = `
      <div class="direction-info">
        <h4>${this._escapeHtml(direction.title)}</h4>
        <p class="description">${this._escapeHtml(direction.description)}</p>
        ${
          direction.coreTension
            ? `
          <div class="core-tension">
            <strong>Core Tension:</strong> ${this._escapeHtml(direction.coreTension)}
          </div>
        `
            : ''
        }
      </div>
    `;

    if (this._elements.directionMeta) {
      this._elements.directionMeta.innerHTML = `
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
   * @private
   */
  #displayConceptInfo(concept) {
    if (!this.#conceptDisplay || !this._elements.conceptContent) return;

    this._elements.conceptContent.innerHTML = `
      <div class="concept-text">
        ${this._escapeHtml(concept.text)}
      </div>
    `;

    this.#conceptDisplay.style.display = 'block';
  }

  /**
   * Handle generate clichés button click
   * @private
   */
  async #handleGenerateCliches() {
    if (!this.#selectedDirectionId || this.#isGenerating) {
      return;
    }

    try {
      this.#isGenerating = true;
      this.#updateGenerateButton(false, 'Generating...');
      this._showLoadingState(
        'Generating clichés... This may take a few moments.'
      );

      // Clear any existing error messages
      this._clearMessages();

      // Generate clichés
      const cliches =
        await this._services.characterBuilderService.generateClichesForDirection(
          this.#currentConcept,
          this.#currentDirection
        );

      this.#currentCliches = cliches;

      // Display the generated clichés
      this.#displayCliches(cliches);

      // Update button state
      this.#updateGenerateButton(false, 'Clichés Generated');

      // Show success message
      this._showSuccessMessage(
        `Generated ${cliches.getTotalCount()} clichés successfully!`
      );
    } catch (error) {
      this._logger.error('Failed to generate clichés:', error);
      this._showErrorMessage(
        error.message || 'Failed to generate clichés. Please try again.'
      );
      this.#updateGenerateButton(true, 'Retry Generation');
    } finally {
      this.#isGenerating = false;
      this._hideLoadingState();
    }
  }

  /**
   * Display clichés in categorized format
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
              .map((trope) => `<li>${this._escapeHtml(trope)}</li>`)
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
   * @private
   */
  #renderClicheCategory(category) {
    return `
      <div class="cliche-category" data-category="${category.id}">
        <h4 class="category-title">
          ${this._escapeHtml(category.title)}
          <span class="category-count">(${category.count})</span>
        </h4>
        <ul class="cliche-list">
          ${category.items
            .map(
              (item) => `<li class="cliche-item">${this._escapeHtml(item)}</li>`
            )
            .join('')}
        </ul>
      </div>
    `;
  }

  /**
   * Show empty clichés state
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
   * Update generate button state
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

    if (this.#clichesContainer) {
      this.#clichesContainer.innerHTML = '';
    }

    this.#updateGenerateButton(false, 'Generate Clichés');
  }

  /**
   * Create loading overlay element
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
        this._logger.error(`Required element missing: ${name}`);
      }
    }
  }

  /**
   * Subscribe to relevant events
   * @private
   */
  _subscribeToEvents() {
    // Listen for cliché generation events
    this._eventBus.on('CLICHES_GENERATION_STARTED', (event) => {
      this._logger.debug('Cliché generation started', event.payload);
    });

    this._eventBus.on('CLICHES_GENERATION_COMPLETED', (event) => {
      this._logger.info('Cliché generation completed', event.payload);
    });

    this._eventBus.on('CLICHES_GENERATION_FAILED', (event) => {
      this._logger.error('Cliché generation failed', event.payload);
    });
  }

  // ============= Cleanup =============

  /**
   * Clean up resources
   * @public
   * @override
   */
  async cleanup() {
    // Clear state
    this.#initializeState();

    // Clear DOM references
    this.#directionSelector = null;
    this.#generateBtn = null;
    this.#directionDisplay = null;
    this.#conceptDisplay = null;
    this.#clichesContainer = null;
    this.#statusMessages = null;
    this.#loadingOverlay = null;

    // Call parent cleanup
    await super.cleanup();
  }
}

export default ClichesGeneratorController;
```

## Implementation Tasks

### Phase 1: Base Setup (1.5 hours)

1. **Create controller class**
   - [ ] Extend BaseCharacterBuilderController
   - [ ] Define private fields
   - [ ] Constructor with dependencies

2. **Implement required methods**
   - [ ] \_cacheElements
   - [ ] \_setupEventListeners
   - [ ] \_loadInitialData

### Phase 2: Data Loading (1.5 hours)

1. **Load directions**
   - [ ] Fetch all directions
   - [ ] Organize by concept
   - [ ] Populate dropdown

2. **Handle selection**
   - [ ] Load direction details
   - [ ] Check for existing clichés
   - [ ] Update UI state

### Phase 3: Generation Flow (1.5 hours)

1. **Generation trigger**
   - [ ] Validate selection
   - [ ] Show loading state
   - [ ] Call service method

2. **Handle response**
   - [ ] Process clichés
   - [ ] Update display
   - [ ] Show success/error

### Phase 4: Display Logic (1.5 hours)

1. **Display clichés**
   - [ ] Category rendering
   - [ ] Tropes display
   - [ ] Metadata section

2. **UI states**
   - [ ] Empty state
   - [ ] Loading state
   - [ ] Error state
   - [ ] Success state

## Testing Requirements

### Unit Tests

```javascript
describe('ClichesGeneratorController', () => {
  let controller;
  let mockServices;
  let mockElements;

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = `
      <select id="direction-selector"></select>
      <button id="generate-btn">Generate</button>
      <div id="cliches-container"></div>
    `;

    // Create mocks
    mockServices = {
      characterBuilderService: {
        getAllThematicDirections: jest.fn(),
        getClichesByDirectionId: jest.fn(),
        hasClichesForDirection: jest.fn(),
        generateClichesForDirection: jest.fn(),
      },
      clicheGenerator: {
        generateCliches: jest.fn(),
      },
    };

    controller = new ClichesGeneratorController({
      services: mockServices,
      eventBus: mockEventBus,
      logger: mockLogger,
      clicheGenerator: mockServices.clicheGenerator,
    });
  });

  describe('Initialization', () => {
    it('should load directions on init', async () => {
      const mockDirections = [
        { id: 'dir-1', title: 'Direction 1', conceptId: 'concept-1' },
      ];

      mockServices.characterBuilderService.getAllThematicDirections.mockResolvedValue(
        mockDirections
      );

      await controller.initialize();

      expect(
        mockServices.characterBuilderService.getAllThematicDirections
      ).toHaveBeenCalled();
    });
  });

  describe('Direction Selection', () => {
    it('should handle direction selection', async () => {
      // Test implementation
    });
  });

  describe('Cliché Generation', () => {
    it('should generate clichés', async () => {
      // Test implementation
    });
  });
});
```

## Acceptance Criteria

- [ ] Controller properly initialized
- [ ] Directions loaded and displayed
- [ ] Selection updates UI correctly
- [ ] Generation works end-to-end
- [ ] Results displayed properly
- [ ] All states handled
- [ ] No memory leaks
- [ ] Tests passing

## Definition of Done

- [ ] Code implemented per specification
- [ ] Unit tests passing (90% coverage)
- [ ] Integration tested with services
- [ ] UI interactions verified
- [ ] Code reviewed and approved
- [ ] Documentation updated
