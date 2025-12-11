/**
 * @file Handler for TAKE_FROM_CONTAINER operation
 *
 * Takes an item from a container and adds it to the actor's inventory.
 *
 * Operation flow:
 * 1. Validates operation parameters (actorEntity, containerEntity, itemEntity)
 * 2. Verifies container has the item in its contents
 * 3. Checks actor's inventory has capacity for additional item
 * 4. Removes item from container's contents
 * 5. Adds item to actor's inventory and dispatches event
 *
 * Related files:
 * @see data/schemas/operations/takeFromContainer.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - TakeFromContainerHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

const INVENTORY_COMPONENT_ID = 'items:inventory';
const CONTAINER_COMPONENT_ID = 'containers-core:container';
const ITEM_TAKEN_EVENT = 'containers:item_taken_from_container';

/**
 * @typedef {object} TakeFromContainerParams
 * @property {string} actorEntity - Actor taking the item
 * @property {string} containerEntity - Container being taken from
 * @property {string} itemEntity - Item being taken
 */

/**
 * Takes an item from a container and adds it to actor's inventory
 */
class TakeFromContainerHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('TakeFromContainerHandler', {
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
   * @param {TakeFromContainerParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{actorEntity: string, containerEntity: string, itemEntity: string}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'TAKE_FROM_CONTAINER')) {
      return null;
    }

    const { actorEntity, containerEntity, itemEntity } = params;

    if (typeof actorEntity !== 'string' || !actorEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'TAKE_FROM_CONTAINER: actorEntity is required',
        { actorEntity },
        logger
      );
      return null;
    }

    if (typeof containerEntity !== 'string' || !containerEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'TAKE_FROM_CONTAINER: containerEntity is required',
        { containerEntity },
        logger
      );
      return null;
    }

    if (typeof itemEntity !== 'string' || !itemEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'TAKE_FROM_CONTAINER: itemEntity is required',
        { itemEntity },
        logger
      );
      return null;
    }

    return {
      actorEntity: actorEntity.trim(),
      containerEntity: containerEntity.trim(),
      itemEntity: itemEntity.trim(),
    };
  }

  /**
   * Execute the take from container operation
   *
   * @param {TakeFromContainerParams} params - Operation parameters
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context
   * @returns {Promise<{success: boolean, error?: string}>} Operation result
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // Validation
    const validated = this.#validateParams(params, log);
    if (!validated) {
      return { success: false, error: 'validation_failed' };
    }

    const { actorEntity, containerEntity, itemEntity } = validated;

    try {
      const container = this.#entityManager.getComponentData(
        containerEntity,
        CONTAINER_COMPONENT_ID
      );
      const inventory = this.#entityManager.getComponentData(
        actorEntity,
        INVENTORY_COMPONENT_ID
      );

      if (!container) {
        log.warn('No container component', {
          containerEntity,
        });
        return { success: false, error: 'not_a_container' };
      }

      if (!container.isOpen) {
        log.debug('Container is closed', {
          containerEntity,
        });
        return { success: false, error: 'container_closed' };
      }

      const containerItems = Array.isArray(container.contents)
        ? container.contents
        : [];

      if (!containerItems.includes(itemEntity)) {
        log.warn('Item not in container', {
          containerEntity,
          itemEntity,
        });
        return { success: false, error: 'item_not_in_container' };
      }

      if (!inventory) {
        log.warn('No inventory on actor', {
          actorEntity,
        });
        return { success: false, error: 'no_inventory' };
      }

      const inventoryItems = Array.isArray(inventory.items)
        ? inventory.items
        : [];

      // Remove from container, add to inventory
      const updates = [
        {
          instanceId: containerEntity,
          componentTypeId: CONTAINER_COMPONENT_ID,
          componentData: {
            ...container,
            contents: containerItems.filter((id) => id !== itemEntity),
          },
        },
        {
          instanceId: actorEntity,
          componentTypeId: INVENTORY_COMPONENT_ID,
          componentData: {
            ...inventory,
            items: [...inventoryItems, itemEntity],
          },
        },
      ];

      await this.#entityManager.batchAddComponentsOptimized(updates, true);

      this.#dispatcher.dispatch(ITEM_TAKEN_EVENT, {
        actorEntity,
        containerEntity,
        itemEntity,
      });

      log.debug('Item taken from container', {
        actorEntity,
        containerEntity,
        itemEntity,
      });
      return { success: true };
    } catch (error) {
      log.error('Take from container failed', error, {
        actorEntity,
        containerEntity,
        itemEntity,
      });
      return { success: false, error: error.message };
    }
  }
}

export default TakeFromContainerHandler;
