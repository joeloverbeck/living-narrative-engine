/**
 * @file Handler for BREAK_FOLLOW_RELATION.
 * Removes a follower's `core:following` component and rebuilds the former
 * leader's follower cache.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('./rebuildLeaderListCacheHandler.js').default} RebuildLeaderListCacheHandler */

import { DISPLAY_ERROR_ID } from '../../constants/eventIds.js';
import { FOLLOWING_COMPONENT_ID } from '../../constants/componentIds.js';

class BreakFollowRelationHandler {
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
      throw new Error('BreakFollowRelationHandler requires a valid ILogger');
    }
    if (!entityManager || typeof entityManager.removeComponent !== 'function') {
      throw new Error(
        'BreakFollowRelationHandler requires a valid EntityManager'
      );
    }
    if (
      !rebuildLeaderListCacheHandler ||
      typeof rebuildLeaderListCacheHandler.execute !== 'function'
    ) {
      throw new Error(
        'BreakFollowRelationHandler requires a valid RebuildLeaderListCacheHandler'
      );
    }
    if (
      !safeEventDispatcher ||
      typeof safeEventDispatcher.dispatch !== 'function'
    ) {
      throw new Error(
        'BreakFollowRelationHandler requires a valid ISafeEventDispatcher'
      );
    }
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#rebuildHandler = rebuildLeaderListCacheHandler;
    this.#dispatcher = safeEventDispatcher;
    this.#logger.debug('[BreakFollowRelationHandler] Initialized');
  }

  /**
   * @param {{ follower_id: string }} params
   * @param {ExecutionContext} execCtx
   */
  execute(params, execCtx) {
    const { follower_id } = params || {};
    if (typeof follower_id !== 'string' || !follower_id.trim()) {
      this.#dispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: 'BREAK_FOLLOW_RELATION: Invalid "follower_id" parameter',
        details: { params },
      });
      return;
    }
    const fid = follower_id.trim();
    const currentData = this.#entityManager.getComponentData(
      fid,
      FOLLOWING_COMPONENT_ID
    );
    if (!currentData) {
      this.#logger.debug(
        `[BreakFollowRelationHandler] ${fid} is not following anyone.`
      );
      return;
    }
    try {
      this.#entityManager.removeComponent(fid, FOLLOWING_COMPONENT_ID);
    } catch (err) {
      this.#dispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: 'BREAK_FOLLOW_RELATION: Failed removing following component',
        details: { error: err.message, stack: err.stack, follower_id: fid },
      });
      return;
    }
    if (currentData.leaderId) {
      this.#rebuildHandler.execute(
        { leaderIds: [currentData.leaderId] },
        execCtx
      );
    }
  }
}

export default BreakFollowRelationHandler;
