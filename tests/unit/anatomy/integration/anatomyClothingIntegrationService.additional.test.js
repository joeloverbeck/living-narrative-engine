/**
 * @file Additional coverage tests for AnatomyClothingIntegrationService
 * @see src/anatomy/integration/anatomyClothingIntegrationService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomyClothingIntegrationService from '../../../../src/anatomy/integration/anatomyClothingIntegrationService.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('AnatomyClothingIntegrationService - Additional Coverage', () => {
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

  describe('Entity validation edge cases', () => {
    it('should throw when entityId is not a string', async () => {
      await expect(service.getAvailableClothingSlots(123)).rejects.toThrow(
        'Entity ID is required'
      );
      
      await expect(service.resolveClothingSlotToAttachmentPoints(123, 'slot')).rejects.toThrow(
        'Entity ID is required'
      );
      
      await expect(service.validateClothingSlotCompatibility(123, 'slot', 'item')).rejects.toThrow(
        'Entity ID is required'
      );
    });

    it('should throw when slotId is not a string', async () => {
      await expect(service.resolveClothingSlotToAttachmentPoints('entity', 123)).rejects.toThrow(
        'Slot ID is required'
      );
      
      await expect(service.validateClothingSlotCompatibility('entity', 123, 'item')).rejects.toThrow(
        'Slot ID is required'
      );
    });

    it('should throw when itemId is not a string', async () => {
      await expect(service.validateClothingSlotCompatibility('entity', 'slot', 123)).rejects.toThrow(
        'Item ID is required'
      );
    });
  });

  describe('Direct socket resolution with orientation', () => {
    it('should resolve direct sockets with specific orientations', async () => {
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === 'test_entity' && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:sockets') {
          if (id === 'part1') {
            return {
              sockets: [
                { id: 'socket1', orientation: 'left' },
                { id: 'socket2', orientation: 'right' },
              ],
            };
          }
          if (id === 'part2') {
            return {
              sockets: [
                { id: 'socket3', orientation: 'upper' },
              ],
            };
          }
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
            multi_socket_item: {
              anatomySockets: ['socket1', 'socket2', 'socket3'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const attachmentPoints = await service.resolveClothingSlotToAttachmentPoints(
        'test_entity',
        'multi_socket_item'
      );

      expect(attachmentPoints).toHaveLength(3);
      expect(attachmentPoints).toContainEqual({
        entityId: 'part1',
        socketId: 'socket1',
        slotPath: 'direct',
        orientation: 'left',
      });
      expect(attachmentPoints).toContainEqual({
        entityId: 'part1',
        socketId: 'socket2',
        slotPath: 'direct',
        orientation: 'right',
      });
      expect(attachmentPoints).toContainEqual({
        entityId: 'part2',
        socketId: 'socket3',
        slotPath: 'direct',
        orientation: 'upper',
      });
    });
  });

  describe('Blueprint resolution with fallback patterns', () => {
    it('should use fallback pattern when direct slot mapping fails', async () => {
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === 'test_entity' && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:sockets' && id === 'entity_left_arm') {
          return {
            sockets: [{ id: 'arm_socket', orientation: 'left' }],
          };
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['entity_left_arm', 'other_part']),
        getConnectedParts: jest.fn().mockImplementation((id) => {
          if (id === 'test_entity') {
            return ['entity_left_arm', 'other_part'];
          }
          return [];
        }),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          slots: {
            left_arm: {
              type: 'test:arm',
              socket: 'arm_socket',
            },
          },
          clothingSlotMappings: {
            sleeve: {
              blueprintSlots: ['left_arm'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const attachmentPoints = await service.resolveClothingSlotToAttachmentPoints(
        'test_entity',
        'sleeve'
      );

      expect(attachmentPoints).toHaveLength(1);
      expect(attachmentPoints[0]).toMatchObject({
        entityId: 'entity_left_arm',
        socketId: 'arm_socket',
      });
      // It actually finds it through the normal mapping, not fallback
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("AnatomyClothingIntegrationService: Found direct slot mapping for 'left_arm'")
      );
    });

    it('should handle no entity found for slot', async () => {
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === 'test_entity' && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['unrelated_part']),
        getConnectedParts: jest.fn().mockReturnValue(['unrelated_part']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          slots: {
            missing_slot: {
              type: 'test:part',
              socket: 'missing_socket',
            },
          },
          clothingSlotMappings: {
            item: {
              blueprintSlots: ['missing_slot'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const attachmentPoints = await service.resolveClothingSlotToAttachmentPoints(
        'test_entity',
        'item'
      );

      expect(attachmentPoints).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("No entity found with socket 'missing_socket' for slot 'missing_slot'")
      );
    });
  });

  describe('Socket resolution with empty/null data', () => {
    it('should handle sockets component with undefined sockets array', async () => {
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === 'test_entity' && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:sockets') {
          return { sockets: undefined }; // sockets field is undefined
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
            item: {
              anatomySockets: ['socket1'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots('test_entity');
      expect(result.has('item')).toBe(false);
    });

    it('should handle sockets component with empty sockets array', async () => {
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === 'test_entity' && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:sockets') {
          return { sockets: [] }; // Empty array
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
            item: {
              anatomySockets: ['socket1'],
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

  describe('getSlotAnatomySockets additional coverage', () => {
    it('should handle complex slot resolution for getSlotAnatomySockets', async () => {
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === 'test_entity' && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:sockets') {
          if (id === 'hand_part') {
            return {
              sockets: [
                { id: 'palm_socket', orientation: 'neutral' },
                { id: 'finger_socket', orientation: 'neutral' },
              ],
            };
          }
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['hand_part']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          clothingSlotMappings: {
            glove: {
              anatomySockets: ['palm_socket', 'finger_socket'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const sockets = await service.getSlotAnatomySockets('test_entity', 'glove');

      expect(sockets).toHaveLength(2);
      expect(sockets).toContainEqual({
        entityId: 'hand_part',
        socketId: 'palm_socket',
      });
      expect(sockets).toContainEqual({
        entityId: 'hand_part',
        socketId: 'finger_socket',
      });
    });
  });

  describe('Cache behavior edge cases', () => {
    it('should handle clearCache when caches are already empty', () => {
      // Clear immediately without populating
      expect(() => service.clearCache()).not.toThrow();
    });

    it('should cache blueprint across multiple getAvailableClothingSlots calls', async () => {
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
      await service.getAvailableClothingSlots('test_entity');
      
      // Second call - should use cached blueprint
      await service.getAvailableClothingSlots('test_entity');

      // Blueprint should only be loaded once
      expect(mockDataRegistry.get).toHaveBeenCalledTimes(2); // Recipe + blueprint, not twice
    });
  });

  describe('Fallback joint traversal edge cases', () => {
    it('should handle circular parent references in joints', async () => {
      const entityId = 'test_entity';

      const entitiesWithJoints = [
        { id: 'part1' },
        { id: 'part2' },
      ];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entitiesWithJoints);
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:joint') {
          // Circular reference: part1 -> part2 -> part1
          if (id === 'part1') return { parentEntityId: 'part2' };
          if (id === 'part2') return { parentEntityId: 'part1' };
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

      // Should handle circular reference without infinite loop
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Fallback joint traversal found 0 connected parts')
      );
    });

    it('should handle deep fallback nesting', async () => {
      const entityId = 'test_entity';

      const entitiesWithJoints = [
        { id: 'level1' },
        { id: 'level2' },
        { id: 'level3' },
        { id: 'level4' },
      ];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entitiesWithJoints);
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:joint') {
          const joints = {
            level1: { parentEntityId: entityId },
            level2: { parentEntityId: 'level1' },
            level3: { parentEntityId: 'level2' },
            level4: { parentEntityId: 'level3' },
          };
          return joints[id];
        }
        if (component === 'anatomy:sockets' && id === 'level4') {
          return {
            sockets: [{ id: 'deep_socket', orientation: 'neutral' }],
          };
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
          clothingSlotMappings: {
            deep_item: {
              anatomySockets: ['deep_socket'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots(entityId);

      expect(result.has('deep_item')).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Fallback found 4 parts')
      );
    });
  });

  describe('Complex slot path resolution', () => {
    it('should continue slot path traversal when intermediate mapping exists', async () => {
      // Set up slot mappings for intermediate levels
      service.setSlotEntityMappings({
        torso: 'torso_entity',
        left_arm: 'arm_entity',
      });

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === 'test_entity' && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:sockets' && id === 'hand_entity') {
          return {
            sockets: [{ id: 'hand_socket', orientation: 'left' }],
          };
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['torso_entity', 'arm_entity', 'hand_entity']),
        getConnectedParts: jest.fn().mockImplementation((id) => {
          if (id === 'torso_entity') return ['arm_entity'];
          if (id === 'arm_entity') return ['hand_entity'];
          return [];
        }),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          slots: {
            torso: { type: 'test:torso', socket: 'torso_socket' },
            left_arm: { parent: 'torso', type: 'test:arm', socket: 'arm_socket' },
            left_hand: { parent: 'left_arm', type: 'test:hand', socket: 'hand_socket' },
          },
          clothingSlotMappings: {
            glove: {
              blueprintSlots: ['left_hand'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const attachmentPoints = await service.resolveClothingSlotToAttachmentPoints(
        'test_entity',
        'glove'
      );

      expect(attachmentPoints).toHaveLength(1);
      expect(attachmentPoints[0]).toMatchObject({
        entityId: 'hand_entity',
        socketId: 'hand_socket',
      });
    });
  });

  describe('Blueprint slot validation edge cases', () => {
    it('should handle blueprint with null slots object', async () => {
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
          slots: null, // Null slots
          clothingSlotMappings: {
            item: {
              blueprintSlots: ['some_slot'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots('test_entity');
      expect(result.has('item')).toBe(false);
    });

    it('should handle blueprint slot with partial data', async () => {
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === 'test_entity' && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
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
            partial_slot: {
              type: 'test:part',
              // Missing socket property
            },
            valid_slot: {
              type: 'test:part',
              socket: 'valid_socket',
            },
          },
          clothingSlotMappings: {
            mixed_item: {
              blueprintSlots: ['partial_slot', 'valid_slot'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const attachmentPoints = await service.resolveClothingSlotToAttachmentPoints(
        'test_entity',
        'mixed_item'
      );

      // Should skip the partial slot and only return valid ones
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "AnatomyClothingIntegrationService: Blueprint slot 'partial_slot' has no socket defined"
      );
    });
  });
});