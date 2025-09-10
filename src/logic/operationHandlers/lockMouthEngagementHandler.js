/**
 * @file Handler that locks mouth engagement for entities with mouth restrictions.
 * @description Handles the LOCK_MOUTH_ENGAGEMENT operation for entities
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import BaseOperationHandler from './baseOperationHandler.js';
import { updateMouthEngagementLock } from '../../utils/mouthEngagementUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * @class LockMouthEngagementHandler
 * @augments BaseOperationHandler
 * @description Handles the LOCK_MOUTH_ENGAGEMENT operation for entities.
 * Follows the resource lock pattern to prevent conflicting mouth-based actions.
 */
class LockMouthEngagementHandler extends BaseOperationHandler {
  /** @type {EntityManager} */
  #entityManager;

  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logging service.
   * @param {EntityManager} deps.entityManager - Entity manager.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Error dispatcher.
   */
  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('LockMouthEngagementHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'addComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });

    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Validate parameters for execute.
   *
   * @param {object} params
   * @param {ExecutionContext} executionContext
   * @returns {{ actorId:string, logger:ILogger }|null}
   * @private
   */
  #validateParams(params, executionContext) {
    const { actor_id } = params || {};
    const log = this.getLogger(executionContext);

    if (typeof actor_id !== 'string' || !actor_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'LOCK_MOUTH_ENGAGEMENT: invalid "actor_id"',
        { params },
        log
      );
      return null;
    }

    return {
      actorId: actor_id.trim(),
      logger: log,
    };
  }

  /**
   * Lock mouth engagement for the specified entity.
   *
   * @param {{ actor_id:string }} params - Operation parameters.
   * @param {ExecutionContext} executionContext - Execution context.
   * @returns {Promise<void>}
   */
  async execute(params, executionContext) {
    const validated = this.#validateParams(params, executionContext);
    if (!validated) return;

    const { actorId, logger } = validated;

    try {
      // This utility handles both legacy and anatomy-based entities
      const result = await updateMouthEngagementLock(
        this.#entityManager,
        actorId,
        true // Lock the mouth
      );

      if (result) {
        logger.debug(
          `[LockMouthEngagementHandler] Successfully locked mouth engagement for entity: ${actorId}`,
          {
            actorId,
            result: result.updatedParts
              ? `Updated ${result.updatedParts.length} mouth parts`
              : 'Direct component updated',
          }
        );
      } else {
        logger.warn(
          `[LockMouthEngagementHandler] No mouth found to lock for entity: ${actorId}`
        );
      }
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        `LOCK_MOUTH_ENGAGEMENT: failed to lock mouth engagement for entity ${actorId}`,
        {
          actor_id: actorId,
          error: err.message,
          stack: err.stack,
        },
        logger
      );
    }
  }
}

export default LockMouthEngagementHandler;
