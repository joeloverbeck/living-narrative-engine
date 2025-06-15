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
import { DISPLAY_ERROR_ID } from '../../constants/eventIds.js';
import { safeDispatchError } from '../../utils/safeDispatchError.js';
import SystemMoveEntityHandler from './systemMoveEntityHandler.js';
import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils';

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
   * Move followers from the leader's previous location to the destination.
   *
   * @param {AutoMoveFollowersParams} params
   * @param {ExecutionContext} execCtx
   */
  execute(params, execCtx) {
    const logger = execCtx?.logger ?? this.logger;
    if (!assertParamsObject(params, logger, 'AUTO_MOVE_FOLLOWERS')) return;

    const { leader_id, destination_id } = params;
    if (typeof leader_id !== 'string' || !leader_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'AUTO_MOVE_FOLLOWERS: Invalid "leader_id" parameter',
        { params }
      );
      return;
    }
    if (typeof destination_id !== 'string' || !destination_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'AUTO_MOVE_FOLLOWERS: Invalid "destination_id" parameter',
        { params }
      );
      return;
    }

    const lid = leader_id.trim();
    const dest = destination_id.trim();

    const prevLoc = execCtx?.event?.payload?.previousLocationId ?? null;

    const followersComponent = this.#entityManager.getComponentData(
      lid,
      LEADING_COMPONENT_ID
    );
    const followerIds = Array.isArray(followersComponent?.followers)
      ? followersComponent.followers
      : [];

    for (const fid of followerIds) {
      try {
        const pos = this.#entityManager.getComponentData(
          fid,
          POSITION_COMPONENT_ID
        );
        if (prevLoc && pos?.locationId !== prevLoc) continue;

        const originLoc = pos?.locationId ?? null;

        this.#moveHandler.execute(
          { entity_ref: { entityId: fid }, target_location_id: dest },
          execCtx
        );

        const followerName =
          this.#entityManager.getComponentData(fid, NAME_COMPONENT_ID)?.text ||
          fid;
        const leaderName =
          this.#entityManager.getComponentData(lid, NAME_COMPONENT_ID)?.text ||
          lid;
        const locationName =
          this.#entityManager.getComponentData(dest, NAME_COMPONENT_ID)?.text ||
          dest;
        const message = `${followerName} follows ${leaderName} to ${locationName}.`;

        this.#dispatcher.dispatch('core:perceptible_event', {
          eventName: 'core:perceptible_event',
          locationId: dest,
          descriptionText: message,
          timestamp: new Date().toISOString(),
          perceptionType: 'character_enter',
          actorId: fid,
          targetId: lid,
          involvedEntities: [],
          contextualData: { leaderId: lid, originLocationId: originLoc },
        });

        this.#dispatcher.dispatch('core:display_successful_action_result', {
          message,
        });
      } catch (err) {
        safeDispatchError(
          this.#dispatcher,
          'AUTO_MOVE_FOLLOWERS: Error moving follower',
          { error: err.message, stack: err.stack, followerId: fid }
        );
      }
    }
    this.logger.debug(
      `[AutoMoveFollowersHandler] moved ${followerIds.length} follower(s).`
    );
  }
}

export default AutoMoveFollowersHandler;
