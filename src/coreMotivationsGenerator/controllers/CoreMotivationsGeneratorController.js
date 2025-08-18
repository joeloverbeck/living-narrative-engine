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

    if (this.#currentMotivations.length === 0) {
      container.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    container.style.display = 'block';
    emptyState.style.display = 'none';
    container.innerHTML = '';

    // Display motivations in reverse chronological order (newest first)
    const sortedMotivations = [...this.#currentMotivations].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    sortedMotivations.forEach((motivation) => {
      const element = this.#displayEnhancer.createMotivationBlock(motivation);
      container.appendChild(element);
    });
  }

  /**
   * Generate new core motivations
   */
  async #generateMotivations() {
    if (this.#isGenerating || !this.#selectedDirectionId) {
      return;
    }

    this.#isGenerating = true;
    this.#showLoadingState(true);

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

    const text = this.#displayEnhancer.formatMotivationsForExport(
      this.#currentMotivations,
      this.#eligibleDirections.find((d) => d.id === this.#selectedDirectionId)
    );

    // Copy to clipboard
    navigator.clipboard
      .writeText(text)
      .then(() => {
        this.showSuccess('Motivations copied to clipboard');
      })
      .catch((error) => {
        this.logger.error('Failed to copy to clipboard:', error);
        this.showError('Failed to copy to clipboard');
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
   * Show/hide loading state
   *
   * @param show
   */
  #showLoadingState(show) {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = show ? 'flex' : 'none';
    }
    this.#updateUIState();
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
