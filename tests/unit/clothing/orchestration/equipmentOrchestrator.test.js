import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { EquipmentOrchestrator } from '../../../../src/clothing/orchestration/equipmentOrchestrator.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

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

describe('EquipmentOrchestrator', () => {
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

  describe('constructor', () => {
    it('should create orchestrator with valid dependencies', () => {
      expect(orchestrator).toBeInstanceOf(EquipmentOrchestrator);
    });

    it('should throw error when entityManager is missing', () => {
      expect(
        () =>
          new EquipmentOrchestrator({
            logger,
            eventDispatcher,
            layerCompatibilityService,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger is missing', () => {
      expect(
        () =>
          new EquipmentOrchestrator({
            entityManager,
            eventDispatcher,
            layerCompatibilityService,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error when eventDispatcher is missing', () => {
      expect(
        () =>
          new EquipmentOrchestrator({
            entityManager,
            logger,
            layerCompatibilityService,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error when layerCompatibilityService is missing', () => {
      expect(
        () =>
          new EquipmentOrchestrator({
            entityManager,
            logger,
            eventDispatcher,
          })
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('orchestrateEquipment', () => {
    beforeEach(() => {
      // Setup default successful responses - each test will override as needed
      entityManager.getEntityInstance.mockImplementation((id) => ({ id }));
      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: false,
        conflicts: [],
      });
    });

    it('should successfully equip clothing item without conflicts', async () => {
      // Setup mock calls in order:
      // 1. validateBasicRequirements calls getComponentData for wearable check
      // 2. main flow calls getComponentData for clothing data
      // 3. performEquipment calls getComponentData for current equipment
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

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(true);
      expect(result.equipped).toBe(true);
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
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        'clothing:equipped',
        expect.objectContaining({
          entityId: 'entity1',
          clothingItemId: 'shirt1',
          slotId: 'torso_clothing',
          layer: 'base',
        })
      );
    });

    it('should use specified layer when provided', async () => {
      // Setup required mocks for the test
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

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'jacket1',
        layer: 'outer',
      });

      expect(result.success).toBe(true);
      expect(
        layerCompatibilityService.checkLayerConflicts
      ).toHaveBeenCalledWith('entity1', 'jacket1', 'outer', 'torso_clothing');
    });

    it('should handle existing equipment and replace item', async () => {
      const existingEquipment = {
        equipped: {
          torso_clothing: {
            base: 'old_shirt',
          },
        },
      };

      entityManager.getComponentData
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For validation
        .mockReturnValueOnce({
          layer: 'base',
          equipmentSlots: { primary: 'torso_clothing' },
        }) // For main flow
        .mockReturnValueOnce(existingEquipment); // For current equipment

      const result = await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'new_shirt',
      });

      expect(result.success).toBe(true);
      expect(result.previousItem).toBe('old_shirt');
    });

    it('should automatically remove conflicts when they exist', async () => {
      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: true,
        conflicts: [
          { conflictingItemId: 'conflicting_shirt', slotId: 'torso_clothing' },
        ],
      });

      // Mock calls in order:
      // 1. validateBasicRequirements - wearable check
      // 2. main flow - clothing data
      // 3. conflict resolution unequipment - find equipment
      // 4. final equipment - current equipment check
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
              base: 'conflicting_shirt',
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

    it('should log debug message at start', async () => {
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

      await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(logger.debug).toHaveBeenCalledWith(
        "EquipmentOrchestrator: Starting equipment orchestration for 'shirt1' on 'entity1'"
      );
    });

    it('should log success message after successful equipment', async () => {
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

      await orchestrator.orchestrateEquipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(logger.debug).toHaveBeenCalledWith(
        "EquipmentOrchestrator: Successfully equipped 'shirt1' on 'entity1' in layer 'base'"
      );
    });
  });

  describe('orchestrateUnequipment', () => {
    beforeEach(() => {
      entityManager.getComponentData.mockReturnValue({
        equipped: {
          torso_clothing: {
            base: 'shirt1',
          },
        },
      });
    });

    it('should successfully unequip clothing item', async () => {
      const result = await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.success).toBe(true);
      expect(result.unequipped).toBe(true);
      expect(result.cascadeItems).toEqual([]);
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        'clothing:unequipped',
        expect.objectContaining({
          entityId: 'entity1',
          clothingItemId: 'shirt1',
          reason: 'manual',
        })
      );
    });

    it('should handle cascade unequipment when requested', async () => {
      layerCompatibilityService.findDependentItems.mockResolvedValue([
        'dependent_jacket',
      ]);

      // Mock equipment data with dependent items
      entityManager.getComponentData.mockReturnValue({
        equipped: {
          torso_clothing: {
            base: 'shirt1',
            outer: 'dependent_jacket',
          },
        },
      });

      const result = await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
        cascadeUnequip: true,
      });

      expect(result.success).toBe(true);
      expect(result.cascadeItems).toEqual(['dependent_jacket']);
      expect(layerCompatibilityService.findDependentItems).toHaveBeenCalledWith(
        'entity1',
        'torso_clothing',
        'base'
      );
    });

    it('should use specified reason for unequipment', async () => {
      await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
        reason: 'forced',
      });

      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        'clothing:unequipped',
        expect.objectContaining({
          reason: 'forced',
        })
      );
    });

    it('should log debug message at start', async () => {
      await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(logger.debug).toHaveBeenCalledWith(
        "EquipmentOrchestrator: Starting unequipment orchestration for 'shirt1' from 'entity1'"
      );
    });

    it('should log success message after successful unequipment', async () => {
      await orchestrator.orchestrateUnequipment({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(logger.debug).toHaveBeenCalledWith(
        "EquipmentOrchestrator: Successfully unequipped 'shirt1' from 'entity1' (cascade: 0)"
      );
    });
  });

  describe('validateEquipmentCompatibility', () => {
    beforeEach(() => {
      entityManager.getEntityInstance.mockReturnValue({ id: 'entity1' });
      entityManager.getComponentData.mockReturnValue({
        layer: 'base',
        equipmentSlots: { primary: 'torso_clothing' },
      });
    });

    it('should validate compatibility successfully without conflicts', async () => {
      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: false,
        conflicts: [],
      });

      const result = await orchestrator.validateEquipmentCompatibility({
        entityId: 'entity1',
        clothingItemId: 'shirt1',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.warnings).toBeUndefined();
      expect(result.compatibility.layers).toEqual({
        hasConflicts: false,
        conflicts: [],
      });
    });

    it('should detect layer conflicts and add warnings', async () => {
      layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
        hasConflicts: true,
        conflicts: [
          { conflictingItemId: 'existing_shirt', slotId: 'torso_clothing' },
        ],
      });

      const result = await orchestrator.validateEquipmentCompatibility({
        entityId: 'entity1',
        clothingItemId: 'new_shirt',
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual(['1 layer conflict(s) detected']);
      expect(result.compatibility.layers.hasConflicts).toBe(true);
    });

    it('should return valid false when basic validation fails', async () => {
      entityManager.getEntityInstance.mockReturnValue(null); // Entity not found

      const result = await orchestrator.validateEquipmentCompatibility({
        entityId: 'nonexistent',
        clothingItemId: 'shirt1',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Entity 'nonexistent' not found");
    });
  });
});
