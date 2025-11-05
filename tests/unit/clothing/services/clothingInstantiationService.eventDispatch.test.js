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
    slotResolver: {
      resolveClothingSlot: jest
        .fn()
        .mockResolvedValue([
          { entityId: 'torso', socketId: 'chest', slotPath: 'torso.chest' },
        ]),
      setSlotEntityMappings: jest.fn(),
    },
    clothingSlotValidator: {
      validateSlotCompatibility: jest.fn().mockResolvedValue({
        valid: true,
      }),
    },
    anatomyBlueprintRepository: {
      getBlueprintByRecipeId: jest.fn().mockResolvedValue({
        clothingSlotMappings: {
          torso_upper: {
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
      resolveAndValidateLayer: jest
        .fn()
        .mockImplementation(
          (recipeLayer, entityLayer, blueprintLayer, allowedLayers) => {
            const layer =
              recipeLayer || entityLayer || blueprintLayer || 'base';
            return {
              isValid: true,
              layer: layer,
            };
          }
        ),
    },
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    eventBus: {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    },
  };
}

describe('ClothingInstantiationService - Event Dispatching', () => {
  let entityManager;
  let dataRegistry;
  let equipmentOrchestrator;
  let slotResolver;
  let clothingSlotValidator;
  let anatomyBlueprintRepository;
  let bodyGraphService;
  let anatomyClothingCache;
  let layerResolutionService;
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
      slotResolver,
      clothingSlotValidator,
      anatomyBlueprintRepository,
      bodyGraphService,
      anatomyClothingCache,
      layerResolutionService,
      logger,
      eventBus,
    } = createMocks());

    service = new ClothingInstantiationService({
      entityManager,
      dataRegistry,
      equipmentOrchestrator,
      slotResolver,
      clothingSlotValidator,
      anatomyBlueprintRepository,
      bodyGraphService,
      anatomyClothingCache,
      layerResolutionService,
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
        if (
          category === 'entityDefinitions' &&
          id === 'clothing:simple_shirt'
        ) {
          return {
            id: 'clothing:simple_shirt',
            components: {
              'clothing:wearable': {
                equipmentSlots: { primary: 'torso_upper' },
              },
            },
          };
        }
        return null;
      });

      // Mock successful validation
      clothingSlotValidator.validateSlotCompatibility.mockResolvedValue({
        valid: true,
      });

      // Mock entity creation
      entityManager.createEntityInstance.mockResolvedValue('clothing_123');

      // Mock entity existence check
      entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'clothing_123') {
          return {
            id,
            getComponentData: jest.fn().mockReturnValue({
              equipmentSlots: { primary: 'torso_upper' },
              layer: 'base',
            }),
          };
        }
        return null;
      });

      // Mock equipment
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
      });

      await service.instantiateRecipeClothing(actorId, recipeWithClothing, {
        partsMap: mockAnatomyParts,
        slotEntityMappings: new Map(),
      });

      // Verify dispatch was called with correct format
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'clothing:instantiation_completed', // First argument: string event name
        {
          // Second argument: object payload
          actorId,
          result: {
            instantiated: [
              {
                clothingId: 'clothing_123',
                entityDefinitionId: 'clothing:simple_shirt',
              },
            ],
            equipped: [
              {
                clothingId: 'clothing_123',
                entityDefinitionId: 'clothing:simple_shirt',
              },
            ],
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

      await service.instantiateRecipeClothing(actorId, recipeWithoutClothing, {
        partsMap: mockAnatomyParts,
        slotEntityMappings: new Map(),
      });

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

      await service.instantiateRecipeClothing(actorId, recipeWithClothing, {
        partsMap: mockAnatomyParts,
        slotEntityMappings: new Map(),
      });

      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'clothing:instantiation_completed',
        {
          actorId,
          result: {
            instantiated: [],
            equipped: [],
            errors: [
              "clothing:invalid_item: Entity definition 'clothing:invalid_item' not found in registry",
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
        if (category !== 'entityDefinitions') return null;
        switch (id) {
          case 'clothing:valid_shirt':
            return {
              id: 'clothing:valid_shirt',
              components: {
                'clothing:wearable': {
                  equipmentSlots: { primary: 'torso_upper' },
                },
              },
            };
          case 'clothing:valid_boots':
            return {
              id: 'clothing:valid_boots',
              components: {
                'clothing:wearable': { equipmentSlots: { primary: 'feet' } },
              },
            };
          default:
            return null;
        }
      });

      // Mock validation
      clothingSlotValidator.validateSlotCompatibility.mockResolvedValue({
        valid: true,
      });

      // Mock entity creation
      entityManager.createEntityInstance
        .mockResolvedValueOnce('shirt_123')
        .mockResolvedValueOnce('boots_123');

      // Mock entity existence check
      entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'shirt_123') {
          return {
            id,
            getComponentData: jest.fn().mockReturnValue({
              equipmentSlots: { primary: 'torso_upper' },
              layer: 'base',
            }),
          };
        } else if (id === 'boots_123') {
          return {
            id,
            getComponentData: jest.fn().mockReturnValue({
              equipmentSlots: { primary: 'feet' },
              layer: 'outer',
            }),
          };
        }
        return null;
      });

      // Mock equipment (only shirt is equipped)
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
      });

      await service.instantiateRecipeClothing(actorId, recipeWithClothing, {
        partsMap: mockAnatomyParts,
        slotEntityMappings: new Map(),
      });

      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'clothing:instantiation_completed',
        {
          actorId,
          result: {
            instantiated: [
              {
                clothingId: 'shirt_123',
                entityDefinitionId: 'clothing:valid_shirt',
              },
              {
                clothingId: 'boots_123',
                entityDefinitionId: 'clothing:valid_boots',
              },
            ],
            equipped: [
              {
                clothingId: 'shirt_123',
                entityDefinitionId: 'clothing:valid_shirt',
              },
            ],
            errors: [
              "clothing:invalid_item: Entity definition 'clothing:invalid_item' not found in registry",
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
        components: {
          'clothing:wearable': { equipmentSlots: { primary: 'test' } },
        },
      });
      clothingSlotValidator.validateSlotCompatibility.mockResolvedValue({
        valid: true,
      });
      entityManager.createEntityInstance.mockResolvedValue('test_123');

      // Mock entity existence check
      entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'test_123') {
          return {
            id,
            getComponentData: jest.fn().mockReturnValue({
              equipmentSlots: { primary: 'test' },
              layer: 'base',
            }),
          };
        }
        return null;
      });

      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
      });

      await service.instantiateRecipeClothing(actorId, recipeWithClothing, {
        partsMap: mockAnatomyParts,
        slotEntityMappings: new Map(),
      });

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
      expect(firstArg).not.toEqual(
        expect.objectContaining({ type: expect.any(String) })
      );
    });
  });
});
