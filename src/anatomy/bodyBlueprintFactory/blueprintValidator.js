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
 * @property {string} [id] - Blueprint identifier
 * @property {object} [slots] - Slot definitions
 */

/**
 * @typedef {object} Recipe
 * @property {string} recipeId - Recipe identifier
 * @property {object} [slots] - Slot definitions
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
 * Checks blueprint/recipe compatibility
 *
 * @param {object} blueprint - Blueprint (V1 or V2, already processed via blueprintLoader)
 * @param {object} recipe - Recipe with slots and patterns
 * @param {object} dependencies - SlotGenerator, RecipePatternResolver, Logger
 * @param {object} dependencies.recipePatternResolver - RecipePatternResolver instance
 * @param {object} dependencies.logger - Logger instance
 * @returns {object[]} Array of validation issues
 */
export function checkBlueprintRecipeCompatibility(
  blueprint,
  recipe,
  { recipePatternResolver, logger }
) {
  const issues = [];

  // Step 1: Get all blueprint slots (already generated for V2 blueprints by blueprintLoader)
  // V1 blueprints: blueprint.slots contains explicit slot definitions
  // V2 blueprints: blueprint.slots contains merged template-generated + additionalSlots
  const blueprintSlots = blueprint.slots || {};

  // Step 2: Categorize blueprint slots by required/optional status
  const requiredSlotKeys = [];
  const optionalSlotKeys = [];

  for (const [slotKey, slotDef] of Object.entries(blueprintSlots)) {
    if (slotDef.optional) {
      optionalSlotKeys.push(slotKey);
    } else {
      requiredSlotKeys.push(slotKey);
    }
  }

  // Step 3: Determine which slots are populated by recipe
  const recipeExplicitSlots = new Set(Object.keys(recipe.slots || {}));

  // Resolve recipe patterns to determine which blueprint slots they match
  // For V2 blueprints, patterns use matchesGroup/matchesPattern/matchesAll
  // For V1 recipes, patterns use explicit matches array
  let patternMatchedSlots = new Set();

  if (blueprint.schemaVersion === '2.0' && recipe.patterns) {
    // Use RecipePatternResolver to resolve V2 patterns
    try {
      const resolvedRecipe = recipePatternResolver.resolveRecipePatterns(
        recipe,
        blueprint
      );
      patternMatchedSlots = new Set(Object.keys(resolvedRecipe.slots || {}));
    } catch (error) {
      logger.warn(
        `Failed to resolve recipe patterns: ${error.message}. Continuing with explicit slots only.`
      );
      // Continue with just explicit slots if pattern resolution fails
    }
  } else if (recipe.patterns) {
    // V1 patterns with explicit matches arrays
    for (const pattern of recipe.patterns) {
      if (pattern.matches) {
        pattern.matches.forEach((slotKey) => patternMatchedSlots.add(slotKey));
      }
    }
  }

  const populatedSlots = new Set([
    ...recipeExplicitSlots,
    ...patternMatchedSlots,
  ]);

  // Step 4: Check required slots are populated
  for (const requiredSlot of requiredSlotKeys) {
    // Skip special slots: 'torso' and 'root' are allowed in recipes but not required in blueprint
    if (requiredSlot === 'torso' || requiredSlot === 'root') {
      continue;
    }

    if (!populatedSlots.has(requiredSlot)) {
      issues.push({
        type: 'missing_required_slot',
        severity: 'error',
        slot: requiredSlot,
        message: `Required slot '${requiredSlot}' not populated by recipe`,
        fix: `Add slot '${requiredSlot}' to recipe.slots or create pattern that matches it`,
        location: {
          blueprintId: blueprint.id,
          recipeId: recipe.recipeId,
        },
      });
    }
  }

  // Step 5: Check for recipe slots that don't exist in blueprint (will be ignored)
  for (const recipeSlot of recipeExplicitSlots) {
    // Skip special slots that are allowed
    if (recipeSlot === 'torso' || recipeSlot === 'root') {
      continue;
    }

    if (!blueprintSlots[recipeSlot]) {
      issues.push({
        type: 'unexpected_slot',
        severity: 'warning',
        slot: recipeSlot,
        message: `Recipe slot '${recipeSlot}' not defined in blueprint '${blueprint.id}'`,
        impact: 'Slot will be ignored during anatomy generation',
        fix: `Remove slot or verify blueprint '${blueprint.id}' is correct`,
        location: {
          blueprintId: blueprint.id,
          recipeId: recipe.recipeId,
        },
      });
    }
  }

  // Step 6: Log pattern matching coverage for debugging
  if (recipe.patterns && recipe.patterns.length > 0) {
    logger.debug(
      `BlueprintRecipeValidator: Recipe '${recipe.recipeId}' has ${recipe.patterns.length} patterns matching ${patternMatchedSlots.size} slots`
    );
  }

  return issues;
}

/**
 * Validates blueprint-recipe consistency
 * This is a future extension point for additional consistency checks
 *
 * @param {AnatomyBlueprint} blueprint - Blueprint definition
 * @param {Recipe} recipe - Recipe definition
 * @param {object} dependencies - Dependencies for validation
 * @param {object} dependencies.recipePatternResolver - RecipePatternResolver instance (optional)
 * @param {object} dependencies.logger - Logger instance
 * @throws {ValidationError} if inconsistent
 */
export function validateBlueprintRecipeConsistency(
  blueprint,
  recipe,
  { recipePatternResolver, logger }
) {
  logger.debug(
    `BlueprintValidator: Validating consistency between blueprint '${blueprint.id || 'unknown'}' and recipe '${recipe.recipeId || 'unknown'}'`
  );

  // If recipePatternResolver is provided, perform compatibility checks
  if (recipePatternResolver) {
    const issues = checkBlueprintRecipeCompatibility(blueprint, recipe, {
      recipePatternResolver,
      logger,
    });

    // Log and throw for errors
    const errors = issues.filter((issue) => issue.severity === 'error');
    if (errors.length > 0) {
      const errorMessages = errors.map((err) => err.message).join('; ');
      logger.error(
        `BlueprintValidator: Blueprint/recipe compatibility errors: ${errorMessages}`
      );
      throw new ValidationError(
        `Blueprint '${blueprint.id}' and recipe '${recipe.recipeId}' are incompatible: ${errorMessages}`
      );
    }

    // Log warnings
    const warnings = issues.filter((issue) => issue.severity === 'warning');
    warnings.forEach((warning) => {
      logger.warn(`BlueprintValidator: ${warning.message} - ${warning.impact}`);
    });
  }

  // Future: Add more consistency checks here
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
  checkBlueprintRecipeCompatibility,
  validateBlueprintRecipeConsistency,
  validateBlueprintConstraints,
};
