// src/anatomy/bodyBlueprintFactory/blueprintValidator.js

/**
 * @file Blueprint validation logic
 * Validates recipe slots against blueprint structure and ensures consistency
 */

import { ValidationError } from '../../errors/index.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../constants/systemEventIds.js';

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @typedef {object} AnatomyBlueprint
 * @property {string} [id]
 * @property {object} [slots]
 */

/**
 * @typedef {object} Recipe
 * @property {string} recipeId
 * @property {object} [slots]
 */

/**
 * Validates that all recipe slot keys exist in the blueprint
 *
 * @param {Recipe} recipe - The processed recipe with slots
 * @param {AnatomyBlueprint} blueprint - The blueprint to validate against
 * @param {ISafeEventDispatcher} eventDispatcher - Event dispatcher for error events
 * @throws {ValidationError} If recipe contains invalid slot keys
 */
export function validateRecipeSlots(recipe, blueprint, eventDispatcher) {
  // Skip validation if recipe has no slots
  if (!recipe.slots || Object.keys(recipe.slots).length === 0) {
    return;
  }

  // Collect slot keys that don't exist in blueprint
  // Note: 'torso' is a special slot used to override the root entity
  const invalidSlotKeys = [];
  for (const slotKey of Object.keys(recipe.slots)) {
    // Skip special slots: 'torso' for root entity override, 'root' for root mantle definition
    if (slotKey === 'torso' || slotKey === 'root') {
      continue;
    }

    if (!blueprint.slots || !blueprint.slots[slotKey]) {
      invalidSlotKeys.push(slotKey);
    }
  }

  // If any invalid keys found, dispatch error and throw
  if (invalidSlotKeys.length > 0) {
    const blueprintId = blueprint.id || 'unknown';
    const errorMessage = `Recipe '${recipe.recipeId}' contains invalid slot keys that don't exist in blueprint '${blueprintId}': ${invalidSlotKeys.join(', ')}`;

    // Dispatch system error with full context
    eventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: errorMessage,
      details: {
        raw: JSON.stringify({
          recipeId: recipe.recipeId,
          blueprintId: blueprintId,
          invalidSlotKeys,
          validSlotKeys: Object.keys(blueprint.slots || {}),
          context: 'BlueprintValidator.validateRecipeSlots',
        }),
      },
    });

    throw new ValidationError(errorMessage);
  }
}

/**
 * Validates blueprint-recipe consistency
 * This is a future extension point for additional consistency checks
 *
 * @param {AnatomyBlueprint} blueprint - Blueprint definition
 * @param {Recipe} recipe - Recipe definition
 * @param {object} logger - Logger instance
 * @throws {ValidationError} if inconsistent
 */
export function validateBlueprintRecipeConsistency(blueprint, recipe, logger) {
  logger.debug(
    `BlueprintValidator: Validating consistency between blueprint '${blueprint.id || 'unknown'}' and recipe '${recipe.recipeId || 'unknown'}'`
  );

  // Current implementation only validates recipe slots
  // Future: Add more consistency checks here
  // - Check that required slots are present in recipe
  // - Validate slot property types match blueprint expectations
  // - Ensure equipment slots have proper requirements
}

/**
 * Validates blueprint constraints
 * This is a future extension point for blueprint-specific constraint validation
 *
 * @param {AnatomyBlueprint} blueprint - Blueprint to validate
 * @param {object} logger - Logger instance
 * @throws {ValidationError} if constraints violated
 */
export function validateBlueprintConstraints(blueprint, logger) {
  logger.debug(
    `BlueprintValidator: Validating constraints for blueprint '${blueprint.id || 'unknown'}'`
  );

  // Future: Add blueprint constraint validation
  // - Validate that required sockets exist for all slots
  // - Check for circular dependencies in slot parent references
  // - Ensure V2 blueprints have valid structure templates
  // - Validate additionalSlots don't conflict with generated slots
}

export default {
  validateRecipeSlots,
  validateBlueprintRecipeConsistency,
  validateBlueprintConstraints,
};
