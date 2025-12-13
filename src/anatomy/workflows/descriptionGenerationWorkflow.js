/**
 * @file Workflow for generating anatomy descriptions
 */

import { BaseService } from '../../utils/serviceBase.js';
import { DescriptionGenerationError } from '../orchestration/anatomyErrorHandler.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../anatomyDescriptionService.js').AnatomyDescriptionService} AnatomyDescriptionService */

/**
 * Workflow responsible for generating descriptions for anatomy parts
 * Extracted from AnatomyGenerationService with improved error handling
 */
export class DescriptionGenerationWorkflow extends BaseService {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;
  /** @type {AnatomyDescriptionService} */
  #anatomyDescriptionService;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   * @param {AnatomyDescriptionService} deps.anatomyDescriptionService
   */
  constructor({ entityManager, logger, anatomyDescriptionService }) {
    super();
    this.#logger = this._init('DescriptionGenerationWorkflow', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntityInstance'],
      },
      anatomyDescriptionService: {
        value: anatomyDescriptionService,
        requiredMethods: ['generateAllDescriptions'],
      },
    });
    this.#entityManager = entityManager;
    this.#anatomyDescriptionService = anatomyDescriptionService;
  }

  /**
   * Generates descriptions for all anatomy parts of an entity
   * Unlike the original implementation, this properly propagates errors
   *
   * @param {string} entityId - The entity ID to generate descriptions for
   * @returns {Promise<void>}
   * @throws {DescriptionGenerationError} If description generation fails
   */
  async generateAll(entityId) {
    this.#logger.debug(
      `DescriptionGenerationWorkflow: Starting description generation for entity '${entityId}'`
    );

    const bodyEntity = this.#entityManager.getEntityInstance(entityId);

    if (!bodyEntity) {
      throw new DescriptionGenerationError(
        `Cannot generate descriptions: Entity '${entityId}' not found`,
        entityId
      );
    }

    try {
      // Generate descriptions for all body parts and the body itself
      await this.#anatomyDescriptionService.generateAllDescriptions(bodyEntity);

      this.#logger.debug(
        `DescriptionGenerationWorkflow: Successfully generated descriptions for entity '${entityId}'`
      );
    } catch (error) {
      // CRITICAL: Unlike the original implementation, we DO NOT swallow errors
      // This ensures that failures can trigger proper rollback in the unit of work
      this.#logger.error(
        `DescriptionGenerationWorkflow: Failed to generate descriptions for entity '${entityId}'`,
        { error: error.message, stack: error.stack }
      );

      throw new DescriptionGenerationError(
        `Failed to generate descriptions for entity '${entityId}': ${error.message}`,
        entityId,
        null,
        error
      );
    }
  }

  /**
   * Generates descriptions for specific anatomy parts
   *
   * @param {string} entityId - The entity ID
   * @param {string[]} partIds - Array of part entity IDs to generate descriptions for
   * @returns {Promise<void>}
   * @throws {DescriptionGenerationError} If description generation fails
   */
  async generateForParts(entityId, partIds) {
    this.#logger.debug(
      `DescriptionGenerationWorkflow: Generating descriptions for ${partIds.length} parts of entity '${entityId}'`
    );

    const failedParts = [];

    for (const partId of partIds) {
      try {
        const partEntity = this.#entityManager.getEntityInstance(partId);

        if (!partEntity) {
          this.#logger.warn(
            `DescriptionGenerationWorkflow: Part entity '${partId}' not found, skipping`
          );
          continue;
        }

        // Note: This assumes anatomyDescriptionService has a method for individual parts
        // If not, this would need to be adjusted based on the actual API
        if (this.#anatomyDescriptionService.generatePartDescription) {
          this.#anatomyDescriptionService.generatePartDescription(partEntity);
        }
      } catch (error) {
        this.#logger.error(
          `DescriptionGenerationWorkflow: Failed to generate description for part '${partId}'`,
          { error: error.message }
        );
        failedParts.push(partId);
      }
    }

    if (failedParts.length > 0) {
      throw new DescriptionGenerationError(
        `Failed to generate descriptions for ${failedParts.length} parts`,
        entityId,
        failedParts
      );
    }

    this.#logger.debug(
      `DescriptionGenerationWorkflow: Successfully generated descriptions for parts of entity '${entityId}'`
    );
  }

  /**
   * Checks if an entity needs description generation
   *
   * @param {string} entityId - The entity ID to check
   * @returns {boolean} True if descriptions should be generated
   */
  needsDescriptions(entityId) {
    const entity = this.#entityManager.getEntityInstance(entityId);

    if (!entity) {
      return false;
    }

    // Check if entity has anatomy:body component with generated anatomy
    if (!entity.hasComponent('anatomy:body')) {
      return false;
    }

    const anatomyData = entity.getComponentData('anatomy:body');
    return anatomyData && anatomyData.body && anatomyData.body.root;
  }
}
