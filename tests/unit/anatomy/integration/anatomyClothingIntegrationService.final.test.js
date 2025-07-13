/**
 * @file Final coverage tests for AnatomyClothingIntegrationService
 * @see src/anatomy/integration/anatomyClothingIntegrationService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomyClothingIntegrationService from '../../../../src/anatomy/integration/anatomyClothingIntegrationService.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('AnatomyClothingIntegrationService - Final Coverage', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockBodyGraphService;
  let mockDataRegistry;

  beforeEach(() => {
    mockLogger = createMockLogger();

    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      getEntitiesWithComponent: jest.fn(),
    };

    mockBodyGraphService = {
      getBodyGraph: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(),
    };

    service = new AnatomyClothingIntegrationService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
      dataRegistry: mockDataRegistry,
    });
  });

  describe('Entity manager required methods validation', () => {
    it('should validate entityManager has required methods', () => {
      expect(() => {
        new AnatomyClothingIntegrationService({
          logger: mockLogger,
          entityManager: {
            getComponentData: jest.fn(),
            // Missing hasComponent
          },
          bodyGraphService: mockBodyGraphService,
          dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });
  });

  describe('Blueprint edge cases', () => {
    it('should handle body component without recipeId', async () => {
      mockEntityManager.getComponentData.mockResolvedValue({
        // Missing recipeId
      });

      const result = await service.getAvailableClothingSlots('test_entity');
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should handle blueprint without slots at all', async () => {
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
          // No slots property at all
          clothingSlotMappings: {
            item: {
              blueprintSlots: ['slot1'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots('test_entity');
      expect(result.has('item')).toBe(false);
    });
  });

  describe('Socket orientation extraction', () => {
    it('should extract all orientation types correctly', async () => {
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === 'test_entity' && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:sockets') {
          return {
            sockets: [
              { id: 'test_socket', orientation: null }, // Will default to what's in slot name
            ],
          };
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
          slots: {
            left_slot: { socket: 'test_socket' },
            right_slot: { socket: 'test_socket' },
            upper_slot: { socket: 'test_socket' },
            lower_slot: { socket: 'test_socket' },
            neutral_slot: { socket: 'test_socket' },
          },
          clothingSlotMappings: {
            left_item: {
              blueprintSlots: ['left_slot'],
              allowedLayers: ['base'],
            },
            right_item: {
              blueprintSlots: ['right_slot'],
              allowedLayers: ['base'],
            },
            upper_item: {
              blueprintSlots: ['upper_slot'],
              allowedLayers: ['base'],
            },
            lower_item: {
              blueprintSlots: ['lower_slot'],
              allowedLayers: ['base'],
            },
            neutral_item: {
              blueprintSlots: ['neutral_slot'],
              allowedLayers: ['base'],
            },
          },
        });

      // Test each orientation
      const leftPoints = await service.resolveClothingSlotToAttachmentPoints(
        'test_entity',
        'left_item'
      );
      expect(leftPoints[0]?.orientation).toBe('left');

      const rightPoints = await service.resolveClothingSlotToAttachmentPoints(
        'test_entity',
        'right_item'
      );
      expect(rightPoints[0]?.orientation).toBe('right');

      const upperPoints = await service.resolveClothingSlotToAttachmentPoints(
        'test_entity',
        'upper_item'
      );
      expect(upperPoints[0]?.orientation).toBe('upper');

      const lowerPoints = await service.resolveClothingSlotToAttachmentPoints(
        'test_entity',
        'lower_item'
      );
      expect(lowerPoints[0]?.orientation).toBe('lower');

      const neutralPoints = await service.resolveClothingSlotToAttachmentPoints(
        'test_entity',
        'neutral_item'
      );
      expect(neutralPoints[0]?.orientation).toBe('neutral');
    });
  });

  describe('Socket search with root entity priority', () => {
    it('should find socket on root entity when no parts have it', async () => {
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === 'test_entity' && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:sockets') {
          if (id === 'test_entity') {
            // Only root has the socket
            return {
              sockets: [{ id: 'root_only_socket', orientation: 'neutral' }],
            };
          }
          // Parts have different sockets
          return {
            sockets: [{ id: 'part_socket', orientation: 'neutral' }],
          };
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['part1', 'part2']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          clothingSlotMappings: {
            root_item: {
              anatomySockets: ['root_only_socket'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots('test_entity');
      expect(result.has('root_item')).toBe(true);

      const attachmentPoints =
        await service.resolveClothingSlotToAttachmentPoints(
          'test_entity',
          'root_item'
        );

      expect(attachmentPoints).toHaveLength(1);
      expect(attachmentPoints[0].entityId).toBe('test_entity');
    });
  });

  describe('Fallback joint traversal with getComponentData sync', () => {
    it('should handle getComponentData returning joint synchronously', async () => {
      const entityId = 'test_entity';

      const entitiesWithJoints = [{ id: 'sync_part' }];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(
        entitiesWithJoints
      );

      // Return joint data synchronously (not wrapped in Promise)
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:joint' && id === 'sync_part') {
          return { parentEntityId: entityId };
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue([]), // Empty to trigger fallback
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          clothingSlotMappings: {},
        });

      await service.getAvailableClothingSlots(entityId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found connected part')
      );
    });
  });

  describe('Complex multi-level slot resolution', () => {
    it('should resolve deep multi-level slots with slot mappings', async () => {
      // Set deep slot mappings
      service.setSlotEntityMappings({
        level1: 'entity_level1',
        level2: 'entity_level2',
        level3: 'entity_level3',
      });

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === 'test_entity' && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:sockets' && id === 'entity_level3') {
          return {
            sockets: [{ id: 'deep_socket', orientation: 'neutral' }],
          };
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest
          .fn()
          .mockReturnValue(['entity_level1', 'entity_level2', 'entity_level3']),
        getConnectedParts: jest.fn().mockImplementation((id) => {
          if (id === 'test_entity') return ['entity_level1'];
          if (id === 'entity_level1') return ['entity_level2'];
          if (id === 'entity_level2') return ['entity_level3'];
          return [];
        }),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          slots: {
            level1: { type: 'test:l1', socket: 's1' },
            level2: { parent: 'level1', type: 'test:l2', socket: 's2' },
            level3: {
              parent: 'level2',
              type: 'test:l3',
              socket: 'deep_socket',
            },
          },
          clothingSlotMappings: {
            deep_item: {
              blueprintSlots: ['level3'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const attachmentPoints =
        await service.resolveClothingSlotToAttachmentPoints(
          'test_entity',
          'deep_item'
        );

      expect(attachmentPoints).toHaveLength(1);
      expect(attachmentPoints[0]).toMatchObject({
        entityId: 'entity_level3',
        socketId: 'deep_socket',
      });

      // Should use slot mappings
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found direct slot mapping')
      );
    });
  });

  describe('Blueprint slot without type', () => {
    it('should handle blueprint slot missing type property', async () => {
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === 'test_entity' && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue([]),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          slots: {
            typeless_slot: {
              // Missing type
              socket: 'some_socket',
            },
          },
          clothingSlotMappings: {
            item: {
              blueprintSlots: ['typeless_slot'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const attachmentPoints =
        await service.resolveClothingSlotToAttachmentPoints(
          'test_entity',
          'item'
        );

      // Should still try to find the socket
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "No entity found with socket 'some_socket' for slot 'typeless_slot'"
        )
      );
    });
  });

  describe('Slot mapping with type validation', () => {
    it('should handle mixed valid and invalid mappings', async () => {
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === 'test_entity' && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:sockets' && id === 'part1') {
          return {
            sockets: [{ id: 'valid_socket', orientation: 'neutral' }],
          };
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
          slots: {
            valid_slot: { type: 'test:part', socket: 'valid_socket' },
            invalid_slot: { type: 'test:part', socket: 'missing_socket' },
          },
          clothingSlotMappings: {
            // Mix of valid blueprint slots and invalid anatomy sockets
            mixed_item1: {
              blueprintSlots: ['valid_slot'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
            mixed_item2: {
              anatomySockets: ['missing_socket'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots('test_entity');

      expect(result.has('mixed_item1')).toBe(true); // Valid slot exists
      expect(result.has('mixed_item2')).toBe(false); // Socket doesn't exist
    });
  });

  describe('Cache clearing with active operations', () => {
    it('should properly clear all caches including slot mappings', async () => {
      // First populate all caches
      service.setSlotEntityMappings({ slot1: 'entity1' });

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

      await service.getAvailableClothingSlots('test_entity');

      // Clear all caches
      service.clearCache();

      // Verify mappings were cleared
      service.setSlotEntityMappings({ slot2: 'entity2' });
      expect(mockLogger.debug).toHaveBeenLastCalledWith(
        'AnatomyClothingIntegrationService: AnatomyClothingIntegrationService: Updated slot-entity mappings with 1 entries'
      );
    });
  });
});
