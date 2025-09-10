/**
 * @file Specialized resolver for clothing-related step operations
 * @description Handles clothing field access like topmost_clothing, all_clothing, outer_clothing
 * enabling syntax: actor.topmost_clothing[] and actor.topmost_clothing.torso_upper
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ErrorCodes } from '../constants/errorCodes.js';

/**
 * Creates a clothing step resolver for handling clothing-specific field access
 *
 * @param {object} dependencies - Injected dependencies
 * @param {object} dependencies.entitiesGateway - Gateway for entity data access
 * @param {object} [dependencies.errorHandler] - Optional centralized error handler
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
export default function createClothingStepResolver({
  entitiesGateway,
  errorHandler = null,
}) {
  validateDependency(entitiesGateway, 'entitiesGateway');

  // Only validate if provided (for backward compatibility)
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
      requiredMethods: ['handleError', 'getErrorBuffer'],
    });
  }

  const CLOTHING_FIELDS = {
    topmost_clothing: 'topmost',
    topmost_clothing_no_accessories: 'topmost_no_accessories',
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
   * @param {object} trace - Optional trace logger (unused)
   * @returns {any} A clothing access object that can be used for slot access or array iteration
   */
  function resolveClothingField(entityId, field, trace) {
    // Validate inputs
    if (!entityId || typeof entityId !== 'string') {
      if (errorHandler) {
        errorHandler.handleError(
          'Invalid entity ID provided to ClothingStepResolver',
          { entityId, field },
          'ClothingStepResolver',
          ErrorCodes.INVALID_ENTITY_ID
        );
      }
      return null;
    }

    if (!field || typeof field !== 'string' || !CLOTHING_FIELDS[field]) {
      if (errorHandler) {
        errorHandler.handleError(
          `Invalid clothing reference: ${field}`,
          { field, entityId, validFields: Object.keys(CLOTHING_FIELDS) },
          'ClothingStepResolver',
          ErrorCodes.INVALID_ENTITY_ID
        );
      }
      return null;
    }

    let equipment;
    try {
      equipment = entitiesGateway.getComponentData(
        entityId,
        'clothing:equipment'
      );
    } catch (error) {
      if (errorHandler) {
        errorHandler.handleError(
          `Failed to retrieve clothing component for entity ${entityId}: ${error.message}`,
          { entityId, field, originalError: error.message },
          'ClothingStepResolver',
          ErrorCodes.COMPONENT_RESOLUTION_FAILED
        );
      }
      return null;
    }

    if (!equipment?.equipped) {
      // Return empty clothing access object
      return {
        __clothingSlotAccess: true,
        equipped: {},
        mode: CLOTHING_FIELDS[field],
        type: 'clothing_slot_access',
        // For ArrayIterationResolver compatibility
        __isClothingAccessObject: true,
        // Coverage priority metadata for enhanced priority calculation
        supportsPriorityCalculation: true,
        entityId: entityId, // Store entity ID for future enhancements
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
      // Coverage priority metadata for enhanced priority calculation
      supportsPriorityCalculation: true,
      entityId: entityId, // Store entity ID for future enhancements
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
    // Validate inputs
    if (!node || !node.field) {
      if (errorHandler) {
        errorHandler.handleError(
          'Invalid node provided to ClothingStepResolver',
          { node },
          'ClothingStepResolver',
          ErrorCodes.INVALID_NODE_STRUCTURE
        );
      }
      return new Set();
    }

    if (!ctx || !ctx.dispatcher) {
      if (errorHandler) {
        errorHandler.handleError(
          'Invalid context or missing dispatcher',
          { hasContext: !!ctx, hasDispatcher: !!ctx?.dispatcher },
          'ClothingStepResolver',
          ErrorCodes.MISSING_DISPATCHER
        );
      }
      return new Set();
    }

    const { field, parent } = node;
    let parentResults;

    try {
      parentResults = ctx.dispatcher.resolve(parent, ctx);
    } catch (error) {
      if (errorHandler) {
        errorHandler.handleError(
          `Failed to resolve parent node: ${error.message}`,
          { field, parentNode: parent, originalError: error.message },
          'ClothingStepResolver',
          ErrorCodes.STEP_RESOLUTION_FAILED
        );
      }
      return new Set();
    }

    const resultSet = new Set();

    // Process each parent entity
    for (const entityId of parentResults) {
      if (typeof entityId !== 'string') {
        continue; // Skip non-entity results
      }

      const clothingData = resolveClothingField(entityId, field, null);

      if (clothingData) {
        // Add the clothing access object to the result set
        // It will be processed by either SlotAccessResolver or ArrayIterationResolver
        resultSet.add(clothingData);
      }
    }

    return resultSet;
  }

  return {
    canResolve,
    resolve,
  };
}
