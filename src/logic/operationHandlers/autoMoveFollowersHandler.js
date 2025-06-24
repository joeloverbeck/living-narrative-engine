/**
 * @file Handler that automatically moves followers when their leader moves.
 * @see src/logic/operationHandlers/autoMoveFollowersHandler.js
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  LEADING_COMPONENT_ID,
} from '../../constants/componentIds.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import SystemMoveEntityHandler from './systemMoveEntityHandler.js';
import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';

class AutoMoveFollowersHandler extends BaseOperationHandler {
  /** @type {EntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;
  /** @type {SystemMoveEntityHandler} */ #moveHandler;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {EntityManager} deps.entityManager
   * @param {SystemMoveEntityHandler} deps.systemMoveEntityHandler
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   */
  constructor({
    logger,
    entityManager,
    systemMoveEntityHandler,
    safeEventDispatcher,
  }) {
    super('AutoMoveFollowersHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntitiesWithComponent', 'getComponentData'],
      },
      systemMoveEntityHandler: {
        value: systemMoveEntityHandler,
        requiredMethods: ['execute'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });

    this.#entityManager = entityManager;
    this.#moveHandler = systemMoveEntityHandler;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * @typedef {object} AutoMoveFollowersParams
   * @property {string} leader_id
   * @property {string} destination_id
   */

  /**
   * @description Validate parameters for {@link execute}.
   * @param {AutoMoveFollowersParams|null|undefined} params - Raw params object.
   * @param {ILogger} logger - Logger for diagnostics.
   * @returns {{leaderId:string,destinationId:string}|null} Normalized values or `null` when invalid.
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, logger, 'AUTO_MOVE_FOLLOWERS')) return null;

    const { leader_id, destination_id } = params;

    if (typeof leader_id !== 'string' || !leader_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'AUTO_MOVE_FOLLOWERS: Invalid "leader_id" parameter',
        { params },
        logger
      );
      return null;
    }

    if (typeof destination_id !== 'string' || !destination_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'AUTO_MOVE_FOLLOWERS: Invalid "destination_id" parameter',
        { params },
        logger
      );
      return null;
    }

    return { leaderId: leader_id.trim(), destinationId: destination_id.trim() };
  }

  /**
   * @description Move a single follower and emit relevant events.
   * @param {string} followerId - Follower to move.
   * @param {string} leaderId - Leader initiating the move.
   * @param {string} destinationId - Target location.
   * @param {string|null} previousLocationId - Only move if follower is currently in this location.
   * @param {ExecutionContext} executionContext - Current execution context.
   * @returns {void}
   * @private
   */
  #moveSingleFollower(
    followerId,
    leaderId,
    destinationId,
    previousLocationId,
    executionContext
  ) {
    const logger = this.getLogger(executionContext);

    try {
      const pos = this.#entityManager.getComponentData(
        followerId,
        POSITION_COMPONENT_ID
      );
      if (previousLocationId && pos?.locationId !== previousLocationId) return;

      const originLoc = pos?.locationId ?? null;

      this.#moveHandler.execute(
        {
          entity_ref: { entityId: followerId },
          target_location_id: destinationId,
        },
        executionContext
      );

      const followerName =
        this.#entityManager.getComponentData(followerId, NAME_COMPONENT_ID)
          ?.text || followerId;
      const leaderName =
        this.#entityManager.getComponentData(leaderId, NAME_COMPONENT_ID)
          ?.text || leaderId;
      const locationName =
        this.#entityManager.getComponentData(destinationId, NAME_COMPONENT_ID)
          ?.text || destinationId;
      const message = `${followerName} follows ${leaderName} to ${locationName}.`;

      this.#dispatcher.dispatch('core:perceptible_event', {
        eventName: 'core:perceptible_event',
        locationId: destinationId,
        descriptionText: message,
        timestamp: new Date().toISOString(),
        perceptionType: 'character_enter',
        actorId: followerId,
        targetId: leaderId,
        involvedEntities: [],
        contextualData: { leaderId, originLocationId: originLoc },
      });

      this.#dispatcher.dispatch('core:display_successful_action_result', {
        message,
      });
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        'AUTO_MOVE_FOLLOWERS: Error moving follower',
        { error: err.message, stack: err.stack, followerId },
        logger
      );
    }
  }

  /**
   * Move followers from the leader's previous location to the destination.
   *
   * @param {AutoMoveFollowersParams} params
   * @param {ExecutionContext} executionContext
   */
  execute(params, executionContext) {
    const logger = executionContext?.logger ?? this.logger;
    const validated = this.#validateParams(params, logger);
    if (!validated) return;

    const { leaderId, destinationId } = validated;
    const previousLocationId =
      executionContext?.event?.payload?.previousLocationId ?? null;

    const followersComponent = this.#entityManager.getComponentData(
      leaderId,
      LEADING_COMPONENT_ID
    );
    const followerIds = Array.isArray(followersComponent?.followers)
      ? followersComponent.followers
      : [];

    for (const followerId of followerIds) {
      this.#moveSingleFollower(
        followerId,
        leaderId,
        destinationId,
        previousLocationId,
        executionContext
      );
    }

    logger.debug(
      `[AutoMoveFollowersHandler] moved ${followerIds.length} follower(s).`
    );
  }
}

export default AutoMoveFollowersHandler;
