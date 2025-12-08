/**
 * @file damageSessionEventQueueing.e2e.test.js
 * @description E2E coverage for damage session pendingEvents flush order.
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
import rapierDefinition from '../../../data/mods/fantasy/entities/definitions/vespera_rapier.entity.json' assert { type: 'json' };
import { createDamageTypeEffectsService } from './helpers/damageTypeEffectsServiceFactory.js';

const ACTION_ID = 'weapons:swing_at_target';
const ROOM_ID = 'session-queue-room';

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

const multiEffectDefinition = cloneWith(rapierDefinition, [
  {
    name: 'slashing',
    amount: 45,
    penetration: 0.35,
    fracture: {
      enabled: true,
      thresholdFraction: 0.2,
      stunChance: 0,
    },
    bleed: {
      enabled: true,
      severity: 'moderate',
    },
    burn: {
      enabled: true,
      dps: 3,
      durationTurns: 2,
      canStack: true,
    },
    poison: {
      enabled: true,
      tick: 2,
      durationTurns: 2,
      scope: 'entity',
    },
  },
]);

const createCombatants = ({
  weaponBuilder,
  weaponId,
  partHealth = 60,
  partMaxHealth = 60,
  partSubType = 'torso',
  vitalOrganType = null,
}) => {
  const part = new ModEntityBuilder(`${weaponId}-target-part`)
    .withName('Target Part')
    .withComponent('anatomy:part', {
      type: 'torso',
      subType: partSubType,
      orientation: 'mid',
      ownerEntityId: `${weaponId}-target`,
      children: [],
    })
    .withComponent('anatomy:part_health', {
      currentHealth: partHealth,
      maxHealth: partMaxHealth,
      status: 'healthy',
    });

  if (vitalOrganType) {
    part.withComponent('anatomy:vital_organ', { organType: vitalOrganType });
  }

  const builtPart = part.build();

  const target = new ModEntityBuilder(`${weaponId}-target`)
    .withName('Queue Target')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:defense_skill', { level: 10 })
    .withComponent('anatomy:body', {
      body: {
        root: builtPart.id,
        parts: { [partSubType]: builtPart.id },
      },
    })
    .build();

  // Ensure ownerEntityId points to the built target
  const partData = builtPart.components['anatomy:part'];
  if (partData) {
    partData.ownerEntityId = target.id;
  }

  const weapon = weaponBuilder.withName('Queue Test Weapon').build();

  const attacker = new ModEntityBuilder(`${weaponId}-attacker`)
    .withName('Queue Attacker')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:melee_skill', { level: 90 })
    .withComponent('items:inventory', { items: [weaponId], capacity: 5 })
    .withComponent('positioning:wielding', { wielded_item_ids: [weaponId] })
    .build();

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Queue Room')
    .withComponent('core:position', { locationId: ROOM_ID })
    .build();

  return { attacker, target, part: builtPart, weapon, room };
};

const installRealHandlers = ({
  testEnv,
  safeDispatcher,
  forcedOutcome = 'SUCCESS',
  rngProvider = () => 0.0,
  registryMutator,
}) => {
  const { entityManager, logger, jsonLogic, operationRegistry } = testEnv;

  const bodyGraphService = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher: safeDispatcher,
  });

  const { damageTypeEffectsService } = createDamageTypeEffectsService({
    testEnv,
    safeEventDispatcher: safeDispatcher,
    rngProvider,
    registryMutator,
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

describe('Damage session pendingEvents flush order (E2E)', () => {
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
    partHealth = 60,
    partMaxHealth = 60,
    partSubType = 'torso',
    vitalOrganType = null,
    rngProvider = () => 0.0,
  }) => {
    const weaponBuilder = buildWeaponFromDefinition(weaponId, weaponDefinition);
    const { attacker, target, part, weapon, room } = createCombatants({
      weaponBuilder,
      weaponId,
      partHealth,
      partMaxHealth,
      partSubType,
      vitalOrganType,
    });

    fixture.reset([attacker, target, part, weapon, room]);
    fixture.clearEvents();

    installRealHandlers({
      testEnv,
      safeDispatcher,
      forcedOutcome: 'SUCCESS',
      rngProvider,
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

    await new Promise((resolve) => setTimeout(resolve, 60));

    return { dispatchSpy, target, part };
  };

  it('dispatches narrative before queued effect events', async () => {
    const { dispatchSpy } = await executeSwing({
      weaponDefinition: multiEffectDefinition,
      weaponId: 'queue-multieffect',
      partHealth: 60,
      partMaxHealth: 60,
      rngProvider: () => 0.0,
    });

    const calls = dispatchSpy.mock.calls.map(([eventType, payload]) => ({
      eventType,
      payload,
    }));

    const narrativeIndex = calls.findIndex(
      (call) =>
        call.eventType === 'core:perceptible_event' &&
        call.payload?.perceptionType === 'damage_received'
    );
    const fractureIndex = calls.findIndex(
      (call) => call.eventType === 'anatomy:fractured'
    );
    const bleedIndex = calls.findIndex(
      (call) => call.eventType === 'anatomy:bleeding_started'
    );
    const burnIndex = calls.findIndex(
      (call) => call.eventType === 'anatomy:burning_started'
    );
    const poisonIndex = calls.findIndex(
      (call) => call.eventType === 'anatomy:poisoned_started'
    );
    const damageAppliedIndex = calls.findIndex(
      (call) => call.eventType === 'anatomy:damage_applied'
    );

    expect(narrativeIndex).toBeGreaterThan(-1);
    expect(fractureIndex).toBeGreaterThan(narrativeIndex);
    expect(bleedIndex).toBeGreaterThan(fractureIndex);
    expect(burnIndex).toBeGreaterThan(bleedIndex);
    expect(poisonIndex).toBeGreaterThan(burnIndex);
    expect(damageAppliedIndex).toBeGreaterThan(poisonIndex);
  });

  it('dispatches damage narrative even when entering dying state', async () => {
    const { dispatchSpy, target, part } = await executeSwing({
      weaponDefinition: multiEffectDefinition,
      weaponId: 'queue-dying-narrative',
      partHealth: 8,
      partMaxHealth: 80,
      partSubType: 'torso',
      rngProvider: () => 0.0,
    });

    const calls = dispatchSpy.mock.calls.map(([eventType, payload]) => ({
      eventType,
      payload,
    }));

    const partHealth = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:part_health'
    );
    expect(partHealth.currentHealth).toBeLessThan(
      partHealth.maxHealth * 0.1
    );

    const dyingIndex = calls.findIndex(
      (call) => call.eventType === 'anatomy:entity_dying'
    );
    const narrativeIndex = calls.findIndex(
      (call) =>
        call.eventType === 'core:perceptible_event' &&
        call.payload?.perceptionType === 'damage_received'
    );
    const damageAppliedIndex = calls.findIndex(
      (call) => call.eventType === 'anatomy:damage_applied'
    );

    expect(dyingIndex).toBeGreaterThan(-1);
    expect(narrativeIndex).toBeGreaterThan(-1);
    expect(damageAppliedIndex).toBeGreaterThan(-1);
    expect(dyingIndex).toBeLessThan(narrativeIndex);
    expect(damageAppliedIndex).toBeGreaterThan(narrativeIndex);
    const dyingComponent = testEnv.entityManager.getComponentData(
      target.id,
      'anatomy:dying'
    );
    expect(dyingComponent).toBeDefined();
    expect(dyingComponent.turnsRemaining).toBe(3);
  });

  it('flushes pending events before anatomy:entity_died on vital organ kill', async () => {
    const { dispatchSpy } = await executeSwing({
      weaponDefinition: multiEffectDefinition,
      weaponId: 'queue-vital',
      partHealth: 20,
      partMaxHealth: 20,
      partSubType: 'heart',
      vitalOrganType: 'heart',
      rngProvider: () => 0.0,
    });

    const calls = dispatchSpy.mock.calls.map(([eventType, payload]) => ({
      eventType,
      payload,
    }));

    const narrativeIndex = calls.findIndex(
      (call) =>
        call.eventType === 'core:perceptible_event' &&
        call.payload?.perceptionType === 'damage_received'
    );
    const fractureIndex = calls.findIndex(
      (call) => call.eventType === 'anatomy:fractured'
    );
    const damageAppliedIndex = calls.findIndex(
      (call) => call.eventType === 'anatomy:damage_applied'
    );
    const deathIndex = calls.findIndex(
      (call) => call.eventType === 'anatomy:entity_died'
    );

    expect(narrativeIndex).toBeGreaterThan(-1);
    expect(fractureIndex).toBeGreaterThan(narrativeIndex);
    expect(damageAppliedIndex).toBeGreaterThan(fractureIndex);
    expect(deathIndex).toBeGreaterThan(damageAppliedIndex);
  });
});
