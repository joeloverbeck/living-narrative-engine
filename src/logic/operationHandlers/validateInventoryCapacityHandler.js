/**
 * @file Handler for VALIDATE_INVENTORY_CAPACITY operation
 *
 * Validates whether adding an item to an entity's inventory would exceed capacity limits.
 *
 * Operation flow:
 * 1. Validates operation parameters (targetEntity, itemEntity)
 * 2. Retrieves inventory component and current items
 * 3. Gets item weight and calculates total with current inventory
 * 4. Compares against inventory's max capacity
 * 5. Returns validation result in specified context variable
 *
 * Related files:
 * @see data/schemas/operations/validateInventoryCapacity.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - ValidateInventoryCapacityHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

const INVENTORY_COMPONENT_ID = 'inventory:inventory';
const WEIGHT_COMPONENT_ID = 'core:weight';

/**
 * @typedef {object} ValidateInventoryCapacityParams
 * @property {string} targetEntity – Entity whose inventory capacity to check
 * @property {string} itemEntity – Item entity to validate for addition
 * @property {string} result_variable – Variable name to store validation result
 */

/**
 * Validates if adding an item would exceed inventory capacity
 */
class ValidateInventoryCapacityHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('ValidateInventoryCapacityHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData'],
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
   * @param {ValidateInventoryCapacityParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{targetEntity: string, itemEntity: string}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (
      !assertParamsObject(
        params,
        this.#dispatcher,
        'VALIDATE_INVENTORY_CAPACITY'
      )
    ) {
      return null;
    }

    const { targetEntity, itemEntity, result_variable } = params;

    if (typeof targetEntity !== 'string' || !targetEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'VALIDATE_INVENTORY_CAPACITY: targetEntity is required',
        { targetEntity },
        logger
      );
      return null;
    }

    if (typeof itemEntity !== 'string' || !itemEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'VALIDATE_INVENTORY_CAPACITY: itemEntity is required',
        { itemEntity },
        logger
      );
      return null;
    }

    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'VALIDATE_INVENTORY_CAPACITY: result_variable is required',
        { result_variable },
        logger
      );
      return null;
    }

    return {
      targetEntity: targetEntity.trim(),
      itemEntity: itemEntity.trim(),
      resultVariable: result_variable.trim(),
    };
  }

  /**
   * Execute the capacity validation
   *
   * @param {ValidateInventoryCapacityParams} params - Validation parameters
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context
   * @returns {Promise<{valid: boolean, reason?: string}>} Validation result
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // Validation
    const validated = this.#validateParams(params, log);
    if (!validated) {
      const failureResult = { valid: false, reason: 'validation_failed' };
      const rawResultVariable =
        typeof params?.result_variable === 'string'
          ? params.result_variable.trim()
          : '';
      if (rawResultVariable) {
        tryWriteContextVariable(
          rawResultVariable,
          failureResult,
          executionContext,
          this.#dispatcher,
          log
        );
      }
      return;
    }

    const { targetEntity, itemEntity, resultVariable } = validated;

    try {
      // Get inventory and item weight using getComponentData
      const inventory = this.#entityManager.getComponentData(
        targetEntity,
        INVENTORY_COMPONENT_ID
      );
      const itemWeight = this.#entityManager.getComponentData(
        itemEntity,
        WEIGHT_COMPONENT_ID
      );

      if (!inventory) {
        log.warn(`No inventory component on target`, { targetEntity });
        const result = { valid: false, reason: 'no_inventory' };
        tryWriteContextVariable(
          resultVariable,
          result,
          executionContext,
          this.#dispatcher,
          log
        );
        return;
      }

      if (!itemWeight) {
        log.warn(`No weight component on item`, { itemEntity });
        const result = { valid: false, reason: 'no_weight' };
        tryWriteContextVariable(
          resultVariable,
          result,
          executionContext,
          this.#dispatcher,
          log
        );
        return;
      }

      // Check item count constraint
      if (inventory.items.length >= inventory.capacity.maxItems) {
        log.debug(`Inventory full (item count)`, { targetEntity });
        const result = { valid: false, reason: 'max_items_exceeded' };
        tryWriteContextVariable(
          resultVariable,
          result,
          executionContext,
          this.#dispatcher,
          log
        );
        return;
      }

      // Calculate total weight
      let currentWeight = 0;
      for (const itemId of inventory.items) {
        const weight = this.#entityManager.getComponentData(
          itemId,
          WEIGHT_COMPONENT_ID
        );
        if (weight) {
          currentWeight += weight.weight;
        }
      }

      // Check weight constraint (access weight.weight property)
      const newWeight = currentWeight + itemWeight.weight;
      if (newWeight > inventory.capacity.maxWeight) {
        log.debug(`Inventory full (weight)`, {
          targetEntity,
          currentWeight,
          newWeight,
          maxWeight: inventory.capacity.maxWeight,
        });
        const result = { valid: false, reason: 'max_weight_exceeded' };
        tryWriteContextVariable(
          resultVariable,
          result,
          executionContext,
          this.#dispatcher,
          log
        );
        return;
      }

      const result = { valid: true };
      tryWriteContextVariable(
        resultVariable,
        result,
        executionContext,
        this.#dispatcher,
        log
      );
    } catch (error) {
      log.error(`Capacity validation failed`, error, {
        targetEntity,
        itemEntity,
      });
      const result = { valid: false, reason: error.message };
      tryWriteContextVariable(
        resultVariable,
        result,
        executionContext,
        this.#dispatcher,
        log
      );
    }
  }
}

export default ValidateInventoryCapacityHandler;
