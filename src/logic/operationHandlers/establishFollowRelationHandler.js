/**
 * @file Handler for ESTABLISH_FOLLOW_RELATION.
 * Validates against follow cycles, updates the follower's `core:following`
 * component, and rebuilds the affected leaders' `core:leading` caches.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('./rebuildLeaderListCacheHandler.js').default} RebuildLeaderListCacheHandler */

import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { FOLLOWING_COMPONENT_ID } from '../../constants/componentIds.js';
import { wouldCreateCycle } from '../../utils/followUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';

class EstablishFollowRelationHandler {
  /** @type {ILogger} */
  #logger;
  /** @type {EntityManager} */
  #entityManager;
  /** @type {RebuildLeaderListCacheHandler} */
  #rebuildHandler;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {EntityManager} deps.entityManager
   * @param {RebuildLeaderListCacheHandler} deps.rebuildLeaderListCacheHandler
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   */
  constructor({
    logger,
    entityManager,
    rebuildLeaderListCacheHandler,
    safeEventDispatcher,
  }) {
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error(
        'EstablishFollowRelationHandler requires a valid ILogger'
      );
    }
    if (!entityManager || typeof entityManager.addComponent !== 'function') {
      throw new Error(
        'EstablishFollowRelationHandler requires a valid EntityManager'
      );
    }
    if (
      !rebuildLeaderListCacheHandler ||
      typeof rebuildLeaderListCacheHandler.execute !== 'function'
    ) {
      throw new Error(
        'EstablishFollowRelationHandler requires a valid RebuildLeaderListCacheHandler'
      );
    }
    if (
      !safeEventDispatcher ||
      typeof safeEventDispatcher.dispatch !== 'function'
    ) {
      throw new Error(
        'EstablishFollowRelationHandler requires a valid ISafeEventDispatcher'
      );
    }
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#rebuildHandler = rebuildLeaderListCacheHandler;
    this.#dispatcher = safeEventDispatcher;
    this.#logger.debug('[EstablishFollowRelationHandler] Initialized');
  }

  /**
   * @param {{ follower_id: string, leader_id: string }} params
   * @param {ExecutionContext} executionContext
   */
  execute(params, executionContext) {
    const logger = executionContext?.logger ?? this.#logger;
    if (!assertParamsObject(params, logger, 'ESTABLISH_FOLLOW_RELATION'))
      return;

    const { follower_id, leader_id } = params;
    if (typeof follower_id !== 'string' || !follower_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'ESTABLISH_FOLLOW_RELATION: Invalid "follower_id" parameter',
        { params },
        logger
      );
      return;
    }
    if (typeof leader_id !== 'string' || !leader_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'ESTABLISH_FOLLOW_RELATION: Invalid "leader_id" parameter',
        { params },
        logger
      );
      return;
    }

    const fid = follower_id.trim();
    const lid = leader_id.trim();
    this.#logger.debug(
      `[EstablishFollowRelationHandler] establishing follow: follower=${fid}, leader=${lid}`
    );

    if (wouldCreateCycle(fid, lid, this.#entityManager)) {
      safeDispatchError(
        this.#dispatcher,
        'ESTABLISH_FOLLOW_RELATION: Following would create a cycle',
        { follower_id: fid, leader_id: lid },
        logger
      );
      return;
    }

    const oldData = this.#entityManager.getComponentData(
      fid,
      FOLLOWING_COMPONENT_ID
    );
    try {
      this.#entityManager.addComponent(fid, FOLLOWING_COMPONENT_ID, {
        leaderId: lid,
      });
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        'ESTABLISH_FOLLOW_RELATION: Failed updating follower component',
        {
          error: err.message,
          stack: err.stack,
          follower_id: fid,
          leader_id: lid,
        },
        logger
      );
      return;
    }

    const leaderIds = [lid];
    if (oldData?.leaderId && oldData.leaderId !== lid)
      leaderIds.push(oldData.leaderId);
    this.#rebuildHandler.execute({ leaderIds }, executionContext);
  }
}

export default EstablishFollowRelationHandler;
