/**
 * @file Controller for thematic directions management interface
 * @description Manages UI for viewing, editing, and organizing thematic directions
 */

import { BaseCharacterBuilderController } from '../../characterBuilder/controllers/BaseCharacterBuilderController.js';
import { UIStateManager } from '../../shared/characterBuilder/uiStateManager.js';
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
  #notificationTimeout = null;

  // Modal state management
  /**
   * Current modal state
   *
   * @type {object | null}
   */
  #activeModal = null;

  /**
   * Pending modal action callback
   *
   * @type {Function|null}
   */
  #pendingModalAction = null;

  /**
   * Modal keyboard event handler
   *
   * @type {Function|null}
   */
  #modalKeyHandler = null;

  /**
   * Previously focused element
   *
   * @type {Element|null}
   */
  #previousFocus = null;

  /**
   * Creates a new ThematicDirectionsManagerController instance
   *
   * @param {object} dependencies - The dependencies object
   * @param {ILogger} dependencies.logger - Logger instance (validated by base class)
   * @param {CharacterBuilderService} dependencies.characterBuilderService - Character builder service (validated by base class)
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event dispatcher (validated by base class)
   * @param {ISchemaValidator} dependencies.schemaValidator - Schema validator (validated by base class)
   * @param {ControllerLifecycleOrchestrator} dependencies.controllerLifecycleOrchestrator - Lifecycle orchestrator (required by base)
   * @param {DOMElementManager} dependencies.domElementManager - DOM helper service (required by base)
   * @param {EventListenerRegistry} dependencies.eventListenerRegistry - Event listener registry (required by base)
   * @param {AsyncUtilitiesToolkit} dependencies.asyncUtilitiesToolkit - Async toolkit (required by base)
   * @param {PerformanceMonitor} dependencies.performanceMonitor - Performance monitor (required by base)
   * @param {MemoryManager} dependencies.memoryManager - Memory helper (required by base)
   * @param {ErrorHandlingStrategy} dependencies.errorHandlingStrategy - Error handler (required by base)
   * @param {ValidationService} dependencies.validationService - Validation helper (required by base)
   */
  constructor({
    logger,
    characterBuilderService,
    eventBus,
    schemaValidator,
    controllerLifecycleOrchestrator,
    domElementManager,
    eventListenerRegistry,
    asyncUtilitiesToolkit,
    performanceMonitor,
    memoryManager,
    errorHandlingStrategy,
    validationService,
  }) {
    super({
      logger,
      characterBuilderService,
      eventBus,
      schemaValidator,
      controllerLifecycleOrchestrator,
      domElementManager,
      eventListenerRegistry,
      asyncUtilitiesToolkit,
      performanceMonitor,
      memoryManager,
      errorHandlingStrategy,
      validationService,
    });

    // Initialize page-specific fields
    this.#currentFilter = '';
    this.#currentConcept = null;
    this.#directionsData = [];
    this.#inPlaceEditors = new Map();
    this._dropdownUpdated = false;
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
        this.logger.info('PreviousItemsDropdown created successfully');
      } catch (dropdownError) {
        this.logger.error('Failed to initialize dropdown:', dropdownError);
        this.#fallbackToNativeSelect();
      }

      this.logger.debug(
        'ThematicDirectionsManagerController: Additional services initialized'
      );
    } catch (error) {
      this.logger.error(
        'ThematicDirectionsManagerController: Failed to initialize',
        error
      );
      if (error && typeof error === 'object') {
        // Mark the error so upstream handlers don't double-log
        error.__tdmInitializationLogged = true;
      }
      this._showError(
        'Failed to initialize directions manager. Please refresh the page.'
      );
      throw error; // Re-throw for base class to handle
    }
  }

  /**
   * Wrap base service initialization so we can surface errors specific to this controller
   *
   * @protected
   * @override
   * @returns {Promise<void>}
   */
  async _initializeServices() {
    try {
      await super._initializeServices();
    } catch (error) {
      if (!error?.__tdmInitializationLogged) {
        this.logger.error(
          'ThematicDirectionsManagerController: Failed to initialize services',
          error
        );
        this._showError(
          'Failed to initialize directions manager. Please refresh the page.'
        );
        if (error && typeof error === 'object') {
          error.__tdmInitializationLogged = true;
        }
      }
      throw error;
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
    // Note: Loading state is handled by base class during initialization sequence
    // Don't call _showLoading() here as UIStateManager may not be initialized yet
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
        try {
          this.logger.info('Loading concepts into dropdown:', {
            conceptCount: conceptsWithDirections.length,
            concepts: conceptsWithDirections.map((c) => ({
              id: c.id,
              concept: c.concept?.substring(0, 50),
            })),
          });
          await this.#conceptDropdown.loadItems(conceptsWithDirections);
          this._dropdownUpdated = true; // Mark that dropdown has been updated with new content
          this.logger.info('Successfully loaded concepts into dropdown');
        } catch (dropdownError) {
          this.logger.error(
            'Failed to load items into dropdown:',
            dropdownError
          );
          // Continue without dropdown update
        }
      } else {
        this.logger.warn(
          'Concept dropdown not initialized, cannot load concepts'
        );
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
      this._showError('Failed to load thematic directions. Please try again.');
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
    // Ensure directionsData is always an array (defensive check for tests)
    if (!Array.isArray(this.#directionsData)) {
      this.logger.warn(
        'directionsData is not an array, initializing to empty array',
        {
          type: typeof this.#directionsData,
          value: this.#directionsData,
        }
      );
      this.#directionsData = [];
    }

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

    // Display results with contextual messages
    if (this.#directionsData.length === 0) {
      this._showEmptyWithMessage(
        'No thematic directions found. Create your first direction to get started.'
      );
    } else if (filteredData.length === 0) {
      this._showEmptyWithMessage(
        'No directions match your current filters. Try adjusting your search criteria.'
      );
    } else {
      this.#displayDirections(filteredData);
      this._showResults(filteredData);
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

    try {
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
    } catch (error) {
      this.logger.error(
        'ThematicDirectionsManagerController: Failed to initialize inline editor',
        error
      );
      display.classList.add('editable-field-disabled');
      display.setAttribute('data-editor-disabled', 'true');
      display.title = 'Inline editing unavailable';
    }

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
      title: { min: 5, max: 300 },
      description: { min: 20, max: 4500 },
      coreTension: { min: 10, max: 1800 },
      uniqueTwist: { min: 10, max: 9000 },
      narrativePotential: { min: 10, max: 9000 },
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
   * Delete a thematic direction (public method for testing)
   *
   * @public
   * @param {ThematicDirection} direction - Direction to delete
   */
  deleteDirection(direction) {
    this.#handleDeleteDirection(direction);
  }

  /**
   * Handle delete direction
   *
   * @private
   * @param {ThematicDirection} direction - Direction to delete
   */
  #handleDeleteDirection(direction) {
    this._showConfirmationModal({
      title: 'Delete Thematic Direction',
      message: `Are you sure you want to delete "${direction.title}"? This action cannot be undone.`,
      onConfirm: async () => {
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

          this._showSuccess('Thematic direction deleted successfully');

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
      },
      confirmText: 'Delete',
      cancelText: 'Keep',
      type: 'confirm',
    });
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
      this._showAlert({
        title: 'No Orphaned Directions',
        message: 'There are no orphaned thematic directions to clean up.',
        type: 'info',
      });
      return;
    }

    this._showConfirmationModal({
      title: 'Clean Up Orphaned Directions',
      message: `This will remove ${orphanedCount} orphaned thematic direction(s) that are not linked to any character concepts. Continue?`,
      onConfirm: async () => {
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

          this._showSuccess(
            `Successfully deleted ${orphanedDirections.length} orphaned direction(s).`
          );

          this.logger.info(
            'ThematicDirectionsManagerController: Cleaned orphaned directions',
            { deletedCount: orphanedDirections.length }
          );
        } catch (error) {
          this.logger.error(
            'ThematicDirectionsManagerController: Failed to cleanup orphans',
            error
          );
          alert('Failed to cleanup orphaned directions. Please try again.');
        }
      },
      confirmText: `Remove ${orphanedCount} Orphaned`,
      cancelText: 'Cancel',
      type: 'confirm',
    });
  }

  /**
   * Show confirmation modal with dynamic content
   *
   * @private
   * @param {object} options - Modal options
   * @param {string} options.title - Modal title
   * @param {string} options.message - Modal message
   * @param {Function} options.onConfirm - Confirm callback
   * @param {Function} [options.onCancel] - Cancel callback
   * @param {string} [options.confirmText] - Confirm button text
   * @param {string} [options.cancelText] - Cancel button text
   * @param {string} [options.type] - Modal type (confirm, alert, error)
   */
  _showConfirmationModal(options) {
    const {
      title,
      message,
      onConfirm,
      onCancel,
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      type = 'confirm',
    } = options;

    // Store modal state
    this.#activeModal = {
      type: 'confirmation',
      options: options,
    };

    // Store callbacks
    this.#pendingModalAction = onConfirm;
    this.#activeModal.onCancel = onCancel;

    // Update modal content
    this._updateModalContent({
      title,
      message,
      confirmText,
      cancelText,
      type,
    });

    // Show modal using base controller helpers
    this._showModal();

    // Focus confirm button for accessibility
    const confirmBtn = this._getElement('modalConfirmBtn');
    if (confirmBtn) {
      setTimeout(() => confirmBtn.focus(), 100);
    }
  }

  /**
   * Update modal content
   *
   * @private
   * @param {object} content - Content to display
   */
  _updateModalContent(content) {
    const { title, message, confirmText, cancelText, type } = content;

    // Update text content
    this._setElementText('modalTitle', title);
    this._setElementText('modalMessage', message);
    this._setElementText('modalConfirmBtn', confirmText);
    this._setElementText('modalCancelBtn', cancelText);

    // Update modal styling based on type
    const modal = this._getElement('confirmationModal');
    if (modal) {
      modal.className = `modal modal-${type}`;
    }

    // Show/hide buttons based on type
    if (type === 'alert') {
      this._hideElement('modalCancelBtn');
    } else {
      this._showElement('modalCancelBtn');
    }
  }

  /**
   * Show the modal
   *
   * @private
   */
  _showModal() {
    // Show confirmation modal using base controller helpers
    this._showElement('confirmationModal', 'flex');

    // Track focus before showing modal
    this._trackFocus();

    // Setup ESC key handler
    this._setupModalKeyHandling();

    // Focus confirm button for accessibility
    const confirmBtn = this._getElement('modalConfirmBtn');
    if (confirmBtn) {
      setTimeout(() => confirmBtn.focus(), 100);
    }
  }

  /**
   * Close the modal
   *
   * @private
   * @param {boolean} [cancelled] - Whether modal was cancelled
   */
  _closeModal(cancelled = false) {
    if (!this.#activeModal) return;

    // Call cancel callback if cancelled
    if (cancelled && this.#activeModal.onCancel) {
      try {
        this.#activeModal.onCancel();
      } catch (error) {
        this.logger.error('Error in modal cancel callback:', error);
      }
    }

    // Hide modal using base controller helper
    this._hideElement('confirmationModal');

    // Clear modal state
    this.#activeModal = null;
    this.#pendingModalAction = null;

    // Remove ESC handler
    this._removeModalKeyHandling();

    // Restore focus to previous element
    this._restoreFocus();
  }

  /**
   * Handle modal confirm button click
   *
   * @private
   */
  _handleModalConfirm() {
    if (!this.#pendingModalAction) {
      this.logger.warn('No pending modal action to confirm');
      return;
    }

    // Execute the pending action
    try {
      const result = this.#pendingModalAction();

      // Handle promise results
      if (result && typeof result.then === 'function') {
        result
          .then(() => {
            this._closeModal();
          })
          .catch((error) => {
            this.logger.error('Modal action failed:', error);
            alert('Operation failed. Please try again.');
          });
      } else {
        // Synchronous action
        this._closeModal();
      }
    } catch (error) {
      this.logger.error('Error executing modal action:', error);
      alert('An error occurred. Please try again.');
    }
  }

  /**
   * Handle modal cancel
   *
   * @private
   */
  _handleModalCancel() {
    this._closeModal(true); // true = cancelled
  }

  /**
   * Setup keyboard handling for modal
   *
   * @private
   */
  _setupModalKeyHandling() {
    // Store handler reference for removal
    this.#modalKeyHandler = (e) => {
      if (e.key === 'Escape' && this.#activeModal) {
        e.preventDefault();
        this._closeModal(true);
      }
    };

    // Use capture phase to handle before other handlers
    document.addEventListener('keydown', this.#modalKeyHandler, true);
  }

  /**
   * Remove modal keyboard handling
   *
   * @private
   */
  _removeModalKeyHandling() {
    if (this.#modalKeyHandler) {
      document.removeEventListener('keydown', this.#modalKeyHandler, true);
      this.#modalKeyHandler = null;
    }
  }

  /**
   * Track and restore focus
   *
   * @private
   */
  _trackFocus() {
    this.#previousFocus = document.activeElement;
  }

  /**
   * Restore focus after modal closes
   *
   * @private
   */
  _restoreFocus() {
    if (this.#previousFocus && this.#previousFocus.focus) {
      try {
        this.#previousFocus.focus();
      } catch (err) {
        // Element might be removed from DOM
        this.logger.debug('Failed to restore focus to previous element:', err);
      }
    }
    this.#previousFocus = null;
  }

  /**
   * Show alert modal (single button)
   *
   * @private
   * @param {object} options - Alert options
   */
  _showAlert(options) {
    this._showConfirmationModal({
      ...options,
      type: 'alert',
      onConfirm: () => {}, // Just close
      confirmText: 'OK',
    });
  }

  /**
   * Clean up InPlaceEditor instances
   *
   * @private
   */
  #cleanupInPlaceEditors() {
    // Safely destroy all editor instances
    this.#inPlaceEditors.forEach((editor, key) => {
      try {
        if (editor && typeof editor.destroy === 'function') {
          editor.destroy();
        }
      } catch (error) {
        this.logger.warn(
          `Failed to destroy InPlaceEditor instance for key: ${key}`,
          error
        );
      }
    });

    // Clear the map completely
    this.#inPlaceEditors.clear();

    // Force a small delay to allow DOM cleanup
    setTimeout(() => {
      // Additional cleanup - remove any orphaned editor elements
      const orphanedEditors = document.querySelectorAll('.in-place-editor');
      orphanedEditors.forEach((element) => {
        try {
          element.remove();
        } catch (error) {
          this.logger.debug('Failed to remove orphaned editor element:', error);
        }
      });
    }, 10);
  }

  /**
   * Extract unique concepts that have associated thematic directions
   *
   * @private
   * @param {Array<{direction: ThematicDirection, concept: CharacterConcept|null}>} directionsWithConcepts - Array of directions with their associated concepts
   * @returns {CharacterConcept[]} Array of concepts with directions
   */
  #extractConceptsWithDirections(directionsWithConcepts) {
    // Guard against undefined/null
    if (!directionsWithConcepts) {
      this.logger.warn(
        'directionsWithConcepts is null/undefined, returning empty array'
      );
      return [];
    }

    // Guard against non-array values
    if (!Array.isArray(directionsWithConcepts)) {
      this.logger.warn(
        'directionsWithConcepts is not an array, returning empty array',
        {
          type: typeof directionsWithConcepts,
          value: directionsWithConcepts,
        }
      );
      return [];
    }

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
   * @private
   * @param {boolean} isLoading - Whether dropdown should show loading state
   */
  #setDropdownLoading(isLoading) {
    const selectElement = this._getElement('conceptSelector');
    if (!selectElement) return;

    if (isLoading) {
      selectElement.disabled = true;
      selectElement.classList.add('loading');

      // Store current options to restore later (only if dropdown hasn't been updated)
      this._cachedOptions = Array.from(selectElement.options);
      this._dropdownUpdated = false; // Reset the flag

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

      // Only restore cached options if the dropdown hasn't been updated with new content
      if (
        this._cachedOptions &&
        this._cachedOptions.length > 0 &&
        !this._dropdownUpdated
      ) {
        selectElement.innerHTML = '';
        this._cachedOptions.forEach((option) => {
          selectElement.appendChild(option.cloneNode(true));
        });
      }

      // Clean up cached data
      this._cachedOptions = null;
      this._dropdownUpdated = false;
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
    this.eventBus.dispatch('core:analytics_track', {
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
   * Show success notification (missing from base controller)
   *
   * @private
   * @param {string} message - Success message
   * @param {number} [duration] - Display duration in ms
   */
  _showSuccess(message, duration = 3000) {
    // Create or reuse notification element
    let notification = document.getElementById('success-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'success-notification';
      notification.className = 'notification notification-success';
      document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.classList.add('notification-visible');

    // Auto-hide after duration
    clearTimeout(this.#notificationTimeout);
    this.#notificationTimeout = setTimeout(() => {
      notification.classList.remove('notification-visible');
    }, duration);
  }

  /**
   * Show empty state with contextual message (enhancement)
   *
   * @private
   * @param {string} [customMessage] - Custom empty state message
   */
  _showEmptyWithMessage(customMessage) {
    this._showEmpty();

    // Update empty state message if element exists
    const emptyStateElement = this._getElement('emptyState');
    if (emptyStateElement && customMessage) {
      const messageElement = emptyStateElement.querySelector('.empty-message');
      if (messageElement) {
        messageElement.textContent = customMessage;
      }
    }
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
      this._showError('Failed to refresh concepts. Please try again.');
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
    this._addEventListener('modalConfirmBtn', 'click', () =>
      this._handleModalConfirm()
    );
    this._addEventListener('modalCancelBtn', 'click', () =>
      this._handleModalCancel()
    );
    this._addEventListener('closeModalBtn', 'click', () =>
      this._handleModalCancel()
    );

    // Click outside modal to close (backdrop click)
    this._addEventListener('confirmationModal', 'click', (e) => {
      if (e.target === e.currentTarget) {
        this._handleModalCancel();
      }
    });

    // Note: Delete buttons are handled within #createEditableDirectionElement
  }

  /**
   * Pre-destroy cleanup hook
   * Ensures all InPlaceEditor instances and modal state are properly destroyed
   *
   * @protected
   * @override
   */
  _preDestroy() {
    this.logger.debug(
      'ThematicDirectionsManagerController: Starting pre-destroy cleanup'
    );

    // Close any open modals
    if (this.#activeModal) {
      this._closeModal();
    }

    // Clear pending actions
    this.#pendingModalAction = null;

    // Remove any lingering handlers
    this._removeModalKeyHandling();

    // Clear notification timeout to prevent memory leaks
    if (this.#notificationTimeout) {
      clearTimeout(this.#notificationTimeout);
      this.#notificationTimeout = null;
    }

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

    // Check for potential memory leaks in development
    this.#checkForLeaks();

    // Call parent implementation to maintain base class behavior
    super._postDestroy();

    this.logger.debug('ThematicDirectionsManagerController: Cleanup complete');
  }

  /**
   * Debug method to check for potential memory leaks
   * Active in development mode, with lightweight monitoring in production
   *
   * @private
   */
  #checkForLeaks() {
    /* global process */
    const isDev = process.env.NODE_ENV === 'development';
    const leaks = [];

    // Check InPlaceEditors
    if (this.#inPlaceEditors && this.#inPlaceEditors.size > 0) {
      leaks.push({
        type: 'InPlaceEditor instances',
        count: this.#inPlaceEditors.size,
        severity: 'high',
      });
    }

    // Check DOM elements for orphaned editors
    const orphanedEditors = document.querySelectorAll('.in-place-editor');
    if (orphanedEditors.length > 0) {
      leaks.push({
        type: 'Orphaned editor DOM elements',
        count: orphanedEditors.length,
        severity: 'medium',
      });
    }

    // Check notification timeout
    if (this.#notificationTimeout) {
      leaks.push({
        type: 'Active notification timeout',
        count: 1,
        severity: 'low',
      });
    }

    // Check modal state
    if (this.#activeModal) {
      leaks.push({
        type: 'Active modal state',
        count: 1,
        severity: 'medium',
      });
    }

    // Check pending modal action
    if (this.#pendingModalAction) {
      leaks.push({
        type: 'Pending modal action',
        count: 1,
        severity: 'medium',
      });
    }

    // Check event handlers
    if (this.#modalKeyHandler) {
      leaks.push({
        type: 'Active modal key handler',
        count: 1,
        severity: 'medium',
      });
    }

    // Check dropdown instance
    if (this.#conceptDropdown) {
      leaks.push({
        type: 'Active concept dropdown',
        count: 1,
        severity: 'low',
      });
    }

    if (leaks.length > 0) {
      const leakSummary = leaks.map((leak) => `${leak.count} ${leak.type}`);
      const highSeverityLeaks = leaks.filter(
        (leak) => leak.severity === 'high'
      );

      if (isDev) {
        /* eslint-disable-next-line no-console */
        console.warn('Potential memory leaks detected:', leakSummary);
      }

      // Always log high severity leaks, even in production
      if (highSeverityLeaks.length > 0 || isDev) {
        this.logger.warn(
          'ThematicDirectionsManagerController: Potential memory leaks detected',
          {
            leaks: leakSummary,
            highSeverity: highSeverityLeaks.length,
            memoryUsage: process.memoryUsage?.(),
          }
        );
      }

      // Trigger automatic cleanup for high severity leaks in production
      if (!isDev && highSeverityLeaks.length > 0) {
        this.logger.info(
          'Triggering automatic memory cleanup due to detected leaks'
        );
        this.#cleanupInPlaceEditors();
      }
    }
  }
}

export default ThematicDirectionsManagerController;
