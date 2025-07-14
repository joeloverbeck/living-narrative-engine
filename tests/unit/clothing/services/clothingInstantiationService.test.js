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
        createEntityInstance: jest.fn().mockReturnValue('clothing_instance_123'),
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
        resolveClothingSlot: jest.fn().mockResolvedValue([
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

      await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

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

      await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

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

      await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

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

      await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(mockDeps.eventBus.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining(
            'Clothing instantiation failed for 1 items'
          ),
        })
      );
    });
  });
});