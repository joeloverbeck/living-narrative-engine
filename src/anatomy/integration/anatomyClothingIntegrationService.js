/**
 * @file Service that bridges anatomy and clothing domains
 * @see src/anatomy/orchestration/anatomyOrchestrator.js
 * @see src/clothing/orchestration/equipmentOrchestrator.js
 */

import { BaseService } from '../../utils/serviceBase.js';

/** @typedef {object} AnatomyBlueprint - Anatomy blueprint definition from mod data */
/** @typedef {object} ClothingSlot - Clothing slot definition from mod data */

/**
 * Maps clothing slot ID to its configuration
 *
 * @typedef {object} ClothingSlotMapping
 * @property {string[]} [blueprintSlots] - Blueprint slot IDs this clothing slot covers
 * @property {string[]} [anatomySockets] - Direct socket IDs for orientation-specific sockets
 * @property {string[]} allowedLayers - Allowed clothing layers
 */

/**
 * Resolved anatomy attachment point
 *
 * @typedef {object} ResolvedAttachmentPoint
 * @property {string} entityId - The entity ID of the body part
 * @property {string} socketId - The socket ID on that part
 * @property {string} slotPath - The blueprint slot path (e.g., "left_arm.left_hand")
 * @property {string} orientation - The resolved orientation
 */

/**
 * Service that provides clothing capabilities based on anatomy structure
 */
class AnatomyClothingIntegrationService extends BaseService {
  #logger;
  #entityManager;
  #bodyGraphService;
  #dataRegistry;
  #blueprintCache = new Map();
  #slotResolutionCache = new Map();
  #slotEntityMappings = new Map();

  constructor({ logger, entityManager, bodyGraphService, dataRegistry }) {
    super();

    this.#logger = this._init('AnatomyClothingIntegrationService', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'hasComponent'],
      },
      bodyGraphService: {
        value: bodyGraphService,
      },
      dataRegistry: {
        value: dataRegistry,
        requiredMethods: ['get'],
      },
    });

    this.#entityManager = entityManager;
    this.#bodyGraphService = bodyGraphService;
    this.#dataRegistry = dataRegistry;
  }

  /**
   * Gets available clothing slots for an entity based on its anatomy
   *
   * @param {string} entityId - Entity to query
   * @returns {Promise<Map<string, ClothingSlotMapping>>} Available slots
   */
  async getAvailableClothingSlots(entityId) {
    if (!entityId || typeof entityId !== 'string') {
      throw new Error('Entity ID is required');
    }

    try {
      // Get entity's anatomy blueprint
      const blueprint = await this.#getEntityBlueprint(entityId);
      if (!blueprint || !blueprint.clothingSlotMappings) {
        this.#logger.debug(`No clothing slot mappings for entity ${entityId}`);
        return new Map();
      }

      // Get entity's actual anatomy structure
      const anatomyStructure = await this.#getEntityAnatomyStructure(entityId);

      // Filter clothing slots to only those with valid mappings
      const availableSlots = new Map();

      for (const [slotId, mapping] of Object.entries(
        blueprint.clothingSlotMappings
      )) {
        if (
          await this.#validateSlotMapping(mapping, anatomyStructure, blueprint)
        ) {
          availableSlots.set(slotId, mapping);
        }
      }

      this.#logger.debug(
        `Found ${availableSlots.size} clothing slots for entity ${entityId}`
      );
      return availableSlots;
    } catch (err) {
      this.#logger.error(
        `Failed to get clothing slots for entity ${entityId}`,
        err
      );
      throw err;
    }
  }

  /**
   * Resolves a clothing slot to actual anatomy attachment points
   *
   * @param {string} entityId - Entity to query
   * @param {string} slotId - Clothing slot ID
   * @returns {Promise<ResolvedAttachmentPoint[]>} Resolved attachment points
   */
  async resolveClothingSlotToAttachmentPoints(entityId, slotId) {
    if (!entityId || typeof entityId !== 'string') {
      throw new Error('Entity ID is required');
    }
    if (!slotId || typeof slotId !== 'string') {
      throw new Error('Slot ID is required');
    }

    // Check cache
    const cacheKey = `${entityId}:${slotId}`;
    if (this.#slotResolutionCache.has(cacheKey)) {
      return this.#slotResolutionCache.get(cacheKey);
    }

    const slots = await this.getAvailableClothingSlots(entityId);
    const mapping = slots.get(slotId);

    if (!mapping) {
      return [];
    }

    let attachmentPoints = [];

    // Handle blueprint slot references
    if (mapping.blueprintSlots) {
      attachmentPoints = await this.#resolveBlueprintSlots(
        entityId,
        mapping.blueprintSlots
      );
    }
    // Handle direct socket references (e.g., torso)
    else if (mapping.anatomySockets) {
      attachmentPoints = await this.#resolveDirectSockets(
        entityId,
        mapping.anatomySockets
      );
    }

    // Cache the result
    this.#slotResolutionCache.set(cacheKey, attachmentPoints);

    return attachmentPoints;
  }

  /**
   * Validates that a clothing item can be equipped in a slot
   *
   * @param {string} entityId - Entity attempting to equip
   * @param {string} slotId - Target clothing slot
   * @param {string} itemId - Item to equip
   * @returns {Promise<{valid: boolean, reason?: string}>}
   */
  async validateClothingSlotCompatibility(entityId, slotId, itemId) {
    if (!entityId || typeof entityId !== 'string') {
      throw new Error('Entity ID is required');
    }
    if (!slotId || typeof slotId !== 'string') {
      throw new Error('Slot ID is required');
    }
    if (!itemId || typeof itemId !== 'string') {
      throw new Error('Item ID is required');
    }

    const availableSlots = await this.getAvailableClothingSlots(entityId);

    if (!availableSlots.has(slotId)) {
      return {
        valid: false,
        reason: `Entity lacks clothing slot '${slotId}'`,
      };
    }

    const mapping = availableSlots.get(slotId);
    const attachmentPoints = await this.resolveClothingSlotToAttachmentPoints(
      entityId,
      slotId
    );

    if (attachmentPoints.length === 0) {
      return {
        valid: false,
        reason: `Clothing slot '${slotId}' has no valid attachment points`,
      };
    }

    // Additional validation could include:
    // - Check item's required coverage against attachment points
    // - Validate layer compatibility
    // - Check for conflicts with other slots

    return { valid: true };
  }

  /**
   * Gets the anatomy sockets covered by a clothing slot
   *
   * @param {string} entityId - Entity to query
   * @param {string} slotId - Clothing slot ID
   * @returns {Promise<{entityId: string, socketId: string}[]>} Socket references
   */
  async getSlotAnatomySockets(entityId, slotId) {
    const attachmentPoints = await this.resolveClothingSlotToAttachmentPoints(
      entityId,
      slotId
    );

    return attachmentPoints.map((point) => ({
      entityId: point.entityId,
      socketId: point.socketId,
    }));
  }

  /**
   * Resolves blueprint slots to actual attachment points
   *
   * @param entityId
   * @param blueprintSlots
   * @private
   */
  async #resolveBlueprintSlots(entityId, blueprintSlots) {
    const blueprint = await this.#getEntityBlueprint(entityId);
    const bodyGraph = await this.#bodyGraphService.getBodyGraph(entityId);
    const attachmentPoints = [];

    for (const slotId of blueprintSlots) {
      const slotDef = blueprint.slots[slotId];
      if (!slotDef) {
        this.#logger.warn(`Blueprint slot '${slotId}' not found`);
        continue;
      }

      // For clothing attachment, use the socket defined in the blueprint slot
      const socketId = slotDef.socket;
      if (!socketId) {
        this.#logger.warn(`Blueprint slot '${slotId}' has no socket defined`);
        continue;
      }

      // Find which entity has this socket
      const socketEntity = await this.#findEntityWithSocket(
        entityId,
        socketId,
        bodyGraph
      );
      if (socketEntity) {
        attachmentPoints.push({
          entityId: socketEntity,
          socketId: socketId,
          slotPath: slotId,
          orientation: this.#extractOrientation(slotId),
        });
        this.#logger.debug(
          `AnatomyClothingIntegrationService: Found direct slot mapping for '${slotId}' → '${socketEntity}'`
        );
      } else {
        this.#logger.warn(
          `No entity found with socket '${socketId}' for slot '${slotId}'`
        );
      }
    }

    return attachmentPoints;
  }

  /**
   * Resolves direct socket references to attachment points
   *
   * @param entityId
   * @param socketIds
   * @private
   */
  async #resolveDirectSockets(entityId, socketIds) {
    const bodyGraph = await this.#bodyGraphService.getBodyGraph(entityId);
    const attachmentPoints = [];

    // For direct sockets, we need to find which parts have these sockets
    // Check body parts first (preferred over root entity)
    const bodyParts = bodyGraph.getAllPartIds();

    for (const partId of bodyParts) {
      const socketsComponent = await this.#entityManager.getComponentData(
        partId,
        'anatomy:sockets'
      );

      if (socketsComponent?.sockets) {
        for (const socket of socketsComponent.sockets) {
          if (socketIds.includes(socket.id)) {
            attachmentPoints.push({
              entityId: partId,
              socketId: socket.id,
              slotPath: 'direct',
              orientation: socket.orientation || 'neutral',
            });
          }
        }
      }
    }

    // Only check root entity if no body parts have the sockets
    if (attachmentPoints.length === 0) {
      const rootSockets = await this.#entityManager.getComponentData(
        entityId,
        'anatomy:sockets'
      );

      if (rootSockets?.sockets) {
        for (const socket of rootSockets.sockets) {
          if (socketIds.includes(socket.id)) {
            attachmentPoints.push({
              entityId: entityId,
              socketId: socket.id,
              slotPath: 'direct',
              orientation: socket.orientation || 'neutral',
            });
          }
        }
      }
    }

    return attachmentPoints;
  }


  /**
   * Finds the entity that has the specified socket
   *
   * @param {string} rootEntityId - Root entity to search from
   * @param {string} socketId - Socket ID to find
   * @param {object} bodyGraph - Body graph structure
   * @returns {Promise<string|null>} Entity ID that has the socket, or null if not found
   * @private
   */
  async #findEntityWithSocket(rootEntityId, socketId, bodyGraph) {
    // Check all parts in the body graph
    const allParts = bodyGraph.getAllPartIds();

    // Include the root entity in the search
    const entitiesToCheck = [rootEntityId, ...allParts];

    for (const entityId of entitiesToCheck) {
      const socketsComponent = await this.#entityManager.getComponentData(
        entityId,
        'anatomy:sockets'
      );

      if (socketsComponent && socketsComponent.sockets) {
        // Search through the sockets array for matching socket ID
        const foundSocket = socketsComponent.sockets.find(
          (socket) => socket.id === socketId
        );
        if (foundSocket) {
          return entityId;
        }
      }
    }

    return null;
  }


  /**
   * Extracts orientation from a slot ID
   *
   * @param slotId
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
   * Gets entity's anatomy blueprint
   *
   * @param entityId
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

    // Check cache
    if (this.#blueprintCache.has(bodyComponent.recipeId)) {
      return this.#blueprintCache.get(bodyComponent.recipeId);
    }

    // Load from data registry
    const recipe = this.#dataRegistry.get(
      'anatomyRecipes',
      bodyComponent.recipeId
    );
    if (!recipe) {
      this.#logger.warn(
        `Recipe '${bodyComponent.recipeId}' not found in registry`
      );
      return null;
    }

    const blueprint = this.#dataRegistry.get(
      'anatomyBlueprints',
      recipe.blueprintId
    );
    if (!blueprint) {
      this.#logger.warn(
        `Blueprint '${recipe.blueprintId}' not found in registry`
      );
      return null;
    }

    // Cache for performance
    this.#blueprintCache.set(bodyComponent.recipeId, blueprint);

    return blueprint;
  }

  /**
   * Gets entity's anatomy structure
   *
   * @param entityId
   * @private
   */
  async #getEntityAnatomyStructure(entityId) {
    const bodyGraph = await this.#bodyGraphService.getBodyGraph(entityId);
    let allParts = bodyGraph.getAllPartIds();
    const sockets = new Set();

    // Collect sockets from root entity first
    const rootSocketComponent = await this.#entityManager.getComponentData(
      entityId,
      'anatomy:sockets'
    );

    if (rootSocketComponent?.sockets) {
      for (const socket of rootSocketComponent.sockets) {
        sockets.add(socket.id);
      }
    }

    // DEFENSIVE FALLBACK: If bodyGraph returns few parts, try direct joint traversal
    // This handles cases where the anatomy cache might be incomplete
    if (allParts.length <= 1) {
      this.#logger.warn(
        `AnatomyClothingIntegrationService: Body graph for '${entityId}' returned only ${allParts.length} parts, using fallback joint traversal`
      );

      const fallbackParts = await this.#findAnatomyPartsByJoints(entityId);
      if (fallbackParts.length > allParts.length) {
        this.#logger.debug(
          `AnatomyClothingIntegrationService: Fallback found ${fallbackParts.length} parts vs ${allParts.length} from body graph`
        );
        allParts = fallbackParts;
      }
    }

    // Collect sockets from all child parts
    for (const partId of allParts) {
      const socketComponent = await this.#entityManager.getComponentData(
        partId,
        'anatomy:sockets'
      );

      if (socketComponent?.sockets) {
        for (const socket of socketComponent.sockets) {
          sockets.add(socket.id);
        }
      }
    }

    this.#logger.debug(
      `AnatomyClothingIntegrationService: Collected ${sockets.size} unique sockets from ${allParts.length + 1} entities`
    );

    return {
      partIds: [entityId, ...allParts],
      socketIds: Array.from(sockets),
      bodyGraph,
    };
  }

  /**
   * Fallback method to find anatomy parts by directly querying joint relationships
   * Used when the body graph cache is incomplete or missing
   *
   * @param {string} rootEntityId
   * @returns {Promise<string[]>} Array of part entity IDs
   * @private
   */
  async #findAnatomyPartsByJoints(rootEntityId) {
    /** @type {string[]} */
    const allPartIds = [];
    /** @type {Set<string>} */
    const visited = new Set();

    try {
      // Get all entities with anatomy:joint components
      const entitiesWithJoints =
        this.#entityManager.getEntitiesWithComponent('anatomy:joint');

      if (!entitiesWithJoints || entitiesWithJoints.length === 0) {
        this.#logger.debug(
          'AnatomyClothingIntegrationService: No entities with joint components found'
        );
        return allPartIds;
      }

      // Build a map of entities that are connected to our root entity
      const connectedParts = new Set();
      const toProcess = [rootEntityId];
      visited.add(rootEntityId);

      while (toProcess.length > 0) {
        const currentEntityId = toProcess.shift();

        // Find all entities that have this as a parent
        for (const entity of entitiesWithJoints) {
          if (visited.has(entity.id)) continue;

          const joint = this.#entityManager.getComponentData(
            entity.id,
            'anatomy:joint'
          );
          const parentId = joint?.parentEntityId || joint?.parentId;

          if (parentId === currentEntityId) {
            connectedParts.add(entity.id);
            toProcess.push(entity.id);
            visited.add(entity.id);

            this.#logger.debug(
              `AnatomyClothingIntegrationService: Found connected part '${entity.id}' with parent '${currentEntityId}'`
            );
          }
        }
      }

      allPartIds.push(...connectedParts);

      this.#logger.debug(
        `AnatomyClothingIntegrationService: Fallback joint traversal found ${allPartIds.length} connected parts`
      );
    } catch (error) {
      this.#logger.error(
        `AnatomyClothingIntegrationService: Failed to find anatomy parts by joints for '${rootEntityId}'`,
        error
      );
    }

    return allPartIds;
  }

  /**
   * Validates that required sockets/slots exist for a mapping
   *
   * @param {ClothingSlotMapping} mapping
   * @param {object} anatomyStructure
   * @param {object} blueprint
   * @private
   */
  async #validateSlotMapping(mapping, anatomyStructure, blueprint) {
    // For blueprint slots, check they exist in the blueprint
    if (mapping.blueprintSlots) {
      const slotsExist = mapping.blueprintSlots.every((slotId) => {
        const exists = blueprint.slots && blueprint.slots[slotId] !== undefined;
        if (!exists) {
          this.#logger.debug(
            `Blueprint slot '${slotId}' not found in blueprint`
          );
        }
        return exists;
      });
      return slotsExist;
    }

    // For direct sockets, check they exist in the anatomy
    if (mapping.anatomySockets) {
      // Special case for wildcard
      if (mapping.anatomySockets.includes('*')) {
        return true;
      }

      const socketsExist = mapping.anatomySockets.some((socketId) => {
        const exists = anatomyStructure.socketIds.includes(socketId);
        if (!exists) {
          this.#logger.debug(
            `Socket '${socketId}' not found in anatomy structure`
          );
        }
        return exists;
      });
      return socketsExist;
    }

    return false;
  }

  /**
   * Sets the slot-to-entity mappings for improved slot resolution
   *
   * @param {Map<string, string>} mappings - Map of slot IDs to entity IDs
   */
  setSlotEntityMappings(mappings) {
    if (mappings instanceof Map) {
      this.#slotEntityMappings = new Map(mappings);
    } else if (mappings && typeof mappings === 'object') {
      this.#slotEntityMappings = new Map(Object.entries(mappings));
    } else {
      this.#slotEntityMappings = new Map();
    }

    this.#logger.debug(
      `AnatomyClothingIntegrationService: Updated slot-entity mappings with ${this.#slotEntityMappings.size} entries`
    );
  }

  /**
   * Clears all caches
   */
  clearCache() {
    this.#blueprintCache.clear();
    this.#slotResolutionCache.clear();
    this.#slotEntityMappings.clear();
  }
}

export default AnatomyClothingIntegrationService;
