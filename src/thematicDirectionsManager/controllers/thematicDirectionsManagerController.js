/**
 * @file Controller for thematic directions management interface
 * @description Manages UI for viewing, editing, and organizing thematic directions
 */

import { BaseCharacterBuilderController } from '../../characterBuilder/controllers/BaseCharacterBuilderController.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  UIStateManager,
  UI_STATES,
} from '../../shared/characterBuilder/uiStateManager.js';
import { PreviousItemsDropdown } from '../../shared/characterBuilder/previousItemsDropdown.js';
import { InPlaceEditor } from '../../shared/characterBuilder/inPlaceEditor.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../characterBuilder/services/characterBuilderService.js').CharacterBuilderService} CharacterBuilderService
 * @typedef {import('../../characterBuilder/models/characterConcept.js').CharacterConcept} CharacterConcept
 * @typedef {import('../../characterBuilder/models/thematicDirection.js').ThematicDirection} ThematicDirection
 * @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 */

/**
 * Controller for thematic directions manager interface
 *
 * @augments BaseCharacterBuilderController
 */
export class ThematicDirectionsManagerController extends BaseCharacterBuilderController {
  // Page-specific private fields only (base class provides logger, characterBuilderService, eventBus via getters)
  #conceptDropdown;
  #currentFilter = '';
  #currentConcept = null;
  #directionsData = [];
  #inPlaceEditors = new Map(); // Track InPlaceEditor instances

  // DOM element references
  #elements = {};

  /**
   * Creates a new ThematicDirectionsManagerController instance
   *
   * @param {object} dependencies - The dependencies object
   * @param {ILogger} dependencies.logger - Logger instance (validated by base class)
   * @param {CharacterBuilderService} dependencies.characterBuilderService - Character builder service (validated by base class)
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event dispatcher (validated by base class)
   * @param {ISchemaValidator} dependencies.schemaValidator - Schema validator (validated by base class)
   * @param {UIStateManager} dependencies.uiStateManager - UI state management (validated here)
   */
  constructor({ logger, characterBuilderService, eventBus, schemaValidator, uiStateManager }) {
    super({ logger, characterBuilderService, eventBus, schemaValidator, uiStateManager });

    // Initialize page-specific fields
    this.#currentFilter = '';
    this.#currentConcept = null;
    this.#directionsData = [];
    this.#inPlaceEditors = new Map();
  }

  /**
   * Define validation rules for additional services not handled by base class
   *
   * @private
   * @override
   * @returns {object} Validation rules for additional services
   */
  #getAdditionalServiceValidationRules() {
    return {
      uiStateManager: {
        requiredMethods: ['showState', 'showError']
      }
    };
  }

  /**
   * Get the UI state manager from additional services
   *
   * @private
   * @returns {UIStateManager} UI state manager instance
   */
  get #uiStateManager() {
    return this.additionalServices.uiStateManager;
  }

  /**
   * Initialize the thematic directions manager UI
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Cache DOM elements
      this.#cacheElements();

      // Initialize concept dropdown
      this.#conceptDropdown = new PreviousItemsDropdown({
        element: this.#elements.conceptSelector,
        onSelectionChange: this.#handleConceptSelection.bind(this),
        labelText: 'Choose Concept:',
      });

      // Initialize service
      await this.characterBuilderService.initialize();

      // Set up event listeners
      this.#setupEventListeners();

      // Load initial data
      await this.#loadDirectionsData();

      this.logger.info(
        'ThematicDirectionsManagerController: Successfully initialized'
      );
    } catch (error) {
      this.logger.error(
        'ThematicDirectionsManagerController: Failed to initialize',
        error
      );
      if (this.#uiStateManager) {
        this.#uiStateManager.showError(
          'Failed to initialize directions manager. Please refresh the page.'
        );
      }
    }
  }

  /**
   * Cache DOM element references
   *
   * @private
   */
  #cacheElements() {
    // Main containers
    this.#elements.conceptSelector =
      document.getElementById('concept-selector');
    this.#elements.directionFilter =
      document.getElementById('direction-filter');
    this.#elements.directionsResults =
      document.getElementById('directions-results');

    // Concept display elements
    this.#elements.conceptDisplayContainer = document.getElementById(
      'concept-display-container'
    );
    this.#elements.conceptDisplayContent = document.getElementById(
      'concept-display-content'
    );

    // State containers
    this.#elements.emptyState = document.getElementById('empty-state');
    this.#elements.loadingState = document.getElementById('loading-state');
    this.#elements.errorState = document.getElementById('error-state');
    this.#elements.resultsState = document.getElementById('results-state');

    // Action buttons
    this.#elements.refreshBtn = document.getElementById('refresh-btn');
    this.#elements.cleanupOrphansBtn = document.getElementById(
      'cleanup-orphans-btn'
    );
    this.#elements.backBtn = document.getElementById('back-to-menu-btn');
    this.#elements.retryBtn = document.getElementById('retry-btn');

    // Stats display
    this.#elements.totalDirections =
      document.getElementById('total-directions');
    this.#elements.orphanedCount = document.getElementById('orphaned-count');

    // Modal elements
    this.#elements.confirmationModal =
      document.getElementById('confirmation-modal');
    this.#elements.modalTitle = document.getElementById('modal-title');
    this.#elements.modalMessage = document.getElementById('modal-message');
    this.#elements.modalConfirmBtn =
      document.getElementById('modal-confirm-btn');
    this.#elements.modalCancelBtn = document.getElementById('modal-cancel-btn');
    this.#elements.closeModalBtn = document.getElementById('close-modal-btn');
  }

  /**
   * Set up event listeners
   *
   * @private
   */
  #setupEventListeners() {
    // Filter input
    if (this.#elements.directionFilter) {
      this.#elements.directionFilter.addEventListener('input', (e) => {
        this.#currentFilter = e.target.value.toLowerCase();
        this.#filterAndDisplayDirections();
      });
    }

    // Action buttons
    if (this.#elements.refreshBtn) {
      this.#elements.refreshBtn.addEventListener('click', () => {
        this.#loadDirectionsData();
      });
    }

    if (this.#elements.cleanupOrphansBtn) {
      this.#elements.cleanupOrphansBtn.addEventListener('click', () => {
        this.#handleCleanupOrphans();
      });
    }

    if (this.#elements.backBtn) {
      this.#elements.backBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    if (this.#elements.retryBtn) {
      this.#elements.retryBtn.addEventListener('click', () => {
        this.#loadDirectionsData();
      });
    }

    // Modal events
    if (this.#elements.modalCancelBtn) {
      this.#elements.modalCancelBtn.addEventListener('click', () => {
        this.#hideModal();
      });
    }

    if (this.#elements.closeModalBtn) {
      this.#elements.closeModalBtn.addEventListener('click', () => {
        this.#hideModal();
      });
    }

    // Close modal on backdrop click
    if (this.#elements.confirmationModal) {
      this.#elements.confirmationModal.addEventListener('click', (e) => {
        if (e.target === this.#elements.confirmationModal) {
          this.#hideModal();
        }
      });
    }
  }

  /**
   * Load all directions data
   *
   * @private
   */
  async #loadDirectionsData() {
    this.#uiStateManager.showState(UI_STATES.LOADING);

    try {
      // Load all directions with their concepts
      const directionsWithConcepts =
        await this.characterBuilderService.getAllThematicDirectionsWithConcepts();

      // Extract unique concepts that have associated directions
      const conceptsWithDirections = this.#extractConceptsWithDirections(
        directionsWithConcepts
      );

      // Update dropdown with filtered concepts
      await this.#conceptDropdown.loadItems(conceptsWithDirections);

      // Store data
      this.#directionsData = directionsWithConcepts;

      // Update stats
      this.#updateStats();

      // Display directions
      this.#filterAndDisplayDirections();

      this.logger.info(
        'ThematicDirectionsManagerController: Loaded directions data',
        {
          directionCount: this.#directionsData.length,
          conceptsWithDirections: conceptsWithDirections.length,
        }
      );
    } catch (error) {
      this.logger.error(
        'ThematicDirectionsManagerController: Failed to load directions',
        error
      );
      this.#uiStateManager.showError(
        'Failed to load thematic directions. Please try again.'
      );
    }
  }

  /**
   * Update statistics display
   *
   * @private
   */
  #updateStats() {
    const totalCount = this.#directionsData.length;
    const orphanedCount = this.#directionsData.filter(
      (item) => !item.concept
    ).length;

    if (this.#elements.totalDirections) {
      this.#elements.totalDirections.textContent = totalCount;
    }

    if (this.#elements.orphanedCount) {
      this.#elements.orphanedCount.textContent = orphanedCount;
    }

    // Update cleanup button state
    if (this.#elements.cleanupOrphansBtn) {
      this.#elements.cleanupOrphansBtn.disabled = orphanedCount === 0;
    }
  }

  /**
   * Filter and display directions based on current filters
   *
   * @private
   */
  #filterAndDisplayDirections() {
    let filteredData = [...this.#directionsData];

    // Filter by concept
    if (this.#currentConcept === 'orphaned') {
      filteredData = filteredData.filter((item) => !item.concept);
    } else if (this.#currentConcept) {
      filteredData = filteredData.filter(
        (item) => item.concept && item.concept.id === this.#currentConcept
      );
    }

    // Filter by search text
    if (this.#currentFilter) {
      filteredData = filteredData.filter((item) => {
        const direction = item.direction;
        return (
          direction.title.toLowerCase().includes(this.#currentFilter) ||
          direction.description.toLowerCase().includes(this.#currentFilter) ||
          direction.coreTension.toLowerCase().includes(this.#currentFilter) ||
          direction.uniqueTwist.toLowerCase().includes(this.#currentFilter) ||
          direction.narrativePotential
            .toLowerCase()
            .includes(this.#currentFilter)
        );
      });
    }

    // Display results
    if (filteredData.length === 0) {
      this.#uiStateManager.showState(UI_STATES.EMPTY);
    } else {
      this.#displayDirections(filteredData);
      this.#uiStateManager.showState(UI_STATES.RESULTS);
    }
  }

  /**
   * Display directions in the UI
   *
   * @private
   * @param {Array<{direction: ThematicDirection, concept: CharacterConcept|null}>} directionsData - Directions with their concepts to display
   */
  #displayDirections(directionsData) {
    // Clean up existing InPlaceEditor instances
    this.#cleanupInPlaceEditors();

    // Clear previous results
    this.#elements.directionsResults.innerHTML = '';

    // Create directions container
    const container = document.createElement('div');
    container.className = 'directions-container';

    // Add each direction
    directionsData.forEach((item) => {
      const directionElement = this.#createEditableDirectionElement(
        item.direction,
        item.concept
      );
      container.appendChild(directionElement);
    });

    // Append to results
    this.#elements.directionsResults.appendChild(container);
  }

  /**
   * Create an editable direction element
   *
   * @private
   * @param {ThematicDirection} direction - Direction data
   * @param {CharacterConcept|null} concept - Associated concept
   * @returns {HTMLElement} Direction element
   */
  #createEditableDirectionElement(direction, concept) {
    const article = document.createElement('article');
    article.className = 'direction-card-editable cb-card-editable';
    article.setAttribute('data-direction-id', direction.id);
    article.setAttribute('role', 'article');
    article.setAttribute('aria-labelledby', `direction-title-${direction.id}`);

    // Card header with concept info and actions
    const header = document.createElement('div');
    header.className = 'direction-card-header';

    const conceptInfo = document.createElement('div');
    conceptInfo.className = concept
      ? 'direction-concept-info'
      : 'direction-concept-info orphaned';
    conceptInfo.textContent = concept
      ? `From concept: ${concept.concept.substring(0, 60)}${concept.concept.length > 60 ? '...' : ''}`
      : 'Orphaned direction (no associated concept)';
    header.appendChild(conceptInfo);

    const actions = document.createElement('div');
    actions.className = 'direction-actions';

    // Edit button removed - inline editing is always available via InPlaceEditor

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'direction-action-btn delete-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Delete direction';
    deleteBtn.addEventListener('click', () => {
      this.#handleDeleteDirection(direction);
    });
    actions.appendChild(deleteBtn);

    header.appendChild(actions);
    article.appendChild(header);

    // Direction content
    const content = document.createElement('div');
    content.className = 'direction-content';

    // Title
    const titleField = this.#createEditableField(
      'title',
      'Title',
      direction.title,
      direction.id,
      'h3',
      'direction-title-editable'
    );
    titleField.id = `direction-title-${direction.id}`;
    content.appendChild(titleField);

    // Description
    const descriptionField = this.#createEditableField(
      'description',
      'Description',
      direction.description,
      direction.id,
      'div',
      'direction-field-content'
    );
    content.appendChild(this.#wrapField('Description', descriptionField));

    // Core Tension
    const tensionField = this.#createEditableField(
      'coreTension',
      'Core Tension',
      direction.coreTension,
      direction.id,
      'div',
      'direction-field-content'
    );
    content.appendChild(this.#wrapField('Core Tension', tensionField));

    // Unique Twist
    const twistField = this.#createEditableField(
      'uniqueTwist',
      'Unique Twist',
      direction.uniqueTwist,
      direction.id,
      'div',
      'direction-field-content'
    );
    content.appendChild(this.#wrapField('Unique Twist', twistField));

    // Narrative Potential
    const potentialField = this.#createEditableField(
      'narrativePotential',
      'Narrative Potential',
      direction.narrativePotential,
      direction.id,
      'div',
      'direction-field-content'
    );
    content.appendChild(this.#wrapField('Narrative Potential', potentialField));

    article.appendChild(content);

    return article;
  }

  /**
   * Create an editable field element using InPlaceEditor
   *
   * @private
   * @param {string} fieldName - Field name
   * @param {string} fieldLabel - Field label
   * @param {string} value - Current value
   * @param {string} directionId - Direction ID
   * @param {string} elementType - HTML element type
   * @param {string} className - CSS class name
   * @returns {HTMLElement} Editable field element
   */
  #createEditableField(
    fieldName,
    fieldLabel,
    value,
    directionId,
    elementType,
    className
  ) {
    const display = document.createElement(elementType);
    display.className = `editable-field ${className}`;
    display.textContent = value;
    display.setAttribute('data-field', fieldName);
    display.setAttribute('data-direction-id', directionId);

    // Create InPlaceEditor instance
    const editorKey = `${directionId}-${fieldName}`;
    const inPlaceEditor = new InPlaceEditor({
      element: display,
      originalValue: value,
      onSave: async (newValue) => {
        await this.#handleFieldSave(directionId, fieldName, value, newValue);
      },
      validator: (newValue) => this.#validateFieldValue(fieldName, newValue),
    });

    // Store editor instance for cleanup
    this.#inPlaceEditors.set(editorKey, inPlaceEditor);

    return display;
  }

  /**
   * Wrap a field with label
   *
   * @private
   * @param {string} label - Field label
   * @param {HTMLElement} fieldElement - Field element
   * @returns {HTMLElement} Wrapped field
   */
  #wrapField(label, fieldElement) {
    const wrapper = document.createElement('div');
    wrapper.className = 'direction-field';

    const labelElement = document.createElement('label');
    labelElement.className = 'direction-field-label';
    labelElement.textContent = label;

    wrapper.appendChild(labelElement);
    wrapper.appendChild(fieldElement);

    return wrapper;
  }

  /**
   * Handle field save from InPlaceEditor
   *
   * @private
   * @param {string} directionId - Direction ID
   * @param {string} fieldName - Field name
   * @param {string} originalValue - Original value
   * @param {string} newValue - New value
   */
  async #handleFieldSave(directionId, fieldName, originalValue, newValue) {
    try {
      // Update the direction
      const updates = { [fieldName]: newValue.trim() };
      await this.characterBuilderService.updateThematicDirection(
        directionId,
        updates
      );

      // Update local data
      const dataItem = this.#directionsData.find(
        (item) => item.direction.id === directionId
      );
      if (dataItem) {
        dataItem.direction[fieldName] = newValue.trim();
      }

      // Dispatch update event
      this.eventBus.dispatch('core:direction_updated', {
        directionId,
        field: fieldName,
        oldValue: originalValue,
        newValue: newValue.trim(),
      });

      this.logger.info(
        'ThematicDirectionsManagerController: Updated direction field',
        { directionId, fieldName }
      );
    } catch (error) {
      this.logger.error(
        'ThematicDirectionsManagerController: Failed to update direction',
        error
      );
      throw new Error('Failed to save changes. Please try again.');
    }
  }

  /**
   * Validate field value
   *
   * @private
   * @param {string} fieldName - Field name
   * @param {string} value - Value to validate
   * @returns {{isValid: boolean, error?: string}} Validation result
   */
  #validateFieldValue(fieldName, value) {
    if (!value || value.trim().length === 0) {
      return { isValid: false, error: 'Field cannot be empty' };
    }

    const constraints = {
      title: { min: 5, max: 200 },
      description: { min: 20, max: 2000 },
      coreTension: { min: 10, max: 500 },
      uniqueTwist: { min: 10, max: 500 },
      narrativePotential: { min: 10, max: 1000 },
    };

    const constraint = constraints[fieldName];
    if (constraint) {
      const length = value.trim().length;
      if (length < constraint.min) {
        return {
          isValid: false,
          error: `${fieldName} must be at least ${constraint.min} characters`,
        };
      }
      if (length > constraint.max) {
        return {
          isValid: false,
          error: `${fieldName} must be no more than ${constraint.max} characters`,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Handle concept selection change
   *
   * @private
   * @param {string} conceptId - Selected concept ID
   */
  async #handleConceptSelection(conceptId) {
    this.#currentConcept = conceptId;

    // Handle concept display
    if (conceptId && conceptId !== 'orphaned') {
      try {
        // Fetch the full character concept
        const concept =
          await this.characterBuilderService.getCharacterConcept(conceptId);
        if (concept) {
          this.#displayCharacterConcept(concept);
        }
      } catch (error) {
        this.logger.error(
          'ThematicDirectionsManagerController: Failed to load character concept',
          error
        );
        // Hide the concept display on error
        if (this.#elements.conceptDisplayContainer) {
          this.#elements.conceptDisplayContainer.style.display = 'none';
        }
      }
    } else {
      // Hide concept display for "All Concepts" or "Orphaned Directions"
      if (this.#elements.conceptDisplayContainer) {
        this.#elements.conceptDisplayContainer.style.display = 'none';
      }
    }

    this.#filterAndDisplayDirections();
  }

  /**
   * Handle delete direction
   *
   * @private
   * @param {ThematicDirection} direction - Direction to delete
   */
  #handleDeleteDirection(direction) {
    this.#showModal(
      'Delete Direction',
      `Are you sure you want to delete "${direction.title}"? This action cannot be undone.`,
      async () => {
        try {
          await this.characterBuilderService.deleteThematicDirection(
            direction.id
          );

          // Remove from local data
          this.#directionsData = this.#directionsData.filter(
            (item) => item.direction.id !== direction.id
          );

          // Update display
          this.#updateStats();
          this.#filterAndDisplayDirections();

          // Dispatch event
          this.eventBus.dispatch('core:direction_deleted', {
            directionId: direction.id,
          });

          this.logger.info(
            'ThematicDirectionsManagerController: Deleted direction',
            { directionId: direction.id }
          );
        } catch (error) {
          this.logger.error(
            'ThematicDirectionsManagerController: Failed to delete direction',
            error
          );
          alert('Failed to delete direction. Please try again.');
        }
      }
    );
  }

  /**
   * Handle cleanup orphaned directions
   *
   * @private
   */
  #handleCleanupOrphans() {
    const orphanedCount = this.#directionsData.filter(
      (item) => !item.concept
    ).length;

    if (orphanedCount === 0) {
      alert('No orphaned directions found.');
      return;
    }

    this.#showModal(
      'Clean Up Orphaned Directions',
      `This will delete ${orphanedCount} orphaned direction(s) that have no associated character concept. This action cannot be undone.`,
      async () => {
        try {
          const orphanedDirections = this.#directionsData
            .filter((item) => !item.concept)
            .map((item) => item.direction);

          // Delete each orphaned direction
          for (const direction of orphanedDirections) {
            await this.characterBuilderService.deleteThematicDirection(
              direction.id
            );
          }

          // Remove from local data
          this.#directionsData = this.#directionsData.filter(
            (item) => item.concept !== null
          );

          // Update display
          this.#updateStats();
          this.#filterAndDisplayDirections();

          // Dispatch event
          this.eventBus.dispatch('core:orphans_cleaned', {
            deletedCount: orphanedDirections.length,
          });

          this.logger.info(
            'ThematicDirectionsManagerController: Cleaned orphaned directions',
            { deletedCount: orphanedDirections.length }
          );

          alert(
            `Successfully deleted ${orphanedDirections.length} orphaned direction(s).`
          );
        } catch (error) {
          this.logger.error(
            'ThematicDirectionsManagerController: Failed to cleanup orphans',
            error
          );
          alert('Failed to cleanup orphaned directions. Please try again.');
        }
      }
    );
  }

  /**
   * Show confirmation modal
   *
   * @private
   * @param {string} title - Modal title
   * @param {string} message - Modal message
   * @param {Function} onConfirm - Confirmation callback
   */
  #showModal(title, message, onConfirm) {
    if (!this.#elements.confirmationModal) return;

    this.#elements.modalTitle.textContent = title;
    this.#elements.modalMessage.textContent = message;

    // Set up confirm handler
    const confirmHandler = async () => {
      this.#hideModal();
      await onConfirm();
    };

    // Remove existing listeners
    const newConfirmBtn = this.#elements.modalConfirmBtn.cloneNode(true);
    this.#elements.modalConfirmBtn.parentNode.replaceChild(
      newConfirmBtn,
      this.#elements.modalConfirmBtn
    );
    this.#elements.modalConfirmBtn = newConfirmBtn;

    // Add new listener
    this.#elements.modalConfirmBtn.addEventListener('click', confirmHandler);

    // Show modal
    this.#elements.confirmationModal.style.display = 'flex';
  }

  /**
   * Hide confirmation modal
   *
   * @private
   */
  #hideModal() {
    if (this.#elements.confirmationModal) {
      this.#elements.confirmationModal.style.display = 'none';
    }
  }

  /**
   * Clean up InPlaceEditor instances
   *
   * @private
   */
  #cleanupInPlaceEditors() {
    this.#inPlaceEditors.forEach((editor) => {
      editor.destroy();
    });
    this.#inPlaceEditors.clear();
  }

  /**
   * Extract unique concepts that have associated thematic directions
   *
   * @private
   * @param {Array<{direction: ThematicDirection, concept: CharacterConcept|null}>} directionsWithConcepts - Array of directions with their associated concepts
   * @returns {CharacterConcept[]} Array of concepts with directions
   */
  #extractConceptsWithDirections(directionsWithConcepts) {
    const conceptMap = new Map();

    directionsWithConcepts.forEach((item) => {
      if (item.concept && !conceptMap.has(item.concept.id)) {
        conceptMap.set(item.concept.id, item.concept);
      }
    });

    return Array.from(conceptMap.values());
  }

  /**
   * Display the selected character concept
   *
   * @private
   * @param {CharacterConcept} concept - Character concept to display
   */
  #displayCharacterConcept(concept) {
    if (
      !this.#elements.conceptDisplayContainer ||
      !this.#elements.conceptDisplayContent
    ) {
      return;
    }

    // Clear existing content
    this.#elements.conceptDisplayContent.innerHTML = '';

    // Create concept display structure
    const conceptWrapper = document.createElement('div');
    conceptWrapper.className = 'concept-content-wrapper';

    // Add concept text
    const conceptText = document.createElement('div');
    conceptText.className = 'concept-text';
    conceptText.textContent = concept.concept;
    conceptWrapper.appendChild(conceptText);

    // Add metadata
    const metadataSection = document.createElement('div');
    metadataSection.className = 'concept-metadata';

    // Status badge
    const statusBadge = document.createElement('span');
    statusBadge.className = `concept-status concept-status-${concept.status}`;
    statusBadge.textContent =
      concept.status.charAt(0).toUpperCase() + concept.status.slice(1);
    metadataSection.appendChild(statusBadge);

    // Created date
    const createdDate = document.createElement('span');
    createdDate.className = 'concept-date';
    const createdAt = new Date(concept.createdAt);
    createdDate.textContent = `Created: ${createdAt.toLocaleDateString()} at ${createdAt.toLocaleTimeString()}`;
    metadataSection.appendChild(createdDate);

    // Direction count
    if (concept.thematicDirections && concept.thematicDirections.length > 0) {
      const directionCount = document.createElement('span');
      directionCount.className = 'concept-direction-count';
      directionCount.textContent = `${concept.thematicDirections.length} thematic direction${concept.thematicDirections.length === 1 ? '' : 's'}`;
      metadataSection.appendChild(directionCount);
    }

    conceptWrapper.appendChild(metadataSection);

    // Add to container
    this.#elements.conceptDisplayContent.appendChild(conceptWrapper);

    // Show the container with animation
    this.#elements.conceptDisplayContainer.style.display = 'block';
    // Force reflow for animation
    this.#elements.conceptDisplayContainer.offsetHeight;
    this.#elements.conceptDisplayContainer.classList.add('visible');
  }

  /**
   * Cache DOM elements needed by the controller
   *
   * @protected
   * @override
   */
  _cacheElements() {
    // TODO: Implement in THEDIRMIG-004
    throw new Error('_cacheElements() must be implemented');
  }

  /**
   * Set up event listeners using base class helpers
   *
   * @protected
   * @override
   */
  _setupEventListeners() {
    // TODO: Implement in THEDIRMIG-005
    throw new Error('_setupEventListeners() must be implemented');
  }
}

export default ThematicDirectionsManagerController;
