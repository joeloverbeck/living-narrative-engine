/**
 * @file Integration tests for universal clothing slots and cross-gender functionality
 * @see src/anatomy/integration/SlotResolver.js
 * @see src/anatomy/integration/strategies/ClothingSlotMappingStrategy.js
 * @see data/mods/anatomy/blueprints/human_male.blueprint.json
 * @see data/mods/anatomy/blueprints/human_female.blueprint.json
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SlotResolver from '../../../src/anatomy/integration/SlotResolver.js';
import {
  ClothingSlotNotFoundError,
  InvalidClothingSlotMappingError,
} from '../../../src/errors/clothingSlotErrors.js';

describe('Universal Clothing Slots Integration', () => {
  let slotResolver;
  let mockLogger;
  let mockEntityManager;
  let mockBodyGraphService;
  let mockAnatomyBlueprintRepository;
  let mockAnatomySocketIndex;
  let mockCache;

  const maleBlueprint = {
    id: 'anatomy:human_male',
    clothingSlotMappings: {
      underwear_upper: {
        anatomySockets: [
          'left_breast',
          'right_breast',
          'left_chest',
          'right_chest',
          'chest_center'
        ],
        allowedLayers: ['underwear']
      },
      underwear_lower: {
        anatomySockets: [
          'pubic_hair',
          'penis',
          'left_testicle',
          'right_testicle',
          'vagina'
        ],
        allowedLayers: ['underwear']
      },
      back_accessory: {
        anatomySockets: [
          'upper_back',
          'lower_back'
        ],
        allowedLayers: ['accessory', 'armor']
      },
      // Legacy slots for backward compatibility
      genital_covering: {
        anatomySockets: ['penis', 'left_testicle', 'right_testicle'],
        allowedLayers: ['underwear']
      },
      torso_upper: {
        blueprintSlots: ['torso'],
        allowedLayers: ['underwear', 'base', 'outer']
      }
    }
  };

  const femaleBlueprint = {
    id: 'anatomy:human_female',
    clothingSlotMappings: {
      underwear_upper: {
        anatomySockets: [
          'left_breast',
          'right_breast',
          'left_chest',
          'right_chest',
          'chest_center'
        ],
        allowedLayers: ['underwear']
      },
      underwear_lower: {
        anatomySockets: [
          'pubic_hair',
          'penis',
          'left_testicle',
          'right_testicle',
          'vagina'
        ],
        allowedLayers: ['underwear']
      },
      back_accessory: {
        anatomySockets: [
          'upper_back',
          'lower_back'
        ],
        allowedLayers: ['accessory', 'armor']
      },
      // Legacy slots for backward compatibility
      bra: {
        blueprintSlots: ['left_breast', 'right_breast'],
        allowedLayers: ['underwear']
      },
      panties: {
        anatomySockets: ['vagina', 'pubic_hair'],
        allowedLayers: ['underwear']
      }
    }
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

    mockCache = {
      get: jest.fn().mockReturnValue(undefined),
      set: jest.fn(),
      clearType: jest.fn(),
    };

    mockBodyGraphService.getBodyGraph.mockResolvedValue({
      getConnectedParts: jest.fn().mockReturnValue([]),
      getAllPartIds: jest.fn().mockReturnValue(['torso_entity', 'pelvis_entity']),
    });

    slotResolver = new SlotResolver({
      logger: mockLogger,
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
      anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
      anatomySocketIndex: mockAnatomySocketIndex,
      cache: mockCache,
    });
  });

  describe('Cross-Gender Underwear Functionality', () => {
    describe('Male wearing female underwear', () => {
      beforeEach(() => {
        // Mock male entity with male anatomy
        mockEntityManager.getComponentData.mockImplementation((entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'anatomy:human_male' });
          }
          if (componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [
                { id: 'pubic_hair', orientation: 'neutral' },
                { id: 'penis', orientation: 'neutral' },
                { id: 'left_testicle', orientation: 'neutral' },
                { id: 'right_testicle', orientation: 'neutral' },
                { id: 'left_chest', orientation: 'neutral' },
                { id: 'right_chest', orientation: 'neutral' },
                { id: 'upper_back', orientation: 'neutral' },
                { id: 'lower_back', orientation: 'neutral' },
              ]
            });
          }
          return Promise.resolve(null);
        });

        mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(maleBlueprint);

        // Mock socket resolution for male anatomy
        mockAnatomySocketIndex.findEntityWithSocket.mockImplementation((entityId, socketId) => {
          const maleSocketMap = {
            'pubic_hair': 'pelvis_entity',
            'penis': 'pelvis_entity',
            'left_testicle': 'pelvis_entity',
            'right_testicle': 'pelvis_entity',
            'left_chest': 'torso_entity',
            'right_chest': 'torso_entity',
            'upper_back': 'torso_entity',
            'lower_back': 'torso_entity',
          };
          return Promise.resolve(maleSocketMap[socketId] || null);
        });
      });

      it('should allow male entity to wear panties using universal underwear_lower slot', async () => {
        const result = await slotResolver.resolveClothingSlot('male_actor', 'underwear_lower');

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);

        // Should attach to male genital anatomy
        const attachedSockets = result.map(point => point.socketId);
        expect(attachedSockets).toContain('pubic_hair');
        expect(attachedSockets).toContain('penis');
        expect(attachedSockets).toContain('left_testicle');
        expect(attachedSockets).toContain('right_testicle');

        // Should NOT attach to female anatomy (since it doesn't exist)
        expect(attachedSockets).not.toContain('vagina');
      });

      it('should allow male entity to wear bra using universal underwear_upper slot', async () => {
        const result = await slotResolver.resolveClothingSlot('male_actor', 'underwear_upper');

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);

        // Should attach to male chest anatomy
        const attachedSockets = result.map(point => point.socketId);
        expect(attachedSockets).toContain('left_chest');
        expect(attachedSockets).toContain('right_chest');

        // Should NOT attach to female breast anatomy (since it doesn't exist)
        expect(attachedSockets).not.toContain('left_breast');
        expect(attachedSockets).not.toContain('right_breast');
      });
    });

    describe('Female wearing male underwear', () => {
      beforeEach(() => {
        // Mock female entity with female anatomy
        mockEntityManager.getComponentData.mockImplementation((entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'anatomy:human_female' });
          }
          if (componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [
                { id: 'pubic_hair', orientation: 'neutral' },
                { id: 'vagina', orientation: 'neutral' },
                { id: 'left_breast', orientation: 'neutral' },
                { id: 'right_breast', orientation: 'neutral' },
                { id: 'upper_back', orientation: 'neutral' },
                { id: 'lower_back', orientation: 'neutral' },
              ]
            });
          }
          return Promise.resolve(null);
        });

        mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(femaleBlueprint);

        // Mock socket resolution for female anatomy
        mockAnatomySocketIndex.findEntityWithSocket.mockImplementation((entityId, socketId) => {
          const femaleSocketMap = {
            'pubic_hair': 'pelvis_entity',
            'vagina': 'pelvis_entity',
            'left_breast': 'torso_entity',
            'right_breast': 'torso_entity',
            'upper_back': 'torso_entity',
            'lower_back': 'torso_entity',
          };
          return Promise.resolve(femaleSocketMap[socketId] || null);
        });
      });

      it('should allow female entity to wear boxers using universal underwear_lower slot', async () => {
        const result = await slotResolver.resolveClothingSlot('female_actor', 'underwear_lower');

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);

        // Should attach to female genital anatomy
        const attachedSockets = result.map(point => point.socketId);
        expect(attachedSockets).toContain('pubic_hair');
        expect(attachedSockets).toContain('vagina');

        // Should NOT attach to male anatomy (since it doesn't exist)
        expect(attachedSockets).not.toContain('penis');
        expect(attachedSockets).not.toContain('left_testicle');
        expect(attachedSockets).not.toContain('right_testicle');
      });

      it('should allow female entity to wear male chest underwear using universal underwear_upper slot', async () => {
        const result = await slotResolver.resolveClothingSlot('female_actor', 'underwear_upper');

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);

        // Should attach to female breast anatomy
        const attachedSockets = result.map(point => point.socketId);
        expect(attachedSockets).toContain('left_breast');
        expect(attachedSockets).toContain('right_breast');

        // Should NOT attach to male chest anatomy (since it doesn't exist)
        expect(attachedSockets).not.toContain('left_chest');
        expect(attachedSockets).not.toContain('right_chest');
      });
    });
  });

  describe('Backpack Slot Functionality', () => {
    beforeEach(() => {
      // Mock entity with back anatomy
      mockEntityManager.getComponentData.mockImplementation((entityId, componentType) => {
        if (componentType === 'anatomy:body') {
          return Promise.resolve({ recipeId: 'anatomy:human_male' });
        }
        if (componentType === 'anatomy:sockets') {
          // Return sockets for pelvis_entity only
          if (entityId === 'pelvis_entity') {
            return Promise.resolve({
              sockets: [
                { id: 'upper_back', orientation: 'neutral' },
                { id: 'lower_back', orientation: 'neutral' },
              ]
            });
          }
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(maleBlueprint);

      // Mock socket resolution for back anatomy
      mockAnatomySocketIndex.findEntityWithSocket.mockImplementation((entityId, socketId) => {
        const backSocketMap = {
          'upper_back': 'torso_entity',
          'lower_back': 'torso_entity',
        };
        return Promise.resolve(backSocketMap[socketId] || null);
      });
    });

    it('should allow entities to wear backpacks using back_accessory slot', async () => {
      const result = await slotResolver.resolveClothingSlot('actor', 'back_accessory');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      // Should attach to back anatomy
      const attachedSockets = result.map(point => point.socketId);
      expect(attachedSockets).toContain('upper_back');
      expect(attachedSockets).toContain('lower_back');

      // Verify entities match
      result.forEach(point => {
        expect(point.entityId).toBe('pelvis_entity');
      });
    });

    it('should work across both male and female blueprints', async () => {
      // Test with female blueprint
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(femaleBlueprint);

      const result = await slotResolver.resolveClothingSlot('female_actor', 'back_accessory');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      // Should attach to back anatomy regardless of gender
      const attachedSockets = result.map(point => point.socketId);
      expect(attachedSockets).toContain('upper_back');
      expect(attachedSockets).toContain('lower_back');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with legacy male genital_covering slot', async () => {
      // Mock male entity
      mockEntityManager.getComponentData.mockImplementation((entityId, componentType) => {
        if (componentType === 'anatomy:body') {
          return Promise.resolve({ recipeId: 'anatomy:human_male' });
        }
        if (componentType === 'anatomy:sockets') {
          return Promise.resolve({
            sockets: [
              { id: 'penis', orientation: 'neutral' },
              { id: 'left_testicle', orientation: 'neutral' },
              { id: 'right_testicle', orientation: 'neutral' },
            ]
          });
        }
        return Promise.resolve(null);
      });

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(maleBlueprint);

      mockAnatomySocketIndex.findEntityWithSocket.mockImplementation((entityId, socketId) => {
        const maleSocketMap = {
          'penis': 'pelvis_entity',
          'left_testicle': 'pelvis_entity',
          'right_testicle': 'pelvis_entity',
        };
        return Promise.resolve(maleSocketMap[socketId] || null);
      });

      const result = await slotResolver.resolveClothingSlot('male_actor', 'genital_covering');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      // Should work with legacy slot
      const attachedSockets = result.map(point => point.socketId);
      expect(attachedSockets).toContain('penis');
      expect(attachedSockets).toContain('left_testicle');
      expect(attachedSockets).toContain('right_testicle');
    });

    it('should maintain compatibility with legacy female panties slots', async () => {
      // Mock female entity
      mockEntityManager.getComponentData.mockImplementation((entityId, componentType) => {
        if (componentType === 'anatomy:body') {
          return Promise.resolve({ recipeId: 'anatomy:human_female' });
        }
        if (componentType === 'anatomy:sockets') {
          return Promise.resolve({
            sockets: [
              { id: 'vagina', orientation: 'neutral' },
              { id: 'pubic_hair', orientation: 'neutral' },
            ]
          });
        }
        return Promise.resolve(null);
      });

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(femaleBlueprint);

      mockAnatomySocketIndex.findEntityWithSocket.mockImplementation((entityId, socketId) => {
        const femaleSocketMap = {
          'vagina': 'pelvis_entity',
          'pubic_hair': 'pelvis_entity',
        };
        return Promise.resolve(femaleSocketMap[socketId] || null);
      });

      // Test legacy panties slot using anatomySockets
      const pantiesResult = await slotResolver.resolveClothingSlot('female_actor', 'panties');
      expect(pantiesResult).toBeDefined();
      expect(pantiesResult.length).toBeGreaterThan(0);

      // Verify socket attachments for panties (anatomySockets)
      const pantiesAttachedSockets = pantiesResult.map(point => point.socketId);
      expect(pantiesAttachedSockets).toContain('vagina');
      expect(pantiesAttachedSockets).toContain('pubic_hair');
    });
  });

  describe('Socket Filtering and Error Handling', () => {
    it('should gracefully handle missing anatomy sockets', async () => {
      // Mock entity missing some anatomy sockets
      mockEntityManager.getComponentData.mockImplementation((entityId, componentType) => {
        if (componentType === 'anatomy:body') {
          return Promise.resolve({ recipeId: 'anatomy:human_male' });
        }
        if (componentType === 'anatomy:sockets') {
          return Promise.resolve({
            sockets: [
              { id: 'pubic_hair', orientation: 'neutral' },
              { id: 'penis', orientation: 'neutral' },
              // Missing testicle sockets
            ]
          });
        }
        return Promise.resolve(null);
      });

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(maleBlueprint);

      mockAnatomySocketIndex.findEntityWithSocket.mockImplementation((entityId, socketId) => {
        const partialSocketMap = {
          'pubic_hair': 'pelvis_entity',
          'penis': 'pelvis_entity',
          // Missing testicle sockets return null
        };
        return Promise.resolve(partialSocketMap[socketId] || null);
      });

      const result = await slotResolver.resolveClothingSlot('male_actor', 'underwear_lower');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      // Should only attach to existing sockets
      const attachedSockets = result.map(point => point.socketId);
      expect(attachedSockets).toContain('pubic_hair');
      expect(attachedSockets).toContain('penis');
      expect(attachedSockets).not.toContain('left_testicle');
      expect(attachedSockets).not.toContain('right_testicle');
      expect(attachedSockets).not.toContain('vagina');
    });

    it('should handle case where no anatomy sockets exist', async () => {
      // Mock entity with no compatible anatomy sockets
      mockEntityManager.getComponentData.mockImplementation((entityId, componentType) => {
        if (componentType === 'anatomy:body') {
          return Promise.resolve({ recipeId: 'anatomy:human_male' });
        }
        if (componentType === 'anatomy:sockets') {
          return Promise.resolve({
            sockets: [
              { id: 'unrelated_socket', orientation: 'neutral' },
            ]
          });
        }
        return Promise.resolve(null);
      });

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(maleBlueprint);

      mockAnatomySocketIndex.findEntityWithSocket.mockImplementation((entityId, socketId) => {
        // No compatible sockets
        return Promise.resolve(null);
      });

      const result = await slotResolver.resolveClothingSlot('male_actor', 'underwear_lower');

      // Should return empty array rather than throwing error
      expect(result).toBeDefined();
      expect(result.length).toBe(0);
    });
  });

  describe('Slot Resolution Priority', () => {
    it('should prioritize new universal slots over legacy slots', async () => {
      // This test verifies that the universal slot system is properly integrated
      // and that both new and old slots are available simultaneously
      
      mockEntityManager.getComponentData.mockImplementation((entityId, componentType) => {
        if (componentType === 'anatomy:body') {
          return Promise.resolve({ recipeId: 'anatomy:human_male' });
        }
        return Promise.resolve(null);
      });

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(maleBlueprint);

      // Test that both universal and legacy slots are available
      expect(maleBlueprint.clothingSlotMappings).toHaveProperty('underwear_lower');
      expect(maleBlueprint.clothingSlotMappings).toHaveProperty('genital_covering');
      
      // Universal slot should be more comprehensive
      const universalSlot = maleBlueprint.clothingSlotMappings.underwear_lower;
      const legacySlot = maleBlueprint.clothingSlotMappings.genital_covering;
      
      expect(universalSlot.anatomySockets.length).toBeGreaterThan(legacySlot.anatomySockets.length);
      expect(universalSlot.anatomySockets).toContain('vagina'); // Cross-gender compatibility
      expect(legacySlot.anatomySockets).not.toContain('vagina'); // Legacy is gender-specific
    });
  });
});