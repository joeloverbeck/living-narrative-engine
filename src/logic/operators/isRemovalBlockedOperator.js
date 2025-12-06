import { BaseEquipmentOperator } from './base/BaseEquipmentOperator.js';
import {
  resolveEntityPath,
  hasValidEntityId,
} from '../utils/entityPathResolver.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @file IsRemovalBlocked JSON Logic Operator
 * Evaluates whether an item's removal is blocked by other equipped items
 * @see src/scopeDsl/nodes/slotAccessResolver.js
 */

/**
 * IsRemovalBlocked operator evaluates removal blocking constraints
 *
 * Usage in JSON Logic:
 * {
 *   "isRemovalBlocked": [
 *     "actor",          // Entity path to actor wearing the clothing
 *     "targetItem"      // Entity path to item to check for removal blocking
 *   ]
 * }
 *
 * Returns: true if removal is blocked, false if allowed
 */
export class IsRemovalBlockedOperator extends BaseEquipmentOperator {
  /**
   * Creates a new IsRemovalBlockedOperator instance
   *
   * @param {object} dependencies - Required dependencies
   * @param {IEntityManager} dependencies.entityManager - Entity manager for component access
   * @param {ILogger} dependencies.logger - Logger for debugging and error reporting
   */
  constructor({ entityManager, logger }) {
    super({ entityManager, logger }, 'isRemovalBlocked');
  }

  /**
   * Evaluates removal blocking for a target item
   *
   * @protected
   * @param {string} entityId - Actor entity ID wearing the clothing
   * @param {Array} params - [targetItemPath] where targetItemPath is the entity path to the item
   * @param {object} context - Evaluation context
   * @returns {boolean} - true if blocked, false if allowed
   */
  evaluateInternal(entityId, params, context) {
    // Validate parameters
    if (!params || params.length < 1) {
      this.logger.warn(
        `${this.operatorName}: Missing required parameter: targetItemPath`
      );
      return false;
    }

    const [targetItemPath] = params;

    if (!targetItemPath) {
      this.logger.warn(
        `${this.operatorName}: Null or undefined targetItemPath`,
        { targetItemPath }
      );
      return false;
    }

    try {
      // Resolve target item entity from path
      const { entity: targetEntity, isValid } = resolveEntityPath(
        context,
        targetItemPath
      );

      if (!isValid) {
        this.logger.warn(
          `${this.operatorName}: No entity found at path ${targetItemPath}`
        );
        return false;
      }

      const targetItemId = this.#resolveTargetItemId(
        targetEntity,
        targetItemPath
      );

      if (targetItemId === null) {
        return false;
      }

      // Get actor's equipment
      const equipment = this.getEquipmentData(entityId);

      if (!equipment || !equipment.equipped) {
        this.logger.debug(`${this.operatorName}: Actor has no equipment`, {
          actorId: entityId,
        });
        return false;
      }

      // Get target item's wearable data
      const targetWearable = this.entityManager.getComponentData(
        targetItemId,
        'clothing:wearable'
      );

      if (!targetWearable) {
        this.logger.warn(`${this.operatorName}: Target item is not wearable`, {
          targetItemId,
        });
        return false;
      }

      // Check all equipped items for blocking components
      for (const [_slot, layers] of Object.entries(equipment.equipped)) {
        for (const [_layer, items] of Object.entries(layers)) {
          const equippedItems = Array.isArray(items) ? items : [items];

          for (const equippedItemId of equippedItems) {
            // Skip if checking the target item itself
            if (equippedItemId === targetItemId) {
              continue;
            }

            // Check if this equipped item has blocking component
            if (
              !this.entityManager.hasComponent(
                equippedItemId,
                'clothing:blocks_removal'
              )
            ) {
              continue;
            }

            const blocking = this.entityManager.getComponentData(
              equippedItemId,
              'clothing:blocks_removal'
            );

            // Check slot-based blocking
            if (blocking.blockedSlots) {
              if (
                this.#itemIsBlockedBySlotRules(
                  targetWearable,
                  blocking.blockedSlots
                )
              ) {
                this.logger.debug(
                  `${this.operatorName}: Item removal blocked by slot rules`,
                  {
                    targetItemId,
                    blockedBy: equippedItemId,
                  }
                );
                return true;
              }
            }

            // Check explicit item ID blocking
            if (
              blocking.blocksRemovalOf &&
              blocking.blocksRemovalOf.includes(targetItemId)
            ) {
              this.logger.debug(
                `${this.operatorName}: Item removal blocked by explicit ID`,
                {
                  targetItemId,
                  blockedBy: equippedItemId,
                }
              );
              return true;
            }
          }
        }
      }

      return false;
    } catch (err) {
      this.logger.error(
        `${this.operatorName}: Error evaluating IsRemovalBlocked operator`,
        {
          error: err.message,
          actorId: entityId,
          targetItemPath,
        }
      );
      return false;
    }
  }

  /**
   * Resolves a usable entity identifier from the resolved target item entity
   *
   * @private
   * @param {unknown} entity - The resolved entity value from the context
   * @param {string} entityPath - The JSON Logic path used to resolve the entity
   * @returns {string|number|null} A valid entity identifier or null when invalid
   */
  #resolveTargetItemId(entity, entityPath) {
    let entityId = null;

    if (hasValidEntityId(entity)) {
      entityId = /** @type {{id: string|number}} */ (entity).id;
    } else if (typeof entity === 'string' || typeof entity === 'number') {
      entityId = entity;
    } else {
      this.logger.warn(
        `${this.operatorName}: Invalid entity at path ${entityPath}`
      );
      return null;
    }

    if (
      entityId === undefined ||
      entityId === null ||
      (typeof entityId === 'string' && entityId.trim() === '') ||
      (typeof entityId === 'number' && Number.isNaN(entityId))
    ) {
      this.logger.warn(
        `${this.operatorName}: Invalid entity at path ${entityPath}`
      );
      return null;
    }

    return entityId;
  }

  /**
   * Checks if item matches any blocked slot rules
   *
   * @private
   * @param {object} targetWearable - Target item's wearable component
   * @param {Array} blockedSlots - Array of blocking rules
   * @returns {boolean} - true if blocked
   */
  #itemIsBlockedBySlotRules(targetWearable, blockedSlots) {
    const targetSlot = targetWearable.equipmentSlots?.primary;
    const targetLayer = targetWearable.layer;

    if (!targetSlot || !targetLayer) {
      return false;
    }

    for (const rule of blockedSlots) {
      if (rule.slot === targetSlot && rule.layers.includes(targetLayer)) {
        return true;
      }
    }

    return false;
  }
}

export default IsRemovalBlockedOperator;
