// src/anatomy/entityGraphBuilder.js

/**
 * @file Service responsible for creating and connecting anatomy entities
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Service that handles entity creation and graph assembly for anatomy
 */
export class EntityGraphBuilder {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {IDataRegistry} */
  #dataRegistry;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {IDataRegistry} deps.dataRegistry
   * @param {ILogger} deps.logger
   */
  constructor({ entityManager, dataRegistry, logger }) {
    if (!entityManager) {
      throw new InvalidArgumentError('entityManager is required');
    }
    if (!dataRegistry) {
      throw new InvalidArgumentError('dataRegistry is required');
    }
    if (!logger) {
      throw new InvalidArgumentError('logger is required');
    }

    this.#entityManager = entityManager;
    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Creates the root entity of the anatomy
   *
   * @param {string} rootDefinitionId - Definition ID for the root entity
   * @param {object} recipe - The recipe being used
   * @param {string} [ownerId] - Optional owner entity ID
   * @returns {string} The created root entity ID
   */
  createRootEntity(rootDefinitionId, recipe, ownerId) {
    // Check if recipe has a torso override
    let actualRootDefinitionId = rootDefinitionId;

    if (recipe.slots?.torso?.preferId) {
      const overrideDef = this.#dataRegistry.get(
        'entityDefinitions',
        recipe.slots.torso.preferId
      );

      if (overrideDef) {
        const anatomyPart = overrideDef.components?.['anatomy:part'];
        if (anatomyPart && anatomyPart.subType === 'torso') {
          actualRootDefinitionId = recipe.slots.torso.preferId;
          this.#logger.debug(
            `EntityGraphBuilder: Using recipe torso override '${actualRootDefinitionId}' instead of blueprint default '${rootDefinitionId}'`
          );
        } else {
          this.#logger.warn(
            `EntityGraphBuilder: Recipe torso override '${recipe.slots.torso.preferId}' is not a valid torso part, using blueprint default`
          );
        }
      } else {
        this.#logger.warn(
          `EntityGraphBuilder: Recipe torso override '${recipe.slots.torso.preferId}' not found in registry, using blueprint default`
        );
      }
    }

    const rootEntity = this.#entityManager.createEntityInstance(
      actualRootDefinitionId
    );

    if (ownerId) {
      // Add ownership component if specified
      this.#entityManager.addComponent(rootEntity.id, 'core:owned_by', {
        ownerId,
      });
    }

    this.#logger.info(
      `EntityGraphBuilder: Created root entity '${rootEntity.id}' from definition '${actualRootDefinitionId}'`
    );

    return rootEntity.id;
  }

  /**
   * Creates and attaches a part to a parent via a socket
   *
   * @param {string} parentId - Parent entity ID
   * @param {string} socketId - Socket ID on parent
   * @param {string} partDefinitionId - Definition ID for the part
   * @param {string} [ownerId] - Owner ID to set on the created part (optional)
   * @returns {string|null} Created entity ID or null on failure
   */
  createAndAttachPart(parentId, socketId, partDefinitionId, ownerId) {
    try {
      // Create the child entity
      const childEntity =
        this.#entityManager.createEntityInstance(partDefinitionId);

      // Add ownership component if specified
      if (ownerId) {
        this.#entityManager.addComponent(childEntity.id, 'core:owned_by', {
          ownerId,
        });
      }

      // Add joint component to establish the connection
      this.#entityManager.addComponent(childEntity.id, 'anatomy:joint', {
        parentId: parentId,
        socketId: socketId,
      });

      this.#logger.debug(
        `EntityGraphBuilder: Created entity '${childEntity.id}' from definition '${partDefinitionId}' and attached to socket '${socketId}' on parent '${parentId}'`
      );

      return childEntity.id;
    } catch (error) {
      this.#logger.error(
        `EntityGraphBuilder: Failed to create and attach part '${partDefinitionId}'`,
        { error }
      );
      return null;
    }
  }

  /**
   * Sets the name of an entity
   *
   * @param {string} entityId - Entity to name
   * @param {string} name - Name to set
   */
  setEntityName(entityId, name) {
    this.#entityManager.addComponent(entityId, 'core:name', {
      text: name,
    });

    this.#logger.debug(
      `EntityGraphBuilder: Set name '${name}' on entity '${entityId}'`
    );
  }

  /**
   * Gets the part type from an entity
   *
   * @param {string} entityId - Entity ID
   * @returns {string} Part type or 'unknown'
   */
  getPartType(entityId) {
    const anatomyPart = this.#entityManager.getComponentData(
      entityId,
      'anatomy:part'
    );
    return anatomyPart?.subType || 'unknown';
  }

  /**
   * Cleans up entities if validation fails
   *
   * @param {string[]} entityIds - Entity IDs to remove
   * @returns {Promise<void>}
   */
  async cleanupEntities(entityIds) {
    this.#logger.debug(
      `EntityGraphBuilder: Cleaning up ${entityIds.length} entities after validation failure`
    );

    // Remove in reverse order to handle dependencies
    for (let i = entityIds.length - 1; i >= 0; i--) {
      try {
        await this.#entityManager.removeEntityInstance(entityIds[i]);
      } catch (error) {
        this.#logger.error(
          `EntityGraphBuilder: Failed to cleanup entity '${entityIds[i]}'`,
          { error }
        );
      }
    }
  }

  /**
   * Validates that an entity exists and has expected components
   *
   * @param {string} entityId - Entity ID to validate
   * @returns {boolean} True if entity is valid
   */
  validateEntity(entityId) {
    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      this.#logger.error(`EntityGraphBuilder: Entity '${entityId}' not found`);
      return false;
    }

    // Check for anatomy:part component
    const anatomyPart = this.#entityManager.getComponentData(
      entityId,
      'anatomy:part'
    );
    if (!anatomyPart) {
      this.#logger.error(
        `EntityGraphBuilder: Entity '${entityId}' missing anatomy:part component`
      );
      return false;
    }

    return true;
  }
}

export default EntityGraphBuilder;
