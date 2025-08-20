/**
 * @file Orchestrator for anatomy generation operations
 */

import { BaseService } from '../../utils/serviceBase.js';
import { AnatomyUnitOfWork } from './anatomyUnitOfWork.js';
import { AnatomyErrorHandler } from './anatomyErrorHandler.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../constants/componentIds.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../workflows/anatomyGenerationWorkflow.js').AnatomyGenerationWorkflow} AnatomyGenerationWorkflow */
/** @typedef {import('../workflows/descriptionGenerationWorkflow.js').DescriptionGenerationWorkflow} DescriptionGenerationWorkflow */
/** @typedef {import('../workflows/graphBuildingWorkflow.js').GraphBuildingWorkflow} GraphBuildingWorkflow */

/**
 * Orchestrates the complete anatomy generation process
 * Coordinates workflows and ensures transactional consistency
 */
export class AnatomyOrchestrator extends BaseService {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;
  /** @type {AnatomyGenerationWorkflow} */
  #generationWorkflow;
  /** @type {DescriptionGenerationWorkflow} */
  #descriptionWorkflow;
  /** @type {GraphBuildingWorkflow} */
  #graphBuildingWorkflow;
  /** @type {AnatomyErrorHandler} */
  #errorHandler;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   * @param {AnatomyGenerationWorkflow} deps.generationWorkflow
   * @param {DescriptionGenerationWorkflow} deps.descriptionWorkflow
   * @param {GraphBuildingWorkflow} deps.graphBuildingWorkflow
   * @param {AnatomyErrorHandler} deps.errorHandler
   */
  constructor({
    entityManager,
    logger,
    generationWorkflow,
    descriptionWorkflow,
    graphBuildingWorkflow,
    errorHandler,
  }) {
    super();
    this.#logger = this._init('AnatomyOrchestrator', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntityInstance', 'addComponent'],
      },
      generationWorkflow: {
        value: generationWorkflow,
        requiredMethods: ['generate', 'validateRecipe'],
      },
      descriptionWorkflow: {
        value: descriptionWorkflow,
        requiredMethods: ['generateAll'],
      },
      graphBuildingWorkflow: {
        value: graphBuildingWorkflow,
        requiredMethods: ['buildCache'],
      },
      errorHandler: {
        value: errorHandler,
        requiredMethods: ['handle'],
      },
    });
    this.#entityManager = entityManager;
    this.#generationWorkflow = generationWorkflow;
    this.#descriptionWorkflow = descriptionWorkflow;
    this.#graphBuildingWorkflow = graphBuildingWorkflow;
    this.#errorHandler = errorHandler;
  }

  /**
   * Orchestrates the complete anatomy generation process
   *
   * @param {string} entityId - The entity to generate anatomy for
   * @param {string} recipeId - The recipe ID to use
   * @returns {Promise<{success: boolean, entityCount: number, rootId: string}>}
   * @throws {Error} If generation fails
   */
  async orchestrateGeneration(entityId, recipeId) {
    this.#logger.info(
      `AnatomyOrchestrator: Starting anatomy generation for entity '${entityId}' with recipe '${recipeId}'`
    );

    const unitOfWork = new AnatomyUnitOfWork({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    try {
      // Phase 1: Validate recipe and get blueprint ID
      const blueprintId = this.#generationWorkflow.validateRecipe(recipeId);

      this.#logger.debug(
        `AnatomyOrchestrator: Recipe '${recipeId}' validated, using blueprint '${blueprintId}'`
      );

      // Phase 2: Generate anatomy graph
      const graphResult = await unitOfWork.execute(async () => {
        return await this.#generationWorkflow.generate(blueprintId, recipeId, {
          ownerId: entityId,
        });
      });

      // Track all created entities for potential rollback
      unitOfWork.trackEntities(graphResult.entities);

      this.#logger.debug(
        `AnatomyOrchestrator: Generated ${graphResult.entities.length} anatomy parts`
      );

      // Phase 3: Update parent entity with anatomy structure
      await this.#updateParentEntity(entityId, recipeId, graphResult);

      // Phase 4: Build adjacency cache for efficient traversal
      await unitOfWork.execute(async () => {
        await this.#graphBuildingWorkflow.buildCache(graphResult.rootId);
      });

      // Phase 5: Generate descriptions (with proper error handling)
      await unitOfWork.execute(async () => {
        await this.#descriptionWorkflow.generateAll(entityId);
      });

      // Success - commit the unit of work
      await unitOfWork.commit();

      this.#logger.info(
        `AnatomyOrchestrator: Successfully completed anatomy generation for entity '${entityId}' with ${graphResult.entities.length} parts`
      );

      return {
        success: true,
        entityCount: graphResult.entities.length,
        rootId: graphResult.rootId,
      };
    } catch (error) {
      // Unit of work automatically rolled back on error
      const wrappedError = this.#errorHandler.handle(error, {
        operation: 'orchestration',
        entityId,
        recipeId,
      });

      this.#logger.error(
        `AnatomyOrchestrator: Failed to generate anatomy for entity '${entityId}'`,
        {
          error: wrappedError.message,
          trackedEntities: unitOfWork.trackedEntityCount,
          wasRolledBack: unitOfWork.isRolledBack,
        }
      );

      throw wrappedError;
    }
  }

  /**
   * Updates the parent entity with the generated anatomy structure
   *
   * @private
   * @param {string} entityId - The entity ID
   * @param {string} recipeId - The recipe ID
   * @param {object} graphResult - The graph generation result
   * @returns {Promise<void>}
   */
  async #updateParentEntity(entityId, recipeId, graphResult) {
    const entity = this.#entityManager.getEntityInstance(entityId);

    if (!entity) {
      throw new Error(
        `Entity '${entityId}' not found after anatomy generation`
      );
    }

    // Get existing anatomy data to preserve any additional fields
    const existingData =
      entity.getComponentData(ANATOMY_BODY_COMPONENT_ID) || {};

    // Update with the generated anatomy structure
    // Convert Map to plain object for backward compatibility
    const partsObject =
      graphResult.partsMap instanceof Map
        ? Object.fromEntries(graphResult.partsMap)
        : graphResult.partsMap;

    // Preserve any existing body descriptors from the workflow
    const existingBodyDescriptors = existingData.body?.descriptors;

    const updatedData = {
      ...existingData,
      recipeId, // Ensure recipe ID is preserved
      body: {
        root: graphResult.rootId,
        parts: partsObject,
        // Preserve descriptors if they exist (added by the workflow)
        ...(existingBodyDescriptors && {
          descriptors: existingBodyDescriptors,
        }),
      },
    };

    await this.#entityManager.addComponent(
      entityId,
      ANATOMY_BODY_COMPONENT_ID,
      updatedData
    );

    this.#logger.debug(
      `AnatomyOrchestrator: Updated entity '${entityId}' with anatomy structure`
    );
  }

  /**
   * Checks if an entity needs anatomy generation
   *
   * @param {string} entityId - The entity ID to check
   * @returns {{needsGeneration: boolean, reason: string}}
   */
  checkGenerationNeeded(entityId) {
    const entity = this.#entityManager.getEntityInstance(entityId);

    if (!entity) {
      return {
        needsGeneration: false,
        reason: 'Entity not found',
      };
    }

    if (!entity.hasComponent(ANATOMY_BODY_COMPONENT_ID)) {
      return {
        needsGeneration: false,
        reason: 'Entity has no anatomy:body component',
      };
    }

    const anatomyData = entity.getComponentData(ANATOMY_BODY_COMPONENT_ID);

    if (!anatomyData || !anatomyData.recipeId) {
      return {
        needsGeneration: false,
        reason: 'anatomy:body component has no recipeId',
      };
    }

    if (anatomyData.body) {
      return {
        needsGeneration: false,
        reason: 'Anatomy already generated',
      };
    }

    return {
      needsGeneration: true,
      reason: 'Ready for generation',
    };
  }
}
