/**
 * @file Strategy for resolving blueprint slots to anatomy attachment points
 * @see src/interfaces/ISlotResolutionStrategy.js
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../../utils/loggerUtils.js';

/** @typedef {import('../../../interfaces/ISlotResolutionStrategy.js')} ISlotResolutionStrategy */
/** @typedef {import('../../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../../interfaces/IAnatomyBlueprintRepository.js').IAnatomyBlueprintRepository} IAnatomyBlueprintRepository */
/** @typedef {import('../../../interfaces/IAnatomySocketIndex.js').IAnatomySocketIndex} IAnatomySocketIndex */

/**
 * Strategy for resolving blueprint-based slot mappings
 * Handles slot paths defined in anatomy blueprints
 */
class BlueprintSlotStrategy {
  #logger;
  #entityManager;
  #bodyGraphService;
  #anatomyBlueprintRepository;
  #anatomySocketIndex;

  constructor({
    logger,
    entityManager,
    bodyGraphService,
    anatomyBlueprintRepository,
    anatomySocketIndex,
  }) {
    this.#logger = ensureValidLogger(logger, this.constructor.name);

    validateDependency(entityManager, 'IEntityManager', null, {
      requiredMethods: ['getComponentData', 'hasComponent'],
    });
    validateDependency(bodyGraphService, 'IBodyGraphService');
    validateDependency(
      anatomyBlueprintRepository,
      'IAnatomyBlueprintRepository',
      null,
      {
        requiredMethods: ['getBlueprintByRecipeId'],
      }
    );
    validateDependency(anatomySocketIndex, 'IAnatomySocketIndex', null, {
      requiredMethods: ['findEntityWithSocket'],
    });

    this.#entityManager = entityManager;
    this.#bodyGraphService = bodyGraphService;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#anatomySocketIndex = anatomySocketIndex;
  }

  /**
   * Determines if this strategy can handle the given mapping
   *
   * @param {object} mapping - The clothing slot mapping
   * @returns {boolean} True if mapping contains blueprint slots
   */
  canResolve(mapping) {
    const hasMapping = !!mapping;
    const hasBlueprintSlots = hasMapping && !!mapping.blueprintSlots;
    const isArray = hasBlueprintSlots && Array.isArray(mapping.blueprintSlots);
    const result = hasMapping && hasBlueprintSlots && isArray;

    this.#logger.info(
      `BlueprintSlotStrategy.canResolve: hasMapping=${hasMapping}, hasBlueprintSlots=${hasBlueprintSlots}, isArray=${isArray}, result=${result}. Mapping: ${JSON.stringify(mapping)}`
    );

    return result;
  }

  /**
   * Resolves blueprint slots to attachment points
   *
   * @param {string} entityId - Entity to resolve for
   * @param {object} mapping - The clothing slot mapping
   * @param {Map<string, string>} [slotEntityMappings] - Optional slot-to-entity mappings for this character
   * @returns {Promise<ResolvedAttachmentPoint[]>} Resolved attachment points
   */
  async resolve(entityId, mapping, slotEntityMappings = new Map()) {
    if (!this.canResolve(mapping)) {
      return [];
    }

    const blueprint = await this.#getEntityBlueprint(entityId);
    if (!blueprint) {
      this.#logger.warn(`No blueprint found for entity ${entityId}`);
      return [];
    }

    const bodyGraph = await this.#bodyGraphService.getBodyGraph(entityId);
    const attachmentPoints = [];

    for (const slotId of mapping.blueprintSlots) {
      const slotDef = blueprint.slots[slotId];
      if (!slotDef) {
        this.#logger.warn(`Blueprint slot '${slotId}' not found`);
        continue;
      }

      // Try to find entity using complex slot path resolution first
      this.#logger.info(
        `BlueprintSlotStrategy: Attempting complex path resolution for slot '${slotId}' on entity '${entityId}'`
      );

      let socketEntity = await this.#findEntityAtSlotPath(
        entityId,
        slotId,
        blueprint,
        bodyGraph,
        slotEntityMappings
      );

      if (socketEntity) {
        this.#logger.info(
          `BlueprintSlotStrategy: Complex path resolution succeeded for slot '${slotId}', found entity '${socketEntity}'`
        );
      } else {
        this.#logger.warn(
          `BlueprintSlotStrategy: Complex path resolution failed for slot '${slotId}', falling back to socket index lookup`
        );
      }

      // If complex resolution didn't work, fall back to socket index lookup
      if (!socketEntity) {
        const socketId = slotDef.socket;
        if (!socketId) {
          this.#logger.warn(
            `BlueprintSlotStrategy: Blueprint slot '${slotId}' has no socket defined`
          );
          continue;
        }

        this.#logger.info(
          `BlueprintSlotStrategy: Attempting socket index lookup for slot '${slotId}', socket '${socketId}' on entity '${entityId}'`
        );

        socketEntity = await this.#anatomySocketIndex.findEntityWithSocket(
          entityId,
          socketId
        );

        if (!socketEntity) {
          this.#logger.warn(
            `BlueprintSlotStrategy: Socket index returned null for socket '${socketId}' on entity '${entityId}' (slot: '${slotId}'). This may indicate the index is not yet populated or the socket doesn't exist.`
          );
        } else {
          this.#logger.info(
            `BlueprintSlotStrategy: Socket index found entity '${socketEntity}' for socket '${socketId}'`
          );
        }
      }

      if (socketEntity) {
        // Get the socket ID from the slot definition
        const socketId = slotDef.socket;
        if (socketId) {
          // Get actual socket data to determine orientation
          const socketData = await this.#getSocketData(socketEntity, socketId);
          let orientation = socketData?.orientation;

          // If socket doesn't have orientation or it's null, extract from slot name
          if (!orientation) {
            orientation = this.#extractOrientation(slotId);
          }

          attachmentPoints.push({
            entityId: socketEntity,
            socketId: socketId,
            slotPath: slotId,
            orientation: orientation,
          });

          this.#logger.debug(
            `BlueprintSlotStrategy: Found slot mapping for '${slotId}' → '${socketEntity}'`
          );
        }
      } else {
        this.#logger.warn(
          `No entity found with socket '${slotDef.socket}' for slot '${slotId}'`
        );
      }
    }

    return attachmentPoints;
  }

  /**
   * Gets entity's anatomy blueprint
   *
   * @param {string} entityId - Entity ID to get blueprint for
   * @private
   */
  async #getEntityBlueprint(entityId) {
    const bodyComponent = await this.#entityManager.getComponentData(
      entityId,
      'anatomy:body'
    );
    if (!bodyComponent?.recipeId) {
      return null;
    }

    return await this.#anatomyBlueprintRepository.getBlueprintByRecipeId(
      bodyComponent.recipeId
    );
  }

  /**
   * Gets socket data from an entity
   *
   * @param {string} entityId - Entity to get socket data from
   * @param {string} socketId - Socket ID to find
   * @returns {Promise<object|null>} Socket data or null if not found
   * @private
   */
  async #getSocketData(entityId, socketId) {
    try {
      const socketsComponent = await this.#entityManager.getComponentData(
        entityId,
        'anatomy:sockets'
      );

      if (socketsComponent?.sockets) {
        return socketsComponent.sockets.find(
          (socket) => socket.id === socketId
        );
      }
    } catch (err) {
      // Ignore errors, return null
    }
    return null;
  }

  /**
   * Extracts orientation from a slot ID
   *
   * @param {string} slotId - Slot ID to extract orientation from
   * @private
   */
  #extractOrientation(slotId) {
    if (slotId.includes('left')) return 'left';
    if (slotId.includes('right')) return 'right';
    if (slotId.includes('upper')) return 'upper';
    if (slotId.includes('lower')) return 'lower';
    return 'neutral';
  }

  /**
   * Finds the entity at a specific slot path by traversing blueprint hierarchy
   *
   * @param {string} entityId - Root entity ID
   * @param {string} slotId - Target slot ID
   * @param {object} blueprint - Blueprint definition
   * @param {object} bodyGraph - Body graph for the entity
   * @param {Map<string, string>} slotEntityMappings - Slot-to-entity mappings for this character
   * @returns {Promise<string|null>} Entity ID that corresponds to the slot, or null
   * @private
   */
  async #findEntityAtSlotPath(
    entityId,
    slotId,
    blueprint,
    bodyGraph,
    slotEntityMappings
  ) {
    // Check if we have a direct mapping for this slot
    if (slotEntityMappings && slotEntityMappings.has(slotId)) {
      const mappedEntity = slotEntityMappings.get(slotId);
      this.#logger.debug(
        `BlueprintSlotStrategy: Found direct slot mapping for '${slotId}' → '${mappedEntity}'`
      );
      return mappedEntity;
    }

    // Build the complete slot path from root to target
    const slotPath = this.#buildSlotPath(slotId, blueprint);

    // Traverse the slot path to find the corresponding entity
    let currentEntity = entityId;

    for (let i = 0; i < slotPath.length; i++) {
      const currentSlotId = slotPath[i];
      const slotDef = blueprint.slots[currentSlotId];

      if (!slotDef) {
        this.#logger.warn(
          `Blueprint slot '${currentSlotId}' not found in path`
        );
        return null;
      }

      // If this is the final slot in the path, we need to find an entity with this slot's type
      if (i === slotPath.length - 1) {
        return await this.#findEntityBySlotType(
          currentEntity,
          slotDef,
          bodyGraph
        );
      }

      // For intermediate slots, continue traversal by finding child entity with matching type
      const childEntity = await this.#findEntityBySlotType(
        currentEntity,
        slotDef,
        bodyGraph
      );
      if (!childEntity) {
        this.#logger.warn(
          `No entity found for intermediate slot '${currentSlotId}'`
        );
        return null;
      }
      currentEntity = childEntity;
    }

    return currentEntity;
  }

  /**
   * Builds the complete slot path from root to target slot
   *
   * @param {string} slotId - Target slot ID
   * @param {object} blueprint - Blueprint definition
   * @returns {string[]} Array of slot IDs from root to target
   * @private
   */
  #buildSlotPath(slotId, blueprint) {
    const path = [];
    let currentSlotId = slotId;

    // Build path by following parent relationships
    while (currentSlotId) {
      path.unshift(currentSlotId);
      const slotDef = blueprint.slots[currentSlotId];
      currentSlotId = slotDef?.parent;
    }

    return path;
  }

  /**
   * Finds an entity that matches the blueprint slot type
   *
   * @param {string} parentEntityId - Parent entity to search from
   * @param {object} slotDef - Blueprint slot definition
   * @param {object} bodyGraph - Body graph for traversal
   * @returns {Promise<string|null>} Matching entity ID or null
   * @private
   */
  async #findEntityBySlotType(parentEntityId, slotDef, bodyGraph) {
    // If no type specified, can't match by type
    if (!slotDef.type) {
      return null;
    }

    // Get connected parts from the parent entity
    const connectedParts = bodyGraph.getConnectedParts
      ? bodyGraph.getConnectedParts(parentEntityId)
      : [];

    // Check each connected part for matching type
    for (const partId of connectedParts) {
      try {
        const jointData = await this.#entityManager.getComponentData(
          partId,
          'anatomy:joint'
        );

        // Handle both sync and async getComponentData
        const joint =
          jointData instanceof Promise ? await jointData : jointData;

        // Check if this entity's joint type matches the slot type
        if (joint && this.#matchesSlotType(joint, slotDef.type)) {
          return partId;
        }
      } catch (err) {
        // Skip entities that don't have valid joint data
        continue;
      }
    }

    return null;
  }

  /**
   * Checks if a joint matches a blueprint slot type
   *
   * @param {object} joint - Joint component data
   * @param {string} slotType - Blueprint slot type to match
   * @returns {boolean} True if joint matches the slot type
   * @private
   */
  #matchesSlotType(joint, slotType) {
    // For now, we can match by checking if the joint has appropriate parent socket
    // or other type-specific logic could be added here
    return joint.parentEntityId !== undefined;
  }
}

export default BlueprintSlotStrategy;
