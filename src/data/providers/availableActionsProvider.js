/**
 * @file Provides available actions data for an actor by delegating to discovery and indexing services.
 * @see src/data/providers/availableActionsProvider.js
 */

import { IAvailableActionsProvider } from '../../interfaces/IAvailableActionsProvider.js';
import { POSITION_COMPONENT_ID } from '../../constants/componentIds.js';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../constants/core.js';
import { setupService } from '../../utils/serviceInitializerUtils.js';

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
  #logger;

  // --- Turn-scoped Cache ---
  #lastTurnContext = null;
  #cachedActions = new Map();

  /**
   * @param {object} dependencies
   * @param {IActionDiscoveryService} dependencies.actionDiscoveryService
   * @param {IActionIndexer} dependencies.actionIndexingService
   * @param {IEntityManager} dependencies.entityManager
   * @param {ILogger} dependencies.logger
   */
  constructor({
    actionDiscoveryService,
    actionIndexingService: actionIndexer,
    entityManager,
    logger,
  }) {
    super();

    this.#logger = setupService('AvailableActionsProvider', logger, {
      actionDiscoveryService: {
        value: actionDiscoveryService,
        requiredMethods: ['getValidActions'],
      },
      actionIndexer: { value: actionIndexer, requiredMethods: ['index'] },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntityInstance'],
      },
    });

    this.#actionDiscoveryService = actionDiscoveryService;
    this.#actionIndexer = actionIndexer;
    this.#entityManager = entityManager;

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
        discoveredActions,
        actor.id
      );

      const requestedCount = discoveredActions.length;
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
}
