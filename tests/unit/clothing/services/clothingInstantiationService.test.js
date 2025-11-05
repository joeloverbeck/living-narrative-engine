/**
 * @file Unit tests for ClothingInstantiationService migration to decomposed architecture
 * @see src/clothing/services/clothingInstantiationService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClothingInstantiationService } from '../../../../src/clothing/services/clothingInstantiationService.js';

describe('ClothingInstantiationService - Decomposed Architecture', () => {
  let service;
  let mockDeps;

  beforeEach(() => {
    // Create mock dependencies
    mockDeps = {
      entityManager: {
        createEntityInstance: jest
          .fn()
          .mockReturnValue('clothing_instance_123'),
        getEntityInstance: jest.fn().mockReturnValue({
          getComponentData: jest.fn().mockReturnValue({
            equipmentSlots: { primary: 'shirt' },
          }),
        }),
      },
      dataRegistry: {
        get: jest.fn().mockReturnValue({
          components: {
            'clothing:wearable': {
              equipmentSlots: { primary: 'shirt' },
              layer: 'base',
              allowedLayers: ['base', 'outer'],
            },
          },
        }),
      },
      equipmentOrchestrator: {
        orchestrateEquipment: jest.fn().mockResolvedValue({
          success: true,
        }),
      },
      slotResolver: {
        setSlotEntityMappings: jest.fn(),
        resolveClothingSlot: jest
          .fn()
          .mockResolvedValue([
            { entityId: 'torso', socketId: 'chest', slotPath: 'torso.chest' },
          ]),
      },
      clothingSlotValidator: {
        validateSlotCompatibility: jest.fn().mockResolvedValue({
          valid: true,
        }),
      },
      anatomyBlueprintRepository: {
        getBlueprintByRecipeId: jest.fn().mockResolvedValue({
          clothingSlotMappings: {
            shirt: {
              blueprintSlots: ['torso.chest'],
              allowedLayers: ['base', 'outer'],
            },
          },
        }),
      },
      bodyGraphService: {
        getAnatomyData: jest.fn().mockResolvedValue({
          recipeId: 'human_base',
          rootEntityId: 'actor123',
        }),
      },
      anatomyClothingCache: {
        get: jest.fn(),
        set: jest.fn(),
      },
      layerResolutionService: {
        resolveAndValidateLayer: jest.fn().mockReturnValue({
          isValid: true,
          layer: 'base',
        }),
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      eventBus: {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
      },
    };

    service = new ClothingInstantiationService(mockDeps);
  });

  describe('instantiateRecipeClothing', () => {
    it('should use SlotResolver directly for slot mappings', async () => {
      const anatomyData = {
        slotEntityMappings: new Map([['torso.chest', 'torso_entity']]),
        partsMap: new Map([['torso', 'torso_entity']]),
      };

      // This test needs actual clothing entities to trigger the slot resolver
      await service.instantiateRecipeClothing(
        'actor123',
        { clothingEntities: [{ entityId: 'shirt' }] },
        anatomyData
      );

      expect(mockDeps.slotResolver.setSlotEntityMappings).toHaveBeenCalledWith(
        anatomyData.slotEntityMappings
      );
    });

    it('should use decomposed components for validation', async () => {
      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            targetSlot: 'shirt',
          },
        ],
      };

      const anatomyData = {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      };

      await service.instantiateRecipeClothing('actor123', recipe, anatomyData);

      // Should fetch blueprint
      expect(mockDeps.bodyGraphService.getAnatomyData).toHaveBeenCalledWith(
        'actor123'
      );
      expect(
        mockDeps.anatomyBlueprintRepository.getBlueprintByRecipeId
      ).toHaveBeenCalledWith('human_base');

      // Should validate using decomposed validator
      expect(
        mockDeps.clothingSlotValidator.validateSlotCompatibility
      ).toHaveBeenCalled();
    });

    it('should successfully instantiate and equip clothing', async () => {
      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            equip: true,
          },
        ],
      };

      const anatomyData = {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        anatomyData
      );

      expect(result.instantiated).toHaveLength(1);
      expect(result.instantiated[0]).toEqual({
        clothingId: 'clothing_instance_123',
        entityDefinitionId: 'shirt',
      });
      expect(result.equipped).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle validation failures gracefully', async () => {
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: false,
          reason: 'Slot not available on anatomy',
        }
      );

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            targetSlot: 'shirt',
          },
        ],
      };

      const anatomyData = {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        anatomyData
      );

      expect(result.instantiated).toHaveLength(0);
      expect(result.equipped).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Slot not available on anatomy');
    });

    it('should skip validation when skipValidation is true', async () => {
      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            skipValidation: true,
          },
        ],
      };

      const anatomyData = {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      };

      await service.instantiateRecipeClothing('actor123', recipe, anatomyData);

      // Should not call validator when skipValidation is true
      expect(
        mockDeps.clothingSlotValidator.validateSlotCompatibility
      ).not.toHaveBeenCalled();
    });

    it('should handle empty clothing entities gracefully', async () => {
      const result = await service.instantiateRecipeClothing(
        'actor123',
        { clothingEntities: [] },
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.instantiated).toHaveLength(0);
      expect(result.equipped).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should use layer resolution service', async () => {
      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            layer: 'outer',
            properties: {
              'clothing:wearable': {},
            },
          },
        ],
      };

      const anatomyData = {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      };

      await service.instantiateRecipeClothing('actor123', recipe, anatomyData);

      expect(
        mockDeps.layerResolutionService.resolveAndValidateLayer
      ).toHaveBeenCalledWith('outer', 'base', 'base', ['base', 'outer']);
    });
  });

  describe('additional branch coverage tests', () => {
    it('should handle validation errors array with multiple errors (line 257)', async () => {
      // Mock getEntityInstance to return entity with component
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue({
          equipmentSlots: { primary: 'shirt' },
        }),
      });

      // Mock validation to return isValid: false with errors array
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: false,
          reason: 'Slot not compatible',
        }
      );

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            targetSlot: 'shirt',
          },
        ],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Slot not compatible');
    });

    it('should handle recipe with null clothingEntities (line 313)', async () => {
      const recipe = {
        clothingEntities: null,
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.instantiated).toHaveLength(0);
      expect(mockDeps.eventBus.dispatch).not.toHaveBeenCalledWith(
        'clothing:instantiation_completed',
        expect.any(Object)
      );
    });

    it('should handle recipe with undefined clothingEntities (line 313)', async () => {
      const recipe = {
        // clothingEntities is undefined
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.instantiated).toHaveLength(0);
      expect(mockDeps.eventBus.dispatch).not.toHaveBeenCalledWith(
        'clothing:instantiation_completed',
        expect.any(Object)
      );
    });

    it('should handle entity with existing clothing:wearable in properties (line 581)', async () => {
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
            layer: 'base',
            allowedLayers: ['base', 'outer'],
          },
        },
      });

      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'outer',
      });

      let capturedProperties;
      mockDeps.entityManager.createEntityInstance.mockImplementation(
        (entityDefId, properties) => {
          capturedProperties = properties;
          return 'clothing_instance_123';
        }
      );

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            layer: 'outer',
            properties: {
              'clothing:wearable': {
                someExistingProp: 'value',
              },
              'core:physical': { weight: 2 },
            },
          },
        ],
      };

      await service.instantiateRecipeClothing('actor123', recipe, {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      });

      // Should preserve existing clothing:wearable properties and add layer
      expect(capturedProperties.componentOverrides['clothing:wearable']).toHaveProperty(
        'someExistingProp',
        'value'
      );
      expect(capturedProperties.componentOverrides['clothing:wearable']).toHaveProperty(
        'layer',
        'outer'
      );
    });

    it('should handle missing clothing instance when validating (line 473)', async () => {
      // Mock getEntityInstance to return null
      mockDeps.entityManager.getEntityInstance.mockReturnValue(null);

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            targetSlot: 'shirt',
          },
        ],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Clothing instance');
      expect(result.errors[0]).toContain('not found');
    });

    it('should handle clothing instance without clothing:wearable component (line 480)', async () => {
      // Mock getEntityInstance to return entity without clothing component
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue(null),
      });

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            targetSlot: 'shirt',
          },
        ],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain(
        'does not have clothing:wearable component'
      );
    });

    it('should handle clothing without targetSlot or primary equipment slot (line 489)', async () => {
      // Mock getEntityInstance to return entity with component but no equipment slots
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue({
          // No equipmentSlots property
        }),
      });

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            // No targetSlot specified
          },
        ],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('does not specify a clothing slot');
    });
  });

  describe('caching', () => {
    it('should cache validation results', async () => {
      mockDeps.anatomyClothingCache.get.mockReturnValueOnce(undefined);

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            targetSlot: 'shirt',
          },
        ],
      };

      await service.instantiateRecipeClothing('actor123', recipe, {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      });

      expect(mockDeps.anatomyClothingCache.set).toHaveBeenCalledWith(
        'validation',
        expect.stringContaining('actor123:shirt:'),
        expect.objectContaining({ valid: true })
      );
    });

    it('should use cached validation results', async () => {
      const cachedResult = { valid: true };
      mockDeps.anatomyClothingCache.get.mockReturnValueOnce(cachedResult);

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            targetSlot: 'shirt',
          },
        ],
      };

      await service.instantiateRecipeClothing('actor123', recipe, {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      });

      // Should not call validator if cached
      expect(
        mockDeps.clothingSlotValidator.validateSlotCompatibility
      ).not.toHaveBeenCalled();
    });

    it('should cache available slots', async () => {
      mockDeps.anatomyClothingCache.get
        .mockReturnValueOnce(undefined) // For validation cache
        .mockReturnValueOnce(undefined); // For available slots cache

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            targetSlot: 'shirt',
          },
        ],
      };

      await service.instantiateRecipeClothing('actor123', recipe, {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      });

      // Should cache available slots
      expect(mockDeps.anatomyClothingCache.set).toHaveBeenCalledWith(
        'available_slots',
        expect.stringContaining('actor123'),
        expect.any(Map)
      );
    });
  });

  describe('error handling', () => {
    it('should handle entity creation failures', async () => {
      mockDeps.entityManager.createEntityInstance.mockImplementation(() => {
        throw new Error('Failed to create entity');
      });

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
          },
        ],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to create entity');
    });

    it('should dispatch error event when failures occur', async () => {
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: false,
          reason: 'Validation failed',
        }
      );

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
          },
        ],
      };

      await service.instantiateRecipeClothing('actor123', recipe, {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      });

      expect(mockDeps.eventBus.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining(
            'Clothing instantiation failed for 1 items'
          ),
        })
      );
    });

    it('should use default error message when validation errors array is undefined (line 257)', async () => {
      // Mock validation to return isValid: false but without errors array
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: false,
          // No reason provided, which will trigger the fallback
        }
      );

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            targetSlot: 'shirt',
          },
        ],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      // Should have the fallback error message - the actual message format
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(
        /Cannot equip instance .* to slot shirt/
      );
    });

    it('should use default error message in validation result (line 508)', async () => {
      // Mock the validation to return invalid without a reason
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: false,
          // No reason provided
        }
      );

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            targetSlot: 'shirt',
          },
        ],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      // The error should include the default message format
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(
        /Cannot equip instance .* to slot shirt/
      );
    });

    it('should handle equipment failure gracefully', async () => {
      mockDeps.equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: false,
        errors: ['Equipment failed due to conflict'],
      });

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            equip: true,
          },
        ],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.instantiated).toHaveLength(1);
      expect(result.equipped).toHaveLength(0);
      expect(result.errors).toContainEqual('Equipment failed due to conflict');
    });

    it('should handle equipment failure with unknown error', async () => {
      mockDeps.equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: false,
        // No errors array provided
      });

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            equip: true,
          },
        ],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.instantiated).toHaveLength(1);
      expect(result.equipped).toHaveLength(0);
      expect(result.errors).toContainEqual('Unknown equipment error');
    });
  });

  describe('edge cases and branch coverage', () => {
    it('should not dispatch clothing:instantiation_completed event when no clothing entities in recipe (line 313)', async () => {
      const recipe = {}; // No clothingEntities property at all

      await service.instantiateRecipeClothing('actor123', recipe, {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      });

      // Should not dispatch the completion event
      expect(mockDeps.eventBus.dispatch).not.toHaveBeenCalledWith(
        'clothing:instantiation_completed',
        expect.any(Object)
      );
    });

    it('should not dispatch system error event when no errors occur (line 327)', async () => {
      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            equip: true,
          },
        ],
      };

      await service.instantiateRecipeClothing('actor123', recipe, {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      });

      // Should dispatch completion but not error
      expect(mockDeps.eventBus.dispatch).toHaveBeenCalledWith(
        'clothing:instantiation_completed',
        expect.any(Object)
      );
      expect(mockDeps.eventBus.dispatch).not.toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.any(Object)
      );
    });

    it('should handle entity definition without clothing component (line 565)', async () => {
      // Mock a definition without clothing:wearable component
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          // No clothing:wearable component
          'core:physical': { weight: 1 },
        },
      });

      const recipe = {
        clothingEntities: [
          {
            entityId: 'non_clothing_item',
            layer: 'outer',
          },
        ],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      // Should still create the entity but without layer resolution
      expect(result.instantiated).toHaveLength(1);
      expect(
        mockDeps.layerResolutionService.resolveAndValidateLayer
      ).not.toHaveBeenCalled();
    });

    it('should initialize clothing:wearable in finalProperties when not present (line 581)', async () => {
      // Set up a scenario where we have a clothing component but property overrides don't include it
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
            layer: 'base',
            allowedLayers: ['base', 'outer'],
          },
        },
      });

      // Mock layer resolution to return 'outer'
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'outer',
      });

      // Mock createEntityInstance to capture the properties passed to it
      let capturedProperties;
      mockDeps.entityManager.createEntityInstance.mockImplementation(
        (entityDefId, properties) => {
          capturedProperties = properties;
          return 'clothing_instance_123';
        }
      );

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            layer: 'outer',
            properties: {
              // Property overrides that don't include clothing:wearable
              'core:physical': { weight: 2 },
            },
          },
        ],
      };

      await service.instantiateRecipeClothing('actor123', recipe, {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      });

      // Verify that clothing:wearable was created in finalProperties
      expect(capturedProperties.componentOverrides).toHaveProperty('clothing:wearable');
      expect(capturedProperties.componentOverrides['clothing:wearable']).toHaveProperty(
        'layer',
        'outer'
      );
      expect(capturedProperties.componentOverrides).toHaveProperty('core:physical');
    });

    it('should handle layer resolution failure', async () => {
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
            layer: 'base',
            allowedLayers: ['base', 'outer'],
          },
        },
      });

      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: false,
        error: 'Invalid layer specified',
      });

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            layer: 'invalid_layer',
            properties: {
              'clothing:wearable': {},
            },
          },
        ],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid layer specified');
    });

    it('should handle missing entity definition', async () => {
      mockDeps.dataRegistry.get.mockReturnValue(null);

      const recipe = {
        clothingEntities: [
          {
            entityId: 'non_existent_item',
          },
        ],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain(
        "Entity definition 'non_existent_item' not found in registry"
      );
    });

    it('should handle entity creation returning null', async () => {
      mockDeps.entityManager.createEntityInstance.mockReturnValue(null);

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
          },
        ],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to create clothing entity');
    });

    it('should handle entity object with id property', async () => {
      // Test the branch where clothingEntity is an object with id property
      mockDeps.entityManager.createEntityInstance.mockReturnValue({
        id: 'entity_object_123',
      });

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            equip: false,
          },
        ],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.instantiated).toHaveLength(1);
      expect(result.instantiated[0].clothingId).toBe('entity_object_123');
    });

    it('should handle entity without valid ID', async () => {
      mockDeps.entityManager.createEntityInstance.mockReturnValue({
        // Object without id property
        someOtherProp: 'value',
      });

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
          },
        ],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('has no valid ID');
    });
  });
});
