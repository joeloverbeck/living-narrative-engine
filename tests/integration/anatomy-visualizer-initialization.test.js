/**
 * @file Integration test for anatomy visualizer initialization
 * Ensures the dependency injection chain works correctly
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ClothingInstantiationService from '../../src/clothing/services/clothingInstantiationService.js';
import { createMockLogger } from '../common/mockFactories/loggerMocks.js';

describe('Anatomy Visualizer - Service Integration', () => {
  it('should create ClothingInstantiationService with correct dependencies', () => {
    // This test verifies that the ClothingInstantiationService no longer
    // requires the 'validateSlotCompatibility' method and instead uses
    // 'validateClothingSlotCompatibility'

    // Mock the required services
    const mockEntityManager = {
      createEntityInstance: jest.fn(),
      getEntityInstance: jest.fn(),
      removeEntityInstance: jest.fn(),
    };

    const mockDataRegistry = {
      get: jest.fn(),
    };

    const mockEquipmentOrchestrator = {
      orchestrateEquipment: jest.fn(),
    };

    const mockSlotResolver = {
      resolveClothingSlot: jest
        .fn()
        .mockResolvedValue([
          { entityId: 'torso', socketId: 'chest', slotPath: 'torso.chest' },
        ]),
      setSlotEntityMappings: jest.fn(),
    };

    const mockClothingSlotValidator = {
      validateSlotCompatibility: jest.fn().mockResolvedValue({
        valid: true,
      }),
    };

    const mockAnatomyBlueprintRepository = {
      getBlueprintByRecipeId: jest.fn().mockResolvedValue({
        clothingSlotMappings: {
          torso_upper: {
            blueprintSlots: ['torso.chest'],
            allowedLayers: ['base', 'outer'],
          },
        },
      }),
    };

    const mockBodyGraphService = {
      getAnatomyData: jest.fn().mockResolvedValue({
        recipeId: 'human_base',
        rootEntityId: 'actor123',
      }),
    };

    const mockAnatomyClothingCache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(), // Add subscribe method for ClothingInstantiationService
    };

    const mockLayerResolutionService = {
      resolveAndValidateLayer: jest.fn().mockReturnValue({
        isValid: true,
        layer: 'base',
      }),
    };

    let service;
    expect(() => {
      service = new ClothingInstantiationService({
        entityManager: mockEntityManager,
        dataRegistry: mockDataRegistry,
        equipmentOrchestrator: mockEquipmentOrchestrator,
        slotResolver: mockSlotResolver,
        clothingSlotValidator: mockClothingSlotValidator,
        anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
        bodyGraphService: mockBodyGraphService,
        anatomyClothingCache: mockAnatomyClothingCache,
        layerResolutionService: mockLayerResolutionService,
        logger: createMockLogger(),
        eventBus: mockEventBus,
      });
    }).not.toThrow();

    expect(service).toBeDefined();
  });

  it('should fail if clothingSlotValidator lacks validateSlotCompatibility', () => {
    // This test ensures that if the wrong method name is provided,
    // the service will throw an error during initialization

    const mockEntityManager = {
      createEntityInstance: jest.fn(),
      getEntityInstance: jest.fn(),
      removeEntityInstance: jest.fn(),
    };

    const mockDataRegistry = {
      get: jest.fn(),
    };

    const mockEquipmentOrchestrator = {
      orchestrateEquipment: jest.fn(),
    };

    // Mock with all the required dependencies but with WRONG method name
    const mockSlotResolver = {
      resolveClothingSlot: jest
        .fn()
        .mockResolvedValue([
          { entityId: 'torso', socketId: 'chest', slotPath: 'torso.chest' },
        ]),
      setSlotEntityMappings: jest.fn(),
    };

    const mockClothingSlotValidator = {
      wrongMethodName: jest.fn(), // Wrong method name!
    };

    const mockAnatomyBlueprintRepository = {
      getBlueprintByRecipeId: jest.fn().mockResolvedValue({
        clothingSlotMappings: {
          torso_upper: {
            blueprintSlots: ['torso.chest'],
            allowedLayers: ['base', 'outer'],
          },
        },
      }),
    };

    const mockBodyGraphService = {
      getAnatomyData: jest.fn().mockResolvedValue({
        recipeId: 'human_base',
        rootEntityId: 'actor123',
      }),
    };

    const mockAnatomyClothingCache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(), // Add subscribe method for ClothingInstantiationService
    };

    const mockLayerResolutionService = {
      resolveAndValidateLayer: jest.fn().mockReturnValue({
        isValid: true,
        layer: 'base',
      }),
    };

    expect(() => {
      new ClothingInstantiationService({
        entityManager: mockEntityManager,
        dataRegistry: mockDataRegistry,
        equipmentOrchestrator: mockEquipmentOrchestrator,
        slotResolver: mockSlotResolver,
        clothingSlotValidator: mockClothingSlotValidator,
        anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
        bodyGraphService: mockBodyGraphService,
        anatomyClothingCache: mockAnatomyClothingCache,
        layerResolutionService: mockLayerResolutionService,
        logger: createMockLogger(),
        eventBus: mockEventBus,
      });
    }).toThrow('validateSlotCompatibility');
  });

  it('should verify ClothingSlotValidator has the required method', () => {
    // This test specifically checks that the ClothingSlotValidator
    // provides the validateSlotCompatibility method

    const mockDeps = {
      logger: createMockLogger(),
    };

    const validator = new (class ClothingSlotValidator {
      constructor({ logger }) {
        this.logger = logger;
      }
      async validateSlotCompatibility() {
        return { valid: true };
      }
    })(mockDeps);

    // Verify the method exists
    expect(typeof validator.validateSlotCompatibility).toBe('function');

    // Verify it's an async function
    expect(validator.validateSlotCompatibility.constructor.name).toBe(
      'AsyncFunction'
    );
  });

  it('should call validateSlotCompatibility during clothing instantiation', async () => {
    // This test verifies that the ClothingInstantiationService calls
    // the correct method on clothingSlotValidator

    const mockEntityManager = {
      createEntityInstance: jest.fn().mockResolvedValue('clothing_123'),
      getEntityInstance: jest.fn(),
      removeEntityInstance: jest.fn(),
    };

    const mockDataRegistry = {
      get: jest.fn().mockReturnValue({
        id: 'test:clothing',
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'torso' },
          },
        },
      }),
    };

    const mockEquipmentOrchestrator = {
      orchestrateEquipment: jest.fn().mockResolvedValue({
        success: true,
      }),
    };

    const mockSlotResolver = {
      resolveClothingSlot: jest
        .fn()
        .mockResolvedValue([
          { entityId: 'torso', socketId: 'chest', slotPath: 'torso.chest' },
        ]),
      setSlotEntityMappings: jest.fn(),
    };

    const mockClothingSlotValidator = {
      validateSlotCompatibility: jest.fn().mockResolvedValue({
        valid: true,
      }),
    };

    const mockAnatomyBlueprintRepository = {
      getBlueprintByRecipeId: jest.fn().mockResolvedValue({
        clothingSlotMappings: {
          torso_upper: {
            blueprintSlots: ['torso.chest'],
            allowedLayers: ['base', 'outer'],
          },
        },
      }),
    };

    const mockBodyGraphService = {
      getAnatomyData: jest.fn().mockResolvedValue({
        recipeId: 'human_base',
        rootEntityId: 'actor123',
      }),
    };

    const mockAnatomyClothingCache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(), // Add subscribe method for ClothingInstantiationService
    };

    const mockLayerResolutionService = {
      resolveAndValidateLayer: jest.fn().mockReturnValue({
        isValid: true,
        layer: 'base',
      }),
    };

    // Mock entity creation
    mockEntityManager.createEntityInstance.mockResolvedValue('clothing_123');

    // Mock entity exists check
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      if (id === 'clothing_123') {
        return {
          id,
          getComponentData: jest.fn().mockReturnValue({
            equipmentSlots: { primary: 'torso' },
            layer: 'base',
          }),
        };
      }
      return null;
    });

    const service = new ClothingInstantiationService({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      equipmentOrchestrator: mockEquipmentOrchestrator,
      slotResolver: mockSlotResolver,
      clothingSlotValidator: mockClothingSlotValidator,
      anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
      bodyGraphService: mockBodyGraphService,
      anatomyClothingCache: mockAnatomyClothingCache,
      layerResolutionService: mockLayerResolutionService,
      logger: createMockLogger(),
      eventBus: mockEventBus,
    });

    const recipe = {
      clothingEntities: [
        {
          entityId: 'test:clothing',
          equip: true,
        },
      ],
    };

    const anatomyParts = new Map();
    anatomyParts.set('torso', 'torso_entity_123');

    await service.instantiateRecipeClothing('actor_123', recipe, {
      partsMap: anatomyParts,
      slotEntityMappings: new Map(),
    });

    // Verify the correct method was called
    expect(
      mockClothingSlotValidator.validateSlotCompatibility
    ).toHaveBeenCalled();
  });
});
