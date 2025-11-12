/**
 * @file Turn Order Ticker Renderer
 * Manages the visual display of actor turn order in an RPG-style ticker.
 * Replaces the underutilized world name banner with actionable game state information.
 * @see game.html - #turn-order-ticker container
 * @see src/turns/roundManager.js - Dispatches core:round_started
 * @see src/turns/turnManager.js - Dispatches core:turn_started and core:turn_ended
 * @see specs/turn-order-ticker-implementation.spec.md
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { ROUND_STARTED_ID } from '../constants/eventIds.js';
import { TURN_STARTED_ID, TURN_ENDED_ID } from '../constants/eventIds.js';
import { COMPONENT_ADDED_ID } from '../constants/eventIds.js';
import { PARTICIPATION_COMPONENT_ID } from '../constants/componentIds.js';

/**
 * Renders and manages the turn order ticker UI component.
 * Displays actor portraits/names in turn order, animates round transitions,
 * and visually indicates participation status.
 */
class TurnOrderTickerRenderer {
  #logger;
  // eslint-disable-next-line no-unused-private-class-members -- Will be used in TURORDTIC-004+
  #_documentContext;
  #validatedEventDispatcher;
  #domElementFactory;
  #_entityManager;
  #_entityDisplayDataProvider;
  // eslint-disable-next-line no-unused-private-class-members -- Will be used in TURORDTIC-007+
  #_tickerContainerElement;
  #roundNumberElement;
  #actorQueueElement;
  // eslint-disable-next-line no-unused-private-class-members -- Will be used in TURORDTIC-008+
  #_currentActorId = null;
  #unsubscribeFunctions = [];

  /**
   * Creates a new TurnOrderTickerRenderer.
   *
   * @param {object} dependencies - Dependency injection object
   * @param {object} dependencies.logger - Logger instance
   * @param {object} dependencies.documentContext - DOM access wrapper
   * @param {object} dependencies.validatedEventDispatcher - Event bus
   * @param {object} dependencies.domElementFactory - DOM element creator
   * @param {object} dependencies.entityManager - Entity data access
   * @param {object} dependencies.entityDisplayDataProvider - Actor display data
   * @param {HTMLElement} dependencies.tickerContainerElement - #turn-order-ticker element
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    domElementFactory,
    entityManager,
    entityDisplayDataProvider,
    tickerContainerElement,
  }) {
    // Validate all dependencies
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(documentContext, 'IDocumentContext', logger, {
      requiredMethods: ['query', 'create'],
    });
    validateDependency(validatedEventDispatcher, 'IValidatedEventDispatcher', logger, {
      requiredMethods: ['dispatch', 'subscribe', 'unsubscribe'],
    });
    validateDependency(domElementFactory, 'DomElementFactory', logger, {
      requiredMethods: ['create'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance', 'hasComponent'],
    });
    validateDependency(entityDisplayDataProvider, 'EntityDisplayDataProvider', logger, {
      requiredMethods: ['getEntityName', 'getEntityPortraitPath'],
    });

    if (!tickerContainerElement || !(tickerContainerElement instanceof HTMLElement)) {
      throw new Error('tickerContainerElement must be a valid HTMLElement');
    }

    this.#logger = logger;
    this.#_documentContext = documentContext;
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#domElementFactory = domElementFactory;
    this.#_entityManager = entityManager;
    this.#_entityDisplayDataProvider = entityDisplayDataProvider;
    this.#_tickerContainerElement = tickerContainerElement;

    // Cache child elements
    this.#roundNumberElement = documentContext.query('#ticker-round-number');
    this.#actorQueueElement = documentContext.query('#ticker-actor-queue');

    if (!this.#roundNumberElement || !this.#actorQueueElement) {
      throw new Error('Ticker DOM structure missing required child elements');
    }

    this.#subscribeToEvents();
    this.#logger.info('TurnOrderTickerRenderer initialized');
  }

  /**
   * Subscribe to all relevant game events.
   *
   * @private
   */
  #subscribeToEvents() {
    // Subscribe to round lifecycle
    const unsubRoundStarted = this.#validatedEventDispatcher.subscribe(
      ROUND_STARTED_ID,
      this.#handleRoundStarted.bind(this)
    );
    if (unsubRoundStarted) this.#unsubscribeFunctions.push(unsubRoundStarted);

    // Subscribe to turn lifecycle
    const unsubTurnStarted = this.#validatedEventDispatcher.subscribe(
      TURN_STARTED_ID,
      this.#handleTurnStarted.bind(this)
    );
    if (unsubTurnStarted) this.#unsubscribeFunctions.push(unsubTurnStarted);

    const unsubTurnEnded = this.#validatedEventDispatcher.subscribe(
      TURN_ENDED_ID,
      this.#handleTurnEnded.bind(this)
    );
    if (unsubTurnEnded) this.#unsubscribeFunctions.push(unsubTurnEnded);

    // Subscribe to participation changes
    const unsubComponentAdded = this.#validatedEventDispatcher.subscribe(
      COMPONENT_ADDED_ID,
      this.#handleParticipationChanged.bind(this)
    );
    if (unsubComponentAdded) this.#unsubscribeFunctions.push(unsubComponentAdded);

    this.#logger.debug('TurnOrderTickerRenderer event subscriptions established');
  }

  // ========== PUBLIC API ==========

  /**
   * Render the full turn order queue.
   * Called when a new round starts.
   *
   * @param {Array} actors - Array of actor entities in turn order
   * @public
   */
  render(actors) {
    // Implementation in TURORDTIC-007
    this.#logger.debug('render() called', { actorCount: actors.length });
  }

  /**
   * Update the visual highlight for the current actor.
   *
   * @param {string} entityId - ID of the current actor
   * @public
   */
  updateCurrentActor(entityId) {
    // Implementation in TURORDTIC-008
    this.#logger.debug('updateCurrentActor() called', { entityId });
  }

  /**
   * Remove an actor from the ticker after their turn completes.
   *
   * @param {string} entityId - ID of the actor to remove
   * @public
   */
  removeActor(entityId) {
    // Implementation in TURORDTIC-009
    this.#logger.debug('removeActor() called', { entityId });
  }

  /**
   * Update the visual state of an actor based on participation status.
   *
   * @param {string} entityId - ID of the actor
   * @param {boolean} participating - Whether the actor is participating
   * @public
   */
  updateActorParticipation(entityId, participating) {
    // Implementation in TURORDTIC-010
    this.#logger.debug('updateActorParticipation() called', { entityId, participating });
  }

  /**
   * Clean up resources and unsubscribe from events.
   *
   * @public
   */
  dispose() {
    this.#unsubscribeFunctions.forEach(unsubFn => {
      if (typeof unsubFn === 'function') {
        unsubFn();
      }
    });
    this.#unsubscribeFunctions = [];
    this.#logger.info('TurnOrderTickerRenderer disposed');
  }

  /**
   * Test-only helper to access private method for unit testing.
   * DO NOT USE IN PRODUCTION CODE.
   *
   * @param {string} entityId - Entity ID
   * @returns {object} Display data
   * @private
   */
  __testGetActorDisplayData(entityId) {
    return this.#_getActorDisplayData(entityId);
  }

  // ========== PRIVATE HELPERS ==========

  /**
   * Extract display data (name, portrait) for an actor.
   * Handles missing components gracefully with fallbacks.
   *
   * @param {string} entityId - Entity ID of the actor
   * @returns {{ name: string, portraitPath?: string, participating: boolean }} Display data
   * @private
   */
  #_getActorDisplayData(entityId) {
    try {
      // Use EntityDisplayDataProvider for name and portrait
      const name = this.#_entityDisplayDataProvider.getEntityName(entityId, entityId);
      const portraitPath = this.#_entityDisplayDataProvider.getEntityPortraitPath(entityId);

      // Check participation status
      let participating = true; // Default to true
      if (this.#_entityManager.hasComponent(entityId, PARTICIPATION_COMPONENT_ID)) {
        const participationComponent = this.#_entityManager.getComponentData(
          entityId,
          PARTICIPATION_COMPONENT_ID
        );
        participating = participationComponent?.participating ?? true;
      }

      this.#logger.debug('Actor display data extracted', {
        entityId,
        name,
        hasPortrait: !!portraitPath,
        participating,
      });

      return {
        name,
        portraitPath,
        participating,
      };
    } catch (error) {
      // If any error occurs, return minimal fallback data
      this.#logger.warn('Failed to extract actor display data, using fallback', {
        entityId,
        error: error.message,
      });

      return {
        name: entityId,
        portraitPath: null,
        participating: true,
      };
    }
  }

  /**
   * Create a DOM element for an actor in the ticker.
   *
   * @param {object} _entity - The actor entity
   * @returns {HTMLElement} The actor element
   * @private
   */
  // eslint-disable-next-line no-unused-private-class-members -- Implementation in TURORDTIC-005
  #_createActorElement(_entity) {
    // Implementation in TURORDTIC-005
    const element = this.#domElementFactory.create('div');
    element.classList.add('ticker-actor');
    return element;
  }

  /**
   * Apply participation visual state to an actor element.
   *
   * @param {HTMLElement} element - The actor element
   * @param {boolean} participating - Whether the actor is participating
   * @private
   */
  // eslint-disable-next-line no-unused-private-class-members -- Implementation in TURORDTIC-010
  #_applyParticipationState(element, participating) {
    // Implementation in TURORDTIC-010
    element.setAttribute('data-participating', participating.toString());
  }

  /**
   * Animate an actor entering the ticker.
   *
   * @param {HTMLElement} element - The actor element
   * @param {number} _index - Position in queue (for stagger delay)
   * @private
   */
  // eslint-disable-next-line no-unused-private-class-members -- Implementation in TURORDTIC-011
  #_animateActorEntry(element, _index) {
    // Implementation in TURORDTIC-011
    element.classList.add('entering');
  }

  /**
   * Animate an actor exiting the ticker.
   *
   * @param {HTMLElement} _element - The actor element
   * @returns {Promise<void>} Resolves when animation completes
   * @private
   */
  // eslint-disable-next-line no-unused-private-class-members -- Implementation in TURORDTIC-012
  #_animateActorExit(_element) {
    // Implementation in TURORDTIC-012
    return Promise.resolve();
  }

  // ========== EVENT HANDLERS ==========

  /**
   * Handle round_started event.
   *
   * @param {object} event - Event object
   * @param {object} event.payload - Event payload
   * @param {number} event.payload.roundNumber - Round number
   * @param {string[]} event.payload.actors - Actor entity IDs
   * @param {string} event.payload.strategy - Turn order strategy ('round-robin' or 'initiative')
   * @private
   */
  #handleRoundStarted(event) {
    // Implementation in TURORDTIC-007
    this.#logger.debug('Round started event received', event.payload);
  }

  /**
   * Handle turn_started event.
   *
   * @param {object} event - Event object
   * @param {object} event.payload - Event payload
   * @param {string} event.payload.entityId - Current actor ID
   * @param {string} event.payload.entityType - Actor type ('player' or 'ai')
   * @private
   */
  #handleTurnStarted(event) {
    // Implementation in TURORDTIC-008
    this.#logger.debug('Turn started event received', event.payload);
  }

  /**
   * Handle turn_ended event.
   *
   * @param {object} event - Event object
   * @param {object} event.payload - Event payload
   * @param {string} event.payload.entityId - Completed actor ID
   * @param {boolean} event.payload.success - Whether turn completed successfully
   * @param {Error} [event.payload.error] - Optional error if turn failed
   * @private
   */
  #handleTurnEnded(event) {
    // Implementation in TURORDTIC-009
    this.#logger.debug('Turn ended event received', event.payload);
  }

  /**
   * Handle participation component changes.
   *
   * @param {object} event - Event object
   * @param {object} event.payload - Event payload
   * @private
   */
  #handleParticipationChanged(event) {
    // Implementation in TURORDTIC-010
    if (event.payload?.componentId === PARTICIPATION_COMPONENT_ID) {
      this.#logger.debug('Participation changed', event.payload);
    }
  }
}

export default TurnOrderTickerRenderer;
