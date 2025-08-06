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
  #dropdownStateKey = 'thematic-directions-dropdown-state';
  #sessionId = `session-${Date.now()}`;

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
  constructor({
    logger,
    characterBuilderService,
    eventBus,
    schemaValidator,
    uiStateManager,
  }) {
    super({
      logger,
      characterBuilderService,
      eventBus,
      schemaValidator,
      uiStateManager,
    });

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
        requiredMethods: ['showState', 'showError'],
      },
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
   * Initialize additional services and components
   * Called during the standard initialization sequence after caching and event setup
   *
   * @protected
   * @override
   * @returns {Promise<void>}
   */
  async _initializeAdditionalServices() {
    await super._initializeAdditionalServices();

    try {
      // Initialize concept dropdown with error handling
      const selectElement = this._getElement('conceptSelector');
      if (!selectElement) {
        this.logger.warn(
          'conceptSelector element not found, dropdown disabled'
        );
        return;
      }

      try {
        this.#conceptDropdown = new PreviousItemsDropdown({
          element: selectElement,
          onSelectionChange: this.#handleConceptSelection.bind(this),
          labelText: 'Choose Concept:',
        });
      } catch (dropdownError) {
        this.logger.error('Failed to initialize dropdown:', dropdownError);
        this.#fallbackToNativeSelect();
      }

      // Initialize characterBuilderService (moved from initialize())
      await this.characterBuilderService.initialize();

      this.logger.debug(
        'ThematicDirectionsManagerController: Additional services initialized'
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
      throw error; // Re-throw for base class to handle
    }
  }

  /**
   * Load initial page data
   * Called during the standard initialization sequence after services are initialized
   *
   * @protected
   * @override
   * @returns {Promise<void>}
   */
  async _loadInitialData() {
    // Delegate to existing method (to minimize changes)
    await this.#loadDirectionsData();
  }

  /**
   * Initialize UI state based on loaded data
   * Called during the standard initialization sequence after data is loaded
   *
   * @protected
   * @override
   * @returns {Promise<void>}
   */
  async _initializeUIState() {
    await super._initializeUIState(); // Initializes UIStateManager

    // Restore dropdown state from session storage
    this.#restoreDropdownState();

    // Display directions and determine appropriate state
    // (moved from #loadDirectionsData)
    this.#filterAndDisplayDirections();

    // Note: #filterAndDisplayDirections already handles:
    // - Showing EMPTY state if no data
    // - Showing RESULTS state if data exists
    // - Displaying the directions
  }

  /**
   * Post-initialization setup
   * Called after all initialization steps are complete
   *
   * @protected
   * @override
   * @returns {Promise<void>}
   */
  async _postInitialize() {
    await super._postInitialize();

    // Log successful initialization (moved from initialize())
    this.logger.info(
      'ThematicDirectionsManagerController: Successfully initialized'
    );
  }

  /**
   * Load all directions data
   *
   * @private
   */
  async #loadDirectionsData() {
    this.#uiStateManager.showState(UI_STATES.LOADING);
    this.#setDropdownLoading(true);

    try {
      // Load all directions with their concepts
      const directionsWithConcepts =
        await this.characterBuilderService.getAllThematicDirectionsWithConcepts();

      // Extract unique concepts that have associated directions
      const conceptsWithDirections = this.#extractConceptsWithDirections(
        directionsWithConcepts
      );

      // Update dropdown with filtered concepts
      if (this.#conceptDropdown) {
        await this.#conceptDropdown.loadItems(conceptsWithDirections);
      }

      // Store data
      this.#directionsData = directionsWithConcepts;

      // Update stats
      this.#updateStats();

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
    } finally {
      this.#setDropdownLoading(false);
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

    const totalDirectionsElement = this._getElement('totalDirections');
    if (totalDirectionsElement) {
      totalDirectionsElement.textContent = totalCount;
    }

    const orphanedCountElement = this._getElement('orphanedCount');
    if (orphanedCountElement) {
      orphanedCountElement.textContent = orphanedCount;
    }

    // Update cleanup button state
    const cleanupBtn = this._getElement('cleanupOrphansBtn');
    if (cleanupBtn) {
      cleanupBtn.disabled = orphanedCount === 0;
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
    const directionsResults = this._getElement('directionsResults');
    directionsResults.innerHTML = '';

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
    directionsResults.appendChild(container);
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

      // Note: Event is already dispatched by characterBuilderService.updateThematicDirection
      // No need to dispatch it again here

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

    // Track the selection
    const selectElement = this._getElement('conceptSelector');
    const selectedOption = selectElement?.selectedOptions?.[0];
    this.#trackDropdownInteraction('select', {
      value: conceptId,
      label: selectedOption?.textContent || '',
      isOrphaned: conceptId === 'orphaned',
      isEmpty: !conceptId,
    });

    // Save dropdown state to session storage
    this.#saveDropdownState();

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
        const conceptDisplayContainer = this._getElement(
          'conceptDisplayContainer'
        );
        if (conceptDisplayContainer) {
          conceptDisplayContainer.style.display = 'none';
        }
      }
    } else {
      // Hide concept display for "All Concepts" or "Orphaned Directions"
      const conceptDisplayContainer = this._getElement(
        'conceptDisplayContainer'
      );
      if (conceptDisplayContainer) {
        conceptDisplayContainer.style.display = 'none';
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
    const confirmationModal = this._getElement('confirmationModal');
    if (!confirmationModal) return;

    this._setElementText('modalTitle', title);
    this._setElementText('modalMessage', message);

    // Set up confirm handler
    const confirmHandler = async () => {
      this.#hideModal();
      await onConfirm();
    };

    // Remove existing listeners
    const modalConfirmBtn = this._getElement('modalConfirmBtn');
    const newConfirmBtn = modalConfirmBtn.cloneNode(true);
    modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, modalConfirmBtn);

    // Add new listener
    newConfirmBtn.addEventListener('click', confirmHandler);

    // Show modal
    this._showElement('confirmationModal', 'flex');
  }

  /**
   * Hide confirmation modal
   *
   * @private
   */
  #hideModal() {
    this._hideElement('confirmationModal');
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
   * Fallback to native select on error
   *
   * @private
   */
  #fallbackToNativeSelect() {
    const selectElement = this._getElement('conceptSelector');
    if (selectElement) {
      // Remove any custom dropdown styling
      selectElement.classList.remove('enhanced-dropdown');
      selectElement.classList.add('native-fallback');

      // Ensure change events still work
      selectElement.addEventListener('change', (e) => {
        this.#handleConceptSelection(e.target.value);
      });

      this.logger.info('Falling back to native select element');

      // Track the fallback event
      this.#trackDropdownInteraction('fallback', {
        reason: 'component_error',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Show loading state in dropdown
   *
   * @param isLoading
   * @private
   */
  #setDropdownLoading(isLoading) {
    const selectElement = this._getElement('conceptSelector');
    if (!selectElement) return;

    if (isLoading) {
      selectElement.disabled = true;
      selectElement.classList.add('loading');

      // Store current options to restore later
      this._cachedOptions = Array.from(selectElement.options);

      // Clear and add loading option
      selectElement.innerHTML = '';
      const loadingOption = document.createElement('option');
      loadingOption.textContent = 'Loading concepts...';
      loadingOption.value = '';
      loadingOption.disabled = true;
      loadingOption.selected = true;
      selectElement.appendChild(loadingOption);
    } else {
      selectElement.disabled = false;
      selectElement.classList.remove('loading');

      // Restore cached options if they exist
      if (this._cachedOptions && this._cachedOptions.length > 0) {
        selectElement.innerHTML = '';
        this._cachedOptions.forEach((option) => {
          selectElement.appendChild(option.cloneNode(true));
        });
        this._cachedOptions = null;
      }
    }
  }

  /**
   * Handle dropdown error
   *
   * @private
   * @param {Error} error - The error that occurred
   */
  #handleDropdownError(error) {
    this.logger.error('Dropdown error occurred:', error);

    // Try to recover gracefully
    if (this.#conceptDropdown) {
      try {
        // Attempt to reset the dropdown
        this.#conceptDropdown.clear();
        this.#conceptDropdown.enable();
      } catch (resetError) {
        // If reset fails, fall back to native select
        this.logger.error('Failed to reset dropdown:', resetError);
        this.#fallbackToNativeSelect();
      }
    } else {
      // No dropdown instance, fall back immediately
      this.#fallbackToNativeSelect();
    }
  }

  /**
   * Track dropdown interaction
   *
   * @private
   * @param {string} action - The action performed
   * @param {*} value - The value involved
   */
  #trackDropdownInteraction(action, value) {
    this.eventBus.dispatch('ANALYTICS_TRACK', {
      event: 'thematic_dropdown_interaction',
      properties: {
        action: action,
        value: value,
        timestamp: Date.now(),
        sessionId: this.#sessionId,
        filter: this.#currentFilter,
        conceptId: this.#currentConcept,
      },
    });
  }

  /**
   * Restore dropdown state from storage
   *
   * @private
   */
  #restoreDropdownState() {
    try {
      const stored = localStorage.getItem(this.#dropdownStateKey);
      if (stored) {
        const state = JSON.parse(stored);

        // Restore last selection if it's still valid
        if (state.lastSelection && this.#conceptDropdown) {
          const selectElement = this._getElement('conceptSelector');
          if (selectElement) {
            // Check if the option still exists
            const optionExists = Array.from(selectElement.options).some(
              (option) => option.value === state.lastSelection
            );
            if (optionExists) {
              selectElement.value = state.lastSelection;
              this.#currentConcept = state.lastSelection;
            }
          }
        }

        // Restore filter if it exists
        if (state.lastFilter) {
          this.#currentFilter = state.lastFilter;
          const filterElement = this._getElement('directionFilter');
          if (filterElement) {
            filterElement.value = state.lastFilter;
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to restore dropdown state:', error);
    }
  }

  /**
   * Save dropdown state to storage
   *
   * @private
   */
  #saveDropdownState() {
    try {
      const selectElement = this._getElement('conceptSelector');
      const filterElement = this._getElement('directionFilter');
      const state = {
        lastSelection: selectElement?.value || '',
        lastFilter: filterElement?.value || '',
        timestamp: Date.now(),
        sessionId: this.#sessionId,
      };
      localStorage.setItem(this.#dropdownStateKey, JSON.stringify(state));
    } catch (error) {
      this.logger.error('Failed to save dropdown state:', error);
    }
  }

  /**
   * Display the selected character concept
   *
   * @private
   * @param {CharacterConcept} concept - Character concept to display
   */
  #displayCharacterConcept(concept) {
    const conceptDisplayContainer = this._getElement('conceptDisplayContainer');
    const conceptDisplayContent = this._getElement('conceptDisplayContent');

    if (!conceptDisplayContainer || !conceptDisplayContent) {
      return;
    }

    // Clear existing content
    conceptDisplayContent.innerHTML = '';

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
    conceptDisplayContent.appendChild(conceptWrapper);

    // Show the container with animation
    conceptDisplayContainer.style.display = 'block';
    // Force reflow for animation
    conceptDisplayContainer.offsetHeight;
    conceptDisplayContainer.classList.add('visible');
  }

  /**
   * Cache DOM elements needed by the controller
   *
   * @protected
   * @override
   */
  _cacheElements() {
    this._cacheElementsFromMap({
      // Main containers
      conceptSelector: '#concept-selector',
      directionFilter: '#direction-filter',
      directionsResults: '#directions-results',

      // Concept display elements
      conceptDisplayContainer: '#concept-display-container',
      conceptDisplayContent: '#concept-display-content',

      // UIStateManager required elements (preserve existing functionality)
      emptyState: '#empty-state',
      loadingState: '#loading-state',
      errorState: '#error-state',
      resultsState: '#results-state',
      errorMessageText: '#error-message-text',

      // Action buttons
      refreshBtn: '#refresh-btn',
      cleanupOrphansBtn: '#cleanup-orphans-btn',
      backBtn: '#back-to-menu-btn',
      retryBtn: '#retry-btn',

      // Stats displays
      totalDirections: '#total-directions',
      orphanedCount: '#orphaned-count',

      // Modal elements
      confirmationModal: '#confirmation-modal',
      modalTitle: '#modal-title',
      modalMessage: '#modal-message',
      modalConfirmBtn: '#modal-confirm-btn',
      modalCancelBtn: '#modal-cancel-btn',
      closeModalBtn: '#close-modal-btn',

      // Optional elements that might not exist in all contexts
      directionsContainer: {
        selector: '#directions-container',
        required: false,
      },
    });
  }

  /**
   * Refresh dropdown with latest data
   *
   * @public
   */
  async refreshDropdown() {
    try {
      this.#setDropdownLoading(true);
      this.#trackDropdownInteraction('refresh', { timestamp: Date.now() });

      // Preserve current selection
      const currentValue = this.#currentConcept;

      // Fetch fresh concepts
      const directionsWithConcepts =
        await this.characterBuilderService.getAllThematicDirectionsWithConcepts();

      // Extract unique concepts that have associated directions
      const conceptsWithDirections = this.#extractConceptsWithDirections(
        directionsWithConcepts
      );

      // Update dropdown with new data
      if (this.#conceptDropdown) {
        await this.#conceptDropdown.loadItems(conceptsWithDirections);

        // Restore selection if still valid
        const selectElement = this._getElement('conceptSelector');
        if (currentValue && selectElement) {
          const optionExists = Array.from(selectElement.options).some(
            (option) => option.value === currentValue
          );
          if (optionExists) {
            selectElement.value = currentValue;
            this.#currentConcept = currentValue;
          } else {
            // Selection no longer valid, reset
            this.#currentConcept = '';
            this.#trackDropdownInteraction('refresh_reset', {
              oldValue: currentValue,
              reason: 'value_no_longer_exists',
            });
          }
        }
      }

      // Update local data
      this.#directionsData = directionsWithConcepts;
      this.#updateStats();
      this.#filterAndDisplayDirections();

      this.logger.info('Dropdown refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh dropdown:', error);
      this.#handleDropdownError(error);

      // Show error message to user
      if (this.#uiStateManager) {
        this.#uiStateManager.showError(
          'Failed to refresh concepts. Please try again.'
        );
      }
    } finally {
      this.#setDropdownLoading(false);
    }
  }

  /**
   * Setup keyboard navigation enhancements
   *
   * @private
   */
  #setupKeyboardNavigation() {
    const selectElement = this._getElement('conceptSelector');
    const filterElement = this._getElement('directionFilter');

    if (selectElement) {
      selectElement.addEventListener('keydown', (event) => {
        switch (event.key) {
          case 'Escape':
            // Clear selection
            selectElement.value = '';
            this.#handleConceptSelection('');
            this.#trackDropdownInteraction('keyboard', { action: 'clear' });
            event.preventDefault();
            break;

          case '/':
            // Focus search/filter if Ctrl or Meta key is pressed
            if ((event.ctrlKey || event.metaKey) && filterElement) {
              filterElement.focus();
              this.#trackDropdownInteraction('keyboard', {
                action: 'focus_search',
              });
              event.preventDefault();
            }
            break;

          case 'Enter':
            // Confirm selection
            if (selectElement.value) {
              this.#trackDropdownInteraction('keyboard', {
                action: 'confirm_selection',
              });
            }
            break;
        }
      });
    }

    if (filterElement) {
      filterElement.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          // Clear filter
          filterElement.value = '';
          this.#currentFilter = '';
          this.#filterAndDisplayDirections();
          this.#saveDropdownState();
          this.#trackDropdownInteraction('keyboard', {
            action: 'clear_filter',
          });
          event.preventDefault();
        }
      });
    }
  }

  /**
   * Set up event listeners using base class helpers
   *
   * @protected
   * @override
   */
  _setupEventListeners() {
    // Setup keyboard navigation
    this.#setupKeyboardNavigation();

    // === Action Button Handlers ===
    this._addEventListener('refreshBtn', 'click', () => this.refreshDropdown());
    this._addEventListener('retryBtn', 'click', () =>
      this.#loadDirectionsData()
    );
    this._addEventListener('cleanupOrphansBtn', 'click', () =>
      this.#handleCleanupOrphans()
    );
    this._addEventListener('backBtn', 'click', () => {
      window.location.href = 'index.html';
    });

    // === Filter Handlers ===
    // Text input for search (not debounced currently)
    this._addEventListener('directionFilter', 'input', (e) => {
      this.#currentFilter = e.target.value.toLowerCase();
      this.#trackDropdownInteraction('filter', {
        filterText: this.#currentFilter,
        filterLength: this.#currentFilter.length,
      });
      this.#saveDropdownState();
      this.#filterAndDisplayDirections();
    });

    // === Modal Event Handlers ===
    this._addEventListener('modalCancelBtn', 'click', () => this.#hideModal());
    this._addEventListener('closeModalBtn', 'click', () => this.#hideModal());

    // Click outside modal to close (backdrop click)
    this._addEventListener('confirmationModal', 'click', (e) => {
      if (e.target === e.currentTarget) {
        this.#hideModal();
      }
    });

    // Note: Delete buttons are handled within #createEditableDirectionElement
    // Note: Modal confirm button uses a special clone/replace pattern in #showModal
  }

  /**
   * Pre-destroy cleanup hook
   * Ensures all InPlaceEditor instances are properly destroyed
   *
   * @protected
   * @override
   */
  _preDestroy() {
    this.logger.debug(
      'ThematicDirectionsManagerController: Starting pre-destroy cleanup'
    );

    // Destroy all InPlaceEditor instances to prevent memory leaks
    this.#cleanupInPlaceEditors();

    // Call parent implementation to maintain base class behavior
    super._preDestroy();
  }

  /**
   * Post-destroy cleanup hook
   * Clears remaining references and destroys dropdown components
   *
   * @protected
   * @override
   */
  _postDestroy() {
    // Clear data references to allow garbage collection
    this.#directionsData = [];
    this.#currentFilter = '';
    this.#currentConcept = null;

    // Destroy concept dropdown if it exists and has a destroy method
    if (
      this.#conceptDropdown &&
      typeof this.#conceptDropdown.destroy === 'function'
    ) {
      try {
        this.#conceptDropdown.destroy();
      } catch (error) {
        this.logger.warn(
          'ThematicDirectionsManagerController: Error destroying concept dropdown',
          error
        );
      }
      this.#conceptDropdown = null;
    }

    // Call parent implementation to maintain base class behavior
    super._postDestroy();

    this.logger.debug('ThematicDirectionsManagerController: Cleanup complete');
  }
}

export default ThematicDirectionsManagerController;
