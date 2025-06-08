// -----------------------------------------------------------------------------
//  Living Narrative Engine – LeaderListSyncService
// -----------------------------------------------------------------------------
//  @description
//  Keeps the derived **core:leading** cache in sync with the *authoritative*
//  **core:following** components.  Designed to be called from rules via the
//  standard QUERY_SYSTEM_DATA op:
//
//      {
//        "type": "QUERY_SYSTEM_DATA",
//        "parameters": {
//          "source_id": "LeaderListSyncService",
//          "query_details": {
//            "action":   "rebuildFor",
//            "leaderIds": ["{leaderId1}", "{leaderId2}", ...]
//          },
//          "result_variable": "leaderSyncResult"
//        }
//      }
//
//  The service is deliberately synchronous (tiny data set, no I/O) and returns
//  a plain object summarising the work done.
// -----------------------------------------------------------------------------
//  @module LeaderListSyncService
//  @since  0.5.0
// -----------------------------------------------------------------------------

/** @typedef {import('../../interfaces/coreServices.js').ILogger}         ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

const FOLLOWING_COMPONENT_ID = 'core:following';
const LEADING_COMPONENT_ID = 'core:leading';

class LeaderListSyncService {
  /** @type {ILogger}         @private */ #logger;
  /** @type {IEntityManager}  @private */ #entityManager;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {IEntityManager} deps.entityManager
   */
  constructor({ logger, entityManager }) {
    if (
      !logger ||
      typeof logger.info !== 'function' ||
      typeof logger.debug !== 'function' ||
      typeof logger.warn !== 'function' ||
      typeof logger.error !== 'function'
    ) {
      throw new Error('LeaderListSyncService needs a valid ILogger.');
    }
    if (
      !entityManager ||
      typeof entityManager.getEntitiesWithComponent !== 'function' ||
      typeof entityManager.getEntityInstance !== 'function' ||
      typeof entityManager.addComponent !== 'function'
    ) {
      logger.error(
        'LeaderListSyncService initialisation failed – bad IEntityManager.'
      );
      throw new Error('LeaderListSyncService needs a valid IEntityManager.');
    }

    this.#logger = logger;
    this.#entityManager = entityManager;

    logger.debug('[LeaderListSyncService] Created.');
  }

  /**
   * Public entry-point required by SystemDataRegistry.
   * @param {object} queryDetails
   * @returns {object} summary
   */
  handleQuery(queryDetails) {
    if (!queryDetails || typeof queryDetails !== 'object') {
      this.#logger.error(
        '[LeaderListSyncService] handleQuery called with invalid details:',
        { queryDetails }
      );
      return { success: false, error: 'Invalid queryDetails supplied.' };
    }

    const { action } = queryDetails;

    switch (action) {
      case 'rebuildFor':
        return this.#rebuildFor(queryDetails.leaderIds);
      default:
        this.#logger.warn(
          `[LeaderListSyncService] Unknown action '${action}'.`
        );
        return { success: false, error: `Unknown action '${action}'.` };
    }
  }

  /**
   * Rebuild **core:leading** for the supplied leaderIds.
   * @param {unknown} leaderIdsInput
   * @returns {{success: boolean, leadersUpdated: number, warnings: string[]}}
   * @private
   */
  #rebuildFor(leaderIdsInput) {
    /** @type {string[]} */
    const leaderIds = Array.isArray(leaderIdsInput)
      ? [
          ...new Set(
            leaderIdsInput.filter((id) => typeof id === 'string' && id.trim())
          ),
        ]
      : [];

    if (leaderIds.length === 0) {
      this.#logger.debug(
        '[LeaderListSyncService] rebuildFor called with empty leaderIds.'
      );
      return { success: true, leadersUpdated: 0, warnings: [] };
    }

    // Build a map leaderId -> [ followerIds ]
    /** @type {Map<string,string[]>} */
    const followerMap = new Map();
    const followerEntities = this.#entityManager.getEntitiesWithComponent(
      FOLLOWING_COMPONENT_ID
    );
    for (const ent of followerEntities) {
      const followData = ent.getComponentData(FOLLOWING_COMPONENT_ID);
      const lId = followData?.leaderId;
      if (typeof lId === 'string' && lId.trim()) {
        if (!followerMap.has(lId)) followerMap.set(lId, []);
        followerMap.get(lId).push(ent.id);
      }
    }

    const warnings = [];
    let updated = 0;

    for (const leaderId of leaderIds) {
      const followers = followerMap.get(leaderId) ?? [];

      const leaderEnt = this.#entityManager.getEntityInstance(leaderId);
      if (!leaderEnt) {
        warnings.push(`Leader entity '${leaderId}' not found – cache skipped.`);
        continue;
      }

      try {
        this.#entityManager.addComponent(leaderId, LEADING_COMPONENT_ID, {
          followers,
        });
        updated++;
      } catch (err) {
        const msg = `Failed to update core:leading for '${leaderId}': ${err?.message || err}`;
        warnings.push(msg);
        this.#logger.error(`[LeaderListSyncService] ${msg}`, {
          stack: err?.stack,
        });
      }
    }

    if (updated > 0) {
      this.#logger.debug(
        `[LeaderListSyncService] Rebuilt caches for ${updated} leader(s).`
      );
    }

    return { success: true, leadersUpdated: updated, warnings };
  }
}

export default LeaderListSyncService;
