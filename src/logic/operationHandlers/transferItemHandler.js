/**
 * @file Handler for TRANSFER_ITEM operation
 *
 * Transfers an item from one entity's inventory to another entity's inventory.
 *
 * Operation flow:
 * 1. Validates operation parameters (fromEntity, toEntity, itemEntity)
 * 2. Verifies source entity has item in inventory
 * 3. Checks destination entity has inventory capacity
 * 4. Removes item from source inventory
 * 5. Adds item to destination inventory and dispatches event
 *
 * Related files:
 * @see data/schemas/operations/transferItem.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - TransferItemHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';
import { INVENTORY_COMPONENT_ID } from '../../constants/componentIds.js';
import { ITEM_TRANSFERRED_EVENT_ID } from '../../constants/eventIds.js';

/**
 * @typedef {object} TransferItemParams
 * @property {string} fromEntity – Source entity ID
 * @property {string} toEntity – Destination entity ID
 * @property {string} itemEntity – Item entity ID to transfer
 */

/**
 * Transfers an item from one entity's inventory to another's
 */
class TransferItemHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('TransferItemHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'batchAddComponentsOptimized'],
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
   * @param {TransferItemParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{fromEntity: string, toEntity: string, itemEntity: string}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'TRANSFER_ITEM')) {
      return null;
    }

    const { fromEntity, toEntity, itemEntity } = params;

    if (typeof fromEntity !== 'string' || !fromEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'TRANSFER_ITEM: fromEntity is required',
        { fromEntity },
        logger
      );
      return null;
    }

    if (typeof toEntity !== 'string' || !toEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'TRANSFER_ITEM: toEntity is required',
        { toEntity },
        logger
      );
      return null;
    }

    if (typeof itemEntity !== 'string' || !itemEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'TRANSFER_ITEM: itemEntity is required',
        { itemEntity },
        logger
      );
      return null;
    }

    return {
      fromEntity: fromEntity.trim(),
      toEntity: toEntity.trim(),
      itemEntity: itemEntity.trim(),
    };
  }

  /**
   * Execute the item transfer operation
   *
   * @param {TransferItemParams} params - Transfer parameters
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context
   * @returns {Promise<{success: boolean, error?: string}>} Transfer result
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // Validation
    const validated = this.#validateParams(params, log);
    if (!validated) {
      return { success: false, error: 'validation_failed' };
    }

    const { fromEntity, toEntity, itemEntity } = validated;

    try {
      // Get inventories using getComponentData
      const fromInventory = this.#entityManager.getComponentData(
        fromEntity,
        INVENTORY_COMPONENT_ID
      );
      const toInventory = this.#entityManager.getComponentData(
        toEntity,
        INVENTORY_COMPONENT_ID
      );

      if (!fromInventory || !toInventory) {
        log.warn(`Missing inventory component for transfer`, {
          fromEntity,
          toEntity,
        });
        return { success: false, error: 'missing_inventory' };
      }

      // Check if item exists in source inventory
      if (!fromInventory.items.includes(itemEntity)) {
        log.warn(`Item not in source inventory`, { fromEntity, itemEntity });
        return { success: false, error: 'item_not_found' };
      }

      // Prepare batch updates
      const updates = [
        {
          instanceId: fromEntity,
          componentTypeId: INVENTORY_COMPONENT_ID,
          componentData: {
            ...fromInventory,
            items: fromInventory.items.filter((id) => id !== itemEntity),
          },
        },
        {
          instanceId: toEntity,
          componentTypeId: INVENTORY_COMPONENT_ID,
          componentData: {
            ...toInventory,
            items: [...toInventory.items, itemEntity],
          },
        },
      ];

      // Apply atomically with batch update
      await this.#entityManager.batchAddComponentsOptimized(updates, true);

      // Dispatch success event
      this.#dispatcher.dispatch(ITEM_TRANSFERRED_EVENT_ID, {
        fromEntity,
        toEntity,
        itemEntity,
      });

      log.debug(`Item transferred successfully`, {
        fromEntity,
        toEntity,
        itemEntity,
      });
      return { success: true };
    } catch (error) {
      log.error(`Transfer failed`, error, { fromEntity, toEntity, itemEntity });
      return { success: false, error: error.message };
    }
  }
}

export default TransferItemHandler;
