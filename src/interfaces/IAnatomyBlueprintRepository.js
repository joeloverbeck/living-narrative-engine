/**
 * @file Interface for anatomy blueprint data access
 * @see src/anatomy/repositories/anatomyBlueprintRepository.js
 */

/**
 * @interface IAnatomyBlueprintRepository
 * @description Provides centralized access to anatomy recipes and blueprints
 */
export class IAnatomyBlueprintRepository {
  /**
   * Retrieves an anatomy recipe by ID
   *
   * @param {string} recipeId - The recipe identifier
   * @returns {Promise<object|null>} The recipe object or null if not found
   */
  async getRecipe(recipeId) {
    throw new Error('Interface method');
  }

  /**
   * Retrieves an anatomy blueprint by ID
   *
   * @param {string} blueprintId - The blueprint identifier
   * @returns {Promise<object|null>} The blueprint object or null if not found
   */
  async getBlueprint(blueprintId) {
    throw new Error('Interface method');
  }

  /**
   * Retrieves an anatomy blueprint using a recipe ID
   * This combines recipe lookup with blueprint retrieval
   *
   * @param {string} recipeId - The recipe identifier
   * @returns {Promise<object|null>} The blueprint object or null if recipe/blueprint not found
   */
  async getBlueprintByRecipeId(recipeId) {
    throw new Error('Interface method');
  }

  /**
   * Clears any cached blueprint data
   *
   * @returns {void}
   */
  clearCache() {
    throw new Error('Interface method');
  }
}
