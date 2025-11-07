/**
 * @file Stage for instantiating clothing if configured in recipe
 */

/**
 * Instantiates clothing if configured in recipe
 *
 * @param {object} context - Generation context
 * @param {string} context.ownerId - Owner entity ID
 * @param {string} context.recipeId - Recipe ID
 * @param {Map<string, string>} context.partsMap - Parts map
 * @param {Map<string, string>} context.slotEntityMappings - Slot entity mappings
 * @param {object} dependencies - Required services
 * @param {import('../../../clothing/services/clothingInstantiationService.js').ClothingInstantiationService} [dependencies.clothingInstantiationService] - Clothing instantiation service
 * @param {import('../../../interfaces/coreServices.js').IDataRegistry} dependencies.dataRegistry - Data registry
 * @param {import('../../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger
 * @returns {Promise<object|undefined>} Clothing instantiation results or undefined
 */
export async function executeClothingInstantiation(context, dependencies) {
  const { ownerId, recipeId, partsMap, slotEntityMappings } = context;
  const { clothingInstantiationService, dataRegistry, logger } = dependencies;

  // Only execute if clothingInstantiationService is available
  if (!clothingInstantiationService) {
    logger.debug(
      `ClothingInstantiationStage: Skipping clothing instantiation (service not available)`
    );
    return undefined;
  }

  logger.debug(
    `ClothingInstantiationStage: Checking recipe '${recipeId}' for clothing entities`
  );

  // Get recipe from dataRegistry
  const recipe = dataRegistry.get('anatomyRecipes', recipeId);

  // Check if recipe has clothingEntities
  if (!recipe || !recipe.clothingEntities || recipe.clothingEntities.length === 0) {
    logger.debug(
      `ClothingInstantiationStage: No clothing entities in recipe '${recipeId}'`
    );
    return undefined;
  }

  logger.debug(
    `ClothingInstantiationStage: Instantiating ${recipe.clothingEntities.length} clothing items for entity '${ownerId}'`
  );

  try {
    // Call clothingInstantiationService.instantiateRecipeClothing()
    const clothingResult =
      await clothingInstantiationService.instantiateRecipeClothing(
        ownerId,
        recipe,
        { partsMap, slotEntityMappings }
      );

    logger.debug(
      `ClothingInstantiationStage: Clothing instantiation completed with ${clothingResult.instantiated.length} items created`
    );

    return clothingResult;
  } catch (error) {
    logger.error(
      `ClothingInstantiationStage: Failed to instantiate clothing for entity '${ownerId}'`,
      error
    );
    // Continue without clothing - don't fail the entire anatomy generation
    return undefined;
  }
}
