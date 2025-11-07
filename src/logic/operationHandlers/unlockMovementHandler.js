/**
 * @file Handler for UNLOCK_MOVEMENT operation
 *
 * Restores entity movement by clearing the movement lock flag, supporting both legacy
 * movement_lock component and anatomy-based mouth engagement systems.
 *
 * Operation flow:
 * 1. Validate parameters (actor_id)
 * 2. Call updateMovementLock utility with lock=false
 * 3. Update appropriate component based on entity type (legacy or anatomy-based)
 * 4. Log successful unlock operation
 * 5. Handle errors with safe error dispatcher
 *
 * Related files:
 * @see data/schemas/operations/unlockMovement.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - UnlockMovementHandler token
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
import { updateMovementLock } from '../../utils/movementUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * @class UnlockMovementHandler
 * @description Handles the UNLOCK_MOVEMENT operation for entities.
 */
class UnlockMovementHandler extends BaseOperationHandler {
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
    super('UnlockMovementHandler', {
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
        'UNLOCK_MOVEMENT: invalid "actor_id"',
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
   * Unlock movement for the specified entity.
   *
   * @param {{ actor_id:string }} params - Operation parameters.
   * @param {ExecutionContext} executionContext - Execution context.
   */
  async execute(params, executionContext) {
    const validated = this.#validateParams(params, executionContext);
    if (!validated) return;

    const { actorId, logger } = validated;

    try {
      // This utility handles both legacy and anatomy-based entities
      await updateMovementLock(this.#entityManager, actorId, false);
      logger.debug(
        `[UnlockMovementHandler] Successfully unlocked movement for entity: ${actorId}`
      );
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        `UNLOCK_MOVEMENT: failed to unlock movement for entity ${actorId}`,
        { actor_id: actorId, error: err.message, stack: err.stack },
        logger
      );
    }
  }
}

export default UnlockMovementHandler;
