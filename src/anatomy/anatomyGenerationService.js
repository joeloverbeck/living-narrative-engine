// src/anatomy/anatomyGenerationService.js

/**
 * @file Service responsible for generating anatomy for entities with anatomy:body components
 */

import { ANATOMY_BODY_COMPONENT_ID } from '../constants/componentIds.js';
import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { ValidationError } from '../errors/validationError.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./bodyBlueprintFactory.js').BodyBlueprintFactory} BodyBlueprintFactory */

/**
 * Service that handles anatomy generation for entities
 */
export class AnatomyGenerationService {
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
  constructor({ entityManager, dataRegistry, logger, bodyBlueprintFactory }) {
    if (!entityManager)
      throw new InvalidArgumentError('entityManager is required');
    if (!dataRegistry)
      throw new InvalidArgumentError('dataRegistry is required');
    if (!logger) throw new InvalidArgumentError('logger is required');
    if (!bodyBlueprintFactory)
      throw new InvalidArgumentError('bodyBlueprintFactory is required');

    this.#entityManager = entityManager;
    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
    this.#bodyBlueprintFactory = bodyBlueprintFactory;
  }

  /**
   * Generates anatomy for an entity if it has an anatomy:body component with a recipeId
   *
   * @param {string} entityId - The entity instance ID
   * @returns {Promise<boolean>} True if anatomy was generated, false otherwise
   */
  async generateAnatomyIfNeeded(entityId) {
    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      if (!entity) {
        this.#logger.warn(
          `AnatomyGenerationService: Entity '${entityId}' not found`
        );
        return false;
      }

      // Check if entity has anatomy:body component
      if (!entity.hasComponent(ANATOMY_BODY_COMPONENT_ID)) {
        return false;
      }

      const anatomyBodyData = entity.getComponent(ANATOMY_BODY_COMPONENT_ID);
      if (!anatomyBodyData || !anatomyBodyData.recipeId) {
        this.#logger.warn(
          `AnatomyGenerationService: Entity '${entityId}' has anatomy:body component but no recipeId`
        );
        return false;
      }

      // Check if anatomy already generated
      if (anatomyBodyData.body) {
        this.#logger.debug(
          `AnatomyGenerationService: Entity '${entityId}' already has generated anatomy`
        );
        return false;
      }

      this.#logger.info(
        `AnatomyGenerationService: Generating anatomy for entity '${entityId}' using recipe '${anatomyBodyData.recipeId}'`
      );

      // Get the recipe to determine if a blueprint is needed
      const recipe = this.#dataRegistry.get(
        'anatomyRecipes',
        anatomyBodyData.recipeId
      );
      if (!recipe) {
        throw new ValidationError(
          `Recipe '${anatomyBodyData.recipeId}' not found`
        );
      }

      // For now, we'll use a simple approach where the recipe ID matches a blueprint ID
      // In the future, this could be more sophisticated
      const blueprintId = anatomyBodyData.recipeId; // Assume blueprint has same ID as recipe

      // Generate the anatomy graph
      const result = await this.#bodyBlueprintFactory.createAnatomyGraph(
        blueprintId,
        anatomyBodyData.recipeId,
        { ownerId: entityId }
      );

      // Build the parts map for easy access
      const parts = {};
      for (const partEntityId of result.entities) {
        const partEntity = this.#entityManager.getEntityInstance(partEntityId);
        if (partEntity && partEntity.hasComponent('core:name')) {
          const name = partEntity.getComponent('core:name').name;
          parts[name] = partEntityId;
        }
      }

      // Update the anatomy:body component with the generated structure
      this.#entityManager.updateComponent(entityId, ANATOMY_BODY_COMPONENT_ID, {
        ...anatomyBodyData,
        body: {
          root: result.rootId,
          parts: parts,
          allParts: result.entities,
        },
      });

      this.#logger.info(
        `AnatomyGenerationService: Successfully generated anatomy for entity '${entityId}' with ${result.entities.length} parts`
      );
      return true;
    } catch (error) {
      this.#logger.error(
        `AnatomyGenerationService: Failed to generate anatomy for entity '${entityId}'`,
        { error }
      );
      throw error;
    }
  }

  /**
   * Generates anatomy for multiple entities
   *
   * @param {string[]} entityIds - Array of entity instance IDs
   * @returns {Promise<{generated: string[], skipped: string[], failed: string[]}>}
   */
  async generateAnatomyForEntities(entityIds) {
    const results = {
      generated: [],
      skipped: [],
      failed: [],
    };

    for (const entityId of entityIds) {
      try {
        const wasGenerated = await this.generateAnatomyIfNeeded(entityId);
        if (wasGenerated) {
          results.generated.push(entityId);
        } else {
          results.skipped.push(entityId);
        }
      } catch (error) {
        this.#logger.error(
          `AnatomyGenerationService: Failed to process entity '${entityId}'`,
          { error }
        );
        results.failed.push(entityId);
      }
    }

    return results;
  }
}
