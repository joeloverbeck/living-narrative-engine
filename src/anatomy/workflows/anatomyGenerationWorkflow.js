/**
 * @file Workflow for generating anatomy graph structures
 */

import { BaseService } from '../../utils/serviceBase.js';
import { ValidationError } from '../../errors/validationError.js';
import { BodyDescriptorValidator } from '../utils/bodyDescriptorValidator.js';
import { BodyDescriptorValidationError } from '../errors/bodyDescriptorValidationError.js';
import { executePartsMapBuilding } from './stages/partsMapBuildingStage.js';
import { executeSlotEntityCreation } from './stages/slotEntityCreationStage.js';
import { executeSocketIndexBuilding } from './stages/socketIndexBuildingStage.js';
import { executeClothingInstantiation } from './stages/clothingInstantiationStage.js';
import { executeEventPublication } from './stages/eventPublicationStage.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../bodyBlueprintFactory/bodyBlueprintFactory.js').BodyBlueprintFactory} BodyBlueprintFactory */
/** @typedef {import('../../clothing/services/clothingInstantiationService.js').ClothingInstantiationService} ClothingInstantiationService */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../services/anatomySocketIndex.js').default} AnatomySocketIndex */

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
  /** @type {ISafeEventDispatcher} */
  #eventBus;
  /** @type {AnatomySocketIndex} */
  #socketIndex;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {IDataRegistry} deps.dataRegistry
   * @param {ILogger} deps.logger
   * @param {BodyBlueprintFactory} deps.bodyBlueprintFactory
   * @param {ClothingInstantiationService} [deps.clothingInstantiationService] - Optional for backward compatibility
   * @param {ISafeEventDispatcher} [deps.eventBus] - Event bus for publishing anatomy generation events
   * @param {AnatomySocketIndex} [deps.socketIndex] - Socket index for anatomy structure lookups
   */
  constructor({
    entityManager,
    dataRegistry,
    logger,
    bodyBlueprintFactory,
    clothingInstantiationService,
    eventBus,
    socketIndex,
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
    this.#eventBus = eventBus;
    this.#socketIndex = socketIndex;
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

    // Step 1: Generate the anatomy graph (blueprint resolution, part selection, graph construction)
    // This is done by bodyBlueprintFactory - NOT by this workflow
    const graphResult = await this.#bodyBlueprintFactory.createAnatomyGraph(
      blueprintId,
      recipeId,
      { ownerId }
    );

    this.#logger.debug(
      `AnatomyGenerationWorkflow: Generated ${graphResult.entities.length} anatomy parts for entity '${ownerId}'`
    );

    // Step 2: Build parts map and update anatomy:body component
    const { partsMap } = await executePartsMapBuilding(
      { graphResult, ownerId, recipeId },
      this.#getDependencies()
    );

    graphResult.partsMap = partsMap;

    // Step 3: Create blueprint slot entities and mappings
    const { slotEntityMappings } = await executeSlotEntityCreation(
      { blueprintId, graphResult, ownerId },
      this.#getDependencies()
    );

    // Step 3.5: Build socket index explicitly before clothing instantiation
    // This prevents timing issues where multiple characters try to instantiate clothing
    // concurrently while the index is still building (lazy initialization)
    await executeSocketIndexBuilding(
      { ownerId },
      this.#getDependencies()
    );

    // Step 4: Instantiate clothing (if clothing service available)
    const clothingResult = await executeClothingInstantiation(
      { ownerId, recipeId, graphResult, partsMap, slotEntityMappings },
      this.#getDependencies()
    );

    // Step 5: Publish anatomy:anatomy_generated event (optional - for subscribers)
    await executeEventPublication(
      { ownerId, blueprintId, graphResult, partsMap, slotEntityMappings },
      this.#getDependencies()
    );

    // Build result
    const result = {
      rootId: graphResult.rootId,
      entities: graphResult.entities,
      partsMap,
      slotEntityMappings,
    };

    // Include clothing result if present
    if (clothingResult) {
      result.clothingResult = clothingResult;
    }

    return result;
  }

  /**
   * Returns dependencies object for stage execution
   *
   * @private
   * @returns {object} Dependencies
   */
  #getDependencies() {
    return {
      entityManager: this.#entityManager,
      dataRegistry: this.#dataRegistry,
      bodyBlueprintFactory: this.#bodyBlueprintFactory,
      clothingInstantiationService: this.#clothingInstantiationService,
      eventBus: this.#eventBus,
      socketIndex: this.#socketIndex,
      logger: this.#logger,
    };
  }

  /**
   * Validates body descriptors in a recipe
   *
   * @param {object} bodyDescriptors - The body descriptors to validate
   * @param {string} recipeId - The recipe ID for error messages
   * @throws {ValidationError} If body descriptors are invalid
   */
  validateBodyDescriptors(bodyDescriptors, recipeId) {
    try {
      BodyDescriptorValidator.validate(bodyDescriptors, `recipe '${recipeId}'`);
    } catch (error) {
      if (error instanceof BodyDescriptorValidationError) {
        // Convert BodyDescriptorValidationError to ValidationError to maintain compatibility
        throw new ValidationError(error.message);
      }
      throw error;
    }
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

    // Validate body descriptors if present
    if (recipe.bodyDescriptors) {
      this.validateBodyDescriptors(recipe.bodyDescriptors, recipeId);
    }

    return recipe.blueprintId;
  }
}
