// src/anatomy/anatomyGenerationService.js

/**
 * @file Service responsible for generating anatomy for entities with anatomy:body components
 *
 * REFACTORED: Now delegates to AnatomyOrchestrator for clean separation of concerns
 * while maintaining backward compatibility
 */

import { ANATOMY_BODY_COMPONENT_ID } from '../constants/componentIds.js';
import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { AnatomyOrchestrator } from './orchestration/anatomyOrchestrator.js';
import { AnatomyGenerationWorkflow } from './workflows/anatomyGenerationWorkflow.js';
import { DescriptionGenerationWorkflow } from './workflows/descriptionGenerationWorkflow.js';
import { GraphBuildingWorkflow } from './workflows/graphBuildingWorkflow.js';
import { AnatomyErrorHandler } from './orchestration/anatomyErrorHandler.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./bodyBlueprintFactory.js').BodyBlueprintFactory} BodyBlueprintFactory */
/** @typedef {import('./anatomyDescriptionService.js').AnatomyDescriptionService} AnatomyDescriptionService */
/** @typedef {import('./bodyGraphService.js').BodyGraphService} BodyGraphService */
/** @typedef {import('../clothing/services/clothingInstantiationService.js').ClothingInstantiationService} ClothingInstantiationService */

/**
 * Service that handles anatomy generation for entities
 *
 * This service now acts as a facade, delegating the actual orchestration
 * to specialized components while maintaining the original public API
 */
export class AnatomyGenerationService {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;
  /** @type {AnatomyOrchestrator} */
  #orchestrator;

  /**
   * Creates an instance of the service.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {IEntityManager} deps.entityManager - Entity manager for entity lookups.
   * @param {IDataRegistry} deps.dataRegistry - Registry used by workflows.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {BodyBlueprintFactory} deps.bodyBlueprintFactory - Factory for body blueprints.
   * @param {AnatomyDescriptionService} deps.anatomyDescriptionService - Service providing textual descriptions.
   * @param {BodyGraphService} deps.bodyGraphService - Service for body graph operations.
   * @param {ClothingInstantiationService} [deps.clothingInstantiationService] - Service for instantiating clothing (optional).
   * @param {object} [deps.eventBus] - Event bus for anatomy events (optional).
   * @param {object} [deps.socketIndex] - Anatomy socket index service (optional).
   */
  constructor({
    entityManager,
    dataRegistry,
    logger,
    bodyBlueprintFactory,
    anatomyDescriptionService,
    bodyGraphService,
    clothingInstantiationService,
    eventBus,
    socketIndex,
  }) {
    if (!entityManager)
      throw new InvalidArgumentError('entityManager is required');
    if (!dataRegistry)
      throw new InvalidArgumentError('dataRegistry is required');
    if (!logger) throw new InvalidArgumentError('logger is required');
    if (!bodyBlueprintFactory)
      throw new InvalidArgumentError('bodyBlueprintFactory is required');
    if (!anatomyDescriptionService)
      throw new InvalidArgumentError('anatomyDescriptionService is required');
    if (!bodyGraphService)
      throw new InvalidArgumentError('bodyGraphService is required');

    this.#entityManager = entityManager;
    this.#logger = logger;

    // Create workflows
    const generationWorkflow = new AnatomyGenerationWorkflow({
      entityManager,
      dataRegistry,
      logger,
      bodyBlueprintFactory,
      clothingInstantiationService,
      eventBus,
      socketIndex,
    });

    const descriptionWorkflow = new DescriptionGenerationWorkflow({
      entityManager,
      logger,
      anatomyDescriptionService,
    });

    const graphBuildingWorkflow = new GraphBuildingWorkflow({
      entityManager,
      logger,
      bodyGraphService,
    });

    const errorHandler = new AnatomyErrorHandler({ logger });

    // Create orchestrator
    this.#orchestrator = new AnatomyOrchestrator({
      entityManager,
      logger,
      generationWorkflow,
      descriptionWorkflow,
      graphBuildingWorkflow,
      errorHandler,
    });
  }

  /**
   * Generates anatomy for an entity if it has an anatomy:body component with a recipeId
   *
   * @param {string} entityId - The entity instance ID
   * @returns {Promise<boolean>} True if anatomy was generated, false otherwise
   */
  async generateAnatomyIfNeeded(entityId) {
    try {
      // Check if generation is needed
      const checkResult = this.#orchestrator.checkGenerationNeeded(entityId);

      if (!checkResult.needsGeneration) {
        if (checkResult.reason === 'Entity not found') {
          this.#logger.warn(
            `AnatomyGenerationService: Entity '${entityId}' not found`
          );
        } else if (
          checkResult.reason === 'anatomy:body component has no recipeId'
        ) {
          this.#logger.warn(
            `AnatomyGenerationService: Entity '${entityId}' has anatomy:body component but no recipeId`
          );
        } else if (checkResult.reason === 'Anatomy already generated') {
          this.#logger.debug(
            `AnatomyGenerationService: Entity '${entityId}' already has generated anatomy`
          );
        }
        return false;
      }

      // Get the recipe ID from the entity
      const entity = this.#entityManager.getEntityInstance(entityId);
      const anatomyBodyData = entity.getComponentData(
        ANATOMY_BODY_COMPONENT_ID
      );
      const recipeId = anatomyBodyData.recipeId;

      this.#logger.info(
        `AnatomyGenerationService: Generating anatomy for entity '${entityId}' using recipe '${recipeId}'`
      );

      // Delegate to orchestrator
      const result = await this.#orchestrator.orchestrateGeneration(
        entityId,
        recipeId
      );

      if (result.success) {
        this.#logger.info(
          `AnatomyGenerationService: Successfully generated anatomy for entity '${entityId}' with ${result.entityCount} parts`
        );
        return true;
      }

      return false;
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
   * @returns {Promise<{generated: string[], skipped: string[], failed: Array<{entityId: string, error: string}>}>} Result lists of processed entity IDs.
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
        results.failed.push({
          entityId,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }
}
