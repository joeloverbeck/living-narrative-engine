import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { EquipmentOrchestrator } from '../../../../src/clothing/orchestration/equipmentOrchestrator.js';

/** Helper to create minimal mocks for dependencies */
function createMocks() {
  return {
    entityManager: {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
    },
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    eventDispatcher: {
      dispatch: jest.fn(),
    },
    layerCompatibilityService: {
      checkLayerConflicts: jest.fn(),
      findDependentItems: jest.fn(),
    },
  };
}

describe('EquipmentOrchestrator - Edge Cases', () => {
  let entityManager;
  let logger;
  let eventDispatcher;
  let layerCompatibilityService;
  let orchestrator;

  beforeEach(() => {
    ({ entityManager, logger, eventDispatcher, layerCompatibilityService } =
      createMocks());

    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService,
    });
  });

  describe('orchestrateEquipment - Error Handling', () => {
    it('should handle basic validation failure - entity not found', async () => {
      entityManager.getEntityInstance.mockReturnValue(null);

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'nonexistent',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Entity 'nonexistent' not found");
    });

    it('should handle basic validation failure - clothing item not found', async () => {
      entityManager.getEntityInstance
        .mockReturnValueOnce({ id: 'entity1' }) // Entity exists
        .mockReturnValueOnce(null); // Clothing item doesn't exist

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'nonexistent_item',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Clothing item 'nonexistent_item' not found"
      );
    });

    it('should handle basic validation failure - item not wearable', async () => {
      entityManager.getEntityInstance.mockReturnValue({ id: 'entity1' });
      entityManager.getComponentData.mockReturnValue(null); // No wearable component

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'not_wearable',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Item 'not_wearable' is not wearable");
    });

    it('should handle auto_remove conflict resolution failure', async () => {
      entityManager.getEntityInstance.mockReturnValue({ id: 'entity1' });
      entityManager.getComponentData
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        })
        .mockReturnValueOnce(null) // No equipment data for unequip during conflict resolution
        .mockReturnValueOnce(null); // No equipment data for final equipment

      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: true,
        conflicts: [{ conflictingItemId: 'existing_shirt' }],
      });

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'new_shirt',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Item 'new_shirt' is not wearable");
    });

    it('should handle exception in conflict resolution', async () => {
      entityManager.getEntityInstance.mockReturnValue({ id: 'entity1' });
      entityManager.getComponentData.mockReturnValue({
        layer: 'base',
        equipmentSlots: { primary: 'torso_clothing' },
      });
      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: true,
        conflicts: [{ itemId: 'existing_shirt' }], // Using itemId instead of conflictingItemId
      });

      // This will trigger the undefined itemId path in auto_remove
      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'new_shirt',
      });

      expect(result.success).toBe(false);
    });

    it('should handle equipment operation failure', async () => {
      entityManager.getEntityInstance.mockReturnValue({ id: 'entity1' });
      entityManager.getComponentData
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        })
        .mockReturnValueOnce(null); // No existing equipment for mock

      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: false,
        conflicts: [],
      });
      entityManager.addComponent.mockImplementation(() => {
        throw new Error('Equipment storage failed');
      });

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Item 'shirt1' is not wearable");
    });

    it('should handle top-level exception in orchestrateEquipment', async () => {
      entityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Database connection failed');
      expect(logger.error).toHaveBeenCalledWith(
        "EquipmentOrchestrator: Error orchestrating equipment for 'shirt1' on 'entity1'",
        { error: expect.any(Error) }
      );
    });
  });

  describe('orchestrateUnequipment - Error Handling', () => {
    it('should handle item not currently equipped', async () => {
      entityManager.getComponentData.mockReturnValue({
        equipped: {
          torso_clothing: {
            base: 'different_shirt',
          },
        },
      });

      const result = await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Item is not currently equipped');
    });

    it('should handle no equipment data found', async () => {
      entityManager.getComponentData.mockReturnValue(null);

      const result = await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Item is not currently equipped');
    });

    it('should handle cascade unequip failure', async () => {
      entityManager.getComponentData.mockReturnValue({
        equipped: {
          torso_clothing: {
            base: 'shirt1',
            outer: 'dependent_jacket',
          },
        },
      });
      layerCompatibilityService.findDependentItems.mockResolvedValue([
        'dependent_jacket',
      ]);

      // Make cascade unequip fail (mock no equipment for dependent item)
      entityManager.getComponentData
        .mockReturnValueOnce({
          equipped: {
            torso_clothing: {
              base: 'shirt1',
              outer: 'dependent_jacket',
            },
          },
        })
        .mockReturnValueOnce(null); // No equipment for dependent item

      const result = await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
        cascadeUnequip: true,
      });

      // Should still succeed for target item even if cascade fails
      expect(result.success).toBe(true);
      expect(result.cascadeItems).toEqual(['dependent_jacket']);
    });

    it('should handle target unequipment failure', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({
          equipped: {
            torso_clothing: {
              base: 'shirt1',
            },
          },
        })
        .mockReturnValueOnce(null); // No equipment data for target unequip

      const result = await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No equipment data found');
    });

    it('should handle top-level exception in orchestrateUnequipment', async () => {
      entityManager.getComponentData.mockImplementation(() => {
        throw new Error('Database error during unequip');
      });

      const result = await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Database error during unequip');
      expect(logger.error).toHaveBeenCalledWith(
        "EquipmentOrchestrator: Error orchestrating unequipment for 'shirt1' from 'entity1'",
        { error: expect.any(Error) }
      );
    });
  });

  describe('validateEquipmentCompatibility - Error Handling', () => {
    it('should handle basic validation errors in compatibility check', async () => {
      entityManager.getEntityInstance.mockReturnValue(null);
      entityManager.getComponentData.mockReturnValue(null); // This will cause the error

      const result = await orchestrator.validateEquipmentCompatibility({
        entityId: 'nonexistent',
        clothingItemId: 'shirt1',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Entity 'nonexistent' not found");
    });

    it('should handle exception in compatibility validation', async () => {
      entityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Compatibility check failed');
      });

      const result = await orchestrator.validateEquipmentCompatibility({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Compatibility check failed');
      expect(logger.error).toHaveBeenCalledWith(
        "EquipmentOrchestrator: Error validating compatibility for 'shirt1' on 'entity1'",
        { error: expect.any(Error) }
      );
    });

    it('should handle layer service throwing error', async () => {
      entityManager.getEntityInstance.mockReturnValue({ id: 'entity1' });
      entityManager.getComponentData.mockReturnValue({
        layer: 'base',
        equipmentSlots: { primary: 'torso_clothing' },
      });
      layerCompatibilityService.checkLayerConflicts.mockRejectedValue(
        new Error('Layer service unavailable')
      );

      const result = await orchestrator.validateEquipmentCompatibility({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Layer service unavailable');
    });
  });

  describe('Additional branch coverage scenarios', () => {
    beforeEach(() => {
      entityManager.getEntityInstance.mockImplementation((id) => ({ id }));
    });

    it('returns an error when a wearable item lacks a primary equipment slot', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({ wearable: true })
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: {},
        });

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity-1',
        clothingItemId: 'vest-1',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Item 'vest-1' has invalid equipment slot configuration"
      );
      expect(eventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('surfaces layer requirement conflicts with helpful messaging', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({ wearable: true })
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso' },
        });
      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: true,
        conflicts: [
          {
            type: 'layer_requirement',
            requiredLayer: 'inner',
            details: 'Requires inner layer support',
          },
        ],
      });

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity-2',
        clothingItemId: 'coat-1',
      });

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.errors).toContain(
        'Cannot equip item: Requires inner layer support'
      );
    });

    it('reports conflicts that omit the conflicting item identifier', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({ wearable: true })
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso' },
        });
      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: true,
        conflicts: [
          {
            type: 'slot_overlap',
          },
        ],
      });

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity-3',
        clothingItemId: 'cloak-1',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Cannot resolve conflict: No item specified for slot_overlap conflict'
      );
    });

    it('captures unexpected errors while removing conflicts', async () => {
      let firstAccess = true;
      const conflict = {
        type: 'slot_overlap',
        get conflictingItemId() {
          if (firstAccess) {
            firstAccess = false;
            throw new Error('Transient datastore failure');
          }
          return 'belt-1';
        },
      };

      entityManager.getComponentData
        .mockReturnValueOnce({ wearable: true })
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'waist' },
        });
      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: true,
        conflicts: [conflict],
      });

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity-4',
        clothingItemId: 'belt-2',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Error removing conflicting item 'belt-1': Transient datastore failure"
      );
    });

    it('notes when a conflicting item cannot be found during removal', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({ wearable: true })
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso' },
        })
        .mockReturnValueOnce({
          equipped: {
            torso: {
              base: 'different-item',
            },
          },
        });
      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: true,
        conflicts: [
          {
            type: 'slot_overlap',
            conflictingItemId: 'missing-item',
          },
        ],
      });

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity-5',
        clothingItemId: 'vest-2',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Failed to remove conflicting item 'missing-item'"
      );
    });
  });

  describe('Conflict Resolution Edge Cases', () => {
    it('should handle multiple conflicts in auto_remove with mixed success', async () => {
      entityManager.getEntityInstance.mockReturnValue({ id: 'entity1' });
      entityManager.getComponentData
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        })
        .mockReturnValueOnce(null); // This will fail the validation

      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: true,
        conflicts: [
          { conflictingItemId: 'conflict1' },
          { conflictingItemId: 'conflict2' },
        ],
      });

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'new_shirt',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Item 'new_shirt' is not wearable");
    });

    it('should handle conflict resolution throwing exception', async () => {
      entityManager.getEntityInstance.mockReturnValue({ id: 'entity1' });
      entityManager.getComponentData.mockReturnValue({
        layer: 'base',
        equipmentSlots: { primary: 'torso_clothing' },
      });
      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: true,
        conflicts: [{ conflictingItemId: 'existing_shirt' }],
      });

      // Mock an exception during conflict resolution
      entityManager.getComponentData.mockImplementationOnce(() => {
        throw new Error('Conflict resolution database error');
      });

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'new_shirt',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Conflict resolution database error');
    });
  });

  describe('Equipment Data Edge Cases', () => {
    it('should handle missing equipment component during equipment', async () => {
      // Setup entity instances
      entityManager.getEntityInstance
        .mockReturnValueOnce({ id: 'entity1' }) // Entity exists
        .mockReturnValueOnce({ id: 'shirt1' }); // Clothing item exists

      // Setup component data calls
      entityManager.getComponentData
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // Wearable component for validation
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // Wearable component for getting clothing data
        .mockReturnValueOnce(null); // No existing equipment component

      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: false,
        conflicts: [],
      });

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(true);
      expect(entityManager.addComponent).toHaveBeenCalledWith(
        'entity1',
        'clothing:equipment',
        {
          equipped: {
            torso_clothing: {
              base: 'shirt1',
            },
          },
        }
      );
    });

    it('should handle missing equipment slot during equipment', async () => {
      // Setup entity instances
      entityManager.getEntityInstance
        .mockReturnValueOnce({ id: 'entity1' }) // Entity exists
        .mockReturnValueOnce({ id: 'shirt1' }); // Clothing item exists

      // Setup component data calls
      entityManager.getComponentData
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // Wearable component for validation
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // Wearable component for getting clothing data
        .mockReturnValueOnce({
          equipped: {}, // No slot yet
        });

      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: false,
        conflicts: [],
      });

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(true);
      expect(entityManager.addComponent).toHaveBeenCalledWith(
        'entity1',
        'clothing:equipment',
        {
          equipped: {
            torso_clothing: {
              base: 'shirt1',
            },
          },
        }
      );
    });
  });
});
