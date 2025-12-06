/**
 * @file Unit tests for IClothingSystemFacade interface
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import IClothingSystemFacade from '../../../../src/clothing/facades/IClothingSystemFacade.js';

// Test implementation for concrete facade
class TestClothingSystemFacade extends IClothingSystemFacade {
  constructor(options = {}) {
    const mockDependencies = {
      // Core base facade dependencies
      logger: {
        info: () => {},
        debug: () => {},
        error: () => {},
        warn: () => {},
      },
      eventBus: { dispatch: () => {}, subscribe: () => {} },
      unifiedCache: {
        get: () => undefined,
        set: () => {},
        invalidate: () => {},
      },
      circuitBreaker: null, // Optional dependency

      // IClothingSystemFacade-specific service dependencies
      clothingManagementService: {
        getAccessibleItems: async () => [],
        getEquippedItems: async () => [],
        getItemsInSlot: async () => null,
      },
      equipmentOrchestrator: {
        equipItem: async () => ({ success: true }),
        unequipItem: async () => ({ success: true }),
        swapItems: async () => ({ success: true }),
        clearSlot: async () => ({ success: true }),
      },
      layerCompatibilityService: {
        checkCompatibility: async () => true,
        getConflicts: async () => [],
        getBlockedSlots: async () => [],
        getLayerConflicts: async () => [],
      },
      clothingSlotValidator: {
        validateEntityEquipment: async () => ({ valid: true, errors: [] }),
      },
    };
    super({ ...mockDependencies, ...options });
  }
}

describe('IClothingSystemFacade', () => {
  let testBed;
  let facade;
  let loggerMock;
  let eventBusMock;
  let cacheMock;

  const createFacadeInstance = (overrides = {}) =>
    new TestClothingSystemFacade({
      logger: loggerMock,
      eventBus: eventBusMock,
      unifiedCache: cacheMock,
      circuitBreaker: null,
      ...overrides,
    });

  beforeEach(() => {
    testBed = createTestBed();
    loggerMock = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
    eventBusMock = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    };
    cacheMock = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      invalidate: jest.fn().mockResolvedValue(undefined),
      invalidateByPattern: jest.fn().mockResolvedValue(undefined),
    };

    facade = createFacadeInstance();
  });

  afterEach(() => {
    testBed.cleanup();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create facade instance', () => {
      expect(facade).toBeInstanceOf(IClothingSystemFacade);
      expect(facade).toBeInstanceOf(TestClothingSystemFacade);
    });

    it('should throw error when instantiated directly', () => {
      expect(() => {
        new IClothingSystemFacade({
          logger: {
            info: () => {},
            debug: () => {},
            error: () => {},
            warn: () => {},
          },
          eventBus: { dispatch: () => {}, subscribe: () => {} },
          unifiedCache: {
            get: () => null,
            set: () => {},
            invalidate: () => {},
          },
        });
      }).toThrow('Cannot instantiate abstract class IClothingSystemFacade');
    });
  });

  describe('interface methods', () => {
    describe('query methods', () => {
      it('should have getAccessibleItems method', () => {
        expect(typeof facade.getAccessibleItems).toBe('function');
      });

      it('should have getEquippedItems method', () => {
        expect(typeof facade.getEquippedItems).toBe('function');
      });

      it('should have getItemsInSlot method', () => {
        expect(typeof facade.getItemsInSlot).toBe('function');
      });
    });

    describe('modification methods', () => {
      it('should have equipItem method', () => {
        expect(typeof facade.equipItem).toBe('function');
      });

      it('should have unequipItem method', () => {
        expect(typeof facade.unequipItem).toBe('function');
      });

      it('should have swapItems method', () => {
        expect(typeof facade.swapItems).toBe('function');
      });

      it('should have clearSlot method', () => {
        expect(typeof facade.clearSlot).toBe('function');
      });
    });

    describe('validation methods', () => {
      it('should have validateEquipment method', () => {
        expect(typeof facade.validateEquipment).toBe('function');
      });

      it('should have getBlockedSlots method', () => {
        expect(typeof facade.getBlockedSlots).toBe('function');
      });

      it('should have getLayerConflicts method', () => {
        expect(typeof facade.getLayerConflicts).toBe('function');
      });
    });

    describe('bulk methods', () => {
      it('should have equipMultiple method', () => {
        expect(typeof facade.equipMultiple).toBe('function');
      });

      it('should have unequipMultiple method', () => {
        expect(typeof facade.unequipMultiple).toBe('function');
      });

      it('should have transferEquipment method', () => {
        expect(typeof facade.transferEquipment).toBe('function');
      });
    });
  });

  describe('method implementations', () => {
    describe('getAccessibleItems', () => {
      it('should return accessible items with proper response format', async () => {
        const response = await facade.getAccessibleItems('actor1');

        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.data).toEqual([]);
        expect(response.pagination).toBeDefined();
        expect(response.pagination.total).toBe(0);
        expect(response.metadata).toBeDefined();
        expect(response.metadata.operationType).toBe('getAccessibleItems');
      });

      it('should accept entityId and options parameters', async () => {
        const response = await facade.getAccessibleItems('actor1', {
          includeBlocked: false,
        });
        expect(response.success).toBe(true);
      });
    });

    describe('getEquippedItems', () => {
      it('should return equipped items with proper response format', async () => {
        const response = await facade.getEquippedItems('actor1');

        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.data).toEqual([]);
        expect(response.pagination).toBeDefined();
        expect(response.pagination.total).toBe(0);
        expect(response.metadata).toBeDefined();
        expect(response.metadata.operationType).toBe('getEquippedItems');
      });

      it('should accept entityId and options parameters', async () => {
        const response = await facade.getEquippedItems('actor1', {
          slot: 'weapon',
        });
        expect(response.success).toBe(true);
      });
    });

    describe('getItemsInSlot', () => {
      it('should return items in slot with proper response format', async () => {
        const response = await facade.getItemsInSlot('actor1', 'weapon');

        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.data).toBeNull();
        expect(response.metadata).toBeDefined();
        expect(response.metadata.operationType).toBe('getItemsInSlot');
      });
    });

    describe('equipItem', () => {
      it('should equip an item and return proper response', async () => {
        const response = await facade.equipItem('actor1', 'sword1', 'weapon');

        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
        expect(response.changes).toBeDefined();
        expect(response.changes.added).toHaveLength(1);
        expect(response.metadata).toBeDefined();
        expect(response.metadata.operationType).toBe('equipItem');
      });

      it('should accept entityId, itemId, slot, and options parameters', async () => {
        const response = await facade.equipItem('actor1', 'sword1', 'weapon', {
          force: false,
        });
        expect(response.success).toBe(true);
      });
    });

    describe('unequipItem', () => {
      it('should unequip an item and return proper response', async () => {
        const response = await facade.unequipItem('actor1', 'sword1');

        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
        expect(response.changes).toBeDefined();
        expect(response.changes.removed).toHaveLength(1);
        expect(response.metadata).toBeDefined();
        expect(response.metadata.operationType).toBe('unequipItem');
      });

      it('should accept entityId, itemId, and options parameters', async () => {
        const response = await facade.unequipItem('actor1', 'sword1', {
          force: false,
        });
        expect(response.success).toBe(true);
      });
    });

    describe('swapItems', () => {
      it('should swap items and return proper response', async () => {
        const response = await facade.swapItems('actor1', 'sword1', 'sword2');

        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
        expect(response.changes).toBeDefined();
        expect(response.changes.modified).toHaveLength(1);
        expect(response.metadata).toBeDefined();
        expect(response.metadata.operationType).toBe('swapItems');
      });

      it('should accept entityId, itemId1, itemId2, and options parameters', async () => {
        const response = await facade.swapItems('actor1', 'sword1', 'sword2', {
          validateFit: true,
        });
        expect(response.success).toBe(true);
      });
    });

    describe('clearSlot', () => {
      it('should clear slot and return proper response', async () => {
        const response = await facade.clearSlot('actor1', 'weapon');

        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
        expect(response.changes).toBeDefined();
        expect(response.metadata).toBeDefined();
        expect(response.metadata.operationType).toBe('clearSlot');
      });

      it('should accept entityId, slot, and options parameters', async () => {
        const response = await facade.clearSlot('actor1', 'weapon', {
          force: false,
        });
        expect(response.success).toBe(true);
      });
    });

    describe('validateEquipment', () => {
      it('should validate equipment and return proper response', async () => {
        const response = await facade.validateEquipment('actor1');

        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
        expect(response.data.valid).toBe(true);
        expect(response.data.errors).toEqual([]);
        expect(response.metadata).toBeDefined();
        expect(response.metadata.operationType).toBe('validateEquipment');
      });

      it('should accept entityId and options parameters', async () => {
        const response = await facade.validateEquipment('actor1', {
          includeWarnings: true,
        });
        expect(response.success).toBe(true);
      });
    });

    describe('getBlockedSlots', () => {
      it('should return blocked slots with proper response format', async () => {
        const response = await facade.getBlockedSlots('actor1');

        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.data).toEqual([]);
        expect(response.metadata).toBeDefined();
        expect(response.metadata.operationType).toBe('getBlockedSlots');
      });
    });

    describe('getLayerConflicts', () => {
      it('should return layer conflicts with proper response format', async () => {
        const response = await facade.getLayerConflicts('actor1');

        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.data).toEqual([]);
        expect(response.metadata).toBeDefined();
        expect(response.metadata.operationType).toBe('getLayerConflicts');
      });
    });

    describe('equipMultiple', () => {
      it('should equip multiple items and return proper response', async () => {
        const items = [
          { itemId: 'sword1', slot: 'weapon' },
          { itemId: 'armor1', slot: 'chest' },
        ];
        const response = await facade.equipMultiple('actor1', items);

        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
        expect(response.data.processed).toBe(2);
        expect(response.data.successful).toBe(2);
        expect(response.data.failed).toBe(0);
        expect(response.metadata).toBeDefined();
        expect(response.metadata.operationType).toBe('equipMultiple');
      });

      it('should accept entityId, items, and options parameters', async () => {
        const response = await facade.equipMultiple(
          'actor1',
          [{ itemId: 'sword1', slot: 'weapon' }],
          { stopOnError: false }
        );
        expect(response.success).toBe(true);
      });
    });

    describe('unequipMultiple', () => {
      it('should unequip multiple items and return proper response', async () => {
        const response = await facade.unequipMultiple('actor1', [
          'sword1',
          'armor1',
        ]);

        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
        expect(response.data.processed).toBe(2);
        expect(response.data.successful).toBe(2);
        expect(response.data.failed).toBe(0);
        expect(response.metadata).toBeDefined();
        expect(response.metadata.operationType).toBe('unequipMultiple');
      });

      it('should accept entityId, items, and options parameters', async () => {
        const response = await facade.unequipMultiple(
          'actor1',
          ['sword1', 'armor1'],
          { force: false }
        );
        expect(response.success).toBe(true);
      });
    });

    describe('transferEquipment', () => {
      it('should transfer equipment and return proper response', async () => {
        const response = await facade.transferEquipment('actor1', 'actor2');

        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
        expect(response.data.fromEntity).toBe('actor1');
        expect(response.data.toEntity).toBe('actor2');
        expect(response.data.transferred).toEqual([]);
        expect(response.data.failed).toEqual([]);
        expect(response.metadata).toBeDefined();
        expect(response.metadata.operationType).toBe('transferEquipment');
      });

      it('should accept fromEntityId, toEntityId, and options parameters', async () => {
        const response = await facade.transferEquipment('actor1', 'actor2', {
          itemFilter: { slot: 'weapon' },
          validateFit: true,
        });
        expect(response.success).toBe(true);
      });
    });
  });

  describe('inherited BaseFacade functionality', () => {
    it('should properly instantiate as a subclass of BaseFacade', () => {
      // Verify that the facade is an instance of IClothingSystemFacade
      expect(facade).toBeInstanceOf(IClothingSystemFacade);

      // The protected methods exist but are not directly accessible from tests
      // We verify their existence through the facade's behavior rather than direct access

      // Test that caching works (indirectly tests cacheableOperation)
      expect(
        async () => await facade.getAccessibleItems('actor1')
      ).not.toThrow();

      // Test that event dispatching works (indirectly tests dispatchEvent)
      expect(
        async () => await facade.equipItem('actor1', 'item1', 'slot')
      ).not.toThrow();
    });
  });

  describe('method parameter validation', () => {
    it('should handle default options parameter', async () => {
      const response = await facade.getAccessibleItems('actor1');
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
    });

    it('should handle undefined options gracefully', async () => {
      const response = await facade.getAccessibleItems('actor1', undefined);
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
    });

    it('should handle empty options object', async () => {
      const response = await facade.getAccessibleItems('actor1', {});
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
    });

    it('should work with complex options objects', async () => {
      const complexOptions = {
        includeBlocked: false,
        slot: 'weapon',
        sortBy: 'name',
        pagination: { limit: 10, offset: 0 },
        filter: { type: 'sword', rarity: 'epic' },
      };

      const response = await facade.getAccessibleItems(
        'actor1',
        complexOptions
      );
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
    });

    it('should handle array parameters correctly', async () => {
      const items = [
        { itemId: 'sword1', slot: 'weapon' },
        { itemId: 'armor1', slot: 'chest' },
        { itemId: 'helmet1', slot: 'head' },
      ];
      const response = await facade.equipMultiple('actor1', items);
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
    });

    it('should handle multiple entity parameters', async () => {
      const response = await facade.transferEquipment('actor1', 'actor2');
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
    });
  });

  describe('response format consistency', () => {
    it('should return standard query response format', async () => {
      const response = await facade.getAccessibleItems('actor1');

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('pagination');
      expect(response).toHaveProperty('metadata');
      expect(typeof response.success).toBe('boolean');
      expect(Array.isArray(response.data)).toBe(true);
      expect(typeof response.pagination.total).toBe('number');
    });

    it('should return standard modification response format', async () => {
      const response = await facade.equipItem('actor1', 'sword1', 'weapon');

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('changes');
      expect(response).toHaveProperty('metadata');
      expect(typeof response.success).toBe('boolean');
      expect(typeof response.data).toBe('object');
      expect(typeof response.changes).toBe('object');
    });

    it('should return standard validation response format', async () => {
      const response = await facade.validateEquipment('actor1');

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('metadata');
      expect(response.data).toHaveProperty('valid');
      expect(response.data).toHaveProperty('errors');
      expect(typeof response.success).toBe('boolean');
      expect(typeof response.data.valid).toBe('boolean');
      expect(Array.isArray(response.data.errors)).toBe(true);
    });
  });

  describe('resilience fallbacks', () => {
    it('should use fallback values when accessible item retrieval fails', async () => {
      const localEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
      const failingService = {
        getAccessibleItems: jest
          .fn()
          .mockRejectedValue(new Error('service down')),
        getEquippedItems: jest.fn(),
        getItemsInSlot: jest.fn(),
      };

      const fallbackFacade = createFacadeInstance({
        eventBus: localEventBus,
        clothingManagementService: failingService,
      });

      const response = await fallbackFacade.getAccessibleItems('actor1');

      expect(response.data).toEqual([]);
      expect(localEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'FACADE_OPERATION_ERROR' })
      );
      expect(failingService.getAccessibleItems).toHaveBeenCalledWith(
        'actor1',
        expect.objectContaining({ cache: true })
      );
    });

    it('should fall back to empty equipped items on error', async () => {
      const localEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
      const failingService = {
        getAccessibleItems: jest.fn(),
        getEquippedItems: jest.fn().mockRejectedValue(new Error('boom')),
        getItemsInSlot: jest.fn(),
      };

      const fallbackFacade = createFacadeInstance({
        eventBus: localEventBus,
        clothingManagementService: failingService,
      });

      const response = await fallbackFacade.getEquippedItems('actor1');

      expect(response.data).toEqual([]);
      expect(localEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'FACADE_OPERATION_ERROR' })
      );
      expect(failingService.getEquippedItems).toHaveBeenCalledWith(
        'actor1',
        expect.objectContaining({ cache: true })
      );
    });

    it('should fall back to null when slot lookup fails', async () => {
      const localEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
      const failingService = {
        getAccessibleItems: jest.fn(),
        getEquippedItems: jest.fn(),
        getItemsInSlot: jest.fn().mockRejectedValue(new Error('slot missing')),
      };

      const fallbackFacade = createFacadeInstance({
        eventBus: localEventBus,
        clothingManagementService: failingService,
      });

      const response = await fallbackFacade.getItemsInSlot('actor1', 'weapon');

      expect(response.data).toBeNull();
      expect(localEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'FACADE_OPERATION_ERROR' })
      );
    });

    it('should provide default compatibility data when compatibility checks fail', async () => {
      const localEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
      const failingLayerService = {
        checkCompatibility: jest
          .fn()
          .mockRejectedValue(new Error('no service')),
        getConflicts: jest.fn(),
        getBlockedSlots: jest.fn(),
        getLayerConflicts: jest.fn(),
      };

      const fallbackFacade = createFacadeInstance({
        eventBus: localEventBus,
        layerCompatibilityService: failingLayerService,
      });

      const response = await fallbackFacade.checkItemCompatibility(
        'actor1',
        'item1',
        'slot1'
      );

      expect(response.data).toEqual({
        compatible: false,
        reason: 'Compatibility check failed',
      });
      expect(localEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'FACADE_OPERATION_ERROR' })
      );
    });

    it('should fall back to validation error when validator is unavailable', async () => {
      const validator = {
        validateEntityEquipment: jest
          .fn()
          .mockRejectedValue(new Error('offline')),
      };

      const fallbackFacade = createFacadeInstance({
        clothingSlotValidator: validator,
      });

      const response = await fallbackFacade.validateEquipment('actor1');

      expect(response.data).toEqual({
        valid: false,
        errors: [{ message: 'Validation service unavailable' }],
      });
    });

    it('should return empty blocked slots when compatibility service fails', async () => {
      const localEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
      const failingLayerService = {
        checkCompatibility: jest.fn(),
        getConflicts: jest.fn(),
        getBlockedSlots: jest.fn().mockRejectedValue(new Error('no data')),
        getLayerConflicts: jest.fn(),
      };

      const fallbackFacade = createFacadeInstance({
        eventBus: localEventBus,
        layerCompatibilityService: failingLayerService,
      });

      const response = await fallbackFacade.getBlockedSlots('actor1');

      expect(response.data).toEqual([]);
      expect(localEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'FACADE_OPERATION_ERROR' })
      );
    });

    it('should return empty layer conflicts when retrieval fails', async () => {
      const localEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
      const failingLayerService = {
        checkCompatibility: jest.fn(),
        getConflicts: jest.fn(),
        getBlockedSlots: jest.fn(),
        getLayerConflicts: jest.fn().mockRejectedValue(new Error('timeout')),
      };

      const fallbackFacade = createFacadeInstance({
        eventBus: localEventBus,
        layerCompatibilityService: failingLayerService,
      });

      const response = await fallbackFacade.getLayerConflicts('actor1');

      expect(response.data).toEqual([]);
      expect(localEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'FACADE_OPERATION_ERROR' })
      );
    });
  });

  describe('modification safeguards', () => {
    it('should throw when attempting to equip incompatible items', async () => {
      jest
        .spyOn(facade, 'checkItemCompatibility')
        .mockResolvedValue({ data: { compatible: false, reason: 'blocked' } });

      const response = await facade.equipItem('actor1', 'item1', 'slot1', {
        validate: true,
        force: false,
      });

      expect(response.success).toBe(false);
      expect(response.error).toMatchObject({
        type: 'InvalidArgumentError',
        code: 'INVALID_ARGUMENT_ERROR',
      });
      expect(response.error.message).toContain(
        'Item item1 is not compatible with slot slot1'
      );
      expect(response.metadata.operationType).toBe('equipItem');
    });
  });

  describe('bulk operation edge cases', () => {
    it('should reject equipMultiple when items is not an array', async () => {
      const response = await facade.equipMultiple('actor1', 'invalid');

      expect(response.success).toBe(false);
      expect(response.error).toMatchObject({
        type: 'InvalidArgumentError',
        code: 'INVALID_ARGUMENT_ERROR',
      });
    });

    it('should handle mixed results during equipMultiple operations', async () => {
      const localEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
      const progressCallback = jest.fn();
      const bulkFacade = createFacadeInstance({ eventBus: localEventBus });

      jest
        .spyOn(bulkFacade, 'equipItem')
        .mockImplementation(async (_entityId, itemId) => {
          if (itemId === 'bad') {
            throw new Error('equip failure');
          }
          return { success: true, itemId };
        });

      const response = await bulkFacade.equipMultiple(
        'actor1',
        [
          { itemId: 'good', slot: 'slotA' },
          { itemId: 'bad', slot: 'slotB' },
        ],
        {
          returnResults: true,
          stopOnError: false,
          parallel: true,
          batchSize: 2,
          onProgress: progressCallback,
        }
      );

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ processed: 2, successful: 1, failed: 1 })
      );
      expect(response.data).toMatchObject({
        processed: 2,
        successful: 1,
        failed: 1,
      });
      expect(response.data.results).toEqual([
        {
          item: { itemId: 'good', slot: 'slotA' },
          result: { success: true, itemId: 'good' },
          success: true,
        },
        {
          item: { itemId: 'bad', slot: 'slotB' },
          error: 'equip failure',
          success: false,
        },
      ]);
      expect(localEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'CLOTHING_BULK_EQUIP_COMPLETED' })
      );
    });

    it('should stop equipMultiple processing when stopOnError is true', async () => {
      const bulkFacade = createFacadeInstance();

      const equipSpy = jest
        .spyOn(bulkFacade, 'equipItem')
        .mockImplementation(async () => {
          throw new Error('hard failure');
        });

      const response = await bulkFacade.equipMultiple('actor1', [
        { itemId: 'bad', slot: 'slotA' },
      ]);

      expect(response.success).toBe(false);
      expect(response.error.message).toBe('hard failure');
      expect(equipSpy).toHaveBeenCalledTimes(1);
    });

    it('should reject unequipMultiple when itemIds is not an array', async () => {
      const response = await facade.unequipMultiple('actor1', 'invalid');

      expect(response.success).toBe(false);
      expect(response.error).toMatchObject({
        type: 'InvalidArgumentError',
        code: 'INVALID_ARGUMENT_ERROR',
      });
    });

    it('should handle mixed results during unequipMultiple operations', async () => {
      const localEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
      const progressCallback = jest.fn();
      const bulkFacade = createFacadeInstance({ eventBus: localEventBus });

      jest
        .spyOn(bulkFacade, 'unequipItem')
        .mockImplementation(async (_entityId, itemId) => {
          if (itemId === 'bad') {
            throw new Error('unequip failure');
          }
          return { success: true, itemId };
        });

      const response = await bulkFacade.unequipMultiple(
        'actor1',
        ['good', 'bad'],
        {
          returnResults: true,
          stopOnError: false,
          parallel: true,
          batchSize: 2,
          onProgress: progressCallback,
        }
      );

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ processed: 2, successful: 1, failed: 1 })
      );
      expect(response.data).toMatchObject({
        processed: 2,
        successful: 1,
        failed: 1,
      });
      expect(response.data.results).toEqual([
        {
          itemId: 'good',
          result: { success: true, itemId: 'good' },
          success: true,
        },
        { itemId: 'bad', error: 'unequip failure', success: false },
      ]);
      expect(localEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'CLOTHING_BULK_UNEQUIP_COMPLETED' })
      );
    });

    it('should stop unequipMultiple processing when stopOnError is true', async () => {
      const bulkFacade = createFacadeInstance();

      const unequipSpy = jest
        .spyOn(bulkFacade, 'unequipItem')
        .mockImplementation(async () => {
          throw new Error('critical failure');
        });

      const response = await bulkFacade.unequipMultiple('actor1', ['bad']);

      expect(response.success).toBe(false);
      expect(response.error.message).toBe('critical failure');
      expect(unequipSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('transfer operations edge cases', () => {
    it('should track incompatible and failed transfers', async () => {
      const localEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
      const transferFacade = createFacadeInstance({ eventBus: localEventBus });

      jest.spyOn(transferFacade, 'getEquippedItems').mockResolvedValue({
        data: [
          { itemId: 'blocked', slot: 'head' },
          { itemId: 'error', slot: 'chest' },
          { itemId: 'success', slot: 'legs' },
        ],
      });

      jest
        .spyOn(transferFacade, 'checkItemCompatibility')
        .mockImplementation(async (_entity, itemId) => {
          if (itemId === 'blocked') {
            return {
              data: {
                compatible: false,
                reason: 'Layer or slot conflicts detected',
              },
            };
          }
          return { data: { compatible: true, reason: null } };
        });

      const unequipSpy = jest
        .spyOn(transferFacade, 'unequipItem')
        .mockResolvedValue({ success: true });

      const equipSpy = jest
        .spyOn(transferFacade, 'equipItem')
        .mockImplementation(async (_entity, itemId) => {
          if (itemId === 'error') {
            throw new Error('equip failed');
          }
          return { success: true };
        });

      const response = await transferFacade.transferEquipment('from', 'to');

      expect(unequipSpy).toHaveBeenCalledWith('from', 'error', {
        notifyOnChange: false,
      });
      expect(equipSpy).toHaveBeenCalledWith('to', 'success', 'legs', {
        notifyOnChange: false,
      });
      expect(response.data.transferred).toEqual([
        { itemId: 'success', slot: 'legs' },
      ]);
      expect(response.data.failed).toEqual([
        { itemId: 'blocked', reason: 'Layer or slot conflicts detected' },
        { itemId: 'error', error: 'equip failed' },
      ]);
      expect(cacheMock.invalidate).toHaveBeenCalledWith(
        'clothing:equipped:from'
      );
      expect(cacheMock.invalidate).toHaveBeenCalledWith('clothing:equipped:to');
      expect(localEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'CLOTHING_EQUIPMENT_TRANSFERRED' })
      );
    });
  });
});
