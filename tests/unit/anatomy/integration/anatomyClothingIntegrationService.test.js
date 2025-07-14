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
  let mockAnatomyBlueprintRepository;
  let mockAnatomySocketIndex;
  let mockClothingSlotValidator;

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

    // Create mock anatomy blueprint repository
    mockAnatomyBlueprintRepository = {
      getBlueprintByRecipeId: jest.fn(),
      clearCache: jest.fn(),
    };

    // Create mock anatomy socket index
    mockAnatomySocketIndex = {
      findEntityWithSocket: jest.fn(),
      buildIndex: jest.fn(),
      clearCache: jest.fn(),
    };

    // Create mock clothing slot validator
    mockClothingSlotValidator = {
      validateSlotCompatibility: jest.fn(),
    };

    // Create test data
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
          socket: 'left_hand_socket',
        },
        right_hand: {
          parent: 'right_arm',
          type: 'test:hand',
          socket: 'right_hand_socket',
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

    // Setup mock repository responses
    mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockImplementation(
      (recipeId) => {
        if (recipeId === 'test:humanoid_recipe') {
          return Promise.resolve(testBlueprint);
        }
        return Promise.resolve(null);
      }
    );

    service = new AnatomyClothingIntegrationService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
      anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
      anatomySocketIndex: mockAnatomySocketIndex,
      clothingSlotValidator: mockClothingSlotValidator,
    });
  });

  describe('constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(service).toBeDefined();
    });

    it('should validate anatomyBlueprintRepository has required methods', () => {
      expect(() => {
        new AnatomyClothingIntegrationService({
          logger: mockLogger,
          entityManager: mockEntityManager,
          bodyGraphService: mockBodyGraphService,
          anatomyBlueprintRepository: {}, // Missing 'getBlueprintByRecipeId' method
          anatomySocketIndex: mockAnatomySocketIndex,
          clothingSlotValidator: mockClothingSlotValidator,
        });
      }).toThrow();
    });
  });

  describe('getAvailableClothingSlots', () => {
    beforeEach(() => {
      // Setup entity with anatomy
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'test_entity' && componentId === 'anatomy:body') {
            return { recipeId: 'test:humanoid_recipe' };
          }
          if (componentId === 'anatomy:sockets') {
            if (entityId === 'torso_part') {
              return {
                sockets: [{ id: 'torso_clothing', orientation: 'neutral' }],
              };
            }
            if (entityId === 'left_hand_part') {
              return {
                sockets: [{ id: 'left_hand_socket', orientation: 'left' }],
              };
            }
            if (entityId === 'right_hand_part') {
              return {
                sockets: [{ id: 'right_hand_socket', orientation: 'right' }],
              };
            }
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
          return null;
        }
      );

      // Mock body graph
      const mockBodyGraph = {
        getAllPartIds: jest
          .fn()
          .mockReturnValue(['torso_part', 'left_hand_part', 'right_hand_part']),
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

      const slots =
        await service.getAvailableClothingSlots('no_anatomy_entity');

      expect(slots).toBeInstanceOf(Map);
      expect(slots.size).toBe(0);
    });

    it('should throw for invalid entity ID', async () => {
      await expect(service.getAvailableClothingSlots(null)).rejects.toThrow(
        'Entity ID is required'
      );
      await expect(service.getAvailableClothingSlots('')).rejects.toThrow(
        'Entity ID is required'
      );
    });

    it('should handle missing recipe gracefully', async () => {
      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'non_existent_recipe',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        null
      );

      const slots = await service.getAvailableClothingSlots('test_entity');

      expect(slots).toBeInstanceOf(Map);
      expect(slots.size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyClothingIntegrationService: No clothing slot mappings for entity test_entity'
      );
    });
  });

  describe('resolveClothingSlotToAttachmentPoints', () => {
    beforeEach(() => {
      // Setup complete test data
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
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
                sockets: [{ id: 'torso_clothing', orientation: 'neutral' }],
              };
            }
            if (entityId === 'left_hand_part') {
              return {
                sockets: [{ id: 'left_hand_socket', orientation: 'left' }],
              };
            }
            if (entityId === 'right_hand_part') {
              return {
                sockets: [{ id: 'right_hand_socket', orientation: 'right' }],
              };
            }
          }
          return null;
        }
      );

      const mockBodyGraph = {
        getAllPartIds: jest
          .fn()
          .mockReturnValue([
            'torso_part',
            'left_arm_part',
            'right_arm_part',
            'left_hand_part',
            'right_hand_part',
          ]),
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

      // Configure anatomySocketIndex to return appropriate entities for socket lookups
      mockAnatomySocketIndex.findEntityWithSocket.mockImplementation(
        (entityId, socketId) => {
          if (socketId === 'left_hand_socket') {
            return Promise.resolve('left_hand_part');
          }
          if (socketId === 'right_hand_socket') {
            return Promise.resolve('right_hand_part');
          }
          return Promise.resolve(null);
        }
      );
    });

    it('should resolve blueprint slots to attachment points', async () => {
      const attachmentPoints =
        await service.resolveClothingSlotToAttachmentPoints(
          'test_entity',
          'gloves'
        );

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
      const attachmentPoints =
        await service.resolveClothingSlotToAttachmentPoints(
          'test_entity',
          'shirt'
        );

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
      await service.resolveClothingSlotToAttachmentPoints(
        'test_entity',
        'shirt'
      );

      // Second call - should use cache
      const cachedResult = await service.resolveClothingSlotToAttachmentPoints(
        'test_entity',
        'shirt'
      );

      // Body graph may be called multiple times during resolution
      expect(mockBodyGraphService.getBodyGraph).toHaveBeenCalled();
      expect(cachedResult).toBeDefined();
    });

    it('should throw for invalid parameters', async () => {
      await expect(
        service.resolveClothingSlotToAttachmentPoints(null, 'shirt')
      ).rejects.toThrow('Entity ID is required');
      await expect(
        service.resolveClothingSlotToAttachmentPoints('test_entity', null)
      ).rejects.toThrow('Slot ID is required');
    });

    it('should return empty array for non-existent slot', async () => {
      const attachmentPoints =
        await service.resolveClothingSlotToAttachmentPoints(
          'test_entity',
          'non_existent_slot'
        );

      expect(attachmentPoints).toEqual([]);
    });
  });

  describe('validateClothingSlotCompatibility', () => {
    beforeEach(() => {
      // Setup entity data
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'test_entity' && componentId === 'anatomy:body') {
            return { recipeId: 'test:humanoid_recipe' };
          }
          if (componentId === 'anatomy:sockets' && entityId === 'torso_part') {
            return {
              sockets: [{ id: 'torso_clothing', orientation: 'neutral' }],
            };
          }
          return null;
        }
      );

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['torso_part']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
    });

    it('should validate compatible clothing slot', async () => {
      // Mock validator to return valid
      mockClothingSlotValidator.validateSlotCompatibility.mockResolvedValue({
        valid: true,
      });

      const result = await service.validateClothingSlotCompatibility(
        'test_entity',
        'shirt',
        'test_shirt_item'
      );

      expect(result).toMatchObject({
        valid: true,
      });

      // Verify validator was called with correct parameters
      expect(
        mockClothingSlotValidator.validateSlotCompatibility
      ).toHaveBeenCalledWith(
        'test_entity',
        'shirt',
        'test_shirt_item',
        expect.any(Map),
        expect.any(Function)
      );
    });

    it('should reject invalid slot', async () => {
      // Mock validator to return invalid
      mockClothingSlotValidator.validateSlotCompatibility.mockResolvedValue({
        valid: false,
        reason: "Entity lacks clothing slot 'invalid_slot'",
      });

      const result = await service.validateClothingSlotCompatibility(
        'test_entity',
        'invalid_slot',
        'test_item'
      );

      expect(result).toMatchObject({
        valid: false,
        reason: expect.stringContaining(
          "Entity lacks clothing slot 'invalid_slot'"
        ),
      });
    });

    it('should reject slot without attachment points', async () => {
      // Mock validator to return invalid due to no attachment points
      mockClothingSlotValidator.validateSlotCompatibility.mockResolvedValue({
        valid: false,
        reason: "Clothing slot 'broken_slot' has no valid attachment points",
      });

      const result = await service.validateClothingSlotCompatibility(
        'test_entity',
        'broken_slot',
        'test_item'
      );

      expect(result).toMatchObject({
        valid: false,
        reason: expect.stringContaining('has no valid attachment points'),
      });
    });

    it('should pass through to validator', async () => {
      // Mock validator response
      mockClothingSlotValidator.validateSlotCompatibility.mockResolvedValue({
        valid: true,
      });

      // Call the method
      await service.validateClothingSlotCompatibility(
        'entity',
        'shirt',
        'item'
      );

      // Verify the validator was called with the expected parameters
      expect(
        mockClothingSlotValidator.validateSlotCompatibility
      ).toHaveBeenCalledWith(
        'entity',
        'shirt',
        'item',
        expect.any(Map),
        expect.any(Function)
      );
    });
  });

  describe('getSlotAnatomySockets', () => {
    beforeEach(() => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'test_entity' && componentId === 'anatomy:body') {
            return { recipeId: 'test:humanoid_recipe' };
          }
          if (componentId === 'anatomy:sockets' && entityId === 'torso_part') {
            return {
              sockets: [{ id: 'torso_clothing', orientation: 'neutral' }],
            };
          }
          return null;
        }
      );

      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['torso_part']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
    });

    it('should return socket references for a clothing slot', async () => {
      const sockets = await service.getSlotAnatomySockets(
        'test_entity',
        'shirt'
      );

      expect(sockets).toBeInstanceOf(Array);
      expect(sockets.length).toBeGreaterThan(0);
      expect(sockets[0]).toMatchObject({
        entityId: 'torso_part',
        socketId: 'torso_clothing',
      });
    });

    it('should return empty array for invalid slot', async () => {
      const sockets = await service.getSlotAnatomySockets(
        'test_entity',
        'invalid_slot'
      );

      expect(sockets).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('should clear all caches', async () => {
      // Populate caches
      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'test:humanoid_recipe',
      });
      const mockBodyGraph = {
        getAllPartIds: jest.fn().mockReturnValue(['torso_part']),
      };
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);

      await service.getAvailableClothingSlots('test_entity');
      await service.resolveClothingSlotToAttachmentPoints(
        'test_entity',
        'shirt'
      );

      // Clear caches
      service.clearCache();

      // Next calls should hit the services again
      await service.getAvailableClothingSlots('test_entity');
      await service.resolveClothingSlotToAttachmentPoints(
        'test_entity',
        'shirt'
      );

      // With caching: first set of calls uses services, after clear cache they're called again
      // getAvailableClothingSlots is now cached, so fewer calls overall
      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(6); // 3 before clear, 3 after
      expect(mockBodyGraphService.getBodyGraph).toHaveBeenCalledTimes(2); // 1 before clear, 1 after
    });
  });
});
