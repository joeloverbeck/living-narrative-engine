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
      `AnatomyGenerationWorkflow: Generating anatomy graph for entity '${ownerId}' using blueprint '${blueprintId}' and recipe '${recipeId}'`
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
    const partsMap = this.#buildPartsMap(graphResult.entities);

    // Phase 3: Instantiate clothing if specified in recipe
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
          // Build explicit slot entity mappings
          const slotEntityMappings = this.#buildSlotEntityMappings(graphResult);

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

    // Build explicit slot entity mappings
    const slotEntityMappings = this.#buildSlotEntityMappings(graphResult);

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

      if (partEntity && partEntity.hasComponent('core:name')) {
        const nameData = partEntity.getComponentData('core:name');
        const name = nameData ? nameData.text : null;

        if (name) {
          parts.set(name, partEntityId);
          this.#logger.debug(
            `AnatomyGenerationWorkflow: Mapped part '${name}' to entity '${partEntityId}'`
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
   * Builds explicit slot-to-entity mappings from generation results
   * Eliminates need for naming assumptions
   *
   * @private
   * @param {object} graphResult - The anatomy graph generation result
   * @returns {Map<string, string>} Map of slot IDs to entity IDs
   */
  #buildSlotEntityMappings(graphResult) {
    const mappings = new Map();
    
    // Build mappings based on actual generated structure
    for (const entityId of graphResult.entities) {
      const entity = this.#entityManager.getEntityInstance(entityId);
      
      if (entity && entity.hasComponent('anatomy:blueprintSlot')) {
        const slotComponent = entity.getComponentData('anatomy:blueprintSlot');
        
        if (slotComponent && slotComponent.slotId) {
          mappings.set(slotComponent.slotId, entityId);
          this.#logger.debug(
            `AnatomyGenerationWorkflow: Mapped slot '${slotComponent.slotId}' to entity '${entityId}'`
          );
        }
      }
    }
    
    this.#logger.debug(
      `AnatomyGenerationWorkflow: Built ${mappings.size} slot entity mappings`
    );
    
    return mappings;
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
