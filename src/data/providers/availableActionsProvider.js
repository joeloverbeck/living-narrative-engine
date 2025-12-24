/**
 * @file Provides available actions data for an actor by delegating to discovery and indexing services.
 * @see src/data/providers/availableActionsProvider.js
 */

import { IAvailableActionsProvider } from '../../interfaces/IAvailableActionsProvider.js';
import { POSITION_COMPONENT_ID } from '../../constants/componentIds.js';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../constants/core.js';
import { ServiceSetup } from '../../utils/serviceInitializerUtils.js';
import {
  COMPONENT_ADDED_ID,
  COMPONENTS_BATCH_ADDED_ID,
} from '../../constants/eventIds.js';

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../turns/dtos/actionComposite.js').ActionComposite} ActionComposite */
/** @typedef {import('../../turns/ports/IActionIndexer.js').IActionIndexer} IActionIndexer */
/** @typedef {import('../../interfaces/IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoveryService */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/IEventBus.js').IEventBus} IEventBus */

/** @typedef {import('../../turns/dtos/AIGameStateDTO.js').AIAvailableActionDTO} AIAvailableActionDTO */

/**
 * Component types that affect action availability.
 * When these components are added/modified, the action cache should be invalidated.
 *
 * @constant {string[]}
 */
const ACTION_AFFECTING_COMPONENTS = [
  'core:position', // Items moving to/from locations
  'items-core:', // Core item markers (item, portable, openable)
  'items:', // Items mod components (inventory, aimable, etc.)
  'containers-core:', // Container components for storage interactions
];

/**
 * Provider that discovers actions via ActionDiscoveryService, indexes them via
 * ActionIndexingService, and returns a final list of ActionComposites. It also
 * caches results within the scope of a single turn to prevent re-computation.
 *
 * @augments IAvailableActionsProvider
 */
export class AvailableActionsProvider extends IAvailableActionsProvider {
  #actionDiscoveryService;
  #actionIndexer;
  #entityManager;
  #eventBus;
  #logger;

  // --- Turn-scoped Cache ---
  #lastTurnContext = null;
  #cachedActions = new Map();

  // --- Event Subscriptions ---
  #eventSubscriptions = [];

  /**
   * @param {object} dependencies
   * @param {IActionDiscoveryService} dependencies.actionDiscoveryService
   * @param {IActionIndexer} dependencies.actionIndexingService
   * @param {IEntityManager} dependencies.entityManager
   * @param {IEventBus} dependencies.eventBus
   * @param {ILogger} dependencies.logger
   * @param dependencies.serviceSetup
   */
  constructor({
    actionDiscoveryService,
    actionIndexingService: actionIndexer,
    entityManager,
    eventBus,
    logger,
    serviceSetup,
  }) {
    super();
    const setup = serviceSetup ?? new ServiceSetup();

    this.#logger = setup.setupService('AvailableActionsProvider', logger, {
      actionDiscoveryService: {
        value: actionDiscoveryService,
        requiredMethods: ['getValidActions'],
      },
      actionIndexer: { value: actionIndexer, requiredMethods: ['index'] },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntityInstance'],
      },
      eventBus: {
        value: eventBus,
        requiredMethods: ['subscribe', 'unsubscribe'],
      },
    });

    this.#actionDiscoveryService = actionDiscoveryService;
    this.#actionIndexer = actionIndexer;
    this.#entityManager = entityManager;
    this.#eventBus = eventBus;

    // Subscribe to component change events for cache invalidation
    this.#setupEventSubscriptions();

    this.#logger.debug(
      'AvailableActionsProvider initialized and dependencies validated.'
    );
  }

  /**
   * Fetch the current location entity for an actor, if available.
   *
   * @private
   * @param {Entity} actor - Actor whose location should be resolved.
   * @returns {Promise<Entity|null>} Location entity or `null` when unavailable.
   */
  async #getLocationEntity(actor) {
    const positionComponent = actor.getComponentData(POSITION_COMPONENT_ID);
    const locationId = positionComponent?.locationId;
    return locationId
      ? this.#entityManager.getEntityInstance(locationId)
      : null;
  }

  /**
   * Write a detailed discovery trace to the logger if supported.
   *
   * @private
   * @param {string} actorId - Identifier of the actor.
   * @param {object} trace - Trace output from discovery service.
   * @param {ILogger} logger - Logger used for output.
   * @returns {void}
   */
  #logDiscoveryTrace(actorId, trace, logger) {
    if (trace && logger.table && logger.groupCollapsed && logger.groupEnd) {
      logger.debug(`[Action Discovery Trace for actor ${actorId}]`);
      logger.groupCollapsed(`Action Discovery Trace for ${actorId}`);
      logger.table(trace.logs);
      logger.groupEnd();
    }
  }

  /**
   * Warn when the available actions list is capped by the configured maximum.
   *
   * @private
   * @param {number} requestedCount - Number of actions discovered.
   * @param {number} cappedCount - Number of actions returned after capping.
   * @param {string} actorId - Actor identifier.
   * @param {ILogger} logger - Logger used for warnings.
   * @returns {void}
   */
  #handleOverflow(requestedCount, cappedCount, actorId, logger) {
    if (
      requestedCount > MAX_AVAILABLE_ACTIONS_PER_TURN &&
      cappedCount === MAX_AVAILABLE_ACTIONS_PER_TURN
    ) {
      logger.warn(
        `[Overflow] actor=${actorId} requested=${requestedCount} capped=${cappedCount}`
      );
    }
  }

  /**
   * Discovers and indexes available actions for the given actor. Results are
   * cached for the duration of the turn.
   *
   * @override
   * @param {Entity} actor
   * @param {ITurnContext} turnContext
   * @param {ILogger} logger
   * @returns {Promise<ActionComposite[]>}
   */
  async get(actor, turnContext, logger) {
    if (this.#lastTurnContext !== turnContext) {
      this.#lastTurnContext = turnContext;
      this.#cachedActions.clear();
      logger.debug(
        'New turn detected. Clearing AvailableActionsProvider cache.'
      );
    }

    const cacheKey = actor.id;
    if (this.#cachedActions.has(cacheKey)) {
      logger.debug(
        `[Cache Hit] Returning cached actions for actor ${actor.id}`
      );
      return this.#cachedActions.get(cacheKey);
    }

    logger.debug(`[Cache Miss] Discovering actions for actor ${actor.id}`);

    try {
      const locationEntity = await this.#getLocationEntity(actor);

      // Assembling the context is now much simpler and no longer leaks dependencies.
      const actionCtx = {
        currentLocation: locationEntity,
        worldContext: turnContext?.game ?? {},
      };

      // The method signature is the same, but the payload of actionCtx is different.
      const {
        actions: discoveredActions,
        errors,
        trace,
      } = await this.#actionDiscoveryService.getValidActions(actor, actionCtx, {
        trace: true,
      });

      const normalisedActions = Array.isArray(discoveredActions)
        ? discoveredActions
        : [];

      if (!Array.isArray(discoveredActions)) {
        logger.warn(
          'AvailableActionsProvider: Discovery service returned a non-array "actions" result. Treating as empty list.',
          {
            actorId: actor.id,
            receivedType:
              discoveredActions === null ? 'null' : typeof discoveredActions,
          }
        );
      }

      this.#logDiscoveryTrace(actor.id, trace, logger);

      // --- Log any formatting errors that occurred ---
      if (errors && errors.length > 0) {
        logger.warn(
          `Encountered ${errors.length} formatting error(s) during action discovery for actor ${actor.id}. These actions will not be available.`
        );
        errors.forEach((err) => {
          logger.warn(
            `  - Action '${err.actionId}' (Target: ${err.targetId || 'N/A'}): ${err.error}`
          );
        });
      }

      // Index the discovered actions to create the final, ordered list.
      const indexedActions = this.#actionIndexer.index(
        normalisedActions,
        actor.id
      );

      const requestedCount = normalisedActions.length;
      const cappedCount = indexedActions.length;

      this.#handleOverflow(requestedCount, cappedCount, actor.id, logger);

      this.#cachedActions.set(cacheKey, indexedActions);

      return indexedActions;
    } catch (err) {
      logger.error(
        `AvailableActionsProvider: Error discovering/indexing actions for ${actor.id}: ${err.message}`,
        err
      );
      return [];
    }
  }

  /**
   * Set up event subscriptions for cache invalidation.
   *
   * @private
   */
  #setupEventSubscriptions() {
    // Subscribe to single component added events
    const componentChangeListener = this.#handleComponentChange.bind(this);
    const componentAddedSubscription = this.#eventBus.subscribe(
      COMPONENT_ADDED_ID,
      componentChangeListener
    );
    this.#storeSubscription({
      unsubscribe: componentAddedSubscription,
      eventName: COMPONENT_ADDED_ID,
      listener: componentChangeListener,
    });

    // Subscribe to batch component added events
    const batchChangeListener = this.#handleComponentsBatchChange.bind(this);
    const batchAddedSubscription = this.#eventBus.subscribe(
      COMPONENTS_BATCH_ADDED_ID,
      batchChangeListener
    );
    this.#storeSubscription({
      unsubscribe: batchAddedSubscription,
      eventName: COMPONENTS_BATCH_ADDED_ID,
      listener: batchChangeListener,
    });

    this.#logger.debug(
      'AvailableActionsProvider: Subscribed to component change events for cache invalidation'
    );
  }

  /**
   * Safely persist subscription metadata so we can always unsubscribe.
   *
   * @private
   * @param {{
   *   unsubscribe: (() => boolean) | null,
   *   eventName: string,
   *   listener: (event: object) => void,
   * }} subscription
   * @returns {void}
   */
  #storeSubscription(subscription) {
    const { unsubscribe, eventName, listener } = subscription;
    if (typeof unsubscribe === 'function') {
      this.#eventSubscriptions.push({ unsubscribe });
      return;
    }

    // Fallback: remember event name and listener so destroy() can call the bus directly
    this.#eventSubscriptions.push({ eventName, listener });
  }

  /**
   * Handle component added event and invalidate cache if needed.
   *
   * @private
   * @param {object} event - Component added event
   */
  #handleComponentChange(event) {
    const { componentTypeId } = event.payload || {};
    if (!componentTypeId) {
      return;
    }

    if (this.#shouldInvalidateCache(componentTypeId)) {
      this.#logger.debug(
        `AvailableActionsProvider: Cache invalidated due to ${componentTypeId} component change`
      );
      this.#cachedActions.clear();
    }
  }

  /**
   * Handle batch component added event and invalidate cache if needed.
   *
   * @private
   * @param {object} event - Batch components added event
   */
  #handleComponentsBatchChange(event) {
    const { componentTypeIds } = event.payload || {};
    if (!componentTypeIds || !Array.isArray(componentTypeIds)) {
      return;
    }

    // Check if any of the changed components affect action availability
    const shouldInvalidate = componentTypeIds.some((componentTypeId) =>
      this.#shouldInvalidateCache(componentTypeId)
    );

    if (shouldInvalidate) {
      this.#logger.debug(
        `AvailableActionsProvider: Cache invalidated due to batch component changes: ${componentTypeIds.join(', ')}`
      );
      this.#cachedActions.clear();
    }
  }

  /**
   * Determine if cache should be invalidated based on component type.
   *
   * @private
   * @param {string} componentTypeId - Component type ID
   * @returns {boolean} True if cache should be invalidated
   */
  #shouldInvalidateCache(componentTypeId) {
    return ACTION_AFFECTING_COMPONENTS.some((prefix) =>
      componentTypeId.startsWith(prefix)
    );
  }

  /**
   * Clean up event subscriptions and resources.
   * Should be called when the provider is no longer needed.
   */
  destroy() {
    // Unsubscribe from all events
    for (const subscription of this.#eventSubscriptions) {
      try {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
          continue;
        }

        this.#eventBus.unsubscribe(
          subscription?.eventName,
          subscription?.listener
        );
      } catch (error) {
        this.#logger.warn(
          'AvailableActionsProvider: Failed to unsubscribe from event during destroy()',
          {
            eventName: subscription?.eventName,
            error: error?.message,
          }
        );
      }
    }
    this.#eventSubscriptions = [];

    // Clear cache
    this.#cachedActions.clear();

    this.#logger.debug('AvailableActionsProvider: Destroyed and cleaned up');
  }
}
