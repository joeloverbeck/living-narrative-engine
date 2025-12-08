/**
 * @file Handler for EQUIP_CLOTHING operation
 *
 * Equips a wearable item onto an entity using the EquipmentOrchestrator, removes
 * the item from inventory, and relocates any displaced/conflicting items to
 * inventory (or the ground as a fallback).
 *
 * Operation flow:
 * 1. Validate parameters (entity_ref, clothing_item_id, optional destination, remove_from_inventory, result_variable)
 * 2. Verify entity has clothing:equipment component
 * 3. Capture currently equipped items to detect displaced conflicts
 * 4. Delegate equipment to EquipmentOrchestrator
 * 5. Remove equipped item from inventory when requested
 * 6. Place displaced/conflicting items per destination
 * 7. Store success flag in result_variable (when provided)
 *
 * Related files:
 * @see data/schemas/operations/equipClothing.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - EquipClothingHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments ComponentOperationHandler
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../clothing/orchestration/equipmentOrchestrator.js').EquipmentOrchestrator} EquipmentOrchestrator */

import ComponentOperationHandler from './componentOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';

/**
 * @typedef {object} EquipClothingOperationParams
 * @property {'actor'|'target'|string} entity_ref - Entity to equip to
 * @property {string} clothing_item_id - ID of the clothing item to equip
 * @property {string} [destination] - Where to place displaced/conflicting items: 'inventory' or 'ground'
 * @property {boolean} [remove_from_inventory] - Whether to remove the equipped item from inventory (default true)
 * @property {string} [result_variable] - Optional variable name to store a boolean success flag
 */

class EquipClothingHandler extends ComponentOperationHandler {
  /** @type {EntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;
  /** @type {EquipmentOrchestrator} */ #equipmentOrchestrator;

  /**
   * @param {object} deps - Dependencies
   * @param {EntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   * @param {EquipmentOrchestrator} deps.equipmentOrchestrator
   */
  constructor({
    entityManager,
    logger,
    safeEventDispatcher,
    equipmentOrchestrator,
  }) {
    super('EquipClothingHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'addComponent', 'hasComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
      equipmentOrchestrator: {
        value: equipmentOrchestrator,
        requiredMethods: ['orchestrateEquipment'],
      },
    });

    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#equipmentOrchestrator = equipmentOrchestrator;
  }

  /**
   * Executes an EQUIP_CLOTHING operation
   *
   * @param {EquipClothingOperationParams|null|undefined} params
   * @param {ExecutionContext} executionContext
   */
  async execute(params, executionContext) {
    const logger = this.getLogger(executionContext);

    if (!assertParamsObject(params, logger, 'EQUIP_CLOTHING')) {
      this.#writeResult(params?.result_variable, false, executionContext, logger);
      return;
    }

    const {
      entity_ref,
      clothing_item_id,
      destination = 'inventory',
      remove_from_inventory = true,
      result_variable,
    } = params;

    const entityId = this.validateEntityRef(
      entity_ref,
      logger,
      'EQUIP_CLOTHING',
      executionContext
    );
    if (!entityId) {
      this.#writeResult(result_variable, false, executionContext, logger);
      return;
    }

    if (!clothing_item_id || typeof clothing_item_id !== 'string') {
      logger.warn(
        'EQUIP_CLOTHING: clothing_item_id must be a non-empty string',
        { clothing_item_id }
      );
      this.#writeResult(result_variable, false, executionContext, logger);
      return;
    }

    if (destination !== 'inventory' && destination !== 'ground') {
      logger.warn(
        `EQUIP_CLOTHING: Invalid destination "${destination}". Must be "inventory" or "ground"`,
        { destination }
      );
      this.#writeResult(result_variable, false, executionContext, logger);
      return;
    }

    if (!this.#entityManager.hasComponent(entityId, 'clothing:equipment')) {
      logger.warn(
        `EQUIP_CLOTHING: Entity "${entityId}" does not have clothing:equipment component`
      );
      this.#writeResult(result_variable, false, executionContext, logger);
      return;
    }

    const equippedBefore = this.#getEquippedSet(entityId);

    try {
      const equipResult = await this.#equipmentOrchestrator.orchestrateEquipment(
        {
          entityId,
          clothingItemId: clothing_item_id,
        }
      );

      if (!equipResult?.success) {
        logger.warn(
          `EQUIP_CLOTHING: Failed to equip "${clothing_item_id}" on "${entityId}"`,
          { errors: equipResult?.errors }
        );
        this.#writeResult(result_variable, false, executionContext, logger);
        return;
      }

      if (remove_from_inventory) {
        await this.#removeFromInventory(entityId, clothing_item_id, logger);
      }

      const displaced = this.#findDisplacedItems(entityId, equippedBefore);
      for (const displacedId of displaced) {
        await this.#placeDisplacedItem(
          entityId,
          displacedId,
          destination,
          logger
        );
      }

      logger.debug(
        `EQUIP_CLOTHING: Equipped "${clothing_item_id}" on "${entityId}"`,
        { displaced }
      );
      this.#writeResult(result_variable, true, executionContext, logger);
    } catch (error) {
      safeDispatchError(
        this.#dispatcher,
        'EQUIP_CLOTHING: Error during equipment operation',
        {
          error: error.message,
          stack: error.stack,
          entityId,
          clothingItemId: clothing_item_id,
        },
        logger
      );
      this.#writeResult(result_variable, false, executionContext, logger);
    }
  }

  /**
   * Writes boolean result to context when a result variable is provided.
   *
   * @private
   */
  #writeResult(resultVariable, value, executionContext, logger) {
    if (!resultVariable) {
      return;
    }

    tryWriteContextVariable(
      resultVariable,
      value,
      executionContext,
      this.#dispatcher,
      logger
    );
  }

  /**
   * Flattens equipped items to a Set of item IDs.
   *
   * @private
   */
  #getEquippedSet(entityId) {
    const equipped = new Set();
    const equipment = this.#entityManager.getComponentData(
      entityId,
      'clothing:equipment'
    );

    if (!equipment?.equipped) {
      return equipped;
    }

    for (const slot of Object.values(equipment.equipped)) {
      if (slot && typeof slot === 'object') {
        for (const itemId of Object.values(slot)) {
          if (typeof itemId === 'string') {
            equipped.add(itemId);
          }
        }
      }
    }

    return equipped;
  }

  /**
   * Calculates which items were removed from equipment during the operation.
   *
   * @private
   */
  #findDisplacedItems(entityId, equippedBefore) {
    const equippedAfter = this.#getEquippedSet(entityId);
    const displaced = [];

    equippedBefore.forEach((itemId) => {
      if (!equippedAfter.has(itemId)) {
        displaced.push(itemId);
      }
    });

    return displaced;
  }

  /**
   * Removes a clothing item from any known inventory component.
   *
   * @private
   */
  async #removeFromInventory(entityId, itemId, logger) {
    const removedFromItemsInventory = await this.#stripFromInventoryComponent(
      entityId,
      itemId,
      'items:inventory',
      logger
    );
    const removedFromCoreInventory = await this.#stripFromInventoryComponent(
      entityId,
      itemId,
      'core:inventory',
      logger
    );

    if (!removedFromItemsInventory && !removedFromCoreInventory) {
      logger.debug(
        `EQUIP_CLOTHING: Item "${itemId}" not found in inventories for "${entityId}"`
      );
    }
  }

  /**
   * Places a displaced item based on destination preference.
   *
   * @private
   */
  async #placeDisplacedItem(entityId, itemId, destination, logger) {
    if (destination === 'inventory') {
      const added =
        (await this.#addToInventory(entityId, itemId, 'items:inventory', logger)) ||
        (await this.#addToInventory(entityId, itemId, 'core:inventory', logger));

      if (added) {
        return;
      }
    }

    await this.#placeOnGround(entityId, itemId, logger);
  }

  /**
   * Removes an item from a specific inventory component if present.
   *
   * @private
   */
  async #stripFromInventoryComponent(entityId, itemId, componentId, logger) {
    if (!this.#entityManager.hasComponent(entityId, componentId)) {
      return false;
    }

    const inventory = this.#entityManager.getComponentData(
      entityId,
      componentId
    );
    if (!inventory?.items || !Array.isArray(inventory.items)) {
      return false;
    }

    if (!inventory.items.includes(itemId)) {
      return false;
    }

    const updated = {
      ...inventory,
      items: inventory.items.filter((id) => id !== itemId),
    };
    await this.#entityManager.addComponent(entityId, componentId, updated);
    logger.debug(
      `EQUIP_CLOTHING: Removed "${itemId}" from ${componentId} of "${entityId}"`
    );
    return true;
  }

  /**
   * Adds an item to inventory if the component exists.
   *
   * @private
   */
  async #addToInventory(entityId, itemId, componentId, logger) {
    if (!this.#entityManager.hasComponent(entityId, componentId)) {
      return false;
    }

    const inventory = this.#entityManager.getComponentData(
      entityId,
      componentId
    );
    if (!inventory?.items || !Array.isArray(inventory.items)) {
      return false;
    }

    if (inventory.items.includes(itemId)) {
      return true;
    }

    const updated = { ...inventory, items: [...inventory.items, itemId] };
    await this.#entityManager.addComponent(entityId, componentId, updated);
    logger.debug(
      `EQUIP_CLOTHING: Added "${itemId}" to ${componentId} of "${entityId}"`
    );
    return true;
  }

  /**
   * Places an item at the actor's location.
   *
   * @private
   */
  async #placeOnGround(entityId, itemId, logger) {
    const position = this.#entityManager.getComponentData(
      entityId,
      'core:position'
    );
    if (!position?.locationId) {
      logger.warn(
        `EQUIP_CLOTHING: Unable to place "${itemId}" on ground - missing core:position for "${entityId}"`
      );
      return;
    }

    await this.#entityManager.addComponent(itemId, 'core:position', {
      locationId: position.locationId,
    });
    logger.debug(
      `EQUIP_CLOTHING: Placed "${itemId}" on ground at "${position.locationId}"`
    );
  }
}

export default EquipClothingHandler;
