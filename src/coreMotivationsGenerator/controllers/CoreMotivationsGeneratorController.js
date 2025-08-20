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
 * Controller for Core Motivations Generator functionality
 *
 * @augments BaseCharacterBuilderController
 */
class CoreMotivationsGeneratorController extends BaseCharacterBuilderController {
  #coreMotivationsGenerator;
  #displayEnhancer;
  #selectedDirectionId = null;
  #currentConceptId = null;
  #eligibleDirections = [];
  #currentMotivations = [];
  #isGenerating = false;
  #currentSortOrder = 'newest';
  #currentSearchQuery = '';
  #searchDebounceTimer = null;
  #lazyLoadEnabled = false;
  #currentLoadedCount = 20;
  #loadMoreObserver = null;

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

      // Load current concept
      await this.#loadCurrentConcept();

      // Load eligible directions (those with clichés)
      await this.#loadEligibleDirections();

      // Set up UI event listeners
      this.#setupEventListeners();

      // Load user preferences
      this.#loadUserPreferences();

      // Initialize UI state
      this.#updateUIState();

      // Dispatch initialization complete event
      this.eventBus.dispatch({
        type: 'CORE_MOTIVATIONS_UI_INITIALIZED',
        payload: {
          conceptId: this.#currentConceptId,
          eligibleDirectionsCount: this.#eligibleDirections.length,
        },
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
   * Load the current character concept
   */
  async #loadCurrentConcept() {
    try {
      const concepts =
        await this.characterBuilderService.getAllCharacterConcepts();
      if (concepts && concepts.length > 0) {
        // Get the most recent concept
        this.#currentConceptId = concepts[concepts.length - 1].id;
        this.logger.info(`Loaded concept: ${this.#currentConceptId}`);
      } else {
        throw new Error('No character concept found');
      }
    } catch (error) {
      this.logger.error('Failed to load character concept:', error);
      throw error;
    }
  }

  /**
   * Load directions that have associated clichés
   */
  async #loadEligibleDirections() {
    try {
      const allDirections =
        await this.characterBuilderService.getThematicDirectionsByConceptId(
          this.#currentConceptId
        );

      // Filter to only directions with clichés
      const eligibleDirections = [];
      for (const direction of allDirections) {
        const hasClichés =
          await this.characterBuilderService.hasClichesForDirection(
            direction.id
          );
        if (hasClichés) {
          eligibleDirections.push(direction);
        }
      }

      this.#eligibleDirections = eligibleDirections;
      this.logger.info(
        `Found ${eligibleDirections.length} eligible directions`
      );

      // Display directions or show empty message
      this.#displayDirections();
    } catch (error) {
      this.logger.error('Failed to load eligible directions:', error);
      throw error;
    }
  }

  /**
   * Display eligible directions in the UI
   */
  #displayDirections() {
    const container = document.getElementById('direction-selector');
    const noDirectionsMsg = document.getElementById('no-directions-message');

    if (this.#eligibleDirections.length === 0) {
      container.style.display = 'none';
      noDirectionsMsg.style.display = 'block';
      return;
    }

    container.style.display = 'block';
    noDirectionsMsg.style.display = 'none';
    container.innerHTML = '';

    this.#eligibleDirections.forEach((direction) => {
      const element = this.#createDirectionElement(direction);
      container.appendChild(element);
    });
  }

  /**
   * Create a direction element
   *
   * @param direction
   */
  #createDirectionElement(direction) {
    const div = document.createElement('div');
    div.className = 'direction-item';
    div.dataset.directionId = direction.id;

    const title = document.createElement('h3');
    title.textContent = direction.title;
    div.appendChild(title);

    const theme = document.createElement('p');
    theme.textContent = direction.theme;
    theme.className = 'direction-theme';
    div.appendChild(theme);

    div.addEventListener('click', () => this.#selectDirection(direction.id));

    return div;
  }

  /**
   * Select a thematic direction
   *
   * @param directionId
   */
  async #selectDirection(directionId) {
    assertNonBlankString(directionId, 'Direction ID');

    // Update selection UI
    document.querySelectorAll('.direction-item').forEach((item) => {
      item.classList.toggle(
        'selected',
        item.dataset.directionId === directionId
      );
    });

    this.#selectedDirectionId = directionId;

    // Load existing motivations for this direction
    await this.#loadExistingMotivations(directionId);

    // Enable generate button
    this.#updateUIState();

    // Dispatch selection event
    this.eventBus.dispatch({
      type: 'CORE_MOTIVATIONS_DIRECTION_SELECTED',
      payload: {
        directionId,
        conceptId: this.#currentConceptId,
      },
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

      this.eventBus.dispatch({
        type: 'CORE_MOTIVATIONS_RETRIEVED',
        payload: {
          directionId,
          count: this.#currentMotivations.length,
        },
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
    this.#lazyLoadEnabled = false;

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
    this.#lazyLoadEnabled = true;
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
      this.eventBus.dispatch({
        type: 'CORE_MOTIVATIONS_GENERATION_STARTED',
        payload: {
          conceptId: this.#currentConceptId,
          directionId: this.#selectedDirectionId,
        },
      });

      // Get required data
      const direction = this.#eligibleDirections.find(
        (d) => d.id === this.#selectedDirectionId
      );
      const concept =
        await this.characterBuilderService.getCharacterConceptById(
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
      this.eventBus.dispatch({
        type: 'CORE_MOTIVATIONS_GENERATION_COMPLETED',
        payload: {
          conceptId: this.#currentConceptId,
          directionId: this.#selectedDirectionId,
          motivationIds: savedIds,
          totalCount: this.#currentMotivations.length,
        },
      });

      this.showSuccess('Core motivations generated successfully!');
    } catch (error) {
      this.logger.error('Failed to generate motivations:', error);

      this.eventBus.dispatch({
        type: 'CORE_MOTIVATIONS_GENERATION_FAILED',
        payload: {
          conceptId: this.#currentConceptId,
          directionId: this.#selectedDirectionId,
          error: error.message,
        },
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

        this.eventBus.dispatch({
          type: 'CORE_MOTIVATIONS_DELETED',
          payload: {
            directionId: this.#selectedDirectionId,
            motivationId,
            remainingCount: this.#currentMotivations.length,
          },
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
      modal.style.display = 'none';
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
      modal.style.display = 'none';
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
          this.eventBus.dispatch({
            type: 'CORE_MOTIVATIONS_EXPORTED',
            payload: {
              directionId: this.#selectedDirectionId,
              method: 'file_and_clipboard',
              filename,
              motivationCount: this.#currentMotivations.length,
            },
          });
        })
        .catch((error) => {
          this.logger.warn('Failed to copy to clipboard:', error);
          // Still successful if download worked
          this.showSuccess('Motivations downloaded to file');

          this.eventBus.dispatch({
            type: 'CORE_MOTIVATIONS_EXPORTED',
            payload: {
              directionId: this.#selectedDirectionId,
              method: 'file_only',
              filename,
              motivationCount: this.#currentMotivations.length,
            },
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

      this.eventBus.dispatch({
        type: 'MOTIVATIONS_SEARCH_PERFORMED',
        payload: {
          query: this.#currentSearchQuery,
          resultsCount: this.#filterMotivations(this.#currentMotivations)
            .length,
        },
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

    this.eventBus.dispatch({
      type: 'MOTIVATIONS_SORT_CHANGED',
      payload: { sortOrder },
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

    // Back button
    const backBtn = document.getElementById('back-btn');
    backBtn?.addEventListener('click', () => {
      window.location.href = 'index.html';
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        this.#generateMotivations();
      }
    });

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
    // For now, use console.warn as a simple implementation
    // This could be enhanced to use a UI notification system
    console.warn(message);
    this.logger.warn(message);
  }

  /**
   * Show success message to user
   *
   * @param {string} message - Success message to display
   */
  showSuccess(message) {
    // For now, use console.log as a simple implementation
    // This could be enhanced to use a UI notification system
    console.log(message);
    this.logger.info(message);
  }

  /**
   * Show error message to user
   *
   * @param {string} message - Error message to display
   */
  showError(message) {
    // For now, use console.error as a simple implementation
    // This could be enhanced to use a UI notification system
    console.error(message);
    this.logger.error(message);
  }
}

export { CoreMotivationsGeneratorController };
