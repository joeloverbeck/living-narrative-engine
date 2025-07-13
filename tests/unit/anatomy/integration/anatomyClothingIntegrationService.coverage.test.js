/**
 * @file Coverage-focused tests for AnatomyClothingIntegrationService
 * @see src/anatomy/integration/anatomyClothingIntegrationService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomyClothingIntegrationService from '../../../../src/anatomy/integration/anatomyClothingIntegrationService.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('AnatomyClothingIntegrationService - Coverage Tests', () => {
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

  describe('setSlotEntityMappings (lines 756-768)', () => {
    it('should accept Map input and store mappings', () => {
      const mappings = new Map([
        ['left_hand', 'left_hand_entity'],
        ['right_hand', 'right_hand_entity'],
        ['head', 'head_entity'],
      ]);

      service.setSlotEntityMappings(mappings);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyClothingIntegrationService: AnatomyClothingIntegrationService: Updated slot-entity mappings with 3 entries'
      );
    });

    it('should accept object input and convert to Map', () => {
      const mappings = {
        left_arm: 'left_arm_entity',
        right_arm: 'right_arm_entity',
        torso: 'torso_entity',
      };

      service.setSlotEntityMappings(mappings);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyClothingIntegrationService: AnatomyClothingIntegrationService: Updated slot-entity mappings with 3 entries'
      );
    });

    it('should handle null input gracefully', () => {
      service.setSlotEntityMappings(null);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyClothingIntegrationService: AnatomyClothingIntegrationService: Updated slot-entity mappings with 0 entries'
      );
    });

    it('should handle undefined input gracefully', () => {
      service.setSlotEntityMappings(undefined);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyClothingIntegrationService: AnatomyClothingIntegrationService: Updated slot-entity mappings with 0 entries'
      );
    });

    it('should handle empty object input', () => {
      service.setSlotEntityMappings({});

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyClothingIntegrationService: AnatomyClothingIntegrationService: Updated slot-entity mappings with 0 entries'
      );
    });

    it('should use slot mappings in resolution', async () => {
      // Setup slot mappings
      service.setSlotEntityMappings({
        left_hand: 'specific_left_hand_entity',
      });

      // Setup entity data
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === 'test_entity' && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:sockets' && id === 'specific_left_hand_entity') {
          return {
            sockets: [{ id: 'left_hand_socket', orientation: 'left' }],
          };
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['some_other_part', 'specific_left_hand_entity']),
        getConnectedParts: jest.fn().mockReturnValue([]),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          slots: {
            left_hand: {
              type: 'test:hand',
              socket: 'left_hand_socket',
            },
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

      // Should find the entity through slot mapping
      expect(attachmentPoints).toHaveLength(1);
      expect(attachmentPoints[0]).toMatchObject({
        entityId: 'specific_left_hand_entity',
        socketId: 'left_hand_socket',
        slotPath: 'left_hand',
        orientation: 'left',
      });
    });
  });

  describe('#findAnatomyPartsByJoints fallback method (lines 643-703)', () => {
    it('should handle when getEntitiesWithComponent returns undefined', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'test:recipe',
      });
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(undefined);

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue([]), // Empty to trigger fallback
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          clothingSlotMappings: {
            shirt: {
              anatomySockets: ['torso_socket'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyClothingIntegrationService: AnatomyClothingIntegrationService: No entities with joint components found'
      );
    });

    it('should handle when getEntitiesWithComponent returns empty array', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'test:recipe',
      });
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue([]), // Empty to trigger fallback
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          clothingSlotMappings: {
            shirt: {
              anatomySockets: ['torso_socket'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyClothingIntegrationService: AnatomyClothingIntegrationService: No entities with joint components found'
      );
    });

    it('should traverse joint hierarchy correctly in fallback', async () => {
      const entityId = 'test_entity';

      // Mock entities with joints
      const entitiesWithJoints = [
        { id: 'torso_part' },
        { id: 'left_arm_part' },
        { id: 'left_hand_part' },
        { id: 'right_arm_part' },
      ];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entitiesWithJoints);
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:joint') {
          const joints = {
            torso_part: { parentEntityId: entityId },
            left_arm_part: { parentId: 'torso_part' }, // Using parentId instead
            left_hand_part: { parentEntityId: 'left_arm_part' },
            right_arm_part: { parentEntityId: 'torso_part' },
          };
          return joints[id];
        }
        if (component === 'anatomy:sockets') {
          if (id === 'torso_part') {
            return {
              sockets: [{ id: 'torso_socket', orientation: 'neutral' }],
            };
          }
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
            shirt: {
              anatomySockets: ['torso_socket'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('shirt')).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Body graph for \'test_entity\' returned only 0 parts')
      );
      // Check that it found the expected parts through fallback
      const foundPartLogs = mockLogger.debug.mock.calls.filter(call => 
        call[0].includes('Found connected part')
      );
      expect(foundPartLogs.length).toBeGreaterThanOrEqual(3); // Found at least 3 connected parts
    });

    it('should handle error in fallback joint traversal', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        return null;
      });
      
      // Make getEntitiesWithComponent throw an error
      mockEntityManager.getEntitiesWithComponent.mockImplementation(() => {
        throw new Error('Database error');
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue([]), // Empty to trigger fallback
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          clothingSlotMappings: {
            shirt: {
              anatomySockets: ['torso_socket'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('AnatomyClothingIntegrationService: Failed to find anatomy parts by joints for'),
        expect.any(Error)
      );
    });

    it('should handle joint with missing parentEntityId and parentId', async () => {
      const entityId = 'test_entity';

      const entitiesWithJoints = [
        { id: 'orphan_part' },
      ];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entitiesWithJoints);
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:joint' && id === 'orphan_part') {
          return {}; // Joint with no parent fields
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
          clothingSlotMappings: {},
        });

      await service.getAvailableClothingSlots(entityId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyClothingIntegrationService: AnatomyClothingIntegrationService: Fallback joint traversal found 0 connected parts'
      );
    });
  });

  describe('#getParentConnectionInfo and #matchesSlot (lines 473-506)', () => {
    it('should handle missing joint component in getParentConnectionInfo path', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:joint') {
          return null; // No joint component
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['part_without_joint']),
        getConnectedParts: jest.fn().mockReturnValue([]),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          slots: {
            test_slot: {
              type: 'test:part',
              socket: 'test_socket',
            },
          },
          clothingSlotMappings: {
            test_item: {
              blueprintSlots: ['test_slot'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const attachmentPoints = await service.resolveClothingSlotToAttachmentPoints(
        entityId,
        'test_item'
      );

      // The method should handle the missing joint gracefully
      expect(attachmentPoints).toEqual([]);
    });
  });

  describe('#findEntityWithSocket edge cases (lines 439-464)', () => {
    it('should handle sockets component with null sockets array', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:sockets') {
          return { sockets: null }; // Sockets component exists but sockets is null
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
              anatomySockets: ['missing_socket'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0); // No slots available due to missing socket
    });

    it('should find socket in different array positions', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:sockets' && id === 'part_with_sockets') {
          return {
            sockets: [
              { id: 'socket1', orientation: 'left' },
              { id: 'socket2', orientation: 'right' },
              { id: 'target_socket', orientation: 'neutral' }, // Target in middle
              { id: 'socket3', orientation: 'upper' },
            ],
          };
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['part_with_sockets']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          clothingSlotMappings: {
            item: {
              anatomySockets: ['target_socket'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('item')).toBe(true);
    });

    it('should check root entity last for sockets', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:sockets') {
          if (id === entityId) {
            // Root has the socket
            return {
              sockets: [{ id: 'root_socket', orientation: 'neutral' }],
            };
          }
          // Parts don't have it
          return { sockets: [] };
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
          slots: {
            root_slot: {
              type: 'test:root',
              socket: 'root_socket',
            },
          },
          clothingSlotMappings: {
            root_item: {
              blueprintSlots: ['root_slot'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const attachmentPoints = await service.resolveClothingSlotToAttachmentPoints(
        entityId,
        'root_item'
      );

      expect(attachmentPoints).toHaveLength(1);
      expect(attachmentPoints[0]).toMatchObject({
        entityId: entityId,
        socketId: 'root_socket',
      });
    });
  });

  describe('Blueprint slot resolution edge cases', () => {
    it('should handle blueprint slot with missing socket definition', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
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
            broken_slot: {
              type: 'test:part',
              // Missing socket property
            },
          },
          clothingSlotMappings: {
            item: {
              blueprintSlots: ['broken_slot'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const attachmentPoints = await service.resolveClothingSlotToAttachmentPoints(
        entityId,
        'item'
      );

      expect(attachmentPoints).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "AnatomyClothingIntegrationService: Blueprint slot 'broken_slot' has no socket defined"
      );
    });

    it('should handle deep nested slot path with missing intermediate entity', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:sockets' && id === 'deep_part') {
          return {
            sockets: [{ id: 'deep_socket', orientation: 'neutral' }],
          };
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['arm_part', 'deep_part']),
        getConnectedParts: jest.fn().mockImplementation((id) => {
          if (id === entityId) {
            return ['arm_part']; // Missing intermediate 'hand_part'
          }
          return [];
        }),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:blueprint' })
        .mockReturnValueOnce({
          slots: {
            arm: { type: 'test:arm', socket: 'arm_socket' },
            hand: { parent: 'arm', type: 'test:hand', socket: 'hand_socket' },
            finger: { parent: 'hand', type: 'test:finger', socket: 'deep_socket' },
          },
          clothingSlotMappings: {
            ring: {
              blueprintSlots: ['finger'],
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const attachmentPoints = await service.resolveClothingSlotToAttachmentPoints(
        entityId,
        'ring'
      );

      // The deep_part actually has the socket, so it finds it
      expect(attachmentPoints).toHaveLength(1);
      expect(attachmentPoints[0]).toMatchObject({
        entityId: 'deep_part',
        socketId: 'deep_socket',
      });
    });
  });

  describe('Validation with complex scenarios', () => {
    it('should validate slot mapping with all sockets missing', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:recipe' };
        }
        if (component === 'anatomy:sockets') {
          return { sockets: [{ id: 'existing_socket' }] };
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
            impossible_item: {
              anatomySockets: ['socket1', 'socket2', 'socket3'], // None exist
              allowedLayers: ['base'],
              layerOrder: ['base'],
              defaultLayer: 'base',
            },
          },
        });

      const result = await service.getAvailableClothingSlots(entityId);

      expect(result.has('impossible_item')).toBe(false);
      // Check for debug logs about missing sockets
      const debugCalls = mockLogger.debug.mock.calls.filter(call => 
        call[0].includes('Socket \'socket') && call[0].includes('not found in anatomy structure')
      );
      expect(debugCalls.length).toBe(3); // One for each missing socket
    });

    it('should handle validateClothingSlotCompatibility with attachment points returning empty due to missing entities', async () => {
      const entityId = 'test_entity';
      const slotId = 'valid_slot';
      const itemId = 'test_item';

      // Mock slot exists but no valid attachment points
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
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
            test_slot: {
              type: 'test:part',
              socket: 'test_socket',
            },
          },
          clothingSlotMappings: {
            valid_slot: {
              blueprintSlots: ['test_slot'],
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

      expect(result).toMatchObject({
        valid: false,
        reason: "Clothing slot 'valid_slot' has no valid attachment points",
      });
    });
  });

  describe('Cache behavior with multiple operations', () => {
    it('should handle concurrent cache operations correctly', async () => {
      const entityId1 = 'entity1';
      const entityId2 = 'entity2';

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (component === 'anatomy:body') {
          if (id === entityId1) return { recipeId: 'recipe1' };
          if (id === entityId2) return { recipeId: 'recipe2' };
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue([]),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'anatomyRecipes') {
          if (id === 'recipe1') return { blueprintId: 'blueprint1' };
          if (id === 'recipe2') return { blueprintId: 'blueprint2' };
        }
        if (category === 'anatomyBlueprints') {
          return {
            clothingSlotMappings: {
              shirt: {
                anatomySockets: ['torso'],
                allowedLayers: ['base'],
                layerOrder: ['base'],
                defaultLayer: 'base',
              },
            },
          };
        }
        return null;
      });

      // Load data for multiple entities
      await Promise.all([
        service.getAvailableClothingSlots(entityId1),
        service.getAvailableClothingSlots(entityId2),
      ]);

      // Should have cached both blueprints
      const calls = mockDataRegistry.get.mock.calls;
      const blueprintCalls = calls.filter(([cat]) => cat === 'anatomyBlueprints');
      expect(blueprintCalls.length).toBe(2); // One for each unique blueprint
    });
  });

  describe('Error propagation in complex scenarios', () => {
    it('should propagate errors from body graph service through slot resolution', async () => {
      const entityId = 'test_entity';
      const testError = new Error('Body graph database error');

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'test:recipe',
      });

      // First call succeeds for available slots, second call fails during resolution
      let callCount = 0;
      mockBodyGraphService.getBodyGraph.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            getAllPartIds: jest.fn().mockReturnValue(['part1']),
          });
        }
        return Promise.reject(testError);
      });

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

      // This should succeed
      await service.getAvailableClothingSlots(entityId);

      // This should fail
      await expect(
        service.resolveClothingSlotToAttachmentPoints(entityId, 'item')
      ).rejects.toThrow('Body graph database error');
    });
  });
});