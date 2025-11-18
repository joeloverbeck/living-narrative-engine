/**
 * @file Handler for DROP_ITEM_AT_LOCATION operation
 *
 * Drops an item from an actor's inventory at a specified location, making it available for pickup.
 *
 * Operation flow:
 * 1. Validates operation parameters (actorEntity, itemEntity, locationId)
 * 2. Retrieves actor's inventory component and verifies item exists
 * 3. Prepares batch updates: removes item from inventory and sets item position
 * 4. Applies updates atomically using batchAddComponentsOptimized
 * 5. Dispatches items:item_dropped event
 *
 * Related files:
 * @see data/schemas/operations/dropItemAtLocation.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - DropItemAtLocationHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
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

    // Log entry with raw parameters
    log.debug('[DROP_ITEM] Handler invoked', {
      rawParams: params,
      executionContext: executionContext ? 'present' : 'missing',
    });

    // Validation
    const validated = this.#validateParams(params, log);
    if (!validated) {
      log.warn('[DROP_ITEM] Parameter validation failed', {
        rawParams: params,
        validationResult: null,
      });
      return { success: false, error: 'validation_failed' };
    }

    const { actorEntity, itemEntity, locationId } = validated;
    log.debug('[DROP_ITEM] Parameters validated successfully', {
      actorEntity,
      itemEntity,
      locationId,
    });

    try {
      // Get inventory using getComponentData
      log.debug('[DROP_ITEM] Retrieving actor inventory', {
        actorEntity,
        componentType: INVENTORY_COMPONENT_ID,
      });

      const inventory = this.#entityManager.getComponentData(
        actorEntity,
        INVENTORY_COMPONENT_ID
      );

      if (!inventory) {
        log.warn('[DROP_ITEM] No inventory component on actor', {
          actorEntity,
          componentType: INVENTORY_COMPONENT_ID,
        });
        return { success: false, error: 'no_inventory' };
      }

      log.debug('[DROP_ITEM] Inventory retrieved', {
        actorEntity,
        inventoryItems: inventory.items,
        itemCount: inventory.items.length,
        capacity: inventory.capacity,
      });

      if (!inventory.items.includes(itemEntity)) {
        log.warn('[DROP_ITEM] Item not in actor inventory', {
          actorEntity,
          itemEntity,
          currentInventory: inventory.items,
        });
        return { success: false, error: 'item_not_in_inventory' };
      }

      log.debug('[DROP_ITEM] Item confirmed in inventory', {
        itemEntity,
        inventoryItems: inventory.items,
      });

      // Prepare batch updates: remove from inventory and set position
      const newInventoryItems = inventory.items.filter((id) => id !== itemEntity);
      const updates = [
        {
          instanceId: actorEntity,
          componentTypeId: INVENTORY_COMPONENT_ID,
          componentData: {
            ...inventory,
            items: newInventoryItems,
          },
        },
        {
          instanceId: itemEntity,
          componentTypeId: POSITION_COMPONENT_ID,
          componentData: { locationId },
        },
      ];

      log.debug('[DROP_ITEM] Prepared batch updates', {
        updateCount: updates.length,
        inventoryUpdate: {
          instanceId: actorEntity,
          componentType: INVENTORY_COMPONENT_ID,
          oldItems: inventory.items,
          newItems: newInventoryItems,
          removedItem: itemEntity,
        },
        positionUpdate: {
          instanceId: itemEntity,
          componentType: POSITION_COMPONENT_ID,
          locationId,
        },
      });

      // Apply atomically with batch update
      log.debug('[DROP_ITEM] Executing batch update', { updateCount: updates.length });
      const batchResult = await this.#entityManager.batchAddComponentsOptimized(updates, true);
      log.debug('[DROP_ITEM] Batch update completed', {
        batchResult,
        updateCount: updates.length,
      });

      // DIAGNOSTIC: Verify item components after drop (INFO level to avoid browser crash from excessive logs)
      const itemPosition = this.#entityManager.getComponentData(itemEntity, POSITION_COMPONENT_ID);
      const itemItemMarker = this.#entityManager.getComponentData(itemEntity, 'items:item');
      const itemPortableMarker = this.#entityManager.getComponentData(itemEntity, 'items:portable');

      log.info('[DROP_ITEM] POST-DROP VERIFICATION', {
        itemEntity,
        locationId,
        itemPosition,
        hasItemMarker: !!itemItemMarker,
        hasPortableMarker: !!itemPortableMarker,
        allComponents: this.#entityManager.getEntityInstance(itemEntity)?.getComponentTypeIds?.() || 'N/A'
      });

      // Dispatch success event using the event bus signature of (eventId, payload)
      log.debug('[DROP_ITEM] Dispatching item_dropped event', {
        eventType: ITEM_DROPPED_EVENT,
        payload: { actorEntity, itemEntity, locationId },
      });
      this.#dispatcher.dispatch(ITEM_DROPPED_EVENT, {
        actorEntity,
        itemEntity,
        locationId,
      });

      log.debug('[DROP_ITEM] Operation completed successfully', {
        actorEntity,
        itemEntity,
        locationId,
      });
      return { success: true };

    } catch (error) {
      log.error('[DROP_ITEM] Operation failed with exception', error, {
        actorEntity,
        itemEntity,
        locationId,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      return { success: false, error: error.message };
    }
  }
}

export default DropItemAtLocationHandler;
