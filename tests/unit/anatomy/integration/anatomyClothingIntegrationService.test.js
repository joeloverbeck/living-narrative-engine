/**
 * @file Tests for AnatomyClothingIntegrationService
 * @see src/anatomy/integration/anatomyClothingIntegrationService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomyClothingIntegrationService from '../../../../src/anatomy/integration/anatomyClothingIntegrationService.js';

describe('AnatomyClothingIntegrationService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockBodyGraphService;
  let mockBlueprintLoader;
  let mockRecipeLoader;
  let mockBodyGraph;

  beforeEach(() => {
    // Create mocks
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getComponent: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockBodyGraph = {
      getAllPartIds: jest.fn().mockReturnValue([]),
      getConnectedParts: jest.fn().mockReturnValue([]),
    };

    mockBodyGraphService = {
      getBodyGraph: jest.fn().mockResolvedValue(mockBodyGraph),
    };

    mockBlueprintLoader = {
      load: jest.fn(),
    };

    mockRecipeLoader = {
      load: jest.fn(),
    };

    // Create service instance
    service = new AnatomyClothingIntegrationService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
      blueprintLoader: mockBlueprintLoader,
      recipeLoader: mockRecipeLoader,
    });
  });

  describe('constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(
        () =>
          new AnatomyClothingIntegrationService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            bodyGraphService: mockBodyGraphService,
            blueprintLoader: mockBlueprintLoader,
            recipeLoader: mockRecipeLoader,
          })
      ).not.toThrow();
    });

    it('should throw when missing entity manager', () => {
      expect(
        () =>
          new AnatomyClothingIntegrationService({
            logger: mockLogger,
            entityManager: null,
            bodyGraphService: mockBodyGraphService,
            blueprintLoader: mockBlueprintLoader,
            recipeLoader: mockRecipeLoader,
          })
      ).toThrow();
    });
  });

  describe('getAvailableClothingSlots', () => {
    const mockBlueprint = {
      id: 'anatomy:human_male',
      slots: {
        left_hand: {
          parent: 'left_arm',
          socket: 'wrist',
          requirements: { partType: 'hand' },
        },
        right_hand: {
          parent: 'right_arm',
          socket: 'wrist',
          requirements: { partType: 'hand' },
        },
      },
      clothingSlotMappings: {
        hands: {
          blueprintSlots: ['left_hand', 'right_hand'],
          allowedLayers: ['base', 'armor'],
          defaultLayer: 'base',
          tags: ['hands', 'extremities'],
        },
        torso_upper: {
          anatomySockets: ['left_shoulder', 'right_shoulder'],
          allowedLayers: ['base', 'outer', 'armor'],
          defaultLayer: 'base',
          tags: ['torso', 'upper_body'],
        },
      },
    };

    beforeEach(() => {
      // Setup entity with anatomy
      mockBodyGraph.getAllPartIds.mockReturnValue([
        'torso',
        'left_arm',
        'right_arm',
        'left_hand',
        'right_hand',
      ]);

      mockEntityManager.getComponent
        .mockResolvedValueOnce({ recipeId: 'anatomy:human_male_recipe' }) // anatomy:body
        .mockResolvedValue(null);

      mockRecipeLoader.load.mockResolvedValue({
        blueprint: 'anatomy:human_male',
      });
      mockBlueprintLoader.load.mockResolvedValue(mockBlueprint);

      // Mock socket components
      mockEntityManager.getComponent.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'anatomy:human_male_recipe' });
          }
          if (componentId === 'anatomy:sockets' && entityId === 'torso') {
            return Promise.resolve({
              sockets: [
                { id: 'left_shoulder', orientation: 'left' },
                { id: 'right_shoulder', orientation: 'right' },
              ],
            });
          }
          return Promise.resolve(null);
        }
      );
    });

    it('should return available clothing slots for entity with anatomy', async () => {
      const slots = await service.getAvailableClothingSlots('entity123');

      expect(slots).toBeInstanceOf(Map);
      expect(slots.size).toBe(2);
      expect(slots.has('hands')).toBe(true);
      expect(slots.has('torso_upper')).toBe(true);
    });

    it('should return empty map for entity without anatomy', async () => {
      // Clear all previous mocks and set up fresh for this test
      mockEntityManager.getComponent.mockReset();
      mockEntityManager.getComponent.mockResolvedValue(null);

      const slots = await service.getAvailableClothingSlots('entity123');

      expect(slots).toBeInstanceOf(Map);
      expect(slots.size).toBe(0);
    });

    it('should filter out slots with non-existent blueprint slots', async () => {
      const blueprintWithInvalidSlot = {
        ...mockBlueprint,
        clothingSlotMappings: {
          invalid_slot: {
            blueprintSlots: ['non_existent_slot'],
            allowedLayers: ['base'],
            defaultLayer: 'base',
          },
          hands: mockBlueprint.clothingSlotMappings.hands,
        },
      };
      mockBlueprintLoader.load.mockResolvedValue(blueprintWithInvalidSlot);

      const slots = await service.getAvailableClothingSlots('entity123');

      expect(slots.size).toBe(1);
      expect(slots.has('hands')).toBe(true);
      expect(slots.has('invalid_slot')).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockEntityManager.getComponent.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        service.getAvailableClothingSlots('entity123')
      ).rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('resolveClothingSlotToAttachmentPoints', () => {
    const mockBlueprint = {
      id: 'anatomy:human_male',
      slots: {
        left_hand: {
          parent: 'left_arm',
          socket: 'wrist',
          requirements: { partType: 'hand' },
        },
        right_hand: {
          parent: 'right_arm',
          socket: 'wrist',
          requirements: { partType: 'hand' },
        },
      },
      clothingSlotMappings: {
        hands: {
          blueprintSlots: ['left_hand', 'right_hand'],
          allowedLayers: ['base', 'armor'],
          defaultLayer: 'base',
        },
        torso_upper: {
          anatomySockets: ['left_shoulder', 'right_shoulder'],
          allowedLayers: ['base', 'outer'],
          defaultLayer: 'base',
        },
      },
    };

    beforeEach(() => {
      // Add the getAllPartIds to return all parts for socket resolution
      mockBodyGraph.getAllPartIds.mockReturnValue([
        'torso',
        'left_arm',
        'right_arm',
        'left_hand',
        'right_hand',
      ]);

      mockEntityManager.getComponent.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'anatomy:human_male_recipe' });
          }
          if (componentId === 'anatomy:sockets') {
            if (entityId === 'torso' || entityId === 'entity123') {
              return Promise.resolve({
                sockets: [
                  { id: 'left_shoulder', orientation: 'left' },
                  { id: 'right_shoulder', orientation: 'right' },
                ],
              });
            }
          }
          if (componentId === 'anatomy:joint') {
            if (entityId === 'left_hand') {
              return Promise.resolve({
                parentEntityId: 'left_arm',
                childSocketId: 'wrist',
                parentSocketId: 'wrist',
              });
            }
            if (entityId === 'right_hand') {
              return Promise.resolve({
                parentEntityId: 'right_arm',
                childSocketId: 'wrist',
                parentSocketId: 'wrist',
              });
            }
          }
          return Promise.resolve(null);
        }
      );

      mockRecipeLoader.load.mockResolvedValue({
        blueprint: 'anatomy:human_male',
      });
      mockBlueprintLoader.load.mockResolvedValue(mockBlueprint);

      mockBodyGraph.getConnectedParts.mockImplementation((entityId) => {
        if (entityId === 'entity123') return ['left_arm', 'right_arm'];
        if (entityId === 'left_arm') return ['left_hand'];
        if (entityId === 'right_arm') return ['right_hand'];
        return [];
      });
    });

    it('should resolve blueprint slots to attachment points', async () => {
      const attachmentPoints =
        await service.resolveClothingSlotToAttachmentPoints(
          'entity123',
          'hands'
        );

      expect(attachmentPoints).toHaveLength(2);
      expect(attachmentPoints[0]).toMatchObject({
        entityId: expect.any(String),
        socketId: 'wrist',
        slotPath: expect.stringContaining('hand'),
        orientation: expect.stringMatching(/left|right/),
      });
    });

    it('should resolve direct socket references', async () => {
      const attachmentPoints =
        await service.resolveClothingSlotToAttachmentPoints(
          'entity123',
          'torso_upper'
        );

      expect(attachmentPoints).toHaveLength(2);
      expect(attachmentPoints[0]).toMatchObject({
        entityId: 'torso',
        socketId: expect.stringMatching(/left_shoulder|right_shoulder/),
        slotPath: 'direct',
        orientation: expect.stringMatching(/left|right/),
      });
    });

    it('should return empty array for invalid slot', async () => {
      const attachmentPoints =
        await service.resolveClothingSlotToAttachmentPoints(
          'entity123',
          'invalid_slot'
        );

      expect(attachmentPoints).toEqual([]);
    });

    it('should cache results for performance', async () => {
      // First call
      await service.resolveClothingSlotToAttachmentPoints('entity123', 'hands');

      // Second call should use cache
      await service.resolveClothingSlotToAttachmentPoints('entity123', 'hands');

      // Blueprint should only be loaded once
      expect(mockBlueprintLoader.load).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateClothingSlotCompatibility', () => {
    beforeEach(() => {
      const mockBlueprint = {
        id: 'anatomy:human_male',
        slots: {
          left_hand: { parent: 'left_arm', socket: 'wrist' },
          right_hand: { parent: 'right_arm', socket: 'wrist' },
        },
        clothingSlotMappings: {
          hands: {
            blueprintSlots: ['left_hand', 'right_hand'],
            allowedLayers: ['base', 'armor'],
            defaultLayer: 'base',
          },
        },
      };

      // Setup body graph
      mockBodyGraph.getAllPartIds.mockReturnValue([
        'left_arm',
        'right_arm',
        'left_hand',
        'right_hand',
      ]);
      mockBodyGraph.getConnectedParts.mockReturnValue([]);

      mockEntityManager.getComponent.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'anatomy:human_male_recipe' });
          }
          if (componentId === 'anatomy:joint') {
            if (entityId === 'left_hand') {
              return Promise.resolve({
                parentEntityId: 'left_arm',
                parentSocketId: 'wrist',
                childSocketId: 'hand_base',
              });
            }
            if (entityId === 'right_hand') {
              return Promise.resolve({
                parentEntityId: 'right_arm',
                parentSocketId: 'wrist',
                childSocketId: 'hand_base',
              });
            }
          }
          return Promise.resolve(null);
        }
      );

      // Setup body graph connections
      mockBodyGraph.getConnectedParts.mockImplementation((entityId) => {
        if (entityId === 'entity123') return ['left_arm', 'right_arm'];
        if (entityId === 'left_arm') return ['left_hand'];
        if (entityId === 'right_arm') return ['right_hand'];
        return [];
      });

      mockRecipeLoader.load.mockResolvedValue({
        blueprint: 'anatomy:human_male',
      });
      mockBlueprintLoader.load.mockResolvedValue(mockBlueprint);
    });

    it('should validate compatible clothing slot', async () => {
      const result = await service.validateClothingSlotCompatibility(
        'entity123',
        'hands',
        'gloves_item'
      );

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject non-existent clothing slot', async () => {
      const result = await service.validateClothingSlotCompatibility(
        'entity123',
        'wings',
        'wing_armor'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Entity lacks clothing slot 'wings'");
    });

    it('should reject slot with no attachment points', async () => {
      // Setup a blueprint where slots exist but have no attachment points resolved
      const mockBlueprint = {
        id: 'anatomy:human_male',
        slots: {
          left_hand: { parent: 'left_arm', socket: 'wrist' },
          right_hand: { parent: 'right_arm', socket: 'wrist' },
        },
        clothingSlotMappings: {
          hands: {
            blueprintSlots: ['left_hand', 'right_hand'],
            allowedLayers: ['base'],
            defaultLayer: 'base',
          },
        },
      };
      mockBlueprintLoader.load.mockResolvedValue(mockBlueprint);

      // Override body graph to return empty - no hands attached
      mockBodyGraph.getConnectedParts.mockReturnValue([]);

      // Override entity manager to return no joint components
      mockEntityManager.getComponent.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'anatomy:human_male_recipe' });
          }
          // No joint components means no attachment points will be found
          return Promise.resolve(null);
        }
      );

      const result = await service.validateClothingSlotCompatibility(
        'entity123',
        'hands',
        'gloves_item'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('no valid attachment points');
    });
  });

  describe('getSlotAnatomySockets', () => {
    beforeEach(() => {
      const mockBlueprint = {
        clothingSlotMappings: {
          torso_upper: {
            anatomySockets: ['left_shoulder', 'right_shoulder'],
            allowedLayers: ['base'],
            defaultLayer: 'base',
          },
        },
      };

      mockEntityManager.getComponent.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'anatomy:human_male_recipe' });
          }
          if (componentId === 'anatomy:sockets' && entityId === 'torso') {
            return Promise.resolve({
              sockets: [{ id: 'left_shoulder' }, { id: 'right_shoulder' }],
            });
          }
          return Promise.resolve(null);
        }
      );

      mockRecipeLoader.load.mockResolvedValue({
        blueprint: 'anatomy:human_male',
      });
      mockBlueprintLoader.load.mockResolvedValue(mockBlueprint);

      // Make sure torso is included in getAllPartIds
      mockBodyGraph.getAllPartIds.mockReturnValue(['torso']);
      mockBodyGraph.getConnectedParts.mockReturnValue([]);
    });

    it('should return socket references for clothing slot', async () => {
      const sockets = await service.getSlotAnatomySockets(
        'entity123',
        'torso_upper'
      );

      expect(sockets).toHaveLength(2);
      expect(sockets[0]).toMatchObject({
        entityId: 'torso',
        socketId: expect.stringMatching(/left_shoulder|right_shoulder/),
      });
    });

    it('should return empty array for invalid slot', async () => {
      const sockets = await service.getSlotAnatomySockets(
        'entity123',
        'invalid_slot'
      );

      expect(sockets).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('should clear all caches', async () => {
      // Populate cache
      const mockBlueprint = {
        clothingSlotMappings: {
          hands: {
            blueprintSlots: ['left_hand', 'right_hand'],
            allowedLayers: ['base'],
            defaultLayer: 'base',
          },
        },
        slots: { left_hand: {} },
      };

      mockEntityManager.getComponent.mockResolvedValue({
        recipeId: 'anatomy:human_male_recipe',
      });
      mockRecipeLoader.load.mockResolvedValue({
        blueprint: 'anatomy:human_male',
      });
      mockBlueprintLoader.load.mockResolvedValue(mockBlueprint);

      // First call populates cache
      await service.getAvailableClothingSlots('entity123');
      expect(mockBlueprintLoader.load).toHaveBeenCalledTimes(1);

      // Clear cache
      service.clearCache();

      // Next call should reload
      await service.getAvailableClothingSlots('entity123');
      expect(mockBlueprintLoader.load).toHaveBeenCalledTimes(2);
    });
  });
});
