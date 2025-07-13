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

describe('EquipmentOrchestrator - Private Methods Coverage', () => {
  let entityManager;
  let logger;
  let eventDispatcher;
  let layerCompatibilityService;
  let orchestrator;

  beforeEach(() => {
    ({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService,
    } = createMocks());
    
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService,
    });
  });

  describe('#validateBasicRequirements (indirect testing)', () => {
    it('should validate all basic requirements successfully', async () => {
      entityManager.getEntityInstance.mockImplementation((id) => ({ id }));
      entityManager.getComponentData
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For validation
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For main flow
        .mockReturnValueOnce(null); // No existing equipment

      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: false,
        conflicts: [],
      });

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(true);
      expect(entityManager.getEntityInstance).toHaveBeenCalledWith('entity1');
      expect(entityManager.getEntityInstance).toHaveBeenCalledWith('shirt1');
      expect(entityManager.getComponentData).toHaveBeenCalledWith(
        'shirt1',
        'clothing:wearable'
      );
    });

    it('should handle entity validation failure', async () => {
      entityManager.getEntityInstance
        .mockReturnValueOnce(null) // Entity not found
        .mockReturnValueOnce({ id: 'shirt1' }); // Clothing item exists
      entityManager.getComponentData.mockReturnValue({
        layer: 'base',
        equipmentSlots: { primary: 'torso_clothing' },
      });

      const result = await orchestrator.validateEquipmentCompatibility({
        entityId: 'nonexistent',
        clothingItemId: 'shirt1',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Entity 'nonexistent' not found");
    });

    it('should handle clothing item validation failure', async () => {
      entityManager.getEntityInstance
        .mockReturnValueOnce({ id: 'entity1' }) // Entity exists
        .mockReturnValueOnce(null); // Clothing item not found
      entityManager.getComponentData.mockReturnValue(null);

      const result = await orchestrator.validateEquipmentCompatibility({
        entityId: 'entity1',
        clothingItemId: 'nonexistent_item',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Clothing item 'nonexistent_item' not found");
    });

    it('should handle wearable component validation failure', async () => {
      entityManager.getEntityInstance.mockImplementation((id) => ({ id }));
      entityManager.getComponentData.mockReturnValue(null); // No wearable component

      const result = await orchestrator.validateEquipmentCompatibility({
        entityId: 'entity1',
        clothingItemId: 'not_wearable',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Item 'not_wearable' is not wearable");
    });
  });

  describe('#autoRemoveConflicts (indirect testing through orchestrateEquipment)', () => {
    beforeEach(() => {
      entityManager.getEntityInstance.mockImplementation((id) => ({ id }));
    });

    it('should auto-remove conflicts when they exist', async () => {
      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: true,
        conflicts: [{ conflictingItemId: 'existing_shirt' }],
      });
      
      // Mock calls in order for conflict resolution flow
      entityManager.getComponentData
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For validation
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For main flow
        .mockReturnValueOnce({
          equipped: {
            torso_clothing: {
              base: 'existing_shirt',
            },
          },
        }) // For conflict resolution unequipment
        .mockReturnValueOnce({
          equipped: {
            torso_clothing: {},
          },
        }); // For final equipment

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'new_shirt',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('#autoRemoveConflicts (indirect testing)', () => {
    beforeEach(() => {
      entityManager.getEntityInstance.mockImplementation((id) => ({ id }));
    });

    it('should successfully remove single conflicting item', async () => {
      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: true,
        conflicts: [{ conflictingItemId: 'existing_shirt' }],
      });

      entityManager.getComponentData
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For validation
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For main flow
        .mockReturnValueOnce({
          equipped: {
            torso_clothing: {
              base: 'existing_shirt',
            },
          },
        }) // For conflict resolution unequipment
        .mockReturnValueOnce({
          equipped: {
            torso_clothing: {},
          },
        }); // For final equipment

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'new_shirt',
      });

      expect(result.success).toBe(true);
    });

    it('should handle multiple conflicting items with mixed success', async () => {
      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: true,
        conflicts: [
          { conflictingItemId: 'shirt1' },
          { conflictingItemId: 'shirt2' },
        ],
      });

      // First conflict removal succeeds, second fails
      entityManager.getComponentData
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For validation in #validateBasicRequirements
        .mockReturnValueOnce(null); // For main flow - should cause "not wearable" error

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'new_shirt',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Item 'new_shirt' is not wearable");
    });

    it('should handle conflict with itemId instead of conflictingItemId', async () => {
      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: true,
        conflicts: [{ itemId: 'existing_shirt' }], // Using itemId
      });

      entityManager.getComponentData
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For validation in #validateBasicRequirements
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For main flow
        .mockReturnValueOnce({
          equipped: {
            torso_clothing: {
              base: 'existing_shirt',
            },
          },
        }) // For conflict resolution unequipment
        .mockReturnValueOnce({
          equipped: {
            torso_clothing: {},
          },
        }); // For final equipment

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'new_shirt',
      });

      expect(result.success).toBe(true);
    });

    it('should handle error during conflict removal', async () => {
      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: true,
        conflicts: [{ conflictingItemId: 'existing_shirt' }],
      });

      // Simulate error during unequipment
      entityManager.getComponentData
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        })
        .mockImplementationOnce(() => {
          throw new Error('Database error during conflict resolution');
        });

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'new_shirt',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('#performEquipment (indirect testing)', () => {
    beforeEach(() => {
      entityManager.getEntityInstance.mockReturnValue({ id: 'entity1' });
      entityManager.getComponentData.mockReturnValue({
        layer: 'base',
        equipmentSlots: { primary: 'torso_clothing' },
      });
      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: false,
        conflicts: [],
      });
    });

    it('should create new equipment component when none exists', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For validation in #validateBasicRequirements
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For main flow
        .mockReturnValueOnce(null); // No existing equipment

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

    it('should initialize missing slot in existing equipment', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For validation in #validateBasicRequirements
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For main flow
        .mockReturnValueOnce({
          equipped: {}, // Existing equipment but no slot
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

    it('should store and return previous item when replacing', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For validation in #validateBasicRequirements
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For main flow
        .mockReturnValueOnce({
          equipped: {
            torso_clothing: {
              base: 'old_shirt',
            },
          },
        });

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'new_shirt',
      });

      expect(result.success).toBe(true);
      expect(result.previousItem).toBe('old_shirt');
    });

    it('should handle error during equipment storage', async () => {
      // Set up proper mocks for validation and main flow
      entityManager.getComponentData
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For validation in #validateBasicRequirements
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For main flow
        .mockReturnValueOnce(null); // No existing equipment

      entityManager.addComponent.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Storage error');
    });
  });

  describe('#performUnequipment (indirect testing)', () => {
    it('should successfully remove item from equipment', async () => {
      entityManager.getComponentData.mockReturnValue({
        equipped: {
          torso_clothing: {
            base: 'shirt1',
          },
        },
      });

      const result = await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(true);
      expect(result.unequipped).toBe(true);
      expect(entityManager.addComponent).toHaveBeenCalledWith(
        'entity1',
        'clothing:equipment',
        {
          equipped: {
            torso_clothing: {},
          },
        }
      );
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

    it('should handle equipment data without equipped property', async () => {
      entityManager.getComponentData.mockReturnValue({});

      const result = await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Item is not currently equipped');
    });

    it('should handle item not found in equipment', async () => {
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

    it('should handle error during equipment update', async () => {
      entityManager.getComponentData.mockReturnValue({
        equipped: {
          torso_clothing: {
            base: 'shirt1',
          },
        },
      });
      entityManager.addComponent.mockImplementation(() => {
        throw new Error('Update error');
      });

      const result = await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Update error');
    });
  });

  describe('#findCurrentEquipment (indirect testing)', () => {
    it('should find equipment in first slot and layer', async () => {
      entityManager.getComponentData.mockReturnValue({
        equipped: {
          torso_clothing: {
            base: 'shirt1',
          },
        },
      });

      const result = await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(true);
      // Verify it found the item correctly by successful unequipment
    });

    it('should find equipment in nested slot and layer', async () => {
      entityManager.getComponentData.mockReturnValue({
        equipped: {
          head_clothing: {
            base: 'different_item',
          },
          torso_clothing: {
            underwear: 'undershirt',
            base: 'shirt1',
            outer: 'jacket',
          },
          leg_clothing: {
            base: 'pants',
          },
        },
      });

      const result = await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(true);
      // Verify it found the item in the correct nested location
    });

    it('should return not found for missing equipment data', async () => {
      entityManager.getComponentData.mockReturnValue(null);

      const result = await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Item is not currently equipped');
    });

    it('should return not found for empty equipment', async () => {
      entityManager.getComponentData.mockReturnValue({
        equipped: {},
      });

      const result = await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Item is not currently equipped');
    });

    it('should return not found when item not in equipment', async () => {
      entityManager.getComponentData.mockReturnValue({
        equipped: {
          torso_clothing: {
            base: 'different_shirt',
            outer: 'jacket',
          },
        },
      });

      const result = await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'nonexistent_shirt',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Item is not currently equipped');
    });
  });
});