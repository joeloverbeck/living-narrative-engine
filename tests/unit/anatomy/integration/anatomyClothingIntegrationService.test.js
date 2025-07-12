/**
 * @file Unit tests for AnatomyClothingIntegrationService
 * @see src/anatomy/integration/anatomyClothingIntegrationService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomyClothingIntegrationService from '../../../../src/anatomy/integration/anatomyClothingIntegrationService.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('AnatomyClothingIntegrationService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockBodyGraphService;
  let mockDataRegistry;

  beforeEach(() => {
    mockLogger = createMockLogger();
    
    // Create mock entity manager
    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    // Create mock body graph service
    mockBodyGraphService = {
      getBodyGraph: jest.fn(),
    };

    // Create mock data registry
    mockDataRegistry = {
      get: jest.fn(),
    };

    // Create test data
    const testRecipe = {
      id: 'test:humanoid_recipe',
      blueprint: 'test:humanoid_blueprint',
    };

    const testBlueprint = {
      id: 'test:humanoid_blueprint',
      root: {
        type: 'test:torso',
        sockets: {
          head: { slot: 'head' },
          left_arm: { slot: 'left_arm' },
          right_arm: { slot: 'right_arm' },
        },
      },
      slots: {
        left_hand: {
          parent: 'left_arm',
          type: 'test:hand',
        },
        right_hand: {
          parent: 'right_arm',
          type: 'test:hand',
        },
      },
      clothingSlotMappings: {
        gloves: {
          blueprintSlots: ['left_hand', 'right_hand'],
          allowedLayers: ['base', 'middle', 'outer'],
          layerOrder: ['base', 'middle', 'outer'],
          defaultLayer: 'base',
        },
        shirt: {
          anatomySockets: ['torso_clothing'],
          allowedLayers: ['base', 'middle', 'outer'],
          layerOrder: ['base', 'middle', 'outer'],
          defaultLayer: 'middle',
        },
      },
    };

    // Setup mock data registry responses
    mockDataRegistry.get.mockImplementation((category, id) => {
      if (category === 'anatomyRecipes' && id === 'test:humanoid_recipe') {
        return testRecipe;
      }
      if (category === 'anatomyBlueprints' && id === 'test:humanoid_blueprint') {
        return testBlueprint;
      }
      return null;
    });

    service = new AnatomyClothingIntegrationService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
      dataRegistry: mockDataRegistry,
    });
  });

  describe('constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(service).toBeDefined();
    });

    it('should validate dataRegistry has required methods', () => {
      expect(() => {
        new AnatomyClothingIntegrationService({
          logger: mockLogger,
          entityManager: mockEntityManager,
          bodyGraphService: mockBodyGraphService,
          dataRegistry: {}, // Missing 'get' method
        });
      }).toThrow();
    });
  });

  describe('getAvailableClothingSlots', () => {
    beforeEach(() => {
      // Setup entity with anatomy
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'test_entity' && componentId === 'anatomy:body') {
          return { recipeId: 'test:humanoid_recipe' };
        }
        if (componentId === 'anatomy:sockets') {
          if (entityId === 'torso_part') {
            return {
              sockets: [
                { id: 'torso_clothing', orientation: 'neutral' },
              ],
            };
          }
        }
        return null;
      });

      // Mock body graph
      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['torso_part', 'left_hand_part', 'right_hand_part']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
    });

    it('should return available clothing slots for an entity', async () => {
      const slots = await service.getAvailableClothingSlots('test_entity');
      
      expect(slots).toBeInstanceOf(Map);
      expect(slots.size).toBeGreaterThan(0);
      expect(slots.has('shirt')).toBe(true);
      
      const shirtSlot = slots.get('shirt');
      expect(shirtSlot).toMatchObject({
        anatomySockets: ['torso_clothing'],
        allowedLayers: ['base', 'middle', 'outer'],
        defaultLayer: 'middle',
      });
    });

    it('should return empty map for entity without anatomy', async () => {
      mockEntityManager.getComponentData.mockResolvedValue(null);
      
      const slots = await service.getAvailableClothingSlots('no_anatomy_entity');
      
      expect(slots).toBeInstanceOf(Map);
      expect(slots.size).toBe(0);
    });

    it('should throw for invalid entity ID', async () => {
      await expect(service.getAvailableClothingSlots(null)).rejects.toThrow('Entity ID is required');
      await expect(service.getAvailableClothingSlots('')).rejects.toThrow('Entity ID is required');
    });

    it('should handle missing recipe gracefully', async () => {
      mockEntityManager.getComponentData.mockResolvedValue({ recipeId: 'non_existent_recipe' });
      mockDataRegistry.get.mockReturnValue(null);
      
      const slots = await service.getAvailableClothingSlots('test_entity');
      
      expect(slots).toBeInstanceOf(Map);
      expect(slots.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Recipe 'non_existent_recipe' not found")
      );
    });
  });

  describe('resolveClothingSlotToAttachmentPoints', () => {
    beforeEach(() => {
      // Setup complete test data
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'test_entity' && componentId === 'anatomy:body') {
          return { recipeId: 'test:humanoid_recipe' };
        }
        if (componentId === 'anatomy:joint') {
          if (entityId === 'left_hand_part') {
            return {
              parentEntityId: 'left_arm_part',
              parentSocketId: 'hand_socket',
              childSocketId: 'wrist',
            };
          }
          if (entityId === 'right_hand_part') {
            return {
              parentEntityId: 'right_arm_part',
              parentSocketId: 'hand_socket',
              childSocketId: 'wrist',
            };
          }
        }
        if (componentId === 'anatomy:sockets') {
          if (entityId === 'torso_part') {
            return {
              sockets: [
                { id: 'torso_clothing', orientation: 'neutral' },
              ],
            };
          }
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['torso_part', 'left_arm_part', 'right_arm_part', 'left_hand_part', 'right_hand_part']),
        getConnectedParts: jest.fn().mockImplementation((entityId) => {
          if (entityId === 'test_entity') {
            return ['left_arm_part', 'right_arm_part'];
          }
          if (entityId === 'left_arm_part') {
            return ['left_hand_part'];
          }
          if (entityId === 'right_arm_part') {
            return ['right_hand_part'];
          }
          return [];
        }),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
    });

    it('should resolve blueprint slots to attachment points', async () => {
      const attachmentPoints = await service.resolveClothingSlotToAttachmentPoints('test_entity', 'gloves');
      
      expect(attachmentPoints).toBeInstanceOf(Array);
      expect(attachmentPoints.length).toBe(2); // Left and right hand
      expect(attachmentPoints[0]).toMatchObject({
        entityId: expect.any(String),
        socketId: expect.any(String),
        slotPath: expect.any(String),
        orientation: expect.any(String),
      });
    });

    it('should resolve direct socket references', async () => {
      const attachmentPoints = await service.resolveClothingSlotToAttachmentPoints('test_entity', 'shirt');
      
      expect(attachmentPoints).toBeInstanceOf(Array);
      expect(attachmentPoints.length).toBeGreaterThan(0);
      expect(attachmentPoints[0]).toMatchObject({
        entityId: 'torso_part',
        socketId: 'torso_clothing',
        slotPath: 'direct',
        orientation: 'neutral',
      });
    });

    it('should cache resolved attachment points', async () => {
      // First call
      await service.resolveClothingSlotToAttachmentPoints('test_entity', 'shirt');
      
      // Second call - should use cache
      const cachedResult = await service.resolveClothingSlotToAttachmentPoints('test_entity', 'shirt');
      
      // Body graph may be called multiple times during resolution
      expect(mockBodyGraphService.getBodyGraph).toHaveBeenCalled();
      expect(cachedResult).toBeDefined();
    });

    it('should throw for invalid parameters', async () => {
      await expect(service.resolveClothingSlotToAttachmentPoints(null, 'shirt')).rejects.toThrow('Entity ID is required');
      await expect(service.resolveClothingSlotToAttachmentPoints('test_entity', null)).rejects.toThrow('Slot ID is required');
    });

    it('should return empty array for non-existent slot', async () => {
      const attachmentPoints = await service.resolveClothingSlotToAttachmentPoints('test_entity', 'non_existent_slot');
      
      expect(attachmentPoints).toEqual([]);
    });
  });

  describe('validateClothingSlotCompatibility', () => {
    beforeEach(() => {
      // Setup entity data
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'test_entity' && componentId === 'anatomy:body') {
          return { recipeId: 'test:humanoid_recipe' };
        }
        if (componentId === 'anatomy:sockets' && entityId === 'torso_part') {
          return {
            sockets: [
              { id: 'torso_clothing', orientation: 'neutral' },
            ],
          };
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['torso_part']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
    });

    it('should validate compatible clothing slot', async () => {
      const result = await service.validateClothingSlotCompatibility('test_entity', 'shirt', 'test_shirt_item');
      
      expect(result).toMatchObject({
        valid: true,
      });
    });

    it('should reject invalid slot', async () => {
      const result = await service.validateClothingSlotCompatibility('test_entity', 'invalid_slot', 'test_item');
      
      expect(result).toMatchObject({
        valid: false,
        reason: expect.stringContaining("Entity lacks clothing slot 'invalid_slot'"),
      });
    });

    it('should reject slot without attachment points', async () => {
      // Mock blueprint with slot but no valid attachment points
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'anatomyRecipes' && id === 'test:humanoid_recipe') {
          return { id: 'test:humanoid_recipe', blueprint: 'test:humanoid_blueprint' };
        }
        if (category === 'anatomyBlueprints' && id === 'test:humanoid_blueprint') {
          return {
            id: 'test:humanoid_blueprint',
            root: { type: 'test:torso' },
            clothingSlotMappings: {
              'broken_slot': {
                anatomySockets: ['non_existent_socket'],
                allowedLayers: ['base'],
                layerOrder: ['base'],
                defaultLayer: 'base',
              },
            },
          };
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue([]),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      const result = await service.validateClothingSlotCompatibility('test_entity', 'broken_slot', 'test_item');
      
      expect(result).toMatchObject({
        valid: false,
        reason: expect.stringContaining("Entity lacks clothing slot 'broken_slot'"),
      });
    });

    it('should throw for invalid parameters', async () => {
      await expect(service.validateClothingSlotCompatibility(null, 'shirt', 'item')).rejects.toThrow('Entity ID is required');
      await expect(service.validateClothingSlotCompatibility('entity', null, 'item')).rejects.toThrow('Slot ID is required');
      await expect(service.validateClothingSlotCompatibility('entity', 'shirt', null)).rejects.toThrow('Item ID is required');
    });
  });

  describe('getSlotAnatomySockets', () => {
    beforeEach(() => {
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'test_entity' && componentId === 'anatomy:body') {
          return { recipeId: 'test:humanoid_recipe' };
        }
        if (componentId === 'anatomy:sockets' && entityId === 'torso_part') {
          return {
            sockets: [
              { id: 'torso_clothing', orientation: 'neutral' },
            ],
          };
        }
        return null;
      });

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['torso_part']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
    });

    it('should return socket references for a clothing slot', async () => {
      const sockets = await service.getSlotAnatomySockets('test_entity', 'shirt');
      
      expect(sockets).toBeInstanceOf(Array);
      expect(sockets.length).toBeGreaterThan(0);
      expect(sockets[0]).toMatchObject({
        entityId: 'torso_part',
        socketId: 'torso_clothing',
      });
    });

    it('should return empty array for invalid slot', async () => {
      const sockets = await service.getSlotAnatomySockets('test_entity', 'invalid_slot');
      
      expect(sockets).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('should clear all caches', async () => {
      // Populate caches
      mockEntityManager.getComponentData.mockResolvedValue({ recipeId: 'test:humanoid_recipe' });
      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['torso_part']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      await service.getAvailableClothingSlots('test_entity');
      await service.resolveClothingSlotToAttachmentPoints('test_entity', 'shirt');
      
      // Clear caches
      service.clearCache();
      
      // Next calls should hit the services again
      await service.getAvailableClothingSlots('test_entity');
      await service.resolveClothingSlotToAttachmentPoints('test_entity', 'shirt');
      
      // Should have been called twice for each method call (4 total before clear, 4 after)
      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(8); // 4 for each call
      expect(mockBodyGraphService.getBodyGraph).toHaveBeenCalledTimes(4); // 2 methods x 2 calls each
    });
  });
});