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
import BaseOperationHandler from './baseOperationHandler.js';

class EstablishFollowRelationHandler extends BaseOperationHandler {
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
    super('EstablishFollowRelationHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['addComponent', 'getComponentData'],
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
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#rebuildHandler = rebuildLeaderListCacheHandler;
    this.#dispatcher = safeEventDispatcher;
    this.logger.debug('[EstablishFollowRelationHandler] Initialized');
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

    const followerId = follower_id.trim();
    const leaderId = leader_id.trim();
    this.#logger.debug(
      `[EstablishFollowRelationHandler] establishing follow: follower=${followerId}, leader=${leaderId}`
    );

    if (wouldCreateCycle(followerId, leaderId, this.#entityManager)) {
      safeDispatchError(
        this.#dispatcher,
        'ESTABLISH_FOLLOW_RELATION: Following would create a cycle',
        { follower_id: followerId, leader_id: leaderId },
        logger
      );
      return;
    }

    const oldData = this.#entityManager.getComponentData(
      followerId,
      FOLLOWING_COMPONENT_ID
    );
    try {
      this.#entityManager.addComponent(followerId, FOLLOWING_COMPONENT_ID, {
        leaderId: leaderId,
      });
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        'ESTABLISH_FOLLOW_RELATION: Failed updating follower component',
        {
          error: err.message,
          stack: err.stack,
          follower_id: followerId,
          leader_id: leaderId,
        },
        logger
      );
      return;
    }

    const leaderIds = [leaderId];
    if (oldData?.leaderId && oldData.leaderId !== leaderId)
      leaderIds.push(oldData.leaderId);
    this.#rebuildHandler.execute({ leaderIds }, executionContext);
  }
}

export default EstablishFollowRelationHandler;
