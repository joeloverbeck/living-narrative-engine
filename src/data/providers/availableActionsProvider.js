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
/** @typedef {import('../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */

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
  #jsonLogicEvalService;
  #logger;

  // --- Turn-scoped Cache ---
  #lastTurnContext = null;
  #cachedActions = new Map();

  /**
   * @param {object} dependencies
   * @param {IActionDiscoveryService} dependencies.actionDiscoveryService
   * @param {IActionIndexer} dependencies.actionIndexingService
   * @param {IEntityManager} dependencies.entityManager
   * @param {JsonLogicEvaluationService} dependencies.jsonLogicEvaluationService
   * @param {ILogger} dependencies.logger
   */
  constructor({
                actionDiscoveryService,
                actionIndexingService: actionIndexer,
                entityManager,
                jsonLogicEvaluationService,
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
      jsonLogicEvaluationService: {
        value: jsonLogicEvaluationService,
        requiredMethods: ['evaluate'],
      },
    });

    this.#actionDiscoveryService = actionDiscoveryService;
    this.#actionIndexer = actionIndexer;
    this.#entityManager = entityManager;
    this.#jsonLogicEvalService = jsonLogicEvaluationService;

    this.#logger.debug(
      'AvailableActionsProvider initialized and dependencies validated.'
    );
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
        jsonLogicEval: this.#jsonLogicEvalService,
        logger,
      };

      const { actions: discoveredActions, errors, trace } =
        await this.#actionDiscoveryService.getValidActions(actor, actionCtx, { trace: true });

      if (trace && logger.table && logger.groupCollapsed && logger.groupEnd) {
        logger.debug(`[Action Discovery Trace for actor ${actor.id}]`);
        logger.groupCollapsed(`Action Discovery Trace for ${actor.id}`);
        logger.table(trace.logs);
        logger.groupEnd();
      }

      // --- Log any formatting errors that occurred ---
      if (errors && errors.length > 0) {
        logger.warn(`Encountered ${errors.length} formatting error(s) during action discovery for actor ${actor.id}. These actions will not be available.`);
        errors.forEach(err => {
          logger.warn(`  - Action '${err.actionId}' (Target: ${err.targetId || 'N/A'}): ${err.error}`);
        });
      }

      // Index the discovered actions to create the final, ordered list.
      const indexedActions = this.#actionIndexer.index(
        discoveredActions,
        actor.id
      );

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