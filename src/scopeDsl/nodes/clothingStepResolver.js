/**
 * @file Specialized resolver for clothing-related step operations
 * @description Handles clothing field access like topmost_clothing, all_clothing, outer_clothing
 * enabling syntax: actor.topmost_clothing[] and actor.topmost_clothing.torso_upper
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Creates a clothing step resolver for handling clothing-specific field access
 *
 * @param {object} dependencies - Injected dependencies
 * @param {object} dependencies.entitiesGateway - Gateway for entity data access
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
export default function createClothingStepResolver({ entitiesGateway }) {
  validateDependency(entitiesGateway, 'entitiesGateway');

  const CLOTHING_FIELDS = {
    topmost_clothing: 'topmost',
    all_clothing: 'all',
    outer_clothing: 'outer',
    base_clothing: 'base',
    underwear: 'underwear',
  };


  /**
   * Checks if this resolver can handle the given node
   *
   * @param {object} node - The node to check
   * @returns {boolean} True if node is a Step node with a clothing field
   */
  function canResolve(node) {
    if (!node || node.type !== 'Step' || !node.field) {
      return false;
    }
    return Object.prototype.hasOwnProperty.call(CLOTHING_FIELDS, node.field);
  }

  /**
   * Resolves a clothing field for an entity
   *
   * @param {string} entityId - The entity ID to resolve clothing for
   * @param {string} field - The clothing field to resolve
   * @param {object} trace - Optional trace logger
   * @returns {any} A clothing access object that can be used for slot access or array iteration
   */
  function resolveClothingField(entityId, field, trace) {
    const equipment = entitiesGateway.getComponentData(
      entityId,
      'clothing:equipment'
    );

    if (!equipment?.equipped) {
      if (trace) {
        trace.addLog(
          'info',
          `ClothingStepResolver: No equipped items found for entity ${entityId} (equipment component: ${equipment ? 'present' : 'missing'})`,
          'ClothingStepResolver',
          { entityId, hasEquipmentComponent: !!equipment }
        );
      }
      // Return empty clothing access object
      return {
        __clothingSlotAccess: true,
        equipped: {},
        mode: CLOTHING_FIELDS[field],
        type: 'clothing_slot_access',
        // For ArrayIterationResolver compatibility
        __isClothingAccessObject: true,
      };
    }

    const mode = CLOTHING_FIELDS[field];

    // Return a clothing access object that can be processed by either:
    // 1. SlotAccessResolver for .slot syntax
    // 2. ArrayIterationResolver for [] syntax
    return {
      __clothingSlotAccess: true,
      equipped: equipment.equipped,
      mode: mode,
      type: 'clothing_slot_access',
      // For ArrayIterationResolver compatibility
      __isClothingAccessObject: true,
    };
  }

  /**
   * Resolves a Step node for clothing field access
   *
   * @param {object} node - The Step node to resolve
   * @param {object} ctx - Resolution context
   * @returns {Set} Set of resolved values
   */
  function resolve(node, ctx) {
    const { field, parent } = node;
    const parentResults = ctx.dispatcher.resolve(parent, ctx);
    const resultSet = new Set();

    // Add trace logging
    if (ctx.trace) {
      ctx.trace.addLog(
        'info',
        `ClothingStepResolver: Processing ${field} field`,
        'ClothingStepResolver',
        { field, parentResultsSize: parentResults.size }
      );
    }

    // Process each parent entity
    for (const entityId of parentResults) {
      if (typeof entityId !== 'string') {
        continue; // Skip non-entity results
      }

      const clothingData = resolveClothingField(entityId, field, ctx.trace);

      // Add the clothing access object to the result set
      // It will be processed by either SlotAccessResolver or ArrayIterationResolver
      resultSet.add(clothingData);
    }

    if (ctx.trace) {
      ctx.trace.addLog(
        'info',
        `ClothingStepResolver: Resolution complete, found ${resultSet.size} items`,
        'ClothingStepResolver',
        { resultSize: resultSet.size }
      );
    }

    return resultSet;
  }

  return {
    canResolve,
    resolve,
  };
}
