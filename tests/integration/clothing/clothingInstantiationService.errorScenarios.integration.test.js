import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClothingInstantiationService } from '../../../src/clothing/services/clothingInstantiationService.js';
import { CacheKeyTypes } from '../../../src/anatomy/cache/AnatomyClothingCache.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import {
  createMockLogger,
  createCapturingEventBus,
} from '../../common/mockFactories/index.js';

const baseClothingDefinition = {
  components: {
    'clothing:wearable': {
      equipmentSlots: { primary: 'torso' },
      layer: 'base',
      allowedLayers: ['base', 'outer', 'accessories'],
    },
  },
};

const recipeId = 'core:test_recipe';
const actorId = 'actor:test';

/**
 * Creates a fully wired ClothingInstantiationService with production collaborators
 * replaced by lightweight in-memory test doubles that preserve behaviour.
 *
 * @param {object} [overrides] - Dependency overrides
 * @returns {{ service: ClothingInstantiationService, dependencies: object }}
 */
function createService(overrides = {}) {
  const logger = overrides.logger ?? createMockLogger();
  const eventBus = overrides.eventBus ?? createCapturingEventBus();

  const clothingInstances = new Map();

  const actorEntity = {
    id: actorId,
    getComponentData: jest.fn((componentId) => {
      if (componentId === 'anatomy:body') {
        return { recipeId };
      }
      return null;
    }),
  };

  const dataRegistry = {
    get: jest.fn((collection, id) => {
      if (collection === 'anatomyRecipes' && id === recipeId) {
        return (
          overrides.recipe ?? {
            clothingEntities: [
              {
                entityId: 'core:shirt',
                targetSlot: 'torso',
                equip: true,
              },
            ],
          }
        );
      }
      if (collection === 'entityDefinitions') {
        const definitions = overrides.entityDefinitions ?? {
          'core:shirt': baseClothingDefinition,
        };
        return definitions[id];
      }
      return null;
    }),
  };

  const entityManager = {
    createEntityInstance: jest.fn(async (entityDefId, options) => {
      if (overrides.createEntityInstance) {
        return overrides.createEntityInstance(entityDefId, options, {
          clothingInstances,
        });
      }
      const clothingEntity = {
        id: `${entityDefId}:instance`,
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'clothing:wearable') {
            return (
              overrides.createdClothingComponents?.get(clothingEntity.id) ?? {
                equipmentSlots: { primary: 'torso' },
              }
            );
          }
          return null;
        }),
      };
      clothingInstances.set(clothingEntity.id, clothingEntity);
      return clothingEntity;
    }),
    getEntityInstance: jest.fn((id) => {
      if (id === actorId) {
        return actorEntity;
      }
      if (overrides.getEntityInstance) {
        const custom = overrides.getEntityInstance(id, { clothingInstances });
        if (custom !== undefined) {
          return custom;
        }
      }
      return clothingInstances.get(id) ?? null;
    }),
  };

  const slotResolver = {
    setSlotEntityMappings: jest.fn(),
    resolveClothingSlot: jest.fn().mockResolvedValue(['torso-socket']),
  };

  const clothingSlotValidator = {
    validateSlotCompatibility: jest.fn().mockResolvedValue({ valid: true }),
  };

  const anatomyBlueprintRepository = {
    getBlueprintByRecipeId: jest.fn().mockResolvedValue({
      clothingSlotMappings: {
        torso: { socketIds: ['torso-socket'] },
      },
    }),
  };

  const bodyGraphService = {
    getAnatomyData: jest.fn().mockResolvedValue({ recipeId }),
  };

  const validationCache = new Map();
  const availableSlotsCache = new Map();
  const anatomyClothingCache = {
    get: jest.fn((type, key) => {
      if (type === CacheKeyTypes.VALIDATION) {
        return validationCache.get(key);
      }
      if (type === CacheKeyTypes.AVAILABLE_SLOTS) {
        return availableSlotsCache.get(key);
      }
      return undefined;
    }),
    set: jest.fn((type, key, value) => {
      if (type === CacheKeyTypes.VALIDATION) {
        validationCache.set(key, value);
      } else if (type === CacheKeyTypes.AVAILABLE_SLOTS) {
        availableSlotsCache.set(key, value);
      }
    }),
  };

  const layerResolutionService = {
    resolveAndValidateLayer: jest
      .fn()
      .mockReturnValue({ isValid: true, layer: 'base' }),
  };

  const equipmentOrchestrator = {
    orchestrateEquipment: jest
      .fn()
      .mockResolvedValue({ success: true, errors: [] }),
  };

  const service = new ClothingInstantiationService({
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

  return {
    service,
    dependencies: {
      logger,
      eventBus,
      entityManager,
      dataRegistry,
      equipmentOrchestrator,
      slotResolver,
      clothingSlotValidator,
      anatomyBlueprintRepository,
      bodyGraphService,
      anatomyClothingCache,
      validationCache,
      availableSlotsCache,
      layerResolutionService,
    },
  };
}

describe('ClothingInstantiationService integration error coverage', () => {
  let service;
  let deps;

  beforeEach(() => {
    ({ service, dependencies: deps } = createService());
  });

  it('propagates equipment failures and emits system error events', async () => {
    deps.equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
      success: false,
      errors: ['slot blocked'],
    });

    const recipe = {
      clothingEntities: [
        {
          entityId: 'core:shirt',
          targetSlot: 'torso',
          equip: true,
        },
      ],
    };

    deps.dataRegistry.get.mockImplementation((collection, id) => {
      if (collection === 'anatomyRecipes') {
        return recipe;
      }
      if (collection === 'entityDefinitions') {
        return baseClothingDefinition;
      }
      return null;
    });

    const result = await service.instantiateRecipeClothing(actorId, recipe, {
      partsMap: new Map([['torso', 'entity:torso']]),
      slotEntityMappings: new Map([['torso', 'entity:torso']]),
    });

    expect(result.errors).toContain('slot blocked');
    expect(result.equipped).toHaveLength(0);
    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to equip clothing')
    );

    const dispatchedTypes = deps.eventBus.events.map(
      (event) => event.eventType
    );
    expect(dispatchedTypes).toContain('clothing:instantiation_completed');
    expect(dispatchedTypes).toContain(SYSTEM_ERROR_OCCURRED_ID);

    const systemEvent = deps.eventBus.events.find(
      (event) => event.eventType === SYSTEM_ERROR_OCCURRED_ID
    );
    expect(systemEvent.payload.details.raw).toContain('slot blocked');
  });

  it('short-circuits slot validation when cache already contains a result', async () => {
    const cachedId = 'core:shirt:cached-instance';

    const cachedSlots = new Map([['torso', { socketIds: ['torso-socket'] }]]);

    deps.anatomyClothingCache.get.mockImplementation((type, key) => {
      if (type === CacheKeyTypes.VALIDATION) {
        if (key === `${actorId}:torso:${cachedId}`) {
          return { valid: true };
        }
        return undefined;
      }
      if (type === CacheKeyTypes.AVAILABLE_SLOTS) {
        if (key === `${CacheKeyTypes.AVAILABLE_SLOTS}:${actorId}`) {
          return cachedSlots;
        }
        return undefined;
      }
      return undefined;
    });

    deps.entityManager.createEntityInstance.mockImplementation(async () => {
      const clothingEntity = {
        id: cachedId,
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'clothing:wearable') {
            return { equipmentSlots: { primary: 'torso' } };
          }
          return null;
        }),
      };
      return clothingEntity.id;
    });

    const storedInstance = {
      id: cachedId,
      getComponentData: jest.fn(() => ({
        equipmentSlots: { primary: 'torso' },
      })),
    };

    deps.entityManager.getEntityInstance.mockImplementation((id) => {
      if (id === cachedId) {
        return storedInstance;
      }
      if (id === actorId) {
        return {
          getComponentData: jest.fn(() => ({ recipeId })),
        };
      }
      return null;
    });

    const recipe = {
      clothingEntities: [
        {
          entityId: 'core:shirt',
          targetSlot: 'torso',
        },
      ],
    };

    await service.instantiateRecipeClothing(actorId, recipe, {
      partsMap: new Map(),
      slotEntityMappings: new Map(),
    });

    expect(
      deps.clothingSlotValidator.validateSlotCompatibility
    ).not.toHaveBeenCalled();
    expect(deps.slotResolver.resolveClothingSlot).not.toHaveBeenCalled();
  });

  it('returns empty maps when anatomy data or blueprints are missing and logs appropriately', async () => {
    const recipe = {
      clothingEntities: [
        {
          entityId: 'core:shirt',
          targetSlot: 'torso',
        },
      ],
    };

    const { service: missingAnatomyService, dependencies: missingAnatomyDeps } =
      createService();
    missingAnatomyDeps.bodyGraphService.getAnatomyData.mockResolvedValue(null);
    await missingAnatomyService.instantiateRecipeClothing(actorId, recipe, {
      partsMap: new Map(),
      slotEntityMappings: new Map(),
    });
    expect(
      missingAnatomyDeps.logger.debug.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('No anatomy data found for entity')
      )
    ).toBe(true);

    const {
      service: missingBlueprintService,
      dependencies: missingBlueprintDeps,
    } = createService();
    missingBlueprintDeps.bodyGraphService.getAnatomyData.mockResolvedValue({
      recipeId,
    });
    missingBlueprintDeps.anatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
      {}
    );
    await missingBlueprintService.instantiateRecipeClothing(actorId, recipe, {
      partsMap: new Map(),
      slotEntityMappings: new Map(),
    });
    expect(
      missingBlueprintDeps.logger.debug.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('No clothing slot mappings in blueprint')
      )
    ).toBe(true);

    const {
      service: failingBlueprintService,
      dependencies: failingBlueprintDeps,
    } = createService();
    const error = new Error('blueprint failure');
    failingBlueprintDeps.bodyGraphService.getAnatomyData.mockRejectedValue(
      error
    );
    await failingBlueprintService.instantiateRecipeClothing(actorId, recipe, {
      partsMap: new Map(),
      slotEntityMappings: new Map(),
    });
    expect(failingBlueprintDeps.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to get available clothing slots'),
      error
    );
  });

  it('collects detailed validation errors for problematic clothing instances', async () => {
    const sequence = [
      'core:missing',
      'core:noComponent',
      'core:noSlot',
      'core:validationFailure',
      'core:validatorException',
      'core:componentException',
    ];
    const definitions = Object.fromEntries(
      sequence.map((id) => [id, baseClothingDefinition])
    );

    ({ service, dependencies: deps } = createService({
      entityDefinitions: definitions,
      recipe: {
        clothingEntities: sequence.map((entityId) => {
          const config = { entityId, equip: false };
          if (entityId !== 'core:noSlot') {
            config.targetSlot = 'torso';
          }
          return config;
        }),
      },
      createEntityInstance: (entityDefId, _options, { clothingInstances }) => {
        const instanceId = `${entityDefId}:instance`;
        if (entityDefId === 'core:missing') {
          return { id: instanceId };
        }
        if (entityDefId === 'core:noComponent') {
          const instance = {
            id: instanceId,
            getComponentData: jest.fn(() => null),
          };
          clothingInstances.set(instanceId, instance);
          return instance;
        }
        if (entityDefId === 'core:noSlot') {
          const instance = {
            id: instanceId,
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'clothing:wearable') {
                return {};
              }
              return null;
            }),
          };
          clothingInstances.set(instanceId, instance);
          return instance;
        }
        if (entityDefId === 'core:validationFailure') {
          const instance = {
            id: instanceId,
            getComponentData: jest.fn(() => ({
              equipmentSlots: { primary: 'torso' },
            })),
          };
          clothingInstances.set(instanceId, instance);
          return instance;
        }
        if (entityDefId === 'core:validatorException') {
          const instance = {
            id: instanceId,
            getComponentData: jest.fn(() => ({
              equipmentSlots: { primary: 'torso' },
            })),
          };
          clothingInstances.set(instanceId, instance);
          return instance;
        }
        if (entityDefId === 'core:componentException') {
          const instance = {
            id: instanceId,
            getComponentData: jest.fn(() => {
              throw new Error('component failure');
            }),
          };
          clothingInstances.set(instanceId, instance);
          return instance;
        }
        return { id: instanceId };
      },
      getEntityInstance: (id) => {
        if (id === 'core:missing:instance') {
          return null;
        }
        return undefined;
      },
    }));

    deps.clothingSlotValidator.validateSlotCompatibility.mockImplementation(
      async (
        _entityId,
        _slotId,
        itemId,
        _availableSlots,
        resolveAttachmentPoints
      ) => {
        await resolveAttachmentPoints(actorId, 'torso');
        if (itemId === 'core:validationFailure:instance') {
          return { valid: false, reason: 'slot mismatch' };
        }
        if (itemId === 'core:validatorException:instance') {
          throw new Error('validator exploded');
        }
        return { valid: true };
      }
    );

    const result = await service.instantiateRecipeClothing(
      actorId,
      deps.dataRegistry.get('anatomyRecipes', recipeId),
      {
        partsMap: new Map(),
        slotEntityMappings: new Map(),
      }
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Clothing instance 'core:missing:instance' not found",
        "Clothing instance 'core:noComponent:instance' does not have clothing:wearable component",
        "Clothing instance 'core:noSlot:instance' does not specify a clothing slot",
        'slot mismatch',
        'Validation error: validator exploded',
        'core:componentException:instance: component failure',
      ])
    );

    expect(deps.slotResolver.resolveClothingSlot).toHaveBeenCalled();
  });

  it('surfaces instantiation failures caused by layer resolution and entity creation issues', async () => {
    ({ service, dependencies: deps } = createService({
      recipe: {
        clothingEntities: [
          {
            entityId: 'core:layerError',
            targetSlot: 'torso',
            properties: {
              'clothing:wearable': { layer: 'outer' },
            },
          },
          { entityId: 'core:nullInstance', targetSlot: 'torso' },
          { entityId: 'core:noId', targetSlot: 'torso' },
        ],
      },
      entityDefinitions: {
        'core:layerError': baseClothingDefinition,
        'core:nullInstance': baseClothingDefinition,
        'core:noId': baseClothingDefinition,
      },
      createEntityInstance: (entityDefId, _options, { clothingInstances }) => {
        if (entityDefId === 'core:layerError') {
          return { id: 'core:layerError:instance' };
        }
        if (entityDefId === 'core:nullInstance') {
          return null;
        }
        if (entityDefId === 'core:noId') {
          return { id: undefined };
        }
        const instance = { id: `${entityDefId}:instance` };
        clothingInstances.set(instance.id, instance);
        return instance;
      },
    }));

    deps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
      isValid: false,
      error: 'layer conflict',
    });

    const result = await service.instantiateRecipeClothing(
      actorId,
      deps.dataRegistry.get('anatomyRecipes', recipeId),
      {
        partsMap: new Map(),
        slotEntityMappings: new Map(),
      }
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        'core:layerError: Layer resolution failed for core:layerError: layer conflict',
        "core:nullInstance: Failed to create clothing entity 'core:nullInstance'",
        "core:noId: Created clothing entity 'core:noId' has no valid ID",
      ])
    );
  });

  it('falls back to unknown equipment error when orchestrator throws', async () => {
    deps.equipmentOrchestrator.orchestrateEquipment.mockRejectedValue(
      new Error('orchestrator failure')
    );

    const recipe = {
      clothingEntities: [
        {
          entityId: 'core:shirt',
          targetSlot: 'torso',
        },
      ],
    };

    const result = await service.instantiateRecipeClothing(actorId, recipe, {
      partsMap: new Map(),
      slotEntityMappings: new Map(),
    });

    expect(result.errors).toContain('Unknown equipment error');
  });
});
