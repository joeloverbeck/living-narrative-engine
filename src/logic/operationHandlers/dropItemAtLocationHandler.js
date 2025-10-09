/**
 * @file Operation handler for dropping items at a location
 * @see src/logic/operationHandlers/dropItemAtLocationHandler.js
 */

import { assertParamsObject, validateStringParam } from '../../utils/handlerUtils/paramsUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

const INVENTORY_COMPONENT_ID = 'items:inventory';
const POSITION_COMPONENT_ID = 'core:position';
const ITEM_DROPPED_EVENT = 'items:item_dropped';

/**
 * @typedef {object} DropItemParams
 * @property {string} actorEntity – Actor dropping the item
 * @property {string} itemEntity – Item to drop
 * @property {string} locationId – Location where item will be dropped
 */

/**
 * Drops an item from inventory at a location, making it available for pickup
 */
class DropItemAtLocationHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('DropItemAtLocationHandler', {
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
   * @param {DropItemParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{actorEntity: string, itemEntity: string, locationId: string}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'DROP_ITEM_AT_LOCATION')) {
      return null;
    }

    const { actorEntity, itemEntity, locationId } = params;

    const validatedActor = validateStringParam(actorEntity, 'actorEntity', logger, this.#dispatcher);
    const validatedItem = validateStringParam(itemEntity, 'itemEntity', logger, this.#dispatcher);
    const validatedLocation = validateStringParam(locationId, 'locationId', logger, this.#dispatcher);

    if (!validatedActor || !validatedItem || !validatedLocation) {
      return null;
    }

    return {
      actorEntity: validatedActor,
      itemEntity: validatedItem,
      locationId: validatedLocation,
    };
  }

  /**
   * Execute the drop item operation
   *
   * @param {DropItemParams} params - Drop parameters
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context
   * @returns {Promise<{success: boolean, error?: string}>} Drop result
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // Validation
    const validated = this.#validateParams(params, log);
    if (!validated) {
      return { success: false, error: 'validation_failed' };
    }

    const { actorEntity, itemEntity, locationId } = validated;

    try {
      // Get inventory using getComponentData
      const inventory = this.#entityManager.getComponentData(
        actorEntity,
        INVENTORY_COMPONENT_ID
      );

      if (!inventory) {
        log.warn(`No inventory on actor`, { actorEntity });
        return { success: false, error: 'no_inventory' };
      }

      if (!inventory.items.includes(itemEntity)) {
        log.warn(`Item not in inventory`, { actorEntity, itemEntity });
        return { success: false, error: 'item_not_in_inventory' };
      }

      // Prepare batch updates: remove from inventory and set position
      const updates = [
        {
          instanceId: actorEntity,
          componentTypeId: INVENTORY_COMPONENT_ID,
          componentData: {
            ...inventory,
            items: inventory.items.filter((id) => id !== itemEntity),
          },
        },
        {
          instanceId: itemEntity,
          componentTypeId: POSITION_COMPONENT_ID,
          componentData: { locationId },
        },
      ];

      // Apply atomically with batch update
      await this.#entityManager.batchAddComponentsOptimized(updates, true);

      // Dispatch success event using the event bus signature of (eventId, payload)
      this.#dispatcher.dispatch(ITEM_DROPPED_EVENT, {
        actorEntity,
        itemEntity,
        locationId,
      });

      log.debug(`Item dropped at location`, {
        actorEntity,
        itemEntity,
        locationId,
      });
      return { success: true };

    } catch (error) {
      log.error(`Drop item failed`, error, { actorEntity, itemEntity, locationId });
      return { success: false, error: error.message };
    }
  }
}

export default DropItemAtLocationHandler;
