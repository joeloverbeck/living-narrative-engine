/**
 * @file A handler in charge of performing teleport-like moves for entities, without breaking the turn order.
 * @see src/logic/operationHandlers/systemMoveEntityHandler.js
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../defs.js').EntityRefObject} EntityRefObject */

import { resolveEntityId } from '../../utils/entityRefUtils.js';

import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';

import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

const OPERATION_ID = 'SYSTEM_MOVE_ENTITY';

class SystemMoveEntityHandler extends BaseOperationHandler {
  /** @type {ILogger} */ #logger;
  /** @type {EntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;

  constructor({ entityManager, safeEventDispatcher, logger }) {
    super('SystemMoveEntityHandler', {
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
    this.#logger = logger;
  }

  /**
   * Update the position component for an entity.
   *
   * @private
   * @param {string} entityId - The entity to move.
   * @param {string} targetId - Destination location ID.
   * @param {ILogger} logger - Logger for diagnostic output.
   * @returns {string|null} Previous location ID if moved, otherwise null.
   */
  #moveEntity(entityId, targetId, logger) {
    const positionComponent = this.#entityManager.getComponentData(
      entityId,
      'core:position'
    );
    if (!positionComponent) {
      logger.warn(
        `${OPERATION_ID}: Entity "${entityId}" has no 'core:position' component. Cannot move.`
      );
      return null;
    }

    const fromLocationId = positionComponent.locationId;
    if (fromLocationId === targetId) {
      logger.debug(
        `${OPERATION_ID}: Entity "${entityId}" is already in location "${targetId}". No move needed.`
      );
      return null;
    }

    const success = this.#entityManager.addComponent(
      entityId,
      'core:position',
      {
        locationId: targetId,
      }
    );

    if (!success) {
      logger.warn(
        `${OPERATION_ID}: EntityManager reported failure for addComponent on entity "${entityId}".`
      );
      return null;
    }

    logger.debug(
      `${OPERATION_ID}: Moved entity "${entityId}" from "${fromLocationId}" to "${targetId}".`
    );
    return fromLocationId;
  }

  /**
   * Emit the core:entity_moved event.
   *
   * @private
   * @param {string} entityId - The moved entity.
   * @param {string} fromId - Previous location ID.
   * @param {string} targetId - New location ID.
   * @returns {Promise<void>} Resolves when dispatch completes.
   */
  async #emitMovedEvent(entityId, fromId, targetId) {
    await this.#dispatcher.dispatch('core:entity_moved', {
      eventName: 'core:entity_moved',
      entityId,
      previousLocationId: fromId,
      currentLocationId: targetId,
      direction: 'teleport',
      originalCommand: 'system:follow',
    });
  }

  /**
   * Resolves entity_ref -> entityId or null.
   *
   * @private
   * @param {string|EntityRefObject} ref - The entity reference from parameters.
   * @param {ExecutionContext} ctx - The execution context.
   * @returns {string | null} The resolved entity ID or null.
   */

  /**
   * Executes the SYSTEM_MOVE_ENTITY operation.
   *
   * @param {object} params - The parameters for the operation.
   * @param {string|object} params.entity_ref - The entity to move.
   * @param {string} params.target_location_id - The ID of the location to move the entity to.
   * @param {ExecutionContext} executionContext - The execution context.
   */
  async execute(params, executionContext) {
    const log = executionContext?.logger ?? this.#logger;

    if (!assertParamsObject(params, log, OPERATION_ID)) return;

    // 1. Validate parameters
    const { entity_ref, target_location_id } = params;
    // **CORRECTED**: Check specifically for null/undefined instead of any falsy value for entity_ref.
    // An empty string is an invalid *value* (handled later), not a *missing parameter*.
    if (
      entity_ref === null ||
      entity_ref === undefined ||
      !target_location_id
    ) {
      log.warn(
        `${OPERATION_ID}: "entity_ref" and "target_location_id" are required.`
      );
      return;
    }

    // 2. Resolve the entity ID
    const entityId = resolveEntityId(entity_ref, executionContext);
    if (!entityId) {
      log.warn(`${OPERATION_ID}: Could not resolve entity_ref.`, {
        entity_ref,
      });
      return;
    }

    let fromLocationId = null;
    try {
      fromLocationId = this.#moveEntity(entityId, target_location_id, log);
      if (fromLocationId) {
        await this.#emitMovedEvent(
          entityId,
          fromLocationId,
          target_location_id
        );
      }
    } catch (e) {
      safeDispatchError(
        this.#dispatcher,
        `${OPERATION_ID}: Failed to move entity "${entityId}". Error: ${e.message}`,
        {
          error: e.message,
          stack: e.stack,
          entityId,
          fromLocationId,
          targetLocationId: target_location_id,
        }
      );
    }
  }
}

export default SystemMoveEntityHandler;
