/**
 * @file perceptibleEventSenderController.js
 * @description Controller for sending custom perceptible events to actors in locations.
 * Provides UI for composing event messages, selecting target locations, filtering recipients,
 * and dispatching events via the operation system.
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { ENGINE_READY_UI } from '../constants/eventIds.js';
import { EXITS_COMPONENT_ID } from '../constants/componentIds.js';

/** @typedef {import('../interfaces/ISafeEventDispatcher.js').default} ISafeEventDispatcher */
/** @typedef {import('./documentContext.js').default} IDocumentContext */
/** @typedef {import('../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../entities/entityManager.js').default} IEntityManager */
/** @typedef {import('../logic/operationInterpreter.js').default} IOperationInterpreter */

/**
 * Controller for the perceptible event sender UI panel.
 * Manages form state, entity queries, validation, and event dispatching.
 */
class PerceptibleEventSenderController {
  #eventBus;
  #documentContext;
  #logger;
  #entityManager;
  #operationInterpreter;
  #elements;
  #boundHandlers;
  #statusTimeout;
  #gameReadyHandler;

  /**
   * Creates a new PerceptibleEventSenderController instance.
   *
   * @param {object} dependencies - Injected dependencies
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event bus for game lifecycle events
   * @param {IDocumentContext} dependencies.documentContext - Document access interface
   * @param {ILogger} dependencies.logger - Logger for debugging and errors
   * @param {IEntityManager} dependencies.entityManager - Entity manager for querying locations and actors
   * @param {IOperationInterpreter} dependencies.operationInterpreter - Operation interpreter for executing operations
   */
  constructor({ eventBus, documentContext, logger, entityManager, operationInterpreter }) {
    // Validate dependencies
    validateDependency(eventBus, 'ISafeEventDispatcher', logger, {
      requiredMethods: ['dispatch', 'subscribe'],
    });

    validateDependency(documentContext, 'IDocumentContext', logger, {
      requiredMethods: ['query', 'create'],
    });

    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntitiesWithComponent'],
    });

    validateDependency(operationInterpreter, 'IOperationInterpreter', logger, {
      requiredMethods: ['execute'],
    });

    this.#eventBus = eventBus;
    this.#documentContext = documentContext;
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#operationInterpreter = operationInterpreter;
    this.#elements = {};
    this.#boundHandlers = {};
    this.#statusTimeout = null;
  }

  /**
   * Initializes the controller by caching DOM elements, attaching event listeners,
   * and loading initial data.
   */
  initialize() {
    try {
      this.#logger.debug('[PerceptibleEventSender] Starting initialization...');
      this.#cacheElements();
      this.#logger.debug('[PerceptibleEventSender] Elements cached successfully');
      
      // Disable location selector initially until locations are loaded
      // This provides clear UX feedback that the feature isn't ready yet
      this.#elements.locationSelect.disabled = true;
      
      this.#attachEventListeners();
      this.#logger.debug('[PerceptibleEventSender] Event listeners attached');
      
      this.#subscribeToGameEvents();
      
      // Defensive: Load locations immediately if entities already exist
      // This handles cases where initialization happens after entities are loaded
      try {
        const locations = this.#entityManager.getEntitiesWithComponent(EXITS_COMPONENT_ID);
        if (locations && locations.length > 0) {
          this.#logger.debug(`[PerceptibleEventSender] Found ${locations.length} locations during initialization - loading immediately`);
          this.#loadLocations();
        } else {
          this.#logger.debug('[PerceptibleEventSender] No locations found during initialization - will wait for ENGINE_READY_UI event');
        }
      } catch (loadErr) {
        // Non-critical error - locations will be loaded when ENGINE_READY_UI fires
        this.#logger.warn('[PerceptibleEventSender] Could not check for locations during initialization', loadErr);
      }
      
      this.#logger.debug('[PerceptibleEventSender] Initialization complete');
    } catch (err) {
      this.#logger.error('[PerceptibleEventSender] Failed to initialize', err);
      throw err;
    }
  }

  /**
   * Caches references to all DOM elements used by this controller.
   *
   * @private
   */
  #cacheElements() {
    this.#elements = {
      messageInput: this.#documentContext.query('#perceptible-event-message'),
      locationSelect: this.#documentContext.query('#perceptible-event-location'),
      actorSelect: this.#documentContext.query('#perceptible-event-actors'),
      actorFilterContainer: this.#documentContext.query('#actor-filter-container'),
      sendButton: this.#documentContext.query('#send-perceptible-event-button'),
      statusArea: this.#documentContext.query('#perceptible-event-status'),
      widget: this.#documentContext.query('#perceptible-event-sender-widget'),
    };

    // Verify required elements exist
    const requiredElements = ['messageInput', 'locationSelect', 'actorSelect', 'sendButton', 'statusArea'];
    requiredElements.forEach((elementKey) => {
      if (!this.#elements[elementKey]) {
        throw new Error(`Required element not found: ${elementKey}`);
      }
    });
  }

  /**
   * Attaches event listeners to form controls.
   *
   * @private
   */
  #attachEventListeners() {
    // Message input change
    this.#boundHandlers.onMessageChange = () => this.#validateForm();
    this.#elements.messageInput.addEventListener('input', this.#boundHandlers.onMessageChange);

    // Location select change
    this.#boundHandlers.onLocationChange = (event) => {
      const locationId = event.target.value;
      if (locationId) {
        this.#loadActorsForLocation(locationId);
      } else {
        // Clear actor list when no location selected
        this.#elements.actorSelect.innerHTML = '';
      }
      this.#validateForm();
    };
    this.#elements.locationSelect.addEventListener('change', this.#boundHandlers.onLocationChange);

    // Filter mode radio changes
    this.#boundHandlers.onFilterModeChange = () => {
      this.#onFilterModeChange();
    };

    // Get all filter mode radio buttons and attach listeners
    // Note: DocumentContext.query() only returns single element, need querySelectorAll for multiple
    const widget = this.#documentContext.query('#perceptible-event-sender-widget');
    if (widget) {
      const filterModeRadios = widget.querySelectorAll('input[name="filter-mode"]');
      filterModeRadios.forEach((radio) => {
        radio.addEventListener('change', this.#boundHandlers.onFilterModeChange);
      });
    }

    // Actor selection change
    this.#boundHandlers.onActorChange = () => this.#validateForm();
    this.#elements.actorSelect.addEventListener('change', this.#boundHandlers.onActorChange);

    // Send button click
    this.#boundHandlers.onSendClick = () => this.#sendPerceptibleEvent();
    this.#elements.sendButton.addEventListener('click', this.#boundHandlers.onSendClick);

    // Enter key in message textarea
    this.#boundHandlers.onMessageKeyDown = (event) => {
      if (event.key === 'Enter' && event.ctrlKey && !this.#elements.sendButton.disabled) {
        this.#sendPerceptibleEvent();
      }
    };
    this.#elements.messageInput.addEventListener('keydown', this.#boundHandlers.onMessageKeyDown);
  }

  /**
   * Subscribes to game lifecycle events.
   * Loads locations when the game engine is ready.
   *
   * @private
   */
  #subscribeToGameEvents() {
    this.#gameReadyHandler = this.#handleGameReady.bind(this);
    const unsubscribe = this.#eventBus.subscribe(ENGINE_READY_UI, this.#gameReadyHandler);
    
    if (!unsubscribe) {
      this.#logger.error('[PerceptibleEventSender] CRITICAL: Failed to subscribe to ENGINE_READY_UI event - locations may not load');
    } else {
      this.#logger.debug('[PerceptibleEventSender] Successfully subscribed to ENGINE_READY_UI event');
    }
  }

  /**
   * Handles the ENGINE_READY_UI event to load locations when game is ready.
   *
   * @private
   */
  #handleGameReady() {
    this.#logger.info('[PerceptibleEventSender] ✓ ENGINE_READY_UI event received - loading locations now');
    this.#loadLocations();
  }

  /**
   * Loads all locations from the entity system and populates the location dropdown.
   *
   * @private
   */
  #loadLocations() {
    try {
      this.#logger.debug('[PerceptibleEventSender] Loading locations from entity manager...');
      const locations = this.#entityManager.getEntitiesWithComponent(EXITS_COMPONENT_ID);

      if (!locations || locations.length === 0) {
        this.#logger.warn('[PerceptibleEventSender] ⚠️ No locations found - selector will remain disabled');
        return;
      }

      // Success - locations found!
      this.#logger.info(`[PerceptibleEventSender] ✓ Found ${locations.length} locations`);

      // Clear and populate dropdown
      this.#elements.locationSelect.innerHTML = '<option value="">-- Select Location --</option>';

      locations.forEach((location) => {
        const nameComp = location.getComponent('core:name');
        const option = this.#documentContext.create('option');
        option.value = location.id;
        option.textContent = nameComp?.name || location.id;
        this.#elements.locationSelect.appendChild(option);
      });

      // Enable the selector now that locations are loaded
      this.#elements.locationSelect.disabled = false;

      this.#logger.info(`[PerceptibleEventSender] ✓ Successfully loaded ${locations.length} locations into selector`);
    } catch (err) {
      this.#logger.error('[PerceptibleEventSender] ❌ Failed to load locations', err);
      this.#showStatus('Failed to load locations', 'error');
    }
  }

  /**
   * Loads all actors in the specified location and populates the actor multi-select.
   *
   * @param {string} locationId - The ID of the location to query actors for
   * @private
   */
  #loadActorsForLocation(locationId) {
    try {
      const allActors = this.#entityManager.getEntitiesWithComponent('core:actor');
      const actorsInLocation = allActors.filter((actor) => {
        const position = actor.getComponent('core:position');
        return position?.locationId === locationId;
      });

      // Populate actor multi-select
      this.#elements.actorSelect.innerHTML = '';
      actorsInLocation.forEach((actor) => {
        const nameComp = actor.getComponent('core:name');
        const option = this.#documentContext.create('option');
        option.value = actor.id;
        option.textContent = nameComp?.name || actor.id;
        this.#elements.actorSelect.appendChild(option);
      });

      this.#logger.debug(`Found ${actorsInLocation.length} actors in location ${locationId}`);
    } catch (err) {
      this.#logger.error('Failed to load actors', err);
      this.#elements.actorSelect.innerHTML = '';
    }
  }

  /**
   * Handles filter mode radio button changes by showing/hiding the actor selector.
   *
   * @private
   */
  #onFilterModeChange() {
    const selectedMode = this.#getSelectedFilterMode();

    if (selectedMode === 'specific' || selectedMode === 'exclude') {
      this.#elements.actorFilterContainer.style.display = 'block';
    } else {
      this.#elements.actorFilterContainer.style.display = 'none';
      // Clear selections when switching to 'all' mode
      this.#elements.actorSelect.selectedIndex = -1;
    }

    this.#validateForm();
  }

  /**
   * Gets the currently selected filter mode from radio buttons.
   *
   * @returns {string} The selected filter mode ('all', 'specific', or 'exclude')
   * @private
   */
  #getSelectedFilterMode() {
    const widget = this.#documentContext.query('#perceptible-event-sender-widget');
    if (widget) {
      const filterModeRadios = widget.querySelectorAll('input[name="filter-mode"]');
      for (const radio of filterModeRadios) {
        if (radio.checked) {
          return radio.value;
        }
      }
    }
    return 'all'; // Default fallback
  }

  /**
   * Gets an array of selected actor IDs from the multi-select element.
   *
   * @returns {string[]} Array of selected actor IDs
   * @private
   */
  #getSelectedActorIds() {
    const selectedOptions = Array.from(this.#elements.actorSelect.selectedOptions);
    return selectedOptions.map((option) => option.value);
  }

  /**
   * Validates the form and enables/disables the send button accordingly.
   *
   * @private
   */
  #validateForm() {
    const message = this.#elements.messageInput.value.trim();
    const locationId = this.#elements.locationSelect.value;
    const filterMode = this.#getSelectedFilterMode();
    const selectedActorIds = this.#getSelectedActorIds();

    let isValid = true;

    // Validation rules
    if (!message) {
      isValid = false;
    }

    if (!locationId) {
      isValid = false;
    }

    // For specific/exclude modes, at least one actor must be selected
    if ((filterMode === 'specific' || filterMode === 'exclude') && selectedActorIds.length === 0) {
      isValid = false;
    }

    this.#elements.sendButton.disabled = !isValid;
  }

  /**
   * Constructs the event payload for DISPATCH_PERCEPTIBLE_EVENT operation.
   *
   * @returns {object} The operation object ready for dispatch
   * @private
   */
  #constructEventPayload() {
    const message = this.#elements.messageInput.value.trim();
    const locationId = this.#elements.locationSelect.value;
    const filterMode = this.#getSelectedFilterMode();
    const selectedActorIds = this.#getSelectedActorIds();

    const contextualData = {};

    if (filterMode === 'specific') {
      contextualData.recipientIds = selectedActorIds;
    } else if (filterMode === 'exclude') {
      contextualData.excludedActorIds = selectedActorIds;
    }
    // 'all' mode: leave both arrays empty

    return {
      type: 'DISPATCH_PERCEPTIBLE_EVENT',
      parameters: {
        location_id: locationId,
        description_text: message,
        perception_type: 'state_change_observable',
        actor_id: 'system', // System token (no entity)
        contextualData,
        log_entry: true, // Always log for perception tracking
      },
    };
  }

  /**
   * Sends the perceptible event by executing the DISPATCH_PERCEPTIBLE_EVENT operation.
   *
   * @private
   */
  async #sendPerceptibleEvent() {
    const payload = this.#constructEventPayload();

    try {
      // Execute operation directly - this ensures proper perception log updates
      const operation = {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: {
          location_id: payload.parameters.location_id,
          description_text: payload.parameters.description_text,
          perception_type: payload.parameters.perception_type,
          actor_id: payload.parameters.actor_id,
          target_id: null,
          involved_entities: [],
          contextualData: payload.parameters.contextualData,
          log_entry: true, // Critical: ensures perception logs are updated
        },
      };

      // Execute with minimal execution context
      await this.#operationInterpreter.execute(operation, {
        event: { payload: {} },
        context: {},
        evaluationContext: {},
      });

      this.#showStatus('Event sent successfully', 'success');
      this.#clearForm();
    } catch (err) {
      this.#logger.error('Failed to execute perceptible event operation', err);
      this.#showStatus('Failed to send event. Please try again.', 'error');
    }
  }

  /**
   * Displays a status message to the user with the specified type.
   * Auto-clears after 5 seconds.
   *
   * @param {string} message - The message to display
   * @param {string} type - The message type ('success' or 'error')
   * @private
   */
  #showStatus(message, type) {
    // Clear previous timeout
    if (this.#statusTimeout) {
      clearTimeout(this.#statusTimeout);
      this.#statusTimeout = null;
    }

    // Set message and styling
    this.#elements.statusArea.textContent = message;
    this.#elements.statusArea.className = `status-message-area ${type}`;

    // Auto-clear after 5 seconds
    this.#statusTimeout = setTimeout(() => {
      this.#elements.statusArea.textContent = '';
      this.#elements.statusArea.className = 'status-message-area';
      this.#statusTimeout = null;
    }, 5000);
  }

  /**
   * Clears the form by resetting all inputs to their default state.
   *
   * @private
   */
  #clearForm() {
    this.#elements.messageInput.value = '';
    this.#elements.locationSelect.selectedIndex = 0;
    this.#elements.actorSelect.innerHTML = '';
    this.#elements.actorFilterContainer.style.display = 'none';

    // Reset filter mode to 'all'
    if (this.#elements.widget) {
      const filterModeRadios = this.#elements.widget.querySelectorAll('input[name="filter-mode"]');
      if (filterModeRadios && filterModeRadios.length > 0) {
        filterModeRadios.forEach((radio) => {
          radio.checked = radio.value === 'all';
        });
      }
    }

    this.#validateForm();
  }

  /**
   * Cleans up event listeners and clears state.
   * Called when the controller is being disposed.
   */

  /**
   * Manually refreshes locations and actors data from the entity manager.
   * Useful for reloading data after entities are loaded or changed.
   *
   * @public
   */
  refresh() {
    this.#logger.debug('[PerceptibleEventSender] Manual refresh requested - reloading locations');
    this.#loadLocations();
  }

  cleanup() {
    try {
      // Clear status timeout
      if (this.#statusTimeout) {
        clearTimeout(this.#statusTimeout);
        this.#statusTimeout = null;
      }

      // Unsubscribe from game events
      if (this.#gameReadyHandler) {
        this.#eventBus.unsubscribe(ENGINE_READY_UI, this.#gameReadyHandler);
        this.#gameReadyHandler = null;
        this.#logger.debug('Unsubscribed from game lifecycle events');
      }

      // Remove event listeners
      if (this.#elements.messageInput && this.#boundHandlers.onMessageChange) {
        this.#elements.messageInput.removeEventListener('input', this.#boundHandlers.onMessageChange);
        this.#elements.messageInput.removeEventListener('keydown', this.#boundHandlers.onMessageKeyDown);
      }

      if (this.#elements.locationSelect && this.#boundHandlers.onLocationChange) {
        this.#elements.locationSelect.removeEventListener('change', this.#boundHandlers.onLocationChange);
      }

      if (this.#elements.actorSelect && this.#boundHandlers.onActorChange) {
        this.#elements.actorSelect.removeEventListener('change', this.#boundHandlers.onActorChange);
      }

      if (this.#elements.sendButton && this.#boundHandlers.onSendClick) {
        this.#elements.sendButton.removeEventListener('click', this.#boundHandlers.onSendClick);
      }

      // Remove filter mode listeners
      const widget = this.#documentContext.query('#perceptible-event-sender-widget');
      if (widget && this.#boundHandlers.onFilterModeChange) {
        const filterModeRadios = widget.querySelectorAll('input[name="filter-mode"]');
        filterModeRadios.forEach((radio) => {
          radio.removeEventListener('change', this.#boundHandlers.onFilterModeChange);
        });
      }

      // Clear cached elements and handlers
      this.#elements = {};
      this.#boundHandlers = {};

      this.#logger.debug('PerceptibleEventSenderController cleaned up');
    } catch (err) {
      this.#logger.error('Error during PerceptibleEventSenderController cleanup', err);
    }
  }
}

export default PerceptibleEventSenderController;
