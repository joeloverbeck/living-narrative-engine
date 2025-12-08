/**
 * @file Stage for applying seeded damage defined on anatomy recipes.
 */

/**
 * Applies seeded damage using the provided SeededDamageApplier.
 *
 * @param {object} context
 * @param {string} context.recipeId
 * @param {string} context.ownerId
 * @param {Map<string, string>|object} [context.slotToPartMappings]
 * @param {object} dependencies
 * @param {import('../../../interfaces/coreServices.js').IDataRegistry} dependencies.dataRegistry
 * @param {import('../../../interfaces/coreServices.js').ILogger} dependencies.logger
 * @param {import('../../../logic/services/SeededDamageApplier.js').default} [dependencies.seededDamageApplier]
 */
export async function executeSeededDamageApplication(context, dependencies) {
  const { recipeId, ownerId, slotToPartMappings } = context;
  const { dataRegistry, logger, seededDamageApplier } = dependencies;

  if (!seededDamageApplier) {
    logger.debug(
      'SeededDamageApplicationStage: No seededDamageApplier provided; skipping seeded damage stage'
    );
    return;
  }

  const recipe = dataRegistry.get('anatomyRecipes', recipeId);
  const initialDamage = recipe?.initialDamage;

  if (!initialDamage || Object.keys(initialDamage).length === 0) {
    logger.debug(
      `SeededDamageApplicationStage: Recipe '${recipeId}' has no initialDamage; skipping`
    );
    return;
  }

  logger.debug(
    `SeededDamageApplicationStage: Applying seeded damage for recipe '${recipeId}' on entity '${ownerId}'`
  );

  await seededDamageApplier.applySeededDamage({
    ownerId,
    recipeId,
    initialDamage,
    slotToPartMappings,
  });
}

export default executeSeededDamageApplication;
