/**
 * @file Service responsible for orchestrating full body descriptions
 * Extracted from AnatomyDescriptionService to follow Single Responsibility Principle
 */

import {
  ANATOMY_BODY_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * Orchestrates the generation of full body descriptions
 */
export class BodyDescriptionOrchestrator {
  /** @type {ILogger} */
  #logger;
  /** @type {object} */
  #bodyDescriptionComposer;
  /** @type {object} */
  #bodyGraphService;
  /** @type {ISafeEventDispatcher} */
  #eventDispatcher;
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {object} */
  #partDescriptionGenerator;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {object} deps.bodyDescriptionComposer
   * @param {object} deps.bodyGraphService
   * @param {ISafeEventDispatcher} deps.eventDispatcher
   * @param {IEntityManager} deps.entityManager
   * @param {object} deps.partDescriptionGenerator
   */
  constructor({
    logger,
    bodyDescriptionComposer,
    bodyGraphService,
    eventDispatcher,
    entityManager,
    partDescriptionGenerator,
  }) {
    if (!logger) throw new Error('logger is required');
    if (!bodyDescriptionComposer)
      throw new Error('bodyDescriptionComposer is required');
    if (!bodyGraphService) throw new Error('bodyGraphService is required');
    if (!eventDispatcher) throw new Error('eventDispatcher is required');
    if (!entityManager) throw new Error('entityManager is required');
    if (!partDescriptionGenerator)
      throw new Error('partDescriptionGenerator is required');

    this.#logger = logger;
    this.#bodyDescriptionComposer = bodyDescriptionComposer;
    this.#bodyGraphService = bodyGraphService;
    this.#eventDispatcher = eventDispatcher;
    this.#entityManager = entityManager;
    this.#partDescriptionGenerator = partDescriptionGenerator;
  }

  /**
   * Generate descriptions for all parts of a body and the body itself
   *
   * @param {object} bodyEntity - The entity with anatomy:body component
   * @returns {Promise<{bodyDescription: string, partDescriptions: Map<string, string>}>}
   */
  async generateAllDescriptions(bodyEntity) {
    if (!bodyEntity || !bodyEntity.hasComponent(ANATOMY_BODY_COMPONENT_ID)) {
      throw new Error('Entity must have an anatomy:body component');
    }

    const bodyComponent = bodyEntity.getComponentData(
      ANATOMY_BODY_COMPONENT_ID
    );
    if (!bodyComponent.body || !bodyComponent.body.root) {
      throw new Error('Body component must have a body.root property');
    }

    // Generate descriptions for all body parts
    const allPartIds = this.#bodyGraphService.getAllParts(bodyComponent.body);
    const partDescriptions =
      this.#partDescriptionGenerator.generateMultiplePartDescriptions(
        allPartIds
      );

    // Generate the full body description
    const bodyDescription = await this.generateBodyDescription(bodyEntity);

    this.#logger.debug(
      `BodyDescriptionOrchestrator: Generated descriptions for body '${bodyEntity.id}' with ${partDescriptions.size} parts`
    );

    return { bodyDescription, partDescriptions };
  }

  /**
   * Generate the full body description
   *
   * @param {object} bodyEntity - The entity with anatomy:body component
   * @returns {Promise<string>} The generated body description
   */
  async generateBodyDescription(bodyEntity) {
    const description =
      await this.#bodyDescriptionComposer.composeDescription(bodyEntity);

    // Check if description is empty and dispatch error if so
    if (!description || description.trim() === '') {
      const entityName = bodyEntity.getComponentData('core:name');
      const nameText = entityName ? entityName.text : bodyEntity.id;

      await this.#eventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: `Failed to generate body description for entity "${nameText}": Description is empty`,
        details: {
          raw: `Entity ID: ${bodyEntity.id}, Recipe ID: ${bodyEntity.getComponentData(ANATOMY_BODY_COMPONENT_ID)?.recipeId || 'unknown'}`,
          timestamp: new Date().toISOString(),
        },
      });
    }

    this.#logger.debug(
      `BodyDescriptionOrchestrator: Generated body description for '${bodyEntity.id}'`
    );

    return description;
  }

  /**
   * Get or generate body description for an entity
   *
   * @param {object} entity - The entity to get description for
   * @returns {Promise<string|null>} The description text or null
   */
  async getOrGenerateBodyDescription(entity) {
    if (!entity) {
      return null;
    }

    // Check if entity has anatomy:body component
    if (!entity.hasComponent(ANATOMY_BODY_COMPONENT_ID)) {
      // Not an anatomy entity, return existing description if any
      const descComponent = entity.getComponentData(DESCRIPTION_COMPONENT_ID);
      return descComponent ? descComponent.text : null;
    }

    // Check if description already exists and is current
    const existingDesc = entity.getComponentData(DESCRIPTION_COMPONENT_ID);
    if (
      existingDesc &&
      existingDesc.text &&
      this.#isDescriptionCurrent(entity, existingDesc)
    ) {
      return existingDesc.text;
    }

    // Generate new description
    const composedDescription =
      await this.#bodyDescriptionComposer.composeDescription(entity);
    if (!composedDescription) {
      return null;
    }

    this.#logger.debug(
      `BodyDescriptionOrchestrator: Generated new description for entity '${entity.id}'`
    );

    return composedDescription;
  }

  /**
   * Check if the current description is up to date
   *
   * @param {object} entity - The entity to check
   * @param {{metadata?: {isCurrent?: boolean}}} existingDescription - Existing description data
   * @returns {boolean} Whether the description is current
   * @private
   */
  #isDescriptionCurrent(entity, existingDescription) {
    // Allow description components to mark themselves as current via metadata
    if (existingDescription?.metadata?.isCurrent === true) {
      return true;
    }

    // Future enhancements could compare timestamps or checksums here
    return false;
  }
}

export default BodyDescriptionOrchestrator;
