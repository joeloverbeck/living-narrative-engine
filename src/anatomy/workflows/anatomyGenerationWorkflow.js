/**
 * @file Workflow for generating anatomy graph structures
 */

import { BaseService } from '../../utils/serviceBase.js';
import { ValidationError } from '../../errors/validationError.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../bodyBlueprintFactory.js').BodyBlueprintFactory} BodyBlueprintFactory */

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

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {IDataRegistry} deps.dataRegistry
   * @param {ILogger} deps.logger
   * @param {BodyBlueprintFactory} deps.bodyBlueprintFactory
   */
  constructor({
    entityManager,
    dataRegistry,
    logger,
    bodyBlueprintFactory,
  }) {
    super();
    this.#logger = this._init('AnatomyGenerationWorkflow', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntityInstance']
      },
      dataRegistry: {
        value: dataRegistry,
        requiredMethods: ['get']
      },
      bodyBlueprintFactory: {
        value: bodyBlueprintFactory,
        requiredMethods: ['createAnatomyGraph']
      }
    });
    this.#entityManager = entityManager;
    this.#dataRegistry = dataRegistry;
    this.#bodyBlueprintFactory = bodyBlueprintFactory;
  }

  /**
   * Generates anatomy graph for an entity
   * 
   * @param {string} blueprintId - The blueprint ID to use
   * @param {string} recipeId - The recipe ID to use
   * @param {object} options - Additional options
   * @param {string} options.ownerId - The ID of the entity that will own this anatomy
   * @returns {Promise<{rootId: string, entities: string[], partsMap: Object<string, string>}>}
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

    return {
      rootId: graphResult.rootId,
      entities: graphResult.entities,
      partsMap
    };
  }

  /**
   * Builds a map of part names to entity IDs
   * 
   * @private
   * @param {string[]} partEntityIds - Array of part entity IDs
   * @returns {Object<string, string>} Map of part names to entity IDs
   */
  #buildPartsMap(partEntityIds) {
    const parts = {};

    for (const partEntityId of partEntityIds) {
      const partEntity = this.#entityManager.getEntityInstance(partEntityId);
      
      if (partEntity && partEntity.hasComponent('core:name')) {
        const nameData = partEntity.getComponentData('core:name');
        const name = nameData ? nameData.text : null;
        
        if (name) {
          parts[name] = partEntityId;
          this.#logger.debug(
            `AnatomyGenerationWorkflow: Mapped part '${name}' to entity '${partEntityId}'`
          );
        }
      }
    }

    this.#logger.debug(
      `AnatomyGenerationWorkflow: Built parts map with ${Object.keys(parts).length} named parts`
    );

    return parts;
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