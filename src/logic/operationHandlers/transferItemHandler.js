/**
 * @file Operation handler for transferring items between entity inventories
 * @see src/logic/operationHandlers/transferItemHandler.js
 */

import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

const INVENTORY_COMPONENT_ID = 'items:inventory';
const ITEM_TRANSFERRED_EVENT = 'ITEM_TRANSFERRED';

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
      this.#dispatcher.dispatch({
        type: ITEM_TRANSFERRED_EVENT,
        payload: { fromEntity, toEntity, itemEntity },
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
