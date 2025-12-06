/**
 * @file damageNarrativeDispatch.e2e.test.js
 * @description E2E coverage for DamageNarrativeComposer output dispatch via core:perceptible_event.
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
const ROOM_ID = 'narrative-room';

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

const cloneWith = (definition, damageEntries) => {
  const cloned = JSON.parse(JSON.stringify(definition));
  cloned.components = cloned.components || {};
  cloned.components['damage-types:damage_capabilities'] = {
    ...(cloned.components['damage-types:damage_capabilities'] || {}),
    entries: damageEntries,
  };
  return cloned;
};

// Weapon triggering bleed
const bleedRapierDefinition = cloneWith(rapierDefinition, [
  {
    name: 'slashing',
    amount: 10,
    penetration: 0.5,
    bleed: {
      enabled: true,
      severity: 'minor',
      chance: 1.0, // Force bleed
    },
  },
]);

// Weapon causing multi-part damage (via high penetration/propagation simulation implies setup,
// but here we might rely on the fact that propagation happens if we target a part with children/parent rules.
// Alternatively, we can rely on standard propagation rules or just standard damage).

const createCombatants = ({
  weaponBuilder,
  weaponId,
  partHealth = 50,
  partMaxHealth = 50,
  targetHasPosition = true,
}) => {
  const part = new ModEntityBuilder(`${weaponId}-target-part`)
    .withName('Target Part')
    .withComponent('anatomy:part', {
      type: 'torso',
      subType: 'torso',
      orientation: 'mid',
      children: [],
      // Ensure ownerEntityId is set if possible, otherwise rely on system linkage
      ownerEntityId: `${weaponId}-target`,
    })
    .withComponent('anatomy:part_health', {
      currentHealth: partHealth,
      maxHealth: partMaxHealth,
      status: 'healthy',
    })
    .build();

  const targetBuilder = new ModEntityBuilder(`${weaponId}-target`)
    .withName('Effect Target')
    .asActor()
    .withComponent('skills:defense_skill', { level: 10 })
    .withComponent('anatomy:body', { body: { root: part.id } });

  if (targetHasPosition) {
    targetBuilder.withComponent('core:position', { locationId: ROOM_ID });
  }

  const target = targetBuilder.build();

  const weapon = weaponBuilder.withName('Narrative Test Weapon').build();

  const attacker = new ModEntityBuilder(`${weaponId}-attacker`)
    .withName('Narrative Attacker')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:melee_skill', { level: 90 })
    .withComponent('items:inventory', { items: [weaponId], capacity: 5 })
    .withComponent('positioning:wielding', { wielded_item_ids: [weaponId] })
    .build();

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Narrative Room')
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
  const { entityManager, logger, jsonLogic, operationRegistry, eventBus } =
    testEnv;

  const bodyGraphService = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher: safeDispatcher,
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

  const damageAccumulator = new DamageAccumulator({
    logger,
  });

  const damageNarrativeComposer = new DamageNarrativeComposer({
    logger,
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

  return { eventBus };
};

describe('Damage Narrative Dispatch E2E', () => {
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
    jest.spyOn(Math, 'random').mockReturnValue(0);
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
    partHealth = 50,
    partMaxHealth = 50,
    targetHasPosition = true,
    rngProvider = () => 0.5,
  }) => {
    const weaponBuilder = buildWeaponFromDefinition(weaponId, weaponDefinition);
    const { attacker, target, part, weapon, room } = createCombatants({
      weaponBuilder,
      weaponId,
      partHealth,
      partMaxHealth,
      targetHasPosition,
    });

    // Make sure we update the part ownerEntityId to match the target we just built
    // (Though we set it in createCombatants, just being safe if ModEntityBuilder overrides)
    const partData = part.components['anatomy:part'];
    if (partData) {
      partData.ownerEntityId = target.id;
    }

    fixture.reset([attacker, target, part, weapon, room]);
    fixture.clearEvents();

    installRealHandlers({
      testEnv,
      safeDispatcher,
      forcedOutcome: 'SUCCESS',
      rngProvider,
    });

    // Spy on dispatch to capture core:perceptible_event specifically
    const dispatchSpy = jest.spyOn(testEnv.eventBus, 'dispatch');

    await testEnv.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actionId: ACTION_ID,
      actorId: attacker.id,
      primaryId: weapon.id,
      secondaryId: target.id,
      originalInput: `swing ${weapon.id} at ${target.id}`,
    });

    await new Promise((resolve) => setTimeout(resolve, 50)); // Wait for async ops

    return { dispatchSpy, attacker, target, part };
  };

  it('should dispatch damage narrative as core:perceptible_event with perceptionType damage_received', async () => {
    const { dispatchSpy, target } = await executeSwing({
      weaponDefinition: rapierDefinition,
      weaponId: 'std-rapier',
    });

    const calls = dispatchSpy.mock.calls;
    const perceptibleEvent = calls.find(
      (call) =>
        call[0] === 'core:perceptible_event' &&
        call[1].perceptionType === 'damage_received'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent[1]).toMatchObject({
      targetId: target.id,
      eventName: 'core:perceptible_event',
    });
    expect(typeof perceptibleEvent[1].descriptionText).toBe('string');
    expect(perceptibleEvent[1].descriptionText.length).toBeGreaterThan(0);
  });

  it('should include totalDamage in perceptible event payload', async () => {
    const { dispatchSpy } = await executeSwing({
      weaponDefinition: rapierDefinition,
      weaponId: 'dmg-rapier',
    });

    const perceptibleEvent = dispatchSpy.mock.calls.find(
      (call) =>
        call[0] === 'core:perceptible_event' &&
        call[1].perceptionType === 'damage_received'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent[1].contextualData).toBeDefined();
    expect(perceptibleEvent[1].contextualData.totalDamage).toBeGreaterThan(0);
  });

  it('should include effect descriptions in narrative when bleed/burn/poison triggered', async () => {
    const { dispatchSpy } = await executeSwing({
      weaponDefinition: bleedRapierDefinition,
      weaponId: 'bleed-trigger-rapier',
      rngProvider: () => 0.0, // Ensure triggers
    });

    const perceptibleEvent = dispatchSpy.mock.calls.find(
      (call) =>
        call[0] === 'core:perceptible_event' &&
        call[1].perceptionType === 'damage_received'
    );

    expect(perceptibleEvent).toBeDefined();
    const narrative = perceptibleEvent[1].descriptionText;
    // The narrative composer should include something about bleeding
    // Adjust expectation based on actual composer output, but 'bleed' is a safe bet
    expect(narrative.toLowerCase()).toContain('bleed');
  });

  it('should use actor location when target part lacks position component', async () => {
    const { dispatchSpy, attacker } = await executeSwing({
      weaponDefinition: rapierDefinition,
      weaponId: 'loc-fallback-rapier',
      targetHasPosition: false,
    });

    const perceptibleEvent = dispatchSpy.mock.calls.find(
      (call) =>
        call[0] === 'core:perceptible_event' &&
        call[1].perceptionType === 'damage_received'
    );

    expect(perceptibleEvent).toBeDefined();
    // Should fallback to attacker location
    expect(perceptibleEvent[1].locationId).toBe(ROOM_ID);
  });

  it('should aggregate damage from multiple parts into single narrative event', async () => {
    const weaponId = 'agg-rapier';
    const parentPartId = `${weaponId}-parent-part`;
    const childPartId = `${weaponId}-child-part`;
    const targetId = `${weaponId}-target`;

    // Child part (heart)
    const childPart = new ModEntityBuilder(childPartId)
      .withComponent('anatomy:part', {
        type: 'organ',
        subType: 'heart',
        parent: parentPartId,
        ownerEntityId: targetId,
      })
      .withComponent('anatomy:part_health', {
        currentHealth: 20,
        maxHealth: 20,
        status: 'healthy',
      })
      .withComponent('anatomy:joint', { parentId: parentPartId })
      .build();

    // Parent part (torso) - Propagates 100% damage to child
    const parentPart = new ModEntityBuilder(parentPartId)
      .withComponent('anatomy:part', {
        type: 'torso',
        subType: 'torso',
        children: [childPartId],
        ownerEntityId: targetId,
      })
      .withComponent('anatomy:part_health', {
        currentHealth: 50,
        maxHealth: 50,
        status: 'healthy',
      })
      .withComponent('anatomy:damage_propagation', {
        rules: [
          {
            childPartId: childPartId,
            baseProbability: 1.0,
            damageFraction: 1.0,
          },
        ],
      })
      .build();

    const target = new ModEntityBuilder(targetId)
      .withName('Aggregation Target')
      .asActor()
      .withComponent('skills:defense_skill', { level: 10 })
      .withComponent('anatomy:body', {
        body: {
          root: parentPartId,
          parts: { torso: parentPartId, heart: childPartId },
        },
      })
      .withComponent('core:position', { locationId: ROOM_ID })
      .build();

    const weaponBuilder = buildWeaponFromDefinition(weaponId, rapierDefinition);
    const weapon = weaponBuilder.withName('Agg Rapier').build();

    const attacker = new ModEntityBuilder(`${weaponId}-attacker`)
      .withName('Agg Attacker')
      .asActor()
      .withComponent('core:position', { locationId: ROOM_ID })
      .withComponent('skills:melee_skill', { level: 90 })
      .withComponent('items:inventory', { items: [weaponId], capacity: 5 })
      .withComponent('positioning:wielding', { wielded_item_ids: [weaponId] })
      .build();

    const room = new ModEntityBuilder(ROOM_ID)
      .withName('Narrative Room')
      .withComponent('core:position', { locationId: ROOM_ID })
      .build();

    fixture.reset([attacker, target, parentPart, childPart, weapon, room]);
    fixture.clearEvents();

    installRealHandlers({
      testEnv,
      safeDispatcher,
      forcedOutcome: 'SUCCESS',
    });

    const dispatchSpy = jest.spyOn(testEnv.eventBus, 'dispatch');

    await testEnv.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actionId: ACTION_ID,
      actorId: attacker.id,
      primaryId: weapon.id,
      secondaryId: target.id,
      originalInput: `swing ${weapon.id} at ${target.id}`,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const perceptibleEvents = dispatchSpy.mock.calls.filter(
      (call) =>
        call[0] === 'core:perceptible_event' &&
        call[1].perceptionType === 'damage_received'
    );

    expect(perceptibleEvents.length).toBe(1);

    // We expect parent damage + child damage.
    // If standard rapier does ~8 damage (variable), we expect ~16 total.
    // We can't be exact on amount due to RNG/Strength, but we can check it's > parent damage (or check logic).
    // The previous test assumed 5 + 5 = 10.
    // Here we can check if totalDamage > amount of first entry.

    const event = perceptibleEvents[0][1];
    const totalDamage = event.contextualData.totalDamage;

    // Check internal logs or traces?
    // Or just assert totalDamage > 0.
    // To be sure aggregation happened, we can check if description contains BOTH parts.
    // "torso suffers ... As a result ... heart suffers ..."

    expect(totalDamage).toBeGreaterThan(0);
    const desc = event.descriptionText.toLowerCase();
    expect(desc).toContain('torso');
    expect(desc).toContain('heart');
  });
});
