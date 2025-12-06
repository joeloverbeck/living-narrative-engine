/**
 * @file Handler for UNLOCK_GRABBING operation
 *
 * Unlocks a specified number of grabbing appendages on an actor, optionally
 * filtering by the held item.
 *
 * Operation flow:
 * 1. Validate parameters (actor_id, count)
 * 2. Call unlockGrabbingAppendages utility
 * 3. Log result (utility gracefully handles insufficient locked appendages)
 *
 * Related files:
 * @see data/schemas/operations/unlockGrabbing.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - UnlockGrabbingHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @see src/utils/grabbingUtils.js - unlockGrabbingAppendages utility
 * @augments BaseOperationHandler
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import BaseOperationHandler from './baseOperationHandler.js';
import { unlockGrabbingAppendages } from '../../utils/grabbingUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * @class UnlockGrabbingHandler
 * @description Handles the UNLOCK_GRABBING operation for entities.
 */
class UnlockGrabbingHandler extends BaseOperationHandler {
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
    super('UnlockGrabbingHandler', {
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
   * @returns {{ actorId: string, count: number, itemId: string|null, logger: ILogger }|null}
   * @private
   */
  #validateParams(params, executionContext) {
    const { actor_id, count, item_id } = params || {};
    const log = this.getLogger(executionContext);

    if (typeof actor_id !== 'string' || !actor_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'UNLOCK_GRABBING: invalid "actor_id"',
        { params },
        log
      );
      return null;
    }

    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
      safeDispatchError(
        this.#dispatcher,
        'UNLOCK_GRABBING: invalid "count" (must be integer >= 1)',
        { params },
        log
      );
      return null;
    }

    return {
      actorId: actor_id.trim(),
      count,
      itemId: item_id ?? null,
      logger: log,
    };
  }

  /**
   * Unlock grabbing appendages for the specified entity.
   *
   * @param {{ actor_id: string, count: number, item_id?: string }} params - Operation parameters.
   * @param {ExecutionContext} executionContext - Execution context.
   */
  async execute(params, executionContext) {
    const validated = this.#validateParams(params, executionContext);
    if (!validated) return;

    const { actorId, count, itemId, logger } = validated;

    try {
      const result = await unlockGrabbingAppendages(
        this.#entityManager,
        actorId,
        count,
        itemId
      );

      // Note: unlockGrabbingAppendages always succeeds (graceful degradation)
      // It unlocks as many as available, even if fewer than requested
      logger.debug(
        `[UnlockGrabbingHandler] Successfully unlocked ${result.unlockedParts.length} appendage(s) for entity: ${actorId}` +
          (itemId ? ` (filtered by item: ${itemId})` : '') +
          (result.unlockedParts.length < count
            ? ` (requested ${count}, only ${result.unlockedParts.length} were locked)`
            : '')
      );
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        `UNLOCK_GRABBING: failed to unlock appendages for entity ${actorId}`,
        {
          actor_id: actorId,
          count,
          item_id: itemId,
          error: err.message,
          stack: err.stack,
        },
        logger
      );
    }
  }
}

export default UnlockGrabbingHandler;
