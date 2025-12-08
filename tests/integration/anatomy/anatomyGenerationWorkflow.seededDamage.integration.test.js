import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyGenerationWorkflow } from '../../../src/anatomy/workflows/anatomyGenerationWorkflow.js';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import InjuryAggregationService from '../../../src/anatomy/services/injuryAggregationService.js';
import InjuryNarrativeFormatterService from '../../../src/anatomy/services/injuryNarrativeFormatterService.js';
import { calculateStateFromPercentage } from '../../../src/anatomy/registries/healthStateRegistry.js';
import SeededDamageApplier from '../../../src/logic/services/SeededDamageApplier.js';

jest.mock(
  '../../../src/anatomy/workflows/stages/slotEntityCreationStage.js',
  () => ({
    executeSlotEntityCreation: jest
      .fn()
      .mockResolvedValue({ slotEntityMappings: new Map() }),
  })
);

jest.mock(
  '../../../src/anatomy/workflows/stages/socketIndexBuildingStage.js',
  () => ({
    executeSocketIndexBuilding: jest.fn().mockResolvedValue(undefined),
  })
);

jest.mock(
  '../../../src/anatomy/workflows/stages/clothingInstantiationStage.js',
  () => ({
    executeClothingInstantiation: jest.fn().mockResolvedValue(null),
  })
);

jest.mock(
  '../../../src/anatomy/workflows/stages/eventPublicationStage.js',
  () => ({
    executeEventPublication: jest.fn().mockResolvedValue(undefined),
  })
);

describe('AnatomyGenerationWorkflow – seeded damage integration', () => {
  const ownerId = 'entity-1';
  const recipeId = 'anatomy:seeded_recipe';
  let workflow;
  let dataRegistry;
  let bodyBlueprintFactory;
  let entityManager;
  let components;
  let damageResolutionService;
  let logger;

  beforeEach(() => {
    components = {
      'part-1': {
        'anatomy:part': {
          subType: 'arm',
          ownerEntityId: ownerId,
          orientation: 'left',
        },
        'core:name': { text: 'left_arm' },
        'anatomy:part_health': {
          currentHealth: 10,
          maxHealth: 10,
          state: 'healthy',
          turnsInState: 0,
        },
      },
      [ownerId]: {},
    };

    entityManager = {
      getEntityInstance: jest.fn((id) => {
        const componentBag = components[id];
        if (!componentBag) return null;
        return {
          id,
          hasComponent: (componentId) => Boolean(componentBag[componentId]),
          getComponentData: (componentId) => componentBag[componentId],
        };
      }),
      hasComponent: jest.fn((id, componentId) =>
        Boolean(components[id]?.[componentId])
      ),
      getComponentData: jest.fn((id, componentId) => components[id]?.[componentId]),
      addComponent: jest.fn((id, componentId, data) => {
        components[id] = components[id] || {};
        components[id][componentId] = data;
        return true;
      }),
      createEntityInstance: jest.fn(),
    };

    dataRegistry = {
      get: jest.fn((type, id) => {
        if (type === 'anatomyRecipes' && id === recipeId) {
          return {
            recipeId,
            blueprintId: 'anatomy:blueprint_seed',
            slots: { arm_slot: { partType: 'arm' } },
            initialDamage: {
              arm_slot: {
                damage_entries: [{ name: 'blunt', amount: 3 }],
              },
            },
          };
        }
        if (type === 'anatomyBlueprints') {
          return { slots: { arm_slot: { partType: 'arm' } } };
        }
        return undefined;
      }),
    };

    bodyBlueprintFactory = {
      createAnatomyGraph: jest.fn().mockResolvedValue({
        rootId: 'root-1',
        entities: ['part-1'],
        slotToPartMappings: new Map([['arm_slot', 'part-1']]),
      }),
    };

    damageResolutionService = {
      resolve: jest.fn(async ({ partId, finalDamageEntry }) => {
        const health = components[partId]?.['anatomy:part_health'];
        if (health) {
          const newHealth = Math.max(0, health.currentHealth - finalDamageEntry.amount);
          const healthPercentage = (newHealth / health.maxHealth) * 100;
          const nextState = calculateStateFromPercentage(healthPercentage);
          components[partId]['anatomy:part_health'] = {
            ...health,
            currentHealth: newHealth,
            state: nextState,
            turnsInState:
              health.state === nextState ? (health.turnsInState || 0) + 1 : 0,
          };
        }
      }),
    };

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const seededDamageApplier = new SeededDamageApplier({
      damageResolutionService,
      logger,
    });

    workflow = new AnatomyGenerationWorkflow({
      entityManager,
      dataRegistry,
      logger,
      bodyBlueprintFactory,
      seededDamageApplier,
    });
  });

  it('applies initialDamage to the generated part before description would run', async () => {
    await workflow.generate('anatomy:blueprint_seed', recipeId, {
      ownerId,
    });

    expect(damageResolutionService.resolve).toHaveBeenCalled();
    expect(components['part-1']['anatomy:part_health'].currentHealth).toBe(7);
  });

  it('includes seeded wounds in the initial generated description', async () => {
    await workflow.generate('anatomy:blueprint_seed', recipeId, {
      ownerId,
    });

    const bodyGraphService = {
      getAllParts: (bodyComponent) => {
        const body = bodyComponent?.body || bodyComponent;
        return Object.values(body?.parts || {});
      },
    };

    const injuryAggregationService = new InjuryAggregationService({
      entityManager,
      logger,
      bodyGraphService,
    });

    const injuryNarrativeFormatterService = new InjuryNarrativeFormatterService({
      logger,
    });

    const anatomyFormattingService = {
      getDescriptionOrder: () => ['health'],
    };

    const composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: {},
      bodyGraphService,
      entityFinder: entityManager,
      anatomyFormattingService,
      partDescriptionGenerator: null,
      injuryAggregationService,
      injuryNarrativeFormatterService,
      logger,
    });

    const bodyEntity = entityManager.getEntityInstance(ownerId);

    const description = await composer.composeDescription(bodyEntity);

    expect(description).toBe('Health: Left arm is scratched.');
  });
});
