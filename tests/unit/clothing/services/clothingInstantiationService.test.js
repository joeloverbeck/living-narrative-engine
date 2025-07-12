/**
 * @file Test suite for ClothingInstantiationService
 * @see src/clothing/services/clothingInstantiationService.js
 */

import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { ClothingInstantiationService } from '../../../../src/clothing/services/clothingInstantiationService.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

/** Helper to create minimal mocks for dependencies */
function createMocks() {
  return {
    entityManager: {
      createEntityInstance: jest.fn(),
      getEntityInstance: jest.fn(),
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
  let logger;
  let eventBus;
  let service;

  beforeEach(() => {
    ({
      entityManager,
      dataRegistry,
      equipmentOrchestrator,
      anatomyClothingIntegrationService,
      logger,
      eventBus,
    } = createMocks());

    service = new ClothingInstantiationService({
      entityManager,
      dataRegistry,
      equipmentOrchestrator,
      anatomyClothingIntegrationService,
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
        mockAnatomyParts
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
        if (category === 'entityDefinitions' && id === 'clothing:simple_shirt') {
          return {
            id: 'clothing:simple_shirt',
            components: {
              'core:name': { text: 'Simple Shirt' },
              'clothing:clothing': { slot: 'torso_upper' },
            },
          };
        }
        return null;
      });

      // Mock entity creation
      const createdClothingId = 'clothing_123';
      entityManager.createEntityInstance.mockResolvedValue(createdClothingId);

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
        mockAnatomyParts
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
              components: { 'clothing:clothing': { slot: 'torso_upper' } },
            };
          case 'clothing:leather_boots':
            return {
              id: 'clothing:leather_boots',
              components: { 'clothing:clothing': { slot: 'feet' } },
            };
          case 'clothing:straw_hat':
            return {
              id: 'clothing:straw_hat',
              components: { 'clothing:clothing': { slot: 'head' } },
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
        mockAnatomyParts
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
              'clothing:clothing': { slot: 'torso_upper' },
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
        mockAnatomyParts
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
              'clothing:clothing': { slot: 'torso_upper', layer: 'base' },
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
        mockAnatomyParts
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
        if (category === 'entityDefinitions' && id === 'clothing:versatile_garment') {
          return {
            id: 'clothing:versatile_garment',
            components: { 'clothing:clothing': { slot: 'torso_upper' } },
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
        mockAnatomyParts
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
        if (category === 'entityDefinitions' && id === 'clothing:special_item') {
          return {
            id: 'clothing:special_item',
            components: { 'clothing:clothing': { slot: 'special' } },
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
        mockAnatomyParts
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
        if (category === 'entityDefinitions' && id === 'clothing:incompatible_item') {
          return {
            id: 'clothing:incompatible_item',
            components: { 'clothing:clothing': { slot: 'wings' } },
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
        mockAnatomyParts
      );

      expect(result.errors).toContain('Blueprint does not support wings slot');
      expect(result.instantiated).toHaveLength(0);
      expect(entityManager.createEntityInstance).not.toHaveBeenCalled();
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
        mockAnatomyParts
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
            components: { 'clothing:clothing': { slot: 'torso_upper' } },
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

      // Mock equipment failure
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: false,
        error: 'Slot already occupied',
      });

      const result = await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        mockAnatomyParts
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
              components: { 'clothing:clothing': { slot: 'feet' } },
            };
          }
        }
        return null;
      });

      entityManager.createEntityInstance.mockResolvedValue('clothing_good_123');
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
        mockAnatomyParts
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
        mockAnatomyParts
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
            components: { 'clothing:clothing': { slot: 'torso_upper' } },
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
        mockAnatomyParts
      );

      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'clothing:instantiation_completed',
        {
          actorId,
          result,
        }
      );
    });
  });
});
