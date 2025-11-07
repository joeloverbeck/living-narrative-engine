/**
 * @file Stage for creating blueprint slot entities and mappings
 */

/**
 * Creates blueprint slot entities and mappings
 *
 * @param {object} context - Generation context
 * @param {string} context.blueprintId - Blueprint ID
 * @param {object} context.graphResult - Graph generation result with entities
 * @param {string} context.ownerId - Owner entity ID
 * @param {object} dependencies - Required services
 * @param {import('../../../interfaces/IEntityManager.js').IEntityManager} dependencies.entityManager - Entity manager
 * @param {import('../../../interfaces/coreServices.js').IDataRegistry} dependencies.dataRegistry - Data registry
 * @param {import('../../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger
 * @returns {Promise<{slotEntityMappings: Map<string, string>}>} Slot entity mappings
 */
export async function executeSlotEntityCreation(context, dependencies) {
  const { blueprintId, graphResult, ownerId } = context;
  const { entityManager, dataRegistry, logger } = dependencies;

  logger.debug(
    `SlotEntityCreationStage: Starting for blueprint '${blueprintId}'`
  );

  // Create blueprint slot entities
  await createBlueprintSlotEntities(
    blueprintId,
    graphResult,
    entityManager,
    dataRegistry,
    logger
  );

  // Build slot entity mappings
  const slotEntityMappings = buildSlotEntityMappings(
    graphResult,
    entityManager,
    logger
  );

  logger.debug(
    `SlotEntityCreationStage: Built ${slotEntityMappings.size} slot entity mappings`
  );

  // Create clothing slot metadata component
  await createClothingSlotMetadata(
    ownerId,
    blueprintId,
    entityManager,
    dataRegistry,
    logger
  );

  logger.debug(
    `SlotEntityCreationStage: Completed for entity '${ownerId}'`
  );

  return { slotEntityMappings };
}

/**
 * Creates blueprint slot entities based on the blueprint's slot definitions
 *
 * @private
 * @param {string} blueprintId - The blueprint ID to get slot definitions from
 * @param {object} graphResult - The anatomy graph generation result (will be modified)
 * @param {import('../../../interfaces/IEntityManager.js').IEntityManager} entityManager - Entity manager
 * @param {import('../../../interfaces/coreServices.js').IDataRegistry} dataRegistry - Data registry
 * @param {import('../../../interfaces/coreServices.js').ILogger} logger - Logger
 * @returns {Promise<void>}
 */
async function createBlueprintSlotEntities(
  blueprintId,
  graphResult,
  entityManager,
  dataRegistry,
  logger
) {
  logger.debug(
    `SlotEntityCreationStage: Starting blueprint slot entity creation for blueprint '${blueprintId}'`
  );

  try {
    // Get the blueprint data
    const blueprint = dataRegistry.get('anatomyBlueprints', blueprintId);
    if (!blueprint || !blueprint.slots) {
      logger.debug(
        `SlotEntityCreationStage: No blueprint slots found for blueprint '${blueprintId}'`
      );
      return;
    }

    logger.debug(
      `SlotEntityCreationStage: Found ${Object.keys(blueprint.slots).length} slots in blueprint '${blueprintId}'`
    );

    const createdSlotEntities = [];

    // Create an entity for each blueprint slot
    for (const [slotId, slotDefinition] of Object.entries(blueprint.slots)) {
      try {
        // Create the slot entity
        const slotEntity = await entityManager.createEntityInstance(
          'anatomy:blueprint_slot', // Use blueprint slot entity as base
          {
            skipValidation: false,
            generateId: true,
          }
        );

        // Debug: Check what we got back
        logger.debug(
          `SlotEntityCreationStage: Created entity type: ${typeof slotEntity}, constructor: ${slotEntity?.constructor?.name}, has id: ${!!slotEntity?.id}, id value: '${slotEntity?.id}'`
        );

        // Handle different possible return types
        let slotEntityId;
        if (typeof slotEntity === 'string') {
          // If createEntityInstance returns a string ID directly
          slotEntityId = slotEntity;
        } else if (slotEntity && typeof slotEntity.id === 'string') {
          // If it returns an Entity object with an id property
          slotEntityId = slotEntity.id;
        } else {
          logger.error(
            `SlotEntityCreationStage: Unexpected entity type returned. Type: ${typeof slotEntity}, Constructor: ${slotEntity?.constructor?.name}, Value: ${JSON.stringify(slotEntity)}`
          );
          throw new Error(`Invalid entity returned for slot ${slotId}`);
        }

        // Extra validation
        if (!slotEntityId || typeof slotEntityId !== 'string') {
          logger.error(
            `SlotEntityCreationStage: Invalid entity ID extracted. ID type: ${typeof slotEntityId}, ID value: '${slotEntityId}'`
          );
          throw new Error(`Invalid entity ID for slot ${slotId}`);
        }

        // Add the blueprintSlot component
        const blueprintSlotComponent = {
          slotId: slotId,
          socketId: slotDefinition.socket,
          requirements: slotDefinition.requirements,
        };

        try {
          // Double-check the ID right before calling addComponent
          logger.debug(
            `SlotEntityCreationStage: About to add component. slotEntityId type: ${typeof slotEntityId}, value: '${slotEntityId}'`
          );

          const componentAdded = entityManager.addComponent(
            slotEntityId,
            'anatomy:blueprintSlot',
            blueprintSlotComponent
          );

          logger.debug(
            `SlotEntityCreationStage: Component addition result for '${slotId}': ${componentAdded}`
          );

          // Verify the component was actually added
          const entity = entityManager.getEntityInstance(slotEntityId);
          if (entity && entity.hasComponent('anatomy:blueprintSlot')) {
            const retrievedComponent = entity.getComponentData(
              'anatomy:blueprintSlot'
            );
            logger.debug(
              `SlotEntityCreationStage: Successfully verified component for slot '${slotId}': ${JSON.stringify(retrievedComponent)}`
            );
          } else {
            logger.error(
              `SlotEntityCreationStage: Component verification failed for slot '${slotId}' - entity or component not found`
            );
            throw new Error(
              `Component addition verification failed for slot ${slotId}`
            );
          }

          // Add a name component for easier identification
          entityManager.addComponent(slotEntityId, 'core:name', {
            text: `Blueprint Slot: ${slotId}`,
          });

          createdSlotEntities.push(slotEntityId);

          logger.debug(
            `SlotEntityCreationStage: Successfully created and verified blueprint slot entity '${slotEntityId}' for slot '${slotId}'`
          );
        } catch (componentError) {
          logger.error(
            `SlotEntityCreationStage: Failed to add component to slot entity for slot '${slotId}'`,
            componentError
          );
          // Don't log slotEntityId in error message as it might be the problem
          throw componentError;
        }
      } catch (error) {
        logger.error(
          `SlotEntityCreationStage: Failed to create blueprint slot entity for '${slotId}'`,
          error
        );
        // Re-throw to ensure the error is visible and the process stops
        throw error;
      }
    }

    // Add the created slot entities to the graph result
    graphResult.entities.push(...createdSlotEntities);

    logger.debug(
      `SlotEntityCreationStage: Successfully created ${createdSlotEntities.length} blueprint slot entities`
    );
  } catch (error) {
    logger.error(
      `SlotEntityCreationStage: Failed to create blueprint slot entities`,
      error
    );
    throw error; // Re-throw to ensure errors are visible
  }
}

/**
 * Builds explicit slot-to-entity mappings from generation results
 * Eliminates need for naming assumptions
 *
 * @private
 * @param {object} graphResult - The anatomy graph generation result
 * @param {import('../../../interfaces/IEntityManager.js').IEntityManager} entityManager - Entity manager
 * @param {import('../../../interfaces/coreServices.js').ILogger} logger - Logger
 * @returns {Map<string, string>} Map of slot IDs to entity IDs
 */
function buildSlotEntityMappings(graphResult, entityManager, logger) {
  const mappings = new Map();

  logger.debug(
    `SlotEntityCreationStage: Building slot entity mappings from ${graphResult.entities.length} entities`
  );

  // Build mappings based on actual generated structure
  for (const entityId of graphResult.entities) {
    const entity = entityManager.getEntityInstance(entityId);

    logger.debug(
      `SlotEntityCreationStage: Checking entity '${entityId}' - has entity: ${!!entity}`
    );

    if (entity) {
      const hasComponent = entity.hasComponent('anatomy:blueprintSlot');
      logger.debug(
        `SlotEntityCreationStage: Entity '${entityId}' has anatomy:blueprintSlot component: ${hasComponent}`
      );

      if (hasComponent) {
        const slotComponent = entity.getComponentData('anatomy:blueprintSlot');
        logger.debug(
          `SlotEntityCreationStage: Retrieved component data for entity '${entityId}': ${JSON.stringify(slotComponent)}`
        );

        if (slotComponent && slotComponent.slotId) {
          mappings.set(slotComponent.slotId, entityId);
          logger.debug(
            `SlotEntityCreationStage: Successfully mapped slot '${slotComponent.slotId}' to entity '${entityId}'`
          );
        } else {
          logger.warn(
            `SlotEntityCreationStage: Component data missing or invalid for entity '${entityId}': ${JSON.stringify(slotComponent)}`
          );
        }
      }
    } else {
      logger.warn(
        `SlotEntityCreationStage: Could not retrieve entity instance for ID '${entityId}'`
      );
    }
  }

  logger.debug(
    `SlotEntityCreationStage: Built ${mappings.size} slot entity mappings`
  );

  return mappings;
}

/**
 * Creates the clothing:slot_metadata component with socket coverage mappings
 *
 * @private
 * @param {string} entityId - The entity to add the component to
 * @param {string} blueprintId - The blueprint ID to get mappings from
 * @param {import('../../../interfaces/IEntityManager.js').IEntityManager} entityManager - Entity manager
 * @param {import('../../../interfaces/coreServices.js').IDataRegistry} dataRegistry - Data registry
 * @param {import('../../../interfaces/coreServices.js').ILogger} logger - Logger
 * @returns {Promise<void>}
 */
async function createClothingSlotMetadata(
  entityId,
  blueprintId,
  entityManager,
  dataRegistry,
  logger
) {
  logger.debug(
    `SlotEntityCreationStage: Creating clothing slot metadata for entity '${entityId}' from blueprint '${blueprintId}'`
  );

  try {
    // Get the blueprint data
    const blueprint = dataRegistry.get('anatomyBlueprints', blueprintId);

    if (!blueprint || !blueprint.clothingSlotMappings) {
      logger.debug(
        `SlotEntityCreationStage: No clothing slot mappings found in blueprint '${blueprintId}'`
      );
      return;
    }

    // Transform the blueprint mappings into the component format
    const slotMappings = {};

    for (const [slotId, mapping] of Object.entries(
      blueprint.clothingSlotMappings
    )) {
      // Only include slots that have anatomySockets (these define coverage)
      if (mapping.anatomySockets && mapping.anatomySockets.length > 0) {
        slotMappings[slotId] = {
          coveredSockets: [...mapping.anatomySockets],
          allowedLayers: mapping.allowedLayers || [],
        };
      }
    }

    // Only create the component if there are actual mappings
    if (Object.keys(slotMappings).length > 0) {
      await entityManager.addComponent(entityId, 'clothing:slot_metadata', {
        slotMappings,
      });

      logger.debug(
        `SlotEntityCreationStage: Created clothing:slot_metadata component with ${Object.keys(slotMappings).length} slot mappings for entity '${entityId}'`
      );
    }
  } catch (error) {
    logger.error(
      `SlotEntityCreationStage: Failed to create clothing slot metadata for entity '${entityId}'`,
      error
    );
    // Don't fail the entire anatomy generation if metadata creation fails
  }
}
