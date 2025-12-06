/**
 * @file EquipmentOrchestrator - Coordinates complex clothing equipment workflows
 *
 * Manages the orchestration of clothing equipment operations, including validation,
 * conflict resolution, and integration with the anatomy system.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../validation/layerCompatibilityService.js').LayerCompatibilityService} LayerCompatibilityService */

/**
 * Orchestrates complex clothing equipment workflows
 *
 * Coordinates validation, conflict resolution, and equipment operations
 * across multiple domain services while maintaining system integrity.
 */
export class EquipmentOrchestrator {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;
  /** @type {ISafeEventDispatcher} */
  #eventDispatcher;
  /** @type {LayerCompatibilityService} */
  #layerService;

  /**
   * Creates an instance of EquipmentOrchestrator
   *
   * @param {object} deps - Constructor dependencies
   * @param {IEntityManager} deps.entityManager - Entity manager for entity operations
   * @param {ILogger} deps.logger - Logger instance
   * @param {ISafeEventDispatcher} deps.eventDispatcher - Event dispatcher for system events
   * @param {LayerCompatibilityService} deps.layerCompatibilityService - Layer validation service
   */
  constructor({
    entityManager,
    logger,
    eventDispatcher,
    layerCompatibilityService,
  }) {
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(logger, 'ILogger');
    validateDependency(eventDispatcher, 'ISafeEventDispatcher');
    validateDependency(layerCompatibilityService, 'LayerCompatibilityService');

    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#eventDispatcher = eventDispatcher;
    this.#layerService = layerCompatibilityService;
  }

  /**
   * Orchestrates the equipment of a clothing item
   *
   * @param {object} request - Equipment request
   * @param {string} request.entityId - Entity to equip item on
   * @param {string} request.clothingItemId - Clothing item to equip
   * @param {string} [request.layer] - Force specific layer
   * @returns {Promise<{success: boolean, equipped?: boolean, conflicts?: object[], errors?: string[]}>}
   */
  async orchestrateEquipment(request) {
    const { entityId, clothingItemId, layer } = request;

    try {
      this.#logger.debug(
        `EquipmentOrchestrator: Starting equipment orchestration for '${clothingItemId}' on '${entityId}'`
      );

      // Step 1: Validate basic requirements
      const basicValidation = await this.#validateBasicRequirements(
        entityId,
        clothingItemId
      );
      if (!basicValidation.valid) {
        return {
          success: false,
          errors: basicValidation.errors,
        };
      }

      // Step 2: Determine target layer and slot
      const clothingData = this.#entityManager.getComponentData(
        clothingItemId,
        'clothing:wearable'
      );
      if (!clothingData) {
        return {
          success: false,
          errors: [`Item '${clothingItemId}' is not wearable`],
        };
      }
      if (
        !clothingData.equipmentSlots ||
        !clothingData.equipmentSlots.primary
      ) {
        return {
          success: false,
          errors: [
            `Item '${clothingItemId}' has invalid equipment slot configuration`,
          ],
        };
      }
      const targetLayer = layer || clothingData.layer;
      const targetSlot = clothingData.equipmentSlots.primary;

      // Step 4: Check for layer conflicts
      const conflictResult = await this.#layerService.checkLayerConflicts(
        entityId,
        clothingItemId,
        targetLayer,
        targetSlot
      );

      // Step 5: Auto-remove conflicts if any
      if (conflictResult.hasConflicts) {
        const resolutionResult = await this.#autoRemoveConflicts(
          entityId,
          conflictResult.conflicts
        );

        if (!resolutionResult.success) {
          return {
            success: false,
            conflicts: conflictResult.conflicts,
            errors: resolutionResult.errors,
          };
        }
      }

      // Step 6: Perform the actual equipment
      const equipResult = await this.#performEquipment(
        entityId,
        clothingItemId,
        targetLayer,
        targetSlot
      );

      if (equipResult.success) {
        // Step 7: Dispatch success event
        await this.#eventDispatcher.dispatch('clothing:equipped', {
          entityId,
          clothingItemId,
          slotId: targetSlot,
          layer: targetLayer,
          previousItem: equipResult.previousItem,
          conflictResolution: conflictResult.hasConflicts
            ? 'auto_remove'
            : null,
          timestamp: Date.now(),
        });

        this.#logger.debug(
          `EquipmentOrchestrator: Successfully equipped '${clothingItemId}' on '${entityId}' in layer '${targetLayer}'`
        );
      }

      return equipResult;
    } catch (error) {
      this.#logger.error(
        `EquipmentOrchestrator: Error orchestrating equipment for '${clothingItemId}' on '${entityId}'`,
        { error }
      );
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Orchestrates the unequipment of a clothing item
   *
   * @param {object} request - Unequipment request
   * @param {string} request.entityId - Entity to unequip item from
   * @param {string} request.clothingItemId - Clothing item to unequip
   * @param {boolean} [request.cascadeUnequip] - Whether to unequip dependent layers
   * @param {string} [request.reason] - Reason for unequipping
   * @returns {Promise<{success: boolean, unequipped?: boolean, cascadeItems?: string[], errors?: string[]}>}
   */
  async orchestrateUnequipment(request) {
    const {
      entityId,
      clothingItemId,
      cascadeUnequip = false,
      reason = 'manual',
    } = request;

    try {
      this.#logger.debug(
        `EquipmentOrchestrator: Starting unequipment orchestration for '${clothingItemId}' from '${entityId}'`
      );

      // Step 1: Find current equipment slot and layer
      const currentEquipment = await this.#findCurrentEquipment(
        entityId,
        clothingItemId
      );
      if (!currentEquipment.found) {
        return {
          success: false,
          errors: ['Item is not currently equipped'],
        };
      }

      // Step 2: Check for cascade dependencies if needed
      const cascadeItems = [];
      if (cascadeUnequip) {
        const dependencies = await this.#layerService.findDependentItems(
          entityId,
          currentEquipment.slotId,
          currentEquipment.layer
        );
        cascadeItems.push(...dependencies);
      }

      // Step 3: Perform unequipment (cascade first, then target)
      let totalUnequipped = 0;
      for (const cascadeItemId of cascadeItems) {
        const unequipResult = await this.#performUnequipment(
          entityId,
          cascadeItemId,
          reason
        );
        if (unequipResult.success) {
          totalUnequipped++;
        }
      }

      // Step 4: Unequip the target item
      const targetUnequipResult = await this.#performUnequipment(
        entityId,
        clothingItemId,
        reason
      );

      if (targetUnequipResult.success) {
        totalUnequipped++;

        // Step 5: Dispatch success event
        await this.#eventDispatcher.dispatch('clothing:unequipped', {
          entityId,
          clothingItemId,
          slotId: currentEquipment.slotId,
          layer: currentEquipment.layer,
          reason,
          cascadeCount: cascadeItems.length,
          timestamp: Date.now(),
        });

        this.#logger.debug(
          `EquipmentOrchestrator: Successfully unequipped '${clothingItemId}' from '${entityId}' (cascade: ${cascadeItems.length})`
        );

        return {
          success: true,
          unequipped: true,
          cascadeItems,
        };
      }

      return {
        success: false,
        errors: targetUnequipResult.errors || ['Failed to unequip target item'],
      };
    } catch (error) {
      this.#logger.error(
        `EquipmentOrchestrator: Error orchestrating unequipment for '${clothingItemId}' from '${entityId}'`,
        { error }
      );
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Validates equipment compatibility without performing the equipment
   *
   * @param {object} request - Validation request
   * @param {string} request.entityId - Entity to validate for
   * @param {string} request.clothingItemId - Clothing item to validate
   * @returns {Promise<{valid: boolean, errors?: string[], warnings?: string[], compatibility?: object}>}
   */
  async validateEquipmentCompatibility(request) {
    const { entityId, clothingItemId } = request;

    try {
      const errors = [];
      const warnings = [];
      const compatibility = {};

      // Basic validation
      const basicValidation = await this.#validateBasicRequirements(
        entityId,
        clothingItemId
      );
      if (!basicValidation.valid) {
        errors.push(...basicValidation.errors);
      }

      // Layer compatibility - only proceed if basic validation passed
      if (errors.length === 0) {
        const clothingData = this.#entityManager.getComponentData(
          clothingItemId,
          'clothing:wearable'
        );
        if (
          clothingData &&
          clothingData.equipmentSlots &&
          clothingData.equipmentSlots.primary
        ) {
          const conflictResult = await this.#layerService.checkLayerConflicts(
            entityId,
            clothingItemId,
            clothingData.layer,
            clothingData.equipmentSlots.primary
          );
          compatibility.layers = conflictResult;
          if (conflictResult.hasConflicts) {
            warnings.push(
              `${conflictResult.conflicts.length} layer conflict(s) detected`
            );
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        compatibility,
      };
    } catch (error) {
      this.#logger.error(
        `EquipmentOrchestrator: Error validating compatibility for '${clothingItemId}' on '${entityId}'`,
        { error }
      );
      return {
        valid: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Validates basic requirements for equipment operation
   *
   * @param entityId
   * @param clothingItemId
   * @private
   */
  async #validateBasicRequirements(entityId, clothingItemId) {
    const errors = [];

    // Check entity exists
    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      errors.push(`Entity '${entityId}' not found`);
    }

    // Check clothing item exists
    const clothingItem = this.#entityManager.getEntityInstance(clothingItemId);
    if (!clothingItem) {
      errors.push(`Clothing item '${clothingItemId}' not found`);
    }

    // Check clothing item has wearable component
    const wearableData = this.#entityManager.getComponentData(
      clothingItemId,
      'clothing:wearable'
    );
    if (!wearableData) {
      errors.push(`Item '${clothingItemId}' is not wearable`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Automatically removes conflicting items
   *
   * @param entityId
   * @param conflicts
   * @private
   */
  async #autoRemoveConflicts(entityId, conflicts) {
    const removedItems = [];
    const errors = [];

    for (const conflict of conflicts) {
      try {
        // Skip layer requirement conflicts - these can't be resolved by removing items
        if (conflict.type === 'layer_requirement') {
          errors.push(
            `Cannot equip item: ${conflict.details || `Missing required ${conflict.requiredLayer} layer`}`
          );
          continue;
        }

        const itemId = conflict.conflictingItemId || conflict.itemId;

        // Check if we have a valid item ID to remove
        if (!itemId) {
          errors.push(
            `Cannot resolve conflict: No item specified for ${conflict.type} conflict`
          );
          continue;
        }

        const unequipResult = await this.#performUnequipment(
          entityId,
          itemId,
          'conflict_resolution'
        );
        if (unequipResult.success) {
          removedItems.push(itemId);
        } else {
          errors.push(`Failed to remove conflicting item '${itemId}'`);
        }
      } catch (error) {
        const itemId = conflict.conflictingItemId || conflict.itemId;
        errors.push(
          `Error removing conflicting item '${itemId || 'unknown'}': ${error.message}`
        );
      }
    }

    return {
      success: errors.length === 0,
      removedItems,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Performs the actual equipment operation
   *
   * @param entityId
   * @param clothingItemId
   * @param layer
   * @param slotId
   * @private
   */
  async #performEquipment(entityId, clothingItemId, layer, slotId) {
    try {
      // Get or create equipment component
      let equipmentData = this.#entityManager.getComponentData(
        entityId,
        'clothing:equipment'
      );
      if (!equipmentData) {
        equipmentData = { equipped: {} };
      }

      // Initialize slot if needed
      if (!equipmentData.equipped[slotId]) {
        equipmentData.equipped[slotId] = {};
      }

      // Store previous item if any
      const previousItem = equipmentData.equipped[slotId][layer] || null;

      // Equip new item
      equipmentData.equipped[slotId][layer] = clothingItemId;

      // Update entity component
      await this.#entityManager.addComponent(
        entityId,
        'clothing:equipment',
        equipmentData
      );

      return {
        success: true,
        equipped: true,
        previousItem,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Performs the actual unequipment operation
   *
   * @param entityId
   * @param clothingItemId
   * @param reason
   * @private
   */
  async #performUnequipment(entityId, clothingItemId, reason) {
    try {
      const equipmentData = this.#entityManager.getComponentData(
        entityId,
        'clothing:equipment'
      );
      if (!equipmentData?.equipped) {
        return {
          success: false,
          errors: ['No equipment data found'],
        };
      }

      // Find and remove the item
      let found = false;
      for (const slotId in equipmentData.equipped) {
        for (const layer in equipmentData.equipped[slotId]) {
          if (equipmentData.equipped[slotId][layer] === clothingItemId) {
            delete equipmentData.equipped[slotId][layer];
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        return {
          success: false,
          errors: ['Item not found in equipment'],
        };
      }

      // Update entity component
      await this.#entityManager.addComponent(
        entityId,
        'clothing:equipment',
        equipmentData
      );

      return {
        success: true,
        unequipped: true,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Finds current equipment slot and layer for an item
   *
   * @param entityId
   * @param clothingItemId
   * @private
   */
  async #findCurrentEquipment(entityId, clothingItemId) {
    const equipmentData = this.#entityManager.getComponentData(
      entityId,
      'clothing:equipment'
    );
    if (!equipmentData?.equipped) {
      return { found: false };
    }

    for (const slotId in equipmentData.equipped) {
      for (const layer in equipmentData.equipped[slotId]) {
        if (equipmentData.equipped[slotId][layer] === clothingItemId) {
          return {
            found: true,
            slotId,
            layer,
          };
        }
      }
    }

    return { found: false };
  }
}
