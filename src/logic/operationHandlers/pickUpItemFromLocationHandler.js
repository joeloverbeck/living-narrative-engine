/**
 * @file Operation handler for picking up items from a location
 */

import { assertParamsObject, validateStringParam } from '../../utils/handlerUtils/paramsUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

const INVENTORY_COMPONENT_ID = 'items:inventory';
const POSITION_COMPONENT_ID = 'core:position';
const ITEM_PICKED_UP_EVENT = 'ITEM_PICKED_UP';

/**
 * @typedef {object} PickUpItemParams
 * @property {string} actorEntity – Actor picking up the item
 * @property {string} itemEntity – Item to pick up
 */

/**
 * Picks up an item from a location and adds it to actor's inventory
 */
class PickUpItemFromLocationHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('PickUpItemFromLocationHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'batchAddComponentsOptimized', 'removeComponent'],
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
   * @param {PickUpItemParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{actorEntity: string, itemEntity: string}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'PICK_UP_ITEM_FROM_LOCATION')) {
      return null;
    }

    const { actorEntity, itemEntity } = params;

    const validatedActor = validateStringParam(actorEntity, 'actorEntity', logger, this.#dispatcher);
    const validatedItem = validateStringParam(itemEntity, 'itemEntity', logger, this.#dispatcher);

    if (!validatedActor || !validatedItem) {
      return null;
    }

    return {
      actorEntity: validatedActor,
      itemEntity: validatedItem,
    };
  }

  /**
   * Execute the pick up item operation
   *
   * @param {PickUpItemParams} params - Pick up parameters
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context
   * @returns {Promise<{success: boolean, error?: string}>} Pick up result
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // Validation
    const validated = this.#validateParams(params, log);
    if (!validated) {
      return { success: false, error: 'validation_failed' };
    }

    const { actorEntity, itemEntity } = validated;

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

      // Prepare batch update: add to inventory
      const updates = [
        {
          instanceId: actorEntity,
          componentTypeId: INVENTORY_COMPONENT_ID,
          componentData: {
            ...inventory,
            items: [...inventory.items, itemEntity]
          }
        }
      ];

      // Apply atomically with batch update
      await this.#entityManager.batchAddComponentsOptimized(updates, true);

      // Remove position component (item no longer in world)
      this.#entityManager.removeComponent(itemEntity, POSITION_COMPONENT_ID);

      // Dispatch success event
      this.#dispatcher.dispatch({
        type: ITEM_PICKED_UP_EVENT,
        payload: { actorEntity, itemEntity }
      });

      log.debug(`Item picked up`, { actorEntity, itemEntity });
      return { success: true };

    } catch (error) {
      log.error(`Pick up item failed`, error, { actorEntity, itemEntity });
      return { success: false, error: error.message };
    }
  }
}

export default PickUpItemFromLocationHandler;
