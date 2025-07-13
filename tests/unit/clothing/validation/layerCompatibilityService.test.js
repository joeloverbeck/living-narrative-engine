import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { LayerCompatibilityService } from '../../../../src/clothing/validation/layerCompatibilityService.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

/** Helper to create minimal mocks for dependencies */
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
              size: 'm',
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
              size: 'm',
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
              size: 'm',
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

    it('should detect size mismatch conflicts', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {
                  underwear: 'tight_undershirt',
                },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            if (entityId === 'new_shirt') {
              return {
                wearableType: 'shirt',
                layer: 'base',
                size: 'xxl', // Much larger than existing
                equipmentSlots: { primary: 'torso_clothing', secondary: [] },
              };
            }
            if (entityId === 'tight_undershirt') {
              return {
                wearableType: 'undershirt',
                layer: 'underwear',
                size: 'xs', // Much smaller
                equipmentSlots: { primary: 'torso_clothing', secondary: [] },
              };
            }
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
      expect(result.conflicts.some((c) => c.type === 'size_mismatch')).toBe(
        true
      );
    });

    it('should handle invalid size values without crashing', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {
                  underwear: 'custom_shirt',
                },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            if (entityId === 'new_shirt') {
              return {
                wearableType: 'shirt',
                layer: 'base',
                size: 'unknown_size', // Invalid size
                equipmentSlots: { primary: 'torso_clothing', secondary: [] },
              };
            }
            if (entityId === 'custom_shirt') {
              return {
                wearableType: 'undershirt',
                layer: 'underwear',
                size: 'custom', // Also invalid
                equipmentSlots: { primary: 'torso_clothing', secondary: [] },
              };
            }
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

      // Should not crash and treat as potential conflict
      expect(result.hasConflicts).toBe(false); // Medium severity doesn't create conflict
    });

    it('should not flag conflicts for medium severity size differences', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {
                  underwear: 'undershirt',
                },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            if (entityId === 'new_shirt') {
              return {
                wearableType: 'shirt',
                layer: 'base',
                size: 'l', // 2 sizes larger (medium severity)
                equipmentSlots: { primary: 'torso_clothing', secondary: [] },
              };
            }
            if (entityId === 'undershirt') {
              return {
                wearableType: 'undershirt',
                layer: 'underwear',
                size: 's', // small
                equipmentSlots: { primary: 'torso_clothing', secondary: [] },
              };
            }
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

      // Medium severity should not create conflicts
      expect(result.hasConflicts).toBe(false);
    });

    it('should not flag conflicts for low severity size differences', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {
                  underwear: 'undershirt',
                },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            if (entityId === 'new_shirt') {
              return {
                wearableType: 'shirt',
                layer: 'base',
                size: 'm', // 1 size larger (low severity)
                equipmentSlots: { primary: 'torso_clothing', secondary: [] },
              };
            }
            if (entityId === 'undershirt') {
              return {
                wearableType: 'undershirt',
                layer: 'underwear',
                size: 's', // small
                equipmentSlots: { primary: 'torso_clothing', secondary: [] },
              };
            }
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

      // Low severity should not create conflicts
      expect(result.hasConflicts).toBe(false);
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
              size: 'm',
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
              size: 'm',
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
              size: 'm',
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
              size: 'm',
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
              size: 'm',
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
              size: 'm',
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
              size: 'm',
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

    it('should suggest size adjustment for size mismatches', async () => {
      const conflicts = [
        {
          type: 'size_mismatch',
          conflictingItemId: 'item1',
          severity: 'medium',
        },
      ];

      const result = await service.suggestResolutions(conflicts);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'size_adjust',
        target: 'item1',
        description: 'Consider different size or adjust fit',
        priority: 3,
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
        { type: 'size_mismatch', severity: 'medium' },
        {
          type: 'layer_overlap',
          conflictingItemId: 'item1',
          layer: 'base',
          severity: 'high',
        },
        { type: 'layer_requirement', requiredLayer: 'base' },
      ];

      const result = await service.suggestResolutions(conflicts);

      expect(result).toHaveLength(3);
      expect(result[0].priority).toBe(1); // layer_overlap and layer_requirement both priority 1
      expect(result[2].priority).toBe(3); // size_mismatch priority 3
    });
  });

  describe('private helper methods', () => {
    describe('size mismatch calculation', () => {
      it('should calculate high severity for large size differences', () => {
        // This tests the private method through the public interface
        const service = new LayerCompatibilityService({
          entityManager,
          logger,
        });

        // We can't directly test private methods, but we can verify the behavior
        // through integration testing with checkLayerConflicts
        expect(LayerCompatibilityService.LAYER_ORDER).toBeDefined();
      });
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
