/**
 * @file Stage for building parts map and updating anatomy:body component
 */

/**
 * Builds parts map and updates anatomy:body component
 *
 * @param {object} context - Generation context
 * @param {object} context.graphResult - Graph generation result with entities
 * @param {string} context.ownerId - Owner entity ID
 * @param {string} context.recipeId - Recipe ID
 * @param {object} dependencies - Required services
 * @param {import('../../../interfaces/IEntityManager.js').IEntityManager} dependencies.entityManager - Entity manager
 * @param {import('../../../interfaces/coreServices.js').IDataRegistry} dependencies.dataRegistry - Data registry
 * @param {import('../../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger
 * @returns {Promise<{partsMap: Map<string, string>}>} Parts map
 */
export async function executePartsMapBuilding(context, dependencies) {
  const { graphResult, ownerId, recipeId } = context;
  const { entityManager, dataRegistry, logger } = dependencies;

  logger.debug(
    `PartsMapBuildingStage: Building parts map from ${graphResult.entities.length} entities`
  );

  // Build the parts map from generated entities
  const partsMap = buildPartsMap(graphResult.entities, entityManager, logger);

  // Update the anatomy:body component with the structure
  await updateAnatomyBodyComponent(
    ownerId,
    recipeId,
    graphResult,
    partsMap,
    entityManager,
    dataRegistry,
    logger
  );

  logger.debug(
    `PartsMapBuildingStage: Completed with ${partsMap.size} named parts`
  );

  return { partsMap };
}

/**
 * Builds a map of part names to entity IDs
 *
 * @private
 * @param {string[]} partEntityIds - Array of part entity IDs
 * @param {import('../../../interfaces/IEntityManager.js').IEntityManager} entityManager - Entity manager
 * @param {import('../../../interfaces/coreServices.js').ILogger} logger - Logger
 * @returns {Map<string, string>} Map of part names to entity IDs
 */
function buildPartsMap(partEntityIds, entityManager, logger) {
  const parts = new Map();

  for (const partEntityId of partEntityIds) {
    const partEntity = entityManager.getEntityInstance(partEntityId);

    // Only include entities that have the anatomy:part component
    if (
      partEntity &&
      partEntity.hasComponent('anatomy:part') &&
      partEntity.hasComponent('core:name')
    ) {
      const nameData = partEntity.getComponentData('core:name');
      const name = nameData ? nameData.text : null;

      // Use name as the key for parts map indexing
      const key = name || partEntityId;

      if (key) {
        parts.set(key, partEntityId);

        logger.debug(
          `PartsMapBuildingStage: Mapped part '${key}' to entity '${partEntityId}'`
        );
      }
    }
  }

  logger.debug(
    `PartsMapBuildingStage: Built parts map with ${parts.size} named parts`
  );

  return parts;
}

/**
 * Updates the anatomy:body component with the generated structure
 * This needs to happen BEFORE clothing instantiation for validation to work
 *
 * @private
 * @param {string} entityId - The entity ID
 * @param {string} recipeId - The recipe ID
 * @param {object} graphResult - The graph generation result
 * @param {Map<string, string>} partsMap - Pre-built parts map
 * @param {import('../../../interfaces/IEntityManager.js').IEntityManager} entityManager - Entity manager
 * @param {import('../../../interfaces/coreServices.js').IDataRegistry} dataRegistry - Data registry
 * @param {import('../../../interfaces/coreServices.js').ILogger} logger - Logger
 * @returns {Promise<void>}
 */
async function updateAnatomyBodyComponent(
  entityId,
  recipeId,
  graphResult,
  partsMap,
  entityManager,
  dataRegistry,
  logger
) {
  logger.debug(
    `PartsMapBuildingStage: Updating anatomy:body component for entity '${entityId}' with structure`
  );

  // Get existing anatomy data to preserve any additional fields
  const existingData =
    entityManager.getComponentData(entityId, 'anatomy:body') || {};

  // Convert Map to plain object for backward compatibility
  const partsObject =
    partsMap instanceof Map ? Object.fromEntries(partsMap) : partsMap;

  // Get recipe data to check for bodyDescriptors
  const recipe = dataRegistry.get('anatomyRecipes', recipeId);

  // Build body object
  const bodyObject = {
    root: graphResult.rootId,
    parts: partsObject,
  };

  // Apply recipe bodyDescriptors if present
  if (recipe?.bodyDescriptors) {
    bodyObject.descriptors = { ...recipe.bodyDescriptors };
    logger.debug(
      `PartsMapBuildingStage: Applied bodyDescriptors from recipe '${recipeId}': ${JSON.stringify(recipe.bodyDescriptors)}`
    );
  }

  const updatedData = {
    ...existingData,
    recipeId, // Ensure recipe ID is preserved
    body: bodyObject,
  };

  await entityManager.addComponent(entityId, 'anatomy:body', updatedData);

  logger.debug(
    `PartsMapBuildingStage: Updated entity '${entityId}' with body structure (root: '${graphResult.rootId}', ${Object.keys(partsObject).length} parts)`
  );
}
