/**
 * @file Integration tests for ClothingInstantiationService - Invalid Slot Scenarios
 *
 * Validates that the clothing instantiation service correctly:
 * 1. Rejects entities with invalid/non-existent slots (like 'hand_accessory')
 * 2. Accepts entities with valid slots (like 'hands')
 * 3. Properly handles accessories layer on hand-related slots
 *
 * Regression tests for: accessories:seal_ring_iron_kiln_black validation failure
 * Root cause: Entity used 'hand_accessory' slot which doesn't exist in blueprint
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClothingInstantiationService } from '../../../src/clothing/services/clothingInstantiationService.js';
import { CacheKeyTypes } from '../../../src/anatomy/cache/AnatomyClothingCache.js';
import {
  createMockLogger,
  createCapturingEventBus,
} from '../../common/mockFactories/index.js';

const recipeId = 'test:recipe';
const actorId = 'actor:test';

/**
 * Creates a clothing entity definition with the specified slot
 *
 * @param {string} slot - The equipment slot to use
 * @param {string} [layer] - The clothing layer
 * @returns {object} The entity definition with clothing:wearable component
 */
function createClothingDefinition(slot, layer = 'accessories') {
  return {
    components: {
      'clothing:wearable': {
        equipmentSlots: { primary: slot },
        layer,
        allowedLayers: [layer],
      },
    },
  };
}

/**
 * Creates a fully wired ClothingInstantiationService with test doubles
 * that simulate realistic blueprint slot mappings
 *
 * @param {object} [overrides] - Dependency overrides
 * @returns {{ service: ClothingInstantiationService, dependencies: object }} Service instance and its dependencies
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

  // Simulate realistic blueprint with valid clothing slots
  // This matches the structure from amphibian_core.part.json
  const validClothingSlotMappings = new Map([
    ['head_gear', { blueprintSlots: ['head'] }],
    ['face_gear', { blueprintSlots: ['head'] }],
    ['torso_upper', { anatomySockets: ['left_chest', 'right_chest'] }],
    ['hands', { blueprintSlots: ['left_hand', 'right_hand'] }],
    ['feet', { blueprintSlots: ['left_foot', 'right_foot'] }],
    ['legs', { blueprintSlots: ['left_leg', 'right_leg'] }],
    ['back_accessory', { anatomySockets: ['upper_back', 'lower_back'] }],
  ]);

  const dataRegistry = {
    get: jest.fn((collection, id) => {
      if (collection === 'anatomyRecipes' && id === recipeId) {
        return overrides.recipe ?? { clothingEntities: [] };
      }
      if (collection === 'entityDefinitions') {
        const definitions = overrides.entityDefinitions ?? {};
        return definitions[id];
      }
      return null;
    }),
  };

  const entityManager = {
    createEntityInstance: jest.fn(async (entityDefId) => {
      const clothingEntity = {
        id: `${entityDefId}:instance`,
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'clothing:wearable') {
            const def = dataRegistry.get('entityDefinitions', entityDefId);
            return def?.components?.['clothing:wearable'];
          }
          return null;
        }),
      };
      clothingInstances.set(clothingEntity.id, clothingEntity);
      return clothingEntity;
    }),
    getEntityInstance: jest.fn((id) => {
      if (id === actorId) return actorEntity;
      return clothingInstances.get(id) ?? null;
    }),
    removeEntityInstance: jest.fn(async (instanceId) => {
      clothingInstances.delete(instanceId);
    }),
  };

  const slotResolver = {
    setSlotEntityMappings: jest.fn(),
    resolveClothingSlot: jest.fn().mockResolvedValue(['socket-1']),
  };

  // Key test point: this validator checks if slot exists in availableSlots
  const clothingSlotValidator = {
    validateSlotCompatibility: jest.fn(
      async (entityId, slotId, itemId, availableSlots) => {
        // Simulate real validation: check if slot exists in the map
        if (!availableSlots || !availableSlots.has(slotId)) {
          return {
            valid: false,
            reason: `Entity lacks clothing slot '${slotId}'`,
          };
        }
        return { valid: true };
      }
    ),
  };

  const anatomyBlueprintRepository = {
    getBlueprintByRecipeId: jest.fn().mockResolvedValue({
      clothingSlotMappings: Object.fromEntries(validClothingSlotMappings),
    }),
  };

  const bodyGraphService = {
    getAnatomyData: jest.fn().mockResolvedValue({ recipeId }),
  };

  const anatomyClothingCache = {
    get: jest.fn((type, key) => {
      if (
        type === CacheKeyTypes.AVAILABLE_SLOTS &&
        key === `${CacheKeyTypes.AVAILABLE_SLOTS}:${actorId}`
      ) {
        return validClothingSlotMappings;
      }
      return undefined;
    }),
    set: jest.fn(),
  };

  const layerResolutionService = {
    resolveAndValidateLayer: jest
      .fn()
      .mockReturnValue({ isValid: true, layer: 'accessories' }),
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
      layerResolutionService,
      validClothingSlotMappings,
    },
  };
}

describe('ClothingInstantiationService - Invalid Slot Integration', () => {
  let service;
  let deps;

  beforeEach(() => {
    ({ service, dependencies: deps } = createService());
  });

  describe('Invalid slot rejection (regression test for seal ring bug)', () => {
    it('should reject clothing with non-existent slot "hand_accessory"', async () => {
      // Setup: Create entity with invalid 'hand_accessory' slot
      const invalidEntityId = 'accessories:seal_ring_invalid';
      const recipe = {
        clothingEntities: [
          { entityId: invalidEntityId, targetSlot: 'hand_accessory', equip: true },
        ],
      };

      ({ service, dependencies: deps } = createService({
        recipe,
        entityDefinitions: {
          [invalidEntityId]: createClothingDefinition('hand_accessory'),
        },
      }));

      // Execute
      const result = await service.instantiateRecipeClothing(actorId, recipe, {
        partsMap: new Map(),
        slotEntityMappings: new Map(),
      });

      // Verify: Should have validation error for missing slot
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Entity lacks clothing slot 'hand_accessory'"),
        ])
      );
      expect(result.equipped).toHaveLength(0);
    });

    it('should accept clothing with valid slot "hands"', async () => {
      // Setup: Create entity with valid 'hands' slot (like gloves use)
      const validEntityId = 'accessories:ring_valid';
      const recipe = {
        clothingEntities: [
          { entityId: validEntityId, targetSlot: 'hands', equip: true },
        ],
      };

      ({ service, dependencies: deps } = createService({
        recipe,
        entityDefinitions: {
          [validEntityId]: createClothingDefinition('hands'),
        },
      }));

      // Execute
      const result = await service.instantiateRecipeClothing(actorId, recipe, {
        partsMap: new Map([['hands', 'entity:hands']]),
        slotEntityMappings: new Map([['hands', 'entity:hands']]),
      });

      // Verify: Should succeed without slot validation errors
      const slotErrors = result.errors.filter((e) =>
        e.includes('Entity lacks clothing slot')
      );
      expect(slotErrors).toHaveLength(0);
    });

it.each([
      ['hand_accessory', 'non-existent slot name'],
      ['hand', 'singular form instead of plural'],
      ['hands_accessory', 'compound invalid name'],
      ['left_hand', 'blueprint slot used as clothing slot'],
      ['right_hand', 'blueprint slot used as clothing slot'],
    ])('should reject slot "%s" (%s)', async (invalidSlot) => {
      const entityId = `accessories:test_${invalidSlot}`;
      const recipe = {
        clothingEntities: [
          { entityId, targetSlot: invalidSlot, equip: true },
        ],
      };

      ({ service, dependencies: deps } = createService({
        recipe,
        entityDefinitions: {
          [entityId]: createClothingDefinition(invalidSlot),
        },
      }));

      const result = await service.instantiateRecipeClothing(actorId, recipe, {
        partsMap: new Map(),
        slotEntityMappings: new Map(),
      });

      expect(result.errors.some((e) => e.includes('Entity lacks clothing slot'))).toBe(
        true
      );
    });
  });

  describe('Accessories layer on hands slot', () => {
    it('should allow accessories layer on hands slot', async () => {
      const entityId = 'accessories:gloves';
      const recipe = {
        clothingEntities: [
          { entityId, targetSlot: 'hands', equip: true },
        ],
      };

      ({ service, dependencies: deps } = createService({
        recipe,
        entityDefinitions: {
          [entityId]: createClothingDefinition('hands', 'accessories'),
        },
      }));

      // Ensure layer resolution accepts 'accessories' on 'hands' slot
      deps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'accessories',
      });

      const result = await service.instantiateRecipeClothing(actorId, recipe, {
        partsMap: new Map([['hands', 'entity:hands']]),
        slotEntityMappings: new Map([['hands', 'entity:hands']]),
      });

      const slotErrors = result.errors.filter((e) =>
        e.includes('Entity lacks clothing slot')
      );
      expect(slotErrors).toHaveLength(0);
    });

    it('should allow base layer on hands slot', async () => {
      const entityId = 'clothing:gloves_base';
      const recipe = {
        clothingEntities: [
          { entityId, targetSlot: 'hands', equip: true },
        ],
      };

      ({ service, dependencies: deps } = createService({
        recipe,
        entityDefinitions: {
          [entityId]: createClothingDefinition('hands', 'base'),
        },
      }));

      deps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
        isValid: true,
        layer: 'base',
      });

      const result = await service.instantiateRecipeClothing(actorId, recipe, {
        partsMap: new Map([['hands', 'entity:hands']]),
        slotEntityMappings: new Map([['hands', 'entity:hands']]),
      });

      const slotErrors = result.errors.filter((e) =>
        e.includes('Entity lacks clothing slot')
      );
      expect(slotErrors).toHaveLength(0);
    });
  });

  describe('Valid clothing slot mappings from blueprints', () => {
    it('should accept all valid slots from amphibian blueprint', async () => {
      const validSlots = [
        'head_gear',
        'face_gear',
        'torso_upper',
        'hands',
        'feet',
        'legs',
        'back_accessory',
      ];

      for (const slot of validSlots) {
        const entityId = `clothing:test_${slot}`;
        const recipe = {
          clothingEntities: [{ entityId, targetSlot: slot, equip: true }],
        };

        const layer = slot === 'face_gear' || slot === 'back_accessory'
          ? 'accessories'
          : 'base';

        ({ service, dependencies: deps } = createService({
          recipe,
          entityDefinitions: {
            [entityId]: createClothingDefinition(slot, layer),
          },
        }));

        deps.layerResolutionService.resolveAndValidateLayer.mockReturnValue({
          isValid: true,
          layer,
        });

        const result = await service.instantiateRecipeClothing(actorId, recipe, {
          partsMap: new Map([[slot, `entity:${slot}`]]),
          slotEntityMappings: new Map([[slot, `entity:${slot}`]]),
        });

        const slotErrors = result.errors.filter((e) =>
          e.includes('Entity lacks clothing slot')
        );
        expect(slotErrors).toHaveLength(0);
      }
    });
  });
});
