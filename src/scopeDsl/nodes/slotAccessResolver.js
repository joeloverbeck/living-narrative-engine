/**
 * @file Handles access to specific clothing slots after clothing field resolution
 * @description Processes slot access like .torso_upper, .legs from clothing access objects
 * enabling syntax: actor.topmost_clothing.torso_upper
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Creates a slot access resolver for handling clothing slot-specific access
 *
 * @param {object} dependencies - Injected dependencies
 * @param {object} dependencies.entitiesGateway - Gateway for entity data access
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
export default function createSlotAccessResolver({ entitiesGateway }) {
  validateDependency(entitiesGateway, 'entitiesGateway');

  const CLOTHING_SLOTS = [
    'torso_upper',
    'torso_lower',
    'legs',
    'feet',
    'head_gear',
    'hands',
    'left_arm_clothing',
    'right_arm_clothing',
  ];

  const LAYER_PRIORITY = {
    topmost: ['outer', 'base', 'underwear'],
    all: ['outer', 'base', 'underwear', 'accessories'],
    outer: ['outer'],
    base: ['base'],
    underwear: ['underwear'],
  };

  /**
   * Checks if this resolver can handle the given node
   *
   * @param {object} node - The node to check
   * @returns {boolean} True if node is a Step node with a clothing slot field
   */
  function canResolve(node) {
    if (!node || node.type !== 'Step' || !node.field) {
      return false;
    }
    // Only handle clothing slots if the parent is a clothing access step
    // This prevents interference with direct component property access
    if (
      node.parent &&
      node.parent.type === 'Step' &&
      (node.parent.field === 'topmost_clothing' ||
        node.parent.field === 'all_clothing' ||
        node.parent.field === 'outer_clothing' ||
        node.parent.field === 'base_clothing' ||
        node.parent.field === 'underwear')
    ) {
      return CLOTHING_SLOTS.includes(node.field);
    }
    return false;
  }

  /**
   * Resolves slot access from a clothing access object
   *
   * @param {object} clothingAccess - The clothing access object from ClothingStepResolver
   * @param {string} slotName - The slot name to access
   * @param {object} trace - Optional trace logger
   * @returns {string|null} The entity ID of the item in the slot or null
   */
  function resolveSlotAccess(clothingAccess, slotName, trace) {
    const { equipped, mode } = clothingAccess;
    const slotData = equipped[slotName];

    if (!slotData) {
      if (trace) {
        trace.addLog(
          'info',
          `SlotAccessResolver: No data found for slot ${slotName}`,
          'SlotAccessResolver',
          { slotName }
        );
      }
      return null;
    }

    const layers = LAYER_PRIORITY[mode] || LAYER_PRIORITY.topmost;

    for (const layer of layers) {
      if (slotData[layer]) {
        if (trace) {
          trace.addLog(
            'info',
            `SlotAccessResolver: Found item in slot ${slotName}, layer ${layer}`,
            'SlotAccessResolver',
            { slotName, layer, itemId: slotData[layer] }
          );
        }
        return slotData[layer];
      }
    }

    return null;
  }

  /**
   * Adds a value to the result set, handling various data types
   *
   * @param {Set} resultSet - The result set to add to
   * @param {any} data - The data to add
   */
  function addToResultSet(resultSet, data) {
    if (Array.isArray(data)) {
      data.forEach((item) => resultSet.add(item));
    } else if (typeof data === 'string') {
      resultSet.add(data);
    } else if (data !== null && data !== undefined) {
      resultSet.add(data);
    }
  }

  /**
   * Resolves a Step node for clothing slot access
   *
   * @param {object} node - The Step node to resolve
   * @param {object} ctx - Resolution context
   * @returns {Set} Set of resolved values
   */
  function resolve(node, ctx) {
    const { field, parent } = node;
    const parentResults = ctx.dispatcher.resolve(parent, ctx);
    const resultSet = new Set();

    if (ctx.trace) {
      ctx.trace.addLog(
        'info',
        `SlotAccessResolver: Processing slot ${field}`,
        'SlotAccessResolver',
        { field, parentResultsSize: parentResults.size }
      );
    }

    for (const item of parentResults) {
      // Handle arrays that might contain clothing access objects
      if (Array.isArray(item)) {
        for (const subItem of item) {
          if (
            typeof subItem === 'object' &&
            subItem !== null &&
            subItem.__clothingSlotAccess
          ) {
            const slotItem = resolveSlotAccess(subItem, field, ctx.trace);
            if (slotItem) {
              resultSet.add(slotItem);
            }
          }
        }
      } else if (
        typeof item === 'object' &&
        item !== null &&
        item.__clothingSlotAccess
      ) {
        // This is a clothing slot access object from ClothingStepResolver
        const slotItem = resolveSlotAccess(item, field, ctx.trace);
        if (slotItem) {
          resultSet.add(slotItem);
        }
      } else if (typeof item === 'string') {
        // Regular entity - try to access component field (backward compatibility)
        const componentData = entitiesGateway.getComponentData(item, field);
        if (componentData !== null && componentData !== undefined) {
          addToResultSet(resultSet, componentData);
        }
      }
    }

    if (ctx.trace) {
      ctx.trace.addLog(
        'info',
        `SlotAccessResolver: Resolution complete, found ${resultSet.size} items`,
        'SlotAccessResolver',
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
