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

import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { FOLLOWING_COMPONENT_ID } from '../../constants/componentIds.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

class BreakFollowRelationHandler extends BaseOperationHandler {
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
    super('BreakFollowRelationHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['removeComponent', 'getComponentData'],
      },
      rebuildLeaderListCacheHandler: {
        value: rebuildLeaderListCacheHandler,
        requiredMethods: ['execute'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#entityManager = entityManager;
    this.#rebuildHandler = rebuildLeaderListCacheHandler;
    this.#dispatcher = safeEventDispatcher;
    this.logger.debug('[BreakFollowRelationHandler] Initialized');
  }

  /**
   * @param {{ follower_id: string }} params
   * @param {ExecutionContext} execCtx
   */
  execute(params, execCtx) {
    const logger = this.getLogger(execCtx);
    if (!assertParamsObject(params, logger, 'BREAK_FOLLOW_RELATION')) return;

    const { follower_id } = params;
    if (typeof follower_id !== 'string' || !follower_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'BREAK_FOLLOW_RELATION: Invalid "follower_id" parameter',
        { params }
      );
      return;
    }
    const fid = follower_id.trim();
    const currentData = this.#entityManager.getComponentData(
      fid,
      FOLLOWING_COMPONENT_ID
    );
    if (!currentData) {
      this.logger.debug(
        `[BreakFollowRelationHandler] ${fid} is not following anyone.`
      );
      return;
    }
    try {
      this.#entityManager.removeComponent(fid, FOLLOWING_COMPONENT_ID);
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        'BREAK_FOLLOW_RELATION: Failed removing following component',
        { error: err.message, stack: err.stack, follower_id: fid }
      );
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
