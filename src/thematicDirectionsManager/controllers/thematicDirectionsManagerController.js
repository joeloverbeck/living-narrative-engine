/**
 * @file Controller for thematic directions management interface
 * @description Manages UI for viewing, editing, and organizing thematic directions
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { UIStateManager } from '../../shared/characterBuilder/uiStateManager.js';
import { PreviousItemsDropdown } from '../../shared/characterBuilder/previousItemsDropdown.js';
import { FormValidationHelper } from '../../shared/characterBuilder/formValidationHelper.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../characterBuilder/services/characterBuilderService.js').CharacterBuilderService} CharacterBuilderService
 * @typedef {import('../../characterBuilder/models/characterConcept.js').CharacterConcept} CharacterConcept
 * @typedef {import('../../characterBuilder/models/thematicDirection.js').ThematicDirection} ThematicDirection
 * @typedef {import('../../interfaces/schema-validator.js').ISchemaValidator} ISchemaValidator
 */

/**
 * UI states for the thematic directions manager
 */
const UI_STATES = {
  EMPTY: 'empty',
  LOADING: 'loading',
  RESULTS: 'results',
  ERROR: 'error',
};

/**
 * Controller for thematic directions manager interface
 */
export class ThematicDirectionsManagerController {
  #logger;
  #characterBuilderService;
  #eventBus;
  #schemaValidator;
  #uiStateManager;
  #conceptDropdown;
  #currentFilter = '';
  #currentConcept = null;
  #directionsData = [];
  #editingFields = new Map(); // Track active edits

  // DOM element references
  #elements = {};

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {CharacterBuilderService} dependencies.characterBuilderService - Character builder service
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event dispatcher
   * @param {ISchemaValidator} dependencies.schemaValidator - Schema validator
   */
  constructor({ logger, characterBuilderService, eventBus, schemaValidator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(
      characterBuilderService,
      'CharacterBuilderService',
      logger,
      {
        requiredMethods: [
          'initialize',
          'getAllCharacterConcepts',
          'getCharacterConcept',
          'getAllThematicDirectionsWithConcepts',
          'getOrphanedThematicDirections',
          'updateThematicDirection',
          'deleteThematicDirection',
        ],
      }
    );
    validateDependency(eventBus, 'ISafeEventDispatcher', logger, {
      requiredMethods: ['dispatch'],
    });
    validateDependency(schemaValidator, 'ISchemaValidator', logger, {
      requiredMethods: ['validateAgainstSchema'],
    });

    this.#logger = logger;
    this.#characterBuilderService = characterBuilderService;
    this.#eventBus = eventBus;
    this.#schemaValidator = schemaValidator;
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

      // Initialize UI state manager
      this.#uiStateManager = new UIStateManager({
        emptyState: this.#elements.emptyState,
        loadingState: this.#elements.loadingState,
        errorState: this.#elements.errorState,
        resultsState: this.#elements.resultsState,
      });

      // Initialize concept dropdown
      this.#conceptDropdown = new PreviousItemsDropdown({
        element: this.#elements.conceptSelector,
        onSelectionChange: this.#handleConceptSelection.bind(this),
        labelText: 'Choose Concept:',
      });

      // Initialize service
      await this.#characterBuilderService.initialize();

      // Set up event listeners
      this.#setupEventListeners();

      // Load initial data
      await this.#loadDirectionsData();

      this.#logger.info(
        'ThematicDirectionsManagerController: Successfully initialized'
      );
    } catch (error) {
      this.#logger.error(
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
    this.#elements.conceptSelector = document.getElementById('concept-selector');
    this.#elements.directionFilter = document.getElementById('direction-filter');
    this.#elements.directionsResults = document.getElementById('directions-results');

    // State containers
    this.#elements.emptyState = document.getElementById('empty-state');
    this.#elements.loadingState = document.getElementById('loading-state');
    this.#elements.errorState = document.getElementById('error-state');
    this.#elements.resultsState = document.getElementById('results-state');

    // Action buttons
    this.#elements.refreshBtn = document.getElementById('refresh-btn');
    this.#elements.cleanupOrphansBtn = document.getElementById('cleanup-orphans-btn');
    this.#elements.backBtn = document.getElementById('back-to-menu-btn');
    this.#elements.retryBtn = document.getElementById('retry-btn');

    // Stats display
    this.#elements.totalDirections = document.getElementById('total-directions');
    this.#elements.orphanedCount = document.getElementById('orphaned-count');

    // Modal elements
    this.#elements.confirmationModal = document.getElementById('confirmation-modal');
    this.#elements.modalTitle = document.getElementById('modal-title');
    this.#elements.modalMessage = document.getElementById('modal-message');
    this.#elements.modalConfirmBtn = document.getElementById('modal-confirm-btn');
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
      const directionsWithConcepts = await this.#characterBuilderService
        .getAllThematicDirectionsWithConcepts();

      // Load concepts for dropdown
      const concepts = await this.#characterBuilderService.getAllCharacterConcepts();
      
      // Update dropdown
      await this.#conceptDropdown.loadItems(concepts);

      // Store data
      this.#directionsData = directionsWithConcepts;

      // Update stats
      this.#updateStats();

      // Display directions
      this.#filterAndDisplayDirections();

      this.#logger.info(
        'ThematicDirectionsManagerController: Loaded directions data',
        { directionCount: this.#directionsData.length }
      );
    } catch (error) {
      this.#logger.error(
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
      item => !item.concept
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
      filteredData = filteredData.filter(item => !item.concept);
    } else if (this.#currentConcept) {
      filteredData = filteredData.filter(
        item => item.concept && item.concept.id === this.#currentConcept
      );
    }

    // Filter by search text
    if (this.#currentFilter) {
      filteredData = filteredData.filter(item => {
        const direction = item.direction;
        return (
          direction.title.toLowerCase().includes(this.#currentFilter) ||
          direction.description.toLowerCase().includes(this.#currentFilter) ||
          direction.coreTension.toLowerCase().includes(this.#currentFilter) ||
          direction.uniqueTwist.toLowerCase().includes(this.#currentFilter) ||
          direction.narrativePotential.toLowerCase().includes(this.#currentFilter)
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
   * @param {Array<{direction: ThematicDirection, concept: CharacterConcept|null}>} directionsData
   */
  #displayDirections(directionsData) {
    // Clear previous results  
    this.#elements.directionsResults.innerHTML = '';

    // Create directions container
    const container = document.createElement('div');
    container.className = 'directions-container';

    // Add each direction
    directionsData.forEach((item, index) => {
      const directionElement = this.#createEditableDirectionElement(
        item.direction,
        item.concept,
        index + 1
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
   * @param {number} index - Direction index (1-based)
   * @returns {HTMLElement} Direction element
   */
  #createEditableDirectionElement(direction, concept, index) {
    const article = document.createElement('article');
    article.className = 'direction-card-editable cb-card-editable';
    article.setAttribute('data-direction-id', direction.id);
    article.setAttribute('role', 'article');
    article.setAttribute('aria-labelledby', `direction-title-${direction.id}`);

    // Card header with concept info and actions
    const header = document.createElement('div');
    header.className = 'direction-card-header';

    const conceptInfo = document.createElement('div');
    conceptInfo.className = concept ? 'direction-concept-info' : 'direction-concept-info orphaned';
    conceptInfo.textContent = concept 
      ? `From concept: ${concept.concept.substring(0, 60)}${concept.concept.length > 60 ? '...' : ''}`
      : 'Orphaned direction (no associated concept)';
    header.appendChild(conceptInfo);

    const actions = document.createElement('div');
    actions.className = 'direction-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'direction-action-btn edit-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Toggle edit mode';
    editBtn.addEventListener('click', () => {
      this.#toggleEditMode(article, direction);
    });
    actions.appendChild(editBtn);

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
   * Create an editable field element
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
  #createEditableField(fieldName, fieldLabel, value, directionId, elementType, className) {
    const container = document.createElement('div');
    container.className = 'editable-field-container';

    const display = document.createElement(elementType);
    display.className = `editable-field ${className}`;
    display.textContent = value;
    display.setAttribute('data-field', fieldName);
    display.setAttribute('data-direction-id', directionId);
    display.title = `Click to edit ${fieldLabel.toLowerCase()}`;

    display.addEventListener('click', () => {
      this.#startFieldEdit(display, fieldName, value, directionId);
    });

    const editor = document.createElement('div');
    editor.className = 'field-editor';
    editor.setAttribute('data-field', fieldName);

    const input = document.createElement(fieldName === 'title' ? 'input' : 'textarea');
    input.className = 'field-editor-input';
    input.value = value;
    if (input.tagName === 'TEXTAREA') {
      input.rows = Math.max(2, Math.ceil(value.length / 80));
    }

    const actions = document.createElement('div');
    actions.className = 'field-editor-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'field-editor-btn field-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      this.#saveFieldEdit(display, editor, fieldName, input.value, directionId);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'field-editor-btn field-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      this.#cancelFieldEdit(display, editor);
    });

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);

    editor.appendChild(input);
    editor.appendChild(actions);

    container.appendChild(display);
    container.appendChild(editor);

    return container;
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
   * Start editing a field
   *
   * @private
   * @param {HTMLElement} displayElement - Display element
   * @param {string} fieldName - Field name
   * @param {string} currentValue - Current value
   * @param {string} directionId - Direction ID
   */
  #startFieldEdit(displayElement, fieldName, currentValue, directionId) {
    const container = displayElement.parentElement;
    const editor = container.querySelector('.field-editor');
    const input = editor.querySelector('.field-editor-input');

    // Track editing state
    const editKey = `${directionId}-${fieldName}`;
    this.#editingFields.set(editKey, currentValue);

    // Show editor, hide display
    displayElement.style.display = 'none';
    editor.classList.add('active');
    
    // Focus input
    input.focus();
    if (input.tagName === 'TEXTAREA') {
      input.setSelectionRange(input.value.length, input.value.length);
    } else {
      input.select();
    }

    // Handle Enter key for save (Ctrl+Enter for textarea)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (input.tagName === 'INPUT' || e.ctrlKey)) {
        e.preventDefault();
        this.#saveFieldEdit(displayElement, editor, fieldName, input.value, directionId);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.#cancelFieldEdit(displayElement, editor);
      }
    });
  }

  /**
   * Save field edit
   *
   * @private
   * @param {HTMLElement} displayElement - Display element
   * @param {HTMLElement} editor - Editor element
   * @param {string} fieldName - Field name
   * @param {string} newValue - New value
   * @param {string} directionId - Direction ID
   */
  async #saveFieldEdit(displayElement, editor, fieldName, newValue, directionId) {
    const editKey = `${directionId}-${fieldName}`;
    const originalValue = this.#editingFields.get(editKey);

    // Validate the new value
    const validation = this.#validateFieldValue(fieldName, newValue);
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    // If no change, just cancel
    if (newValue.trim() === originalValue) {
      this.#cancelFieldEdit(displayElement, editor);
      return;
    }

    try {
      // Show loading state on save button
      const saveBtn = editor.querySelector('.field-save-btn');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;

      // Update the direction
      const updates = { [fieldName]: newValue.trim() };
      await this.#characterBuilderService.updateThematicDirection(directionId, updates);

      // Update display
      displayElement.textContent = newValue.trim();

      // Update local data
      const dataItem = this.#directionsData.find(
        item => item.direction.id === directionId
      );
      if (dataItem) {
        dataItem.direction[fieldName] = newValue.trim();
      }

      // Hide editor, show display
      editor.classList.remove('active');
      displayElement.style.display = '';

      // Clear editing state
      this.#editingFields.delete(editKey);

      // Dispatch update event
      this.#eventBus.dispatch('thematic:direction_updated', {
        directionId,
        field: fieldName,
        oldValue: originalValue,
        newValue: newValue.trim(),
      });

      this.#logger.info(
        'ThematicDirectionsManagerController: Updated direction field',
        { directionId, fieldName }
      );
    } catch (error) {
      this.#logger.error(
        'ThematicDirectionsManagerController: Failed to update direction',
        error
      );
      alert('Failed to save changes. Please try again.');

      // Reset save button
      const saveBtn = editor.querySelector('.field-save-btn');
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }
  }

  /**
   * Cancel field edit
   *
   * @private
   * @param {HTMLElement} displayElement - Display element
   * @param {HTMLElement} editor - Editor element
   */
  #cancelFieldEdit(displayElement, editor) {
    // Hide editor, show display
    editor.classList.remove('active');
    displayElement.style.display = '';

    // Clear editing state
    const directionId = displayElement.getAttribute('data-direction-id');
    const fieldName = displayElement.getAttribute('data-field');
    const editKey = `${directionId}-${fieldName}`;
    this.#editingFields.delete(editKey);

    // Reset input value
    const input = editor.querySelector('.field-editor-input');
    input.value = displayElement.textContent;
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
   * Toggle edit mode for entire direction card
   *
   * @private
   * @param {HTMLElement} cardElement - Card element
   * @param {ThematicDirection} direction - Direction data
   */
  #toggleEditMode(cardElement, direction) {
    const isEditing = cardElement.classList.contains('editing');
    
    if (isEditing) {
      // Exit edit mode - save any pending changes
      cardElement.classList.remove('editing');
      
      // Cancel any active field edits
      const activeEditors = cardElement.querySelectorAll('.field-editor.active');
      activeEditors.forEach(editor => {
        const container = editor.parentElement;
        const display = container.querySelector('.editable-field');
        this.#cancelFieldEdit(display, editor);
      });
    } else {
      // Enter edit mode
      cardElement.classList.add('editing');
    }
  }

  /**
   * Handle concept selection change
   *
   * @private
   * @param {string} conceptId - Selected concept ID
   */
  async #handleConceptSelection(conceptId) {
    this.#currentConcept = conceptId;
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
          await this.#characterBuilderService.deleteThematicDirection(direction.id);
          
          // Remove from local data
          this.#directionsData = this.#directionsData.filter(
            item => item.direction.id !== direction.id
          );

          // Update display
          this.#updateStats();
          this.#filterAndDisplayDirections();

          // Dispatch event
          this.#eventBus.dispatch('thematic:direction_deleted', {
            directionId: direction.id,
          });

          this.#logger.info(
            'ThematicDirectionsManagerController: Deleted direction',
            { directionId: direction.id }
          );
        } catch (error) {
          this.#logger.error(
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
      item => !item.concept
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
            .filter(item => !item.concept)
            .map(item => item.direction);

          // Delete each orphaned direction
          for (const direction of orphanedDirections) {
            await this.#characterBuilderService.deleteThematicDirection(direction.id);
          }

          // Remove from local data
          this.#directionsData = this.#directionsData.filter(
            item => item.concept !== null
          );

          // Update display
          this.#updateStats();
          this.#filterAndDisplayDirections();

          // Dispatch event
          this.#eventBus.dispatch('thematic:orphans_cleaned', {
            deletedCount: orphanedDirections.length,
          });

          this.#logger.info(
            'ThematicDirectionsManagerController: Cleaned orphaned directions',
            { deletedCount: orphanedDirections.length }
          );

          alert(`Successfully deleted ${orphanedDirections.length} orphaned direction(s).`);
        } catch (error) {
          this.#logger.error(
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
}

export default ThematicDirectionsManagerController;