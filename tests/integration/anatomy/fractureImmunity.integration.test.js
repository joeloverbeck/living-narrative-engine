/**
 * @file Integration tests for fracture immunity using real mod entity definitions.
 * @see src/anatomy/applicators/fractureApplicator.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import ApplyDamageHandler from '../../../src/logic/operationHandlers/applyDamageHandler.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import DamageResolutionService from '../../../src/logic/services/damageResolutionService.js';
import DamageTypeEffectsService from '../../../src/anatomy/services/damageTypeEffectsService.js';
import DamagePropagationService from '../../../src/anatomy/services/damagePropagationService.js';
import DamageAccumulator from '../../../src/anatomy/services/damageAccumulator.js';
import DamageNarrativeComposer from '../../../src/anatomy/services/damageNarrativeComposer.js';
import StatusEffectRegistry from '../../../src/anatomy/services/statusEffectRegistry.js';
import EffectDefinitionResolver from '../../../src/anatomy/services/effectDefinitionResolver.js';
import WarningTracker from '../../../src/anatomy/services/warningTracker.js';
import FractureApplicator from '../../../src/anatomy/applicators/fractureApplicator.js';
import DismembermentApplicator from '../../../src/anatomy/applicators/dismembermentApplicator.js';
import BleedApplicator from '../../../src/anatomy/applicators/bleedApplicator.js';
import BurnApplicator from '../../../src/anatomy/applicators/burnApplicator.js';
import PoisonApplicator from '../../../src/anatomy/applicators/poisonApplicator.js';
import TestEntityManagerAdapter from '../../common/entities/TestEntityManagerAdapter.js';

const FRACTURED_COMPONENT_ID = 'anatomy:fractured';
const RIGID_STRUCTURE_COMPONENT_ID = 'anatomy:has_rigid_structure';
const STATUS_EFFECT_REGISTRY_PATH =
  'data/mods/anatomy/status-effects/status-effects.registry.json';

const SOFT_TISSUE_PARTS = [
  {
    id: 'anatomy:human_penis',
    path: 'data/mods/anatomy/entities/definitions/human_penis.entity.json',
  },
  {
    id: 'anatomy:human_breast',
    path: 'data/mods/anatomy/entities/definitions/human_breast.entity.json',
  },
  {
    id: 'anatomy:human_ass_cheek',
    path: 'data/mods/anatomy/entities/definitions/human_ass_cheek.entity.json',
  },
  {
    id: 'anatomy-creatures:spider_spinneret',
    path:
      'data/mods/anatomy-creatures/entities/definitions/spider_spinneret.entity.json',
  },
  {
    id: 'anatomy-creatures:squid_tentacle',
    path:
      'data/mods/anatomy-creatures/entities/definitions/squid_tentacle.entity.json',
  },
];

const RIGID_PARTS = [
  {
    id: 'anatomy:human_leg',
    path: 'data/mods/anatomy/entities/definitions/human_leg.entity.json',
  },
  {
    id: 'anatomy:humanoid_arm',
    path: 'data/mods/anatomy/entities/definitions/humanoid_arm.entity.json',
  },
  {
    id: 'anatomy-creatures:spider_leg',
    path:
      'data/mods/anatomy-creatures/entities/definitions/spider_leg.entity.json',
  },
  {
    id: 'anatomy-creatures:tortoise_carapace',
    path:
      'data/mods/anatomy-creatures/entities/definitions/tortoise_carapace.entity.json',
  },
];

const DAMAGE_TYPE = 'bludgeoning';

async function loadJson(relativePath) {
  const filePath = path.resolve(process.cwd(), relativePath);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function loadEntityDefinition(dataRegistry, definitionPath) {
  const definition = await loadJson(definitionPath);
  dataRegistry.store('entityDefinitions', definition.id, definition);
  return definition.id;
}

async function createPartInstance(entityManager, dataRegistry, definitionPath) {
  const definitionId = await loadEntityDefinition(dataRegistry, definitionPath);
  const instanceId = `${definitionId}-instance`;
  await entityManager.createEntityInstance(definitionId, { instanceId });
  return instanceId;
}

async function createDamageHarness() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const dataRegistry = new InMemoryDataRegistry({ logger });
  const statusRegistry = await loadJson(STATUS_EFFECT_REGISTRY_PATH);
  dataRegistry.store('statusEffects', statusRegistry.id, statusRegistry);

  const entityManager = new TestEntityManagerAdapter({
    logger,
    registry: dataRegistry,
  });

  const dispatcher = {
    dispatch: jest.fn().mockResolvedValue(true),
  };

  const warningTracker = new WarningTracker({ logger });
  const statusEffectRegistry = new StatusEffectRegistry({
    dataRegistry,
    logger,
  });
  const effectDefinitionResolver = new EffectDefinitionResolver({
    statusEffectRegistry,
    warningTracker,
  });

  const dismembermentApplicator = new DismembermentApplicator({
    logger,
    entityManager,
  });
  const fractureApplicator = new FractureApplicator({
    logger,
    entityManager,
  });
  const bleedApplicator = new BleedApplicator({ logger, entityManager });
  const burnApplicator = new BurnApplicator({ logger, entityManager });
  const poisonApplicator = new PoisonApplicator({ logger, entityManager });

  const damageTypeEffectsService = new DamageTypeEffectsService({
    logger,
    entityManager,
    safeEventDispatcher: dispatcher,
    effectDefinitionResolver,
    dismembermentApplicator,
    fractureApplicator,
    bleedApplicator,
    burnApplicator,
    poisonApplicator,
  });

  const damagePropagationService = new DamagePropagationService({
    logger,
    entityManager,
    eventBus: dispatcher,
  });
  const damageAccumulator = new DamageAccumulator({ logger });
  const damageNarrativeComposer = new DamageNarrativeComposer({ logger });
  const deathCheckService = {
    checkDeathConditions: jest.fn().mockResolvedValue(undefined),
    evaluateDeathConditions: jest.fn().mockReturnValue({
      isDead: false,
      isDying: false,
      shouldFinalize: false,
      finalizationParams: null,
      deathInfo: null,
    }),
    finalizeDeathFromEvaluation: jest.fn(),
  };

  const jsonLogicService = new JsonLogicEvaluationService({
    logger,
    gameDataRepository: dataRegistry,
  });

  const bodyGraphService = {
    getAllParts: jest.fn().mockReturnValue([]),
  };

  const damageResolutionService = new DamageResolutionService({
    logger,
    entityManager,
    safeEventDispatcher: dispatcher,
    damageTypeEffectsService,
    damagePropagationService,
    deathCheckService,
    damageAccumulator,
    damageNarrativeComposer,
  });

  const applyDamageHandler = new ApplyDamageHandler({
    logger,
    entityManager,
    safeEventDispatcher: dispatcher,
    jsonLogicService,
    bodyGraphService,
    damageTypeEffectsService,
    damagePropagationService,
    deathCheckService,
    damageAccumulator,
    damageNarrativeComposer,
    damageResolutionService,
  });

  return {
    logger,
    dataRegistry,
    entityManager,
    applyDamageHandler,
  };
}

async function applyFractureDamage(handler, entityId, partId, amount) {
  await handler.execute(
    {
      entity_ref: entityId,
      part_ref: partId,
      damage_entry: {
        name: DAMAGE_TYPE,
        amount,
        fracture: { enabled: true },
      },
    },
    {
      rng: () => 0.42,
      suppressPerceptibleEvents: true,
    }
  );
}

describe('Fracture Immunity System - Integration', () => {
  let harness;

  beforeEach(async () => {
    harness = await createDamageHarness();
  });

  afterEach(() => {
    harness = null;
  });

  describe('Soft Tissue Parts', () => {
    it.each(SOFT_TISSUE_PARTS)(
      'does not fracture $id even with massive damage',
      async ({ path: definitionPath }) => {
        const partId = await createPartInstance(
          harness.entityManager,
          harness.dataRegistry,
          definitionPath
        );
        const health = harness.entityManager.getComponentData(
          partId,
          'anatomy:part_health'
        );
        expect(health).toBeDefined();

        expect(
          harness.entityManager.hasComponent(
            partId,
            RIGID_STRUCTURE_COMPONENT_ID
          )
        ).toBe(false);

        await applyFractureDamage(
          harness.applyDamageHandler,
          partId,
          partId,
          health.maxHealth * 2
        );

        expect(
          harness.entityManager.hasComponent(partId, FRACTURED_COMPONENT_ID)
        ).toBe(false);
      }
    );
  });

  describe('Rigid Structure Parts', () => {
    it.each(RIGID_PARTS)(
      'fractures $id when damage exceeds threshold',
      async ({ path: definitionPath }) => {
        const partId = await createPartInstance(
          harness.entityManager,
          harness.dataRegistry,
          definitionPath
        );
        const health = harness.entityManager.getComponentData(
          partId,
          'anatomy:part_health'
        );
        expect(health).toBeDefined();
        const damageAmount = Math.ceil(health.maxHealth * 0.6);

        expect(
          harness.entityManager.hasComponent(
            partId,
            RIGID_STRUCTURE_COMPONENT_ID
          )
        ).toBe(true);

        await applyFractureDamage(
          harness.applyDamageHandler,
          partId,
          partId,
          damageAmount
        );

        expect(
          harness.entityManager.hasComponent(partId, FRACTURED_COMPONENT_ID)
        ).toBe(true);
      }
    );

    it('does not fracture a leg when damage stays below threshold', async () => {
      const partId = await createPartInstance(
        harness.entityManager,
        harness.dataRegistry,
        'data/mods/anatomy/entities/definitions/human_leg.entity.json'
      );
      const health = harness.entityManager.getComponentData(
        partId,
        'anatomy:part_health'
      );
      const damageAmount = Math.max(1, Math.floor(health.maxHealth * 0.4));

      await applyFractureDamage(
        harness.applyDamageHandler,
        partId,
        partId,
        damageAmount
      );

      expect(
        harness.entityManager.hasComponent(partId, FRACTURED_COMPONENT_ID)
      ).toBe(false);
    });
  });
});
