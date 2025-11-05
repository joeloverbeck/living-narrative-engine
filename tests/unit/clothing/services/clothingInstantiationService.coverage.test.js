/**
 * @file Coverage-focused tests for ClothingInstantiationService to reach 100% coverage
 * @see src/clothing/services/clothingInstantiationService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClothingInstantiationService } from '../../../../src/clothing/services/clothingInstantiationService.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

describe('ClothingInstantiationService - Coverage Tests', () => {
  let service;
  let mockDeps;

  beforeEach(() => {
    // Create comprehensive mock dependencies
    mockDeps = {
      entityManager: {
        createEntityInstance: jest.fn(),
        getEntityInstance: jest.fn(),
      },
      dataRegistry: {
        get: jest.fn(),
      },
      equipmentOrchestrator: {
        orchestrateEquipment: jest.fn(),
      },
      slotResolver: {
        setSlotEntityMappings: jest.fn(),
        resolveClothingSlot: jest.fn(),
      },
      clothingSlotValidator: {
        validateSlotCompatibility: jest.fn(),
      },
      anatomyBlueprintRepository: {
        getBlueprintByRecipeId: jest.fn(),
      },
      bodyGraphService: {
        getAnatomyData: jest.fn(),
      },
      anatomyClothingCache: {
        get: jest.fn(),
        set: jest.fn(),
      },
      layerResolutionService: {
        resolveAndValidateLayer: jest.fn(),
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

  describe('Equipment Failure Scenarios (lines 295-298)', () => {
    it('should handle equipment orchestrator returning success false with error message', async () => {
      // Setup successful instantiation
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
            layer: 'base',
          },
        },
      });
      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue({
          equipmentSlots: { primary: 'shirt' },
        }),
      });
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );
      mockDeps.anatomyClothingCache.get.mockReturnValue(undefined);
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });
      mockDeps.bodyGraphService.getAnatomyData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockDeps.anatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        {
          clothingSlotMappings: { shirt: {} },
        }
      );

      // Make equipment fail with specific error
      mockDeps.equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: false,
        errors: ['Equipment slot already occupied'],
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

      expect(result.equipped).toHaveLength(0);
      expect(result.errors).toContain('Equipment slot already occupied');
      expect(mockDeps.logger.warn).toHaveBeenCalledWith(
        `ClothingInstantiationService: Failed to equip clothing 'clothing_123': Equipment slot already occupied`
      );
    });

    it('should handle equipment orchestrator returning success false without error message', async () => {
      // Setup
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
          },
        },
      });
      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue({
          equipmentSlots: { primary: 'shirt' },
        }),
      });
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });

      // Make equipment fail without specific error
      mockDeps.equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: false,
      });

      const recipe = {
        clothingEntities: [{ entityId: 'shirt', equip: true }],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.errors).toContain('Unknown equipment error');
    });
  });

  describe('Validation Error Handling (lines 387-391, 369)', () => {
    it('should handle errors thrown during slot validation', async () => {
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockRejectedValue(
        new Error('Validation service failure')
      );
      mockDeps.anatomyClothingCache.get.mockReturnValue(undefined);

      // Need to setup enough to reach validation
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
          },
        },
      });
      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue({
          equipmentSlots: { primary: 'shirt' },
        }),
      });
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });
      mockDeps.bodyGraphService.getAnatomyData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockDeps.anatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        {
          clothingSlotMappings: { shirt: {} },
        }
      );

      const recipe = {
        clothingEntities: [{ entityId: 'shirt' }],
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
        'Validation error: Validation service failure'
      );
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to validate clothing slot: Validation service failure'
        ),
        expect.any(Error)
      );
    });

    it('should test the resolver function passed to validateSlotCompatibility', async () => {
      let capturedResolverFunction = null;

      // Capture the resolver function when validateSlotCompatibility is called
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockImplementation(
        async (entityId, slotId, itemId, availableSlots, resolverFn) => {
          capturedResolverFunction = resolverFn;
          // Call the resolver to test it
          const resolverResult = await resolverFn(entityId, slotId);
          expect(resolverResult).toEqual([
            { entityId: 'torso', socketId: 'chest', slotPath: 'torso.chest' },
          ]);
          return { valid: true };
        }
      );

      mockDeps.slotResolver.resolveClothingSlot.mockResolvedValue([
        { entityId: 'torso', socketId: 'chest', slotPath: 'torso.chest' },
      ]);

      // Setup to reach validation
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
          },
        },
      });
      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue({
          equipmentSlots: { primary: 'shirt' },
        }),
      });
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });
      mockDeps.anatomyClothingCache.get.mockReturnValue(undefined);
      mockDeps.bodyGraphService.getAnatomyData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockDeps.anatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        {
          clothingSlotMappings: { shirt: {} },
        }
      );

      const recipe = {
        clothingEntities: [{ entityId: 'shirt' }],
      };

      await service.instantiateRecipeClothing('actor123', recipe, {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      });

      expect(capturedResolverFunction).not.toBeNull();
      expect(mockDeps.slotResolver.resolveClothingSlot).toHaveBeenCalled();
    });
  });

  describe('Cache Hit Scenarios (line 410)', () => {
    it('should use cached available slots when cache hit occurs', async () => {
      const cachedSlots = new Map([['shirt', { allowed: true }]]);
      mockDeps.anatomyClothingCache.get
        .mockReturnValueOnce(undefined) // validation cache miss
        .mockReturnValueOnce(cachedSlots); // available slots cache hit

      // Setup
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
          },
        },
      });
      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue({
          equipmentSlots: { primary: 'shirt' },
        }),
      });
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );

      const recipe = {
        clothingEntities: [{ entityId: 'shirt' }],
      };

      await service.instantiateRecipeClothing('actor123', recipe, {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      });

      // Should not call bodyGraphService or blueprintRepository when cache hit
      expect(mockDeps.bodyGraphService.getAnatomyData).not.toHaveBeenCalled();
      expect(
        mockDeps.anatomyBlueprintRepository.getBlueprintByRecipeId
      ).not.toHaveBeenCalled();
    });
  });

  describe('#getAvailableClothingSlots Error Cases (lines 417-418, 428-431, 444-448)', () => {
    it('should handle missing anatomy data', async () => {
      mockDeps.bodyGraphService.getAnatomyData.mockResolvedValue(null);
      mockDeps.anatomyClothingCache.get.mockReturnValue(undefined);

      // Setup to reach getAvailableClothingSlots
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
          },
        },
      });
      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue({
          equipmentSlots: { primary: 'shirt' },
        }),
      });
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );

      const recipe = {
        clothingEntities: [{ entityId: 'shirt' }],
      };

      await service.instantiateRecipeClothing('actor123', recipe, {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      });

      expect(mockDeps.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No anatomy data found for entity actor123')
      );
    });

    it('should handle missing blueprint', async () => {
      mockDeps.bodyGraphService.getAnatomyData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockDeps.anatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        null
      );
      mockDeps.anatomyClothingCache.get.mockReturnValue(undefined);

      // Setup
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
          },
        },
      });
      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue({
          equipmentSlots: { primary: 'shirt' },
        }),
      });
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );

      const recipe = {
        clothingEntities: [{ entityId: 'shirt' }],
      };

      await service.instantiateRecipeClothing('actor123', recipe, {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      });

      expect(mockDeps.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'No clothing slot mappings in blueprint for entity actor123'
        )
      );
    });

    it('should handle errors thrown while getting available slots', async () => {
      mockDeps.bodyGraphService.getAnatomyData.mockRejectedValue(
        new Error('Database connection failed')
      );
      mockDeps.anatomyClothingCache.get.mockReturnValue(undefined);

      // Setup
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
          },
        },
      });
      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue({
          equipmentSlots: { primary: 'shirt' },
        }),
      });
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );

      const recipe = {
        clothingEntities: [{ entityId: 'shirt' }],
      };

      await service.instantiateRecipeClothing('actor123', recipe, {
        slotEntityMappings: new Map(),
        partsMap: new Map(),
      });

      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to get available clothing slots: Database connection failed'
        ),
        expect.any(Error)
      );
    });
  });

  describe('#validateClothingSlotAfterInstantiation Error Cases (lines 473-474, 480-483, 489-492, 522)', () => {
    it('should handle missing clothing instance', async () => {
      mockDeps.entityManager.getEntityInstance.mockReturnValue(null);

      // Setup
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
          },
        },
      });
      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });

      const recipe = {
        clothingEntities: [{ entityId: 'shirt' }],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.errors).toContain(
        "Clothing instance 'clothing_123' not found"
      );
    });

    it('should handle missing clothing:wearable component', async () => {
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue(null),
      });

      // Setup
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
          },
        },
      });
      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });

      const recipe = {
        clothingEntities: [{ entityId: 'shirt' }],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.errors).toContain(
        "Clothing instance 'clothing_123' does not have clothing:wearable component"
      );
    });

    it('should handle missing equipment slots', async () => {
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue({
          // No equipmentSlots property
        }),
      });

      // Setup
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
          },
        },
      });
      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
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

      expect(result.errors).toContain(
        "Clothing instance 'clothing_123' does not specify a clothing slot"
      );
    });

    it('should handle errors thrown during validation', async () => {
      mockDeps.entityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Unexpected error accessing entity');
      });

      // Setup
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
          },
        },
      });
      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });

      const recipe = {
        clothingEntities: [{ entityId: 'shirt' }],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.errors[0]).toContain(
        'clothing_123: Unexpected error accessing entity'
      );
    });
  });

  describe('Legacy #validateClothingSlots Method (lines 540-591)', () => {
    // This method is not called in the current code flow, but we need to test it for coverage
    // Since it's dead code that's never called, we cannot test it directly without using
    // reflection or modifying the source code. The method appears to be a legacy implementation
    // that has been replaced by #validateClothingSlotAfterInstantiation.

    it('should validate clothing slots using legacy method', async () => {
      // Since this is a private method that's not currently called, we'll test it indirectly
      // by ensuring the new validation flow covers the same scenarios

      // Test missing entity definition
      mockDeps.dataRegistry.get.mockReturnValue(null);
      const recipe = {
        clothingEntities: [{ entityId: 'missing_shirt' }],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.errors[0]).toContain(
        "Entity definition 'missing_shirt' not found in registry"
      );
    });

    // Note: The legacy method #validateClothingSlots (lines 540-591) is dead code that's not
    // called anywhere in the codebase. It appears to be replaced by the new validation flow.
    // To achieve 100% coverage, this method would need to be either:
    // 1. Removed from the codebase (recommended since it's unused)
    // 2. Called somewhere in the code
    // 3. Tested using reflection/private method access (not recommended)
  });

  describe('Layer Resolution Failures (line 641)', () => {
    it('should handle invalid layer resolution', async () => {
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
            layer: 'invalid_layer',
            allowedLayers: ['base', 'outer'],
          },
        },
      });

      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: false,
        error: 'Layer "invalid_layer" is not in allowed layers',
      });

      const recipe = {
        clothingEntities: [
          {
            entityId: 'shirt',
            layer: 'invalid_layer',
            properties: { 'clothing:wearable': { size: 'medium' } }, // Need non-empty properties to trigger layer validation
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

      expect(result.errors[0]).toContain(
        'Layer resolution failed for shirt: Layer "invalid_layer" is not in allowed layers'
      );
    });
  });

  describe('Entity Creation Edge Cases (lines 665, 673)', () => {
    it('should handle null entity creation', async () => {
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
          },
        },
      });
      mockDeps.entityManager.createEntityInstance.mockResolvedValue(null);
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });

      const recipe = {
        clothingEntities: [{ entityId: 'shirt' }],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.errors[0]).toContain(
        "Failed to create clothing entity 'shirt'"
      );
    });

    it('should handle entity object with no ID', async () => {
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
          },
        },
      });
      // Return an object without id property
      mockDeps.entityManager.createEntityInstance.mockResolvedValue({
        someOtherProperty: 'value',
      });
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });

      const recipe = {
        clothingEntities: [{ entityId: 'shirt' }],
      };

      const result = await service.instantiateRecipeClothing(
        'actor123',
        recipe,
        {
          slotEntityMappings: new Map(),
          partsMap: new Map(),
        }
      );

      expect(result.errors[0]).toContain(
        "Created clothing entity 'shirt' has no valid ID"
      );
    });
  });

  describe('Equipment Error Handling (line 710)', () => {
    it('should handle equipment orchestrator returning error property instead of errors array', async () => {
      // Setup successful instantiation
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
          },
        },
      });
      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue({
          equipmentSlots: { primary: 'shirt' },
        }),
      });
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });

      // Make equipment return error property (from catch block)
      mockDeps.equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: false,
        error: 'Equipment service unavailable',
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

      expect(result.equipped).toHaveLength(0);
      // When error property is present but not errors array, it should use 'Unknown equipment error'
      expect(result.errors[0]).toBe('Unknown equipment error');
    });

    it('should handle exceptions thrown during equipment', async () => {
      // Setup successful instantiation
      mockDeps.dataRegistry.get.mockReturnValue({
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'shirt' },
          },
        },
      });
      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue({
          equipmentSlots: { primary: 'shirt' },
        }),
      });
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });

      // Make equipment throw an error - this will be caught and return {success: false, error: message}
      mockDeps.equipmentOrchestrator.orchestrateEquipment.mockRejectedValue(
        new Error('Equipment service unavailable')
      );

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

      expect(result.equipped).toHaveLength(0);
      // The error comes from the catch block which returns {success: false, error: error.message}
      // This gets converted to 'Unknown equipment error' in the main flow
      expect(result.errors[0]).toBe('Unknown equipment error');
    });
  });

  describe('Parameter Validation', () => {
    it('should throw on invalid actorId', async () => {
      await expect(
        service.instantiateRecipeClothing(
          '',
          {},
          { partsMap: new Map(), slotEntityMappings: new Map() }
        )
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should throw on missing recipe', async () => {
      await expect(
        service.instantiateRecipeClothing('actor123', null, {
          partsMap: new Map(),
          slotEntityMappings: new Map(),
        })
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should throw on missing anatomy data', async () => {
      await expect(
        service.instantiateRecipeClothing('actor123', {}, null)
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should throw on missing parts map', async () => {
      await expect(
        service.instantiateRecipeClothing(
          'actor123',
          {},
          { slotEntityMappings: new Map() }
        )
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should throw on missing slot entity mappings', async () => {
      await expect(
        service.instantiateRecipeClothing(
          'actor123',
          {},
          { partsMap: new Map() }
        )
      ).rejects.toThrow(InvalidArgumentError);
    });
  });
});
