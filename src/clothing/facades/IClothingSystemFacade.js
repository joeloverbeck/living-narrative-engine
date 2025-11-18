/**
 * @file Interface definition for the Clothing System Facade
 * @description Provides a simplified, high-level API for clothing system operations
 * @see src/shared/facades/BaseFacade.js
 * @see src/clothing/services/clothingManagementService.js
 * @see src/clothing/orchestration/equipmentOrchestrator.js
 */

import BaseFacade from '../../shared/facades/BaseFacade.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { assertNonBlankString } from '../../utils/dependencyUtils.js';
import { 
  createSuccessResponse, 
  createErrorResponse,
  createQueryResponse,
  createModificationResponse,
  createBulkResponse,
  createValidationResponse,
  withTiming,
} from '../../shared/facades/types/FacadeResponses.js';
import {
  createQueryOptions,
  createModificationOptions,
  createBulkOptions,
  createValidationOptions,
  mergeOptions,
} from '../../shared/facades/types/FacadeOptions.js';

/** @typedef {import('../../shared/facades/types/FacadeOptions.js').QueryOptions} QueryOptions */
/** @typedef {import('../../shared/facades/types/FacadeOptions.js').ModificationOptions} ModificationOptions */
/** @typedef {import('../../shared/facades/types/FacadeOptions.js').BulkOptions} BulkOptions */
/** @typedef {import('../../shared/facades/types/FacadeOptions.js').ValidationOptions} ValidationOptions */
/** @typedef {import('../../shared/facades/types/FacadeOptions.js').TransferOptions} TransferOptions */

/**
 * Interface for the Clothing System Facade
 * Provides simplified access to complex clothing system functionality
 */
class IClothingSystemFacade extends BaseFacade {
  #clothingManagementService;
  #equipmentOrchestrator;
  #layerCompatibilityService;
  #clothingSlotValidator;

  /**
   * @param {object} deps - Dependencies
   * @param {*} deps.clothingManagementService - Clothing management service
   * @param {*} deps.equipmentOrchestrator - Equipment orchestrator
   * @param {*} deps.layerCompatibilityService - Layer compatibility service
   * @param {*} deps.clothingSlotValidator - Clothing slot validator
   * @param {*} deps.logger - Logger service
   * @param {*} deps.eventBus - Event bus service
   * @param {*} deps.unifiedCache - Unified cache service
   * @param {*} [deps.circuitBreaker] - Circuit breaker service
   */
  constructor({ 
    clothingManagementService,
    equipmentOrchestrator,
    layerCompatibilityService,
    clothingSlotValidator,
    ...baseDeps 
  }) {
    super(baseDeps);
    
    // Prevent direct instantiation of abstract interface
    if (this.constructor === IClothingSystemFacade) {
      throw new Error('Cannot instantiate abstract class IClothingSystemFacade');
    }

    this.#clothingManagementService = clothingManagementService;
    this.#equipmentOrchestrator = equipmentOrchestrator;
    this.#layerCompatibilityService = layerCompatibilityService;
    this.#clothingSlotValidator = clothingSlotValidator;

    this.logOperation('info', 'ClothingSystemFacade initialized');
  }

  // =============================================================================
  // QUERY OPERATIONS
  // =============================================================================

  /**
   * Get all accessible clothing items for an entity
   *
   * @param {string} entityId - Entity identifier
   * @param {QueryOptions} [options] - Query options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').QueryResponse>}
   */
  async getAccessibleItems(entityId, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'getAccessibleItems', this);

      const queryOptions = mergeOptions(createQueryOptions(), options);
      const cacheKey = `clothing:accessible:${entityId}:${JSON.stringify(queryOptions)}`;

      return await this.cacheableOperation(cacheKey, async () => {
        const items = await this.executeWithResilience(
          'getAccessibleItems',
          async () => await this.#clothingManagementService.getAccessibleItems(entityId, queryOptions),
          async () => [], // Fallback to empty array
        );

        const pagination = {
          total: items.length,
          count: items.length,
          offset: queryOptions.offset || 0,
          hasMore: false,
        };

        return createQueryResponse(items, pagination, 'getAccessibleItems', {
          requestId: queryOptions.requestId,
          cached: false,
          cacheKey,
        });
      }, { ttl: queryOptions.ttl });
    }, 'getAccessibleItems', { requestId: options.requestId });
  }

  /**
   * Get currently equipped items for an entity
   *
   * @param {string} entityId - Entity identifier
   * @param {QueryOptions} [options] - Query options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').QueryResponse>}
   */
  async getEquippedItems(entityId, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'getEquippedItems', this);

      const queryOptions = mergeOptions(createQueryOptions(), options);
      const cacheKey = `clothing:equipped:${entityId}`;

      return await this.cacheableOperation(cacheKey, async () => {
        const items = await this.executeWithResilience(
          'getEquippedItems',
          async () => await this.#clothingManagementService.getEquippedItems(entityId, queryOptions),
          async () => [], // Fallback to empty array
        );

        const pagination = {
          total: items.length,
          count: items.length,
          offset: 0,
          hasMore: false,
        };

        return createQueryResponse(items, pagination, 'getEquippedItems', {
          requestId: queryOptions.requestId,
          cached: false,
          cacheKey,
        });
      }, { ttl: queryOptions.ttl });
    }, 'getEquippedItems', { requestId: options.requestId });
  }

  /**
   * Get items equipped in a specific slot
   *
   * @param {string} entityId - Entity identifier
   * @param {string} slot - Slot identifier
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').ItemResponse>}
   */
  async getItemsInSlot(entityId, slot) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'getItemsInSlot', this);
      assertNonBlankString(slot, 'Slot', 'getItemsInSlot', this);

      const cacheKey = `clothing:slot:${entityId}:${slot}`;

      return await this.cacheableOperation(cacheKey, async () => {
        const items = await this.executeWithResilience(
          'getItemsInSlot',
          async () => await this.#clothingManagementService.getItemsInSlot(entityId, slot),
          async () => null, // Fallback to null
        );

        return createSuccessResponse(items, 'getItemsInSlot', {
          cached: false,
          cacheKey,
        });
      });
    }, 'getItemsInSlot');
  }

  /**
   * Check if an item is compatible with a slot for an entity
   *
   * @param {string} entityId - Entity identifier
   * @param {string} itemId - Item identifier
   * @param {string} slot - Slot identifier
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').CompatibilityResponse>}
   */
  async checkItemCompatibility(entityId, itemId, slot) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'checkItemCompatibility', this);
      assertNonBlankString(itemId, 'Item ID', 'checkItemCompatibility', this);
      assertNonBlankString(slot, 'Slot', 'checkItemCompatibility', this);

      const cacheKey = `clothing:compatibility:${entityId}:${itemId}:${slot}`;

      return await this.cacheableOperation(cacheKey, async () => {
        const compatibility = await this.executeWithResilience(
          'checkItemCompatibility',
          async () => {
            const isCompatible = await this.#layerCompatibilityService.checkCompatibility(entityId, itemId, slot);
            const conflicts = await this.#layerCompatibilityService.getConflicts(entityId, itemId, slot);
            
            return {
              compatible: isCompatible,
              conflicts: conflicts || [],
              reason: isCompatible ? null : 'Layer or slot conflicts detected',
            };
          },
          async () => ({ compatible: false, reason: 'Compatibility check failed' }),
        );

        return createSuccessResponse(compatibility, 'checkItemCompatibility', {
          cached: false,
          cacheKey,
        });
      });
    }, 'checkItemCompatibility');
  }

  // =============================================================================
  // MODIFICATION OPERATIONS
  // =============================================================================

  /**
   * Equip an item to a specific slot
   *
   * @param {string} entityId - Entity identifier
   * @param {string} itemId - Item identifier
   * @param {string} slot - Slot identifier
   * @param {ModificationOptions} [options] - Modification options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').ModificationResponse>}
   */
  async equipItem(entityId, itemId, slot, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'equipItem', this);
      assertNonBlankString(itemId, 'Item ID', 'equipItem', this);
      assertNonBlankString(slot, 'Slot', 'equipItem', this);

      const modOptions = mergeOptions(createModificationOptions(), options);

      const result = await this.executeWithResilience(
        'equipItem',
        async () => {
          // Validate if not forcing
          if (!modOptions.force && modOptions.validate) {
            const compatibility = await this.checkItemCompatibility(entityId, itemId, slot);
            if (!compatibility.data.compatible) {
              throw new InvalidArgumentError(`Item ${itemId} is not compatible with slot ${slot}: ${compatibility.data.reason}`);
            }
          }

          // Execute equipment change
          const equipResult = await this.#equipmentOrchestrator.equipItem(entityId, itemId, slot, modOptions);

          // Invalidate related caches
          await this.invalidateCache(`clothing:equipped:${entityId}`);
          await this.invalidateCache(`clothing:slot:${entityId}:${slot}`);

          return equipResult;
        },
      );

      const changes = {
        added: [{ itemId, slot, entityId }],
        removed: [],
        modified: [],
      };

      // Dispatch equipment event
      if (modOptions.notifyOnChange) {
        this.dispatchEvent('CLOTHING_ITEM_EQUIPPED', {
          entityId,
          itemId,
          slot,
          timestamp: Date.now(),
        });
      }

      return createModificationResponse(result, changes, 'equipItem', {
        requestId: modOptions.requestId,
        rollbackAvailable: true,
      });
    }, 'equipItem', { requestId: options.requestId });
  }

  /**
   * Unequip an item from an entity
   *
   * @param {string} entityId - Entity identifier
   * @param {string} itemId - Item identifier
   * @param {ModificationOptions} [options] - Modification options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').ModificationResponse>}
   */
  async unequipItem(entityId, itemId, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'unequipItem', this);
      assertNonBlankString(itemId, 'Item ID', 'unequipItem', this);

      const modOptions = mergeOptions(createModificationOptions(), options);

      const result = await this.executeWithResilience(
        'unequipItem',
        async () => {
          const unequipResult = await this.#equipmentOrchestrator.unequipItem(entityId, itemId, modOptions);

          // Invalidate related caches
          await this.invalidateCache(`clothing:equipped:${entityId}`);
          await this.invalidateCache(`clothing:slot:${entityId}:*`, true);

          return unequipResult;
        },
      );

      const changes = {
        added: [],
        removed: [{ itemId, entityId }],
        modified: [],
      };

      // Dispatch unequipment event
      if (modOptions.notifyOnChange) {
        this.dispatchEvent('CLOTHING_ITEM_UNEQUIPPED', {
          entityId,
          itemId,
          timestamp: Date.now(),
        });
      }

      return createModificationResponse(result, changes, 'unequipItem', {
        requestId: modOptions.requestId,
        rollbackAvailable: true,
      });
    }, 'unequipItem', { requestId: options.requestId });
  }

  /**
   * Swap two items between slots or entities
   *
   * @param {string} entityId - Entity identifier
   * @param {string} itemId1 - First item identifier
   * @param {string} itemId2 - Second item identifier
   * @param {ModificationOptions} [options] - Modification options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').ModificationResponse>}
   */
  async swapItems(entityId, itemId1, itemId2, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'swapItems', this);
      assertNonBlankString(itemId1, 'Item ID 1', 'swapItems', this);
      assertNonBlankString(itemId2, 'Item ID 2', 'swapItems', this);

      const modOptions = mergeOptions(createModificationOptions(), options);

      const result = await this.executeWithResilience(
        'swapItems',
        async () => {
          const swapResult = await this.#equipmentOrchestrator.swapItems(entityId, itemId1, itemId2, modOptions);

          // Invalidate related caches
          await this.invalidateCache(`clothing:equipped:${entityId}`);
          await this.invalidateCache(`clothing:slot:${entityId}:*`, true);

          return swapResult;
        },
      );

      const changes = {
        added: [],
        removed: [],
        modified: [{ itemId1, itemId2, entityId }],
      };

      // Dispatch swap event
      if (modOptions.notifyOnChange) {
        this.dispatchEvent('CLOTHING_ITEMS_SWAPPED', {
          entityId,
          itemId1,
          itemId2,
          timestamp: Date.now(),
        });
      }

      return createModificationResponse(result, changes, 'swapItems', {
        requestId: modOptions.requestId,
        rollbackAvailable: true,
      });
    }, 'swapItems', { requestId: options.requestId });
  }

  /**
   * Clear all items from a specific slot
   *
   * @param {string} entityId - Entity identifier
   * @param {string} slot - Slot identifier
   * @param {ModificationOptions} [options] - Modification options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').ModificationResponse>}
   */
  async clearSlot(entityId, slot, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'clearSlot', this);
      assertNonBlankString(slot, 'Slot', 'clearSlot', this);

      const modOptions = mergeOptions(createModificationOptions(), options);

      const result = await this.executeWithResilience(
        'clearSlot',
        async () => {
          // Get current items in slot
          const currentItems = await this.getItemsInSlot(entityId, slot);
          
          const clearResult = await this.#equipmentOrchestrator.clearSlot(entityId, slot, modOptions);

          // Invalidate related caches
          await this.invalidateCache(`clothing:equipped:${entityId}`);
          await this.invalidateCache(`clothing:slot:${entityId}:${slot}`);

          return {
            ...clearResult,
            previousItems: currentItems.data,
          };
        },
      );

      const changes = {
        added: [],
        removed: result.previousItems ? [{ slot, entityId, items: result.previousItems }] : [],
        modified: [],
      };

      // Dispatch clear event
      if (modOptions.notifyOnChange) {
        this.dispatchEvent('CLOTHING_SLOT_CLEARED', {
          entityId,
          slot,
          timestamp: Date.now(),
        });
      }

      return createModificationResponse(result, changes, 'clearSlot', {
        requestId: modOptions.requestId,
        rollbackAvailable: true,
      });
    }, 'clearSlot', { requestId: options.requestId });
  }

  // =============================================================================
  // VALIDATION OPERATIONS
  // =============================================================================

  /**
   * Validate all equipped items for an entity
   *
   * @param {string} entityId - Entity identifier
   * @param {ValidationOptions} [options] - Validation options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').ValidationResponse>}
   */
  async validateEquipment(entityId, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'validateEquipment', this);

      const validationOptions = mergeOptions(createValidationOptions(), options);

      const validation = await this.executeWithResilience(
        'validateEquipment',
        async () => {
          return await this.#clothingSlotValidator.validateEntityEquipment(entityId, validationOptions);
        },
        async () => ({ valid: false, errors: [{ message: 'Validation service unavailable' }] }),
      );

      return createValidationResponse(validation, 'validateEquipment', {
        requestId: validationOptions.requestId,
      });
    }, 'validateEquipment', { requestId: options.requestId });
  }

  /**
   * Get slots that are blocked by current equipment
   *
   * @param {string} entityId - Entity identifier
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').ItemResponse>}
   */
  async getBlockedSlots(entityId) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'getBlockedSlots', this);

      const cacheKey = `clothing:blocked-slots:${entityId}`;

      return await this.cacheableOperation(cacheKey, async () => {
        const blockedSlots = await this.executeWithResilience(
          'getBlockedSlots',
          async () => await this.#layerCompatibilityService.getBlockedSlots(entityId),
          async () => [], // Fallback to empty array
        );

        return createSuccessResponse(blockedSlots, 'getBlockedSlots', {
          cached: false,
          cacheKey,
        });
      });
    }, 'getBlockedSlots');
  }

  /**
   * Get layer conflicts for current equipment
   *
   * @param {string} entityId - Entity identifier
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').ItemResponse>}
   */
  async getLayerConflicts(entityId) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'getLayerConflicts', this);

      const cacheKey = `clothing:layer-conflicts:${entityId}`;

      return await this.cacheableOperation(cacheKey, async () => {
        const conflicts = await this.executeWithResilience(
          'getLayerConflicts',
          async () => await this.#layerCompatibilityService.getLayerConflicts(entityId),
          async () => [], // Fallback to empty array
        );

        return createSuccessResponse(conflicts, 'getLayerConflicts', {
          cached: false,
          cacheKey,
        });
      });
    }, 'getLayerConflicts');
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  /**
   * Equip multiple items at once
   *
   * @param {string} entityId - Entity identifier
   * @param {object[]} items - Array of {itemId, slot} objects
   * @param {BulkOptions} [options] - Bulk operation options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').BulkResponse>}
   */
  async equipMultiple(entityId, items, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'equipMultiple', this);

      if (!Array.isArray(items)) {
        throw new InvalidArgumentError('Items must be an array');
      }

      const bulkOptions = mergeOptions(createBulkOptions(), options);
      const results = { processed: 0, successful: 0, failed: 0, results: [], errors: [] };

      for (let i = 0; i < items.length; i += bulkOptions.batchSize) {
        const batch = items.slice(i, i + bulkOptions.batchSize);
        
        const batchPromises = batch.map(async (item) => {
          try {
            const result = await this.equipItem(entityId, item.itemId, item.slot, bulkOptions);
            results.successful++;
            if (bulkOptions.returnResults) {
              results.results.push({ item, result, success: true });
            }
          } catch (error) {
            results.failed++;
            results.errors.push({ item, error: error.message });
            if (bulkOptions.returnResults) {
              results.results.push({ item, error: error.message, success: false });
            }
            
            if (bulkOptions.stopOnError) {
              throw error;
            }
          }
        });

        if (bulkOptions.parallel) {
          await Promise.allSettled(batchPromises);
        } else {
          for (const promise of batchPromises) {
            await promise;
          }
        }

        results.processed += batch.length;

        // Call progress callback if provided
        if (bulkOptions.onProgress) {
          bulkOptions.onProgress({
            processed: results.processed,
            total: items.length,
            successful: results.successful,
            failed: results.failed,
          });
        }
      }

      // Dispatch bulk event
      this.dispatchEvent('CLOTHING_BULK_EQUIP_COMPLETED', {
        entityId,
        itemCount: items.length,
        successful: results.successful,
        failed: results.failed,
        timestamp: Date.now(),
      });

      return createBulkResponse(results, 'equipMultiple', {
        requestId: bulkOptions.requestId,
        partial: results.failed > 0,
      });
    }, 'equipMultiple', { requestId: options.requestId });
  }

  /**
   * Unequip multiple items at once
   *
   * @param {string} entityId - Entity identifier
   * @param {string[]} itemIds - Array of item identifiers
   * @param {BulkOptions} [options] - Bulk operation options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').BulkResponse>}
   */
  async unequipMultiple(entityId, itemIds, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'unequipMultiple', this);

      if (!Array.isArray(itemIds)) {
        throw new InvalidArgumentError('Item IDs must be an array');
      }

      const bulkOptions = mergeOptions(createBulkOptions(), options);
      const results = { processed: 0, successful: 0, failed: 0, results: [], errors: [] };

      for (let i = 0; i < itemIds.length; i += bulkOptions.batchSize) {
        const batch = itemIds.slice(i, i + bulkOptions.batchSize);
        
        const batchPromises = batch.map(async (itemId) => {
          try {
            const result = await this.unequipItem(entityId, itemId, bulkOptions);
            results.successful++;
            if (bulkOptions.returnResults) {
              results.results.push({ itemId, result, success: true });
            }
          } catch (error) {
            results.failed++;
            results.errors.push({ itemId, error: error.message });
            if (bulkOptions.returnResults) {
              results.results.push({ itemId, error: error.message, success: false });
            }
            
            if (bulkOptions.stopOnError) {
              throw error;
            }
          }
        });

        if (bulkOptions.parallel) {
          await Promise.allSettled(batchPromises);
        } else {
          for (const promise of batchPromises) {
            await promise;
          }
        }

        results.processed += batch.length;

        // Call progress callback if provided
        if (bulkOptions.onProgress) {
          bulkOptions.onProgress({
            processed: results.processed,
            total: itemIds.length,
            successful: results.successful,
            failed: results.failed,
          });
        }
      }

      // Dispatch bulk event
      this.dispatchEvent('CLOTHING_BULK_UNEQUIP_COMPLETED', {
        entityId,
        itemCount: itemIds.length,
        successful: results.successful,
        failed: results.failed,
        timestamp: Date.now(),
      });

      return createBulkResponse(results, 'unequipMultiple', {
        requestId: bulkOptions.requestId,
        partial: results.failed > 0,
      });
    }, 'unequipMultiple', { requestId: options.requestId });
  }

  /**
   * Transfer equipment between entities
   *
   * @param {string} fromEntityId - Source entity identifier
   * @param {string} toEntityId - Target entity identifier
   * @param {TransferOptions} [options] - Transfer options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').TransferResponse>}
   */
  async transferEquipment(fromEntityId, toEntityId, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(fromEntityId, 'From Entity ID', 'transferEquipment', this);
      assertNonBlankString(toEntityId, 'To Entity ID', 'transferEquipment', this);

      const transferOptions = mergeOptions(
        { transferMode: 'move', validateCompatibility: true, updateReferences: true },
        options
      );

      const result = await this.executeWithResilience(
        'transferEquipment',
        async () => {
          // Get current equipment
          const fromEquipment = await this.getEquippedItems(fromEntityId);
          const transferred = [];
          const failed = [];

          for (const item of fromEquipment.data) {
            try {
              // Check compatibility if required
              if (transferOptions.validateCompatibility) {
                const compatibility = await this.checkItemCompatibility(toEntityId, item.itemId, item.slot);
                if (!compatibility.data.compatible) {
                  failed.push({ itemId: item.itemId, reason: compatibility.data.reason });
                  continue;
                }
              }

              // Unequip from source
              if (transferOptions.transferMode === 'move') {
                await this.unequipItem(fromEntityId, item.itemId, { notifyOnChange: false });
              }

              // Equip to target
              await this.equipItem(toEntityId, item.itemId, item.slot, { notifyOnChange: false });
              
              transferred.push(item);

            } catch (error) {
              failed.push({ itemId: item.itemId, error: error.message });
            }
          }

          // Invalidate caches for both entities
          await this.invalidateCache(`clothing:equipped:${fromEntityId}`);
          await this.invalidateCache(`clothing:equipped:${toEntityId}`);

          return {
            fromEntity: fromEntityId,
            toEntity: toEntityId,
            transferred,
            failed,
          };
        },
      );

      // Dispatch transfer event
      this.dispatchEvent('CLOTHING_EQUIPMENT_TRANSFERRED', {
        fromEntityId,
        toEntityId,
        transferredCount: result.transferred.length,
        failedCount: result.failed.length,
        timestamp: Date.now(),
      });

      return createSuccessResponse(result, 'transferEquipment', {
        requestId: transferOptions.requestId,
      });
    }, 'transferEquipment', { requestId: options.requestId });
  }
}

export default IClothingSystemFacade;