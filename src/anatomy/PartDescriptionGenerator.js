/**
 * @file Service responsible for generating descriptions for individual anatomy parts
 * Extracted from AnatomyDescriptionService to follow Single Responsibility Principle
 */

import {
  ANATOMY_PART_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../constants/componentIds.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Generates descriptions for individual anatomy parts
 */
export class PartDescriptionGenerator {
  /** @type {ILogger} */
  #logger;
  /** @type {object} */
  #bodyPartDescriptionBuilder;
  /** @type {IEntityManager} */
  #entityManager;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {object} deps.bodyPartDescriptionBuilder
   * @param {IEntityManager} deps.entityManager
   */
  constructor({ logger, bodyPartDescriptionBuilder, entityManager }) {
    if (!logger) throw new Error('logger is required');
    if (!bodyPartDescriptionBuilder)
      throw new Error('bodyPartDescriptionBuilder is required');
    if (!entityManager) throw new Error('entityManager is required');

    this.#logger = logger;
    this.#bodyPartDescriptionBuilder = bodyPartDescriptionBuilder;
    this.#entityManager = entityManager;
  }

  /**
   * Generate description for a single body part
   *
   * @param {string} partId - The entity ID of the body part
   * @returns {string|null} The generated description or null if part not found
   */
  generatePartDescription(partId) {
    const entity = this.#entityManager.getEntityInstance(partId);
    if (!entity || !entity.hasComponent(ANATOMY_PART_COMPONENT_ID)) {
      this.#logger.debug(
        `PartDescriptionGenerator: Entity '${partId}' is not an anatomy part`
      );
      return null;
    }

    // Build the description
    const description =
      this.#bodyPartDescriptionBuilder.buildDescription(entity);
    if (!description) {
      this.#logger.debug(
        `PartDescriptionGenerator: No description generated for part '${partId}'`
      );
      return null;
    }

    this.#logger.debug(
      `PartDescriptionGenerator: Generated description for part '${partId}'`
    );
    return description;
  }

  /**
   * Generate descriptions for multiple body parts
   *
   * @param {string[]} partIds - Array of entity IDs
   * @returns {Map<string, string>} Map of partId to description
   */
  generateMultiplePartDescriptions(partIds) {
    const descriptions = new Map();

    for (const partId of partIds) {
      const description = this.generatePartDescription(partId);
      if (description) {
        descriptions.set(partId, description);
      }
    }

    this.#logger.debug(
      `PartDescriptionGenerator: Generated ${descriptions.size} descriptions out of ${partIds.length} parts`
    );

    return descriptions;
  }

  /**
   * Check if a part needs description regeneration
   * Future implementation can include timestamp or checksum tracking
   *
   * @param {string} partId - The entity ID of the body part
   * @returns {boolean} True if description needs regeneration
   */
  needsRegeneration(partId) {
    const entity = this.#entityManager.getEntityInstance(partId);
    if (!entity) return false;

    const existingDescription = entity.getComponentData(
      DESCRIPTION_COMPONENT_ID
    );
    if (!existingDescription || !existingDescription.text) {
      return true;
    }

    // For now, we'll always regenerate to ensure accuracy
    // In the future, we could add timestamp tracking or checksums
    return true;
  }
}

export default PartDescriptionGenerator;
