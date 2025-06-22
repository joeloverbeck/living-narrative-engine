/**
 * @file Handler for REBUILD_LEADER_LIST_CACHE.
 * Rebuilds the 'core:leading' component for one or more leaders.
 * @see src/logic/operationHandlers/rebuildLeaderListCacheHandler.js
 */
import { isNonBlankString } from '../../utils/textUtils.js';

import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

/**
 * @class RebuildLeaderListCacheHandler
 * @description Handles the REBUILD_LEADER_LIST_CACHE operation by updating the
 *  'core:leading' component for a list of leader entities.
 */
class RebuildLeaderListCacheHandler extends BaseOperationHandler {
  #logger;
  #entityManager;
  #dispatcher;

  /**
   * @param {object} deps - Handler dependencies.
   * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger - Logger instance.
   * @param {import('../../entities/entityManager.js').default} deps.entityManager - Entity manager used for queries.
   * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} deps.safeEventDispatcher - Dispatcher for error events.
   */
  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('RebuildLeaderListCacheHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'getEntitiesWithComponent',
          'getEntityInstance',
          'addComponent',
          'removeComponent',
        ],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.logger.debug('[RebuildLeaderListCacheHandler] Initialized.');
  }

  /**
   * @param {{ leaderIds: string[] }} params
   * @param {import('../defs.js').ExecutionContext} nestedExecutionContext
   */
  execute(params, nestedExecutionContext) {
    const logger = nestedExecutionContext?.logger ?? this.#logger;
    if (!assertParamsObject(params, logger, 'REBUILD_LEADER_LIST_CACHE'))
      return;

    const { leaderIds } = params;
    if (!Array.isArray(leaderIds) || leaderIds.length === 0) {
      this.#logger.debug(
        '[RebuildLeaderListCacheHandler] No leaderIds provided; skipping.'
      );
      return;
    }
    const ids = [...new Set(leaderIds.filter((id) => isNonBlankString(id)))];
    if (ids.length === 0) {
      this.#logger.debug(
        '[RebuildLeaderListCacheHandler] leaderIds empty after filtering; skipping.'
      );
      return;
    }

    const FOLLOWING = 'core:following';
    const LEADING = 'core:leading';

    // Build map: leaderId → [ followerIds ]
    const followerMap = new Map();
    const followers = this.#entityManager.getEntitiesWithComponent(FOLLOWING);
    for (const ent of followers) {
      const data = ent.getComponentData(FOLLOWING);
      const leaderId = data?.leaderId;
      if (isNonBlankString(leaderId)) {
        if (!followerMap.has(leaderId)) followerMap.set(leaderId, []);
        followerMap.get(leaderId).push(ent.id);
      }
    }

    let updated = 0;
    for (const leaderId of ids) {
      const list = followerMap.get(leaderId) || [];
      const leaderEnt = this.#entityManager.getEntityInstance(leaderId);
      if (!leaderEnt) {
        this.#logger.warn(
          `[RebuildLeaderListCacheHandler] Leader '${leaderId}' not found; skipping.`
        );
        continue;
      }
      try {
        if (list.length > 0) {
          // has followers → add/update the component
          this.#entityManager.addComponent(leaderId, LEADING, {
            followers: list,
          });
        } else {
          // no followers → remove the component entirely
          this.#entityManager.removeComponent(leaderId, LEADING);
        }
        updated++;
      } catch (err) {
        safeDispatchError(
          this.#dispatcher,
          `[RebuildLeaderListCacheHandler] Failed updating 'core:leading' for '${leaderId}': ${err.message || err}`,
          { stack: err.stack, leaderId }
        );
      }
    }

    this.#logger.debug(
      `[RebuildLeaderListCacheHandler] Rebuilt cache for ${updated}/${ids.length} leader(s).`
    );
  }
}

export default RebuildLeaderListCacheHandler;
