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

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../orchestration/equipmentOrchestrator.js').EquipmentOrchestrator} EquipmentOrchestrator */
/** @typedef {import('../../anatomy/integration/anatomyClothingIntegrationService.js').default} AnatomyClothingIntegrationService */
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
  /** @type {AnatomyClothingIntegrationService} */
  #anatomyClothingIntegrationService;
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
   * @param {AnatomyClothingIntegrationService} deps.anatomyClothingIntegrationService - Anatomy-clothing bridge
   * @param {ILogger} deps.logger - Logger instance
   * @param {ISafeEventDispatcher} deps.eventBus - Event dispatcher for system events
   */
  constructor({
    entityManager,
    dataRegistry,
    equipmentOrchestrator,
    anatomyClothingIntegrationService,
    logger,
    eventBus,
  }) {
    super();

    this.#logger = this._init('ClothingInstantiationService', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['createEntityInstance', 'getEntityInstance'],
      },
      dataRegistry: {
        value: dataRegistry,
        requiredMethods: ['get'],
      },
      equipmentOrchestrator: {
        value: equipmentOrchestrator,
        requiredMethods: ['orchestrateEquipment'],
      },
      anatomyClothingIntegrationService: {
        value: anatomyClothingIntegrationService,
        requiredMethods: ['validateClothingSlotCompatibility'],
      },
      eventBus: {
        value: eventBus,
        requiredMethods: ['dispatch'],
      },
    });

    this.#entityManager = entityManager;
    this.#dataRegistry = dataRegistry;
    this.#equipmentOrchestrator = equipmentOrchestrator;
    this.#anatomyClothingIntegrationService = anatomyClothingIntegrationService;
    this.#eventBus = eventBus;
  }

  /**
   * Instantiates clothing entities specified in a recipe
   *
   * @param {string} actorId - The character entity being created
   * @param {object} recipe - The anatomy recipe containing clothingEntities
   * @param {Map<string, string>} anatomyParts - Map of anatomy part names to entity IDs
   * @returns {Promise<ClothingInstantiationResult>} Result containing created clothing IDs and any errors
   */
  async instantiateRecipeClothing(actorId, recipe, anatomyParts) {
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
      anatomyParts,
      'Anatomy parts map is required',
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

    // Validate clothing slots against blueprint allowances for all items
    // Note: We'll validate individual items as we process them to allow partial success

    // Process each clothing entity
    for (const clothingConfig of recipe.clothingEntities) {
      try {
        // Validate slot compatibility if not skipping
        if (!clothingConfig.skipValidation) {
          const validationResult = await this.#validateClothingSlots(
            actorId,
            [clothingConfig]
          );

          if (!validationResult.isValid) {
            // Skip this item but continue processing others
            result.errors.push(...(validationResult.errors || [`Validation failed for ${clothingConfig.entityId}`]));
            continue;
          }
        }

        // Instantiate the clothing entity
        const clothingId = await this.#instantiateClothing(
          clothingConfig.entityId,
          clothingConfig.properties
        );

        result.instantiated.push({
          id: clothingId,
          definitionId: clothingConfig.entityId,
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
            result.equipped.push(clothingId);
            this.#logger.debug(
              `Equipped clothing '${clothingId}' on actor '${actorId}'`
            );
          } else {
            result.errors.push(equipResult.error);
            this.#logger.warn(
              `Failed to equip clothing '${clothingId}': ${equipResult.error}`
            );
          }
        }
      } catch (error) {
        this.#logger.error(
          `Error processing clothing entity '${clothingConfig.entityId}'`,
          error
        );
        result.errors.push({
          entityId: clothingConfig.entityId,
          error: error.message,
        });
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
          actorId,
          totalItems: recipe.clothingEntities?.length || 0,
          successfullyInstantiated: result.instantiated.length,
          successfullyEquipped: result.equipped.length,
          errors: result.errors,
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
   * Validates that clothing entities can be equipped on the actor
   *
   * @private
   * @param {string} actorId - The actor entity ID
   * @param {ClothingEntityConfig[]} clothingEntities - Clothing configurations to validate
   * @returns {Promise<{isValid: boolean, errors: string[]}>} Validation result
   */
  async #validateClothingSlots(actorId, clothingEntities) {
    const errors = [];

    for (const config of clothingEntities) {
      try {
        // Load entity definition to get default slot
        const definition = this.#dataRegistry.get('entityDefinitions', config.entityId);
        if (!definition) {
          errors.push(
            `Entity definition '${config.entityId}' not found in registry`
          );
          continue;
        }

        const clothingComponent = definition.components?.['clothing:wearable'];
        if (!clothingComponent) {
          errors.push(
            `Entity '${config.entityId}' does not have clothing:wearable component`
          );
          continue;
        }

        const targetSlot = config.targetSlot || clothingComponent.equipmentSlots?.primary;
        if (!targetSlot) {
          errors.push(
            `Entity '${config.entityId}' does not specify a clothing slot`
          );
          continue;
        }

        // Validate slot compatibility with blueprint
        // Note: validateClothingSlotCompatibility expects (entityId, slotId, itemId)
        // Since we're validating before creation, we'll use the actor ID
        const validationResult =
          await this.#anatomyClothingIntegrationService.validateClothingSlotCompatibility(
            actorId,
            targetSlot,
            config.entityId
          );

        if (!validationResult.valid) {
          errors.push(validationResult.reason || `Cannot equip ${config.entityId} to slot ${targetSlot}`);
        }
      } catch (error) {
        errors.push({
          entityId: config.entityId,
          error: error.message,
        });
      }
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
   * @returns {Promise<string>} The created entity ID
   */
  async #instantiateClothing(entityDefId, propertyOverrides) {
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

    // Create the entity instance with property overrides
    const clothingId = await this.#entityManager.createEntityInstance(
      entityDefId,
      propertyOverrides || {}
    );

    return clothingId;
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
      const result = await this.#equipmentOrchestrator.orchestrateEquipment(
        actorId,
        clothingId,
        options
      );

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
