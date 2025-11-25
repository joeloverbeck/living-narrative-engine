/**
 * @file LayerCompatibilityService - Handles clothing layer validation and conflict detection
 *
 * Validates layer compatibility, detects conflicts, and provides resolution strategies
 * for complex multi-layer clothing scenarios.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Service for validating clothing layer compatibility and resolving conflicts
 *
 * Handles complex scenarios involving multiple layers, size constraints,
 * and requirement dependencies between clothing items.
 */
export class LayerCompatibilityService {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;

  /**
   * Layer hierarchy definition (innermost to outermost)
   *
   * @readonly
   */
  static LAYER_ORDER = ['underwear', 'base', 'armor', 'outer', 'accessories'];

  /**
   * Default layer requirements
   *
   * @readonly
   */
  static LAYER_REQUIREMENTS = {
    outer: ['base'], // Outer layer requires base layer
    armor: [], // Armor has no requirements (can be worn directly)
    accessories: [], // Accessories have no requirements
  };

  /**
   * Creates an instance of LayerCompatibilityService
   *
   * @param {object} deps - Constructor dependencies
   * @param {IEntityManager} deps.entityManager - Entity manager for entity operations
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ entityManager, logger }) {
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(logger, 'ILogger');

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Checks for layer conflicts when equipping a new item
   *
   * @param {string} entityId - Entity to check conflicts for
   * @param {string} clothingItemId - New clothing item to check
   * @param {string} targetLayer - Target layer for the new item
   * @param {string} targetSlot - Target equipment slot
   * @returns {Promise<{hasConflicts: boolean, conflicts: object[], resolutionSuggestions?: string[]}>} Conflict detection result
   */
  async checkLayerConflicts(entityId, clothingItemId, targetLayer, targetSlot) {
    try {
      this.#logger.debug(
        `LayerCompatibilityService: Checking layer conflicts for '${clothingItemId}' in layer '${targetLayer}' on '${entityId}'`
      );

      const conflicts = [];
      const resolutionSuggestions = [];

      // Get current equipment
      const equipmentData = this.#entityManager.getComponentData(
        entityId,
        'clothing:equipment'
      );
      if (!equipmentData?.equipped) {
        return { hasConflicts: false, conflicts: [] };
      }

      // Get clothing item data
      const newItemData = this.#entityManager.getComponentData(
        clothingItemId,
        'clothing:wearable'
      );
      if (!newItemData) {
        throw new InvalidArgumentError(
          `Item '${clothingItemId}' is not wearable`
        );
      }

      // Check current slot occupancy
      const slotEquipment = equipmentData.equipped[targetSlot];
      if (slotEquipment) {
        // Check direct layer conflict
        const existingItemId = slotEquipment[targetLayer];
        if (existingItemId && existingItemId !== clothingItemId) {
          conflicts.push({
            type: 'layer_overlap',
            conflictingItemId: existingItemId,
            layer: targetLayer,
            slotId: targetSlot,
            severity: 'high',
          });
          resolutionSuggestions.push(
            `Remove '${existingItemId}' from ${targetLayer} layer`
          );
        }

        // Check layer ordering requirements
        const orderingConflicts = await this.#checkLayerOrdering(
          entityId,
          targetLayer,
          slotEquipment
        );
        conflicts.push(...orderingConflicts);
      }

      // Check global layer requirements
      const requirementConflicts = await this.#checkLayerRequirements(
        entityId,
        targetLayer,
        equipmentData.equipped
      );
      conflicts.push(...requirementConflicts);

      // Check conflicts with secondary slots
      const secondaryConflicts = await this.#checkSecondarySlotConflicts(
        entityId,
        newItemData,
        targetLayer,
        equipmentData.equipped
      );
      conflicts.push(...secondaryConflicts);

      return {
        hasConflicts: conflicts.length > 0,
        conflicts,
        resolutionSuggestions:
          resolutionSuggestions.length > 0 ? resolutionSuggestions : undefined,
      };
    } catch (error) {
      this.#logger.error(
        `LayerCompatibilityService: Error checking layer conflicts for '${clothingItemId}' on '${entityId}'`,
        { error }
      );
      throw error;
    }
  }

  /**
   * Validates layer ordering requirements
   *
   * @param {string} entityId - Entity to validate
   * @param {string} targetLayer - Layer being equipped
   * @param {object} currentEquipment - Current equipment in the slot
   * @returns {Promise<boolean>} True if layer ordering is valid
   */
  async validateLayerOrdering(entityId, targetLayer, currentEquipment) {
    try {
      const targetIndex =
        LayerCompatibilityService.LAYER_ORDER.indexOf(targetLayer);

      if (targetIndex === -1) {
        this.#logger.warn(
          `LayerCompatibilityService: Unknown layer '${targetLayer}'`
        );
        return false;
      }

      // Check if all inner layers have items when outer layers are present
      for (let i = 0; i < targetIndex; i++) {
        const innerLayer = LayerCompatibilityService.LAYER_ORDER[i];

        // Check if this layer is required
        const requirements =
          LayerCompatibilityService.LAYER_REQUIREMENTS[targetLayer] || [];
        if (
          requirements.includes(innerLayer) &&
          !currentEquipment[innerLayer]
        ) {
          this.#logger.debug(
            `LayerCompatibilityService: Missing required inner layer '${innerLayer}' for layer '${targetLayer}'`
          );
          return false;
        }
      }

      return true;
    } catch (error) {
      this.#logger.error(
        `LayerCompatibilityService: Error validating layer ordering for '${targetLayer}' on '${entityId}'`,
        { error }
      );
      return false;
    }
  }

  /**
   * Finds items that depend on a specific layer
   *
   * @param {string} entityId - Entity to check
   * @param {string} slotId - Equipment slot to check
   * @param {string} baseLayer - Base layer that might be removed
   * @returns {Promise<string[]>} Array of dependent item IDs that would need to be removed
   */
  async findDependentItems(entityId, slotId, baseLayer) {
    try {
      const dependentItems = [];
      const equipmentData = this.#entityManager.getComponentData(
        entityId,
        'clothing:equipment'
      );

      if (!equipmentData?.equipped?.[slotId]) {
        return dependentItems;
      }

      const slotEquipment = equipmentData.equipped[slotId];
      const baseLayerIndex =
        LayerCompatibilityService.LAYER_ORDER.indexOf(baseLayer);

      // Find all layers that come after the base layer
      for (
        let i = baseLayerIndex + 1;
        i < LayerCompatibilityService.LAYER_ORDER.length;
        i++
      ) {
        const outerLayer = LayerCompatibilityService.LAYER_ORDER[i];
        const itemId = slotEquipment[outerLayer];

        if (itemId) {
          // Check if this outer layer depends on the base layer
          const requirements =
            LayerCompatibilityService.LAYER_REQUIREMENTS[outerLayer] || [];
          if (requirements.includes(baseLayer)) {
            dependentItems.push(itemId);
          }
        }
      }

      return dependentItems;
    } catch (error) {
      this.#logger.error(
        `LayerCompatibilityService: Error finding dependent items for layer '${baseLayer}' in slot '${slotId}' on '${entityId}'`,
        { error }
      );
      return [];
    }
  }

  /**
   * Suggests conflict resolution strategies
   *
   * @param {object[]} conflicts - Array of conflict objects
   * @returns {object[]} Array of resolution strategy objects
   */
  async suggestResolutions(conflicts) {
    const strategies = [];

    for (const conflict of conflicts) {
      switch (conflict.type) {
        case 'layer_overlap':
          strategies.push({
            type: 'auto_remove',
            target: conflict.conflictingItemId,
            description: `Automatically remove conflicting item from ${conflict.layer} layer`,
            priority: conflict.severity === 'high' ? 1 : 2,
          });
          break;

        case 'size_mismatch':
          strategies.push({
            type: 'size_adjust',
            target: conflict.conflictingItemId,
            description: 'Consider different size or adjust fit',
            priority: 3,
          });
          break;

        case 'layer_requirement':
          strategies.push({
            type: 'equip_required',
            target: conflict.requiredLayer,
            description: `Equip required ${conflict.requiredLayer} layer item first`,
            priority: 1,
          });
          break;

        case 'ordering_violation':
          strategies.push({
            type: 'reorder_layers',
            description: 'Adjust layer ordering to maintain hierarchy',
            priority: 2,
          });
          break;

        default:
          strategies.push({
            type: 'manual_review',
            description: 'Manual review required for this conflict type',
            priority: 4,
          });
      }
    }

    // Sort by priority (lower number = higher priority)
    return strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Checks layer ordering requirements
   *
   * @param {string} entityId - Entity to check ordering for
   * @param {string} targetLayer - Layer being equipped
   * @param {object} slotEquipment - Current equipment in the slot
   * @returns {Promise<object[]>} Array of ordering conflicts
   * @private
   */
  async #checkLayerOrdering(entityId, targetLayer, slotEquipment) {
    const conflicts = [];
    const targetIndex =
      LayerCompatibilityService.LAYER_ORDER.indexOf(targetLayer);

    // Check if there are items in outer layers without proper inner layers
    for (
      let i = targetIndex + 1;
      i < LayerCompatibilityService.LAYER_ORDER.length;
      i++
    ) {
      const outerLayer = LayerCompatibilityService.LAYER_ORDER[i];
      const outerItemId = slotEquipment[outerLayer];

      if (outerItemId) {
        const requirements =
          LayerCompatibilityService.LAYER_REQUIREMENTS[outerLayer] || [];
        if (requirements.includes(targetLayer)) {
          // This would create a valid dependency, no conflict
          continue;
        }
      }
    }

    return conflicts;
  }

  /**
   * Checks global layer requirements
   *
   * @param entityId
   * @param targetLayer
   * @param allEquipment
   * @private
   */
  async #checkLayerRequirements(entityId, targetLayer, allEquipment) {
    const conflicts = [];
    const requirements =
      LayerCompatibilityService.LAYER_REQUIREMENTS[targetLayer] || [];

    for (const requiredLayer of requirements) {
      let hasRequiredLayer = false;

      // Check all slots for the required layer
      for (const slotEquipment of Object.values(allEquipment)) {
        if (slotEquipment[requiredLayer]) {
          hasRequiredLayer = true;
          break;
        }
      }

      if (!hasRequiredLayer) {
        conflicts.push({
          type: 'layer_requirement',
          requiredLayer,
          severity: 'high',
          details: `Layer '${targetLayer}' requires '${requiredLayer}' layer to be present`,
        });
      }
    }

    return conflicts;
  }

  /**
   * Checks conflicts with secondary equipment slots
   *
   * @param entityId
   * @param newItemData
   * @param targetLayer
   * @param allEquipment
   * @private
   */
  async #checkSecondarySlotConflicts(
    entityId,
    newItemData,
    targetLayer,
    allEquipment
  ) {
    const conflicts = [];
    const secondarySlots = newItemData.equipmentSlots.secondary || [];

    for (const secondarySlot of secondarySlots) {
      const secondaryEquipment = allEquipment[secondarySlot];
      if (secondaryEquipment?.[targetLayer]) {
        conflicts.push({
          type: 'secondary_slot_conflict',
          conflictingItemId: secondaryEquipment[targetLayer],
          layer: targetLayer,
          slotId: secondarySlot,
          severity: 'medium',
          details: `Conflict in secondary slot '${secondarySlot}'`,
        });
      }
    }

    return conflicts;
  }
}
