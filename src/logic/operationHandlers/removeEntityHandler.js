/**
 * @file Handler for REMOVE_ENTITY operation
 *
 * Removes an entity from the game world, optionally cleaning up inventory references first.
 *
 * Operation flow:
 * 1. Validates operation parameters (entity_ref)
 * 2. Resolves entity reference to entity ID
 * 3. If cleanup_inventory=true, finds and removes entity from any inventory containing it
 * 4. Calls entityManager.removeEntityInstance to delete the entity
 * 5. EntityManager automatically dispatches core:entity_removed event
 *
 * Related files:
 * @see data/schemas/operations/removeEntity.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - RemoveEntityHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

// --- Type-hints --------------------------------------------------------------
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { resolveEntityId } from '../../utils/entityRefUtils.js';
import { INVENTORY_COMPONENT_ID } from '../../constants/componentIds.js';

/**
 * Parameters accepted by {@link RemoveEntityHandler#execute}.
 *
 * @typedef {object} RemoveEntityOperationParams
 * @property {string} entity_ref - Required. Reference to the entity to remove.
 * @property {boolean} [cleanup_inventory=true] - If true, removes entity from any inventory containing it.
 * @property {string} [result_variable] - Optional variable name to store operation result.
 */

/**
 * Result of the REMOVE_ENTITY operation.
 *
 * @typedef {object} RemoveEntityResult
 * @property {boolean} success - Whether the operation succeeded.
 * @property {string} [removedFromInventory] - ID of entity whose inventory contained the removed entity.
 * @property {string} [error] - Error message if operation failed.
 */

// -----------------------------------------------------------------------------
//  Handler implementation
// -----------------------------------------------------------------------------
class RemoveEntityHandler extends BaseOperationHandler {
  /** @type {EntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;

  /**
   * Creates an instance of RemoveEntityHandler.
   *
   * @param {object} dependencies - Dependencies object.
   * @param {EntityManager} dependencies.entityManager - The entity management service.
   * @param {ILogger} dependencies.logger - The logging service instance.
   * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher - Event dispatcher.
   * @throws {Error} If entityManager, logger, or safeEventDispatcher are missing or invalid.
   */
  constructor({ entityManager, logger, safeEventDispatcher }) {
    super('RemoveEntityHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'removeEntityInstance',
          'getEntitiesWithComponent',
          'getComponentData',
          'batchAddComponentsOptimized',
          'hasEntity',
        ],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#dispatcher = safeEventDispatcher;
    this.#entityManager = entityManager;
  }

  /**
   * Finds and removes the target entity from any inventory containing it.
   *
   * @private
   * @param {string} targetEntityId - The entity ID to remove from inventories.
   * @param {ILogger} log - Logger for diagnostics.
   * @returns {Promise<string|null>} ID of the entity whose inventory was modified, or null if not found in any inventory.
   */
  async #removeFromInventories(targetEntityId, log) {
    // Get all entities that have an inventory component
    const entitiesWithInventory = this.#entityManager.getEntitiesWithComponent(
      INVENTORY_COMPONENT_ID
    );

    if (!entitiesWithInventory || entitiesWithInventory.length === 0) {
      log.debug(
        `REMOVE_ENTITY: No entities with inventories found, skipping inventory cleanup`
      );
      return null;
    }

    // Search through all inventories for the target entity
    for (const entity of entitiesWithInventory) {
      const inventoryData = this.#entityManager.getComponentData(
        entity.id,
        INVENTORY_COMPONENT_ID
      );

      if (
        inventoryData &&
        inventoryData.items &&
        inventoryData.items.includes(targetEntityId)
      ) {
        log.debug(
          `REMOVE_ENTITY: Found target "${targetEntityId}" in inventory of "${entity.id}", removing...`
        );

        // Remove the entity from this inventory
        const updatedItems = inventoryData.items.filter(
          (id) => id !== targetEntityId
        );

        await this.#entityManager.batchAddComponentsOptimized(
          [
            {
              instanceId: entity.id,
              componentTypeId: INVENTORY_COMPONENT_ID,
              componentData: {
                ...inventoryData,
                items: updatedItems,
              },
            },
          ],
          true
        );

        log.debug(
          `REMOVE_ENTITY: Removed "${targetEntityId}" from inventory of "${entity.id}"`
        );
        return entity.id;
      }
    }

    log.debug(
      `REMOVE_ENTITY: Target "${targetEntityId}" not found in any inventory`
    );
    return null;
  }

  /**
   * Executes the REMOVE_ENTITY operation.
   * Removes an entity from the game world, optionally cleaning up inventory references.
   *
   * @param {RemoveEntityOperationParams | null | undefined} params - The parameters for the operation.
   * @param {ExecutionContext} executionContext - The execution context.
   * @returns {Promise<RemoveEntityResult>} Operation result.
   * @implements {OperationHandler}
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // 1. Validate Parameters
    if (!assertParamsObject(params, log, 'REMOVE_ENTITY')) {
      return { success: false, error: 'validation_failed' };
    }

    const { entity_ref, cleanup_inventory = true, result_variable } = params;

    // 2. Validate entity_ref
    if (typeof entity_ref !== 'string' || !entity_ref.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'REMOVE_ENTITY: entity_ref is required and must be a non-empty string',
        { entity_ref }
      );
      return { success: false, error: 'invalid_entity_ref' };
    }

    // 3. Resolve entity reference to ID
    const entityId = resolveEntityId(entity_ref.trim(), executionContext);

    if (!entityId) {
      safeDispatchError(
        this.#dispatcher,
        `REMOVE_ENTITY: Failed to resolve entity_ref "${entity_ref}"`,
        { entity_ref }
      );
      return { success: false, error: 'unresolved_entity_ref' };
    }

    // 4. Verify entity exists
    if (!this.#entityManager.hasEntity(entityId)) {
      log.warn(`REMOVE_ENTITY: Entity "${entityId}" does not exist`);
      return { success: false, error: 'entity_not_found' };
    }

    try {
      /** @type {RemoveEntityResult} */
      const result = { success: true };

      // 5. If cleanup_inventory is enabled, remove from any containing inventory
      if (cleanup_inventory) {
        const inventoryOwnerId = await this.#removeFromInventories(
          entityId,
          log
        );
        if (inventoryOwnerId) {
          result.removedFromInventory = inventoryOwnerId;
        }
      }

      // 6. Remove the entity from the game
      await this.#entityManager.removeEntityInstance(entityId);

      log.debug(
        `REMOVE_ENTITY: Successfully removed entity "${entityId}"`,
        result
      );

      // 7. Store result in context if result_variable specified
      if (result_variable && executionContext?.context) {
        executionContext.context[result_variable] = result;
      }

      return result;
    } catch (e) {
      safeDispatchError(
        this.#dispatcher,
        `REMOVE_ENTITY: Failed to remove entity "${entityId}". Error: ${e.message}`,
        {
          error: e.message,
          stack: e.stack,
          entityId,
        }
      );
      return { success: false, error: e.message };
    }
  }
}

export default RemoveEntityHandler;
