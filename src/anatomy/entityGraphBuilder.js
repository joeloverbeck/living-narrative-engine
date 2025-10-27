// src/anatomy/entityGraphBuilder.js

/**
 * @file Service responsible for creating and connecting anatomy entities
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./partSelectionService.js').PartSelectionService} PartSelectionService */

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
  /** @type {PartSelectionService} */
  #partSelectionService;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {IDataRegistry} deps.dataRegistry
   * @param {ILogger} deps.logger
   * @param {PartSelectionService} deps.partSelectionService
   */
  constructor({ entityManager, dataRegistry, logger, partSelectionService }) {
    if (!entityManager) {
      throw new InvalidArgumentError('entityManager is required');
    }
    if (!dataRegistry) {
      throw new InvalidArgumentError('dataRegistry is required');
    }
    if (!logger) {
      throw new InvalidArgumentError('logger is required');
    }
    if (!partSelectionService) {
      throw new InvalidArgumentError('partSelectionService is required');
    }

    this.#entityManager = entityManager;
    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
    this.#partSelectionService = partSelectionService;
  }

  /**
   * Creates the root entity of the anatomy
   *
   * @param {string} rootDefinitionId - Definition ID for the root entity
   * @param {object} recipe - The recipe being used
   * @param {string} [ownerId] - Optional owner entity ID
   * @returns {Promise<string>} The created root entity ID
   */
  async createRootEntity(rootDefinitionId, recipe, ownerId) {
    // Check if recipe has a torso override
    let actualRootDefinitionId = rootDefinitionId;

    if (recipe.slots?.torso) {
      const torsoSlot = recipe.slots.torso;

      // First check for explicit preferId (existing behavior)
      if (torsoSlot.preferId) {
        const overrideDef = this.#dataRegistry.get(
          'entityDefinitions',
          torsoSlot.preferId
        );

        if (overrideDef) {
          const anatomyPart = overrideDef.components?.['anatomy:part'];
          if (anatomyPart && anatomyPart.subType === 'torso') {
            actualRootDefinitionId = torsoSlot.preferId;
            this.#logger.debug(
              `EntityGraphBuilder: Using recipe torso override '${actualRootDefinitionId}' instead of blueprint default '${rootDefinitionId}'`
            );
          } else {
            this.#logger.warn(
              `EntityGraphBuilder: Recipe torso override '${torsoSlot.preferId}' is not a valid torso part, using blueprint default`
            );
          }
        } else {
          this.#logger.warn(
            `EntityGraphBuilder: Recipe torso override '${torsoSlot.preferId}' not found in registry, using blueprint default`
          );
        }
      }
      // NEW: If no preferId but properties are specified, use PartSelectionService
      else if (
        torsoSlot.properties &&
        Object.keys(torsoSlot.properties).length > 0
      ) {
        try {
          this.#logger.debug(
            `EntityGraphBuilder: No preferId specified for torso, attempting property-based selection`
          );

          // Use PartSelectionService to find torso based on properties
          const selectedTorsoId = await this.#partSelectionService.selectPart(
            {
              partType: 'torso',
              components: ['anatomy:part'],
            },
            ['torso'], // allowedTypes
            torsoSlot, // recipeSlot with properties
            Math.random // RNG function
          );

          if (selectedTorsoId) {
            actualRootDefinitionId = selectedTorsoId;
            this.#logger.debug(
              `EntityGraphBuilder: Selected torso '${actualRootDefinitionId}' based on recipe properties instead of blueprint default '${rootDefinitionId}'`
            );
          } else {
            this.#logger.warn(
              `EntityGraphBuilder: No torso found matching recipe properties, using blueprint default '${rootDefinitionId}'`
            );
          }
        } catch (error) {
          this.#logger.warn(
            `EntityGraphBuilder: Property-based torso selection failed: ${error.message}, using blueprint default '${rootDefinitionId}'`
          );
        }
      }
    }

    const rootEntity = await this.#entityManager.createEntityInstance(
      actualRootDefinitionId
    );

    // Verify entity was created successfully before proceeding with component addition
    // Use exponential backoff retry for better reliability under stress conditions
    let verifyEntity = this.#entityManager.getEntityInstance(rootEntity.id);
    let retries = 0;
    const maxRetries = 5;
    
    while (!verifyEntity && retries < maxRetries) {
      this.#logger.warn(
        `EntityGraphBuilder: Created entity ${rootEntity.id} not immediately available, retry ${retries + 1}/${maxRetries}`,
        { entityId: rootEntity.id, definitionId: actualRootDefinitionId }
      );
      
      // Exponential backoff: 10ms, 20ms, 40ms
      const delay = 10 * Math.pow(2, retries);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      verifyEntity = this.#entityManager.getEntityInstance(rootEntity.id);
      retries++;
    }
    
    if (!verifyEntity) {
      this.#logger.error(
        `EntityGraphBuilder: Entity creation-verification failed after ${maxRetries} retries`,
        { entityId: rootEntity.id, definitionId: actualRootDefinitionId }
      );
      throw new Error(`Entity creation-verification race condition: ${rootEntity.id}`);
    }

    if (ownerId) {
      // Add ownership component if specified
      await this.#entityManager.addComponent(rootEntity.id, 'core:owned_by', {
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
   * @param {string} [socketOrientation] - Orientation from the parent socket (optional)
   * @returns {Promise<string|null>} Created entity ID or null on failure
   */
  async createAndAttachPart(
    parentId,
    socketId,
    partDefinitionId,
    ownerId,
    socketOrientation
  ) {
    try {
      // Create the child entity
      const childEntity =
        await this.#entityManager.createEntityInstance(partDefinitionId);

      // Verify entity was created successfully before proceeding
      const verifyChildEntity = this.#entityManager.getEntityInstance(childEntity.id);
      if (!verifyChildEntity) {
        this.#logger.error(
          `EntityGraphBuilder: Created child entity ${childEntity.id} not immediately available`,
          { entityId: childEntity.id, partDefinitionId, parentId }
        );
        // Wait briefly and retry verification
        await new Promise(resolve => setTimeout(resolve, 10));
        const retryVerify = this.#entityManager.getEntityInstance(childEntity.id);
        if (!retryVerify) {
          throw new Error(`Child entity creation-verification race condition: ${childEntity.id}`);
        }
      }

      // Add ownership component if specified
      if (ownerId) {
        await this.#entityManager.addComponent(
          childEntity.id,
          'core:owned_by',
          {
            ownerId,
          }
        );
      }

      // Add joint component to establish the connection
      await this.#entityManager.addComponent(childEntity.id, 'anatomy:joint', {
        parentId: parentId,
        socketId: socketId,
      });

      // Propagate orientation from parent socket to child's anatomy:part component
      if (socketOrientation) {
        const anatomyPart = this.#entityManager.getComponentData(
          childEntity.id,
          'anatomy:part'
        );
        if (anatomyPart) {
          // Update the anatomy:part component with the orientation
          await this.#entityManager.addComponent(
            childEntity.id,
            'anatomy:part',
            {
              ...anatomyPart,
              orientation: socketOrientation,
            }
          );
          this.#logger.debug(
            `EntityGraphBuilder: Propagated orientation '${socketOrientation}' to child entity '${childEntity.id}'`
          );
        }
      }

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
   * @returns {Promise<void>}
   */
  async setEntityName(entityId, name) {
    await this.#entityManager.addComponent(entityId, 'core:name', {
      text: name,
    });

    this.#logger.debug(
      `EntityGraphBuilder: Set name '${name}' on entity '${entityId}'`
    );
  }

  /**
   * Adds generated sockets to an entity
   *
   * @param {string} entityId - Entity to add sockets to
   * @param {Array<object>} sockets - Socket definitions to add
   */
  async addSocketsToEntity(entityId, sockets) {
    const existingSocketsComponent = this.#entityManager.getComponentData(
      entityId,
      'anatomy:sockets'
    );

    const mergedSockets = [
      ...(existingSocketsComponent?.sockets || []),
      ...sockets,
    ];

    await this.#entityManager.addComponent(entityId, 'anatomy:sockets', {
      ...(existingSocketsComponent || {}),
      sockets: mergedSockets,
    });

    this.#logger.debug(
      `EntityGraphBuilder: Added ${sockets.length} sockets to entity '${entityId}'`
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
