/**
 * @file propagationBookkeeping.e2e.test.js
 * @description E2E coverage for damage propagation bookkeeping (metadata, events, and narrative grouping).
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
import DamagePropagationService from '../../../src/anatomy/services/damagePropagationService.js';
import InjuryAggregationService from '../../../src/anatomy/services/injuryAggregationService.js';
import DeathCheckService from '../../../src/anatomy/services/deathCheckService.js';
import DamageAccumulator from '../../../src/anatomy/services/damageAccumulator.js';
import DamageNarrativeComposer from '../../../src/anatomy/services/damageNarrativeComposer.js';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';
import mainGaucheDefinition from '../../../data/mods/fantasy/entities/definitions/vespera_main_gauche.entity.json' assert { type: 'json' };
import { createDamageTypeEffectsService } from './helpers/damageTypeEffectsServiceFactory.js';

const ACTION_ID = 'weapons:swing_at_target';
const ROOM_ID = 'propagation-room';
const TARGET_ID = 'propagation-target';

const BASE_TORSO_HEALTH = 80;
const BASE_HEART_HEALTH = 50;
const BASE_LUNG_HEALTH = 44;
const BASE_ARTERY_HEALTH = 18;

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

const installRealHandlers = ({ testEnv, safeDispatcher, forcedOutcome }) => {
  const { entityManager, logger, jsonLogic, operationRegistry } = testEnv;

  const bodyGraphService = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher: safeDispatcher,
  });

  const { damageTypeEffectsService } = createDamageTypeEffectsService({
    testEnv,
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

  const damageAccumulator = new DamageAccumulator({ logger });

  const damageNarrativeComposer = new DamageNarrativeComposer({ logger });

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

const buildTorsoWithHeart = () => {
  const torso = new ModEntityBuilder('torso')
    .withName('Torso')
    .withComponent('anatomy:part', {
      type: 'torso',
      subType: 'torso',
      hit_probability_weight: 10,
    })
    .withComponent('anatomy:part_health', {
      currentHealth: BASE_TORSO_HEALTH,
      maxHealth: BASE_TORSO_HEALTH,
      state: 'healthy',
    })
    .withComponent('anatomy:sockets', {
      sockets: [
        {
          id: 'heart_socket',
          allowedTypes: ['heart'],
        },
      ],
    })
    .withComponent('anatomy:damage_propagation', {
      rules: [
        {
          childSocketId: 'heart_socket',
          baseProbability: 1,
          damageFraction: 0.5,
          damageTypeModifiers: { slashing: 1 },
        },
      ],
    })
    .build();

  const heart = new ModEntityBuilder('heart')
    .withName('Heart')
    .withComponent('anatomy:part', {
      type: 'heart',
      subType: 'heart',
      hit_probability_weight: 0,
    })
    .withComponent('anatomy:part_health', {
      currentHealth: BASE_HEART_HEALTH,
      maxHealth: BASE_HEART_HEALTH,
      state: 'healthy',
    })
    .withComponent('anatomy:vital_organ', { organType: 'heart' })
    .withComponent('anatomy:joint', {
      parentId: torso.id,
      socketId: 'heart_socket',
    })
    .build();

  return { torso, heart };
};

const buildTorsoWithHeartAndLung = () => {
  const torso = new ModEntityBuilder('torso-double')
    .withName('Torso')
    .withComponent('anatomy:part', {
      type: 'torso',
      subType: 'torso',
      hit_probability_weight: 10,
    })
    .withComponent('anatomy:part_health', {
      currentHealth: BASE_TORSO_HEALTH,
      maxHealth: BASE_TORSO_HEALTH,
      state: 'healthy',
    })
    .withComponent('anatomy:sockets', {
      sockets: [
        { id: 'heart_socket', allowedTypes: ['heart'] },
        { id: 'lung_socket', allowedTypes: ['lung'] },
      ],
    })
    .withComponent('anatomy:damage_propagation', {
      rules: [
        {
          childSocketId: 'heart_socket',
          baseProbability: 1,
          damageFraction: 0.4,
          damageTypeModifiers: { slashing: 1 },
        },
        {
          childSocketId: 'lung_socket',
          baseProbability: 1,
          damageFraction: 0.4,
          damageTypeModifiers: { slashing: 1 },
        },
      ],
    })
    .build();

  const heart = new ModEntityBuilder('heart-double')
    .withName('Heart')
    .withComponent('anatomy:part', {
      type: 'heart',
      subType: 'heart',
      hit_probability_weight: 0,
    })
    .withComponent('anatomy:part_health', {
      currentHealth: BASE_HEART_HEALTH,
      maxHealth: BASE_HEART_HEALTH,
      state: 'healthy',
    })
    .withComponent('anatomy:vital_organ', { organType: 'heart' })
    .withComponent('anatomy:joint', {
      parentId: torso.id,
      socketId: 'heart_socket',
    })
    .build();

  const lung = new ModEntityBuilder('lung-double')
    .withName('Lung')
    .withComponent('anatomy:part', {
      type: 'lung',
      subType: 'lung',
      hit_probability_weight: 0,
    })
    .withComponent('anatomy:part_health', {
      currentHealth: BASE_LUNG_HEALTH,
      maxHealth: BASE_LUNG_HEALTH,
      state: 'healthy',
    })
    .withComponent('anatomy:joint', {
      parentId: torso.id,
      socketId: 'lung_socket',
    })
    .build();

  return { torso, heart, lung };
};

const buildRecursiveChain = () => {
  const { torso, heart } = buildTorsoWithHeart();

  const heartWithSockets = new ModEntityBuilder(heart.id)
    .withName('Heart')
    .withComponent('anatomy:part', heart.components['anatomy:part'])
    .withComponent(
      'anatomy:part_health',
      heart.components['anatomy:part_health']
    )
    .withComponent('anatomy:vital_organ', heart.components['anatomy:vital_organ'])
    .withComponent('anatomy:joint', heart.components['anatomy:joint'])
    .withComponent('anatomy:sockets', {
      sockets: [{ id: 'artery_socket', allowedTypes: ['artery'] }],
    })
    .withComponent('anatomy:damage_propagation', {
      rules: [
        {
          childSocketId: 'artery_socket',
          baseProbability: 1,
          damageFraction: 0.25,
          damageTypeModifiers: { slashing: 1 },
        },
      ],
    })
    .build();

  const artery = new ModEntityBuilder('artery')
    .withName('Artery')
    .withComponent('anatomy:part', {
      type: 'artery',
      subType: 'artery',
      hit_probability_weight: 0,
    })
    .withComponent('anatomy:part_health', {
      currentHealth: BASE_ARTERY_HEALTH,
      maxHealth: BASE_ARTERY_HEALTH,
      state: 'healthy',
    })
    .withComponent('anatomy:joint', {
      parentId: heart.id,
      socketId: 'artery_socket',
    })
    .build();

  return { torso, heart: heartWithSockets, artery };
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
    .withComponent('item-handling-states:wielding', { wielded_item_ids: [weaponId] })
    .build();

const createRoom = () =>
  new ModEntityBuilder(ROOM_ID)
    .withName('Propagation Room')
    .withComponent('core:position', { locationId: ROOM_ID })
    .build();

describe('propagation bookkeeping e2e', () => {
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

    await new Promise((resolve) => setTimeout(resolve, 50));

    return { attacker, target };
  };

  it('should attach propagatedFrom metadata and dispatch propagation payload', async () => {
    const { torso, heart } = buildTorsoWithHeart();
    await executeSwing({
      weaponDefinition: slashingBladeDefinition,
      weaponId: 'slashing-dagger-bookkeeping',
      parts: [torso, heart],
      rootPartId: torso.id,
      randomSequence: [0, 0.1],
    });

    const propagationEvent = fixture.events.find(
      (e) =>
        e.eventType === 'anatomy:internal_damage_propagated' &&
        e.payload?.targetPartId === heart.id
    );

    expect(propagationEvent).toBeDefined();
    expect(propagationEvent?.payload).toMatchObject({
      ownerEntityId: TARGET_ID,
      sourcePartId: torso.id,
      targetPartId: heart.id,
      damageTypeId: 'slashing',
    });
    expect(typeof propagationEvent?.payload?.timestamp).toBe('number');
    expect(propagationEvent?.payload?.damageAmount).toBeCloseTo(10); // 20 * 0.5

    const heartDamageEvent = fixture.events.find(
      (e) =>
        e.eventType === 'anatomy:damage_applied' &&
        e.payload?.partId === heart.id
    );

    expect(heartDamageEvent?.payload?.propagatedFrom).toBe(torso.id);
  });

  it('should include propagated damage in narrative and group propagated parts', async () => {
    const { torso, heart, lung } = buildTorsoWithHeartAndLung();
    await executeSwing({
      weaponDefinition: slashingBladeDefinition,
      weaponId: 'slashing-dagger-narrative',
      parts: [torso, heart, lung],
      rootPartId: torso.id,
      randomSequence: [0, 0.05],
    });

    const perceptibleEvent = fixture.events.find(
      (e) =>
        e.eventType === 'core:perceptible_event' &&
        e.payload?.perceptionType === 'damage_received'
    );

    expect(perceptibleEvent).toBeDefined();
    const description = perceptibleEvent?.payload?.descriptionText || '';
    const asResultOccurrences = description.match(/As a result/g) || [];

    expect(description).toContain('torso suffers slashing damage');
    expect(description).toContain('heart and lung suffer slashing damage');
    expect(asResultOccurrences.length).toBe(1);

    const propagatedParts = fixture.events
      .filter(
        (e) =>
          e.eventType === 'anatomy:damage_applied' && e.payload?.propagatedFrom
      )
      .map((e) => ({
        partId: e.payload.partId,
        from: e.payload.propagatedFrom,
      }));

    expect(propagatedParts).toEqual(
      expect.arrayContaining([
        { partId: heart.id, from: torso.id },
        { partId: lung.id, from: torso.id },
      ])
    );
  });

  it('should preserve propagatedFrom linkage per hop in a recursive chain', async () => {
    const { torso, heart, artery } = buildRecursiveChain();
    await executeSwing({
      weaponDefinition: slashingBladeDefinition,
      weaponId: 'slashing-dagger-chain',
      parts: [torso, heart, artery],
      rootPartId: torso.id,
      randomSequence: [0, 0.01, 0.01],
    });

    const propagatedEvents = fixture.events.filter(
      (e) => e.eventType === 'anatomy:damage_applied' && e.payload?.propagatedFrom
    );

    const propagationMap = propagatedEvents.reduce((acc, e) => {
      acc[e.payload.partId] = e.payload.propagatedFrom;
      return acc;
    }, {});

    expect(propagationMap[heart.id]).toBe(torso.id);
    expect(propagationMap[artery.id]).toBe(heart.id);

    const propagationEvents = fixture.events.filter(
      (e) => e.eventType === 'anatomy:internal_damage_propagated'
    );

    expect(
      propagationEvents.some(
        (e) =>
          e.payload?.sourcePartId === torso.id &&
          e.payload?.targetPartId === heart.id
      )
    ).toBe(true);
    expect(
      propagationEvents.some(
        (e) =>
          e.payload?.sourcePartId === heart.id &&
          e.payload?.targetPartId === artery.id
      )
    ).toBe(true);
  });
});
