/**
 * @file Private method coverage tests for AnatomyClothingIntegrationService
 * Tests complex private method logic through public API interactions
 * @see src/anatomy/integration/anatomyClothingIntegrationService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomyClothingIntegrationService from '../../../../src/anatomy/integration/anatomyClothingIntegrationService.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('AnatomyClothingIntegrationService - Private Methods Coverage', () => {
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

  describe('#findEntityAtSlotPath complex scenarios (lines 413-455)', () => {
    beforeEach(() => {
      // Setup test data with complex hierarchy
      const testRecipe = {
        id: 'test:humanoid_recipe',
        blueprintId: 'test:humanoid_blueprint',
      };

      const testBlueprint = {
        id: 'test:humanoid_blueprint',
        slots: {
          // Single-level slots
          head: {
            type: 'test:head',
            socket: 'head_socket',
          },
          left_arm: {
            type: 'test:arm',
            socket: 'left_arm_socket',
          },
          right_arm: {
            type: 'test:arm',
            socket: 'right_arm_socket',
          },
          // Multi-level slots
          left_hand: {
            parent: 'left_arm',
            type: 'test:hand',
            socket: 'left_hand_socket',
          },
          right_hand: {
            parent: 'right_arm',
            type: 'test:hand',
            socket: 'right_hand_socket',
          },
          left_finger: {
            parent: 'left_hand',
            type: 'test:finger',
            socket: 'left_finger_socket',
          },
        },
        clothingSlotMappings: {
          // Test single-level resolution
          helmet: {
            blueprintSlots: ['head'],
            allowedLayers: ['base'],
            layerOrder: ['base'],
            defaultLayer: 'base',
          },
          // Test multi-level resolution
          gloves: {
            blueprintSlots: ['left_hand', 'right_hand'],
            allowedLayers: ['base'],
            layerOrder: ['base'],
            defaultLayer: 'base',
          },
          // Test deep nesting
          rings: {
            blueprintSlots: ['left_finger'],
            allowedLayers: ['base'],
            layerOrder: ['base'],
            defaultLayer: 'base',
          },
        },
      };

      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'anatomyRecipes' && id === 'test:humanoid_recipe') {
          return testRecipe;
        }
        if (
          category === 'anatomyBlueprints' &&
          id === 'test:humanoid_blueprint'
        ) {
          return testBlueprint;
        }
        return null;
      });
    });

    it('should resolve single-level slot paths correctly', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:humanoid_recipe' };
        }
        if (component === 'anatomy:joint') {
          if (id === 'head_part') {
            return {
              parentEntityId: entityId,
              parentSocketId: 'head_socket',
              childSocketId: 'neck',
            };
          }
        }
        if (component === 'anatomy:sockets') {
          if (id === 'head_part') {
            return {
              sockets: [{ id: 'head_socket', orientation: 'neutral' }],
            };
          }
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest
          .fn()
          .mockReturnValue(['head_part', 'left_arm_part', 'right_arm_part']),
        getConnectedParts: jest.fn().mockImplementation((id) => {
          if (id === entityId) {
            return ['head_part', 'left_arm_part', 'right_arm_part'];
          }
          return [];
        }),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      const attachmentPoints =
        await service.resolveClothingSlotToAttachmentPoints(entityId, 'helmet');

      expect(attachmentPoints).toHaveLength(1);
      expect(attachmentPoints[0]).toMatchObject({
        entityId: 'head_part',
        socketId: 'head_socket',
        slotPath: 'head',
        orientation: 'neutral',
      });
    });

    it('should resolve multi-level slot paths correctly', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:humanoid_recipe' };
        }
        if (component === 'anatomy:joint') {
          if (id === 'left_hand_part') {
            return {
              parentEntityId: 'left_arm_part',
              parentSocketId: 'hand_socket',
              childSocketId: 'wrist',
            };
          }
          if (id === 'right_hand_part') {
            return {
              parentEntityId: 'right_arm_part',
              parentSocketId: 'hand_socket',
              childSocketId: 'wrist',
            };
          }
        }
        if (component === 'anatomy:sockets') {
          if (id === 'left_hand_part') {
            return {
              sockets: [{ id: 'left_hand_socket', orientation: 'left' }],
            };
          }
          if (id === 'right_hand_part') {
            return {
              sockets: [{ id: 'right_hand_socket', orientation: 'right' }],
            };
          }
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest
          .fn()
          .mockReturnValue([
            'left_arm_part',
            'right_arm_part',
            'left_hand_part',
            'right_hand_part',
          ]),
        getConnectedParts: jest.fn().mockImplementation((id) => {
          if (id === entityId) {
            return ['left_arm_part', 'right_arm_part'];
          }
          if (id === 'left_arm_part') {
            return ['left_hand_part'];
          }
          if (id === 'right_arm_part') {
            return ['right_hand_part'];
          }
          return [];
        }),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      const attachmentPoints =
        await service.resolveClothingSlotToAttachmentPoints(entityId, 'gloves');

      expect(attachmentPoints).toHaveLength(2);

      const leftAttachment = attachmentPoints.find(
        (p) => p.entityId === 'left_hand_part'
      );
      const rightAttachment = attachmentPoints.find(
        (p) => p.entityId === 'right_hand_part'
      );

      expect(leftAttachment).toMatchObject({
        entityId: 'left_hand_part',
        socketId: 'left_hand_socket',
        slotPath: 'left_hand',
        orientation: 'left',
      });

      expect(rightAttachment).toMatchObject({
        entityId: 'right_hand_part',
        socketId: 'right_hand_socket',
        slotPath: 'right_hand',
        orientation: 'right',
      });
    });

    it('should handle deep nested slot paths', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:humanoid_recipe' };
        }
        if (component === 'anatomy:joint') {
          if (id === 'left_finger_part') {
            return {
              parentEntityId: 'left_hand_part',
              parentSocketId: 'finger_socket',
              childSocketId: 'knuckle',
            };
          }
        }
        if (component === 'anatomy:sockets') {
          if (id === 'left_finger_part') {
            return {
              sockets: [{ id: 'left_finger_socket', orientation: 'left' }],
            };
          }
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest
          .fn()
          .mockReturnValue([
            'left_arm_part',
            'left_hand_part',
            'left_finger_part',
          ]),
        getConnectedParts: jest.fn().mockImplementation((id) => {
          if (id === entityId) {
            return ['left_arm_part'];
          }
          if (id === 'left_arm_part') {
            return ['left_hand_part'];
          }
          if (id === 'left_hand_part') {
            return ['left_finger_part'];
          }
          return [];
        }),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      const attachmentPoints =
        await service.resolveClothingSlotToAttachmentPoints(entityId, 'rings');

      expect(attachmentPoints).toHaveLength(1);
      expect(attachmentPoints[0]).toMatchObject({
        entityId: 'left_finger_part',
        socketId: 'left_finger_socket',
        slotPath: 'left_finger',
        orientation: 'left',
      });
    });

    it('should handle empty slot paths (root entity)', async () => {
      const entityId = 'test_entity';

      // Create blueprint with empty path slot
      const emptyPathBlueprint = {
        slots: {},
        clothingSlotMappings: {
          root_attachment: {
            blueprintSlots: [], // Empty path leads to root
            allowedLayers: ['base'],
            layerOrder: ['base'],
            defaultLayer: 'base',
          },
        },
      };

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:empty' })
        .mockReturnValueOnce(emptyPathBlueprint);

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'test:empty_recipe',
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue([]),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      const result = await service.getAvailableClothingSlots(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('root_attachment')).toBe(true);
    });

    it('should handle slot path not found scenarios', async () => {
      const entityId = 'test_entity';

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:humanoid_recipe' };
        }
        return null;
      });

      // Body graph with no matching parts
      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['unrelated_part']),
        getConnectedParts: jest.fn().mockImplementation((id) => {
          if (id === entityId) {
            return ['unrelated_part']; // No left/right parts
          }
          return [];
        }),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      const attachmentPoints =
        await service.resolveClothingSlotToAttachmentPoints(entityId, 'gloves');

      expect(attachmentPoints).toEqual([]);
    });
  });

  describe('#buildSlotPath logic through blueprint slots', () => {
    it('should build correct slot paths for nested slots', async () => {
      const entityId = 'test_entity';

      // Blueprint with complex nesting
      const nestedBlueprint = {
        slots: {
          torso: {
            type: 'test:torso',
            socket: 'torso_socket',
          },
          left_arm: {
            parent: 'torso',
            type: 'test:arm',
            socket: 'left_arm_socket',
          },
          left_shoulder: {
            parent: 'left_arm',
            type: 'test:shoulder',
            socket: 'left_shoulder_socket',
          },
          left_shoulder_pad: {
            parent: 'left_shoulder',
            type: 'test:pad',
            socket: 'left_shoulder_pad_socket',
          },
        },
        clothingSlotMappings: {
          shoulder_armor: {
            blueprintSlots: ['left_shoulder_pad'],
            allowedLayers: ['base'],
            layerOrder: ['base'],
            defaultLayer: 'base',
          },
        },
      };

      mockDataRegistry.get
        .mockReturnValueOnce({ blueprintId: 'test:nested' })
        .mockReturnValueOnce(nestedBlueprint);

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:nested_recipe' };
        }
        if (component === 'anatomy:joint') {
          if (id === 'torso_part') {
            return {
              parentEntityId: entityId,
              parentSocketId: 'torso_socket',
              childSocketId: 'spine',
            };
          }
          if (id === 'left_arm_part') {
            return {
              parentEntityId: 'torso_part',
              parentSocketId: 'arm_socket',
              childSocketId: 'shoulder',
            };
          }
          if (id === 'left_shoulder_part') {
            return {
              parentEntityId: 'left_arm_part',
              parentSocketId: 'shoulder_socket',
              childSocketId: 'joint',
            };
          }
          if (id === 'left_shoulder_pad_part') {
            return {
              parentEntityId: 'left_shoulder_part',
              parentSocketId: 'pad_socket',
              childSocketId: 'attachment',
            };
          }
        }
        if (component === 'anatomy:sockets') {
          if (id === 'left_shoulder_pad_part') {
            return {
              sockets: [
                { id: 'left_shoulder_pad_socket', orientation: 'left' },
              ],
            };
          }
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest
          .fn()
          .mockReturnValue([
            'torso_part',
            'left_arm_part',
            'left_shoulder_part',
            'left_shoulder_pad_part',
          ]),
        getConnectedParts: jest.fn().mockImplementation((id) => {
          if (id === entityId) {
            return ['torso_part'];
          }
          if (id === 'torso_part') {
            return ['left_arm_part'];
          }
          if (id === 'left_arm_part') {
            return ['left_shoulder_part'];
          }
          if (id === 'left_shoulder_part') {
            return ['left_shoulder_pad_part'];
          }
          return [];
        }),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      const attachmentPoints =
        await service.resolveClothingSlotToAttachmentPoints(
          entityId,
          'shoulder_armor'
        );

      expect(attachmentPoints).toHaveLength(1);
      expect(attachmentPoints[0]).toMatchObject({
        entityId: 'left_shoulder_pad_part',
        socketId: 'left_shoulder_pad_socket',
        slotPath: 'left_shoulder_pad',
        orientation: 'left',
      });
    });
  });

  describe('#extractOrientation logic (lines 467-469)', () => {
    it('should extract correct orientations from slot IDs', async () => {
      const entityId = 'test_entity';

      const orientationBlueprint = {
        slots: {
          left_arm: { type: 'test:arm', socket: 'left_arm_socket' },
          right_arm: { type: 'test:arm', socket: 'right_arm_socket' },
          upper_torso: { type: 'test:torso', socket: 'upper_torso_socket' },
          lower_torso: { type: 'test:torso', socket: 'lower_torso_socket' },
          center_head: { type: 'test:head', socket: 'center_head_socket' },
        },
        clothingSlotMappings: {
          left_glove: {
            blueprintSlots: ['left_arm'],
            allowedLayers: ['base'],
            layerOrder: ['base'],
            defaultLayer: 'base',
          },
          right_glove: {
            blueprintSlots: ['right_arm'],
            allowedLayers: ['base'],
            layerOrder: ['base'],
            defaultLayer: 'base',
          },
          upper_shirt: {
            blueprintSlots: ['upper_torso'],
            allowedLayers: ['base'],
            layerOrder: ['base'],
            defaultLayer: 'base',
          },
          lower_pants: {
            blueprintSlots: ['lower_torso'],
            allowedLayers: ['base'],
            layerOrder: ['base'],
            defaultLayer: 'base',
          },
          helmet: {
            blueprintSlots: ['center_head'],
            allowedLayers: ['base'],
            layerOrder: ['base'],
            defaultLayer: 'base',
          },
        },
      };

      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'anatomyRecipes' && id === 'test:orientation_recipe') {
          return { blueprintId: 'test:orientation' };
        }
        if (category === 'anatomyBlueprints' && id === 'test:orientation') {
          return orientationBlueprint;
        }
        return null;
      });

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (id === entityId && component === 'anatomy:body') {
          return { recipeId: 'test:orientation_recipe' };
        }
        if (component === 'anatomy:joint') {
          const jointMap = {
            left_arm_part: {
              parentEntityId: entityId,
              parentSocketId: 'left_arm_socket',
              childSocketId: 'shoulder',
            },
            right_arm_part: {
              parentEntityId: entityId,
              parentSocketId: 'right_arm_socket',
              childSocketId: 'shoulder',
            },
            upper_torso_part: {
              parentEntityId: entityId,
              parentSocketId: 'upper_torso_socket',
              childSocketId: 'spine',
            },
            lower_torso_part: {
              parentEntityId: entityId,
              parentSocketId: 'lower_torso_socket',
              childSocketId: 'pelvis',
            },
            center_head_part: {
              parentEntityId: entityId,
              parentSocketId: 'head_socket',
              childSocketId: 'neck',
            },
          };
          return jointMap[id] || null;
        }
        if (component === 'anatomy:sockets') {
          const socketMap = {
            left_arm_part: {
              sockets: [{ id: 'left_arm_socket', orientation: 'left' }],
            },
            right_arm_part: {
              sockets: [{ id: 'right_arm_socket', orientation: 'right' }],
            },
            upper_torso_part: {
              sockets: [{ id: 'upper_torso_socket', orientation: 'upper' }],
            },
            lower_torso_part: {
              sockets: [{ id: 'lower_torso_socket', orientation: 'lower' }],
            },
            center_head_part: {
              sockets: [{ id: 'center_head_socket', orientation: 'neutral' }],
            },
          };
          return socketMap[id] || null;
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest
          .fn()
          .mockReturnValue([
            'left_arm_part',
            'right_arm_part',
            'upper_torso_part',
            'lower_torso_part',
            'center_head_part',
          ]),
        getConnectedParts: jest.fn().mockImplementation((id) => {
          if (id === entityId) {
            return [
              'left_arm_part',
              'right_arm_part',
              'upper_torso_part',
              'lower_torso_part',
              'center_head_part',
            ];
          }
          return [];
        }),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      // Test left orientation
      const leftPoints = await service.resolveClothingSlotToAttachmentPoints(
        entityId,
        'left_glove'
      );
      expect(leftPoints[0].orientation).toBe('left');

      // Test right orientation
      const rightPoints = await service.resolveClothingSlotToAttachmentPoints(
        entityId,
        'right_glove'
      );
      expect(rightPoints[0].orientation).toBe('right');

      // Test upper orientation
      const upperPoints = await service.resolveClothingSlotToAttachmentPoints(
        entityId,
        'upper_shirt'
      );
      expect(upperPoints[0].orientation).toBe('upper');

      // Test lower orientation
      const lowerPoints = await service.resolveClothingSlotToAttachmentPoints(
        entityId,
        'lower_pants'
      );
      expect(lowerPoints[0].orientation).toBe('lower');

      // Test neutral orientation (no specific direction keywords)
      const neutralPoints = await service.resolveClothingSlotToAttachmentPoints(
        entityId,
        'helmet'
      );
      expect(neutralPoints[0].orientation).toBe('neutral');
    });
  });
});
