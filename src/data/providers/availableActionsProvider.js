/**
 * @file Provides available actions data for an actor by delegating to discovery and indexing services.
 * @see src/data/providers/availableActionsProvider.js
 */

import { IAvailableActionsProvider } from '../../interfaces/iAvailableActionsProvider.js';
import { POSITION_COMPONENT_ID } from '../../constants/componentIds.js';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../constants/core.js';

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../turns/dtos/actionComposite.js').ActionComposite} ActionComposite */
/** @typedef {import('../../turns/ports/IActionIndexer.js').IActionIndexer} IActionIndexer */
/** @typedef {import('../../interfaces/IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoveryService */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/** @typedef {import('../../turns/dtos/AIGameStateDTO.js').AIAvailableActionDTO} AIAvailableActionDTO */

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

  // --- Turn-scoped Cache ---
  #lastTurnContext = null;
  #cachedActions = new Map();

  /**
   * @param {object} dependencies
   * @param {IActionDiscoveryService} dependencies.actionDiscoveryService
   * @param {IActionIndexer} dependencies.actionIndexingService
   * @param {IEntityManager} dependencies.entityManager
   */
  constructor({
    actionDiscoveryService,
    actionIndexingService: actionIndexer,
    entityManager,
  }) {
    super();
    this.#actionDiscoveryService = actionDiscoveryService;
    this.#actionIndexer = actionIndexer;
    this.#entityManager = entityManager;
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
    // If the turn context object changes, we assume it's a new turn and clear the cache.
    if (this.#lastTurnContext !== turnContext) {
      this.#lastTurnContext = turnContext;
      this.#cachedActions.clear();
      logger.debug(
        'New turn detected. Clearing AvailableActionsProvider cache.'
      );
    }

    // Check the cache for the actor's actions first.
    const cacheKey = actor.id;
    if (this.#cachedActions.has(cacheKey)) {
      logger.debug(
        `[Cache Hit] Returning cached actions for actor ${actor.id}`
      );
      return this.#cachedActions.get(cacheKey);
    }

    logger.debug(`[Cache Miss] Discovering actions for actor ${actor.id}`);

    try {
      const positionComponent = actor.getComponentData(POSITION_COMPONENT_ID);
      const locationId = positionComponent?.locationId;
      let locationEntity = null;
      if (locationId) {
        locationEntity =
          await this.#entityManager.getEntityInstance(locationId);
      }

      const actionCtx = {
        actingEntity: actor,
        currentLocation: locationEntity,
        entityManager: this.#entityManager,
        worldContext: turnContext?.game ?? {},
        logger,
      };

      const discoveredActions =
        await this.#actionDiscoveryService.getValidActions(actor, actionCtx);

      // Index the discovered actions to create the final, ordered list.
      const indexedActions = this.#actionIndexer.index(
        discoveredActions,
        actor.id
      );

      // When the indexing service caps the list, mirror its warning with richer context.
      const requestedCount = discoveredActions.length;
      const cappedCount = indexedActions.length;

      if (
        requestedCount > MAX_AVAILABLE_ACTIONS_PER_TURN &&
        cappedCount === MAX_AVAILABLE_ACTIONS_PER_TURN
      ) {
        logger.warn(
          `[Overflow] actor=${actor.id} requested=${requestedCount} capped=${cappedCount}`
        );
      }

      // Store the result in the cache before returning.
      this.#cachedActions.set(cacheKey, indexedActions);

      return indexedActions;
    } catch (err) {
      logger.error(
        `AvailableActionsProvider: Error discovering/indexing actions for ${actor.id}: ${err.message}`,
        err
      );
      // On error, return an empty list as a safeguard.
      return [];
    }
  }
}
