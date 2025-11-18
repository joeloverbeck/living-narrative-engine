/**
 * @file Handler for PUT_IN_CONTAINER operation
 *
 * Puts an item from the actor's inventory into a container.
 *
 * Operation flow:
 * 1. Validates operation parameters (actorEntity, containerEntity, itemEntity)
 * 2. Verifies actor has item in inventory
 * 3. Checks container has capacity for additional item
 * 4. Removes item from actor's inventory
 * 5. Adds item to container's contents and dispatches event
 *
 * Related files:
 * @see data/schemas/operations/putInContainer.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - PutInContainerHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

const INVENTORY_COMPONENT_ID = 'items:inventory';
const CONTAINER_COMPONENT_ID = 'items:container';
const ITEM_PUT_EVENT = 'items:item_put_in_container';

/**
 * @typedef {object} PutInContainerParams
 * @property {string} actorEntity - Actor storing the item
 * @property {string} containerEntity - Container being stored into
 * @property {string} itemEntity - Item being stored
 * @property {string} [result_variable] - Optional variable to store result
 */

/**
 * Puts an item from actor's inventory into a container
 */
class PutInContainerHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('PutInContainerHandler', {
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
   * @param {PutInContainerParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{actorEntity: string, containerEntity: string, itemEntity: string, resultVariable?: string}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'PUT_IN_CONTAINER')) {
      return null;
    }

    const { actorEntity, containerEntity, itemEntity, result_variable } = params;

    if (typeof actorEntity !== 'string' || !actorEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'PUT_IN_CONTAINER: actorEntity is required',
        { actorEntity },
        logger
      );
      return null;
    }

    if (typeof containerEntity !== 'string' || !containerEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'PUT_IN_CONTAINER: containerEntity is required',
        { containerEntity },
        logger
      );
      return null;
    }

    if (typeof itemEntity !== 'string' || !itemEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'PUT_IN_CONTAINER: itemEntity is required',
        { itemEntity },
        logger
      );
      return null;
    }

    const result = {
      actorEntity: actorEntity.trim(),
      containerEntity: containerEntity.trim(),
      itemEntity: itemEntity.trim(),
    };

    if (result_variable) {
      if (typeof result_variable !== 'string' || !result_variable.trim()) {
        safeDispatchError(
          this.#dispatcher,
          'PUT_IN_CONTAINER: result_variable must be a non-empty string when provided',
          { result_variable },
          logger
        );
        return null;
      }
      result.resultVariable = result_variable.trim();
    }

    return result;
  }

  /**
   * Execute the put in container operation
   *
   * @param {PutInContainerParams} params - Operation parameters
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context
   * @returns {Promise<{success: boolean, error?: string}>} Operation result
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // Validation
    const validated = this.#validateParams(params, log);
    if (!validated) {
      const result = { success: false, error: 'validation_failed' };
      if (params?.result_variable) {
        tryWriteContextVariable(
          params.result_variable,
          result,
          executionContext,
          this.#dispatcher,
          log
        );
      }
      return result;
    }

    const { actorEntity, containerEntity, itemEntity, resultVariable } =
      validated;

    try {
      const inventory = this.#entityManager.getComponentData(
        actorEntity,
        INVENTORY_COMPONENT_ID
      );
      const container = this.#entityManager.getComponentData(
        containerEntity,
        CONTAINER_COMPONENT_ID
      );

      if (!inventory) {
        log.warn('No inventory on actor', {
          actorEntity,
        });
        const result = { success: false, error: 'no_inventory' };
        if (resultVariable) {
          tryWriteContextVariable(
            resultVariable,
            result,
            executionContext,
            this.#dispatcher,
            log
          );
        }
        return result;
      }

      const inventoryItems = Array.isArray(inventory.items)
        ? inventory.items
        : [];

      if (!inventoryItems.includes(itemEntity)) {
        log.warn('Item not in inventory', {
          actorEntity,
          itemEntity,
        });
        const result = { success: false, error: 'item_not_in_inventory' };
        if (resultVariable) {
          tryWriteContextVariable(
            resultVariable,
            result,
            executionContext,
            this.#dispatcher,
            log
          );
        }
        return result;
      }

      if (!container) {
        log.warn('No container component', {
          containerEntity,
        });
        const result = { success: false, error: 'not_a_container' };
        if (resultVariable) {
          tryWriteContextVariable(
            resultVariable,
            result,
            executionContext,
            this.#dispatcher,
            log
          );
        }
        return result;
      }

      if (!container.isOpen) {
        log.debug('Container is closed', {
          containerEntity,
        });
        const result = { success: false, error: 'container_closed' };
        if (resultVariable) {
          tryWriteContextVariable(
            resultVariable,
            result,
            executionContext,
            this.#dispatcher,
            log
          );
        }
        return result;
      }

      const containerItems = Array.isArray(container.contents)
        ? container.contents
        : [];

      // Remove from inventory, add to container
      const updates = [
        {
          instanceId: actorEntity,
          componentTypeId: INVENTORY_COMPONENT_ID,
          componentData: {
            ...inventory,
            items: inventoryItems.filter((id) => id !== itemEntity),
          },
        },
        {
          instanceId: containerEntity,
          componentTypeId: CONTAINER_COMPONENT_ID,
          componentData: {
            ...container,
            contents: [...containerItems, itemEntity],
          },
        },
      ];

      await this.#entityManager.batchAddComponentsOptimized(updates, true);

      this.#dispatcher.dispatch(ITEM_PUT_EVENT, {
        actorEntity,
        containerEntity,
        itemEntity,
      });

      log.debug('Item put in container', {
        actorEntity,
        containerEntity,
        itemEntity,
      });

      const result = { success: true };
      if (resultVariable) {
        tryWriteContextVariable(
          resultVariable,
          result,
          executionContext,
          this.#dispatcher,
          log
        );
      }
      return result;
    } catch (error) {
      log.error('Put in container failed', error, {
        actorEntity,
        containerEntity,
        itemEntity,
      });
      const result = { success: false, error: error.message };
      if (resultVariable) {
        tryWriteContextVariable(
          resultVariable,
          result,
          executionContext,
          this.#dispatcher,
          log
        );
      }
      return result;
    }
  }
}

export default PutInContainerHandler;
