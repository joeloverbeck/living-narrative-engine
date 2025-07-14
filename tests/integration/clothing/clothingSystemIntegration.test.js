import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { ClothingManagementService } from '../../../src/clothing/services/clothingManagementService.js';
import { EquipmentOrchestrator } from '../../../src/clothing/orchestration/equipmentOrchestrator.js';
import { LayerCompatibilityService } from '../../../src/clothing/validation/layerCompatibilityService.js';
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
        recipeId: 'anatomy:human_male',
      },
    },
    entity2: {
      'anatomy:body': {
        body: {
          root: 'torso2',
          parts: { torso: 'torso2' },
        },
        recipeId: 'anatomy:human_male',
      },
    },
  };

  const mockClothingData = {
    shirt1: {
      'clothing:wearable': {
        layer: 'base',
        size: 'm',
        material: 'cotton',
        equipmentSlots: {
          primary: 'torso_clothing',
        },
      },
    },
    jacket1: {
      'clothing:wearable': {
        layer: 'outer',
        size: 'm',
        material: 'polyester',
        equipmentSlots: {
          primary: 'torso_clothing',
        },
      },
    },
    underwear1: {
      'clothing:wearable': {
        layer: 'underwear',
        size: 'm',
        material: 'cotton',
        equipmentSlots: {
          primary: 'lower_torso_clothing',
        },
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
      },
    },
    entity2: {
      'clothing:equipment': {
        equipped: {},
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

    addComponent: jest.fn((entityId, componentId, data) => {
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
  let anatomyClothingIntegration;
  let mocks;

  beforeEach(() => {
    mocks = createIntegrationMocks();

    // Create service instances with mocked dependencies
    layerService = new LayerCompatibilityService({
      entityManager: mocks.entityManager,
      logger: mocks.logger,
    });

    orchestrator = new EquipmentOrchestrator({
      entityManager: mocks.entityManager,
      logger: mocks.logger,
      eventDispatcher: mocks.eventDispatcher,
      layerCompatibilityService: layerService,
    });

    // Create mock anatomy clothing integration service
    anatomyClothingIntegration = new AnatomyClothingIntegrationService({
      logger: mocks.logger,
      entityManager: mocks.entityManager,
      bodyGraphService: {
        getBodyGraph: jest.fn().mockResolvedValue({
          root: 'torso1',
          getAllPartIds: jest
            .fn()
            .mockReturnValue([
              'torso1',
              'left_chest',
              'right_chest',
              'left_shoulder',
              'right_shoulder',
              'left_hip',
              'right_hip',
              'penis',
              'vagina',
              'left_arm',
            ]),
          getConnectedParts: jest.fn().mockReturnValue([]),
        }),
      },
      anatomyBlueprintRepository: {
        getBlueprintByRecipeId: jest.fn((recipeId) => {
          if (recipeId === 'anatomy:human_male') {
            return Promise.resolve({
              id: 'anatomy:human_male',
              root: 'anatomy:human_male_torso',
              clothingSlotMappings: {
                torso_clothing: {
                  anatomySockets: ['left_chest', 'right_chest'],
                  allowedLayers: ['underwear', 'base', 'outer'],
                  layerOrder: ['underwear', 'base', 'outer'],
                  defaultLayer: 'base',
                },
                lower_torso_clothing: {
                  anatomySockets: ['left_hip', 'right_hip'],
                  allowedLayers: ['underwear', 'base', 'outer'],
                  layerOrder: ['underwear', 'base', 'outer'],
                  defaultLayer: 'base',
                },
                back_clothing: {
                  anatomySockets: ['left_shoulder', 'right_shoulder'],
                  allowedLayers: ['accessories'],
                  layerOrder: ['accessories'],
                  defaultLayer: 'accessories',
                },
                left_arm_clothing: {
                  anatomySockets: ['left_shoulder', 'left_arm'],
                  allowedLayers: ['base'],
                  layerOrder: ['base'],
                  defaultLayer: 'base',
                },
              },
            });
          }
          return Promise.resolve(null);
        }),
        clearCache: jest.fn(),
      },
      anatomySocketIndex: {
        findEntityWithSocket: jest.fn(),
        buildIndex: jest.fn(),
        clearCache: jest.fn(),
      },
      clothingSlotValidator: {
        validateSlotCompatibility: jest.fn().mockResolvedValue({ valid: true }),
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
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledWith(
        'clothing:equipped',
        expect.objectContaining({
          entityId: 'entity1',
          clothingItemId: 'shirt1',
          slotId: 'torso_clothing',
          layer: 'base',
        })
      );
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
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledWith(
        'clothing:unequipped',
        expect.objectContaining({
          entityId: 'entity1',
          clothingItemId: 'shirt1',
          reason: 'manual',
        })
      );
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
          layer: 'base',
          size: 'm',
          material: 'polyester',
          equipmentSlots: {
            primary: 'torso_clothing',
          },
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

      // Mock entity2 to not exist (entity not found error)
      const originalImplementation =
        mocks.entityManager.getEntityInstance.getMockImplementation();
      mocks.entityManager.getEntityInstance.mockImplementation((entityId) => {
        if (entityId === 'entity2') {
          return null; // Entity not found
        }
        return originalImplementation(entityId);
      });

      const result = await clothingService.transferClothing(
        'entity1',
        'entity2',
        'shirt1'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Failed to equip on target: Entity 'entity2' not found"
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
      expect(result.compatibility.layers).toBeDefined();
    });

    it('should detect layer incompatibilities', async () => {
      // First equip an item to create potential conflicts
      await clothingService.equipClothing('entity1', 'shirt1');

      // Mock another item that would conflict
      mocks.mockClothingData['conflicting_shirt'] = {
        'clothing:wearable': {
          layer: 'base',
          size: 'm',
          equipmentSlots: {
            primary: 'torso_clothing',
          },
        },
      };

      const result = await clothingService.validateCompatibility(
        'entity1',
        'conflicting_shirt'
      );

      // The validation should still pass but detect layer conflicts
      expect(result.valid).toBe(true);
      expect(result.compatibility.layers).toBeDefined();
      expect(result.compatibility.layers.hasConflicts).toBe(true);
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

      // Should dispatch clothing:equipped event
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledWith(
        'clothing:equipped',
        expect.objectContaining({
          entityId: 'entity1',
          clothingItemId: 'shirt1',
        })
      );
    });

    it('should dispatch conflict events when conflicts occur', async () => {
      // Equip first item
      await clothingService.equipClothing('entity1', 'shirt1');

      // Clear previous event calls
      mocks.eventDispatcher.dispatch.mockClear();

      // Mock another shirt to create conflict
      mocks.mockClothingData['shirt2'] = {
        'clothing:wearable': {
          layer: 'base',
          size: 'm',
          equipmentSlots: { primary: 'torso_clothing' },
        },
      };

      await clothingService.equipClothing('entity1', 'shirt2');

      // Should dispatch equipped event for successful resolution
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledWith(
        'clothing:equipped',
        expect.objectContaining({
          clothingItemId: 'shirt2',
        })
      );
    });
  });
});
