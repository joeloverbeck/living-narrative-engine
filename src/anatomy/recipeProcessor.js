// src/anatomy/recipeProcessor.js

/**
 * @file Service responsible for loading and processing anatomy recipes
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';

/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} AnatomyRecipe
 * @property {string} recipeId
 * @property {Object<string, SlotDefinition>} slots
 * @property {Array<PatternDefinition>} [patterns]
 * @property {object} [constraints]
 * @property {Array<Array<string>>} [constraints.requires]
 * @property {Array<Array<string>>} [constraints.excludes]
 */

/**
 * @typedef {object} PatternDefinition
 * @property {string[]} matches
 * @property {string} partType
 * @property {string} [preferId]
 * @property {string[]} [tags]
 * @property {string[]} [notTags]
 * @property {Object<string, object>} [properties]
 */

/**
 * @typedef {object} SlotDefinition
 * @property {string} partType
 * @property {string} [preferId]
 * @property {string[]} [tags]
 * @property {string[]} [notTags]
 * @property {{min?: number, max?: number, exact?: number}} [count]
 */

/**
 * Service that handles recipe loading and pattern processing
 */
export class RecipeProcessor {
  /** @type {IDataRegistry} */
  #dataRegistry;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} deps
   * @param {IDataRegistry} deps.dataRegistry
   * @param {ILogger} deps.logger
   */
  constructor({ dataRegistry, logger }) {
    if (!dataRegistry) {
      throw new InvalidArgumentError('dataRegistry is required');
    }
    if (!logger) {
      throw new InvalidArgumentError('logger is required');
    }

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Loads a recipe from the registry
   *
   * @param {string} recipeId - The recipe ID to load
   * @returns {AnatomyRecipe} The loaded recipe
   * @throws {InvalidArgumentError} If recipe not found
   */
  loadRecipe(recipeId) {
    const recipe = this.#dataRegistry.get('anatomyRecipes', recipeId);
    if (!recipe) {
      throw new InvalidArgumentError(
        `Recipe '${recipeId}' not found in registry`
      );
    }

    this.#logger.debug(
      `RecipeProcessor: Loaded recipe '${recipeId}' with ${Object.keys(recipe.slots || {}).length} slots`
    );

    return recipe;
  }

  /**
   * Processes a recipe by expanding patterns into slots
   *
   * @param {AnatomyRecipe} recipe - The recipe to process
   * @returns {AnatomyRecipe} Recipe with expanded slots
   */
  processRecipe(recipe) {
    // If no patterns, return as-is
    if (!recipe.patterns || recipe.patterns.length === 0) {
      this.#logger.debug(
        `RecipeProcessor: Recipe '${recipe.recipeId}' has no patterns to expand`
      );
      return recipe;
    }

    // Create a deep copy to avoid modifying the original
    const processedRecipe = JSON.parse(JSON.stringify(recipe));

    // Expand patterns into slots
    this.#expandPatternsIntoSlots(processedRecipe);

    this.#logger.debug(
      `RecipeProcessor: Expanded ${recipe.patterns.length} patterns into slots for recipe '${recipe.recipeId}'`
    );

    return processedRecipe;
  }

  /**
   * Merges slot requirements from blueprint and recipe
   *
   * @param {object} blueprintRequirements - Requirements from blueprint
   * @param {SlotDefinition} recipeSlot - Recipe slot overrides
   * @returns {object} Merged requirements
   */
  mergeSlotRequirements(blueprintRequirements, recipeSlot) {
    if (!recipeSlot) {
      return blueprintRequirements || {};
    }

    const merged = { ...(blueprintRequirements || {}) };

    // Recipe can override part type
    if (recipeSlot.partType) {
      merged.partType = recipeSlot.partType;
    }

    // Recipe can add additional required components
    if (recipeSlot.tags) {
      merged.components = [...(merged.components || []), ...recipeSlot.tags];
    }

    // Recipe can add property requirements
    if (recipeSlot.properties) {
      merged.properties = {
        ...(merged.properties || {}),
        ...recipeSlot.properties,
      };
    }

    return merged;
  }

  /**
   * Checks if an entity definition meets property requirements
   *
   * @param {object} entityDef - Entity definition to check
   * @param {object} propertyRequirements - Required properties
   * @returns {boolean} True if requirements are met
   */
  matchesPropertyRequirements(entityDef, propertyRequirements) {
    for (const [componentId, requiredProps] of Object.entries(
      propertyRequirements
    )) {
      const component = entityDef.components[componentId];
      if (!component) return false;

      // Check each required property
      for (const [propKey, propValue] of Object.entries(requiredProps)) {
        if (component[propKey] !== propValue) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Expands pattern definitions into individual slot definitions
   *
   * @param {AnatomyRecipe} recipe - The recipe with patterns
   * @private
   */
  #expandPatternsIntoSlots(recipe) {
    // Process each pattern
    for (const pattern of recipe.patterns) {
      // Skip V2 patterns - they will be handled by RecipePatternResolver
      if (!pattern.matches) {
        this.#logger.debug(
          `RecipeProcessor: Skipping V2 pattern (will be resolved by RecipePatternResolver)`
        );
        continue;
      }

      // For each slot key that matches this pattern (V1 pattern)
      for (const slotKey of pattern.matches) {
        // Only apply pattern if slot not already explicitly defined
        if (!recipe.slots[slotKey]) {
          recipe.slots[slotKey] = {
            partType: pattern.partType,
            preferId: pattern.preferId,
            tags: pattern.tags,
            notTags: pattern.notTags,
            properties: pattern.properties,
          };

          this.#logger.debug(
            `RecipeProcessor: Created slot '${slotKey}' from pattern matching '${pattern.partType}'`
          );
        }
      }
    }
  }
}

export default RecipeProcessor;
