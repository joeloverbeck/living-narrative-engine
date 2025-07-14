/**
 * @file ClothingManagementService - Facade for clothing system operations (V2)
 *
 * Updated version that supports both the legacy AnatomyClothingIntegrationService
 * and the new decomposed services architecture.
 * 
 * This version allows gradual migration by accepting either:
 * - The legacy anatomyClothingIntegrationService
 * - The new decomposed services (anatomyBlueprintRepository, clothingSlotValidator, etc.)
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { 
  AnatomyClothingCache, 
  CacheKeyTypes 
} from '../../anatomy/cache/AnatomyClothingCache.js';
import { ANATOMY_CLOTHING_CACHE_CONFIG } from '../../anatomy/constants/anatomyConstants.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../orchestration/equipmentOrchestrator.js').EquipmentOrchestrator} EquipmentOrchestrator */
/** @typedef {import('../../anatomy/integration/anatomyClothingIntegrationService.js').AnatomyClothingIntegrationService} AnatomyClothingIntegrationService */
/** @typedef {import('../../interfaces/IAnatomyBlueprintRepository.js').IAnatomyBlueprintRepository} IAnatomyBlueprintRepository */
/** @typedef {import('../../interfaces/IClothingSlotValidator.js').IClothingSlotValidator} IClothingSlotValidator */

/**
 * Maps clothing slot ID to its configuration
 *
 * @typedef {object} ClothingSlotMapping
 * @property {string[]} [blueprintSlots] - Blueprint slot IDs this clothing slot covers
 * @property {string[]} [anatomySockets] - Direct socket IDs for orientation-specific sockets
 * @property {string[]} allowedLayers - Allowed clothing layers
 */

/**
 * Facade service for clothing system operations (V2)
 *
 * Provides high-level API for clothing equipment, validation, and management
 * while supporting both legacy and new architecture patterns.
 */
export class ClothingManagementService {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;
  /** @type {ISafeEventDispatcher} */
  #eventDispatcher;
  /** @type {EquipmentOrchestrator} */
  #orchestrator;
  /** @type {AnatomyClothingIntegrationService|null} */
  #anatomyClothingIntegration;
  /** @type {IAnatomyBlueprintRepository|null} */
  #anatomyBlueprintRepository;
  /** @type {IClothingSlotValidator|null} */
  #clothingSlotValidator;
  /** @type {object|null} */
  #bodyGraphService;
  /** @type {AnatomyClothingCache} */
  #cache;

  /**
   * Creates an instance of ClothingManagementService
   *
   * @param {object} deps - Constructor dependencies
   * @param {IEntityManager} deps.entityManager - Entity manager for entity operations
   * @param {ILogger} deps.logger - Logger instance
   * @param {ISafeEventDispatcher} deps.eventDispatcher - Event dispatcher for system events
   * @param {EquipmentOrchestrator} deps.equipmentOrchestrator - Orchestrator for complex equipment workflows
   * @param {AnatomyClothingIntegrationService} [deps.anatomyClothingIntegrationService] - Legacy integrated service
   * @param {IAnatomyBlueprintRepository} [deps.anatomyBlueprintRepository] - New decomposed blueprint repository
   * @param {IClothingSlotValidator} [deps.clothingSlotValidator] - New decomposed slot validator
   * @param {object} [deps.bodyGraphService] - Body graph service for anatomy structure
   * @param {AnatomyClothingCache} [deps.anatomyClothingCache] - Cache service
   */
  constructor({
    entityManager,
    logger,
    eventDispatcher,
    equipmentOrchestrator,
    anatomyClothingIntegrationService,
    anatomyBlueprintRepository,
    clothingSlotValidator,
    bodyGraphService,
    anatomyClothingCache,
  }) {
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(logger, 'ILogger');
    validateDependency(eventDispatcher, 'ISafeEventDispatcher');
    validateDependency(equipmentOrchestrator, 'EquipmentOrchestrator');

    // Support both legacy and new architecture
    if (!anatomyClothingIntegrationService && !anatomyBlueprintRepository) {
      throw new Error(
        'Either anatomyClothingIntegrationService or anatomyBlueprintRepository must be provided'
      );
    }

    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#eventDispatcher = eventDispatcher;
    this.#orchestrator = equipmentOrchestrator;
    
    // Legacy path
    this.#anatomyClothingIntegration = anatomyClothingIntegrationService || null;
    
    // New decomposed services path
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository || null;
    this.#clothingSlotValidator = clothingSlotValidator || null;
    this.#bodyGraphService = bodyGraphService || null;
    
    // Initialize cache if using new architecture
    if (this.#anatomyBlueprintRepository) {
      this.#cache = anatomyClothingCache || new AnatomyClothingCache({ logger }, ANATOMY_CLOTHING_CACHE_CONFIG);
    }

    // Log which architecture we're using
    if (this.#anatomyClothingIntegration) {
      this.#logger.info('ClothingManagementService: Using legacy integrated architecture');
    } else {
      this.#logger.info('ClothingManagementService: Using new decomposed architecture');
    }
  }

  /**
   * Equips a clothing item on an entity
   *
   * @param {string} entityId - The entity to equip clothing on
   * @param {string} clothingItemId - The clothing item entity ID to equip
   * @param {object} [options] - Equipment options
   * @param {string} [options.layer] - Force specific layer (overrides item default)
   * @param {boolean} [options.validateCoverage] - Whether to validate anatomy coverage
   * @returns {Promise<{success: boolean, equipped?: boolean, conflicts?: object[], errors?: string[]}>}
   */
  async equipClothing(entityId, clothingItemId, options = {}) {
    try {
      if (!entityId) {
        throw new InvalidArgumentError('entityId is required');
      }
      if (!clothingItemId) {
        throw new InvalidArgumentError('clothingItemId is required');
      }

      this.#logger.info(
        `ClothingManagementService: Equipping clothing '${clothingItemId}' on entity '${entityId}'`,
        { options }
      );

      // Delegate to orchestrator for complex workflow
      const result = await this.#orchestrator.orchestrateEquipment({
        entityId,
        clothingItemId,
        ...options,
      });

      if (result.success) {
        this.#logger.info(
          `ClothingManagementService: Successfully equipped clothing '${clothingItemId}' on entity '${entityId}'`
        );
      } else {
        this.#logger.warn(
          `ClothingManagementService: Failed to equip clothing '${clothingItemId}' on entity '${entityId}'`,
          { errors: result.errors }
        );
      }

      return result;
    } catch (error) {
      this.#logger.error(
        `ClothingManagementService: Error equipping clothing '${clothingItemId}' on entity '${entityId}'`,
        { error }
      );
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Unequips a clothing item from an entity
   *
   * @param {string} entityId - The entity to unequip clothing from
   * @param {string} clothingItemId - The clothing item entity ID to unequip
   * @param {object} [options] - Unequipment options
   * @param {boolean} [options.cascadeUnequip] - Whether to unequip dependent layers
   * @param {string} [options.reason] - Reason for unequipping
   * @returns {Promise<{success: boolean, unequipped?: boolean, cascadeItems?: string[], errors?: string[]}>}
   */
  async unequipClothing(entityId, clothingItemId, options = {}) {
    try {
      if (!entityId) {
        throw new InvalidArgumentError('entityId is required');
      }
      if (!clothingItemId) {
        throw new InvalidArgumentError('clothingItemId is required');
      }

      this.#logger.info(
        `ClothingManagementService: Unequipping clothing '${clothingItemId}' from entity '${entityId}'`,
        { options }
      );

      // Delegate to orchestrator for complex workflow
      const result = await this.#orchestrator.orchestrateUnequipment({
        entityId,
        clothingItemId,
        ...options,
      });

      if (result.success) {
        this.#logger.info(
          `ClothingManagementService: Successfully unequipped clothing '${clothingItemId}' from entity '${entityId}'`
        );
      } else {
        this.#logger.warn(
          `ClothingManagementService: Failed to unequip clothing '${clothingItemId}' from entity '${entityId}'`,
          { errors: result.errors }
        );
      }

      return result;
    } catch (error) {
      this.#logger.error(
        `ClothingManagementService: Error unequipping clothing '${clothingItemId}' from entity '${entityId}'`,
        { error }
      );
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Gets all equipped clothing items for an entity
   *
   * @param {string} entityId - The entity to get equipped items for
   * @returns {Promise<{success: boolean, equipped?: object, errors?: string[]}>}
   */
  async getEquippedItems(entityId) {
    try {
      if (!entityId) {
        throw new InvalidArgumentError('entityId is required');
      }

      this.#logger.debug(
        `ClothingManagementService: Getting equipped items for entity '${entityId}'`
      );

      // Get equipment component
      const equipmentData = this.#entityManager.getComponentData(
        entityId,
        'clothing:equipment'
      );

      if (!equipmentData) {
        this.#logger.debug(
          `ClothingManagementService: Entity '${entityId}' has no equipment component`
        );
        return {
          success: true,
          equipped: {},
        };
      }

      return {
        success: true,
        equipped: equipmentData.equipped || {},
      };
    } catch (error) {
      this.#logger.error(
        `ClothingManagementService: Error getting equipped items for entity '${entityId}'`,
        { error }
      );
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Validates if a clothing item can be equipped on an entity
   *
   * @param {string} entityId - The entity to validate equipment for
   * @param {string} clothingItemId - The clothing item entity ID to validate
   * @param {object} [options] - Validation options
   * @returns {Promise<{valid: boolean, errors?: string[], warnings?: string[], compatibility?: object}>}
   */
  async validateCompatibility(entityId, clothingItemId, options = {}) {
    try {
      if (!entityId) {
        throw new InvalidArgumentError('entityId is required');
      }
      if (!clothingItemId) {
        throw new InvalidArgumentError('clothingItemId is required');
      }

      this.#logger.debug(
        `ClothingManagementService: Validating compatibility for clothing '${clothingItemId}' on entity '${entityId}'`
      );

      // Delegate to orchestrator for validation
      const result = await this.#orchestrator.validateEquipmentCompatibility({
        entityId,
        clothingItemId,
        ...options,
      });

      return result;
    } catch (error) {
      this.#logger.error(
        `ClothingManagementService: Error validating compatibility for clothing '${clothingItemId}' on entity '${entityId}'`,
        { error }
      );
      return {
        valid: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Gets available clothing slots for an entity
   * Supports both legacy and new architecture patterns
   *
   * @param {string} entityId - The entity to get clothing slots for
   * @returns {Promise<{success: boolean, slots?: object[], errors?: string[]}>}
   */
  async getAvailableSlots(entityId) {
    try {
      if (!entityId) {
        throw new InvalidArgumentError('entityId is required');
      }

      this.#logger.debug(
        `ClothingManagementService: Getting available clothing slots for entity '${entityId}'`
      );

      let slots;

      // Use legacy service if available
      if (this.#anatomyClothingIntegration) {
        slots = await this.#anatomyClothingIntegration.getAvailableClothingSlots(entityId);
      } else {
        // Use new decomposed approach
        slots = await this.#getAvailableSlotsDecomposed(entityId);
      }

      // Convert Map to array format for backward compatibility
      const slotsArray = Array.from(slots.entries()).map(
        ([slotId, mapping]) => ({
          slotId,
          ...mapping,
        })
      );

      return {
        success: true,
        slots: slotsArray,
      };
    } catch (error) {
      this.#logger.error(
        `ClothingManagementService: Error getting available slots for entity '${entityId}'`,
        { error }
      );
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Gets available slots using the new decomposed architecture
   * 
   * @param {string} entityId - Entity to query
   * @returns {Promise<Map<string, ClothingSlotMapping>>} Available slots
   * @private
   */
  async #getAvailableSlotsDecomposed(entityId) {
    // Check cache first
    const cacheKey = AnatomyClothingCache.createAvailableSlotsKey(entityId);
    const cached = this.#cache.get(CacheKeyTypes.AVAILABLE_SLOTS, cacheKey);
    if (cached) {
      return cached;
    }

    // Get entity's anatomy blueprint
    const bodyComponent = await this.#entityManager.getComponentData(
      entityId,
      'anatomy:body'
    );
    if (!bodyComponent?.recipeId) {
      return new Map();
    }

    const blueprint = await this.#anatomyBlueprintRepository.getBlueprintByRecipeId(
      bodyComponent.recipeId
    );

    if (!blueprint || !blueprint.clothingSlotMappings) {
      this.#logger.debug(`No clothing slot mappings for entity ${entityId}`);
      return new Map();
    }

    // Get entity's actual anatomy structure
    const anatomyStructure = await this.#getEntityAnatomyStructure(entityId);

    // Filter clothing slots to only those with valid mappings
    const availableSlots = new Map();

    for (const [slotId, mapping] of Object.entries(blueprint.clothingSlotMappings)) {
      if (await this.#validateSlotMapping(mapping, anatomyStructure, blueprint)) {
        availableSlots.set(slotId, mapping);
      }
    }

    this.#logger.debug(
      `Found ${availableSlots.size} clothing slots for entity ${entityId}`
    );

    // Cache the result
    this.#cache.set(CacheKeyTypes.AVAILABLE_SLOTS, cacheKey, availableSlots);

    return availableSlots;
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

    return {
      partIds: [entityId, ...allParts],
      socketIds: Array.from(sockets),
      bodyGraph,
    };
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
   * Transfers a clothing item from one entity to another
   *
   * @param {string} fromEntityId - Source entity
   * @param {string} toEntityId - Target entity
   * @param {string} clothingItemId - Clothing item to transfer
   * @param {object} [options] - Transfer options
   * @returns {Promise<{success: boolean, transferred?: boolean, errors?: string[]}>}
   */
  async transferClothing(
    fromEntityId,
    toEntityId,
    clothingItemId,
    options = {}
  ) {
    try {
      if (!fromEntityId) {
        throw new InvalidArgumentError('fromEntityId is required');
      }
      if (!toEntityId) {
        throw new InvalidArgumentError('toEntityId is required');
      }
      if (!clothingItemId) {
        throw new InvalidArgumentError('clothingItemId is required');
      }

      this.#logger.info(
        `ClothingManagementService: Transferring clothing '${clothingItemId}' from '${fromEntityId}' to '${toEntityId}'`,
        { options }
      );

      // Unequip from source
      const unequipResult = await this.unequipClothing(
        fromEntityId,
        clothingItemId,
        {
          reason: 'transfer',
        }
      );

      if (!unequipResult.success) {
        return {
          success: false,
          errors: [
            `Failed to unequip from source: ${unequipResult.errors?.join(', ')}`,
          ],
        };
      }

      // Equip on target
      const equipResult = await this.equipClothing(
        toEntityId,
        clothingItemId,
        options
      );

      if (!equipResult.success) {
        // Try to re-equip on source if target failed
        await this.equipClothing(fromEntityId, clothingItemId, {});

        return {
          success: false,
          errors: [
            `Failed to equip on target: ${equipResult.errors?.join(', ')}`,
          ],
        };
      }

      this.#logger.info(
        `ClothingManagementService: Successfully transferred clothing '${clothingItemId}' from '${fromEntityId}' to '${toEntityId}'`
      );

      return {
        success: true,
        transferred: true,
      };
    } catch (error) {
      this.#logger.error(
        `ClothingManagementService: Error transferring clothing '${clothingItemId}' from '${fromEntityId}' to '${toEntityId}'`,
        { error }
      );
      return {
        success: false,
        errors: [error.message],
      };
    }
  }
}

export default ClothingManagementService;