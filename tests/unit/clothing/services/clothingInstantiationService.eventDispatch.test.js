/**
 * @file Focused test suite for event dispatching in ClothingInstantiationService
 * @see src/clothing/services/clothingInstantiationService.js
 */

import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { ClothingInstantiationService } from '../../../../src/clothing/services/clothingInstantiationService.js';

/** Helper to create minimal mocks for dependencies */
function createMocks() {
  return {
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
    anatomyClothingIntegrationService: {
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

describe('ClothingInstantiationService - Event Dispatching', () => {
  let entityManager;
  let dataRegistry;
  let equipmentOrchestrator;
  let anatomyClothingIntegrationService;
  let logger;
  let eventBus;
  let service;

  const actorId = 'actor_123';
  const mockRecipe = {
    id: 'test_recipe',
    version: '1.0.0',
  };
  const mockAnatomyParts = new Map([
    ['torso', 'torso_entity_123'],
    ['head', 'head_entity_123'],
  ]);

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

  describe('Event dispatch format', () => {
    it('should dispatch clothing:instantiation_completed event with correct format (string event name, object payload)', async () => {
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
        if (category === 'entities' && id === 'clothing:simple_shirt') {
          return {
            id: 'clothing:simple_shirt',
            components: {
              'clothing:clothing': { slot: 'torso_upper' },
            },
          };
        }
        return null;
      });

      // Mock successful validation
      anatomyClothingIntegrationService.validateClothingSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );

      // Mock entity creation
      entityManager.createEntityInstance.mockResolvedValue('clothing_123');

      // Mock equipment
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
      });

      await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        mockAnatomyParts
      );

      // Verify dispatch was called with correct format
      expect(eventBus.dispatch).toHaveBeenCalledTimes(1);
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'clothing:instantiation_completed', // First argument: string event name
        {
          // Second argument: object payload
          actorId,
          result: {
            instantiated: [
              {
                id: 'clothing_123',
                definitionId: 'clothing:simple_shirt',
              },
            ],
            equipped: ['clothing_123'],
            errors: [],
          },
        }
      );

      // Verify it was NOT called with the old format
      expect(eventBus.dispatch).not.toHaveBeenCalledWith({
        type: 'clothing:instantiation_completed',
        payload: expect.any(Object),
      });
    });

    it('should dispatch event even when no clothing entities are processed', async () => {
      const recipeWithoutClothing = {
        ...mockRecipe,
        clothingEntities: [],
      };

      await service.instantiateRecipeClothing(
        actorId,
        recipeWithoutClothing,
        mockAnatomyParts
      );

      // Should not dispatch when no clothing entities
      expect(eventBus.dispatch).not.toHaveBeenCalled();
    });

    it('should dispatch event with errors when clothing instantiation fails', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [
          {
            entityId: 'clothing:invalid_item',
            equip: true,
          },
        ],
      };

      // Mock missing entity definition
      dataRegistry.get.mockReturnValue(null);

      await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        mockAnatomyParts
      );

      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'clothing:instantiation_completed',
        {
          actorId,
          result: {
            instantiated: [],
            equipped: [],
            errors: [
              "Entity definition 'clothing:invalid_item' not found in registry",
            ],
          },
        }
      );
    });

    it('should dispatch event with mixed success and failure results', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [
          {
            entityId: 'clothing:valid_shirt',
            equip: true,
          },
          {
            entityId: 'clothing:invalid_item',
            equip: true,
          },
          {
            entityId: 'clothing:valid_boots',
            equip: false,
          },
        ],
      };

      // Mock entity definitions
      dataRegistry.get.mockImplementation((category, id) => {
        if (category !== 'entities') return null;
        switch (id) {
          case 'clothing:valid_shirt':
            return {
              id: 'clothing:valid_shirt',
              components: { 'clothing:clothing': { slot: 'torso_upper' } },
            };
          case 'clothing:valid_boots':
            return {
              id: 'clothing:valid_boots',
              components: { 'clothing:clothing': { slot: 'feet' } },
            };
          default:
            return null;
        }
      });

      // Mock validation
      anatomyClothingIntegrationService.validateClothingSlotCompatibility.mockResolvedValue(
        {
          valid: true,
        }
      );

      // Mock entity creation
      entityManager.createEntityInstance
        .mockResolvedValueOnce('shirt_123')
        .mockResolvedValueOnce('boots_123');

      // Mock equipment (only shirt is equipped)
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
      });

      await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        mockAnatomyParts
      );

      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'clothing:instantiation_completed',
        {
          actorId,
          result: {
            instantiated: [
              {
                id: 'shirt_123',
                definitionId: 'clothing:valid_shirt',
              },
              {
                id: 'boots_123',
                definitionId: 'clothing:valid_boots',
              },
            ],
            equipped: ['shirt_123'],
            errors: [
              "Entity definition 'clothing:invalid_item' not found in registry",
            ],
          },
        }
      );
    });

    it('should verify eventBus dispatch parameters are NOT an object with type property', async () => {
      const recipeWithClothing = {
        ...mockRecipe,
        clothingEntities: [{ entityId: 'clothing:test', equip: true }],
      };

      dataRegistry.get.mockReturnValue({
        id: 'clothing:test',
        components: { 'clothing:clothing': { slot: 'test' } },
      });
      anatomyClothingIntegrationService.validateClothingSlotCompatibility.mockResolvedValue(
        { valid: true }
      );
      entityManager.createEntityInstance.mockResolvedValue('test_123');
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
      });

      await service.instantiateRecipeClothing(
        actorId,
        recipeWithClothing,
        mockAnatomyParts
      );

      // Get the actual call arguments
      const dispatchCalls = eventBus.dispatch.mock.calls;
      expect(dispatchCalls).toHaveLength(1);

      const [firstArg, secondArg] = dispatchCalls[0];

      // First argument should be a string (event name)
      expect(typeof firstArg).toBe('string');
      expect(firstArg).toBe('clothing:instantiation_completed');

      // Second argument should be an object (payload)
      expect(typeof secondArg).toBe('object');
      expect(secondArg).not.toHaveProperty('type');
      expect(secondArg).toHaveProperty('actorId');
      expect(secondArg).toHaveProperty('result');

      // First argument should NOT be an object with type property
      expect(typeof firstArg).toBe('string');
      expect(firstArg).not.toEqual(expect.objectContaining({ type: expect.any(String) }));
    });
  });
});