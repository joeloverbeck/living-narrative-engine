/**
 * @file CoreMotivationsGeneratorController.js
 * @description Controller for managing Core Motivations Generator UI and business logic
 */

import { BaseCharacterBuilderController } from '../../characterBuilder/controllers/BaseCharacterBuilderController.js';
import {
  validateDependency,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';

/** @typedef {import('../../characterBuilder/services/CoreMotivationsGenerator.js').CoreMotivationsGenerator} CoreMotivationsGenerator */
/** @typedef {import('../services/CoreMotivationsDisplayEnhancer.js').CoreMotivationsDisplayEnhancer} CoreMotivationsDisplayEnhancer */

/**
 * @typedef {object} ConceptGroup
 * @property {string} conceptId - The concept's unique identifier
 * @property {string} conceptTitle - The concept's display title
 * @property {Array<ThematicDirection>} directions - Directions in this concept
 */

/**
 * @typedef {object} ThematicDirection
 * @property {string} id - The direction's unique identifier
 * @property {string} conceptId - The parent concept's ID
 * @property {string} title - The direction's display title
 * @property {string} [description] - Optional description
 * @property {Array<string>} [tags] - Optional tags
 */

/**
 * @typedef {object} CharacterConcept
 * @property {string} id - The concept's unique identifier
 * @property {string} title - The concept's display title
 * @property {string} [description] - Optional description
 * @property {number} createdAt - Creation timestamp
 */

/**
 * @typedef {object} CoreMotivation
 * @property {string} id - The motivation's unique identifier
 * @property {string} directionId - Associated direction ID
 * @property {string} conceptId - Associated concept ID
 * @property {string} content - The generated motivation text
 * @property {Array<string>} contradictions - Internal contradictions
 * @property {string} centralQuestion - The driving question
 * @property {number} generatedAt - Generation timestamp
 */

/**
 * Controller for Core Motivations Generator functionality
 *
 * @augments BaseCharacterBuilderController
 */
class CoreMotivationsGeneratorController extends BaseCharacterBuilderController {
  #coreMotivationsGenerator;
  #displayEnhancer;
  #selectedDirectionId = null;
  #currentConceptId = ''; // Initialize as empty string instead of null to satisfy event validation
  #eligibleDirections = [];
  #directionsWithConceptsMap = new Map(); // Stores full direction+concept data
  #currentMotivations = [];
  #isGenerating = false;
  #currentSortOrder = 'newest';
  #currentSearchQuery = '';
  #searchDebounceTimer = null;
  // #lazyLoadEnabled = false; // Removed - not used in current implementation
  #currentLoadedCount = 20;
  #loadMoreObserver = null;
  #modalObserver = null; // Modal focus management observer

  /**
   * Currently selected direction object (cached for quick access)
   *
   * @type {ThematicDirection|null}
   */
  #currentDirection = null;

  /**
   * Concept of the currently selected direction (cached for quick access)
   *
   * @type {CharacterConcept|null}
   */
  #currentConcept = null;

  /**
   * Cache timestamp for data freshness
   *
   * @type {number|null}
   */
  #cacheTimestamp = null;

  /**
   * @param {object} _dependencies - Controller dependencies
   * @param {import('../../interfaces/ILogger.js').ILogger} _dependencies.logger
   * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} _dependencies.eventBus
   * @param {import('../../characterBuilder/services/characterBuilderService.js').CharacterBuilderService} _dependencies.characterBuilderService
   * @param {import('../../interfaces/coreServices.js').ISchemaValidator} _dependencies.schemaValidator
   * @param {CoreMotivationsGenerator} _dependencies.coreMotivationsGenerator
   * @param {CoreMotivationsDisplayEnhancer} _dependencies.displayEnhancer
   */
  constructor(_dependencies) {
    super(_dependencies);

    validateDependency(
      _dependencies.coreMotivationsGenerator,
      'CoreMotivationsGenerator',
      null,
      { logger: _dependencies.logger }
    );
    validateDependency(
      _dependencies.displayEnhancer,
      'CoreMotivationsDisplayEnhancer',
      null,
      { logger: _dependencies.logger }
    );

    this.#coreMotivationsGenerator = _dependencies.coreMotivationsGenerator;
    this.#displayEnhancer = _dependencies.displayEnhancer;
  }

  /**
   * Initialize the controller
   */
  async initialize() {
    try {
      this.logger.info('Initializing Core Motivations Generator Controller');

      // Load ALL eligible directions (those with clichés) from ALL concepts
      await this.#loadEligibleDirections();

      // Set up UI event listeners
      this.#setupEventListeners();

      // Set up accessibility features
      this.#setupFocusManagement();
      this.#setupScreenReaderIntegration();
      this.#ensureFocusVisible();

      // Load user preferences
      this.#loadUserPreferences();

      // Initialize UI state
      this.#updateUIState();

      // Dispatch initialization complete event
      this.eventBus.dispatch('core:core_motivations_ui_initialized', {
        conceptId: this.#currentConceptId || '', // Ensure it's always a string
        eligibleDirectionsCount: this.#eligibleDirections.length,
      });

      this.logger.info('Core Motivations Generator Controller initialized');
    } catch (error) {
      this.logger.error(
        'Failed to initialize Core Motivations Generator:',
        error
      );
      this.showError('Failed to initialize. Please refresh the page.');
      throw error;
    }
  }

  /**
   * Load directions that have associated clichés from ALL concepts
   */
  async #loadEligibleDirections() {
    try {
      // Step 1: Get ALL directions with their concepts (matching clichés generator)
      const directionsWithConcepts =
        await this.characterBuilderService.getAllThematicDirectionsWithConcepts();

      if (!directionsWithConcepts || directionsWithConcepts.length === 0) {
        this.#eligibleDirections = [];
        this.#handleNoDirectionsAvailable();
        return;
      }

      // Step 2: Filter to only those with clichés
      const eligibleItems = [];
      for (const item of directionsWithConcepts) {
        const hasClichés =
          await this.characterBuilderService.hasClichesForDirection(
            item.direction.id
          );
        if (hasClichés) {
          eligibleItems.push(item);
        }
      }

      if (eligibleItems.length === 0) {
        this.#eligibleDirections = [];
        this.#handleNoEligibleDirections();
        return;
      }

      // Step 3: Store the filtered data map for later use
      this.#directionsWithConceptsMap = new Map(
        eligibleItems.map((item) => [item.direction.id, item])
      );

      // Step 4: Extract directions and attach concept data for organization
      const directionsWithConceptData = eligibleItems.map((item) => ({
        ...item.direction,
        concept: item.concept, // Attach concept for #organizeDirectionsByConcept
      }));

      // Step 5: Store eligible directions
      this.#eligibleDirections = directionsWithConceptData;

      // Step 6: Populate the select dropdown (uses existing #populateDirectionSelector)
      this.#populateDirectionSelector();

      // Step 7: Update cache timestamp
      this.#cacheTimestamp = Date.now();

      this.logger.info(
        `Loaded ${this.#eligibleDirections.length} eligible directions from all concepts`
      );
    } catch (error) {
      this.logger.error('Failed to load eligible directions:', error);
      this.showError(
        'Failed to load thematic directions. Please refresh the page.'
      );
    }
  }

  /**
   * Handle when no directions exist at all
   */
  #handleNoDirectionsAvailable() {
    const selector = document.getElementById('direction-selector');
    const noDirectionsMsg = document.getElementById('no-directions-message');

    if (selector) {
      selector.style.display = 'none';
    }

    if (noDirectionsMsg) {
      noDirectionsMsg.style.display = 'block';
      noDirectionsMsg.textContent =
        'No thematic directions found. Please create thematic directions first.';
    }

    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
      generateBtn.disabled = true;
    }

    this.logger.warn('No thematic directions available in any concept');
    this.eventBus.dispatch('core:no_directions_available', {});
  }

  /**
   * Handle when directions exist but none have clichés
   */
  #handleNoEligibleDirections() {
    const selector = document.getElementById('direction-selector');
    const noDirectionsMsg = document.getElementById('no-directions-message');

    if (selector) {
      selector.style.display = 'none';
    }

    if (noDirectionsMsg) {
      noDirectionsMsg.style.display = 'block';
      noDirectionsMsg.textContent =
        'No thematic directions with clichés found. Please generate clichés for your directions first.';
    }

    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
      generateBtn.disabled = true;
    }

    this.logger.warn(
      'No eligible directions found (directions without clichés)'
    );
    this.eventBus.dispatch('core:no_eligible_directions', {});
  }

  /**
   * Populate direction selector dropdown with proper HTML structure
   */
  #populateDirectionSelector() {
    const selector = document.getElementById('direction-selector');
    const noDirectionsMsg = document.getElementById('no-directions-message');

    if (!selector) {
      this.logger.error('Direction selector element not found');
      return;
    }

    if (this.#eligibleDirections.length === 0) {
      selector.style.display = 'none';
      noDirectionsMsg.style.display = 'block';
      return;
    }

    selector.style.display = 'block';
    noDirectionsMsg.style.display = 'none';

    // Organize directions by concept for optgroups
    const organizedData = this.#organizeDirectionsByConcept(
      this.#eligibleDirections
    );

    // Clear existing options (keep default)
    selector.innerHTML =
      '<option value="">-- Choose a thematic direction --</option>';

    // Add optgroups for each concept
    for (const conceptGroup of organizedData) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = conceptGroup.conceptTitle;
      optgroup.id = `optgroup-${conceptGroup.conceptId}`;

      for (const direction of conceptGroup.directions) {
        const option = document.createElement('option');
        option.value = direction.id;
        option.textContent = direction.title;

        // Enhanced data attributes for better context
        option.dataset.conceptId = conceptGroup.conceptId;
        option.dataset.conceptTitle = conceptGroup.conceptTitle;
        option.dataset.directionTitle = direction.title;

        optgroup.appendChild(option);
      }

      selector.appendChild(optgroup);
    }

    // Enhanced event payload with detailed group information
    this.eventBus.dispatch('core:directions_loaded', {
      count: organizedData.reduce(
        (sum, group) => sum + group.directions.length,
        0
      ),
      groups: organizedData.length,
    });
  }

  /**
   * Organize directions by their associated concepts for optgroup display
   *
   * @param {Array} directions - Array of direction objects
   * @returns {Array} - Array of concept groups with nested directions
   */
  #organizeDirectionsByConcept(directions) {
    const conceptMap = new Map();

    for (const direction of directions) {
      // Extract concept info from direction (assuming direction has concept property)
      const conceptId = direction.concept?.id || 'unknown';
      const conceptText =
        direction.concept?.text || direction.concept?.concept || null;
      const conceptTitle = this.#extractConceptTitle(conceptText);

      if (!conceptMap.has(conceptId)) {
        conceptMap.set(conceptId, {
          conceptId,
          conceptTitle,
          directions: [],
        });
      }

      conceptMap.get(conceptId).directions.push(direction);
    }

    const organizedArray = Array.from(conceptMap.values());

    // Sort concept groups alphabetically by title
    organizedArray.sort((a, b) => a.conceptTitle.localeCompare(b.conceptTitle));

    // Sort directions within each concept group alphabetically by title
    organizedArray.forEach((group) => {
      group.directions.sort((a, b) => a.title.localeCompare(b.title));
    });

    this.logger.info(
      `Organized ${directions.length} directions into ${organizedArray.length} concept groups (sorted alphabetically)`
    );

    return organizedArray;
  }

  /**
   * Extract title from concept text (first line or first sentence)
   *
   * @param {string} conceptText - Full concept text
   * @returns {string} Short concept title (max 50 chars)
   * @private
   */
  #extractConceptTitle(conceptText) {
    // Handle null or undefined concept text
    if (!conceptText) {
      return 'Unknown Concept';
    }

    const firstLine = conceptText.split('\n')[0];
    const firstSentence = conceptText.split('.')[0];
    const title = (
      firstLine.length < firstSentence.length ? firstLine : firstSentence
    ).trim();
    return title.length > 50 ? title.substring(0, 47) + '...' : title;
  }

  /**
   * Select a thematic direction
   *
   * @param directionId
   */
  async #selectDirection(directionId) {
    assertNonBlankString(directionId, 'Direction ID');

    // Update selection in the select element
    const selector = document.getElementById('direction-selector');
    if (selector) {
      selector.value = directionId;
    }

    this.#selectedDirectionId = directionId;

    // Update cached direction and concept
    const item = this.#directionsWithConceptsMap.get(directionId);
    if (item) {
      this.#currentDirection = item.direction;
      this.#currentConcept = item.concept;
      this.#currentConceptId = item.concept.id;
    }

    // Load existing motivations for this direction
    await this.#loadExistingMotivations(directionId);

    // Enable generate button
    this.#updateUIState();

    // Dispatch selection event
    this.eventBus.dispatch('core:core_motivations_direction_selected', {
      directionId,
      conceptId: this.#currentConceptId || '', // Ensure it's always a string
    });
  }

  /**
   * Clear the selected direction
   */
  #clearDirection() {
    // Clear selection state
    this.#selectedDirectionId = null;
    this.#currentDirection = null;
    this.#currentConcept = null;
    this.#currentConceptId = '';

    // Update UI state to disable buttons
    this.#updateUIState();

    // Clear existing motivations display
    this.#currentMotivations = [];
    this.#currentSearchQuery = ''; // Clear search query to ensure proper display
    this.#displayMotivations();

    // Dispatch clear selection event
    this.eventBus.dispatch('core:core_motivations_direction_cleared', {
      conceptId: this.#currentConceptId || '', // Ensure it's always a string
    });
  }

  /**
   * Load existing motivations for a direction
   *
   * @param directionId
   */
  async #loadExistingMotivations(directionId) {
    try {
      const motivations =
        await this.characterBuilderService.getCoreMotivationsByDirectionId(
          directionId
        );

      this.#currentMotivations = motivations || [];
      this.#displayMotivations();

      this.eventBus.dispatch('core:core_motivations_retrieved', {
        directionId,
        count: this.#currentMotivations.length,
      });
    } catch (error) {
      this.logger.error('Failed to load existing motivations:', error);
      this.#currentMotivations = [];
    }
  }

  /**
   * Display motivations in the UI
   */
  #displayMotivations() {
    const container = document.getElementById('motivations-container');
    const emptyState = document.getElementById('empty-state');

    // Filter motivations based on search query
    let filteredMotivations = this.#filterMotivations(this.#currentMotivations);

    // Sort filtered motivations
    const sortedMotivations = this.#sortMotivations(filteredMotivations);

    // Update search results count
    this.#updateSearchResultsCount(filteredMotivations.length);

    // Display empty state or motivations
    if (sortedMotivations.length === 0) {
      if (this.#currentSearchQuery && this.#currentMotivations.length > 0) {
        container.style.display = 'block';
        emptyState.style.display = 'none';
        this.#displayNoSearchResults(container);
      } else {
        container.style.display = 'none';
        emptyState.style.display = 'flex';
      }
    } else {
      container.style.display = 'block';
      emptyState.style.display = 'none';

      // Use lazy loading for large datasets
      if (sortedMotivations.length > 50) {
        this.#displayWithLazyLoading(container, sortedMotivations);
      } else {
        this.#displayAllMotivations(container, sortedMotivations);
      }
    }
  }

  /**
   * Display all motivations without lazy loading
   *
   * @param {HTMLElement} container - Container element
   * @param {Array} motivations - Sorted motivations
   */
  #displayAllMotivations(container, motivations) {
    // Disconnect lazy load observer if active
    this.#disconnectLazyLoadObserver();

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();

    motivations.forEach((motivation) => {
      const element = this.#displayEnhancer.createMotivationBlock(motivation);
      fragment.appendChild(element);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
  }

  /**
   * Display motivations with lazy loading
   *
   * @param {HTMLElement} container - Container element
   * @param {Array} motivations - Sorted motivations
   */
  #displayWithLazyLoading(container, motivations) {
    this.#currentLoadedCount = 20;

    // Clear container
    container.innerHTML = '';

    // Create initial batch
    const fragment = document.createDocumentFragment();
    const initialBatch = motivations.slice(0, this.#currentLoadedCount);

    initialBatch.forEach((motivation) => {
      const element = this.#displayEnhancer.createMotivationBlock(motivation);
      fragment.appendChild(element);
    });

    container.appendChild(fragment);

    // Add load more indicator if there are more items
    if (motivations.length > this.#currentLoadedCount) {
      const loadMoreEl = document.createElement('div');
      loadMoreEl.id = 'load-more-trigger';
      loadMoreEl.className = 'load-more-trigger';
      loadMoreEl.innerHTML = `
        <div class="load-more-spinner"></div>
        <div class="load-more-text">Loading more...</div>
      `;
      container.appendChild(loadMoreEl);

      // Set up Intersection Observer for lazy loading
      this.#setupLazyLoadObserver(container, motivations, loadMoreEl);
    }
  }

  /**
   * Set up intersection observer for lazy loading
   *
   * @param {HTMLElement} container - Container element
   * @param {Array} motivations - All motivations
   * @param {HTMLElement} triggerEl - Load more trigger element
   */
  #setupLazyLoadObserver(container, motivations, triggerEl) {
    // Disconnect existing observer
    this.#disconnectLazyLoadObserver();

    // Create new observer
    this.#loadMoreObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.#loadMoreMotivations(container, motivations, triggerEl);
          }
        });
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    // Start observing
    this.#loadMoreObserver.observe(triggerEl);
  }

  /**
   * Load more motivations for lazy loading
   *
   * @param {HTMLElement} container - Container element
   * @param {Array} motivations - All motivations
   * @param {HTMLElement} triggerEl - Load more trigger element
   */
  #loadMoreMotivations(container, motivations, triggerEl) {
    const batchSize = 20;
    const startIndex = this.#currentLoadedCount;
    const endIndex = Math.min(startIndex + batchSize, motivations.length);

    // Load next batch
    const fragment = document.createDocumentFragment();
    const nextBatch = motivations.slice(startIndex, endIndex);

    nextBatch.forEach((motivation) => {
      const element = this.#displayEnhancer.createMotivationBlock(motivation);
      fragment.appendChild(element);
    });

    // Insert before trigger element
    container.insertBefore(fragment, triggerEl);

    // Update count
    this.#currentLoadedCount = endIndex;

    // Remove trigger if all items loaded
    if (this.#currentLoadedCount >= motivations.length) {
      this.#disconnectLazyLoadObserver();
      triggerEl.remove();
    }
  }

  /**
   * Disconnect lazy load observer
   */
  #disconnectLazyLoadObserver() {
    if (this.#loadMoreObserver) {
      this.#loadMoreObserver.disconnect();
      this.#loadMoreObserver = null;
    }
  }

  /**
   * Filter motivations based on search query
   *
   * @param {Array} motivations - Motivations to filter
   * @returns {Array} Filtered motivations
   */
  #filterMotivations(motivations) {
    if (!this.#currentSearchQuery) {
      return motivations;
    }

    const query = this.#currentSearchQuery.toLowerCase();
    return motivations.filter((motivation) => {
      const searchableText = [
        motivation.coreDesire || '',
        motivation.internalContradiction || '',
        motivation.centralQuestion || '',
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }

  /**
   * Sort motivations based on current sort order
   *
   * @param {Array} motivations - Motivations to sort
   * @returns {Array} Sorted motivations
   */
  #sortMotivations(motivations) {
    const sorted = [...motivations];

    switch (this.#currentSortOrder) {
      case 'oldest':
        return sorted.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
      case 'alphabetical':
        return sorted.sort((a, b) => {
          const aDesire = (a.coreDesire || '').toLowerCase();
          const bDesire = (b.coreDesire || '').toLowerCase();
          return aDesire.localeCompare(bDesire);
        });
      case 'newest':
      default:
        return sorted.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
    }
  }

  /**
   * Update search results count display
   *
   * @param {number} count - Number of results
   */
  #updateSearchResultsCount(count) {
    const resultsCount = document.getElementById('search-results-count');
    const searchCount = document.getElementById('search-count');

    if (!resultsCount || !searchCount) {
      return;
    }

    if (this.#currentSearchQuery) {
      searchCount.textContent = count;
      resultsCount.style.display = 'inline';
    } else {
      resultsCount.style.display = 'none';
    }
  }

  /**
   * Display no search results message
   *
   * @param {HTMLElement} container - Container element
   */
  #displayNoSearchResults(container) {
    container.innerHTML = `
      <div class="no-search-results">
        <div class="no-search-results-icon">🔍</div>
        <div class="no-search-results-text">No motivations found</div>
        <div class="no-search-results-hint">
          Try different search terms or clear the search
        </div>
      </div>
    `;
  }

  /**
   * Generate new core motivations
   */
  async #generateMotivations() {
    if (this.#isGenerating || !this.#selectedDirectionId) {
      return;
    }

    this.#isGenerating = true;
    this.#showLoadingState(true, 'Generating core motivations...');

    try {
      // Dispatch generation started event
      this.eventBus.dispatch('core:core_motivations_generation_started', {
        conceptId: this.#currentConceptId || '',
        directionId: this.#selectedDirectionId,
      });

      // Get required data
      const direction = this.#eligibleDirections.find(
        (d) => d.id === this.#selectedDirectionId
      );
      const concept = await this.characterBuilderService.getCharacterConcept(
        this.#currentConceptId
      );
      const clichés =
        await this.characterBuilderService.getClichesByDirectionId(
          this.#selectedDirectionId
        );

      // Generate motivations
      const newMotivations = await this.#coreMotivationsGenerator.generate({
        concept,
        direction,
        clichés,
      });

      // Save motivations (accumulative)
      const savedIds = await this.characterBuilderService.saveCoreMotivations(
        this.#selectedDirectionId,
        newMotivations
      );

      // Reload and display
      await this.#loadExistingMotivations(this.#selectedDirectionId);

      // Dispatch completion event
      this.eventBus.dispatch('core:core_motivations_generation_completed', {
        conceptId: this.#currentConceptId || '',
        directionId: this.#selectedDirectionId,
        motivationIds: savedIds,
        totalCount: this.#currentMotivations.length,
      });

      this.showSuccess('Core motivations generated successfully!');
    } catch (error) {
      this.logger.error('Failed to generate motivations:', error);

      this.eventBus.dispatch('core:core_motivations_generation_failed', {
        conceptId: this.#currentConceptId || '',
        directionId: this.#selectedDirectionId,
        error: error.message,
      });

      this.showError('Failed to generate motivations. Please try again.');
    } finally {
      this.#isGenerating = false;
      this.#showLoadingState(false);
    }
  }

  /**
   * Delete a specific motivation
   *
   * @param motivationId
   */
  async #deleteMotivation(motivationId) {
    assertNonBlankString(motivationId, 'Motivation ID');

    this.#showLoadingState(true, 'Deleting motivation...');

    try {
      const success =
        await this.characterBuilderService.removeCoreMotivationItem(
          this.#selectedDirectionId,
          motivationId
        );

      if (success) {
        // Reload and display
        await this.#loadExistingMotivations(this.#selectedDirectionId);

        this.eventBus.dispatch('core:core_motivations_deleted', {
          directionId: this.#selectedDirectionId,
          motivationId,
          remainingCount: this.#currentMotivations.length,
        });

        this.showSuccess('Motivation deleted');
      }
    } catch (error) {
      this.logger.error('Failed to delete motivation:', error);
      this.showError('Failed to delete motivation');
    } finally {
      this.#showLoadingState(false);
    }
  }

  /**
   * Clear all motivations for current direction
   */
  async #clearAllMotivations() {
    if (!this.#selectedDirectionId || this.#currentMotivations.length === 0) {
      return;
    }

    // Show confirmation modal
    const modal = document.getElementById('confirmation-modal');
    modal.style.display = 'flex';

    // Handle confirmation
    const confirmBtn = document.getElementById('confirm-clear');
    const cancelBtn = document.getElementById('cancel-clear');

    const handleConfirm = async () => {
      this.#closeModal();
      this.#showLoadingState(true, 'Clearing all motivations...');

      try {
        const deletedCount =
          await this.characterBuilderService.clearCoreMotivationsForDirection(
            this.#selectedDirectionId
          );

        this.#currentMotivations = [];
        this.#displayMotivations();

        this.showSuccess(`Cleared ${deletedCount} motivations`);
      } catch (error) {
        this.logger.error('Failed to clear motivations:', error);
        this.showError('Failed to clear motivations');
      } finally {
        this.#showLoadingState(false);
      }

      cleanup();
    };

    const handleCancel = () => {
      this.#closeModal();
      cleanup();
    };

    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  }

  /**
   * Export motivations to text
   */
  #exportToText() {
    if (this.#currentMotivations.length === 0) {
      this.showWarning('No motivations to export');
      return;
    }

    const direction = this.#eligibleDirections.find(
      (d) => d.id === this.#selectedDirectionId
    );
    const text = this.#displayEnhancer.formatMotivationsForExport(
      this.#currentMotivations,
      direction
    );

    // Generate filename with timestamp and direction name
    const filename = this.#generateExportFilename(direction);

    // Offer both download and clipboard options
    // For simplicity, we'll download the file AND copy to clipboard
    try {
      // Download as file
      this.#downloadAsFile(text, filename);

      // Also copy to clipboard for convenience
      navigator.clipboard
        .writeText(text)
        .then(() => {
          this.showSuccess('Motivations downloaded and copied to clipboard');

          // Dispatch export event
          this.eventBus.dispatch('core:core_motivations_exported', {
            directionId: this.#selectedDirectionId,
            method: 'file_and_clipboard',
            filename,
            motivationCount: this.#currentMotivations.length,
          });
        })
        .catch((error) => {
          this.logger.warn('Failed to copy to clipboard:', error);
          // Still successful if download worked
          this.showSuccess('Motivations downloaded to file');

          this.eventBus.dispatch('core:core_motivations_exported', {
            directionId: this.#selectedDirectionId,
            method: 'file_only',
            filename,
            motivationCount: this.#currentMotivations.length,
          });
        });
    } catch (error) {
      this.logger.error('Failed to export motivations:', error);
      this.showError('Failed to export motivations');

      // Try clipboard as fallback
      navigator.clipboard
        .writeText(text)
        .then(() => {
          this.showWarning('Download failed, but copied to clipboard');
        })
        .catch((clipboardError) => {
          this.logger.error('Both export methods failed:', clipboardError);
          this.showError('Failed to export motivations');
        });
    }
  }

  /**
   * Download text as a file
   *
   * @param {string} text - Text content to download
   * @param {string} filename - Name of the file to download
   */
  #downloadAsFile(text, filename) {
    try {
      // Create a Blob with the text content
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });

      // Create a temporary URL for the blob
      const url = URL.createObjectURL(blob);

      // Create a temporary anchor element and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';

      // Add to DOM, click, and remove
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up the URL object
      URL.revokeObjectURL(url);

      this.logger.info(`Downloaded motivations to file: ${filename}`);
    } catch (error) {
      this.logger.error('Failed to download file:', error);
      throw error;
    }
  }

  /**
   * Generate a filename for export with timestamp and direction name
   *
   * @param {object} direction - The selected direction object
   * @returns {string} Generated filename
   */
  #generateExportFilename(direction) {
    // Format: core-motivations_[direction-name]_YYYY-MM-DD_HH-mm.txt
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(':').slice(0, 2).join('-'); // HH-mm

    // Sanitize direction title for filename
    const directionName = direction
      ? direction.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : 'unknown';

    return `core-motivations_${directionName}_${dateStr}_${timeStr}.txt`;
  }

  /**
   * Handle search input
   *
   * @param {string} query - Search query
   */
  #handleSearch(query) {
    // Clear existing debounce timer
    if (this.#searchDebounceTimer) {
      clearTimeout(this.#searchDebounceTimer);
    }

    // Debounce search to avoid excessive updates
    this.#searchDebounceTimer = setTimeout(() => {
      this.#currentSearchQuery = query.trim();
      this.#displayMotivations();

      this.eventBus.dispatch('core:motivations_search_performed', {
        query: this.#currentSearchQuery,
        resultsCount: this.#filterMotivations(this.#currentMotivations).length,
      });
    }, 300);
  }

  /**
   * Handle sort order change
   *
   * @param {string} sortOrder - New sort order
   */
  #handleSortChange(sortOrder) {
    this.#currentSortOrder = sortOrder;

    // Save preference to localStorage
    try {
      localStorage.setItem('motivations-sort-order', sortOrder);
    } catch (error) {
      this.logger.warn('Failed to save sort preference:', error);
    }

    this.#displayMotivations();

    this.eventBus.dispatch('core:motivations_sort_changed', {
      sortOrder,
    });
  }

  /**
   * Load user preferences from localStorage
   */
  #loadUserPreferences() {
    try {
      const savedSort = localStorage.getItem('motivations-sort-order');
      if (savedSort) {
        this.#currentSortOrder = savedSort;
        const sortSelect = document.getElementById('motivation-sort');
        if (sortSelect) {
          sortSelect.value = savedSort;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load user preferences:', error);
    }
  }

  /**
   * Set up comprehensive keyboard shortcuts with accessibility support
   */
  #setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      // Existing: Ctrl+Enter for generation
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        this.#generateMotivations();
        this.#announceToScreenReader('Generating core motivations...');
        return;
      }

      // New: Ctrl+E for export
      if (event.ctrlKey && event.key === 'e') {
        event.preventDefault();
        this.#exportToText();
        return;
      }

      // New: Ctrl+Shift+Delete for clear all
      if (event.ctrlKey && event.shiftKey && event.key === 'Delete') {
        event.preventDefault();
        this.#clearAllMotivations();
        return;
      }

      // Enhanced: Escape to close modal
      if (event.key === 'Escape') {
        const modal = document.getElementById('confirmation-modal');
        if (modal && modal.style.display !== 'none') {
          modal.style.display = 'none';
          this.#announceToScreenReader('Modal closed');
          event.preventDefault();

          // Return focus to the element that triggered the modal
          const clearBtn = document.getElementById('clear-all-btn');
          if (clearBtn) {
            clearBtn.focus();
          }
          return;
        }
      }

      // Enhanced: Tab navigation with focus management
      if (event.key === 'Tab') {
        this.#ensureFocusVisible();
      }
    });
  }

  /**
   * Set up UI event listeners
   */
  #setupEventListeners() {
    // Generate button
    const generateBtn = document.getElementById('generate-btn');
    generateBtn?.addEventListener('click', () => this.#generateMotivations());

    // Clear all button
    const clearBtn = document.getElementById('clear-all-btn');
    clearBtn?.addEventListener('click', () => this.#clearAllMotivations());

    // Export button
    const exportBtn = document.getElementById('export-btn');
    exportBtn?.addEventListener('click', () => this.#exportToText());

    // Search input
    const searchInput = document.getElementById('motivation-search');
    searchInput?.addEventListener('input', (e) => {
      this.#handleSearch(e.target.value);
    });

    // Sort select
    const sortSelect = document.getElementById('motivation-sort');
    sortSelect?.addEventListener('change', (e) => {
      this.#handleSortChange(e.target.value);
    });

    // Direction selector
    const directionSelect = document.getElementById('direction-selector');
    directionSelect?.addEventListener('change', (e) => {
      const directionId = e.target.value;
      if (directionId) {
        this.#selectDirection(directionId);
      } else {
        this.#clearDirection();
      }
    });

    // Back button
    const backBtn = document.getElementById('back-btn');
    backBtn?.addEventListener('click', () => {
      /* istanbul ignore next -- jsdom cannot emulate navigation */
      this.navigateToIndex();
    });

    // Enhanced keyboard shortcuts with accessibility support
    this.#setupKeyboardShortcuts();

    // Delegation for dynamic elements
    document.addEventListener('click', (event) => {
      // Handle motivation delete buttons
      if (event.target.classList.contains('delete-motivation-btn')) {
        const motivationId = event.target.dataset.motivationId;
        this.#deleteMotivation(motivationId);
      }

      // Handle motivation copy buttons
      if (event.target.classList.contains('copy-motivation-btn')) {
        const motivationId = event.target.dataset.motivationId;
        this.#copyMotivation(motivationId);
      }
    });
  }

  /**
   * Copy a specific motivation to clipboard
   *
   * @param motivationId
   */
  #copyMotivation(motivationId) {
    const motivation = this.#currentMotivations.find(
      (m) => m.id === motivationId
    );
    if (motivation) {
      const text = this.#displayEnhancer.formatSingleMotivation(motivation);
      navigator.clipboard.writeText(text).then(() => {
        this.showSuccess('Motivation copied to clipboard');
      });
    }
  }

  /**
   * Update UI state based on current data
   */
  #updateUIState() {
    const generateBtn = document.getElementById('generate-btn');
    const clearBtn = document.getElementById('clear-all-btn');
    const exportBtn = document.getElementById('export-btn');

    // Enable/disable buttons based on state
    if (generateBtn) {
      generateBtn.disabled = !this.#selectedDirectionId || this.#isGenerating;
    }

    if (clearBtn) {
      clearBtn.disabled = this.#currentMotivations.length === 0;
    }

    if (exportBtn) {
      exportBtn.disabled = this.#currentMotivations.length === 0;
    }

    // Optional: Update direction display if UI element exists
    const selectedDisplay = document.getElementById(
      'selected-direction-display'
    );
    if (selectedDisplay) {
      const direction = this.currentDirection; // Use getter
      const concept = this.currentConcept; // Use getter

      if (direction && concept) {
        selectedDisplay.innerHTML = `
          <div class="selected-info">
            <strong>Concept:</strong> ${concept.text || concept.title || 'Unknown'}<br>
            <strong>Direction:</strong> ${direction.title}
          </div>
        `;
      } else {
        selectedDisplay.innerHTML = '<em>No direction selected</em>';
      }
    }

    // Optional: Add counter display
    const directionCount = document.getElementById('direction-count');
    if (directionCount) {
      directionCount.textContent = `${this.#eligibleDirections.length} directions available`;
    }
  }

  /**
   * Show/hide loading state with contextual messages
   *
   * @param {boolean} show - Whether to show loading state
   * @param {string} [message] - Optional loading message
   */
  #showLoadingState(show, message = 'Loading...') {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = show ? 'flex' : 'none';

      if (show) {
        // Update loading message if provided
        const loadingText = loadingIndicator.querySelector('p');
        if (loadingText && message) {
          loadingText.textContent = message;
        }
      }
    }

    // Disable/enable buttons during loading to prevent multiple operations
    this.#setButtonsDisabled(show);
    this.#updateUIState();
  }

  /**
   * Enable/disable buttons during loading operations
   *
   * @param {boolean} disabled - Whether buttons should be disabled
   * @private
   */
  #setButtonsDisabled(disabled) {
    const buttonsToDisable = ['generate-btn', 'clear-all-btn', 'export-btn'];

    buttonsToDisable.forEach((buttonId) => {
      const button = document.getElementById(buttonId);
      if (button && disabled) {
        button.disabled = true;
        button.classList.add('loading-disabled');
      } else if (button && !disabled) {
        button.classList.remove('loading-disabled');
        // Let #updateUIState handle the proper enabled/disabled logic
      }
    });
  }

  /**
   * Set up focus management and modal accessibility
   */
  #setupFocusManagement() {
    const modal = document.getElementById('confirmation-modal');
    const confirmBtn = document.getElementById('confirm-clear');
    const cancelBtn = document.getElementById('cancel-clear');

    if (!modal || !confirmBtn || !cancelBtn) {
      return;
    }

    // Focus trap implementation for modal
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const focusableElements = [confirmBtn, cancelBtn].filter(
          (el) => el && !el.disabled
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        } else if (!e.shiftKey && document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        this.#closeModal();
      }
    });

    // Auto-focus when modal opens
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'style'
        ) {
          if (modal.style.display === 'flex') {
            // Modal opened - focus first button after a brief delay for screen readers
            setTimeout(() => confirmBtn.focus(), 100);
            this.#announceToScreenReader(
              'Confirmation dialog opened. Clear all motivations?'
            );
          }
        }
      });
    });

    observer.observe(modal, { attributes: true });

    // Store observer for cleanup
    this.#modalObserver = observer;
  }

  /**
   * Close the confirmation modal
   */
  #closeModal() {
    const modal = document.getElementById('confirmation-modal');
    if (modal) {
      modal.style.display = 'none';
      this.#announceToScreenReader('Dialog closed');

      // Return focus to clear button
      const clearBtn = document.getElementById('clear-all-btn');
      if (clearBtn) {
        clearBtn.focus();
      }
    }
  }

  /**
   * Enhanced focus indicators for keyboard navigation
   */
  #ensureFocusVisible() {
    // Add visible focus indicators that work with keyboard navigation
    const focusableElements = document.querySelectorAll(
      'button, select, input, [tabindex]:not([tabindex="-1"])'
    );

    focusableElements.forEach((element) => {
      element.addEventListener('focus', () => {
        element.classList.add('keyboard-focus');
      });

      element.addEventListener('blur', () => {
        element.classList.remove('keyboard-focus');
      });

      element.addEventListener('mousedown', () => {
        element.classList.remove('keyboard-focus');
      });
    });
  }

  /**
   * Set up screen reader announcements for state changes
   */
  #setupScreenReaderIntegration() {
    // Enhance existing event listeners to include ARIA live announcements

    // Hook into existing generation events
    this.eventBus.subscribe('core:core_motivations_generation_started', () => {
      this.#announceToScreenReader('Generating core motivations...');
    });

    this.eventBus.subscribe(
      'core:core_motivations_generation_completed',
      (event) => {
        const count = event.payload.totalCount;
        this.#announceToScreenReader(
          `Generated motivations. Total: ${count} motivations available.`
        );
      }
    );

    this.eventBus.subscribe('core:core_motivations_generation_failed', () => {
      this.#announceToScreenReader(
        'Failed to generate motivations. Please try again.'
      );
    });

    this.eventBus.subscribe('core:core_motivations_deleted', (event) => {
      const remaining = event.payload.remainingCount;
      this.#announceToScreenReader(
        `Motivation deleted. ${remaining} motivations remaining.`
      );
    });

    // Listen for custom copy events from DisplayEnhancer
    document.addEventListener('motivationCopied', () => {
      this.#announceToScreenReader('Motivation copied to clipboard');
    });

    document.addEventListener('motivationCopyFailed', () => {
      this.#announceToScreenReader('Failed to copy motivation');
    });
  }

  /**
   * Announce messages to screen readers using ARIA live regions
   *
   * @param {string} message - Message to announce
   */
  #announceToScreenReader(message) {
    // Use existing aria-live regions or create one
    let announcer = document.getElementById('sr-announcements');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'sr-announcements';
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.style.position = 'absolute';
      announcer.style.left = '-10000px';
      announcer.style.width = '1px';
      announcer.style.height = '1px';
      announcer.style.overflow = 'hidden';
      document.body.appendChild(announcer);
    }

    announcer.textContent = message;
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }

  /**
   * Handle errors
   *
   * @param error
   */
  handleError(error) {
    this.logger.error('Core Motivations Generator error:', error);
    this.showError('An error occurred. Please try again.');
  }

  /**
   * Show warning message to user
   *
   * @param {string} message - Warning message to display
   */
  showWarning(message) {
    this.logger.warn(message);
    this.#announceToScreenReader(message);
  }

  /**
   * Show success message to user
   *
   * @param {string} message - Success message to display
   */
  showSuccess(message) {
    this.logger.info(message);
    this.#announceToScreenReader(message);
  }

  /**
   * Show error message to user
   *
   * @param {string} message - Error message to display
   */
  showError(message) {
    this.logger.error(message);
    this.#announceToScreenReader(`Error: ${message}`);
  }

  /**
   * @description Navigate back to the index page.
   * @returns {void}
   */
  navigateToIndex() {
    /* istanbul ignore next -- jsdom does not implement full navigation APIs */
    window.location.assign('index.html');
  }

  /**
   * Testing methods - exposed for unit tests only
   */

  // Getters for testing
  get eligibleDirections() {
    return this.#eligibleDirections;
  }

  set eligibleDirections(directions) {
    this.#eligibleDirections = directions;
  }

  // Method access for testing
  populateDirectionSelector() {
    return this.#populateDirectionSelector();
  }

  organizeDirectionsByConcept(directions) {
    return this.#organizeDirectionsByConcept(directions);
  }

  /**
   * Public getters for state access
   */

  /**
   * Get the currently selected direction object from the map
   *
   * @returns {object | null}
   */
  get currentDirection() {
    if (!this.#selectedDirectionId) return null;
    const item = this.#directionsWithConceptsMap.get(this.#selectedDirectionId);
    return item?.direction || null;
  }

  /**
   * Get the concept of the current direction from the map
   *
   * @returns {object | null}
   */
  get currentConcept() {
    if (!this.#selectedDirectionId) return null;
    const item = this.#directionsWithConceptsMap.get(this.#selectedDirectionId);
    return item?.concept || null;
  }

  /**
   * Get the selected direction ID
   *
   * @returns {string|null}
   */
  get selectedDirectionId() {
    return this.#selectedDirectionId;
  }

  /**
   * Check if currently generating (loading)
   *
   * @returns {boolean}
   */
  get isGenerating() {
    return this.#isGenerating;
  }

  /**
   * Get the total count of eligible directions
   *
   * @returns {number}
   */
  get totalDirectionsCount() {
    return this.#eligibleDirections.length;
  }
}

export { CoreMotivationsGeneratorController };
