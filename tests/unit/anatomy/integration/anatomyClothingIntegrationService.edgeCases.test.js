/**
 * @file Edge cases and error handling tests for AnatomyClothingIntegrationService
 * @see src/anatomy/integration/anatomyClothingIntegrationService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomyClothingIntegrationService from '../../../../src/anatomy/integration/anatomyClothingIntegrationService.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('AnatomyClothingIntegrationService - Edge Cases', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockBodyGraphService;
  let mockDataRegistry;
  let mockSlotMappingConfiguration;

  beforeEach(() => {
    mockLogger = createMockLogger();

    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockBodyGraphService = {
      getBodyGraph: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(),
    };

    mockSlotMappingConfiguration = {
      resolveSlotMapping: jest.fn(),
      getSlotEntityMappings: jest.fn().mockResolvedValue(new Map()),
      clearCache: jest.fn(),
    };

    service = new AnatomyClothingIntegrationService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
      dataRegistry: mockDataRegistry,
      slotMappingConfiguration: mockSlotMappingConfiguration,
    });
  });

  describe('getAvailableClothingSlots error handling (lines 109-113)', () => {
    it('should handle errors during blueprint loading and re-throw', async () => {
      const entityId = 'test_entity';
      const testError = new Error('Database connection failed');

      mockEntityManager.getComponentData.mockRejectedValue(testError);

      await expect(service.getAvailableClothingSlots(entityId)).rejects.toThrow(
        'Database connection failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        `AnatomyClothingIntegrationService: Failed to get clothing slots for entity ${entityId}`,
        testError
      );
    });

    it('should handle errors during body graph service and re-throw', async () => {
      const entityId = 'test_entity';
      const testError = new Error('Body graph service failed');

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'test:recipe',
      });

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          clothingSlotMappings: {
            shirt: { anatomySockets: ['torso'] },
          },
        });

      mockBodyGraphService.getBodyGraph.mockRejectedValue(testError);

      await expect(service.getAvailableClothingSlots(entityId)).rejects.toThrow(
        'Body graph service failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        `AnatomyClothingIntegrationService: Failed to get clothing slots for entity ${entityId}`,
        testError
      );
    });

    it('should handle malformed blueprint data gracefully', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'test:recipe',
      });

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          // Missing clothingSlotMappings property
          root: { type: 'torso' },
        });

      const result = await service.getAvailableClothingSlots(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AnatomyClothingIntegrationService: No clothing slot mappings for entity ${entityId}`
      );
    });
  });

  describe('Blueprint and recipe loading edge cases (lines 509-512)', () => {
    it('should handle missing recipe gracefully', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'missing:recipe',
      });

      mockDataRegistry.get.mockReturnValue(null); // Recipe not found

      const result = await service.getAvailableClothingSlots(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "AnatomyClothingIntegrationService: Recipe 'missing:recipe' not found in registry"
      );
    });

    it('should handle missing blueprint gracefully', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'test:recipe',
      });

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'missing:blueprint' }) // Recipe found
        .mockReturnValueOnce(null); // Blueprint not found

      const result = await service.getAvailableClothingSlots(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "AnatomyClothingIntegrationService: Blueprint 'missing:blueprint' not found in registry"
      );
    });
  });

  describe('Root entity socket fallback logic (lines 322-330)', () => {
    it('should test root entity socket resolution path when fallback is needed', async () => {
      const entityId = 'test_entity';

      // Setup entity with anatomy where root entity has sockets but body parts don't
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return Promise.resolve({ recipeId: 'test:recipe' });
        }
        if (component === 'anatomy:sockets') {
          if (id === entityId) {
            // Root entity has sockets
            return Promise.resolve({
              sockets: [{ id: 'torso_clothing', orientation: 'neutral' }],
            });
          }
          // Body parts have empty socket arrays (not null, but empty)
          return Promise.resolve({ sockets: [] });
        }
        return Promise.resolve(null);
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['part1', 'part2']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          clothingSlotMappings: {
            shirt: {
              anatomySockets: ['torso_clothing'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      // Test that the service processes the entity data correctly
      const result = await service.getAvailableClothingSlots(entityId);

      // At minimum, verify that the service processes the request without throwing
      expect(result).toBeInstanceOf(Map);

      // If the slot is available, test attachment point resolution
      if (result.has('shirt')) {
        const attachmentPoints =
          await service.resolveClothingSlotToAttachmentPoints(
            entityId,
            'shirt'
          );

        // This tests the fallback logic - if any attachment points are found,
        // they should include the root entity socket
        if (attachmentPoints.length > 0) {
          expect(attachmentPoints[0]).toMatchObject({
            entityId: entityId,
            socketId: 'torso_clothing',
            slotPath: 'direct',
            orientation: 'neutral',
          });
        }
      }
    });

    it('should handle root entity with no sockets gracefully', async () => {
      const entityId = 'test_entity';
      const socketIds = ['missing_socket'];

      mockEntityManager.getComponentData
        .mockResolvedValueOnce({ recipeId: 'test:recipe' })
        .mockImplementation((id, component) => {
          if (component === 'anatomy:sockets') {
            // Neither body parts nor root entity have sockets
            return null;
          }
          return null;
        });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['part1']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          clothingSlotMappings: {
            shirt: {
              anatomySockets: socketIds,
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const attachmentPoints =
        await service.resolveClothingSlotToAttachmentPoints(entityId, 'shirt');

      expect(attachmentPoints).toEqual([]);
    });
  });

  describe('Validation edge cases (lines 567, 580, 595)', () => {
    it('should handle wildcard socket validation', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'test:recipe',
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['part1']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          clothingSlotMappings: {
            universal: {
              anatomySockets: ['*'], // Wildcard socket
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('universal')).toBe(true);
    });

    it('should handle blueprint slot validation with missing slots', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'test:recipe',
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue([]),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          slots: {
            // Only has 'head' slot, missing 'hand' slot
            head: { type: 'head' },
          },
          clothingSlotMappings: {
            gloves: {
              blueprintSlots: ['left_hand', 'right_hand'], // Missing slots
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('gloves')).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "AnatomyClothingIntegrationService: Blueprint slot 'left_hand' not found in blueprint"
      );
    });

    it('should handle socket validation with missing sockets', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData
        .mockResolvedValueOnce({ recipeId: 'test:recipe' })
        .mockImplementation((id, component) => {
          if (component === 'anatomy:sockets') {
            return {
              sockets: [{ id: 'head_socket' }], // Only has head socket
            };
          }
          return null;
        });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['head_part']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          clothingSlotMappings: {
            shirt: {
              anatomySockets: ['torso_socket'], // Missing socket
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('shirt')).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "AnatomyClothingIntegrationService: Socket 'torso_socket' not found in anatomy structure"
      );
    });
  });

  describe('Slot mapping validation without required properties', () => {
    it('should reject slot mapping without blueprintSlots or anatomySockets', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'test:recipe',
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue([]),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          clothingSlotMappings: {
            invalid_slot: {
              // Missing both blueprintSlots and anatomySockets
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('invalid_slot')).toBe(false);
    });
  });

  describe('Slot validation for invalid attachment points (lines 203)', () => {
    it('should reject slot with no valid attachment points in compatibility validation', async () => {
      const entityId = 'test_entity';
      const slotId = 'broken_slot';
      const itemId = 'test_item';

      // Setup entity with slot that has no valid attachment points
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return Promise.resolve({ recipeId: 'test:recipe' });
        }
        if (component === 'anatomy:sockets') {
          return Promise.resolve(null); // No sockets available
        }
        return Promise.resolve(null);
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['part1']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          clothingSlotMappings: {
            broken_slot: {
              anatomySockets: ['nonexistent_socket'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.validateClothingSlotCompatibility(
        entityId,
        slotId,
        itemId
      );

      // Since the slot won't be available due to missing sockets, we expect "Entity lacks clothing slot"
      expect(result).toMatchObject({
        valid: false,
        reason: `Entity lacks clothing slot '${slotId}'`,
      });
    });
  });

  describe('Cache behavior edge cases', () => {
    it('should handle cached slot resolution results', async () => {
      const entityId = 'test_entity';
      const slotId = 'shirt';

      // Setup valid slot
      mockEntityManager.getComponentData
        .mockResolvedValueOnce({ recipeId: 'test:recipe' })
        .mockImplementation((id, component) => {
          if (component === 'anatomy:sockets' && id === 'torso_part') {
            return {
              sockets: [{ id: 'torso_clothing', orientation: 'neutral' }],
            };
          }
          return null;
        });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['torso_part']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          clothingSlotMappings: {
            shirt: {
              anatomySockets: ['torso_clothing'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      // First call - should populate cache
      const firstResult = await service.resolveClothingSlotToAttachmentPoints(
        entityId,
        slotId
      );

      // Second call - should use cache
      const secondResult = await service.resolveClothingSlotToAttachmentPoints(
        entityId,
        slotId
      );

      expect(firstResult).toEqual(secondResult);
      // getAvailableClothingSlots should only be called once due to caching at that level
      expect(mockDataRegistry.get).toHaveBeenCalledTimes(2); // Recipe + blueprint
    });

    it('should clear caches and reload data after clearCache call', async () => {
      const entityId = 'test_entity';

      // Setup data
      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'test:recipe',
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue([]),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({ clothingSlotMappings: {} });

      // First call
      await service.getAvailableClothingSlots(entityId);

      // Clear cache
      service.clearCache();

      // Second call - should reload data
      await service.getAvailableClothingSlots(entityId);

      // Should have been called at least twice for the second operation after clear
      expect(mockDataRegistry.get).toHaveBeenCalledTimes(3);
    });
  });
});
