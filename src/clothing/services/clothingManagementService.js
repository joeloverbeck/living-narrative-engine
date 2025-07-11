/**
 * @file ClothingManagementService - Facade for clothing system operations
 *
 * Provides a simplified interface for clothing equipment and management operations
 * while delegating complex orchestration to specialized services.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../orchestration/equipmentOrchestrator.js').EquipmentOrchestrator} EquipmentOrchestrator */
/** @typedef {import('../../anatomy/integration/anatomyClothingIntegrationService.js').AnatomyClothingIntegrationService} AnatomyClothingIntegrationService */

/**
 * Facade service for clothing system operations
 *
 * Provides high-level API for clothing equipment, validation, and management
 * while delegating complex workflows to specialized orchestrators.
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
  /** @type {AnatomyClothingIntegrationService} */
  #anatomyClothingIntegration;

  /**
   * Creates an instance of ClothingManagementService
   *
   * @param {object} deps - Constructor dependencies
   * @param {IEntityManager} deps.entityManager - Entity manager for entity operations
   * @param {ILogger} deps.logger - Logger instance
   * @param {ISafeEventDispatcher} deps.eventDispatcher - Event dispatcher for system events
   * @param {EquipmentOrchestrator} deps.equipmentOrchestrator - Orchestrator for complex equipment workflows
   * @param {AnatomyClothingIntegrationService} deps.anatomyClothingIntegrationService - Service for anatomy-clothing integration
   */
  constructor({
    entityManager,
    logger,
    eventDispatcher,
    equipmentOrchestrator,
    anatomyClothingIntegrationService,
  }) {
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(logger, 'ILogger');
    validateDependency(eventDispatcher, 'ISafeEventDispatcher');
    validateDependency(equipmentOrchestrator, 'EquipmentOrchestrator');
    validateDependency(
      anatomyClothingIntegrationService,
      'AnatomyClothingIntegrationService'
    );

    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#eventDispatcher = eventDispatcher;
    this.#orchestrator = equipmentOrchestrator;
    this.#anatomyClothingIntegration = anatomyClothingIntegrationService;
  }

  /**
   * Equips a clothing item on an entity
   *
   * @param {string} entityId - The entity to equip clothing on
   * @param {string} clothingItemId - The clothing item entity ID to equip
   * @param {object} [options] - Equipment options
   * @param {string} [options.layer] - Force specific layer (overrides item default)
   * @param {string} [options.conflictResolution] - How to handle conflicts
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

      // Delegate to anatomy clothing integration service
      const slots =
        await this.#anatomyClothingIntegration.getAvailableClothingSlots(
          entityId
        );

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
        await this.equipClothing(fromEntityId, clothingItemId, {
          conflictResolution: 'auto_remove',
        });

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
