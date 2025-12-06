/**
 * @file damageMetadataTags.e2e.test.js
 * @description E2E coverage for metadata and damage_tags threading through APPLY_DAMAGE
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import ApplyDamageHandler from '../../../src/logic/operationHandlers/applyDamageHandler.js';
import ResolveOutcomeHandler from '../../../src/logic/operationHandlers/resolveOutcomeHandler.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import DamageTypeEffectsService from '../../../src/anatomy/services/damageTypeEffectsService.js';
import DamagePropagationService from '../../../src/anatomy/services/damagePropagationService.js';
import InjuryAggregationService from '../../../src/anatomy/services/injuryAggregationService.js';
import DeathCheckService from '../../../src/anatomy/services/deathCheckService.js';
import DamageAccumulator from '../../../src/anatomy/services/damageAccumulator.js';
import DamageNarrativeComposer from '../../../src/anatomy/services/damageNarrativeComposer.js';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';

import rapierDefinition from '../../../data/mods/fantasy/entities/definitions/vespera_rapier.entity.json' assert { type: 'json' };

const ACTION_ID = 'weapons:swing_at_target';
const ROOM_ID = 'metadata-room';

const createSafeDispatcher = (eventBus) => ({
  dispatch: (eventType, payload) => eventBus.dispatch(eventType, payload),
});

const buildWeaponFromDefinition = (id, definition) => {
  const builder = new ModEntityBuilder(id);
  Object.entries(definition.components || {}).forEach(([componentId, data]) => {
    builder.withComponent(componentId, data);
  });
  return builder;
};

const cloneWithEntries = (definition, entries) => {
  const cloned = JSON.parse(JSON.stringify(definition));
  cloned.components = cloned.components || {};
  cloned.components['damage-types:damage_capabilities'] = {
    ...(cloned.components['damage-types:damage_capabilities'] || {}),
    entries,
  };
  return cloned;
};

const createCombatants = ({
  weaponBuilder,
  weaponId,
  partHealth = 40,
  partMaxHealth = 40,
}) => {
  const part = new ModEntityBuilder(`${weaponId}-target-part`)
    .withName('Target Part')
    .withComponent('anatomy:part', {
      type: 'torso',
      subType: 'torso',
      orientation: 'mid',
      children: [],
    })
    .withComponent('anatomy:part_health', {
      currentHealth: partHealth,
      maxHealth: partMaxHealth,
      status: 'healthy',
    })
    .build();

  const target = new ModEntityBuilder(`${weaponId}-target`)
    .withName('Metadata Target')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:defense_skill', { level: 10 })
    .withComponent('anatomy:body', { body: { root: part.id } })
    .build();

  const weapon = weaponBuilder.withName('Metadata Weapon').build();

  const attacker = new ModEntityBuilder(`${weaponId}-attacker`)
    .withName('Metadata Attacker')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:melee_skill', { level: 90 })
    .withComponent('items:inventory', { items: [weaponId], capacity: 5 })
    .withComponent('positioning:wielding', { wielded_item_ids: [weaponId] })
    .build();

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Metadata Room')
    .withComponent('core:position', { locationId: ROOM_ID })
    .build();

  return { attacker, target, part, weapon, room };
};

const installRealHandlers = ({
  testEnv,
  safeDispatcher,
  forcedOutcome = 'SUCCESS',
  rngProvider = () => 0.5,
}) => {
  const { entityManager, logger, jsonLogic, operationRegistry } = testEnv;

  const bodyGraphService = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher: safeDispatcher,
  });

  const damageAccumulator = new DamageAccumulator({
    logger,
  });
  const finalizeSpy = jest.spyOn(damageAccumulator, 'finalize');

  const damageNarrativeComposer = new DamageNarrativeComposer({
    logger,
  });

  const damageTypeEffectsService = new DamageTypeEffectsService({
    entityManager,
    logger,
    safeEventDispatcher: safeDispatcher,
    rngProvider,
  });

  const damagePropagationService = new DamagePropagationService({
    entityManager,
    logger,
    eventBus: safeDispatcher,
  });

  const injuryAggregationService = new InjuryAggregationService({
    entityManager,
    logger,
    bodyGraphService,
  });

  const deathCheckService = new DeathCheckService({
    entityManager,
    logger,
    eventBus: safeDispatcher,
    injuryAggregationService,
    bodyGraphService,
  });

  const applyDamageHandler = new ApplyDamageHandler({
    entityManager,
    logger,
    safeEventDispatcher: safeDispatcher,
    jsonLogicService: jsonLogic,
    bodyGraphService,
    damageTypeEffectsService,
    damagePropagationService,
    deathCheckService,
    damageAccumulator,
    damageNarrativeComposer,
  });

  const chanceCalculationService = {
    resolveOutcome: () => ({
      outcome: forcedOutcome,
      roll: 1,
      threshold: 50,
      margin: -49,
      isCritical: forcedOutcome === 'CRITICAL_SUCCESS',
      modifiers: [],
    }),
  };

  const resolveOutcomeHandler = new ResolveOutcomeHandler({
    chanceCalculationService,
    logger,
  });

  operationRegistry.register(
    'APPLY_DAMAGE',
    applyDamageHandler.execute.bind(applyDamageHandler)
  );
  operationRegistry.register(
    'RESOLVE_OUTCOME',
    resolveOutcomeHandler.execute.bind(resolveOutcomeHandler)
  );

  return { finalizeSpy };
};

describe('damage metadata and tags coverage', () => {
  let fixture;
  let testEnv;
  let safeDispatcher;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('weapons', ACTION_ID, null, null, {
      autoRegisterScopes: true,
      scopeCategories: ['positioning', 'anatomy'],
    });
    testEnv = fixture.testEnv;
    safeDispatcher = createSafeDispatcher(testEnv.eventBus);
    jest.spyOn(Math, 'random').mockReturnValue(0); // deterministic part selection
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fixture) {
      fixture.cleanup();
    }
  });

  const executeSwing = async ({
    weaponDefinition,
    weaponId,
    partHealth,
    partMaxHealth,
    rngProvider,
  }) => {
    const weaponBuilder = buildWeaponFromDefinition(weaponId, weaponDefinition);
    const { attacker, target, part, weapon, room } = createCombatants({
      weaponBuilder,
      weaponId,
      partHealth,
      partMaxHealth,
    });

    fixture.reset([attacker, target, part, weapon, room]);
    fixture.clearEvents();

    const { finalizeSpy } = installRealHandlers({
      testEnv,
      safeDispatcher,
      forcedOutcome: 'SUCCESS',
      rngProvider,
    });

    await testEnv.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actionId: ACTION_ID,
      actorId: attacker.id,
      primaryId: weapon.id,
      secondaryId: target.id,
      originalInput: `swing ${weapon.id} at ${target.id}`,
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    return { finalizeSpy, part };
  };

  it('records metadata and deduped tags in the damage session and damage_applied event', async () => {
    const taggedDefinition = cloneWithEntries(rapierDefinition, [
      {
        name: 'slashing',
        amount: 8,
        metadata: { source: 'enchanted', element: 'fire' },
        damage_tags: ['magical', 'magical', 'crit'],
      },
    ]);

    const { finalizeSpy, part } = await executeSwing({
      weaponDefinition: taggedDefinition,
      weaponId: 'metadata-rapier',
      partHealth: 30,
      partMaxHealth: 30,
      rngProvider: () => 0.42,
    });

    const finalizeResult = finalizeSpy.mock.results.at(-1)?.value;
    expect(finalizeResult?.entries?.length).toBeGreaterThan(0);

    const recordedEntry = finalizeResult.entries[0];
    expect(recordedEntry.metadata).toEqual({
      source: 'enchanted',
      element: 'fire',
    });
    expect(recordedEntry.damageTags).toEqual(['magical', 'crit']);

    const damageEvent = fixture.events.find(
      (e) => e.eventType === 'anatomy:damage_applied'
    );
    expect(damageEvent?.payload?.partId).toBe(part.id);
    expect(damageEvent?.payload?.metadata).toEqual({
      source: 'enchanted',
      element: 'fire',
    });
    expect(damageEvent?.payload?.damageTags).toEqual(['magical', 'crit']);
  });

  it('preserves distinct metadata and tags per entry for multi-entry weapons', async () => {
    const multiEntryDefinition = cloneWithEntries(rapierDefinition, [
      {
        name: 'piercing_primary',
        amount: 4,
        metadata: { slot: 'primary', tier: 1 },
        damage_tags: ['physical'],
      },
      {
        name: 'fire_followup',
        amount: 3,
        metadata: { slot: 'followup', element: 'fire' },
        damage_tags: ['elemental', 'burning'],
      },
    ]);

    const { finalizeSpy } = await executeSwing({
      weaponDefinition: multiEntryDefinition,
      weaponId: 'metadata-multi',
      partHealth: 25,
      partMaxHealth: 25,
      rngProvider: () => 0.2,
    });

    const allEntries = finalizeSpy.mock.results
      .map((result) => result.value?.entries || [])
      .flat();
    expect(allEntries.length).toBe(2);

    const entriesByType = Object.fromEntries(
      allEntries.map((entry) => [entry.damageType, entry])
    );

    expect(entriesByType.piercing_primary.metadata).toEqual({
      slot: 'primary',
      tier: 1,
    });
    expect(entriesByType.piercing_primary.damageTags).toEqual(['physical']);

    expect(entriesByType.fire_followup.metadata).toEqual({
      slot: 'followup',
      element: 'fire',
    });
    expect(entriesByType.fire_followup.damageTags).toEqual([
      'elemental',
      'burning',
    ]);
  });
});
