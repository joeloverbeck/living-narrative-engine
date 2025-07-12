/**
 * @file Service that bridges anatomy and clothing domains
 * @see src/anatomy/orchestration/anatomyOrchestrator.js
 * @see src/clothing/orchestration/equipmentOrchestrator.js
 */

import { BaseService } from '../../utils/serviceBase.js';
import SlotMappingConfiguration from '../configuration/slotMappingConfiguration.js';

/** @typedef {object} AnatomyBlueprint - Anatomy blueprint definition from mod data */
/** @typedef {object} ClothingSlot - Clothing slot definition from mod data */
/** @typedef {import('../configuration/slotMappingConfiguration.js').SlotMappingConfiguration} SlotMappingConfiguration */

/**
 * Maps clothing slot ID to its configuration
 *
 * @typedef {object} ClothingSlotMapping
 * @property {string[]} [blueprintSlots] - Blueprint slot IDs this clothing slot covers
 * @property {string[]} [anatomySockets] - Direct socket IDs for orientation-specific sockets
 * @property {string[]} allowedLayers - Allowed clothing layers
 * @property {string[]} layerOrder - Layer order from inner to outer
 * @property {string} defaultLayer - Default layer for items
 * @property {string[]} [tags] - Optional categorization tags
 * @property {string[]} [conflictsWith] - Slots that conflict
 * @property {string[]} [requiresSlots] - Required companion slots
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
  #slotMappingConfiguration;
  #blueprintCache = new Map();
  #slotResolutionCache = new Map();

  constructor({ logger, entityManager, bodyGraphService, dataRegistry, slotMappingConfiguration }) {
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
      slotMappingConfiguration: {
        value: slotMappingConfiguration,
        requiredMethods: ['getSlotEntityMappings'],
      },
    });

    this.#entityManager = entityManager;
    this.#bodyGraphService = bodyGraphService;
    this.#dataRegistry = dataRegistry;
    this.#slotMappingConfiguration = slotMappingConfiguration;
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

      // Find the entity occupying this slot
      const slotPath = this.#buildSlotPath(slotId, blueprint.slots);
      const partEntity = await this.#findEntityAtSlotPath(
        entityId,
        slotPath,
        bodyGraph
      );

      if (partEntity) {
        // For blueprint slots, the attachment point is where the part connects to its parent
        const jointComponent = await this.#entityManager.getComponentData(
          partEntity,
          'anatomy:joint'
        );

        if (jointComponent) {
          // The attachment point is on the parent entity at the parent socket
          attachmentPoints.push({
            entityId: jointComponent.parentEntityId,
            socketId: jointComponent.parentSocketId,
            slotPath: slotPath.join('.'),
            orientation: this.#extractOrientation(slotId),
          });
        }
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
   * Builds the slot path from a slot ID
   *
   * @param slotId
   * @param slotDefinitions
   * @private
   */
  #buildSlotPath(slotId, slotDefinitions) {
    const path = [];
    let currentSlot = slotId;

    while (currentSlot) {
      path.unshift(currentSlot);
      const slotDef = slotDefinitions[currentSlot];
      currentSlot = slotDef?.parent;
    }

    return path;
  }

  /**
   * Finds the entity at a specific slot path
   *
   * @param rootEntityId
   * @param slotPath
   * @param bodyGraph
   * @private
   */
  async #findEntityAtSlotPath(rootEntityId, slotPath, bodyGraph) {
    // If the path is empty, we're at the root
    if (slotPath.length === 0) {
      return rootEntityId;
    }

    // Get explicit slot-to-entity mappings instead of using hardcoded patterns
    const slotEntityMappings = await this.#slotMappingConfiguration.getSlotEntityMappings(rootEntityId);

    // Navigate through the path by following the body graph connections
    let currentEntity = rootEntityId;

    for (const slotId of slotPath) {
      // Get connected parts from current entity
      const connectedParts = bodyGraph.getConnectedParts(currentEntity);

      // Use explicit mapping instead of hardcoded pattern
      const mappedEntityId = slotEntityMappings.get(slotId);

      if (mappedEntityId && connectedParts.includes(mappedEntityId)) {
        currentEntity = mappedEntityId;
      } else {
        // Entity not found in connected parts or mapping
        this.#logger.debug(
          `No entity mapping found for slot '${slotId}' in root entity '${rootEntityId}'`
        );
        return null;
      }
    }

    return currentEntity;
  }

  /**
   * Gets parent connection info for a body part
   *
   * @param partEntityId
   * @param bodyGraph
   * @private
   */
  async #getParentConnectionInfo(partEntityId, bodyGraph) {
    const jointComponent = await this.#entityManager.getComponentData(
      partEntityId,
      'anatomy:joint'
    );

    if (!jointComponent) {
      return null;
    }

    return {
      parentId: jointComponent.parentEntityId,
      socketId: jointComponent.childSocketId,
      parentSocketId: jointComponent.parentSocketId,
    };
  }

  /**
   * Checks if a joint matches a slot ID
   *
   * @param jointComponent
   * @param slotId
   * @private
   */
  #matchesSlot(jointComponent, slotId) {
    // The slot matching needs to be based on the parent socket and blueprint configuration
    // This is a simplified version - in reality, we'd need to check the blueprint slot definitions
    // to see if this joint connects to the expected parent socket for this slot
    // For now, we'll accept any joint as potentially matching
    // In a complete implementation, we'd verify:
    // 1. The parent socket matches what's expected for this slot
    // 2. The part type matches the slot requirements
    return jointComponent !== null;
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
    const allParts = bodyGraph.getAllPartIds();
    const sockets = new Set();

    // Collect all sockets
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

    return {
      partIds: allParts,
      socketIds: Array.from(sockets),
      bodyGraph,
    };
  }

  /**
   * Validates that required sockets/slots exist for a mapping
   *
   * @param mapping
   * @param anatomyStructure
   * @param blueprint
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
   * Clears all caches
   */
  clearCache() {
    this.#blueprintCache.clear();
    this.#slotResolutionCache.clear();
  }
}

export default AnatomyClothingIntegrationService;
