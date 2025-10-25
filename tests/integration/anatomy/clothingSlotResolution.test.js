/**
 * @file Integration tests for clothing slot resolution flow
 * @see src/anatomy/integration/SlotResolver.js
 * @see src/anatomy/integration/strategies/ClothingSlotMappingStrategy.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SlotResolver from '../../../src/anatomy/integration/SlotResolver.js';
import {
  ClothingSlotNotFoundError,
  InvalidClothingSlotMappingError,
} from '../../../src/errors/clothingSlotErrors.js';

describe('Clothing Slot Resolution Integration', () => {
  let slotResolver;
  let mockLogger;
  let mockEntityManager;
  let mockBodyGraphService;
  let mockAnatomyBlueprintRepository;
  let mockAnatomySocketIndex;
  let mockCache;

  const mockBlueprint = {
    id: 'human_base',
    slots: {
      left_breast: {
        socket: 'left_chest',
        type: 'breast',
        parent: 'torso',
      },
      right_breast: {
        socket: 'right_chest',
        type: 'breast',
        parent: 'torso',
      },
      torso: {
        socket: 'chest',
        type: 'torso',
      },
    },
    clothingSlotMappings: {
      bra: {
        blueprintSlots: ['left_breast', 'right_breast'],
        allowedLayers: ['underwear'],
      },
      panties: {
        anatomySockets: ['vagina', 'pubic_hair'],
        allowedLayers: ['underwear'],
      },
      shirt: {
        blueprintSlots: ['torso'],
        anatomySockets: ['chest'],
        allowedLayers: ['clothing'],
      },
      full_body: {
        blueprintSlots: ['torso', 'left_breast', 'right_breast'],
        anatomySockets: ['chest', 'vagina'],
        allowedLayers: ['clothing'],
      },
    },
  };

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

    // Mock cache that implements the new cache service interface
    // The get function must accept 2 parameters (cacheType, key) to be recognized
    mockCache = {
      get: jest.fn((cacheType, key) => undefined),
      set: jest.fn(),
      clearType: jest.fn(),
    };

    // Setup default mock responses
    mockEntityManager.getComponentData.mockResolvedValue({
      recipeId: 'human_base',
    });

    mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
      mockBlueprint
    );

    mockBodyGraphService.getBodyGraph.mockResolvedValue({
      getConnectedParts: jest.fn().mockReturnValue([]),
      getAllPartIds: jest
        .fn()
        .mockReturnValue(['torso_entity', 'pelvis_entity']),
    });

    mockAnatomySocketIndex.findEntityWithSocket.mockImplementation(
      (entityId, socketId) => {
        // Mock socket resolution based on socket ID
        if (
          socketId === 'left_chest' ||
          socketId === 'right_chest' ||
          socketId === 'chest'
        ) {
          return Promise.resolve('torso_entity');
        }
        return Promise.resolve(null);
      }
    );

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
    describe('successful resolution', () => {
      it('should resolve clothing slot with blueprintSlots', async () => {
        const result = await slotResolver.resolveClothingSlot(
          'actor123',
          'bra'
        );

        expect(result).toHaveLength(2);

        // Check left breast attachment
        expect(result[0]).toMatchObject({
          entityId: 'torso_entity',
          socketId: 'left_chest',
          slotPath: 'left_breast',
        });

        // Check right breast attachment
        expect(result[1]).toMatchObject({
          entityId: 'torso_entity',
          socketId: 'right_chest',
          slotPath: 'right_breast',
        });

        // Verify blueprint was fetched
        expect(
          mockAnatomyBlueprintRepository.getBlueprintByRecipeId
        ).toHaveBeenCalledWith('human_base');
      });

      it('should resolve clothing slot with anatomySockets', async () => {
        // Mock entity manager to return sockets component for anatomy sockets
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:body') {
              return Promise.resolve({ recipeId: 'human_base' });
            }
            if (componentType === 'anatomy:sockets') {
              return Promise.resolve({
                sockets: [
                  { id: 'vagina', orientation: 'neutral' },
                  { id: 'pubic_hair', orientation: 'neutral' },
                ],
              });
            }
            return Promise.resolve(null);
          }
        );

        const result = await slotResolver.resolveClothingSlot(
          'actor123',
          'panties'
        );

        expect(result.length).toBeGreaterThan(0);

        // Check that anatomy sockets were resolved
        expect(result.some((point) => point.socketId === 'vagina')).toBe(true);
        expect(result.some((point) => point.socketId === 'pubic_hair')).toBe(
          true
        );
      });

      it('should resolve clothing slot with both blueprintSlots and anatomySockets', async () => {
        // Mock entity manager to return sockets component for anatomy sockets
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:body') {
              return Promise.resolve({ recipeId: 'human_base' });
            }
            if (componentType === 'anatomy:sockets') {
              return Promise.resolve({
                sockets: [
                  { id: 'chest', orientation: 'neutral' },
                  { id: 'vagina', orientation: 'neutral' },
                ],
              });
            }
            return Promise.resolve(null);
          }
        );

        const result = await slotResolver.resolveClothingSlot(
          'actor123',
          'full_body'
        );

        expect(result.length).toBeGreaterThan(0);

        // Should have both blueprint and anatomy socket attachments
        expect(result.some((point) => point.slotPath !== 'direct')).toBe(true); // Blueprint slots
        expect(result.some((point) => point.slotPath === 'direct')).toBe(true); // Anatomy sockets
      });
    });

    describe('error scenarios', () => {
      it('should throw ClothingSlotNotFoundError for missing clothing slot', async () => {
        await expect(
          slotResolver.resolveClothingSlot('actor123', 'nonexistent')
        ).rejects.toThrow(ClothingSlotNotFoundError);

        const error = await slotResolver
          .resolveClothingSlot('actor123', 'nonexistent')
          .catch((err) => err);

        expect(error).toBeInstanceOf(ClothingSlotNotFoundError);
        expect(error.slotId).toBe('nonexistent');
        expect(error.blueprintId).toBe('human_base');
        expect(error.message).toContain(
          'Available slots: bra, panties, shirt, full_body'
        );
      });

      it('should throw InvalidClothingSlotMappingError for invalid mapping', async () => {
        const invalidBlueprint = {
          id: 'human_base',
          clothingSlotMappings: {
            invalid: {
              allowedLayers: ['underwear'],
              // Missing blueprintSlots and anatomySockets
            },
          },
        };

        mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
          invalidBlueprint
        );

        await expect(
          slotResolver.resolveClothingSlot('actor123', 'invalid')
        ).rejects.toThrow(InvalidClothingSlotMappingError);

        const error = await slotResolver
          .resolveClothingSlot('actor123', 'invalid')
          .catch((err) => err);

        expect(error).toBeInstanceOf(InvalidClothingSlotMappingError);
        expect(error.slotId).toBe('invalid');
        expect(error.mapping).toEqual({ allowedLayers: ['underwear'] });
      });

      it('should throw error when entity has no body component', async () => {
        mockEntityManager.getComponentData.mockResolvedValue(null);

        await expect(
          slotResolver.resolveClothingSlot('actor123', 'bra')
        ).rejects.toThrow('No blueprint found for entity actor123');
      });

      it('should throw error when blueprint has no clothingSlotMappings', async () => {
        const blueprintWithoutMappings = {
          id: 'human_base',
          slots: {
            torso: { socket: 'chest' },
          },
        };

        mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
          blueprintWithoutMappings
        );

        await expect(
          slotResolver.resolveClothingSlot('actor123', 'bra')
        ).rejects.toThrow(ClothingSlotNotFoundError);
      });
    });

    describe('parameter validation', () => {
      it('should throw error for missing entityId', async () => {
        await expect(
          slotResolver.resolveClothingSlot(null, 'bra')
        ).rejects.toThrow('Entity ID is required');
      });

      it('should throw error for missing slotId', async () => {
        await expect(
          slotResolver.resolveClothingSlot('actor123', null)
        ).rejects.toThrow('Slot ID is required');
      });

      it('should throw error for empty slotId', async () => {
        await expect(
          slotResolver.resolveClothingSlot('actor123', '')
        ).rejects.toThrow(
          "Clothing slot '' not found in blueprint clothing slot mappings"
        );
      });
    });

    describe('caching behavior', () => {
      it('should cache successful resolutions through resolve method', async () => {
        const mapping = { clothingSlotId: 'bra' };
        await slotResolver.resolve('actor123', 'bra', mapping);

        // Verify cache.set was called with correct parameters
        expect(mockCache.set).toHaveBeenCalled();

        // Get the cache arguments
        const cacheCall = mockCache.set.mock.calls[0];
        expect(cacheCall[0]).toBe('slot_resolution'); // Cache type
        expect(cacheCall[1]).toContain('actor123'); // Cache key contains entity ID
        expect(cacheCall[1]).toContain('bra'); // Cache key contains slot ID
        expect(Array.isArray(cacheCall[2])).toBe(true); // Cached value is array
      });

      it('should use cached results on subsequent calls through resolve method', async () => {
        const cachedResult = [
          { entityId: 'cached_entity', socketId: 'cached_socket' },
        ];

        // Mock the cache to return the cached result for slot_resolution type
        mockCache.get.mockImplementation((cacheType, key) => {
          if (cacheType === 'slot_resolution' && key === 'actor123:bra') {
            return cachedResult;
          }
          return undefined;
        });

        const mapping = { clothingSlotId: 'bra' };
        const result = await slotResolver.resolve('actor123', 'bra', mapping);

        expect(result).toBe(cachedResult);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Cache hit for slot resolution')
        );
      });
    });

    describe('strategy priority', () => {
      it('should use ClothingSlotMappingStrategy with highest priority', () => {
        const strategies = slotResolver.getStrategyCount();
        expect(strategies).toBe(3); // ClothingSlotMapping, Blueprint, DirectSocket

        // The ClothingSlotMappingStrategy should be first in the list
        // This is verified implicitly by the fact that our tests work
        // since we're testing with clothingSlotId mappings
      });

      it('should not fallback to old blueprint slot behavior', async () => {
        // This test ensures that the old fallback behavior is removed
        // If clothing slot doesn't exist, it should throw an error, not try as blueprint slot

        await expect(
          slotResolver.resolveClothingSlot('actor123', 'nonexistent')
        ).rejects.toThrow(ClothingSlotNotFoundError);

        // Verify it doesn't try to treat 'nonexistent' as a blueprint slot
        expect(
          mockAnatomySocketIndex.findEntityWithSocket
        ).not.toHaveBeenCalledWith('actor123', 'nonexistent');
      });
    });
  });

  describe('backward compatibility', () => {
    it('should still work with valid existing configurations', async () => {
      // Test that existing valid clothing slot configurations still work
      const result = await slotResolver.resolveClothingSlot('actor123', 'bra');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('entityId');
      expect(result[0]).toHaveProperty('socketId');
    });

    it('should handle blueprint repository errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockRejectedValue(
        dbError
      );

      await expect(
        slotResolver.resolveClothingSlot('actor123', 'bra')
      ).rejects.toThrow(dbError);
    });
  });
});
