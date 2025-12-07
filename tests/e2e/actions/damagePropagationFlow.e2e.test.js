/**
 * @file damagePropagationFlow.e2e.test.js
 * @description High-priority e2e coverage for internal damage propagation across parent/child parts.
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
import mainGaucheDefinition from '../../../data/mods/fantasy/entities/definitions/vespera_main_gauche.entity.json' assert { type: 'json' };
import practiceStickDefinition from '../../../data/mods/fantasy/entities/definitions/rill_practice_stick.entity.json' assert { type: 'json' };
import {
  BASE_HEALTHS,
  buildHumanHeadWithBrain as buildHeadWithBrain,
  buildHumanTorsoWithHeart as buildTorsoWithHeart,
  buildHumanTorsoWithHeartAndSpine as buildTorsoWithHeartAndSpine,
} from '../../common/anatomy/dataDrivenFixtures.js';

const ACTION_ID = 'weapons:swing_at_target';
const ROOM_ID = 'propagation-room';
const TARGET_ID = 'propagation-target';
const BASE_TORSO_HEALTH = BASE_HEALTHS.torso;
const BASE_HEART_HEALTH = BASE_HEALTHS.heart;
const BASE_SPINE_HEALTH = BASE_HEALTHS.spine;
const BASE_HEAD_HEALTH = BASE_HEALTHS.head;
const BASE_BRAIN_HEALTH = BASE_HEALTHS.brain;

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

const cloneWithDamageEntries = (definition, entries) => {
  const clone = JSON.parse(JSON.stringify(definition));
  clone.components = clone.components || {};
  clone.components['damage-types:damage_capabilities'] = {
    ...(clone.components['damage-types:damage_capabilities'] || {}),
    entries,
  };
  return clone;
};

const slashingBladeDefinition = cloneWithDamageEntries(mainGaucheDefinition, [
  { name: 'slashing', amount: 20, penetration: 0.9 },
]);

const bluntStickDefinition = cloneWithDamageEntries(practiceStickDefinition, [
  { name: 'blunt', amount: 12, penetration: 0.1 },
]);

const installRealHandlers = ({ testEnv, safeDispatcher, forcedOutcome }) => {
  const { entityManager, logger, jsonLogic, operationRegistry } = testEnv;

  const bodyGraphService = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher: safeDispatcher,
  });

  const damageTypeEffectsService = new DamageTypeEffectsService({
    entityManager,
    logger,
    safeEventDispatcher: safeDispatcher,
    rngProvider: () => 0.5,
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
};

const createTarget = (rootPartId) =>
  new ModEntityBuilder(TARGET_ID)
    .withName('Propagation Target')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:defense_skill', { level: 5 })
    .withComponent('anatomy:body', { body: { root: rootPartId } })
    .build();

const createAttacker = (weaponId) =>
  new ModEntityBuilder(`attacker-${weaponId}`)
    .withName('Propagation Attacker')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:melee_skill', { level: 90 })
    .withComponent('items:inventory', { items: [weaponId], capacity: 5 })
    .withComponent('positioning:wielding', { wielded_item_ids: [weaponId] })
    .build();

const createRoom = () =>
  new ModEntityBuilder(ROOM_ID)
    .withName('Propagation Room')
    .withComponent('core:position', { locationId: ROOM_ID })
    .build();

describe('damage propagation flow e2e', () => {
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
    parts,
    rootPartId,
    randomSequence = [],
    forcedOutcome = 'SUCCESS',
  }) => {
    const weaponBuilder = buildWeaponFromDefinition(weaponId, weaponDefinition);
    const weapon = weaponBuilder.withName('Propagation Weapon').build();
    const attacker = createAttacker(weaponId);
    const target = createTarget(rootPartId);
    const room = createRoom();

    fixture.reset([...parts, weapon, attacker, target, room]);
    fixture.clearEvents();

    installRealHandlers({ testEnv, safeDispatcher, forcedOutcome });

    const values = [...randomSequence];
    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockImplementation(() => (values.length ? values.shift() : 0));

    await testEnv.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actionId: ACTION_ID,
      actorId: attacker.id,
      primaryId: weapon.id,
      secondaryId: target.id,
      originalInput: `swing ${weapon.id} at ${target.id}`,
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    return { attacker, target };
  };

  it('propagates torso damage to the heart using configured torso rules', async () => {
    const { torso, heart } = buildTorsoWithHeart();
    await executeSwing({
      weaponDefinition: slashingBladeDefinition,
      weaponId: 'slashing-dagger',
      parts: [torso, heart],
      rootPartId: torso.id,
      randomSequence: [0, 0.1], // deterministic hit + propagation roll
    });

    const propagationEvent = fixture.events.find(
      (e) =>
        e.eventType === 'anatomy:internal_damage_propagated' &&
        e.payload?.targetPartId === heart.id
    );
    const eventTypes = fixture.events.map((e) => e.eventType);
    const damagedParts = fixture.events
      .filter((e) => e.eventType === 'anatomy:damage_applied')
      .map((e) => e.payload?.partId);
    const torsoHealth = testEnv.entityManager.getComponentData(
      torso.id,
      'anatomy:part_health'
    );

    expect(eventTypes).toContain('anatomy:damage_applied');
    expect(damagedParts).toContain(heart.id);
    expect(torsoHealth.currentHealth).toBeLessThan(BASE_TORSO_HEALTH);
    const heartHealth = testEnv.entityManager.getComponentData(
      heart.id,
      'anatomy:part_health'
    );

    expect(propagationEvent).toBeDefined();
    expect(propagationEvent?.payload?.damageAmount).toBeCloseTo(10); // 20 * 0.5
    expect(heartHealth.currentHealth).toBe(BASE_HEART_HEALTH - 10);
  });

  it('propagates head damage to the brain when probability threshold is met', async () => {
    const { head, brain } = buildHeadWithBrain();
    await executeSwing({
      weaponDefinition: slashingBladeDefinition,
      weaponId: 'slashing-dagger-head',
      parts: [head, brain],
      rootPartId: head.id,
      randomSequence: [0, 0.2], // hit head, propagation roll under 0.52
    });

    const brainHealth = testEnv.entityManager.getComponentData(
      brain.id,
      'anatomy:part_health'
    );
    const propagationEvent = fixture.events.find(
      (e) =>
        e.eventType === 'anatomy:internal_damage_propagated' &&
        e.payload?.targetPartId === brain.id
    );

    expect(propagationEvent).toBeDefined();
    expect(propagationEvent?.payload?.sourcePartId).toBe(head.id);
    expect(brainHealth.currentHealth).toBeCloseTo(
      BASE_BRAIN_HEALTH - 12 // 20 * 0.6
    );
  });

  it('respects propagation probability modifiers and skips when the roll exceeds the chance', async () => {
    const { torso, heart } = buildTorsoWithHeart();
    await executeSwing({
      weaponDefinition: bluntStickDefinition,
      weaponId: 'blunt-stick',
      parts: [torso, heart],
      rootPartId: torso.id,
      randomSequence: [0, 0.95], // blunt modifier 0.3 -> effective prob 0.09, roll fails
    });

    const propagationEvents = fixture.events.filter(
      (e) => e.eventType === 'anatomy:internal_damage_propagated'
    );
    const heartHealth = testEnv.entityManager.getComponentData(
      heart.id,
      'anatomy:part_health'
    );

    expect(propagationEvents.length).toBe(0);
    expect(heartHealth.currentHealth).toBe(BASE_HEART_HEALTH);
  });

  it('applies propagation to each configured child socket from authored anatomy data', async () => {
    const { torso, heart, spine } = buildTorsoWithHeartAndSpine();
    await executeSwing({
      weaponDefinition: slashingBladeDefinition,
      weaponId: 'slashing-dagger-recursive',
      parts: [torso, heart, spine],
      rootPartId: torso.id,
      randomSequence: [0, 0.01, 0.01], // torso->heart and torso->spine
    });

    const propagationEvents = fixture.events.filter(
      (e) => e.eventType === 'anatomy:internal_damage_propagated'
    );

    const heartHealth = testEnv.entityManager.getComponentData(
      heart.id,
      'anatomy:part_health'
    );
    const spineHealth = testEnv.entityManager.getComponentData(
      spine.id,
      'anatomy:part_health'
    );

    expect(propagationEvents.length).toBe(2);
    expect(
      propagationEvents.some(
        (e) =>
          e.payload?.sourcePartId === torso.id &&
          e.payload?.targetPartId === heart.id &&
          e.payload?.ownerEntityId === TARGET_ID
      )
    ).toBe(true);
    expect(
      propagationEvents.some(
        (e) =>
          e.payload?.sourcePartId === torso.id &&
          e.payload?.targetPartId === spine.id &&
          e.payload?.ownerEntityId === TARGET_ID
      )
    ).toBe(true);

    expect(heartHealth.currentHealth).toBe(BASE_HEART_HEALTH - 10); // 20 * 0.5
    expect(spineHealth.currentHealth).toBe(BASE_SPINE_HEALTH - 10); // 20 * 0.5
  });
});
