/**
 * @file Tests for #handleAnatomyGenerated event handler in ClothingInstantiationService
 * @see src/clothing/services/clothingInstantiationService.js (lines 188-256)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClothingInstantiationService } from '../../../../src/clothing/services/clothingInstantiationService.js';

describe('ClothingInstantiationService - #handleAnatomyGenerated Event Handler', () => {
  let mockDeps;
  let subscribedHandler;

  beforeEach(() => {
    // Create mock dependencies
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
        subscribe: jest.fn((eventType, handler) => {
          if (eventType === 'ANATOMY_GENERATED') {
            subscribedHandler = handler;
          }
        }),
      },
    };

    // Create service to trigger event subscription
    new ClothingInstantiationService(mockDeps);
  });

  describe('Event subscription', () => {
    it('should subscribe to ANATOMY_GENERATED event on construction', () => {
      expect(mockDeps.eventBus.subscribe).toHaveBeenCalledWith(
        'ANATOMY_GENERATED',
        expect.any(Function)
      );
    });

    it('should log subscription confirmation', () => {
      expect(mockDeps.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Subscribed to ANATOMY_GENERATED events')
      );
    });
  });

  describe('Successful event handling', () => {
    it('should handle ANATOMY_GENERATED event with valid data', async () => {
      const event = {
        payload: {
          entityId: 'actor123',
          blueprintId: 'blueprint_id',
          sockets: [],
          partsMap: { torso: 'torso_entity' },
          slotEntityMappings: { 'torso.chest': 'torso_entity' },
        },
      };

      // Mock entity with anatomy:body component
      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'human_base_recipe',
        }),
      };
      mockDeps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      // Mock recipe with clothing entities
      mockDeps.dataRegistry.get.mockReturnValue({
        id: 'human_base_recipe',
        clothingEntities: [
          {
            entityId: 'shirt',
            equip: true,
          },
        ],
      });

      // Mock successful instantiation
      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );
      mockDeps.equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
      });

      // Call the event handler
      await subscribedHandler(event);

      // Verify logging
      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          "ClothingInstantiationService: Handling ANATOMY_GENERATED event for entity 'actor123'"
        )
      );
      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          "ClothingInstantiationService: Successfully handled ANATOMY_GENERATED event for entity 'actor123'"
        )
      );
    });

    it('should convert plain object partsMap and slotEntityMappings to Maps', async () => {
      const event = {
        payload: {
          entityId: 'actor123',
          partsMap: { torso: 'torso_entity', head: 'head_entity' },
          slotEntityMappings: {
            'torso.chest': 'torso_entity',
            'head.eyes': 'head_entity',
          },
        },
      };

      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'human_base_recipe',
        }),
      };
      mockDeps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      mockDeps.dataRegistry.get.mockReturnValue({
        id: 'human_base_recipe',
        clothingEntities: [{ entityId: 'shirt' }],
      });

      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );

      await subscribedHandler(event);

      // The instantiateRecipeClothing should be called with converted Maps
      // We can't directly check this, but we verify no errors occurred
      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully handled ANATOMY_GENERATED')
      );
    });

    it('should handle partsMap and slotEntityMappings that are already Maps', async () => {
      const event = {
        payload: {
          entityId: 'actor123',
          partsMap: new Map([['torso', 'torso_entity']]),
          slotEntityMappings: new Map([['torso.chest', 'torso_entity']]),
        },
      };

      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'human_base_recipe',
        }),
      };
      mockDeps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      mockDeps.dataRegistry.get.mockReturnValue({
        id: 'human_base_recipe',
        clothingEntities: [{ entityId: 'shirt' }],
      });

      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );

      await subscribedHandler(event);

      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully handled ANATOMY_GENERATED')
      );
    });
  });

  describe('Early return scenarios', () => {
    it('should return early when entity not found', async () => {
      const event = {
        payload: {
          entityId: 'nonexistent_entity',
          partsMap: {},
          slotEntityMappings: {},
        },
      };

      mockDeps.entityManager.getEntityInstance.mockReturnValue(null);

      await subscribedHandler(event);

      expect(mockDeps.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Entity 'nonexistent_entity' not found")
      );
      // Should not call dataRegistry.get
      expect(mockDeps.dataRegistry.get).not.toHaveBeenCalled();
    });

    it('should return early when entity has no anatomy:body component', async () => {
      const event = {
        payload: {
          entityId: 'actor123',
          partsMap: {},
          slotEntityMappings: {},
        },
      };

      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue(null),
      };
      mockDeps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      await subscribedHandler(event);

      expect(mockDeps.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Entity 'actor123' has no recipe ID")
      );
      // Should not call dataRegistry.get
      expect(mockDeps.dataRegistry.get).not.toHaveBeenCalled();
    });

    it('should return early when entity has anatomy:body but no recipeId', async () => {
      const event = {
        payload: {
          entityId: 'actor123',
          partsMap: {},
          slotEntityMappings: {},
        },
      };

      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue({
          // No recipeId property
          someOtherProperty: 'value',
        }),
      };
      mockDeps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      await subscribedHandler(event);

      expect(mockDeps.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Entity 'actor123' has no recipe ID")
      );
      expect(mockDeps.dataRegistry.get).not.toHaveBeenCalled();
    });

    it('should return early when recipe not found', async () => {
      const event = {
        payload: {
          entityId: 'actor123',
          partsMap: {},
          slotEntityMappings: {},
        },
      };

      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'missing_recipe',
        }),
      };
      mockDeps.entityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockDeps.dataRegistry.get.mockReturnValue(null);

      await subscribedHandler(event);

      expect(mockDeps.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Recipe 'missing_recipe' not found")
      );
    });

    it('should return early when recipe has no clothingEntities', async () => {
      const event = {
        payload: {
          entityId: 'actor123',
          partsMap: {},
          slotEntityMappings: {},
        },
      };

      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'simple_recipe',
        }),
      };
      mockDeps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      mockDeps.dataRegistry.get.mockReturnValue({
        id: 'simple_recipe',
        // No clothingEntities property
      });

      await subscribedHandler(event);

      expect(mockDeps.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Recipe 'simple_recipe' has no clothing entities")
      );
    });

    it('should return early when recipe has empty clothingEntities array', async () => {
      const event = {
        payload: {
          entityId: 'actor123',
          partsMap: {},
          slotEntityMappings: {},
        },
      };

      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'simple_recipe',
        }),
      };
      mockDeps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      mockDeps.dataRegistry.get.mockReturnValue({
        id: 'simple_recipe',
        clothingEntities: [],
      });

      await subscribedHandler(event);

      expect(mockDeps.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Recipe 'simple_recipe' has no clothing entities")
      );
    });
  });

  describe('Error handling', () => {
    it('should catch and log errors during event handling', async () => {
      const event = {
        payload: {
          entityId: 'actor123',
          partsMap: {},
          slotEntityMappings: {},
        },
      };

      // Mock entity manager to throw an error
      mockDeps.entityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await subscribedHandler(event);

      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to handle ANATOMY_GENERATED event for entity 'actor123'"),
        expect.any(Error)
      );
    });

    it('should dispatch CLOTHING_INSTANTIATION_FAILED event on error', async () => {
      const event = {
        payload: {
          entityId: 'actor123',
          partsMap: {},
          slotEntityMappings: {},
        },
      };

      mockDeps.entityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await subscribedHandler(event);

      expect(mockDeps.eventBus.dispatch).toHaveBeenCalledWith(
        'CLOTHING_INSTANTIATION_FAILED',
        {
          entityId: 'actor123',
          error: 'Unexpected error',
        }
      );
    });

    it('should handle error during instantiateRecipeClothing', async () => {
      const event = {
        payload: {
          entityId: 'actor123',
          partsMap: {},
          slotEntityMappings: {},
        },
      };

      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'human_base_recipe',
        }),
      };
      mockDeps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      mockDeps.dataRegistry.get.mockReturnValue({
        id: 'human_base_recipe',
        clothingEntities: [{ entityId: 'invalid_shirt' }],
      });

      // Make slotResolver throw an error to trigger the catch block in #handleAnatomyGenerated
      mockDeps.slotResolver.setSlotEntityMappings.mockImplementation(() => {
        throw new Error('Failed to set slot mappings');
      });

      await subscribedHandler(event);

      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to handle ANATOMY_GENERATED event for entity 'actor123'"
        ),
        expect.any(Error)
      );
      expect(mockDeps.eventBus.dispatch).toHaveBeenCalledWith(
        'CLOTHING_INSTANTIATION_FAILED',
        expect.objectContaining({
          entityId: 'actor123',
          error: 'Failed to set slot mappings',
        })
      );
    });
  });

  describe('Integration with instantiateRecipeClothing', () => {
    it('should pass converted Maps to instantiateRecipeClothing', async () => {
      const event = {
        payload: {
          entityId: 'actor123',
          partsMap: { torso: 'torso_entity' },
          slotEntityMappings: { 'torso.chest': 'torso_entity' },
        },
      };

      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'human_base_recipe',
        }),
      };
      mockDeps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      mockDeps.dataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyRecipes' && id === 'human_base_recipe') {
          return {
            id: 'human_base_recipe',
            clothingEntities: [{ entityId: 'shirt' }],
          };
        }
        if (type === 'entityDefinitions' && id === 'shirt') {
          return {
            components: {
              'clothing:wearable': {
                equipmentSlots: { primary: 'torso_upper' },
              },
            },
          };
        }
        return null;
      });

      mockDeps.entityManager.createEntityInstance.mockResolvedValue(
        'clothing_123'
      );
      mockDeps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });
      mockDeps.clothingSlotValidator.validateSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );

      await subscribedHandler(event);

      // Verify setSlotEntityMappings was called with a Map
      expect(mockDeps.slotResolver.setSlotEntityMappings).toHaveBeenCalledWith(
        expect.any(Map)
      );
    });
  });
});
