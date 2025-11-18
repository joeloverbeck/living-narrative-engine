/**
 * @file Handler for AUTO_MOVE_FOLLOWERS operation
 *
 * Automatically relocates followers when their leader moves to a new location, maintaining
 * the follow relationship and displaying appropriate perceptible events.
 *
 * Operation flow:
 * 1. Validate parameters (leader_id, destination_id)
 * 2. Retrieve followers list from leader's leading component
 * 3. For each follower, verify position matches previous location (if specified)
 * 4. Move follower using SYSTEM_MOVE_ENTITY handler
 * 5. Dispatch perceptible_event and display_successful_action_result for each follower
 *
 * Related files:
 * @see data/schemas/operations/autoMoveFollowers.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - AutoMoveFollowersHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
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
import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';
/** @typedef {import('../../interfaces/IMoveEntityHandler.js').IMoveEntityHandler} IMoveEntityHandler */

/**
 * @implements {OperationHandler}
 */
class AutoMoveFollowersHandler extends BaseOperationHandler {
  /** @type {EntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;
  /** @type {IMoveEntityHandler} */ #moveHandler;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {EntityManager} deps.entityManager
   * @param {IMoveEntityHandler} deps.moveEntityHandler
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   */
  constructor({
    logger,
    entityManager,
    moveEntityHandler,
    safeEventDispatcher,
  }) {
    super('AutoMoveFollowersHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntitiesWithComponent', 'getComponentData'],
      },
      moveEntityHandler: {
        value: moveEntityHandler,
        requiredMethods: ['execute'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });

    this.#entityManager = entityManager;
    this.#moveHandler = moveEntityHandler;
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
   * @returns {Promise<void>} Resolves when dispatch completes.
   * @private
   */
  async #moveSingleFollower(
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

      await this.#moveHandler.execute(
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

      const perceptibleResult = this.#dispatcher.dispatch(
        'core:perceptible_event',
        {
          eventName: 'core:perceptible_event',
          locationId: destinationId,
          descriptionText: message,
          timestamp: new Date().toISOString(),
          perceptionType: 'character_enter',
          actorId: followerId,
          targetId: leaderId,
          involvedEntities: [],
          contextualData: { leaderId, originLocationId: originLoc },
        }
      );

      if (perceptibleResult && typeof perceptibleResult.then === 'function') {
        try {
          await perceptibleResult;
        } catch (dispatchErr) {
          safeDispatchError(
            this.#dispatcher,
            'AUTO_MOVE_FOLLOWERS: Error moving follower',
            {
              error: dispatchErr.message,
              stack: dispatchErr.stack,
              followerId,
            },
            logger
          );
        }
      }

      const uiResult = this.#dispatcher.dispatch(
        'core:display_successful_action_result',
        {
          message,
        }
      );

      if (uiResult && typeof uiResult.then === 'function') {
        try {
          await uiResult;
        } catch (dispatchErr) {
          safeDispatchError(
            this.#dispatcher,
            'AUTO_MOVE_FOLLOWERS: Error moving follower',
            {
              error: dispatchErr.message,
              stack: dispatchErr.stack,
              followerId,
            },
            logger
          );
        }
      }
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
  async execute(params, executionContext) {
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
      await this.#moveSingleFollower(
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
