/**
 * @file Handler for REBUILD_LEADER_LIST_CACHE.
 * Rebuilds the 'core:leading' component for one or more leaders.
 * @see src/logic/operationHandlers/rebuildLeaderListCacheHandler.js
 */
import { isNonBlankString } from '../../utils/textUtils.js';
class RebuildLeaderListCacheHandler {
  #logger;
  #entityManager;

  constructor({ logger, entityManager }) {
    if (
      !logger ||
      typeof logger.debug !== 'function' ||
      typeof logger.error !== 'function' ||
      typeof logger.warn !== 'function'
    ) {
      throw new TypeError(
        'RebuildLeaderListCacheHandler requires a valid ILogger.'
      );
    }
    if (
      !entityManager ||
      typeof entityManager.getEntitiesWithComponent !== 'function' ||
      typeof entityManager.getEntityInstance !== 'function' ||
      typeof entityManager.addComponent !== 'function'
    ) {
      throw new TypeError(
        'RebuildLeaderListCacheHandler requires a valid IEntityManager.'
      );
    }
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#logger.debug('[RebuildLeaderListCacheHandler] Initialized.');
  }

  /**
   * @param {{ leaderIds: string[] }} params
   * @param {import('../defs.js').ExecutionContext} nestedExecutionContext
   */
  execute(params, nestedExecutionContext) {
    const { leaderIds } = params || {};
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
      const lid = data?.leaderId;
      if (typeof lid === 'string' && lid.trim()) {
        if (!followerMap.has(lid)) followerMap.set(lid, []);
        followerMap.get(lid).push(ent.id);
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
        this.#logger.error(
          `[RebuildLeaderListCacheHandler] Failed updating 'core:leading' for '${leaderId}': ${err.message || err}`,
          { stack: err.stack }
        );
      }
    }

    this.#logger.debug(
      `[RebuildLeaderListCacheHandler] Rebuilt cache for ${updated}/${ids.length} leader(s).`
    );
  }
}

export default RebuildLeaderListCacheHandler;
