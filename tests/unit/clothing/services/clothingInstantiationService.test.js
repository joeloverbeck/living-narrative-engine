/**
 * @file Test suite for ClothingInstantiationService
 * @see src/clothing/services/clothingInstantiationService.js
 */

import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { ClothingInstantiationService } from '../../../../src/clothing/services/clothingInstantiationService.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';

/** Helper to create minimal mocks for dependencies */
function createMocks() {
  return {
    entityManager: {
      createEntityInstance: jest.fn(),
      getEntityInstance: jest.fn().mockReturnValue(null),
      hasComponent: jest.fn(),
      getComponentData: jest.fn(),
      setComponentData: jest.fn(),
    },
    dataRegistry: {
      get: jest.fn(),
    },
    equipmentOrchestrator: {
      orchestrateEquipment: jest.fn(),
      validateEquipmentCompatibility: jest.fn(),
    },
    anatomyClothingIntegrationService: {
      getClothingCapabilities: jest.fn(),
      validateClothingSlotCompatibility: jest.fn(),
    },
    layerResolutionService: {
      resolveLayer: jest.fn().mockReturnValue('base'),
      validateLayerAllowed: jest.fn().mockReturnValue(true),
      resolveAndValidateLayer: jest.fn().mockImplementation((recipeLayer, entityLayer, blueprintLayer, allowedLayers) => {
        const layer = recipeLayer || entityLayer || blueprintLayer || 'base';
        return {
          isValid: true,
          layer: layer,
        };
      }),
      getPrecedenceOrder: jest.fn().mockReturnValue(['underwear', 'base', 'outer', 'accessories']),
    },
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    eventBus: {
      dispatch: jest.fn(),
    },
  };
}

describe('ClothingInstantiationService', () => {
  let entityManager;
  let dataRegistry;
  let equipmentOrchestrator;
  let anatomyClothingIntegrationService;
  let layerResolutionService;
  let logger;
  let eventBus;
  let service;

  beforeEach(() => {
    ({
      entityManager,
      dataRegistry,
      equipmentOrchestrator,
      anatomyClothingIntegrationService,
      layerResolutionService,
      logger,
      eventBus,
    } = createMocks());

    service = new ClothingInstantiationService({
      entityManager,
      dataRegistry,
      equipmentOrchestrator,
      anatomyClothingIntegrationService,
      layerResolutionService,
      logger,
      eventBus,
    });
  });

  describe('constructor', () => {
    it('should create service with valid dependencies', () => {
      expect(service).toBeInstanceOf(ClothingInstantiationService);
    });

    it('should throw error when entityManager is missing', () => {
      expect(
        () =>
          new ClothingInstantiationService({
            dataRegistry,
            equipmentOrchestrator,
            anatomyClothingIntegrationService,
            layerResolutionService,
            logger,
            eventBus,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error when dataRegistry is missing', () => {
      expect(
        () =>
          new ClothingInstantiationService({
            entityManager,
            equipmentOrchestrator,
            anatomyClothingIntegrationService,
            layerResolutionService,
            logger,
            eventBus,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error when layerResolutionService is missing', () => {
      expect(
        () =>
          new ClothingInstantiationService({
            entityManager,
            dataRegistry,
            equipmentOrchestrator,
            anatomyClothingIntegrationService,
            logger,
            eventBus,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error when equipmentOrchestrator is missing', () => {
      expect(
        () =>
          new ClothingInstantiationService({
            entityManager,
            dataRegistry,
            anatomyClothingIntegrationService,
            layerResolutionService,
            logger,
            eventBus,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error when anatomyClothingIntegrationService is missing', () => {
      expect(
        () =>
          new ClothingInstantiationService({
            entityManager,
            dataRegistry,
            equipmentOrchestrator,
            layerResolutionService,
            logger,
            eventBus,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger is missing', () => {
      expect(
        () =>
          new ClothingInstantiationService({
            entityManager,
            dataRegistry,
            equipmentOrchestrator,
            anatomyClothingIntegrationService,
            layerResolutionService,
            eventBus,
          })
      ).toThrow(Error); // Logger validation throws Error, not InvalidArgumentError
    });

    it('should throw error when eventBus is missing', () => {
      expect(
        () =>
          new ClothingInstantiationService({
            entityManager,
            dataRegistry,
            equipmentOrchestrator,
            anatomyClothingIntegrationService,
            layerResolutionService,
            logger,
          })
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('instantiateRecipeClothing', () => {
    const actorId = 'actor123';
    const mockRecipe = {
      recipeId: 'anatomy:human_peasant',
      blueprintId: 'anatomy:human_male',
      slots: {},
    };
    const mockAnatomyParts = new Map([
      ['head', 'part_head_123'],
      ['torso', 'part_torso_123'],
      ['legs', 'part_legs_123'],
      ['feet', 'part_feet_123'],
    ]);

    it('should return empty result when no clothingEntities in recipe', async () => {
      const result = await service.instantiateRecipeClothing(
        actorId,
        mockRecipe,
        { partsMap: mockAnatomyParts, slotEntityMappings: new Map() }
      );

      expect(result).toEqual({
        instantiated: [],
        equipped: [],
        errors: [],
      });
      expect(eventBus.dispatch).not.toHaveBeenCalled();
    });

    it('should instantiate single clothing item successfully', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [
          {
            entityId: 'clothing:simple_shirt',
            equip: true,
          },
        ],
      };

      // Mock entity definition
      dataRegistry.get.mockImplementation((category, id) => {
        if (
          category === 'entityDefinitions' &&
          id === 'clothing:simple_shirt'
        ) {
          return {
            id: 'clothing:simple_shirt',
            components: {
              'core:name': { text: 'Simple Shirt' },
              'clothing:wearable': {
                equipmentSlots: { primary: 'torso_upper' },
              },
            },
          };
        }
        return null;
      });

      // Mock entity creation
      const createdClothingId = 'clothing_123';
      entityManager.createEntityInstance.mockResolvedValue(createdClothingId);
      
      // Mock entity exists check
      entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === createdClothingId) {
          return {
            id,
            getComponentData: jest.fn().mockReturnValue({
              equipmentSlots: { primary: 'torso_upper' },
              layer: 'base'
            })
          };
        }
        return null;
      });

      // Mock validation
      anatomyClothingIntegrationService.validateClothingSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );

      // Mock equipment
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
      });

      const result = await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        { partsMap: mockAnatomyParts, slotEntityMappings: new Map() }
      );

      expect(result).toEqual({
        instantiated: [
          {
            id: createdClothingId,
            definitionId: 'clothing:simple_shirt',
          },
        ],
        equipped: [createdClothingId],
        errors: [],
      });

      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'clothing:instantiation_completed',
        {
          actorId,
          result: expect.any(Object),
        }
      );
    });

    it('should instantiate multiple clothing items', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [
          {
            entityId: 'clothing:simple_shirt',
            equip: true,
          },
          {
            entityId: 'clothing:leather_boots',
            equip: true,
          },
          {
            entityId: 'clothing:straw_hat',
            equip: false,
          },
        ],
      };

      // Mock entity definitions
      // Mock entity definitions for validation and instantiation
      dataRegistry.get.mockImplementation((category, id) => {
        if (category !== 'entityDefinitions') return null;
        switch (id) {
          case 'clothing:simple_shirt':
            return {
              id: 'clothing:simple_shirt',
              components: {
                'clothing:wearable': {
                  equipmentSlots: { primary: 'torso_upper' },
                },
              },
            };
          case 'clothing:leather_boots':
            return {
              id: 'clothing:leather_boots',
              components: {
                'clothing:wearable': { equipmentSlots: { primary: 'feet' } },
              },
            };
          case 'clothing:straw_hat':
            return {
              id: 'clothing:straw_hat',
              components: {
                'clothing:wearable': { equipmentSlots: { primary: 'head' } },
              },
            };
          default:
            return null;
        }
      });

      // Mock entity creation
      entityManager.createEntityInstance
        .mockResolvedValueOnce('clothing_shirt_123')
        .mockResolvedValueOnce('clothing_boots_123')
        .mockResolvedValueOnce('clothing_hat_123');
      
      // Mock entity exists check
      entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'clothing_shirt_123') {
          return {
            id,
            getComponentData: jest.fn().mockReturnValue({
              equipmentSlots: { primary: 'torso_upper' },
              layer: 'base'
            })
          };
        } else if (id === 'clothing_boots_123') {
          return {
            id,
            getComponentData: jest.fn().mockReturnValue({
              equipmentSlots: { primary: 'feet' },
              layer: 'base'
            })
          };
        } else if (id === 'clothing_hat_123') {
          return {
            id,
            getComponentData: jest.fn().mockReturnValue({
              equipmentSlots: { primary: 'head' },
              layer: 'outer'
            })
          };
        }
        return null;
      });

      // Mock validation
      anatomyClothingIntegrationService.validateClothingSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );

      // Mock equipment
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
      });

      const result = await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        { partsMap: mockAnatomyParts, slotEntityMappings: new Map() }
      );

      expect(result.instantiated).toHaveLength(3);
      expect(result.equipped).toHaveLength(2); // Only shirt and boots equipped
      expect(result.equipped).not.toContain('clothing_hat_123'); // Hat not equipped
    });

    it('should apply property overrides to instantiated entities', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [
          {
            entityId: 'clothing:fancy_shirt',
            equip: true,
            properties: {
              color: 'blue',
              quality: 'fine',
              condition: 0.9,
            },
          },
        ],
      };

      dataRegistry.get.mockImplementation((category, id) => {
        if (category === 'entityDefinitions' && id === 'clothing:fancy_shirt') {
          return {
            id: 'clothing:fancy_shirt',
            components: {
              'clothing:wearable': {
                equipmentSlots: { primary: 'torso_upper' },
              },
              'core:display': { color: 'white' },
            },
          };
        }
        return null;
      });

      entityManager.createEntityInstance.mockResolvedValue('clothing_123');
      anatomyClothingIntegrationService.validateClothingSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
      });

      await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        { partsMap: mockAnatomyParts, slotEntityMappings: new Map() }
      );

      // Verify property overrides were applied
      const createCall = entityManager.createEntityInstance.mock.calls[0];
      expect(createCall[0]).toBe('clothing:fancy_shirt');
      expect(createCall[1]).toMatchObject({
        color: 'blue',
        quality: 'fine',
        condition: 0.9,
      });
    });

    it('should respect layer override when equipping', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [
          {
            entityId: 'clothing:shirt',
            equip: true,
            layer: 'outer',
          },
        ],
      };

      dataRegistry.get.mockImplementation((category, id) => {
        if (category === 'entityDefinitions' && id === 'clothing:shirt') {
          return {
            id: 'clothing:shirt',
            components: {
              'clothing:wearable': {
                equipmentSlots: { primary: 'torso_upper' },
                layer: 'base',
              },
            },
          };
        }
        return null;
      });

      entityManager.createEntityInstance.mockResolvedValue('clothing_123');
      
      // Mock entity exists check
      entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'clothing_123') {
          return {
            id,
            getComponentData: jest.fn().mockReturnValue({
              equipmentSlots: { primary: 'torso_upper' },
              layer: 'base'
            })
          };
        }
        return null;
      });
      
      anatomyClothingIntegrationService.validateClothingSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
      });

      await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        { partsMap: mockAnatomyParts, slotEntityMappings: new Map() }
      );

      // Verify layer override was passed to equipment orchestrator
      expect(equipmentOrchestrator.orchestrateEquipment).toHaveBeenCalledWith(
        actorId,
        'clothing_123',
        expect.objectContaining({
          layer: 'outer',
        })
      );
    });

    it('should respect targetSlot override when equipping', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [
          {
            entityId: 'clothing:versatile_garment',
            equip: true,
            targetSlot: 'legs',
          },
        ],
      };

      dataRegistry.get.mockImplementation((category, id) => {
        if (
          category === 'entityDefinitions' &&
          id === 'clothing:versatile_garment'
        ) {
          return {
            id: 'clothing:versatile_garment',
            components: {
              'clothing:wearable': {
                equipmentSlots: { primary: 'torso_upper' },
              },
            },
          };
        }
        return null;
      });

      entityManager.createEntityInstance.mockResolvedValue('clothing_123');
      
      // Mock entity exists check
      entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'clothing_123') {
          return {
            id,
            getComponentData: jest.fn().mockReturnValue({
              equipmentSlots: { primary: 'torso_upper' },
              layer: 'base'
            })
          };
        }
        return null;
      });
      
      anatomyClothingIntegrationService.validateClothingSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
      });

      await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        { partsMap: mockAnatomyParts, slotEntityMappings: new Map() }
      );

      // Verify targetSlot override was passed
      expect(equipmentOrchestrator.orchestrateEquipment).toHaveBeenCalledWith(
        actorId,
        'clothing_123',
        expect.objectContaining({
          targetSlot: 'legs',
        })
      );
    });

    it('should skip validation when skipValidation is true', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [
          {
            entityId: 'clothing:special_item',
            equip: true,
            skipValidation: true,
          },
        ],
      };

      dataRegistry.get.mockImplementation((category, id) => {
        if (
          category === 'entityDefinitions' &&
          id === 'clothing:special_item'
        ) {
          return {
            id: 'clothing:special_item',
            components: {
              'clothing:wearable': { equipmentSlots: { primary: 'special' } },
            },
          };
        }
        return null;
      });

      entityManager.createEntityInstance.mockResolvedValue('clothing_123');
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
      });

      await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        { partsMap: mockAnatomyParts, slotEntityMappings: new Map() }
      );

      // Verify validation was skipped
      expect(
        anatomyClothingIntegrationService.validateClothingSlotCompatibility
      ).not.toHaveBeenCalled();
      expect(equipmentOrchestrator.orchestrateEquipment).toHaveBeenCalledWith(
        actorId,
        'clothing_123',
        expect.objectContaining({
          skipValidation: true,
        })
      );
    });

    it('should handle validation failure gracefully', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [
          {
            entityId: 'clothing:incompatible_item',
            equip: true,
          },
        ],
      };

      dataRegistry.get.mockImplementation((category, id) => {
        if (
          category === 'entityDefinitions' &&
          id === 'clothing:incompatible_item'
        ) {
          return {
            id: 'clothing:incompatible_item',
            components: {
              'clothing:wearable': { equipmentSlots: { primary: 'wings' } },
            },
          };
        }
        return null;
      });

      anatomyClothingIntegrationService.validateClothingSlotCompatibility.mockResolvedValue(
        {
          valid: false,
          reason: 'Blueprint does not support wings slot',
        }
      );

      const result = await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        { partsMap: mockAnatomyParts, slotEntityMappings: new Map() }
      );

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Clothing instance');
      expect(result.instantiated).toHaveLength(0);
    });

    it('should handle entity definition not found', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [
          {
            entityId: 'clothing:nonexistent',
            equip: true,
          },
        ],
      };

      dataRegistry.get.mockImplementation((category, id) => {
        // Return null for any entity lookups to simulate not found
        return null;
      });

      const result = await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        { partsMap: mockAnatomyParts, slotEntityMappings: new Map() }
      );

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain(
        "Entity definition 'clothing:nonexistent' not found in registry"
      );
    });

    it('should handle equipment failure gracefully', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [
          {
            entityId: 'clothing:shirt',
            equip: true,
          },
        ],
      };

      dataRegistry.get.mockImplementation((category, id) => {
        if (category === 'entityDefinitions' && id === 'clothing:shirt') {
          return {
            id: 'clothing:shirt',
            components: {
              'clothing:wearable': {
                equipmentSlots: { primary: 'torso_upper' },
              },
            },
          };
        }
        return null;
      });

      entityManager.createEntityInstance.mockResolvedValue('clothing_123');
      
      // Mock entity exists check
      entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'clothing_123') {
          return {
            id,
            getComponentData: jest.fn().mockReturnValue({
              equipmentSlots: { primary: 'torso_upper' },
              layer: 'base'
            })
          };
        }
        return null;
      });
      
      anatomyClothingIntegrationService.validateClothingSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );

      // Mock equipment failure
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: false,
        error: 'Slot already occupied',
      });

      const result = await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        { partsMap: mockAnatomyParts, slotEntityMappings: new Map() }
      );

      expect(result.instantiated).toHaveLength(1); // Item was created
      expect(result.equipped).toHaveLength(0); // But not equipped
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Slot already occupied');
    });

    it('should continue processing after individual item failure', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [
          {
            entityId: 'clothing:broken_item',
            equip: true,
          },
          {
            entityId: 'clothing:good_item',
            equip: true,
          },
        ],
      };

      // First item fails, second succeeds
      let callCount = 0;
      dataRegistry.get.mockImplementation((category, id) => {
        callCount++;
        if (category === 'entityDefinitions') {
          if (callCount === 1) {
            // First call returns null (broken item)
            return null;
          } else if (id === 'clothing:good_item') {
            return {
              id: 'clothing:good_item',
              components: {
                'clothing:wearable': { equipmentSlots: { primary: 'feet' } },
              },
            };
          }
        }
        return null;
      });

      entityManager.createEntityInstance.mockResolvedValue('clothing_good_123');
      
      // Mock entity exists check
      entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'clothing_good_123') {
          return {
            id,
            getComponentData: jest.fn().mockReturnValue({
              equipmentSlots: { primary: 'feet' },
              layer: 'base'
            })
          };
        }
        return null;
      });
      
      anatomyClothingIntegrationService.validateClothingSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
      });

      const result = await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        { partsMap: mockAnatomyParts, slotEntityMappings: new Map() }
      );

      expect(result.errors).toHaveLength(1); // One error from broken item
      expect(result.instantiated).toHaveLength(1); // Good item was created
      expect(result.equipped).toHaveLength(1); // Good item was equipped
    });

    it('should handle empty clothingEntities array', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [],
      };

      const result = await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        { partsMap: mockAnatomyParts, slotEntityMappings: new Map() }
      );

      expect(result).toEqual({
        instantiated: [],
        equipped: [],
        errors: [],
      });
      expect(eventBus.dispatch).not.toHaveBeenCalled();
    });

    it('should dispatch CLOTHING_INSTANTIATION_COMPLETED event with results', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [
          {
            entityId: 'clothing:shirt',
            equip: true,
          },
        ],
      };

      dataRegistry.get.mockImplementation((category, id) => {
        if (category === 'entityDefinitions' && id === 'clothing:shirt') {
          return {
            id: 'clothing:shirt',
            components: {
              'clothing:wearable': {
                equipmentSlots: { primary: 'torso_upper' },
              },
            },
          };
        }
        return null;
      });

      entityManager.createEntityInstance.mockResolvedValue('clothing_123');
      anatomyClothingIntegrationService.validateClothingSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
      });

      const result = await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        { partsMap: mockAnatomyParts, slotEntityMappings: new Map() }
      );

      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'clothing:instantiation_completed',
        {
          actorId,
          result,
        }
      );
    });

    it('should dispatch SYSTEM_ERROR_OCCURRED_ID when there are instantiation errors', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [
          {
            entityId: 'clothing:invalid_item',
            equip: true,
          },
          {
            entityId: 'clothing:another_invalid',
            equip: true,
          },
        ],
      };

      // Mock that both items fail validation
      dataRegistry.get.mockImplementation((category, id) => {
        if (category === 'entityDefinitions') {
          if (
            id === 'clothing:invalid_item' ||
            id === 'clothing:another_invalid'
          ) {
            return {
              id,
              components: {
                // Missing clothing:wearable component
                'core:name': { text: 'Invalid Item' },
              },
            };
          }
        }
        return null;
      });

      const result = await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        { partsMap: mockAnatomyParts, slotEntityMappings: new Map() }
      );

      // Verify system error was dispatched
      expect(eventBus.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
        message: 'Clothing instantiation failed for 2 items',
        details: {
          raw: expect.stringContaining('actorId'),
          timestamp: expect.any(String),
        },
      });

      // Also verify the completion event was still dispatched
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'clothing:instantiation_completed',
        expect.any(Object)
      );
    });

    it('should not dispatch SYSTEM_ERROR_OCCURRED_ID when all items succeed', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [
          {
            entityId: 'clothing:shirt',
            equip: true,
          },
        ],
      };

      dataRegistry.get.mockImplementation((category, id) => {
        if (category === 'entityDefinitions' && id === 'clothing:shirt') {
          return {
            id: 'clothing:shirt',
            components: {
              'clothing:wearable': {
                equipmentSlots: { primary: 'torso_upper' },
              },
            },
          };
        }
        return null;
      });

      entityManager.createEntityInstance.mockResolvedValue('clothing_123');
      
      // Mock entity exists check
      entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'clothing_123') {
          return {
            id,
            getComponentData: jest.fn().mockReturnValue({
              equipmentSlots: { primary: 'torso_upper' },
              layer: 'base'
            })
          };
        }
        return null;
      });
      
      anatomyClothingIntegrationService.validateClothingSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
      });

      await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        { partsMap: mockAnatomyParts, slotEntityMappings: new Map() }
      );

      // Verify system error was NOT dispatched
      expect(eventBus.dispatch).not.toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Object)
      );

      // But completion event should still be dispatched
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'clothing:instantiation_completed',
        expect.any(Object)
      );
    });
  });
});
