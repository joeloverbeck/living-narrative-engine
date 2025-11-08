/**
 * @file ActorParticipationController - Manages the actor participation control panel UI
 * Allows players to toggle actor participation in turn-based gameplay to optimize LLM API costs.
 * Follows the PerceptibleEventSenderController pattern with separate initialize() method.
 * @see PerceptibleEventSenderController
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { ENGINE_READY_UI } from '../constants/eventIds.js';
// PARTICIPATION_COMPONENT_ID will be used in ACTPARCONPAN-005 for actor loading
// Imported here to establish the dependency early
// eslint-disable-next-line no-unused-vars
import { PARTICIPATION_COMPONENT_ID } from '../constants/componentIds.js';

/**
 * Controller for the actor participation panel
 * Manages UI state, event listeners, and actor participation toggles
 */
class ActorParticipationController {
  #eventBus;
  #documentContext;
  #logger;
  // Will be used in ACTPARCONPAN-005 to load actors with participation component
  // eslint-disable-next-line no-unused-private-class-members
  #entityManager;
  #actorParticipationWidget;
  #actorParticipationList;
  #actorParticipationStatus;
  #boundHandleToggle;
  #gameReadyHandler;

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
      requiredMethods: ['getEntitiesWithComponent'],
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
    this.#actorParticipationWidget = this.#documentContext.query('#actor-participation-widget');
    this.#actorParticipationList = this.#documentContext.query(
      '#actor-participation-list-container'
    );
    this.#actorParticipationStatus = this.#documentContext.query('#actor-participation-status');

    if (!this.#actorParticipationWidget) {
      this.#logger.warn('[ActorParticipation] Widget element not found (#actor-participation-widget)');
    }
    if (!this.#actorParticipationList) {
      this.#logger.warn('[ActorParticipation] List element not found (#actor-participation-list-container)');
    }
    if (!this.#actorParticipationStatus) {
      this.#logger.warn('[ActorParticipation] Status element not found (#actor-participation-status)');
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
      this.#logger.warn('[ActorParticipation] Cannot attach event listeners - list container not found');
      return;
    }

    // Event delegation: listen on list container for checkbox changes
    this.#boundHandleToggle = this.#handleParticipationToggle.bind(this);
    this.#actorParticipationList.addEventListener('change', this.#boundHandleToggle);
    this.#logger.debug('[ActorParticipation] Event listeners attached to actor participation list');
  }

  /**
   * Subscribe to game lifecycle events
   * Subscribes to ENGINE_READY_UI to load actors when the game is ready
   *
   * @private
   */
  #subscribeToGameEvents() {
    this.#gameReadyHandler = this.#handleGameReady.bind(this);
    const unsubscribe = this.#eventBus.subscribe(ENGINE_READY_UI, this.#gameReadyHandler);

    if (!unsubscribe) {
      this.#logger.error('[ActorParticipation] CRITICAL: Failed to subscribe to ENGINE_READY_UI');
    } else {
      this.#logger.debug('[ActorParticipation] Successfully subscribed to ENGINE_READY_UI');
    }
  }

  /**
   * Handle the ENGINE_READY_UI event
   * Placeholder - will be implemented in ACTPARCONPAN-005 to load actors
   *
   * @private
   */
  #handleGameReady() {
    this.#logger.info('[ActorParticipation] ✓ ENGINE_READY_UI event received - actor loading will be implemented in ACTPARCONPAN-005');
  }

  /**
   * Handle participation toggle events from checkboxes
   * Placeholder - will be implemented in ACTPARCONPAN-006 to handle component updates
   *
   * @param {Event} event - The change event from the checkbox
   * @private
   */
  #handleParticipationToggle(event) {
    if (event.target && event.target.type === 'checkbox') {
      this.#logger.debug('[ActorParticipation] Participation toggle event received - handler will be implemented in ACTPARCONPAN-006', {
        checked: event.target.checked,
        actorId: event.target.dataset?.actorId,
      });
    }
  }

  /**
   * Clean up the controller by removing event listeners and clearing references
   * Should be called when the controller is no longer needed
   */
  cleanup() {
    try {
      this.#logger.info('[ActorParticipation] Cleaning up...');

      // Unsubscribe from event bus
      if (this.#gameReadyHandler) {
        this.#eventBus.unsubscribe(ENGINE_READY_UI, this.#gameReadyHandler);
        this.#gameReadyHandler = null;
        this.#logger.debug('[ActorParticipation] Unsubscribed from game events');
      }

      // Remove DOM event listeners
      if (this.#actorParticipationList && this.#boundHandleToggle) {
        this.#actorParticipationList.removeEventListener('change', this.#boundHandleToggle);
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
