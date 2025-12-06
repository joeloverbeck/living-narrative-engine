/**
 * @file Unit tests for SlotResolver class
 * @see src/anatomy/integration/SlotResolver.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SlotResolver from '../../../../src/anatomy/integration/SlotResolver.js';

describe('SlotResolver', () => {
  let slotResolver;
  let mockLogger;
  let mockEntityManager;
  let mockBodyGraphService;
  let mockAnatomyBlueprintRepository;
  let mockAnatomySocketIndex;
  let mockCache;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockBodyGraphService = {
      getBodyGraph: jest.fn(),
    };

    mockAnatomyBlueprintRepository = {
      getBlueprintByRecipeId: jest.fn(),
    };

    mockAnatomySocketIndex = {
      findEntityWithSocket: jest.fn(),
    };

    // Mock cache that simulates AnatomyClothingCache behavior with new 2-arg signature
    mockCache = {
      get: jest.fn((type, key) => undefined), // Default to cache miss, accepts 2 args
      set: jest.fn(),
      clearType: jest.fn(),
      has: jest.fn().mockReturnValue(false),
    };

    slotResolver = new SlotResolver({
      logger: mockLogger,
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
      anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
      anatomySocketIndex: mockAnatomySocketIndex,
      cache: mockCache,
    });
  });

  describe('resolveClothingSlot', () => {
    it('should resolve a clothing slot successfully', async () => {
      // Mock the blueprint to return clothing slot mappings
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue({
        id: 'human_base',
        clothingSlotMappings: {
          'torso.chest': {
            blueprintSlots: ['torso_chest'],
          },
        },
        slots: {
          torso_chest: {
            socket: 'chest',
            type: 'torso',
          },
        },
      });

      // Mock entity manager to return body component
      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });

      // Mock socket index to find entity
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(
        'torso_entity'
      );

      // Mock body graph
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });

      // Test the method
      const result = await slotResolver.resolveClothingSlot(
        'actor123',
        'torso.chest'
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        entityId: 'torso_entity',
        socketId: 'chest',
        slotPath: 'torso_chest',
      });
    });

    it('should throw ClothingSlotNotFoundError when no strategy can resolve the slot', async () => {
      // Make all strategies unable to resolve
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue({
        slots: {},
      });

      // Mock entity manager to return an entity without body component
      mockEntityManager.getComponentData.mockResolvedValue(null);

      await expect(
        slotResolver.resolveClothingSlot('actor123', 'unknown_slot')
      ).rejects.toThrow('No blueprint found for entity actor123');
    });

    it('should propagate errors from strategies', async () => {
      // Mock an error in the blueprint repository
      const dbError = new Error('Database error');
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockRejectedValue(
        dbError
      );

      // Mock entity manager to return body component
      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });

      await expect(
        slotResolver.resolveClothingSlot('actor123', 'torso.chest')
      ).rejects.toThrow(dbError);
    });

    it('should validate required parameters', async () => {
      // Test missing entityId
      await expect(
        slotResolver.resolveClothingSlot(null, 'slotId')
      ).rejects.toThrow();

      // Test missing slotId
      await expect(
        slotResolver.resolveClothingSlot('entityId', null)
      ).rejects.toThrow();
    });

    it('should throw ClothingSlotNotFoundError when no clothing slot mapping strategy can resolve', async () => {
      // Create a custom strategy that cannot resolve clothing slot mappings
      const mockCustomStrategy = {
        canResolve: jest.fn((mapping) => mapping.socket !== undefined),
        resolve: jest.fn().mockResolvedValue([
          {
            entityId: 'direct_entity',
            socketId: 'direct_socket',
          },
        ]),
      };

      // Create resolver with custom strategies that don't include ClothingSlotMappingStrategy
      const customResolver = new SlotResolver({
        logger: mockLogger,
        strategies: [mockCustomStrategy],
        entityManager: mockEntityManager,
        bodyGraphService: mockBodyGraphService,
        anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
        anatomySocketIndex: mockAnatomySocketIndex,
        cache: mockCache,
      });

      await expect(
        customResolver.resolveClothingSlot('actor123', 'some_socket')
      ).rejects.toThrow(
        `Clothing slot 'some_socket' not found in blueprint clothing slot mappings`
      );

      // Should only try to resolve clothing slot mapping
      expect(mockCustomStrategy.canResolve).toHaveBeenCalledTimes(1);
      expect(mockCustomStrategy.canResolve).toHaveBeenCalledWith({
        clothingSlotId: 'some_socket',
      });
    });
  });

  describe('resolve', () => {
    it('should cache resolution results', async () => {
      const mapping = { blueprintSlots: ['torso.chest'] };

      // Mock blueprint strategy resolution
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue({
        slots: {
          'torso.chest': { socket: 'chest' },
        },
      });
      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(
        'torso_entity'
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });

      // First call should hit the strategies
      await slotResolver.resolve('actor123', 'torso.chest', mapping);

      // Verify cache was set
      expect(mockCache.set).toHaveBeenCalled();

      // Reset mocks before second call
      mockCache.get.mockReset();
      mockCache.get.mockImplementation((type, key) => [
        { entityId: 'cached_entity' },
      ]);

      // Second call should use cache
      const cachedResult = await slotResolver.resolve(
        'actor123',
        'torso.chest',
        mapping
      );

      expect(mockCache.get).toHaveBeenCalled();
      expect(cachedResult).toEqual([{ entityId: 'cached_entity' }]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache hit for slot resolution')
      );
    });

    it('should use Map fallback cache for cache set (line 161)', async () => {
      const mapping = { blueprintSlots: ['torso.chest'] };

      // Create a cache object that doesn't have the service signature
      // The condition is: if (this.#cache.set && this.#cache.get) - for service cache
      // For Map fallback, we need to not have both methods
      const mapCache = {
        has: jest.fn().mockReturnValue(false),
        set: jest.fn(),
        clear: jest.fn(),
      };

      // Don't add get method to force fallback to Map set behavior

      // Create resolver with Map fallback cache
      const resolverWithMapCache = new SlotResolver({
        logger: mockLogger,
        entityManager: mockEntityManager,
        bodyGraphService: mockBodyGraphService,
        anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
        anatomySocketIndex: mockAnatomySocketIndex,
        cache: mapCache,
      });

      // Mock blueprint strategy resolution
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue({
        slots: {
          'torso.chest': { socket: 'chest' },
        },
      });
      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(
        'torso_entity'
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });

      // Should use Map fallback cache set
      await resolverWithMapCache.resolve('actor123', 'torso.chest', mapping);

      // Verify result was cached using Map fallback
      expect(mapCache.set).toHaveBeenCalledWith(
        'actor123:torso.chest',
        expect.any(Array)
      );
    });

    it('should return empty array when no strategy can resolve mapping (lines 141-144)', async () => {
      const mapping = { unknownMappingType: 'test' };

      // Mock all strategies to return false for canResolve
      const mockStrategy1 = {
        canResolve: jest.fn().mockReturnValue(false),
        resolve: jest.fn(),
      };
      const mockStrategy2 = {
        canResolve: jest.fn().mockReturnValue(false),
        resolve: jest.fn(),
      };

      // Create resolver with custom strategies that can't resolve
      const resolverWithCustomStrategies = new SlotResolver({
        logger: mockLogger,
        strategies: [mockStrategy1, mockStrategy2],
        entityManager: mockEntityManager,
        bodyGraphService: mockBodyGraphService,
        anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
        anatomySocketIndex: mockAnatomySocketIndex,
        cache: mockCache,
      });

      const result = await resolverWithCustomStrategies.resolve(
        'actor123',
        'test.slot',
        mapping
      );

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `SlotResolver: No strategy found for mapping type in slot 'test.slot'. Available strategies: 2`
      );
      expect(mockStrategy1.canResolve).toHaveBeenCalledWith(mapping);
      expect(mockStrategy2.canResolve).toHaveBeenCalledWith(mapping);
      expect(mockStrategy1.resolve).not.toHaveBeenCalled();
      expect(mockStrategy2.resolve).not.toHaveBeenCalled();
    });

    it('should handle errors from strategies and log them (lines 170-174)', async () => {
      const mapping = { blueprintSlots: ['torso.chest'] };
      const strategyError = new Error('Strategy failed');

      // Mock blueprint strategy to throw error
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockRejectedValue(
        strategyError
      );
      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });

      await expect(
        slotResolver.resolve('actor123', 'torso.chest', mapping)
      ).rejects.toThrow(strategyError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to resolve slot 'torso.chest' for entity 'actor123'`,
        strategyError
      );
    });

    it('should validate required parameters in resolve', async () => {
      const mapping = { blueprintSlots: ['torso.chest'] };

      // Test missing entityId
      await expect(
        slotResolver.resolve(null, 'slotId', mapping)
      ).rejects.toThrow();

      // Test missing slotId
      await expect(
        slotResolver.resolve('entityId', null, mapping)
      ).rejects.toThrow();

      // Test missing mapping
      await expect(
        slotResolver.resolve('entityId', 'slotId', null)
      ).rejects.toThrow();
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', () => {
      slotResolver.clearCache();

      expect(mockCache.clearType).toHaveBeenCalledWith(expect.any(String));
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Slot resolution cache cleared'
      );
    });

    it('should use Map fallback cache for cache clear (line 201)', () => {
      // Create a cache object that doesn't have the service signature
      // The condition is: if (this.#cache.clearType) - for service cache
      // For Map fallback, we need to not have clearType method
      const mapCache = {
        has: jest.fn().mockReturnValue(false),
        set: jest.fn(),
        clear: jest.fn(),
      };

      // Don't add clearType method to force fallback to Map clear behavior

      // Create resolver with Map fallback cache
      const resolverWithMapCache = new SlotResolver({
        logger: mockLogger,
        entityManager: mockEntityManager,
        bodyGraphService: mockBodyGraphService,
        anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
        anatomySocketIndex: mockAnatomySocketIndex,
        cache: mapCache,
      });

      // Should use Map fallback cache clear
      resolverWithMapCache.clearCache();

      // Verify Map fallback clear was called
      expect(mapCache.clear).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Slot resolution cache cleared'
      );
    });
  });

  describe('getStrategyCount', () => {
    it('should return the correct number of strategies', () => {
      const count = slotResolver.getStrategyCount();

      // Should have 3 default strategies (ClothingSlotMappingStrategy, BlueprintSlotStrategy and DirectSocketStrategy)
      expect(count).toBe(3);
    });
  });

  describe('addStrategy', () => {
    it('should add a new strategy', () => {
      const mockStrategy = {
        canResolve: jest.fn(),
        resolve: jest.fn(),
      };

      const initialCount = slotResolver.getStrategyCount();
      slotResolver.addStrategy(mockStrategy);

      expect(slotResolver.getStrategyCount()).toBe(initialCount + 1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Added new strategy: ${mockStrategy.constructor.name}`
      );
    });

    it('should validate strategy interface', () => {
      const invalidStrategy = {
        // Missing required methods
      };

      expect(() => slotResolver.addStrategy(invalidStrategy)).toThrow();
    });
  });
});
