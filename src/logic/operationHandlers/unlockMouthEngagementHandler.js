/**
 * @file Handler for UNLOCK_MOUTH_ENGAGEMENT operation
 *
 * Unlocks mouth engagement for entities to restore mouth-based action capabilities,
 * supporting both legacy mouth_lock component and anatomy-based mouth parts.
 *
 * Operation flow:
 * 1. Validate parameters (actor_id)
 * 2. Call updateMouthEngagementLock utility with lock=false
 * 3. Update appropriate components based on entity type (legacy or anatomy)
 * 4. Dispatch core:mouth_engagement_unlocked event
 * 5. Log successful unlock operation with affected parts count
 *
 * Related files:
 * @see data/schemas/operations/unlockMouthEngagement.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - UnlockMouthEngagementHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 *
 * @extends BaseOperationHandler
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import BaseOperationHandler from './baseOperationHandler.js';
import { updateMouthEngagementLock } from '../../utils/mouthEngagementUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * @class UnlockMouthEngagementHandler
 * @augments BaseOperationHandler
 * @description Handles the UNLOCK_MOUTH_ENGAGEMENT operation for entities.
 * Releases mouth locks to allow mouth-based actions to resume.
 */
class UnlockMouthEngagementHandler extends BaseOperationHandler {
  /** @type {EntityManager} */
  #entityManager;

  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * Creates a new UnlockMouthEngagementHandler instance.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logging service.
   * @param {EntityManager} deps.entityManager - Entity manager.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Error dispatcher.
   */
  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('UnlockMouthEngagementHandler', {
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
   * @param {object} params - Operation parameters to validate.
   * @param {ExecutionContext} executionContext - Current execution context.
   * @returns {{ actorId:string, logger:ILogger }|null} Validated parameters or null if invalid.
   * @private
   */
  #validateParams(params, executionContext) {
    const { actor_id } = params || {};
    const log = this.getLogger(executionContext);

    if (typeof actor_id !== 'string' || !actor_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'UNLOCK_MOUTH_ENGAGEMENT: invalid "actor_id"',
        { params },
        log
      );
      return null;
    }

    const actorId = actor_id.trim();

    // Note: Entity existence checking handled by updateMouthEngagementLock utility

    return {
      actorId,
      logger: log,
    };
  }

  /**
   * Unlock mouth engagement for the specified entity.
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
        false // Unlock the mouth
      );

      if (result) {
        logger.debug(
          `[UnlockMouthEngagementHandler] Successfully unlocked mouth engagement for entity: ${actorId}`,
          {
            actorId,
            result: result.updatedParts
              ? `Updated ${result.updatedParts.length} mouth parts`
              : 'Direct component updated',
          }
        );

        // Dispatch success event for other systems to react
        this.#dispatcher.dispatch('core:mouth_engagement_unlocked', {
          actorId,
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.warn(
          `[UnlockMouthEngagementHandler] No mouth found to unlock for entity: ${actorId}`
        );
      }
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        `UNLOCK_MOUTH_ENGAGEMENT: failed to unlock mouth engagement for entity ${actorId}`,
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

export default UnlockMouthEngagementHandler;
