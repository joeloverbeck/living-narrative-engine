/**
 * @file Repository for accessing anatomy recipes and blueprints
 * @see src/interfaces/IAnatomyBlueprintRepository.js
 */

import { BaseService } from '../../utils/serviceBase.js';

/** @typedef {import('../../interfaces/IAnatomyBlueprintRepository.js').IAnatomyBlueprintRepository} IAnatomyBlueprintRepository */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Repository implementation for anatomy blueprint data access
 * Centralizes all anatomy recipe and blueprint retrieval with caching
 *
 * @implements {IAnatomyBlueprintRepository}
 */
class AnatomyBlueprintRepository extends BaseService {
  #logger;
  #dataRegistry;
  #blueprintCache = new Map();

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {IDataRegistry} dependencies.dataRegistry
   */
  constructor({ logger, dataRegistry }) {
    super();

    this.#logger = this._init('AnatomyBlueprintRepository', logger, {
      dataRegistry: {
        value: dataRegistry,
        requiredMethods: ['get'],
      },
    });

    this.#dataRegistry = dataRegistry;
  }

  /**
   * Retrieves an anatomy recipe by ID
   *
   * @param {string} recipeId - The recipe identifier
   * @returns {Promise<object|null>} The recipe object or null if not found
   */
  async getRecipe(recipeId) {
    if (!recipeId || typeof recipeId !== 'string') {
      this.#logger.warn('Invalid recipe ID provided to getRecipe');
      return null;
    }

    try {
      const recipe = this.#dataRegistry.get('anatomyRecipes', recipeId);

      if (!recipe) {
        this.#logger.debug(`Recipe '${recipeId}' not found in registry`);
        return null;
      }

      return recipe;
    } catch (error) {
      this.#logger.error(`Failed to retrieve recipe '${recipeId}'`, error);
      return null;
    }
  }

  /**
   * Retrieves an anatomy blueprint by ID
   *
   * @param {string} blueprintId - The blueprint identifier
   * @returns {Promise<object|null>} The blueprint object or null if not found
   */
  async getBlueprint(blueprintId) {
    if (!blueprintId || typeof blueprintId !== 'string') {
      this.#logger.warn('Invalid blueprint ID provided to getBlueprint');
      return null;
    }

    try {
      const blueprint = this.#dataRegistry.get(
        'anatomyBlueprints',
        blueprintId
      );

      if (!blueprint) {
        this.#logger.debug(`Blueprint '${blueprintId}' not found in registry`);
        return null;
      }

      return blueprint;
    } catch (error) {
      this.#logger.error(
        `Failed to retrieve blueprint '${blueprintId}'`,
        error
      );
      return null;
    }
  }

  /**
   * Retrieves an anatomy blueprint using a recipe ID
   * This combines recipe lookup with blueprint retrieval
   *
   * @param {string} recipeId - The recipe identifier
   * @returns {Promise<object|null>} The blueprint object or null if recipe/blueprint not found
   */
  async getBlueprintByRecipeId(recipeId) {
    if (!recipeId || typeof recipeId !== 'string') {
      this.#logger.warn('Invalid recipe ID provided to getBlueprintByRecipeId');
      return null;
    }

    // Check cache first
    if (this.#blueprintCache.has(recipeId)) {
      this.#logger.debug(`Returning cached blueprint for recipe '${recipeId}'`);
      return this.#blueprintCache.get(recipeId);
    }

    try {
      // Get the recipe
      const recipe = await this.getRecipe(recipeId);
      if (!recipe) {
        return null;
      }

      if (!recipe.blueprintId) {
        this.#logger.warn(`Recipe '${recipeId}' has no blueprintId`);
        return null;
      }

      // Get the blueprint
      const blueprint = await this.getBlueprint(recipe.blueprintId);
      if (!blueprint) {
        return null;
      }

      // Cache the blueprint mapped to recipe ID for performance
      this.#blueprintCache.set(recipeId, blueprint);
      this.#logger.debug(`Cached blueprint for recipe '${recipeId}'`);

      return blueprint;
    } catch (error) {
      this.#logger.error(
        `Failed to retrieve blueprint for recipe '${recipeId}'`,
        error
      );
      return null;
    }
  }

  /**
   * Clears any cached blueprint data
   *
   * @returns {void}
   */
  clearCache() {
    const cacheSize = this.#blueprintCache.size;
    this.#blueprintCache.clear();
    this.#logger.debug(`Cleared blueprint cache (${cacheSize} entries)`);
  }
}

export default AnatomyBlueprintRepository;
