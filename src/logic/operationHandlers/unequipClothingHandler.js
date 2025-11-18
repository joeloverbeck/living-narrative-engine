/**
 * @file Handler for UNEQUIP_CLOTHING operation
 *
 * Manages removal of equipped clothing items using the EquipmentOrchestrator service,
 * with support for cascade unequipment and configurable item placement destinations.
 *
 * Operation flow:
 * 1. Validate parameters (entity_ref, clothing_item_id, optional cascade_unequip, destination)
 * 2. Verify entity has clothing:equipment component
 * 3. Orchestrate unequipment via EquipmentOrchestrator (handles layering rules)
 * 4. Place unequipped item in inventory or on ground based on destination
 * 5. Handle errors with safe error dispatcher
 *
 * Related files:
 * @see data/schemas/operations/unequipClothing.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - UnequipClothingHandler token
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

/**
 * @typedef {object} UnequipClothingOperationParams
 * @property {'actor'|'target'|string} entity_ref - Entity to unequip from
 * @property {string} clothing_item_id - ID of the clothing item to remove
 * @property {boolean} [cascade_unequip] - Whether to unequip dependent layers
 * @property {string} [destination] - Where to place the item: 'inventory' or 'ground'
 */

/**
 * Handler for UNEQUIP_CLOTHING operations
 *
 * @implements {OperationHandler}
 */
class UnequipClothingHandler extends ComponentOperationHandler {
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
    super('UnequipClothingHandler', {
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
        requiredMethods: ['orchestrateUnequipment'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#equipmentOrchestrator = equipmentOrchestrator;
  }

  /**
   * Executes an UNEQUIP_CLOTHING operation
   *
   * @param {UnequipClothingOperationParams|null|undefined} params
   * @param {ExecutionContext} executionContext
   */
  async execute(params, executionContext) {
    const logger = this.getLogger(executionContext);

    // Validate base params
    if (!assertParamsObject(params, logger, 'UNEQUIP_CLOTHING')) {
      return;
    }

    const {
      entity_ref,
      clothing_item_id,
      cascade_unequip = false,
      destination = 'inventory',
    } = params;

    // Validate entity reference
    const entityId = this.validateEntityRef(
      entity_ref,
      logger,
      'UNEQUIP_CLOTHING',
      executionContext
    );
    if (!entityId) {
      return;
    }

    // Validate clothing_item_id
    if (!clothing_item_id || typeof clothing_item_id !== 'string') {
      logger.warn(
        'UNEQUIP_CLOTHING: clothing_item_id must be a non-empty string'
      );
      return;
    }

    // Validate destination
    if (destination !== 'inventory' && destination !== 'ground') {
      logger.warn(
        `UNEQUIP_CLOTHING: Invalid destination "${destination}". Must be "inventory" or "ground"`
      );
      return;
    }

    try {
      // Check if entity has equipment component
      if (!this.#entityManager.hasComponent(entityId, 'clothing:equipment')) {
        logger.warn(
          `UNEQUIP_CLOTHING: Entity "${entityId}" does not have clothing:equipment component`
        );
        return;
      }

      // Use EquipmentOrchestrator to handle the unequipment
      const result = await this.#equipmentOrchestrator.orchestrateUnequipment({
        entityId,
        clothingItemId: clothing_item_id,
        cascadeUnequip: cascade_unequip,
        reason: 'manual',
      });

      if (!result.success) {
        logger.warn(
          `UNEQUIP_CLOTHING: Failed to unequip "${clothing_item_id}" from "${entityId}"`,
          { errors: result.errors }
        );
        return;
      }

      // Handle item placement based on destination
      await this.#handleItemPlacement(
        entityId,
        clothing_item_id,
        destination,
        logger
      );

      logger.debug(
        `UNEQUIP_CLOTHING: Successfully unequipped "${clothing_item_id}" from "${entityId}"`
      );
    } catch (error) {
      safeDispatchError(
        this.#dispatcher,
        'UNEQUIP_CLOTHING: Error during unequipment operation',
        {
          error: error.message,
          stack: error.stack,
          entityId,
          clothingItemId: clothing_item_id,
        }
      );
    }
  }

  /**
   * Handle placement of unequipped item
   *
   * @private
   */
  async #handleItemPlacement(entityId, clothingItemId, destination, logger) {
    if (destination === 'inventory') {
      // Check if entity has inventory
      if (this.#entityManager.hasComponent(entityId, 'core:inventory')) {
        // Add to inventory
        const inventory = this.#entityManager.getComponentData(
          entityId,
          'core:inventory'
        );
        if (inventory && Array.isArray(inventory.items)) {
          inventory.items.push(clothingItemId);
          await this.#entityManager.addComponent(
            entityId,
            'core:inventory',
            inventory
          );
          logger.debug(`Placed "${clothingItemId}" in inventory`);
        }
      } else {
        // Fallback to ground
        logger.debug(
          `Entity has no inventory, placing "${clothingItemId}" on ground`
        );
        await this.#placeOnGround(entityId, clothingItemId, logger);
      }
    } else {
      // Place on ground
      await this.#placeOnGround(entityId, clothingItemId, logger);
    }
  }

  /**
   * Place item on ground at entity's location
   *
   * @private
   */
  async #placeOnGround(entityId, clothingItemId, logger) {
    // Get entity's position
    const position = this.#entityManager.getComponentData(
      entityId,
      'core:position'
    );
    if (position && position.locationId) {
      // Update clothing item's position
      await this.#entityManager.addComponent(clothingItemId, 'core:position', {
        locationId: position.locationId,
      });
      logger.debug(
        `Placed "${clothingItemId}" at location "${position.locationId}"`
      );
    }
  }
}

export default UnequipClothingHandler;
