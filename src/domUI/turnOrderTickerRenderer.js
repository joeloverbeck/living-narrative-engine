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

  /**
   * Test-only helper to access private method for unit testing.
   * DO NOT USE IN PRODUCTION CODE.
   *
   * @param {object} entity - The actor entity
   * @returns {HTMLElement} The actor element
   * @private
   */
  __testCreateActorElement(entity) {
    return this.#_createActorElement(entity);
  }

  /**
   * Test-only helper to access private event handler for unit testing.
   * DO NOT USE IN PRODUCTION CODE.
   *
   * @param {object} event - Event object
   * @returns {void}
   * @private
   */
  __testHandleRoundStarted(event) {
    return this.#handleRoundStarted(event);
  }

  /**
   * Test-only helper to access private event handler for unit testing.
   * DO NOT USE IN PRODUCTION CODE.
   *
   * @param {object} event - Event object
   * @returns {void}
   * @private
   */
  __testHandleTurnStarted(event) {
    return this.#handleTurnStarted(event);
  }

  /**
   * Test-only helper to access private event handler for unit testing.
   * DO NOT USE IN PRODUCTION CODE.
   *
   * @param {object} event - Event object
   * @returns {void}
   * @private
   */
  __testHandleTurnEnded(event) {
    return this.#handleTurnEnded(event);
  }

  /**
   * Test-only helper to access private event handler for unit testing.
   * DO NOT USE IN PRODUCTION CODE.
   *
   * @param {object} event - Event object
   * @returns {void}
   * @private
   */
  __testHandleParticipationChanged(event) {
    return this.#handleParticipationChanged(event);
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
   * Renders portrait + name or name badge depending on data availability.
   *
   * @param {object} entity - The actor entity (must have id property)
   * @returns {HTMLElement} The actor element
   * @private
   */
  #_createActorElement(entity) {
    if (!entity || !entity.id) {
      this.#logger.error('Cannot create actor element: entity or entity.id missing', { entity });
      throw new Error('Entity must have an id property');
    }

    const entityId = entity.id;
    const displayData = this.#_getActorDisplayData(entityId);

    // Create container
    const container = this.#domElementFactory.create('div');
    container.classList.add('ticker-actor');
    container.setAttribute('data-entity-id', entityId);
    container.setAttribute('data-participating', displayData.participating.toString());

    if (displayData.portraitPath) {
      // Render with portrait
      this.#_createPortraitElement(container, displayData);
    } else {
      // Render with name badge
      this.#_createNameBadgeElement(container, displayData);
    }

    // Add name label below (always shown)
    const nameLabel = this.#domElementFactory.create('span');
    nameLabel.classList.add('ticker-actor-name');
    nameLabel.textContent = displayData.name;
    nameLabel.title = displayData.name; // Tooltip for long names
    container.appendChild(nameLabel);

    this.#logger.debug('Actor element created', {
      entityId,
      hasPortrait: !!displayData.portraitPath,
      name: displayData.name,
    });

    return container;
  }

  /**
   * Create portrait image element with error handling.
   *
   * @param {HTMLElement} container - Parent container
   * @param {object} displayData - Display data with portraitPath and name
   * @private
   */
  #_createPortraitElement(container, displayData) {
    const img = this.#domElementFactory.img(
      displayData.portraitPath,
      displayData.name,
      'ticker-actor-portrait'
    );
    img.loading = 'lazy'; // Performance optimization

    // Handle image load failures
    img.onerror = () => {
      this.#logger.warn('Portrait failed to load, switching to name badge', {
        portraitPath: displayData.portraitPath,
        name: displayData.name,
      });

      // Remove failed image
      img.remove();

      // Replace with name badge
      this.#_createNameBadgeElement(container, displayData);
    };

    container.appendChild(img);
  }

  /**
   * Create name badge element (no portrait fallback).
   *
   * @param {HTMLElement} container - Parent container
   * @param {object} displayData - Display data with name
   * @private
   */
  #_createNameBadgeElement(container, displayData) {
    const badge = this.#domElementFactory.div('ticker-actor-name-badge');
    const nameSpan = this.#domElementFactory.span('ticker-actor-name', displayData.name);
    nameSpan.title = displayData.name; // Tooltip for long names

    badge.appendChild(nameSpan);
    container.insertBefore(badge, container.firstChild); // Insert at beginning
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
   * Fetches actor entities and triggers full queue render.
   *
   * @param {object} event - Event object
   * @param {object} event.payload - Event payload
   * @param {number} event.payload.roundNumber - Round number
   * @param {string[]} event.payload.actors - Actor entity IDs in turn order
   * @param {string} event.payload.strategy - Turn order strategy
   * @private
   */
  #handleRoundStarted(event) {
    try {
      const { roundNumber, actors, strategy } = event.payload || {};

      if (!roundNumber || !Array.isArray(actors)) {
        this.#logger.warn('Invalid round_started event payload', { payload: event.payload });
        return;
      }

      this.#logger.info('Round started', { roundNumber, actorCount: actors.length, strategy });

      // Update round number display
      if (this.#roundNumberElement) {
        this.#roundNumberElement.textContent = `ROUND ${roundNumber}`;
      }

      // Convert actor IDs to entity objects for render method
      // The render method expects entity objects with id property
      const actorEntities = actors.map(actorId => ({ id: actorId }));

      // Render the full queue with animations
      this.render(actorEntities);

      // Reset current actor tracking
      this.#_currentActorId = null;

    } catch (error) {
      this.#logger.error('Failed to handle round_started event', {
        error: error.message,
        payload: event.payload,
      });
    }
  }

  /**
   * Handle turn_started event.
   * Highlights the current actor in the ticker.
   *
   * @param {object} event - Event object
   * @param {object} event.payload - Event payload
   * @param {string} event.payload.entityId - Current actor ID
   * @param {string} event.payload.entityType - Entity type ('player' or 'ai')
   * @private
   */
  #handleTurnStarted(event) {
    try {
      const { entityId, entityType } = event.payload || {};

      if (!entityId) {
        this.#logger.warn('Invalid turn_started event payload: missing entityId', {
          payload: event.payload,
        });
        return;
      }

      // Only process actor turns (entityType will be 'player' or 'ai' for actors)
      // Non-actor entities would have different entityType values
      if (entityType && entityType !== 'player' && entityType !== 'ai') {
        this.#logger.debug('Ignoring non-actor turn', { entityId, entityType });
        return;
      }

      this.#logger.debug('Turn started', { entityId });

      // Update current actor highlight
      this.updateCurrentActor(entityId);
      this.#_currentActorId = entityId;

    } catch (error) {
      this.#logger.error('Failed to handle turn_started event', {
        error: error.message,
        payload: event.payload,
      });
    }
  }

  /**
   * Handle turn_ended event.
   * Removes the actor from the ticker after their turn completes.
   *
   * @param {object} event - Event object
   * @param {object} event.payload - Event payload
   * @param {string} event.payload.entityId - Completed actor ID
   * @private
   */
  #handleTurnEnded(event) {
    try {
      const { entityId } = event.payload || {};

      if (!entityId) {
        this.#logger.warn('Invalid turn_ended event payload: missing entityId', {
          payload: event.payload,
        });
        return;
      }

      this.#logger.debug('Turn ended', { entityId });

      // Remove actor from ticker
      this.removeActor(entityId);

      // Clear current actor tracking if it was this actor
      if (this.#_currentActorId === entityId) {
        this.#_currentActorId = null;
      }

    } catch (error) {
      this.#logger.error('Failed to handle turn_ended event', {
        error: error.message,
        payload: event.payload,
      });
    }
  }

  /**
   * Handle participation component changes.
   * Updates visual state when actors are enabled/disabled.
   *
   * @param {object} event - Event object
   * @param {object} event.payload - Event payload
   * @param {string} event.payload.entityId - Entity ID
   * @param {string} event.payload.componentId - Component ID
   * @param {object} event.payload.data - Component data
   * @private
   */
  #handleParticipationChanged(event) {
    try {
      const { entityId, componentId, data } = event.payload || {};

      // Only process participation component changes
      if (componentId !== PARTICIPATION_COMPONENT_ID) {
        return;
      }

      if (!entityId) {
        this.#logger.warn('Invalid component event payload: missing entityId', {
          payload: event.payload,
        });
        return;
      }

      // Extract participation status
      const participating = data?.participating ?? true;

      this.#logger.debug('Participation changed', { entityId, participating });

      // Update visual state
      this.updateActorParticipation(entityId, participating);

    } catch (error) {
      this.#logger.error('Failed to handle participation change event', {
        error: error.message,
        payload: event.payload,
      });
    }
  }
}

export default TurnOrderTickerRenderer;
