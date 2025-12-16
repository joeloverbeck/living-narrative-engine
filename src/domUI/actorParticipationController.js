/**
 * @file ActorParticipationController - Manages the actor participation control panel UI
 * Allows players to toggle actor participation in turn-based gameplay to optimize LLM API costs.
 * Follows the PerceptibleEventSenderController pattern with separate initialize() method.
 * @see PerceptibleEventSenderController
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { ENGINE_READY_UI } from '../constants/eventIds.js';
import {
  ACTOR_COMPONENT_ID,
  NAME_COMPONENT_ID,
  PARTICIPATION_COMPONENT_ID,
} from '../constants/componentIds.js';

/**
 * Controller for the actor participation panel
 * Manages UI state, event listeners, and actor participation toggles
 */
class ActorParticipationController {
  #eventBus;
  #documentContext;
  #logger;
  #entityManager;
  #actorParticipationWidget;
  #actorParticipationList;
  #actorParticipationStatus;
  #boundHandleToggle;
  #gameReadyHandler;
  #statusTimeout = null;
  // Will be read in ACTPARCONPAN-006 when implementing participation toggle updates
  // eslint-disable-next-line no-unused-private-class-members
  #actors = [];

  /**
   * Creates a new ActorParticipationController
   *
   * @param {object} dependencies - The dependency injection container
   * @param {object} dependencies.eventBus - Event bus for system events (ISafeEventDispatcher)
   * @param {object} dependencies.documentContext - DOM query interface (IDocumentContext)
   * @param {object} dependencies.logger - Logging service (ILogger)
   * @param {object} dependencies.entityManager - Entity management service (IEntityManager)
   */
  constructor({ eventBus, documentContext, logger, entityManager }) {
    validateDependency(eventBus, 'ISafeEventDispatcher', logger, {
      requiredMethods: ['dispatch', 'subscribe'],
    });
    validateDependency(documentContext, 'IDocumentContext', logger, {
      requiredMethods: ['query', 'create'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntitiesWithComponent', 'addComponent'],
    });

    this.#eventBus = eventBus;
    this.#documentContext = documentContext;
    this.#logger = logger;
    this.#entityManager = entityManager;
  }

  /**
   * Initialize the controller by caching elements, attaching listeners, and subscribing to events
   * Must be called after construction before the controller can function
   *
   * @throws {Error} If initialization fails
   */
  initialize() {
    try {
      this.#logger.debug('[ActorParticipation] Starting initialization...');
      this.#cacheElements();
      this.#attachEventListeners();
      this.#subscribeToGameEvents();

      // Defensive loading: try to load actors immediately if they're already available
      try {
        const actors = this.#loadActors();
        this.#renderActorList(actors);
        this.#logger.debug(
          '[ActorParticipation] Defensive actor loading succeeded'
        );
      } catch (err) {
        this.#logger.debug(
          '[ActorParticipation] Defensive actor loading failed (expected if actors not yet loaded)',
          err
        );
      }

      this.#logger.info('[ActorParticipation] Initialization complete');
    } catch (err) {
      this.#logger.error('[ActorParticipation] Failed to initialize', err);
      throw err;
    }
  }

  /**
   * Cache DOM element references for the actor participation panel
   * Logs warnings if expected elements are not found
   *
   * @private
   */
  #cacheElements() {
    this.#actorParticipationWidget = this.#documentContext.query(
      '#actor-participation-widget'
    );
    this.#actorParticipationList = this.#documentContext.query(
      '#actor-participation-list-container'
    );
    this.#actorParticipationStatus = this.#documentContext.query(
      '#actor-participation-status'
    );

    if (!this.#actorParticipationWidget) {
      this.#logger.warn(
        '[ActorParticipation] Widget element not found (#actor-participation-widget)'
      );
    }
    if (!this.#actorParticipationList) {
      this.#logger.warn(
        '[ActorParticipation] List element not found (#actor-participation-list-container)'
      );
    }
    if (!this.#actorParticipationStatus) {
      this.#logger.warn(
        '[ActorParticipation] Status element not found (#actor-participation-status)'
      );
    }
  }

  /**
   * Attach DOM event listeners using event delegation pattern
   * Listens for 'change' events on the list container to handle checkbox toggles
   *
   * @private
   */
  #attachEventListeners() {
    if (!this.#actorParticipationList) {
      this.#logger.warn(
        '[ActorParticipation] Cannot attach event listeners - list container not found'
      );
      return;
    }

    // Event delegation: listen on list container for checkbox changes
    this.#boundHandleToggle = this.#handleParticipationToggle.bind(this);
    this.#actorParticipationList.addEventListener(
      'change',
      this.#boundHandleToggle
    );
    this.#logger.debug(
      '[ActorParticipation] Event listeners attached to actor participation list'
    );
  }

  /**
   * Subscribe to game lifecycle events
   * Subscribes to ENGINE_READY_UI to load actors when the game is ready
   *
   * @private
   */
  #subscribeToGameEvents() {
    this.#gameReadyHandler = this.#handleGameReady.bind(this);
    const unsubscribe = this.#eventBus.subscribe(
      ENGINE_READY_UI,
      this.#gameReadyHandler
    );

    if (!unsubscribe) {
      this.#logger.error(
        '[ActorParticipation] CRITICAL: Failed to subscribe to ENGINE_READY_UI'
      );
    } else {
      this.#logger.debug(
        '[ActorParticipation] Successfully subscribed to ENGINE_READY_UI'
      );
    }
  }

  /**
   * Handle the ENGINE_READY_UI event
   * Loads actors from entity manager and renders the participation list
   *
   * @private
   */
  #handleGameReady() {
    try {
      this.#logger.info(
        '[ActorParticipation] Loading actors for participation panel'
      );
      const actors = this.#loadActors();
      this.#renderActorList(actors);
    } catch (err) {
      this.#logger.error('[ActorParticipation] Failed to load actors', err);
    }
  }

  /**
   * Handle participation toggle events from checkboxes
   * Updates participation component and provides UI feedback
   *
   * @param {Event} event - The change event from the checkbox
   * @private
   */
  async #handleParticipationToggle(event) {
    const checkbox = event.target;

    // Validate event target
    if (checkbox.tagName !== 'INPUT' || checkbox.type !== 'checkbox') {
      return; // Not a checkbox, ignore
    }

    const actorId = checkbox.dataset.actorId;
    const newParticipationState = checkbox.checked;

    if (!actorId) {
      this.#logger.warn(
        '[ActorParticipation] Checkbox missing data-actor-id attribute'
      );
      return;
    }

    this.#logger.debug(
      `[ActorParticipation] Toggling participation for actor ${actorId} to ${newParticipationState}`
    );

    try {
      const success = await this.#updateParticipation(
        actorId,
        newParticipationState
      );
      if (success) {
        const statusMessage = newParticipationState
          ? `Enabled participation for ${actorId}`
          : `Disabled participation for ${actorId}`;
        this.#showStatus(statusMessage, 'success');
      } else {
        throw new Error('Failed to update participation component');
      }
    } catch (err) {
      this.#logger.error(
        `[ActorParticipation] Error updating participation for actor ${actorId}`,
        err
      );
      // Revert checkbox state
      checkbox.checked = !newParticipationState;
      this.#showStatus('Error updating participation', 'error');
    }
  }

  /**
   * Update the participation component for an actor
   * Uses addComponent which handles both adding new and updating existing components
   *
   * @param {string} actorId - The entity ID of the actor
   * @param {boolean} participating - The new participation state
   * @returns {Promise<boolean>} True if update succeeded, false otherwise
   * @private
   */
  async #updateParticipation(actorId, participating) {
    try {
      // addComponent() handles both adding new components and updating existing ones
      const success = await this.#entityManager.addComponent(
        actorId,
        PARTICIPATION_COMPONENT_ID,
        { participating }
      );

      if (success) {
        this.#logger.debug(
          `[ActorParticipation] Updated participation for actor ${actorId} to ${participating}`
        );
        return true;
      }

      this.#logger.warn(
        `[ActorParticipation] Failed to update participation component for actor ${actorId}`
      );
      return false;
    } catch (err) {
      this.#logger.error(
        `[ActorParticipation] Error updating participation component for actor ${actorId}`,
        err
      );
      return false;
    }
  }

  /**
   * Load actors from entity manager
   * Queries for all entities with the actor component and builds actor data objects
   *
   * @returns {Array} Array of actor data objects { id, name, participating }
   * @private
   */
  #loadActors() {
    // Use getEntitiesWithComponent - returns Entity[] already filtered
    const actorEntities =
      this.#entityManager.getEntitiesWithComponent(ACTOR_COMPONENT_ID);

    const actors = actorEntities.map((entity) => {
      // Get name from core:name component (has 'text' property)
      const nameData = entity.getComponentData(NAME_COMPONENT_ID);

      // Get participation from core:participation component (has 'participating' property)
      const participationData = entity.getComponentData(
        PARTICIPATION_COMPONENT_ID
      );

      return {
        id: entity.id,
        name: nameData?.text || entity.id, // Fallback to entity ID
        participating: participationData?.participating ?? true,
      };
    });

    // Sort alphabetically by name
    actors.sort((a, b) => a.name.localeCompare(b.name));

    // Store actors for future reference
    this.#actors = actors;

    this.#logger.debug(`[ActorParticipation] Loaded ${actors.length} actors`);
    return actors;
  }

  /**
   * Render the actor list UI
   * Clears existing content and renders either the actor list or empty state
   *
   * @param {Array} actors - Array of actor data objects
   * @private
   */
  #renderActorList(actors) {
    if (!this.#actorParticipationList) {
      this.#logger.warn(
        '[ActorParticipation] Cannot render actors: list container not found'
      );
      return;
    }

    // Clear existing content
    this.#actorParticipationList.innerHTML = '';

    if (actors.length === 0) {
      this.#renderEmpty();
      return;
    }

    // Create and append actor items
    actors.forEach((actor) => {
      const listItem = this.#createActorListItem(actor);
      this.#actorParticipationList.appendChild(listItem);
    });

    this.#logger.info(
      `[ActorParticipation] Rendered ${actors.length} actors in participation panel`
    );
  }

  /**
   * Create a list item element for an actor
   * Builds the checkbox and label structure for the actor
   *
   * @param {object} actor - Actor data object { id, name, participating }
   * @returns {HTMLElement} The actor list item container
   * @private
   */
  #createActorListItem(actor) {
    const container = this.#documentContext.create('div');
    container.className = 'actor-participation-item';

    const checkbox = this.#documentContext.create('input');
    checkbox.type = 'checkbox';
    checkbox.id = `actor-participation-${actor.id}`;
    checkbox.checked = actor.participating;
    checkbox.dataset.actorId = actor.id;

    const label = this.#documentContext.create('label');
    label.htmlFor = checkbox.id;
    label.textContent = actor.name;

    container.appendChild(checkbox);
    container.appendChild(label);

    return container;
  }

  /**
   * Render the empty state message
   * Displays a message when no actors are available
   *
   * @private
   */
  #renderEmpty() {
    const emptyMessage = this.#documentContext.create('p');
    emptyMessage.className = 'empty-list-message';
    emptyMessage.textContent = 'No actors found';
    this.#actorParticipationList.appendChild(emptyMessage);
    this.#logger.debug(
      '[ActorParticipation] Rendered empty actor list message'
    );
  }

  /**
   * Display a status message with auto-clear functionality
   * Shows success or error messages that automatically clear after 3 seconds
   *
   * @param {string} message - The message to display
   * @param {string} type - The message type ('success' or 'error')
   * @private
   */
  #showStatus(message, type = 'success') {
    if (!this.#actorParticipationStatus) {
      this.#logger.warn(
        '[ActorParticipation] Cannot show status: status element not found'
      );
      return;
    }

    // Clear any existing timeout
    if (this.#statusTimeout) {
      clearTimeout(this.#statusTimeout);
      this.#statusTimeout = null;
    }

    // Update status text and class
    this.#actorParticipationStatus.textContent = message;
    this.#actorParticipationStatus.className = `status-message status-${type}`;

    // Auto-clear after 3 seconds
    this.#statusTimeout = setTimeout(() => {
      if (this.#actorParticipationStatus) {
        this.#actorParticipationStatus.textContent = '';
        this.#actorParticipationStatus.className = 'status-message';
      }
      this.#statusTimeout = null;
    }, 3000);

    this.#logger.debug(
      `[ActorParticipation] Displayed status: ${message} (${type})`
    );
  }

  /**
   * Refresh the actor participation panel
   * Reloads actors from entity manager and re-renders the list
   * Can be called externally when actor data changes
   */
  refresh() {
    this.#logger.info(
      '[ActorParticipation] Refreshing actor participation panel'
    );
    const actors = this.#loadActors();
    this.#renderActorList(actors);
  }

  /**
   * Clean up the controller by removing event listeners and clearing references
   * Should be called when the controller is no longer needed
   */
  cleanup() {
    try {
      this.#logger.info('[ActorParticipation] Cleaning up...');

      // Clear status timeout
      if (this.#statusTimeout) {
        clearTimeout(this.#statusTimeout);
        this.#statusTimeout = null;
      }

      // Unsubscribe from event bus
      if (this.#gameReadyHandler) {
        this.#eventBus.unsubscribe(ENGINE_READY_UI, this.#gameReadyHandler);
        this.#gameReadyHandler = null;
        this.#logger.debug(
          '[ActorParticipation] Unsubscribed from game events'
        );
      }

      // Remove DOM event listeners
      if (this.#actorParticipationList && this.#boundHandleToggle) {
        this.#actorParticipationList.removeEventListener(
          'change',
          this.#boundHandleToggle
        );
      }

      // Clear references
      this.#actorParticipationWidget = null;
      this.#actorParticipationList = null;
      this.#actorParticipationStatus = null;
      this.#boundHandleToggle = null;

      this.#logger.debug('[ActorParticipation] Cleanup complete');
    } catch (err) {
      this.#logger.error('[ActorParticipation] Error during cleanup', err);
    }
  }
}

export default ActorParticipationController;
