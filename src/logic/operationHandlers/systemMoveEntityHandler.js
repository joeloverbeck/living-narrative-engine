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
import { DISPLAY_ERROR_ID } from '../../constants/eventIds.js';
import { safeDispatchError } from '../../utils/safeDispatchError.js';

class SystemMoveEntityHandler {
  /** @type {ILogger} */ #logger;
  /** @type {EntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;

  constructor({ entityManager, safeEventDispatcher, logger }) {
    if (!logger?.debug)
      throw new Error('SystemMoveEntityHandler requires ILogger');
    if (
      !entityManager ||
      typeof entityManager.getComponentData !== 'function' ||
      typeof entityManager.addComponent !== 'function'
    ) {
      throw new Error('SystemMoveEntityHandler requires EntityManager');
    }
    if (!safeEventDispatcher?.dispatch)
      throw new Error('SystemMoveEntityHandler needs ISafeEventDispatcher');
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#logger = logger;
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
    const opName = 'SYSTEM_MOVE_ENTITY'; // Use a constant for the name

    // 1. Validate parameters
    const { entity_ref, target_location_id } = params;
    // **CORRECTED**: Check specifically for null/undefined instead of any falsy value for entity_ref.
    // An empty string is an invalid *value* (handled later), not a *missing parameter*.
    if (entity_ref == null || !target_location_id) {
      log.warn(
        `${opName}: "entity_ref" and "target_location_id" are required.`
      );
      return;
    }

    // 2. Resolve the entity ID
    const entityId = resolveEntityId(entity_ref, executionContext);
    if (!entityId) {
      log.warn(`${opName}: Could not resolve entity_ref.`, { entity_ref });
      return;
    }

    // 3. Perform the move using EntityManager
    let fromLocationId = null;

    try {
      const positionComponent = this.#entityManager.getComponentData(
        entityId,
        'core:position'
      );
      if (!positionComponent) {
        log.warn(
          `${opName}: Entity "${entityId}" has no 'core:position' component. Cannot move.`
        );
        return;
      }

      fromLocationId = positionComponent.locationId;

      // Prevent moving if already there
      if (fromLocationId === target_location_id) {
        log.debug(
          `${opName}: Entity "${entityId}" is already in location "${target_location_id}". No move needed.`
        );
        return;
      }

      // **CORRECTED**: Use EntityManager.addComponent to update the component.
      // This correctly handles overwriting the component and updating the spatial index.
      const success = this.#entityManager.addComponent(
        entityId,
        'core:position',
        { locationId: target_location_id }
      );

      if (!success) {
        log.warn(
          `${opName}: EntityManager reported failure for addComponent on entity "${entityId}".`
        );
        return;
      }

      log.debug(
        `${opName}: Moved entity "${entityId}" from "${fromLocationId}" to "${target_location_id}".`
      );

      // 4. **Dispatch core:entity_moved with a compliant payload**
      await this.#dispatcher.dispatch('core:entity_moved', {
        eventName: 'core:entity_moved',
        entityId: entityId,
        previousLocationId: fromLocationId,
        currentLocationId: target_location_id,
        direction: 'teleport', // A sensible default for non-directional moves
        originalCommand: 'system:follow', // A sensible default for system-initiated actions
      });
    } catch (e) {
      safeDispatchError(
        this.#dispatcher,
        `${opName}: Failed to move entity "${entityId}". Error: ${e.message}`,
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
