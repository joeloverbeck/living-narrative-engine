/**
 * @file Service that bridges anatomy and clothing domains
 * @see src/anatomy/orchestration/anatomyOrchestrator.js
 * @see src/clothing/orchestration/equipmentOrchestrator.js
 */

import { BaseService } from '../../utils/serviceBase.js';
import SlotResolver from './SlotResolver.js';
import ClothingSlotValidator from '../../clothing/validation/clothingSlotValidator.js';
import { 
  AnatomyClothingCache, 
  CacheKeyTypes 
} from '../cache/AnatomyClothingCache.js';
import { ANATOMY_CLOTHING_CACHE_CONFIG } from '../constants/anatomyConstants.js';

/** @typedef {import('../../interfaces/IAnatomyBlueprintRepository.js').IAnatomyBlueprintRepository} IAnatomyBlueprintRepository */
/** @typedef {import('../../interfaces/IAnatomySocketIndex.js').IAnatomySocketIndex} IAnatomySocketIndex */
/** @typedef {import('../../interfaces/IClothingSlotValidator.js').IClothingSlotValidator} IClothingSlotValidator */
/** @typedef {import('../cache/AnatomyClothingCache.js').AnatomyClothingCache} AnatomyClothingCache */
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
  #anatomyBlueprintRepository;
  #anatomySocketIndex;
  #slotResolver;
  #clothingSlotValidator;
  #slotEntityMappings = new Map();
  #cache;

  constructor({
    logger,
    entityManager,
    bodyGraphService,
    anatomyBlueprintRepository,
    anatomySocketIndex,
    clothingSlotValidator,
    anatomyClothingCache,
  }) {
    super();

    this.#logger = this._init('AnatomyClothingIntegrationService', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'hasComponent'],
      },
      bodyGraphService: {
        value: bodyGraphService,
      },
      anatomyBlueprintRepository: {
        value: anatomyBlueprintRepository,
        requiredMethods: ['getBlueprintByRecipeId'],
      },
      anatomySocketIndex: {
        value: anatomySocketIndex,
        requiredMethods: ['findEntityWithSocket', 'buildIndex'],
      },
      clothingSlotValidator: {
        value: clothingSlotValidator,
        defaultImpl: ClothingSlotValidator,
        requiredMethods: ['validateSlotCompatibility'],
      },
    });

    this.#entityManager = entityManager;
    this.#bodyGraphService = bodyGraphService;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#anatomySocketIndex = anatomySocketIndex;
    this.#clothingSlotValidator =
      clothingSlotValidator || new ClothingSlotValidator({ logger });

    // Initialize cache service
    this.#cache = anatomyClothingCache || new AnatomyClothingCache({ logger }, ANATOMY_CLOTHING_CACHE_CONFIG);

    // Initialize the slot resolver with strategies
    this.#slotResolver = new SlotResolver({
      logger,
      entityManager,
      bodyGraphService,
      anatomyBlueprintRepository,
      anatomySocketIndex,
      slotEntityMappings: this.#slotEntityMappings,
      cache: this.#cache,
    });
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

    // Check cache first
    const cacheKey = AnatomyClothingCache.createAvailableSlotsKey(entityId);
    const cached = this.#cache.get(CacheKeyTypes.AVAILABLE_SLOTS, cacheKey);
    if (cached) {
      return cached;
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

      // Cache the result
      this.#cache.set(CacheKeyTypes.AVAILABLE_SLOTS, cacheKey, availableSlots);

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

    const slots = await this.getAvailableClothingSlots(entityId);
    const mapping = slots.get(slotId);

    if (!mapping) {
      return [];
    }

    // Use the SlotResolver to handle resolution with appropriate strategy
    return await this.#slotResolver.resolve(entityId, slotId, mapping);
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
    // Get available slots for the entity
    const availableSlots = await this.getAvailableClothingSlots(entityId);

    // Create a function to resolve attachment points that the validator can use
    const resolveAttachmentPoints = async (entityId, slotId) => {
      return await this.resolveClothingSlotToAttachmentPoints(entityId, slotId);
    };

    // Delegate to the validator
    return await this.#clothingSlotValidator.validateSlotCompatibility(
      entityId,
      slotId,
      itemId,
      availableSlots,
      resolveAttachmentPoints
    );
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

    // Use repository for blueprint access (includes caching)
    return await this.#anatomyBlueprintRepository.getBlueprintByRecipeId(
      bodyComponent.recipeId
    );
  }

  /**
   * Gets entity's anatomy structure
   *
   * @param {string} entityId - Entity ID to get anatomy structure for
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

    // If body graph has no parts, use fallback joint traversal
    if (allParts.length === 0) {
      this.#logger.debug(
        'AnatomyClothingIntegrationService: Body graph empty, using fallback joint traversal'
      );
      allParts = await this.#getFallbackConnectedParts(entityId);
      this.#logger.debug(
        `Fallback joint traversal found ${allParts.length} connected parts`
      );
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
   * Gets connected parts using fallback joint traversal when body graph is empty
   *
   * @param {string} entityId - Root entity ID
   * @returns {Promise<string[]>} Array of connected part entity IDs
   * @private
   */
  async #getFallbackConnectedParts(entityId) {
    // Get all entities with joints
    const entitiesWithJoints = this.#entityManager.getEntitiesWithComponent
      ? this.#entityManager.getEntitiesWithComponent('anatomy:joint')
      : [];

    if (!entitiesWithJoints || entitiesWithJoints.length === 0) {
      this.#logger.debug('Fallback found 0 parts');
      return [];
    }

    const connectedParts = new Set();
    const visited = new Set();

    // Traverse from root entity to find all connected parts
    const queue = [entityId];
    visited.add(entityId);

    while (queue.length > 0) {
      const currentEntityId = queue.shift();

      // Find all entities that have this entity as their parent
      for (const entity of entitiesWithJoints) {
        const partId = entity.id || entity;

        if (visited.has(partId)) {
          continue;
        }

        try {
          const jointData = await this.#entityManager.getComponentData(
            partId,
            'anatomy:joint'
          );

          // Handle both sync and async getComponentData
          const joint =
            jointData instanceof Promise ? await jointData : jointData;

          if (joint?.parentEntityId === currentEntityId) {
            connectedParts.add(partId);
            queue.push(partId);
            visited.add(partId);
            this.#logger.debug(
              `AnatomyClothingIntegrationService: Found connected part ${partId} with parent ${currentEntityId}`
            );
          }
        } catch (err) {
          // Skip entities that don't have valid joint data
          continue;
        }
      }
    }

    const result = Array.from(connectedParts);
    this.#logger.debug(`Fallback found ${result.length} parts`);
    return result;
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

    // Update the slot resolver's mappings
    this.#slotResolver.setSlotEntityMappings(this.#slotEntityMappings);

    this.#logger.debug(
      `AnatomyClothingIntegrationService: Updated slot-entity mappings with ${this.#slotEntityMappings.size} entries`
    );
  }

  /**
   * Clears all caches
   */
  clearCache() {
    this.#anatomyBlueprintRepository.clearCache();
    this.#anatomySocketIndex.clearCache();
    this.#slotResolver.clearCache();
    this.#slotEntityMappings.clear();
    this.#cache.clearAll();
  }

  /**
   * Invalidates cache entries for a specific entity
   *
   * @param {string} entityId - Entity ID to invalidate
   */
  invalidateCacheForEntity(entityId) {
    this.#cache.invalidateEntity(entityId);
  }
}

export default AnatomyClothingIntegrationService;
