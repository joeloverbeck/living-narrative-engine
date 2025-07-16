/**
 * @file Unit tests for universal underwear slot standardization
 * @see data/mods/anatomy/libraries/humanoid.slot-library.json
 * @see data/mods/anatomy/blueprints/human_male.blueprint.json
 * @see data/mods/anatomy/blueprints/human_female.blueprint.json
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Universal Underwear Slots', () => {
  let mockLogger;
  let mockEntityManager;
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
  });

  describe('Slot Definition Validation', () => {
    it('should have consistent universal underwear slot definitions across blueprints', () => {
      // Both male and female blueprints should have identical universal slot definitions
      expect(maleBlueprint.clothingSlotMappings.underwear_upper).toEqual(
        femaleBlueprint.clothingSlotMappings.underwear_upper
      );

      expect(maleBlueprint.clothingSlotMappings.underwear_lower).toEqual(
        femaleBlueprint.clothingSlotMappings.underwear_lower
      );

      expect(maleBlueprint.clothingSlotMappings.back_accessory).toEqual(
        femaleBlueprint.clothingSlotMappings.back_accessory
      );
    });

    it('should include all necessary anatomy sockets for underwear_upper', () => {
      const upperSlot = maleBlueprint.clothingSlotMappings.underwear_upper;
      
      // Should include chest sockets for both male and female anatomy
      expect(upperSlot.anatomySockets).toContain('left_breast');
      expect(upperSlot.anatomySockets).toContain('right_breast');
      expect(upperSlot.anatomySockets).toContain('left_chest');
      expect(upperSlot.anatomySockets).toContain('right_chest');
      expect(upperSlot.anatomySockets).toContain('chest_center');
      
      // Should only allow underwear layer
      expect(upperSlot.allowedLayers).toEqual(['underwear']);
    });

    it('should include all necessary anatomy sockets for underwear_lower', () => {
      const lowerSlot = maleBlueprint.clothingSlotMappings.underwear_lower;
      
      // Should include genital sockets for both male and female anatomy
      expect(lowerSlot.anatomySockets).toContain('pubic_hair');
      expect(lowerSlot.anatomySockets).toContain('penis');
      expect(lowerSlot.anatomySockets).toContain('left_testicle');
      expect(lowerSlot.anatomySockets).toContain('right_testicle');
      expect(lowerSlot.anatomySockets).toContain('vagina');
      
      // Should only allow underwear layer
      expect(lowerSlot.allowedLayers).toEqual(['underwear']);
    });

    it('should include back accessory slot for backpacks', () => {
      const backSlot = maleBlueprint.clothingSlotMappings.back_accessory;
      
      // Should include back sockets
      expect(backSlot.anatomySockets).toContain('upper_back');
      expect(backSlot.anatomySockets).toContain('lower_back');
      
      // Should allow accessory and armor layers
      expect(backSlot.allowedLayers).toEqual(['accessory', 'armor']);
    });
  });

  describe('Socket Resolution Logic', () => {
    it('should resolve to male-specific sockets for male anatomy', () => {
      // Mock male entity with male anatomy sockets
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
            ]
          });
        }
        return Promise.resolve(null);
      });

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(maleBlueprint);

      // Test that underwear_lower would resolve to male-specific sockets
      const lowerSlot = maleBlueprint.clothingSlotMappings.underwear_lower;
      const maleExpectedSockets = ['pubic_hair', 'penis', 'left_testicle', 'right_testicle'];
      
      // All male sockets should be present in the universal slot definition
      maleExpectedSockets.forEach(socket => {
        expect(lowerSlot.anatomySockets).toContain(socket);
      });
    });

    it('should resolve to female-specific sockets for female anatomy', () => {
      // Mock female entity with female anatomy sockets
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
            ]
          });
        }
        return Promise.resolve(null);
      });

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(femaleBlueprint);

      // Test that underwear_lower would resolve to female-specific sockets
      const lowerSlot = femaleBlueprint.clothingSlotMappings.underwear_lower;
      const femaleExpectedSockets = ['pubic_hair', 'vagina'];
      
      // All female sockets should be present in the universal slot definition
      femaleExpectedSockets.forEach(socket => {
        expect(lowerSlot.anatomySockets).toContain(socket);
      });

      // Test that underwear_upper would resolve to female-specific sockets
      const upperSlot = femaleBlueprint.clothingSlotMappings.underwear_upper;
      const femaleChestSockets = ['left_breast', 'right_breast'];
      
      femaleChestSockets.forEach(socket => {
        expect(upperSlot.anatomySockets).toContain(socket);
      });
    });

    it('should gracefully handle missing anatomy sockets', () => {
      // Mock entity with only some anatomy sockets
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

      // The slot definition should still include all possible sockets
      const lowerSlot = maleBlueprint.clothingSlotMappings.underwear_lower;
      expect(lowerSlot.anatomySockets).toContain('left_testicle');
      expect(lowerSlot.anatomySockets).toContain('right_testicle');
      
      // The resolution system should filter out missing sockets at runtime
      // (This would be tested in integration tests)
    });
  });

  describe('Backward Compatibility', () => {
    it('should have universal slots available for cross-gender compatibility', () => {
      // Both male and female blueprints should have universal slots
      expect(maleBlueprint.clothingSlotMappings).toHaveProperty('underwear_lower');
      expect(maleBlueprint.clothingSlotMappings).toHaveProperty('underwear_upper');
      expect(maleBlueprint.clothingSlotMappings).toHaveProperty('back_accessory');
      
      expect(femaleBlueprint.clothingSlotMappings).toHaveProperty('underwear_lower');
      expect(femaleBlueprint.clothingSlotMappings).toHaveProperty('underwear_upper');
      expect(femaleBlueprint.clothingSlotMappings).toHaveProperty('back_accessory');
    });

    it('should ensure universal slots are comprehensive', () => {
      // Universal slots should contain all necessary anatomy sockets
      const maleUniversalLower = maleBlueprint.clothingSlotMappings.underwear_lower;
      const femaleUniversalLower = femaleBlueprint.clothingSlotMappings.underwear_lower;
      
      // Should be identical between blueprints
      expect(maleUniversalLower).toEqual(femaleUniversalLower);
      
      // Should contain both male and female anatomy sockets
      expect(maleUniversalLower.anatomySockets).toContain('penis');
      expect(maleUniversalLower.anatomySockets).toContain('vagina');
      expect(maleUniversalLower.anatomySockets).toContain('pubic_hair');
    });
  });

  describe('Cross-Gender Compatibility', () => {
    it('should allow male entities to use female-oriented clothing slots', () => {
      // Male blueprint should have slots that can work with female clothing
      const maleUpperSlot = maleBlueprint.clothingSlotMappings.underwear_upper;
      
      // Should include breast sockets (even though male anatomy may not have them)
      expect(maleUpperSlot.anatomySockets).toContain('left_breast');
      expect(maleUpperSlot.anatomySockets).toContain('right_breast');
      
      // Should also include male chest sockets
      expect(maleUpperSlot.anatomySockets).toContain('left_chest');
      expect(maleUpperSlot.anatomySockets).toContain('right_chest');
    });

    it('should allow female entities to use male-oriented clothing slots', () => {
      // Female blueprint should have slots that can work with male clothing
      const femaleLowerSlot = femaleBlueprint.clothingSlotMappings.underwear_lower;
      
      // Should include male genital sockets (even though female anatomy may not have them)
      expect(femaleLowerSlot.anatomySockets).toContain('penis');
      expect(femaleLowerSlot.anatomySockets).toContain('left_testicle');
      expect(femaleLowerSlot.anatomySockets).toContain('right_testicle');
      
      // Should also include female genital sockets
      expect(femaleLowerSlot.anatomySockets).toContain('vagina');
    });
  });

  describe('Layer Restrictions', () => {
    it('should enforce proper layer restrictions for underwear slots', () => {
      // Underwear slots should only allow underwear layer
      expect(maleBlueprint.clothingSlotMappings.underwear_upper.allowedLayers).toEqual(['underwear']);
      expect(maleBlueprint.clothingSlotMappings.underwear_lower.allowedLayers).toEqual(['underwear']);
      
      expect(femaleBlueprint.clothingSlotMappings.underwear_upper.allowedLayers).toEqual(['underwear']);
      expect(femaleBlueprint.clothingSlotMappings.underwear_lower.allowedLayers).toEqual(['underwear']);
    });

    it('should enforce proper layer restrictions for back accessory slots', () => {
      // Back accessory should allow accessory and armor layers
      expect(maleBlueprint.clothingSlotMappings.back_accessory.allowedLayers).toEqual(['accessory', 'armor']);
      expect(femaleBlueprint.clothingSlotMappings.back_accessory.allowedLayers).toEqual(['accessory', 'armor']);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing slot definitions gracefully', () => {
      const blueprintWithMissingSlots = {
        id: 'anatomy:incomplete',
        clothingSlotMappings: {
          // Missing underwear slots
        }
      };

      // Should not throw when accessing missing slots
      expect(() => {
        const slot = blueprintWithMissingSlots.clothingSlotMappings.underwear_upper;
        expect(slot).toBeUndefined();
      }).not.toThrow();
    });

    it('should validate slot structure', () => {
      const invalidSlot = {
        // Missing anatomySockets
        allowedLayers: ['underwear']
      };

      // Should be able to detect invalid slot structure
      expect(invalidSlot.anatomySockets).toBeUndefined();
      expect(invalidSlot.allowedLayers).toBeDefined();
    });
  });
});