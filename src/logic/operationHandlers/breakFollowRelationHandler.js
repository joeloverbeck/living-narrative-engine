/**
 * @file Handler for BREAK_FOLLOW_RELATION operation
 *
 * Removes a follower's companionship:following component and rebuilds the former leader's
 * follower cache to maintain consistency.
 *
 * Operation flow:
 * 1. Validate parameters (follower_id)
 * 2. Retrieve current following component to get leader_id
 * 3. Remove companionship:following component from follower
 * 4. Rebuild former leader's companionship:leading cache if applicable
 * 5. Handle errors with safe error dispatcher
 *
 * Related files:
 * @see data/schemas/operations/breakFollowRelation.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - BreakFollowRelationHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
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
   * @param {ExecutionContext} executionContext
   */
  async execute(params, executionContext) {
    const logger = this.getLogger(executionContext);
    if (!assertParamsObject(params, logger, 'BREAK_FOLLOW_RELATION')) return;

    const { follower_id } = params;
    if (typeof follower_id !== 'string' || !follower_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'BREAK_FOLLOW_RELATION: Invalid "follower_id" parameter',
        { params },
        logger
      );
      return;
    }
    const followerId = follower_id.trim();
    const currentData = this.#entityManager.getComponentData(
      followerId,
      FOLLOWING_COMPONENT_ID
    );
    if (!currentData) {
      this.logger.debug(
        `[BreakFollowRelationHandler] ${followerId} is not following anyone.`
      );
      return;
    }
    try {
      await this.#entityManager.removeComponent(
        followerId,
        FOLLOWING_COMPONENT_ID
      );
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        'BREAK_FOLLOW_RELATION: Failed removing following component',
        { error: err.message, stack: err.stack, follower_id: followerId },
        logger
      );
      return;
    }
    if (currentData.leaderId) {
      await this.#rebuildHandler.execute(
        { leaderIds: [currentData.leaderId] },
        executionContext
      );
    }
  }
}

export default BreakFollowRelationHandler;
