import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { ClothingManagementService } from '../../../src/clothing/services/clothingManagementService.js';
import { EquipmentOrchestrator } from '../../../src/clothing/orchestration/equipmentOrchestrator.js';
import { LayerCompatibilityService } from '../../../src/clothing/validation/layerCompatibilityService.js';
import { CoverageValidationService } from '../../../src/clothing/validation/coverageValidationService.js';
import AnatomyClothingIntegrationService from '../../../src/anatomy/integration/anatomyClothingIntegrationService.js';

/**
 * Integration tests for the clothing system
 *
 * These tests verify the complete workflow from clothing management service
 * through orchestration and validation services to ensure proper integration.
 */

/**
 * Helper to create a complete mock environment for integration testing
 *
 * @returns {object} Complete mock environment with entityManager, logger, eventDispatcher and mock data
 */
function createIntegrationMocks() {
  const mockAnatomyData = {
    entity1: {
      'anatomy:body': {
        body: {
          root: 'torso1',
          parts: { torso: 'torso1' },
        },
      },
    },
    entity2: {
      'anatomy:body': {
        body: {
          root: 'torso2',
          parts: { torso: 'torso2' },
        },
      },
    },
  };

  const mockClothingData = {
    shirt1: {
      'clothing:wearable': {
        wearableType: 'shirt',
        layer: 'base',
        coverage: {
          required: ['left_chest', 'right_chest'],
          optional: ['left_shoulder', 'right_shoulder'],
          exclusions: [],
        },
        size: 'm',
        material: 'cotton',
        equipmentSlots: {
          primary: 'torso_clothing',
        },
        layerPriority: 3,
        conflictResolution: 'auto_remove',
      },
    },
    jacket1: {
      'clothing:wearable': {
        wearableType: 'jacket',
        layer: 'outer',
        coverage: {
          required: ['left_chest', 'right_chest'],
          optional: ['left_shoulder', 'right_shoulder'],
          exclusions: [],
        },
        size: 'm',
        material: 'polyester',
        equipmentSlots: {
          primary: 'torso_clothing',
        },
        layerPriority: 7,
        conflictResolution: 'auto_remove',
      },
    },
    underwear1: {
      'clothing:wearable': {
        wearableType: 'underwear',
        layer: 'underwear',
        coverage: {
          required: ['left_hip', 'right_hip'],
          optional: ['penis', 'vagina'],
          exclusions: [],
        },
        size: 'm',
        material: 'cotton',
        equipmentSlots: {
          primary: 'lower_torso_clothing',
        },
        layerPriority: 1,
        conflictResolution: 'auto_remove',
      },
    },
  };

  const mockEntityData = {
    entity1: {},
    entity2: {},
  };

  const mockEquipmentData = {
    entity1: {
      'clothing:equipment': {
        equipped: {},
        maxLayers: {
          torso_clothing: 3,
          lower_torso_clothing: 2,
        },
      },
    },
    entity2: {
      'clothing:equipment': {
        equipped: {},
        maxLayers: {
          torso_clothing: 3,
          lower_torso_clothing: 2,
        },
      },
    },
  };

  const entityManager = {
    getComponentData: jest.fn((entityId, componentId) => {
      // Return anatomy data
      if (mockAnatomyData[entityId] && mockAnatomyData[entityId][componentId]) {
        return mockAnatomyData[entityId][componentId];
      }

      // Return clothing wearable data
      if (
        mockClothingData[entityId] &&
        mockClothingData[entityId][componentId]
      ) {
        return mockClothingData[entityId][componentId];
      }

      // Return equipment data
      if (
        mockEquipmentData[entityId] &&
        mockEquipmentData[entityId][componentId]
      ) {
        return mockEquipmentData[entityId][componentId];
      }

      return null;
    }),

    setComponentData: jest.fn((entityId, componentId, data) => {
      if (!mockEquipmentData[entityId]) {
        mockEquipmentData[entityId] = {};
      }
      mockEquipmentData[entityId][componentId] = data;
      return Promise.resolve();
    }),

    getEntityInstance: jest.fn((entityId) => {
      // Check if it's a regular entity
      if (mockEntityData[entityId] !== undefined) {
        return {
          instanceId: entityId,
          definitionId: `def_${entityId}`,
          getComponentData: (componentId) =>
            entityManager.getComponentData(entityId, componentId),
        };
      }

      // Check if it's a clothing item (has clothing:wearable component)
      if (mockClothingData[entityId]) {
        return {
          instanceId: entityId,
          definitionId: `def_${entityId}`,
          getComponentData: (componentId) =>
            entityManager.getComponentData(entityId, componentId),
        };
      }

      return null;
    }),

    getComponent: jest.fn((entityId, componentId) => {
      return entityManager.getComponentData(entityId, componentId)
        ? { data: entityManager.getComponentData(entityId, componentId) }
        : null;
    }),

    hasComponent: jest.fn((entityId, componentId) => {
      return entityManager.getComponentData(entityId, componentId) !== null;
    }),
  };

  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const eventDispatcher = {
    dispatch: jest.fn().mockResolvedValue(true),
  };

  return {
    entityManager,
    logger,
    eventDispatcher,
    mockAnatomyData,
    mockClothingData,
    mockEntityData,
    mockEquipmentData,
  };
}

describe('ClothingSystem Integration', () => {
  let clothingService;
  let orchestrator;
  let layerService;
  let coverageService;
  let anatomyClothingIntegration;
  let mocks;

  beforeEach(() => {
    mocks = createIntegrationMocks();

    // Create service instances with mocked dependencies
    layerService = new LayerCompatibilityService({
      entityManager: mocks.entityManager,
      logger: mocks.logger,
    });

    coverageService = new CoverageValidationService({
      entityManager: mocks.entityManager,
      logger: mocks.logger,
      eventDispatcher: mocks.eventDispatcher,
    });

    orchestrator = new EquipmentOrchestrator({
      entityManager: mocks.entityManager,
      logger: mocks.logger,
      eventDispatcher: mocks.eventDispatcher,
      layerCompatibilityService: layerService,
      coverageValidationService: coverageService,
    });

    // Create mock anatomy clothing integration service
    anatomyClothingIntegration = new AnatomyClothingIntegrationService({
      logger: mocks.logger,
      entityManager: mocks.entityManager,
      bodyGraphService: {
        getBodyGraph: jest.fn().mockResolvedValue({ root: 'torso1' }),
      },
      blueprintLoader: {
        load: jest.fn().mockResolvedValue({
          id: 'anatomy:human_male',
          root: 'anatomy:human_male_torso',
          clothingSlotMappings: {
            torso_clothing: {
              anatomySockets: ['left_chest', 'right_chest'],
              allowedLayers: ['underwear', 'base', 'outer'],
              layerOrder: ['underwear', 'base', 'outer'],
              defaultLayer: 'base',
            },
          },
        }),
      },
      recipeLoader: {
        load: jest.fn(),
      },
    });

    clothingService = new ClothingManagementService({
      entityManager: mocks.entityManager,
      logger: mocks.logger,
      eventDispatcher: mocks.eventDispatcher,
      equipmentOrchestrator: orchestrator,
      anatomyClothingIntegrationService: anatomyClothingIntegration,
    });
  });

  describe('Basic Equipment Workflow', () => {
    it('should successfully equip a shirt on an entity with proper anatomy', async () => {
      const result = await clothingService.equipClothing('entity1', 'shirt1');

      if (!result.success) {
        console.error('Equipment failed:', result.errors);
        console.error('Full result:', JSON.stringify(result, null, 2));
      }

      expect(result.success).toBe(true);
      expect(result.equipped).toBe(true);

      // Verify the item was added to equipment component
      const equipmentData = mocks.entityManager.getComponentData(
        'entity1',
        'clothing:equipment'
      );
      expect(equipmentData.equipped.torso_clothing.base).toBe('shirt1');

      // Verify event was dispatched
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledWith({
        type: 'clothing_equipped',
        payload: expect.objectContaining({
          entityId: 'entity1',
          clothingItemId: 'shirt1',
          slotId: 'torso_clothing',
          layer: 'base',
        }),
      });
    });

    it('should successfully unequip clothing from an entity', async () => {
      // First equip an item
      await clothingService.equipClothing('entity1', 'shirt1');

      // Then unequip it
      const result = await clothingService.unequipClothing('entity1', 'shirt1');

      if (!result.success) {
        console.error('Unequipment failed:', result.errors);
      }

      expect(result.success).toBe(true);
      expect(result.unequipped).toBe(true);

      // Verify the item was removed from equipment component
      const equipmentData = mocks.entityManager.getComponentData(
        'entity1',
        'clothing:equipment'
      );
      expect(equipmentData.equipped.torso_clothing.base).toBeUndefined();

      // Verify event was dispatched
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledWith({
        type: 'clothing_unequipped',
        payload: expect.objectContaining({
          entityId: 'entity1',
          clothingItemId: 'shirt1',
          reason: 'manual',
        }),
      });
    });
  });

  describe('Layer Management', () => {
    it('should handle layering correctly with underwear, base, and outer layers', async () => {
      // Equip underwear first
      const underwearResult = await clothingService.equipClothing(
        'entity1',
        'underwear1'
      );

      if (!underwearResult.success) {
        console.error('Underwear equipment failed:', underwearResult.errors);
      }

      expect(underwearResult.success).toBe(true);

      // Equip base layer (shirt)
      const shirtResult = await clothingService.equipClothing(
        'entity1',
        'shirt1'
      );
      expect(shirtResult.success).toBe(true);

      // Equip outer layer (jacket)
      const jacketResult = await clothingService.equipClothing(
        'entity1',
        'jacket1'
      );
      expect(jacketResult.success).toBe(true);

      // Verify all layers are equipped correctly
      const equipmentData = mocks.entityManager.getComponentData(
        'entity1',
        'clothing:equipment'
      );
      expect(equipmentData.equipped.lower_torso_clothing.underwear).toBe(
        'underwear1'
      );
      expect(equipmentData.equipped.torso_clothing.base).toBe('shirt1');
      expect(equipmentData.equipped.torso_clothing.outer).toBe('jacket1');
    });

    it('should auto-remove conflicting items when conflict resolution is set to auto_remove', async () => {
      // Equip first shirt
      await clothingService.equipClothing('entity1', 'shirt1');

      // Mock a second shirt that would conflict
      mocks.mockClothingData['shirt2'] = {
        'clothing:wearable': {
          wearableType: 'shirt',
          layer: 'base',
          coverage: {
            required: ['left_chest', 'right_chest'],
            optional: [],
            exclusions: [],
          },
          size: 'm',
          material: 'polyester',
          equipmentSlots: {
            primary: 'torso_clothing',
          },
          layerPriority: 3,
          conflictResolution: 'auto_remove',
        },
      };

      // Equip second shirt - should auto-remove first shirt
      const result = await clothingService.equipClothing('entity1', 'shirt2');

      if (!result.success) {
        console.error('Auto-remove conflict failed:', result.errors);
        console.error('Full result:', JSON.stringify(result, null, 2));
      }

      expect(result.success).toBe(true);

      // Verify only the second shirt remains
      const equipmentData = mocks.entityManager.getComponentData(
        'entity1',
        'clothing:equipment'
      );
      expect(equipmentData.equipped.torso_clothing.base).toBe('shirt2');
    });
  });

  describe('Coverage Validation Integration', () => {
    it('should validate anatomy coverage before equipping', async () => {
      // Test equipment with missing required anatomy parts
      mocks.mockClothingData['wings'] = {
        'clothing:wearable': {
          wearableType: 'wings',
          layer: 'accessories',
          coverage: {
            required: ['left_wing', 'right_wing'], // Parts that don't exist
            optional: [],
            exclusions: [],
          },
          size: 'm',
          equipmentSlots: {
            primary: 'back_clothing',
          },
        },
      };

      const result = await clothingService.equipClothing('entity1', 'wings');

      if (result.success) {
        console.error(
          'Wings equipment should have failed but succeeded:',
          result
        );
      }

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Required body part 'left_wing' is not available"
      );
      expect(result.errors).toContain(
        "Required body part 'right_wing' is not available"
      );
    });

    it('should validate exclusions properly', async () => {
      // Mock clothing that excludes existing anatomy
      mocks.mockClothingData['prosthetic_arm'] = {
        'clothing:wearable': {
          wearableType: 'prosthetic',
          layer: 'base',
          coverage: {
            required: ['left_shoulder'],
            optional: [],
            exclusions: ['left_arm'], // Conflicts with natural arm
          },
          size: 'm',
          equipmentSlots: {
            primary: 'left_arm_clothing',
          },
        },
      };

      const result = await clothingService.equipClothing(
        'entity1',
        'prosthetic_arm'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Clothing cannot be worn with 'left_arm' present"
      );
    });
  });

  describe('Transfer Clothing Workflow', () => {
    it('should transfer clothing between entities successfully', async () => {
      // Equip shirt on entity1
      await clothingService.equipClothing('entity1', 'shirt1');

      // Transfer to entity2
      const result = await clothingService.transferClothing(
        'entity1',
        'entity2',
        'shirt1'
      );

      if (!result.success) {
        console.error('Transfer failed:', result.errors);
      }

      expect(result.success).toBe(true);
      expect(result.transferred).toBe(true);

      // Verify item was removed from entity1
      const entity1Equipment = mocks.entityManager.getComponentData(
        'entity1',
        'clothing:equipment'
      );
      expect(entity1Equipment.equipped.torso_clothing?.base).toBeUndefined();

      // Verify item was added to entity2
      const entity2Equipment = mocks.entityManager.getComponentData(
        'entity2',
        'clothing:equipment'
      );
      expect(entity2Equipment.equipped.torso_clothing.base).toBe('shirt1');
    });

    it('should handle failed transfer by re-equipping on source', async () => {
      // Equip shirt on entity1
      await clothingService.equipClothing('entity1', 'shirt1');

      // Mock entity2 to fail equipment (no anatomy)
      const originalImplementation =
        mocks.entityManager.getComponentData.getMockImplementation();
      mocks.entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'entity2' && componentId === 'anatomy:body') {
            return null; // No anatomy
          }
          return originalImplementation(entityId, componentId);
        }
      );

      const result = await clothingService.transferClothing(
        'entity1',
        'entity2',
        'shirt1'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Failed to equip on target: Entity has no anatomy data'
      );

      // Verify item was re-equipped on entity1
      const entity1Equipment = mocks.entityManager.getComponentData(
        'entity1',
        'clothing:equipment'
      );
      expect(entity1Equipment.equipped.torso_clothing.base).toBe('shirt1');
    });
  });

  describe('Compatibility Validation', () => {
    it('should validate equipment compatibility comprehensively', async () => {
      const result = await clothingService.validateCompatibility(
        'entity1',
        'shirt1'
      );

      expect(result.valid).toBe(true);
      expect(result.compatibility).toBeDefined();
      expect(result.compatibility.coverage).toBeDefined();
      expect(result.compatibility.layers).toBeDefined();
    });

    it('should detect multiple types of incompatibilities', async () => {
      // Mock problematic clothing
      mocks.mockClothingData['problematic_item'] = {
        'clothing:wearable': {
          wearableType: 'special',
          layer: 'base',
          coverage: {
            required: ['missing_part'],
            optional: [],
            exclusions: ['left_chest'], // Conflicts with available part
          },
          size: 'xs', // Size mismatch
          equipmentSlots: {
            primary: 'torso_clothing',
          },
        },
      };

      const result = await clothingService.validateCompatibility(
        'entity1',
        'problematic_item'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Required body part 'missing_part' is not available"
      );
      expect(result.errors).toContain(
        "Clothing cannot be worn with 'left_chest' present"
      );
    });
  });

  describe('Equipment State Management', () => {
    it('should get equipped items correctly', async () => {
      // Equip multiple items
      await clothingService.equipClothing('entity1', 'underwear1');
      await clothingService.equipClothing('entity1', 'shirt1');

      const result = await clothingService.getEquippedItems('entity1');

      expect(result.success).toBe(true);
      expect(result.equipped.lower_torso_clothing.underwear).toBe('underwear1');
      expect(result.equipped.torso_clothing.base).toBe('shirt1');
    });

    it('should handle entities with no equipment gracefully', async () => {
      const result = await clothingService.getEquippedItems('entity2');

      expect(result.success).toBe(true);
      expect(result.equipped).toEqual({});
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing entities gracefully', async () => {
      const result = await clothingService.equipClothing(
        'missing_entity',
        'shirt1'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Entity 'missing_entity' not found");
    });

    it('should handle missing clothing items gracefully', async () => {
      const result = await clothingService.equipClothing(
        'entity1',
        'missing_item'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Clothing item 'missing_item' not found");
    });

    it('should handle non-wearable items gracefully', async () => {
      // Mock a non-wearable item
      mocks.mockClothingData['not_wearable'] = {
        'core:name': { text: 'Not Wearable' },
        // Missing clothing:wearable component
      };

      const result = await clothingService.equipClothing(
        'entity1',
        'not_wearable'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Item 'not_wearable' is not wearable");
    });
  });

  describe('Event System Integration', () => {
    it('should dispatch all appropriate events during equipment workflow', async () => {
      await clothingService.equipClothing('entity1', 'shirt1');

      // Should dispatch clothing_equipped event
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledWith({
        type: 'clothing_equipped',
        payload: expect.objectContaining({
          entityId: 'entity1',
          clothingItemId: 'shirt1',
        }),
      });

      // Should dispatch coverage validation event
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledWith({
        type: 'clothing_coverage_validated',
        payload: expect.objectContaining({
          entityId: 'entity1',
          clothingItemId: 'shirt1',
        }),
      });
    });

    it('should dispatch conflict events when conflicts occur', async () => {
      // Equip first item
      await clothingService.equipClothing('entity1', 'shirt1');

      // Clear previous event calls
      mocks.eventDispatcher.dispatch.mockClear();

      // Mock another shirt to create conflict
      mocks.mockClothingData['shirt2'] = {
        'clothing:wearable': {
          wearableType: 'shirt',
          layer: 'base',
          coverage: { required: ['left_chest'], optional: [], exclusions: [] },
          size: 'm',
          equipmentSlots: { primary: 'torso_clothing' },
          conflictResolution: 'auto_remove',
        },
      };

      await clothingService.equipClothing('entity1', 'shirt2');

      // Should dispatch equipped event for successful resolution
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledWith({
        type: 'clothing_equipped',
        payload: expect.objectContaining({
          clothingItemId: 'shirt2',
          conflictResolution: 'auto_remove',
        }),
      });
    });
  });
});
