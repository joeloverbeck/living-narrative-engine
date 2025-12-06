/**
 * @file Service responsible for instantiating and equipping clothing during anatomy generation
 * @see src/anatomy/workflows/anatomyGenerationWorkflow.js
 */

import { BaseService } from '../../utils/serviceBase.js';
import {
  assertNonBlankString,
  assertPresent,
} from '../../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../constants/eventIds.js';
import LayerResolutionService from './layerResolutionService.js';
import { CacheKeyTypes } from '../../anatomy/cache/AnatomyClothingCache.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../orchestration/equipmentOrchestrator.js').EquipmentOrchestrator} EquipmentOrchestrator */
/** @typedef {import('../../anatomy/integration/SlotResolver.js').default} SlotResolver */
/** @typedef {import('../validation/clothingSlotValidator.js').default} ClothingSlotValidator */
/** @typedef {import('../../anatomy/repositories/anatomyBlueprintRepository.js').default} AnatomyBlueprintRepository */
/** @typedef {import('../../anatomy/bodyGraphService.js').default} BodyGraphService */
/** @typedef {import('../../anatomy/cache/AnatomyClothingCache.js').AnatomyClothingCache} AnatomyClothingCache */
/** @typedef {import('./layerResolutionService.js').LayerResolutionService} LayerResolutionService */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * Result of clothing instantiation operation
 *
 * @typedef {object} ClothingInstantiationResult
 * @property {Array<{id: string, definitionId: string}>} instantiated - Successfully created clothing entities
 * @property {string[]} equipped - Successfully equipped clothing IDs
 * @property {Array<string|{entityId: string, error: string}>} errors - Errors encountered during processing
 */

/**
 * Clothing configuration from recipe
 *
 * @typedef {object} ClothingEntityConfig
 * @property {string} entityId - The clothing entity definition to instantiate
 * @property {boolean} [equip=true] - Whether to automatically equip this item
 * @property {string} [targetSlot] - Specific clothing slot to equip to
 * @property {string} [layer] - Layer override (underwear, base, outer, accessories)
 * @property {object} [properties] - Property overrides for the instantiated entity
 * @property {boolean} [skipValidation=false] - Skip slot compatibility validation
 */

/**
 * Service that handles instantiation and equipment of clothing entities
 * specified in anatomy recipes
 */
export class ClothingInstantiationService extends BaseService {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {IDataRegistry} */
  #dataRegistry;
  /** @type {EquipmentOrchestrator} */
  #equipmentOrchestrator;
  /** @type {SlotResolver} */
  #slotResolver;
  /** @type {ClothingSlotValidator} */
  #clothingSlotValidator;
  /** @type {AnatomyBlueprintRepository} */
  #anatomyBlueprintRepository;
  /** @type {BodyGraphService} */
  #bodyGraphService;
  /** @type {AnatomyClothingCache} */
  #cache;
  /** @type {LayerResolutionService} */
  #layerResolutionService;
  /** @type {ILogger} */
  #logger;
  /** @type {ISafeEventDispatcher} */
  #eventBus;

  /**
   * Creates an instance of ClothingInstantiationService
   *
   * @param {object} deps - Constructor dependencies
   * @param {IEntityManager} deps.entityManager - Entity manager for entity operations
   * @param {IDataRegistry} deps.dataRegistry - Data registry for accessing loaded content
   * @param {EquipmentOrchestrator} deps.equipmentOrchestrator - Orchestrator for equipment workflows
   * @param {SlotResolver} deps.slotResolver - Resolver for slot-to-socket mapping
   * @param {ClothingSlotValidator} deps.clothingSlotValidator - Validator for slot compatibility
   * @param {AnatomyBlueprintRepository} deps.anatomyBlueprintRepository - Repository for anatomy blueprints
   * @param {BodyGraphService} deps.bodyGraphService - Service for anatomy structure queries
   * @param {AnatomyClothingCache} deps.anatomyClothingCache - Cache for performance optimization
   * @param {LayerResolutionService} deps.layerResolutionService - Layer precedence resolution service
   * @param {ILogger} deps.logger - Logger instance
   * @param {ISafeEventDispatcher} deps.eventBus - Event dispatcher for system events
   */
  constructor({
    entityManager,
    dataRegistry,
    equipmentOrchestrator,
    slotResolver,
    clothingSlotValidator,
    anatomyBlueprintRepository,
    bodyGraphService,
    anatomyClothingCache,
    layerResolutionService,
    logger,
    eventBus,
  }) {
    super();

    this.#logger = this._init('ClothingInstantiationService', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'createEntityInstance',
          'getEntityInstance',
          'removeEntityInstance',
        ],
      },
      dataRegistry: {
        value: dataRegistry,
        requiredMethods: ['get'],
      },
      equipmentOrchestrator: {
        value: equipmentOrchestrator,
        requiredMethods: ['orchestrateEquipment'],
      },
      slotResolver: {
        value: slotResolver,
        requiredMethods: ['resolveClothingSlot'],
      },
      clothingSlotValidator: {
        value: clothingSlotValidator,
        requiredMethods: ['validateSlotCompatibility'],
      },
      anatomyBlueprintRepository: {
        value: anatomyBlueprintRepository,
        requiredMethods: ['getBlueprintByRecipeId'],
      },
      bodyGraphService: {
        value: bodyGraphService,
        requiredMethods: ['getAnatomyData'],
      },
      anatomyClothingCache: {
        value: anatomyClothingCache,
        requiredMethods: ['get', 'set'],
      },
      layerResolutionService: {
        value: layerResolutionService,
        requiredMethods: ['resolveAndValidateLayer'],
      },
      eventBus: {
        value: eventBus,
        requiredMethods: ['dispatch'],
      },
    });

    this.#entityManager = entityManager;
    this.#dataRegistry = dataRegistry;
    this.#equipmentOrchestrator = equipmentOrchestrator;
    this.#slotResolver = slotResolver;
    this.#clothingSlotValidator = clothingSlotValidator;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#bodyGraphService = bodyGraphService;
    this.#cache = anatomyClothingCache;
    this.#layerResolutionService = layerResolutionService;
    this.#eventBus = eventBus;
  }

  /**
   * Instantiates clothing entities specified in a recipe
   *
   * @param {string} actorId - The character entity being created
   * @param {object} recipe - The anatomy recipe containing clothingEntities
   * @param {object} anatomyData - Object containing partsMap and slotEntityMappings
   * @param {Map<string, string>} anatomyData.partsMap - Map of anatomy part names to entity IDs
   * @param {Map<string, string>} anatomyData.slotEntityMappings - Map of slot IDs to entity IDs
   * @returns {Promise<ClothingInstantiationResult>} Result containing created clothing IDs and any errors
   */
  async instantiateRecipeClothing(actorId, recipe, anatomyData) {
    assertNonBlankString(
      actorId,
      'actorId',
      'instantiateRecipeClothing',
      this.#logger
    );
    assertPresent(
      recipe,
      'Recipe is required',
      InvalidArgumentError,
      this.#logger
    );
    assertPresent(
      anatomyData,
      'Anatomy data is required',
      InvalidArgumentError,
      this.#logger
    );
    assertPresent(
      anatomyData.partsMap,
      'Anatomy parts map is required',
      InvalidArgumentError,
      this.#logger
    );
    assertPresent(
      anatomyData.slotEntityMappings,
      'Slot entity mappings are required',
      InvalidArgumentError,
      this.#logger
    );

    const result = {
      instantiated: [],
      equipped: [],
      errors: [],
    };

    // Early return if no clothing entities defined
    if (!recipe.clothingEntities?.length) {
      return result;
    }

    this.#logger.info(
      `Starting clothing instantiation for actor '${actorId}' with ${recipe.clothingEntities.length} items`
    );

    // Store slot-entity mappings to pass through to slot resolver
    const slotEntityMappings = anatomyData.slotEntityMappings;

    // Validate clothing slots against blueprint allowances for all items
    // Note: We'll validate individual items as we process them to allow partial success

    // Process each clothing entity
    for (const clothingConfig of recipe.clothingEntities) {
      try {
        // Instantiate the clothing entity first
        const clothingId = await this.#instantiateClothing(
          clothingConfig.entityId,
          clothingConfig.properties,
          clothingConfig
        );

        // Now validate slot compatibility using the actual instance
        if (!clothingConfig.skipValidation) {
          this.#logger.debug(
            `ClothingInstantiationService: Starting post-instantiation validation for clothing '${clothingId}' (${clothingConfig.entityId})`
          );

          const validationResult =
            await this.#validateClothingSlotAfterInstantiation(
              actorId,
              clothingId,
              clothingConfig,
              slotEntityMappings
            );

          if (!validationResult.isValid) {
            // Remove the instantiated entity and skip this item
            try {
              await this.#entityManager.removeEntityInstance(clothingId);
              this.#logger.debug(
                `ClothingInstantiationService: Removed invalid clothing entity '${clothingId}'`
              );
            } catch (cleanupError) {
              this.#logger.warn(
                `ClothingInstantiationService: Failed to cleanup invalid entity '${clothingId}': ${cleanupError.message}`
              );
            }

            this.#logger.warn(
              `ClothingInstantiationService: Validation failed for '${clothingConfig.entityId}' with errors: ${JSON.stringify(validationResult.errors)}`
            );

            result.errors.push(
              ...(validationResult.errors || [
                `Post-instantiation validation failed for ${clothingConfig.entityId}`,
              ])
            );
            continue;
          }

          this.#logger.debug(
            `ClothingInstantiationService: Validation passed for clothing '${clothingId}' (${clothingConfig.entityId})`
          );
        }

        result.instantiated.push({
          clothingId: clothingId,
          entityDefinitionId: clothingConfig.entityId,
        });

        this.#logger.debug(
          `Instantiated clothing '${clothingConfig.entityId}' as entity '${clothingId}'`
        );

        // Equip if requested (default true)
        if (clothingConfig.equip !== false) {
          const equipResult = await this.#equipClothing(
            actorId,
            clothingId,
            clothingConfig
          );

          if (equipResult.success) {
            result.equipped.push({
              clothingId: clothingId,
              entityDefinitionId: clothingConfig.entityId,
            });
            this.#logger.debug(
              `Equipped clothing '${clothingId}' on actor '${actorId}'`
            );
          } else {
            result.errors.push(
              equipResult.errors?.[0] || 'Unknown equipment error'
            );
            this.#logger.warn(
              `Failed to equip clothing '${clothingId}': ${equipResult.errors?.[0] || 'Unknown equipment error'}`
            );
          }
        }
      } catch (error) {
        this.#logger.error(
          `Error processing clothing entity '${clothingConfig.entityId}'`,
          error
        );
        result.errors.push(`${clothingConfig.entityId}: ${error.message}`);
      }
    }

    // Dispatch completion event only if we processed any clothing entities
    if (recipe.clothingEntities && recipe.clothingEntities.length > 0) {
      this.#eventBus.dispatch('clothing:instantiation_completed', {
        actorId,
        result,
      });
    }

    // Emit system error if there were any failures
    if (result.errors.length > 0) {
      this.#eventBus.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: `Clothing instantiation failed for ${result.errors.length} items`,
        details: {
          raw: JSON.stringify({
            actorId,
            totalItems: recipe.clothingEntities?.length || 0,
            successfullyInstantiated: result.instantiated.length,
            successfullyEquipped: result.equipped.length,
            errors: result.errors,
          }),
          timestamp: new Date().toISOString(),
        },
      });
    }

    this.#logger.info(
      `Clothing instantiation completed for actor '${actorId}': ` +
        `${result.instantiated.length} created, ${result.equipped.length} equipped, ` +
        `${result.errors.length} errors`
    );

    return result;
  }

  /**
   * Validates clothing slot compatibility using decomposed components
   *
   * @private
   * @param {string} entityId - The entity to validate against
   * @param {string} slotId - The slot to validate
   * @param {string} itemId - The item to validate
   * @param {Map<string, string>} [slotEntityMappings] - Optional slot-to-entity mappings for this character
   * @returns {Promise<{valid: boolean, reason?: string}>} Validation result
   */
  async #validateClothingSlot(entityId, slotId, itemId, slotEntityMappings) {
    try {
      // Check cache first
      const cacheKey = `${entityId}:${slotId}:${itemId}`;
      const cached = this.#cache.get(CacheKeyTypes.VALIDATION, cacheKey);
      if (cached !== undefined) {
        return cached;
      }

      // Get available slots for the entity
      const availableSlots = await this.#getAvailableClothingSlots(entityId);

      // Create resolver function for the validator
      const resolveAttachmentPoints = async (entityId, slotId) => {
        return await this.#slotResolver.resolveClothingSlot(
          entityId,
          slotId,
          slotEntityMappings
        );
      };

      // Perform validation
      const result =
        await this.#clothingSlotValidator.validateSlotCompatibility(
          entityId,
          slotId,
          itemId,
          availableSlots,
          resolveAttachmentPoints
        );

      // Cache the result
      this.#cache.set(CacheKeyTypes.VALIDATION, cacheKey, result);

      return result;
    } catch (error) {
      this.#logger.error(
        `Failed to validate clothing slot: ${error.message}`,
        error
      );
      return {
        valid: false,
        reason: `Validation error: ${error.message}`,
      };
    }
  }

  /**
   * Gets available clothing slots for an entity
   *
   * @private
   * @param {string} entityId - The entity ID
   * @returns {Promise<Map<string, object>>} Available clothing slots
   */
  async #getAvailableClothingSlots(entityId) {
    // Check cache first
    const cacheKey = CacheKeyTypes.AVAILABLE_SLOTS + ':' + entityId;
    const cached = this.#cache.get(CacheKeyTypes.AVAILABLE_SLOTS, cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get anatomy data
      const anatomyData = await this.#bodyGraphService.getAnatomyData(entityId);
      if (!anatomyData?.recipeId) {
        this.#logger.debug(`No anatomy data found for entity ${entityId}`);
        return new Map();
      }

      // Get blueprint
      const blueprint =
        await this.#anatomyBlueprintRepository.getBlueprintByRecipeId(
          anatomyData.recipeId
        );

      if (!blueprint?.clothingSlotMappings) {
        this.#logger.debug(
          `No clothing slot mappings in blueprint for entity ${entityId}`
        );
        return new Map();
      }

      // Convert to Map format
      const availableSlots = new Map(
        Object.entries(blueprint.clothingSlotMappings)
      );

      // Cache the result
      this.#cache.set(CacheKeyTypes.AVAILABLE_SLOTS, cacheKey, availableSlots);

      return availableSlots;
    } catch (error) {
      this.#logger.error(
        `Failed to get available clothing slots: ${error.message}`,
        error
      );
      return new Map();
    }
  }

  /**
   * Validates that a clothing instance can be equipped on the actor after instantiation
   *
   * @private
   * @param {string} actorId - The actor entity ID
   * @param {string} clothingInstanceId - The clothing instance ID to validate
   * @param {ClothingEntityConfig} clothingConfig - Clothing configuration
   * @param {Map<string, string>} slotEntityMappings - Slot-to-entity mappings for this character
   * @returns {Promise<{isValid: boolean, errors: string[]}>} Validation result
   */
  async #validateClothingSlotAfterInstantiation(
    actorId,
    clothingInstanceId,
    clothingConfig,
    slotEntityMappings
  ) {
    const errors = [];

    try {
      // Get the actual clothing instance
      const clothingInstance =
        this.#entityManager.getEntityInstance(clothingInstanceId);
      if (!clothingInstance) {
        errors.push(`Clothing instance '${clothingInstanceId}' not found`);
        return { isValid: false, errors };
      }

      const clothingComponent =
        clothingInstance.getComponentData('clothing:wearable');
      if (!clothingComponent) {
        errors.push(
          `Clothing instance '${clothingInstanceId}' does not have clothing:wearable component`
        );
        return { isValid: false, errors };
      }

      const targetSlot =
        clothingConfig.targetSlot || clothingComponent.equipmentSlots?.primary;
      if (!targetSlot) {
        errors.push(
          `Clothing instance '${clothingInstanceId}' does not specify a clothing slot`
        );
        return { isValid: false, errors };
      }

      // Validate slot compatibility with blueprint using the actual instance
      this.#logger.debug(
        `ClothingInstantiationService: Validating slot compatibility for clothing '${clothingInstanceId}' in slot '${targetSlot}' on actor '${actorId}'`
      );

      const validationResult = await this.#validateClothingSlot(
        actorId,
        targetSlot,
        clothingInstanceId, // Now using instance ID instead of definition ID
        slotEntityMappings
      );

      if (!validationResult.valid) {
        const errorMessage =
          validationResult.reason ||
          `Cannot equip instance ${clothingInstanceId} to slot ${targetSlot}`;

        this.#logger.debug(
          `ClothingInstantiationService: Validation failed for clothing '${clothingInstanceId}': ${errorMessage}`
        );

        errors.push(errorMessage);
      } else {
        this.#logger.debug(
          `ClothingInstantiationService: Validation passed for clothing '${clothingInstanceId}' in slot '${targetSlot}'`
        );
      }
    } catch (error) {
      errors.push(`${clothingInstanceId}: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Instantiates a clothing entity with optional property overrides
   *
   * @private
   * @param {string} entityDefId - Entity definition ID
   * @param {object} [propertyOverrides] - Properties to override
   * @param {ClothingEntityConfig} clothingConfig - Configuration for the clothing item
   * @returns {Promise<string>} The created entity ID
   */
  async #instantiateClothing(entityDefId, propertyOverrides, clothingConfig) {
    assertNonBlankString(
      entityDefId,
      'entityDefId',
      '#instantiateClothing',
      this.#logger
    );

    this.#logger.debug(
      `Instantiating clothing entity '${entityDefId}' with overrides:`,
      propertyOverrides
    );

    // Load the entity definition
    const definition = this.#dataRegistry.get('entityDefinitions', entityDefId);
    if (!definition) {
      throw new InvalidArgumentError(
        `Entity definition '${entityDefId}' not found in registry`
      );
    }

    // Check if recipe provides any property overrides
    const hasPropertyOverrides =
      propertyOverrides && Object.keys(propertyOverrides).length > 0;

    // Apply layer resolution using precedence hierarchy
    const clothingComponent = definition.components?.['clothing:wearable'];

    // Only create component overrides if recipe provides properties
    // Otherwise, use entity definition as-is to preserve all required fields
    let clothingEntity;
    if (hasPropertyOverrides && clothingComponent) {
      let finalProperties = { ...propertyOverrides };

      // Apply layer resolution hierarchy: Recipe > Entity > Blueprint
      const layerResult = this.#layerResolutionService.resolveAndValidateLayer(
        clothingConfig.layer, // Recipe override (highest precedence)
        clothingComponent.layer, // Entity default (medium precedence)
        'base', // Blueprint default (lowest precedence)
        clothingComponent.allowedLayers // Allowed layers constraint
      );

      if (!layerResult.isValid) {
        throw new InvalidArgumentError(
          `Layer resolution failed for ${entityDefId}: ${layerResult.error}`
        );
      }

      // Set the resolved layer in the clothing component
      if (!finalProperties['clothing:wearable']) {
        finalProperties['clothing:wearable'] = {};
      }
      finalProperties['clothing:wearable'].layer = layerResult.layer;

      this.#logger.debug(
        `Resolved layer for '${entityDefId}': '${layerResult.layer}'`
      );

      // Create with component overrides
      clothingEntity = await this.#entityManager.createEntityInstance(
        entityDefId,
        { componentOverrides: finalProperties }
      );
    } else {
      // No property overrides - use entity definition completely
      // This preserves all required fields like equipmentSlots
      clothingEntity =
        await this.#entityManager.createEntityInstance(entityDefId);
    }

    // Return the entity ID string, not the Entity object
    if (!clothingEntity) {
      throw new Error(`Failed to create clothing entity '${entityDefId}'`);
    }

    // Handle both Entity objects (production) and string IDs (tests)
    const entityId =
      typeof clothingEntity === 'string' ? clothingEntity : clothingEntity.id;

    if (!entityId) {
      throw new Error(
        `Created clothing entity '${entityDefId}' has no valid ID`
      );
    }

    return entityId;
  }

  /**
   * Equips a clothing item on the actor
   *
   * @private
   * @param {string} actorId - The actor to equip the item on
   * @param {string} clothingId - The clothing entity to equip
   * @param {ClothingEntityConfig} config - Configuration for equipment
   * @returns {Promise<{success: boolean, error?: string}>} Equipment result
   */
  async #equipClothing(actorId, clothingId, config) {
    try {
      // Build equipment options from config
      const options = {
        targetSlot: config.targetSlot,
        layer: config.layer,
        skipValidation: config.skipValidation || false,
      };

      // Use equipment orchestrator to handle the complex workflow
      const result = await this.#equipmentOrchestrator.orchestrateEquipment({
        entityId: actorId,
        clothingItemId: clothingId,
        layer: options.layer,
        skipValidation: options.skipValidation,
        targetSlot: options.targetSlot,
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default ClothingInstantiationService;
