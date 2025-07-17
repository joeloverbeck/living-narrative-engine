/**
 * @file Workflow for generating anatomy graph structures
 */

import { BaseService } from '../../utils/serviceBase.js';
import { ValidationError } from '../../errors/validationError.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../bodyBlueprintFactory.js').BodyBlueprintFactory} BodyBlueprintFactory */
/** @typedef {import('../../clothing/services/clothingInstantiationService.js').ClothingInstantiationService} ClothingInstantiationService */

/**
 * Workflow responsible for generating the anatomy graph structure
 * Extracted from AnatomyGenerationService to follow SRP
 */
export class AnatomyGenerationWorkflow extends BaseService {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {IDataRegistry} */
  #dataRegistry;
  /** @type {ILogger} */
  #logger;
  /** @type {BodyBlueprintFactory} */
  #bodyBlueprintFactory;
  /** @type {ClothingInstantiationService} */
  #clothingInstantiationService;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {IDataRegistry} deps.dataRegistry
   * @param {ILogger} deps.logger
   * @param {BodyBlueprintFactory} deps.bodyBlueprintFactory
   * @param {ClothingInstantiationService} [deps.clothingInstantiationService] - Optional for backward compatibility
   */
  constructor({
    entityManager,
    dataRegistry,
    logger,
    bodyBlueprintFactory,
    clothingInstantiationService,
  }) {
    super();
    this.#logger = this._init('AnatomyGenerationWorkflow', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntityInstance'],
      },
      dataRegistry: {
        value: dataRegistry,
        requiredMethods: ['get'],
      },
      bodyBlueprintFactory: {
        value: bodyBlueprintFactory,
        requiredMethods: ['createAnatomyGraph'],
      },
    });
    this.#entityManager = entityManager;
    this.#dataRegistry = dataRegistry;
    this.#bodyBlueprintFactory = bodyBlueprintFactory;
    this.#clothingInstantiationService = clothingInstantiationService;
  }

  /**
   * Generates anatomy graph for an entity
   *
   * @param {string} blueprintId - The blueprint ID to use
   * @param {string} recipeId - The recipe ID to use
   * @param {object} options - Additional options
   * @param {string} options.ownerId - The ID of the entity that will own this anatomy
   * @returns {Promise<{rootId: string, entities: string[], partsMap: Map<string, string>, slotEntityMappings: Map<string, string>, clothingResult?: object}>}
   * @throws {ValidationError} If blueprint or recipe is invalid
   */
  async generate(blueprintId, recipeId, options) {
    const { ownerId } = options;

    this.#logger.debug(
      `AnatomyGenerationWorkflow: Starting generate() for entity '${ownerId}' using blueprint '${blueprintId}' and recipe '${recipeId}'`
    );

    // Generate the anatomy graph using the factory
    const graphResult = await this.#bodyBlueprintFactory.createAnatomyGraph(
      blueprintId,
      recipeId,
      { ownerId }
    );

    this.#logger.debug(
      `AnatomyGenerationWorkflow: Generated ${graphResult.entities.length} anatomy parts for entity '${ownerId}'`
    );

    // Build the parts map for easy access by name
    // IMPORTANT: This must happen AFTER createAnatomyGraph completes, as that's when
    // socket-based naming is applied to entities
    const partsMap = this.#buildPartsMap(graphResult.entities);

    // Phase 2.5: Update the anatomy:body component with the structure BEFORE clothing
    // This is critical because clothing validation needs to access the body graph
    // Pass the already-built parts map to avoid building it twice
    await this.#updateAnatomyBodyComponent(
      ownerId,
      recipeId,
      graphResult,
      partsMap
    );

    // Add partsMap to graphResult for later use
    graphResult.partsMap = partsMap;

    // Phase 3: Create blueprint slot entities BEFORE clothing instantiation
    this.#logger.debug(
      `AnatomyGenerationWorkflow: Creating blueprint slot entities for blueprint '${blueprintId}'`
    );
    await this.#createBlueprintSlotEntities(blueprintId, graphResult);

    // Build explicit slot entity mappings now that slot entities exist
    const slotEntityMappings = this.#buildSlotEntityMappings(graphResult);
    this.#logger.debug(
      `AnatomyGenerationWorkflow: Built ${slotEntityMappings.size} slot entity mappings`
    );

    // Phase 4: Instantiate clothing if specified in recipe
    let clothingResult;
    if (this.#clothingInstantiationService) {
      const recipe = this.#dataRegistry.get('anatomyRecipes', recipeId);
      if (
        recipe &&
        recipe.clothingEntities &&
        recipe.clothingEntities.length > 0
      ) {
        this.#logger.debug(
          `AnatomyGenerationWorkflow: Instantiating ${recipe.clothingEntities.length} clothing items for entity '${ownerId}'`
        );

        try {
          clothingResult =
            await this.#clothingInstantiationService.instantiateRecipeClothing(
              ownerId,
              recipe,
              { partsMap, slotEntityMappings }
            );

          this.#logger.debug(
            `AnatomyGenerationWorkflow: Clothing instantiation completed with ${clothingResult.instantiated.length} items created`
          );
        } catch (error) {
          this.#logger.error(
            `AnatomyGenerationWorkflow: Failed to instantiate clothing for entity '${ownerId}'`,
            error
          );
          // Continue without clothing - don't fail the entire anatomy generation
        }
      }
    }

    const result = {
      rootId: graphResult.rootId,
      entities: graphResult.entities,
      partsMap,
      slotEntityMappings,
    };

    // Include clothing result if available
    if (clothingResult) {
      result.clothingResult = clothingResult;
    }

    return result;
  }

  /**
   * Builds a map of part names to entity IDs
   *
   * @private
   * @param {string[]} partEntityIds - Array of part entity IDs
   * @returns {Map<string, string>} Map of part names to entity IDs
   */
  #buildPartsMap(partEntityIds) {
    const parts = new Map();

    for (const partEntityId of partEntityIds) {
      const partEntity = this.#entityManager.getEntityInstance(partEntityId);

      // Only include entities that have the anatomy:part component
      if (
        partEntity &&
        partEntity.hasComponent('anatomy:part') &&
        partEntity.hasComponent('core:name')
      ) {
        const nameData = partEntity.getComponentData('core:name');
        const name = nameData ? nameData.text : null;

        if (name) {
          parts.set(name, partEntityId);

          // Debug logging to understand naming issues
          const anatomyPart = partEntity.getComponentData('anatomy:part');
          const jointData = partEntity.getComponentData('anatomy:joint');
          this.#logger.debug(
            `AnatomyGenerationWorkflow: Mapped part '${name}' to entity '${partEntityId}' - subType: ${anatomyPart?.subType}, orientation: ${anatomyPart?.orientation}, parentId: ${jointData?.parentId}, socketId: ${jointData?.socketId}`
          );
        }
      }
    }

    this.#logger.debug(
      `AnatomyGenerationWorkflow: Built parts map with ${parts.size} named parts`
    );

    return parts;
  }

  /**
   * Creates blueprint slot entities based on the blueprint's slot definitions
   *
   * @private
   * @param {string} blueprintId - The blueprint ID to get slot definitions from
   * @param {object} graphResult - The anatomy graph generation result (will be modified)
   * @returns {Promise<void>}
   */
  async #createBlueprintSlotEntities(blueprintId, graphResult) {
    this.#logger.debug(
      `AnatomyGenerationWorkflow: Starting blueprint slot entity creation for blueprint '${blueprintId}'`
    );

    try {
      // Get the blueprint data
      const blueprint = this.#dataRegistry.get(
        'anatomyBlueprints',
        blueprintId
      );
      if (!blueprint || !blueprint.slots) {
        this.#logger.debug(
          `AnatomyGenerationWorkflow: No blueprint slots found for blueprint '${blueprintId}'`
        );
        return;
      }

      this.#logger.debug(
        `AnatomyGenerationWorkflow: Found ${Object.keys(blueprint.slots).length} slots in blueprint '${blueprintId}'`
      );

      const createdSlotEntities = [];

      // Create an entity for each blueprint slot
      for (const [slotId, slotDefinition] of Object.entries(blueprint.slots)) {
        try {
          // Create the slot entity
          const slotEntity = await this.#entityManager.createEntityInstance(
            'anatomy:blueprint_slot', // Use blueprint slot entity as base
            {
              skipValidation: false,
              generateId: true,
            }
          );

          // Debug: Check what we got back
          this.#logger.debug(
            `AnatomyGenerationWorkflow: Created entity type: ${typeof slotEntity}, constructor: ${slotEntity?.constructor?.name}, has id: ${!!slotEntity?.id}, id value: '${slotEntity?.id}'`
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
            this.#logger.error(
              `AnatomyGenerationWorkflow: Unexpected entity type returned. Type: ${typeof slotEntity}, Constructor: ${slotEntity?.constructor?.name}, Value: ${JSON.stringify(slotEntity)}`
            );
            throw new Error(`Invalid entity returned for slot ${slotId}`);
          }

          // Extra validation
          if (!slotEntityId || typeof slotEntityId !== 'string') {
            this.#logger.error(
              `AnatomyGenerationWorkflow: Invalid entity ID extracted. ID type: ${typeof slotEntityId}, ID value: '${slotEntityId}'`
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
            this.#logger.debug(
              `AnatomyGenerationWorkflow: About to add component. slotEntityId type: ${typeof slotEntityId}, value: '${slotEntityId}'`
            );

            const componentAdded = this.#entityManager.addComponent(
              slotEntityId,
              'anatomy:blueprintSlot',
              blueprintSlotComponent
            );

            this.#logger.debug(
              `AnatomyGenerationWorkflow: Component addition result for '${slotId}': ${componentAdded}`
            );

            // Verify the component was actually added
            const entity = this.#entityManager.getEntityInstance(slotEntityId);
            if (entity && entity.hasComponent('anatomy:blueprintSlot')) {
              const retrievedComponent = entity.getComponentData(
                'anatomy:blueprintSlot'
              );
              this.#logger.debug(
                `AnatomyGenerationWorkflow: Successfully verified component for slot '${slotId}': ${JSON.stringify(retrievedComponent)}`
              );
            } else {
              this.#logger.error(
                `AnatomyGenerationWorkflow: Component verification failed for slot '${slotId}' - entity or component not found`
              );
              throw new Error(
                `Component addition verification failed for slot ${slotId}`
              );
            }

            // Add a name component for easier identification
            this.#entityManager.addComponent(slotEntityId, 'core:name', {
              text: `Blueprint Slot: ${slotId}`,
            });

            createdSlotEntities.push(slotEntityId);

            this.#logger.debug(
              `AnatomyGenerationWorkflow: Successfully created and verified blueprint slot entity '${slotEntityId}' for slot '${slotId}'`
            );
          } catch (componentError) {
            this.#logger.error(
              `AnatomyGenerationWorkflow: Failed to add component to slot entity for slot '${slotId}'`,
              componentError
            );
            // Don't log slotEntityId in error message as it might be the problem
            throw componentError;
          }
        } catch (error) {
          this.#logger.error(
            `AnatomyGenerationWorkflow: Failed to create blueprint slot entity for '${slotId}'`,
            error
          );
          // Re-throw to ensure the error is visible and the process stops
          throw error;
        }
      }

      // Add the created slot entities to the graph result
      graphResult.entities.push(...createdSlotEntities);

      this.#logger.debug(
        `AnatomyGenerationWorkflow: Successfully created ${createdSlotEntities.length} blueprint slot entities`
      );
    } catch (error) {
      this.#logger.error(
        `AnatomyGenerationWorkflow: Failed to create blueprint slot entities`,
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
   * @returns {Map<string, string>} Map of slot IDs to entity IDs
   */
  #buildSlotEntityMappings(graphResult) {
    const mappings = new Map();

    this.#logger.debug(
      `AnatomyGenerationWorkflow: Building slot entity mappings from ${graphResult.entities.length} entities`
    );

    // Build mappings based on actual generated structure
    for (const entityId of graphResult.entities) {
      const entity = this.#entityManager.getEntityInstance(entityId);

      this.#logger.debug(
        `AnatomyGenerationWorkflow: Checking entity '${entityId}' - has entity: ${!!entity}`
      );

      if (entity) {
        const hasComponent = entity.hasComponent('anatomy:blueprintSlot');
        this.#logger.debug(
          `AnatomyGenerationWorkflow: Entity '${entityId}' has anatomy:blueprintSlot component: ${hasComponent}`
        );

        if (hasComponent) {
          const slotComponent = entity.getComponentData(
            'anatomy:blueprintSlot'
          );
          this.#logger.debug(
            `AnatomyGenerationWorkflow: Retrieved component data for entity '${entityId}': ${JSON.stringify(slotComponent)}`
          );

          if (slotComponent && slotComponent.slotId) {
            mappings.set(slotComponent.slotId, entityId);
            this.#logger.debug(
              `AnatomyGenerationWorkflow: Successfully mapped slot '${slotComponent.slotId}' to entity '${entityId}'`
            );
          } else {
            this.#logger.warn(
              `AnatomyGenerationWorkflow: Component data missing or invalid for entity '${entityId}': ${JSON.stringify(slotComponent)}`
            );
          }
        }
      } else {
        this.#logger.warn(
          `AnatomyGenerationWorkflow: Could not retrieve entity instance for ID '${entityId}'`
        );
      }
    }

    this.#logger.debug(
      `AnatomyGenerationWorkflow: Built ${mappings.size} slot entity mappings`
    );

    return mappings;
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
   * @returns {Promise<void>}
   */
  async #updateAnatomyBodyComponent(entityId, recipeId, graphResult, partsMap) {
    this.#logger.debug(
      `AnatomyGenerationWorkflow: Updating anatomy:body component for entity '${entityId}' with structure`
    );

    // Get existing anatomy data to preserve any additional fields
    const existingData =
      this.#entityManager.getComponentData(entityId, 'anatomy:body') || {};

    // Convert Map to plain object for backward compatibility
    const partsObject =
      partsMap instanceof Map ? Object.fromEntries(partsMap) : partsMap;

    const updatedData = {
      ...existingData,
      recipeId, // Ensure recipe ID is preserved
      body: {
        root: graphResult.rootId,
        parts: partsObject,
      },
    };

    this.#entityManager.addComponent(entityId, 'anatomy:body', updatedData);

    this.#logger.debug(
      `AnatomyGenerationWorkflow: Updated entity '${entityId}' with body structure (root: '${graphResult.rootId}', ${Object.keys(partsObject).length} parts)`
    );
  }

  /**
   * Validates that a recipe exists and has required fields
   *
   * @param {string} recipeId - The recipe ID to validate
   * @returns {string} The blueprint ID from the recipe
   * @throws {ValidationError} If recipe is invalid
   */
  validateRecipe(recipeId) {
    const recipe = this.#dataRegistry.get('anatomyRecipes', recipeId);

    if (!recipe) {
      throw new ValidationError(`Recipe '${recipeId}' not found`);
    }

    if (!recipe.blueprintId) {
      throw new ValidationError(
        `Recipe '${recipeId}' does not specify a blueprintId`
      );
    }

    return recipe.blueprintId;
  }
}
