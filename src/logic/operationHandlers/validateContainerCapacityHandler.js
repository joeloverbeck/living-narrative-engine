/**
 * @file Handler for VALIDATE_CONTAINER_CAPACITY operation
 *
 * Validates whether adding an item to a container would exceed its capacity limits.
 *
 * Operation flow:
 * 1. Validates operation parameters (containerEntity, itemEntity)
 * 2. Retrieves container component and current contents
 * 3. Gets item weight and calculates total with current contents
 * 4. Compares against container's max capacity
 * 5. Returns validation result in specified context variable
 *
 * Related files:
 * @see data/schemas/operations/validateContainerCapacity.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - ValidateContainerCapacityHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

const CONTAINER_COMPONENT_ID = 'items:container';
const WEIGHT_COMPONENT_ID = 'core:weight';

/**
 * @typedef {object} ValidateContainerCapacityParams
 * @property {string} containerEntity – Entity whose container capacity to check
 * @property {string} itemEntity – Item entity to validate for addition
 * @property {string} result_variable – Variable name to store validation result
 */

/**
 * Validates if adding an item would exceed container capacity
 */
class ValidateContainerCapacityHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('ValidateContainerCapacityHandler', {
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
   * @param {ValidateContainerCapacityParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{containerEntity: string, itemEntity: string, resultVariable: string}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (
      !assertParamsObject(params, this.#dispatcher, 'VALIDATE_CONTAINER_CAPACITY')
    ) {
      return null;
    }

    const { containerEntity, itemEntity, result_variable } = params;

    if (typeof containerEntity !== 'string' || !containerEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'VALIDATE_CONTAINER_CAPACITY: containerEntity is required',
        { containerEntity },
        logger
      );
      return null;
    }

    if (typeof itemEntity !== 'string' || !itemEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'VALIDATE_CONTAINER_CAPACITY: itemEntity is required',
        { itemEntity },
        logger
      );
      return null;
    }

    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'VALIDATE_CONTAINER_CAPACITY: result_variable is required',
        { result_variable },
        logger
      );
      return null;
    }

    return {
      containerEntity: containerEntity.trim(),
      itemEntity: itemEntity.trim(),
      resultVariable: result_variable.trim(),
    };
  }

  /**
   * Execute the capacity validation
   *
   * @param {ValidateContainerCapacityParams} params - Validation parameters
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context
   * @returns {Promise<{valid: boolean, reason?: string}>} Validation result
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // Validation
    const validated = this.#validateParams(params, log);
    if (!validated) {
      const failureResult = { valid: false, reason: 'validation_failed' };
      if (params?.result_variable) {
        tryWriteContextVariable(
          params.result_variable,
          failureResult,
          executionContext,
          this.#dispatcher,
          log
        );
      }
      return;
    }

    const { containerEntity, itemEntity, resultVariable } = validated;

    try {
      // Get container and item weight using getComponentData
      const container = this.#entityManager.getComponentData(
        containerEntity,
        CONTAINER_COMPONENT_ID
      );
      const itemWeight = this.#entityManager.getComponentData(
        itemEntity,
        WEIGHT_COMPONENT_ID
      );

      if (!container) {
        log.warn(`No container component on entity`, { containerEntity });
        const result = { valid: false, reason: 'no_container' };
        tryWriteContextVariable(
          resultVariable,
          result,
          executionContext,
          this.#dispatcher,
          log
        );
        return;
      }

      if (!container.isOpen) {
        log.debug(`Container is closed`, { containerEntity });
        const result = { valid: false, reason: 'container_closed' };
        tryWriteContextVariable(
          resultVariable,
          result,
          executionContext,
          this.#dispatcher,
          log
        );
        return;
      }

      if (!container.capacity) {
        log.warn(`No capacity defined on container`, { containerEntity });
        const result = { valid: false, reason: 'no_capacity_defined' };
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

      const contents = Array.isArray(container.contents)
        ? container.contents
        : [];

      // Check item count constraint
      if (contents.length >= container.capacity.maxItems) {
        log.debug(`Container full (item count)`, { containerEntity });
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
      for (const itemId of contents) {
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
      if (newWeight > container.capacity.maxWeight) {
        log.debug(`Container full (weight)`, {
          containerEntity,
          currentWeight,
          newWeight,
          maxWeight: container.capacity.maxWeight,
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
        containerEntity,
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

export default ValidateContainerCapacityHandler;
