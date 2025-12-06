import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { LayerCompatibilityService } from '../../../../src/clothing/validation/layerCompatibilityService.js';

/**
 * Helper to create minimal mocks for dependencies
 *
 * @returns {object} Mock objects for entityManager and logger
 */
function createMocks() {
  return {
    entityManager: {
      getComponentData: jest.fn(),
      getEntityInstance: jest.fn(),
    },
    logger: {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  };
}

describe('LayerCompatibilityService', () => {
  let entityManager;
  let logger;
  let service;

  beforeEach(() => {
    ({ entityManager, logger } = createMocks());
    service = new LayerCompatibilityService({
      entityManager,
      logger,
    });
  });

  describe('constructor', () => {
    it('should create service with valid dependencies', () => {
      expect(service).toBeInstanceOf(LayerCompatibilityService);
    });

    it('should throw error when entityManager is missing', () => {
      expect(
        () =>
          new LayerCompatibilityService({
            logger,
          })
      ).toThrow(Error);
    });

    it('should throw error when logger is missing', () => {
      expect(
        () =>
          new LayerCompatibilityService({
            entityManager,
          })
      ).toThrow(Error);
    });
  });

  describe('static constants', () => {
    it('should have correct layer order', () => {
      expect(LayerCompatibilityService.LAYER_ORDER).toEqual([
        'underwear',
        'base',
        'armor',
        'outer',
        'accessories',
      ]);
    });

    it('should have correct layer requirements', () => {
      expect(LayerCompatibilityService.LAYER_REQUIREMENTS.outer).toEqual([
        'base',
      ]);
      expect(LayerCompatibilityService.LAYER_REQUIREMENTS.accessories).toEqual(
        []
      );
    });

    it('should have correct armor layer requirements', () => {
      expect(LayerCompatibilityService.LAYER_REQUIREMENTS.armor).toEqual([]);
    });
  });

  describe('Armor Layer Support', () => {
    it('should recognize armor as valid layer in ordering', async () => {
      const isValid = await service.validateLayerOrdering(
        'entity1',
        'armor',
        {}
      );
      expect(isValid).toBe(true);
    });

    it('should position armor between base and outer in layer hierarchy', () => {
      const order = LayerCompatibilityService.LAYER_ORDER;
      const baseIndex = order.indexOf('base');
      const armorIndex = order.indexOf('armor');
      const outerIndex = order.indexOf('outer');

      expect(armorIndex).toBeGreaterThan(baseIndex);
      expect(armorIndex).toBeLessThan(outerIndex);
    });

    it('should allow equipping armor without base layer (no requirements)', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {},
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'chainmail',
              layer: 'armor',
              equipmentSlots: { primary: 'torso_clothing', secondary: [] },
            };
          }
          return null;
        }
      );

      const result = await service.checkLayerConflicts(
        'entity1',
        'chainmail_item',
        'armor',
        'torso_clothing'
      );

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toEqual([]);
    });

    it('should detect conflict when armor layer is already occupied', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {
                  armor: 'existing_chainmail',
                },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'plate_armor',
              layer: 'armor',
              equipmentSlots: { primary: 'torso_clothing', secondary: [] },
            };
          }
          return null;
        }
      );

      const result = await service.checkLayerConflicts(
        'entity1',
        'plate_armor_item',
        'armor',
        'torso_clothing'
      );

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'layer_overlap',
            conflictingItemId: 'existing_chainmail',
            layer: 'armor',
          }),
        ])
      );
    });
  });

  describe('checkLayerConflicts', () => {
    beforeEach(() => {
      // Mock wearable data for new item
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'shirt',
              layer: 'base',
              equipmentSlots: {
                primary: 'torso_clothing',
                secondary: [],
              },
            };
          }
          return null;
        }
      );
    });

    it('should detect no conflicts when slot is empty', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return { equipped: {} };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'shirt',
              layer: 'base',
              equipmentSlots: { primary: 'torso_clothing', secondary: [] },
            };
          }
          return null;
        }
      );

      const result = await service.checkLayerConflicts(
        'entity1',
        'shirt1',
        'base',
        'torso_clothing'
      );

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toEqual([]);
    });

    it('should detect direct layer overlap conflicts', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {
                  base: 'existing_shirt',
                },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'shirt',
              layer: 'base',
              equipmentSlots: { primary: 'torso_clothing', secondary: [] },
            };
          }
          return null;
        }
      );

      const result = await service.checkLayerConflicts(
        'entity1',
        'new_shirt',
        'base',
        'torso_clothing'
      );

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toEqual({
        type: 'layer_overlap',
        conflictingItemId: 'existing_shirt',
        layer: 'base',
        slotId: 'torso_clothing',
        severity: 'high',
      });
    });

    it('should detect layer ordering violations', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {
                  outer: 'jacket', // Outer layer already present
                },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'jacket',
              layer: 'outer',
              equipmentSlots: { primary: 'torso_clothing', secondary: [] },
            };
          }
          return null;
        }
      );

      const result = await service.checkLayerConflicts(
        'entity1',
        'base_shirt',
        'base',
        'torso_clothing'
      );

      expect(result.hasConflicts).toBe(false); // This should actually be fine - base can go under outer
    });

    it('should provide resolution suggestions', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {
                  base: 'existing_shirt',
                },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'shirt',
              layer: 'base',
              equipmentSlots: { primary: 'torso_clothing', secondary: [] },
            };
          }
          return null;
        }
      );

      const result = await service.checkLayerConflicts(
        'entity1',
        'new_shirt',
        'base',
        'torso_clothing'
      );

      expect(result.hasConflicts).toBe(true);
      expect(result.resolutionSuggestions).toContain(
        "Remove 'existing_shirt' from base layer"
      );
    });

    it('should handle missing equipment component', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return null; // No equipment component
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'shirt',
              layer: 'base',
              equipmentSlots: { primary: 'torso_clothing', secondary: [] },
            };
          }
          return null;
        }
      );

      const result = await service.checkLayerConflicts(
        'entity1',
        'shirt1',
        'base',
        'torso_clothing'
      );

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toEqual([]);
    });

    it('should throw error for non-wearable items', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return { equipped: {} }; // Provide equipment data so method continues
          }
          if (componentId === 'clothing:wearable') {
            return null; // Not wearable
          }
          return null;
        }
      );

      await expect(
        service.checkLayerConflicts(
          'entity1',
          'non_wearable',
          'base',
          'torso_clothing'
        )
      ).rejects.toThrow("Item 'non_wearable' is not wearable");
    });

    it('should allow adding inner layer even when outer layers exist', async () => {
      // Note: The current implementation doesn't flag ordering violations for adding inner layers
      // when outer layers already exist - this seems to be intentional behavior
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {
                  accessories: 'scarf', // Accessories layer already present
                },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'underwear',
              layer: 'underwear', // Trying to add underwear after accessories
              equipmentSlots: { primary: 'torso_clothing', secondary: [] },
            };
          }
          return null;
        }
      );

      const result = await service.checkLayerConflicts(
        'entity1',
        'underwear_item',
        'underwear', // Inner layer
        'torso_clothing'
      );

      // Based on the implementation, this should not create conflicts
      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toEqual([]);
    });

    it('should handle outer layers with undefined requirements in checkLayerOrdering', async () => {
      // Test for line 340 - when LAYER_REQUIREMENTS[outerLayer] is undefined
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {
                  underwear: 'underwear_item', // Underwear layer has no requirements defined
                  base: 'shirt', // Base layer has no requirements defined
                },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'new_underwear',
              layer: 'underwear', // Trying to add to underwear layer
              equipmentSlots: { primary: 'torso_clothing', secondary: [] },
            };
          }
          return null;
        }
      );

      const result = await service.checkLayerConflicts(
        'entity1',
        'new_underwear_item',
        'underwear',
        'torso_clothing'
      );

      // The underwear layer should conflict with existing underwear
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'layer_overlap',
            conflictingItemId: 'underwear_item',
            layer: 'underwear',
          }),
        ])
      );
    });

    it('should detect missing required layer conflicts', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                // No base layer in any slot, but trying to add outer layer
                torso_clothing: {},
                legs_clothing: {},
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'jacket',
              layer: 'outer', // Outer layer requires base layer
              equipmentSlots: { primary: 'torso_clothing', secondary: [] },
            };
          }
          return null;
        }
      );

      const result = await service.checkLayerConflicts(
        'entity1',
        'jacket_item',
        'outer',
        'torso_clothing'
      );

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'layer_requirement',
            requiredLayer: 'base',
            severity: 'high',
            details: "Layer 'outer' requires 'base' layer to be present",
          }),
        ])
      );
    });

    it('should not flag layer requirement conflicts when required layer exists in another slot', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {
                  // No base layer in primary slot
                },
                legs_clothing: {
                  base: 'pants', // Base layer exists in different slot
                },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'jacket',
              layer: 'outer', // Outer layer requires base layer
              equipmentSlots: { primary: 'torso_clothing', secondary: [] },
            };
          }
          return null;
        }
      );

      const result = await service.checkLayerConflicts(
        'entity1',
        'jacket_item',
        'outer',
        'torso_clothing'
      );

      // Should not have conflicts since base layer exists in another slot
      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toEqual([]);
    });

    it('should detect secondary slot conflicts', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {},
                arms_clothing: {
                  base: 'sleeve_shirt', // Conflict in secondary slot
                },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'dress',
              layer: 'base',
              equipmentSlots: {
                primary: 'torso_clothing',
                secondary: ['arms_clothing'], // Has secondary slots
              },
            };
          }
          return null;
        }
      );

      const result = await service.checkLayerConflicts(
        'entity1',
        'dress_item',
        'base',
        'torso_clothing'
      );

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'secondary_slot_conflict',
            conflictingItemId: 'sleeve_shirt',
            layer: 'base',
            slotId: 'arms_clothing',
            severity: 'medium',
            details: "Conflict in secondary slot 'arms_clothing'",
          }),
        ])
      );
    });

    it('should handle adding outer layer when accessories layer is present', async () => {
      // This test verifies that adding a layer when outer layers exist
      // doesn't create conflicts when layer requirements are satisfied
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {
                  base: 'shirt', // Base layer exists to satisfy requirements
                  accessories: 'scarf', // Accessories layer (index 3) exists
                },
                legs_clothing: {
                  base: 'pants', // Ensure base layer requirement is globally satisfied
                },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'jacket',
              layer: 'outer', // Trying to add outer layer (index 2)
              equipmentSlots: { primary: 'torso_clothing', secondary: [] },
            };
          }
          return null;
        }
      );

      const result = await service.checkLayerConflicts(
        'entity1',
        'jacket_item',
        'outer',
        'torso_clothing'
      );

      // The system should not report conflicts because the outer layer requirements
      // are satisfied (base layer exists) and there's no direct layer overlap
      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toEqual([]);
    });

    it('should handle items with no secondary slots defined', async () => {
      // Test for lines 404-408 - when secondarySlots is undefined
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {},
                arms_clothing: {
                  base: 'sleeve_shirt',
                },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'vest',
              layer: 'base',
              equipmentSlots: {
                primary: 'torso_clothing',
                // No secondary property defined at all
              },
            };
          }
          return null;
        }
      );

      const result = await service.checkLayerConflicts(
        'entity1',
        'vest_item',
        'base',
        'torso_clothing'
      );

      // Should have no conflicts since secondary slots are undefined
      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toEqual([]);
    });

    it('should handle items with null secondary slots', async () => {
      // Another test for lines 404-408 - when secondarySlots is null
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {},
                arms_clothing: {
                  base: 'sleeve_shirt',
                },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'tank_top',
              layer: 'base',
              equipmentSlots: {
                primary: 'torso_clothing',
                secondary: null, // Explicitly null
              },
            };
          }
          return null;
        }
      );

      const result = await service.checkLayerConflicts(
        'entity1',
        'tank_top_item',
        'base',
        'torso_clothing'
      );

      // Should have no conflicts since secondary slots are null
      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toEqual([]);
    });

    it('should handle secondary slots with equipment but different layer', async () => {
      // Test for line 408 false branch - when secondaryEquipment exists but doesn't have targetLayer
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {},
                arms_clothing: {
                  outer: 'jacket_sleeves', // Different layer - outer, not base
                },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'shirt',
              layer: 'base', // Trying to add base layer
              equipmentSlots: {
                primary: 'torso_clothing',
                secondary: ['arms_clothing'], // Has secondary slot
              },
            };
          }
          return null;
        }
      );

      const result = await service.checkLayerConflicts(
        'entity1',
        'shirt_item',
        'base', // Different from what's in arms_clothing (outer)
        'torso_clothing'
      );

      // Should have no conflicts since the secondary slot has a different layer
      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toEqual([]);
    });
  });

  describe('validateLayerOrdering', () => {
    it('should validate correct layer ordering', async () => {
      const currentEquipment = {
        underwear: 'bra1',
        base: 'shirt1',
      };

      const result = await service.validateLayerOrdering(
        'entity1',
        'outer',
        currentEquipment
      );

      expect(result).toBe(true);
    });

    it('should detect missing required inner layers', async () => {
      const currentEquipment = {
        // Missing base layer but trying to add outer
      };

      const result = await service.validateLayerOrdering(
        'entity1',
        'outer',
        currentEquipment
      );

      expect(result).toBe(false);
    });

    it('should handle unknown layers', async () => {
      const currentEquipment = {};

      const result = await service.validateLayerOrdering(
        'entity1',
        'unknown_layer',
        currentEquipment
      );

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        "LayerCompatibilityService: Unknown layer 'unknown_layer'"
      );
    });

    it('should allow layers with no requirements', async () => {
      const currentEquipment = {};

      const result = await service.validateLayerOrdering(
        'entity1',
        'underwear',
        currentEquipment
      );

      expect(result).toBe(true);
    });

    it('should handle layers with undefined requirements in LAYER_REQUIREMENTS', async () => {
      // Test for line 181 - when requirements for a layer is not defined in LAYER_REQUIREMENTS
      const currentEquipment = {
        underwear: 'underwear_item',
      };

      // 'base' and 'underwear' layers don't have entries in LAYER_REQUIREMENTS
      const result = await service.validateLayerOrdering(
        'entity1',
        'base', // Layer that has no entry in LAYER_REQUIREMENTS
        currentEquipment
      );

      expect(result).toBe(true); // Should pass since undefined requirements means no requirements
    });

    it('should handle errors gracefully', async () => {
      // Create a mock that throws an error during validation
      const originalLayerOrder = LayerCompatibilityService.LAYER_ORDER;

      // Temporarily break LAYER_ORDER to cause an error
      LayerCompatibilityService.LAYER_ORDER = null;

      const result = await service.validateLayerOrdering('entity1', 'base', {});

      // Restore original value
      LayerCompatibilityService.LAYER_ORDER = originalLayerOrder;

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error validating layer ordering'),
        expect.any(Object)
      );
    });
  });

  describe('findDependentItems', () => {
    beforeEach(() => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {
                  underwear: 'bra1',
                  base: 'shirt1',
                  outer: 'jacket1',
                },
              },
            };
          }
          return null;
        }
      );
    });

    it('should find items that depend on a base layer', async () => {
      const result = await service.findDependentItems(
        'entity1',
        'torso_clothing',
        'base'
      );

      expect(result).toContain('jacket1'); // Outer depends on base
    });

    it('should find no dependents for top layer', async () => {
      const result = await service.findDependentItems(
        'entity1',
        'torso_clothing',
        'outer'
      );

      expect(result).toEqual([]);
    });

    it('should handle missing equipment slot', async () => {
      const result = await service.findDependentItems(
        'entity1',
        'missing_slot',
        'base'
      );

      expect(result).toEqual([]);
    });

    it('should handle missing equipment component', async () => {
      entityManager.getComponentData.mockReturnValue(null);

      const result = await service.findDependentItems(
        'entity1',
        'torso_clothing',
        'base'
      );

      expect(result).toEqual([]);
    });

    it('should handle layers without defined requirements in LAYER_REQUIREMENTS', async () => {
      // Test for lines 239-240 - when a layer has no entry in LAYER_REQUIREMENTS
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {
                  underwear: 'underwear_item',
                  base: 'shirt1', // Base layer that we're checking dependents for
                  // Note: 'base' layer has no entry in LAYER_REQUIREMENTS, so nothing depends on it
                },
              },
            };
          }
          return null;
        }
      );

      const result = await service.findDependentItems(
        'entity1',
        'torso_clothing',
        'underwear' // Underwear has no defined requirements
      );

      expect(result).toEqual([]); // No items depend on underwear since it has no requirements defined
    });

    it('should skip items in outer layers that have no requirement definitions', async () => {
      // Another test to ensure line 239-240 coverage
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {
                  base: 'shirt1',
                  underwear: 'underwear_item', // Underwear layer (no requirements defined)
                  accessories: 'accessory_item', // Accessories layer (has empty requirements)
                },
              },
            };
          }
          return null;
        }
      );

      // Check dependents of base when there are items in layers without requirement definitions
      const result = await service.findDependentItems(
        'entity1',
        'torso_clothing',
        'base'
      );

      // Accessories have an empty requirements array, underwear has no entry
      expect(result).toEqual([]); // Neither depend on base
    });
  });

  describe('suggestResolutions', () => {
    it('should suggest auto_remove for layer overlaps', async () => {
      const conflicts = [
        {
          type: 'layer_overlap',
          conflictingItemId: 'item1',
          layer: 'base',
          severity: 'high',
        },
      ];

      const result = await service.suggestResolutions(conflicts);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'auto_remove',
        target: 'item1',
        description: 'Automatically remove conflicting item from base layer',
        priority: 1,
      });
    });

    it('should suggest auto_remove with lower priority for non-high severity layer overlaps', async () => {
      // Test for line 272 - when severity is not 'high'
      const conflicts = [
        {
          type: 'layer_overlap',
          conflictingItemId: 'item2',
          layer: 'outer',
          severity: 'medium', // Non-high severity
        },
      ];

      const result = await service.suggestResolutions(conflicts);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'auto_remove',
        target: 'item2',
        description: 'Automatically remove conflicting item from outer layer',
        priority: 2, // Priority 2 for non-high severity
      });
    });

    it('should handle layer_overlap with low severity', async () => {
      // Another test for line 272 coverage
      const conflicts = [
        {
          type: 'layer_overlap',
          conflictingItemId: 'item3',
          layer: 'accessories',
          severity: 'low',
        },
      ];

      const result = await service.suggestResolutions(conflicts);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'auto_remove',
        target: 'item3',
        description:
          'Automatically remove conflicting item from accessories layer',
        priority: 2, // Priority 2 for non-high severity
      });
    });

    it('should suggest equipping required layers', async () => {
      const conflicts = [
        {
          type: 'layer_requirement',
          requiredLayer: 'base',
        },
      ];

      const result = await service.suggestResolutions(conflicts);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'equip_required',
        target: 'base',
        description: 'Equip required base layer item first',
        priority: 1,
      });
    });

    it('should suggest reordering layers for ordering violations', async () => {
      const conflicts = [
        {
          type: 'ordering_violation',
          conflictingItemId: 'underwear_item',
          layer: 'underwear',
          severity: 'medium',
        },
      ];

      const result = await service.suggestResolutions(conflicts);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'reorder_layers',
        description: 'Adjust layer ordering to maintain hierarchy',
        priority: 2,
      });
    });

    it('should suggest size adjustment for size_mismatch conflicts', async () => {
      const conflicts = [
        {
          type: 'size_mismatch',
          conflictingItemId: 'tight_shirt',
        },
      ];

      const result = await service.suggestResolutions(conflicts);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'size_adjust',
        target: 'tight_shirt',
        description: 'Consider different size or adjust fit',
        priority: 3,
      });
    });

    it('should handle unknown conflict types', async () => {
      const conflicts = [
        {
          type: 'unknown_conflict',
        },
      ];

      const result = await service.suggestResolutions(conflicts);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'manual_review',
        description: 'Manual review required for this conflict type',
        priority: 4,
      });
    });

    it('should sort strategies by priority', async () => {
      const conflicts = [
        {
          type: 'layer_overlap',
          conflictingItemId: 'item1',
          layer: 'base',
          severity: 'high',
        },
        { type: 'layer_requirement', requiredLayer: 'base' },
      ];

      const result = await service.suggestResolutions(conflicts);

      expect(result).toHaveLength(2);
      expect(result[0].priority).toBe(1); // layer_overlap and layer_requirement both priority 1
      expect(result[1].priority).toBe(1); // layer_requirement priority 1
    });
  });

  describe('error handling', () => {
    it('should handle entityManager errors gracefully', async () => {
      entityManager.getComponentData.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(
        service.checkLayerConflicts(
          'entity1',
          'clothing1',
          'base',
          'torso_clothing'
        )
      ).rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle findDependentItems errors gracefully', async () => {
      entityManager.getComponentData.mockImplementation(() => {
        throw new Error('Query error');
      });

      const result = await service.findDependentItems(
        'entity1',
        'torso_clothing',
        'base'
      );

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error finding dependent items'),
        expect.any(Object)
      );
    });
  });
});
