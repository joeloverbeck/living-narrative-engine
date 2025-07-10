/**
 * @file Service responsible for persisting descriptions to entities
 * Extracted from AnatomyDescriptionService to follow Single Responsibility Principle
 */

import { DESCRIPTION_COMPONENT_ID } from '../constants/componentIds.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Handles persistence of descriptions to entity components
 */
export class DescriptionPersistenceService {
  /** @type {ILogger} */
  #logger;
  /** @type {IEntityManager} */
  #entityManager;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {IEntityManager} deps.entityManager
   */
  constructor({ logger, entityManager }) {
    if (!logger) throw new Error('logger is required');
    if (!entityManager) throw new Error('entityManager is required');

    this.#logger = logger;
    this.#entityManager = entityManager;
  }

  /**
   * Update the description component for an entity
   *
   * @param {string} entityId - The entity to update
   * @param {string} description - The new description text
   * @returns {boolean} True if update was successful
   */
  updateDescription(entityId, description) {
    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      if (!entity) {
        this.#logger.warn(
          `DescriptionPersistenceService: Entity '${entityId}' not found`
        );
        return false;
      }

      // EntityManager's addComponent handles both adding and updating
      this.#entityManager.addComponent(entityId, DESCRIPTION_COMPONENT_ID, {
        text: description,
        lastUpdated: new Date().toISOString(),
      });

      this.#logger.debug(
        `DescriptionPersistenceService: Updated description for entity '${entityId}'`
      );
      return true;
    } catch (error) {
      this.#logger.error(
        `DescriptionPersistenceService: Failed to update description for entity '${entityId}'`,
        error
      );
      return false;
    }
  }

  /**
   * Update descriptions for multiple entities
   *
   * @param {Map<string, string>} descriptionsMap - Map of entityId to description
   * @returns {{successful: number, failed: string[]}} Update results
   */
  updateMultipleDescriptions(descriptionsMap) {
    let successful = 0;
    const failed = [];

    for (const [entityId, description] of descriptionsMap) {
      if (this.updateDescription(entityId, description)) {
        successful++;
      } else {
        failed.push(entityId);
      }
    }

    this.#logger.info(
      `DescriptionPersistenceService: Updated ${successful} descriptions, ${failed.length} failed`
    );

    return { successful, failed };
  }

  /**
   * Remove description from an entity
   *
   * @param {string} entityId - The entity to remove description from
   * @returns {boolean} True if removal was successful
   */
  removeDescription(entityId) {
    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      if (!entity) {
        return false;
      }

      if (entity.hasComponent(DESCRIPTION_COMPONENT_ID)) {
        this.#entityManager.removeComponent(entityId, DESCRIPTION_COMPONENT_ID);
        this.#logger.debug(
          `DescriptionPersistenceService: Removed description from entity '${entityId}'`
        );
        return true;
      }

      return false;
    } catch (error) {
      this.#logger.error(
        `DescriptionPersistenceService: Failed to remove description from entity '${entityId}'`,
        error
      );
      return false;
    }
  }

  /**
   * Get the current description for an entity
   *
   * @param {string} entityId - The entity to get description for
   * @returns {{text: string, lastUpdated?: string}|null} The description data or null
   */
  getDescription(entityId) {
    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      if (!entity) {
        return null;
      }

      return entity.getComponentData(DESCRIPTION_COMPONENT_ID);
    } catch (error) {
      this.#logger.error(
        `DescriptionPersistenceService: Failed to get description for entity '${entityId}'`,
        error
      );
      return null;
    }
  }

  /**
   * Check if an entity has a description
   *
   * @param {string} entityId - The entity to check
   * @returns {boolean} True if entity has a description
   */
  hasDescription(entityId) {
    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      return entity ? entity.hasComponent(DESCRIPTION_COMPONENT_ID) : false;
    } catch (error) {
      return false;
    }
  }
}

export default DescriptionPersistenceService;
