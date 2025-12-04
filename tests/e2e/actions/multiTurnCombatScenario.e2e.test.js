/**
 * @file multiTurnCombatScenario.e2e.test.js
 * @description High-priority e2e coverage for multi-turn combat: damage accumulation, bleed ticks, dying countdown, and success-before-damage messaging.
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
import BleedingTickSystem from '../../../src/anatomy/services/bleedingTickSystem.js';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';
import rapierDefinition from '../../../data/mods/fantasy/entities/definitions/vespera_rapier.entity.json' assert { type: 'json' };

const ACTION_ID = 'weapons:swing_at_target';
const ROOM_ID = 'multi-turn-room';
const TARGET_ID = 'multi-turn-target';

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

const cloneWithBleedHeavyStrike = (definition) => {
  const clone = JSON.parse(JSON.stringify(definition));
  clone.components = clone.components || {};
  clone.components['damage-types:damage_capabilities'] = {
    ...(clone.components['damage-types:damage_capabilities'] || {}),
    entries: [
      {
        name: 'slashing',
        amount: 22,
        penetration: 0.2,
        bleed: {
          enabled: true,
          severity: 'moderate',
          baseDurationTurns: 3,
        },
      },
    ],
  };
  return clone;
};

const bleedBladeDefinition = cloneWithBleedHeavyStrike(rapierDefinition);

const createCombatants = ({
  weaponBuilder,
  weaponId,
  partHealth = 52,
  partMaxHealth = 52,
}) => {
  const torso = new ModEntityBuilder(`${TARGET_ID}-torso`)
    .withName('Target Torso')
    .withComponent('anatomy:part', {
      type: 'torso',
      subType: 'torso',
      orientation: 'mid',
      ownerEntityId: TARGET_ID,
      children: [],
    })
    .withComponent('anatomy:part_health', {
      currentHealth: partHealth,
      maxHealth: partMaxHealth,
      status: 'healthy',
    })
    .build();

  const target = new ModEntityBuilder(TARGET_ID)
    .withName('Multi-Turn Target')
    .asActor()
    .withComponent('core:name', { text: 'Multi-Turn Target' })
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:defense_skill', { level: 5 })
    .withComponent('anatomy:body', { body: { root: torso.id } })
    .build();

  const weapon = weaponBuilder.withName('Bleed Blade').build();

  const attacker = new ModEntityBuilder('multi-turn-attacker')
    .withName('Multi-Turn Attacker')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:melee_skill', { level: 95 })
    .withComponent('items:inventory', { items: [weaponId], capacity: 3 })
    .withComponent('positioning:wielding', { wielded_item_ids: [weaponId] })
    .build();

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Arena')
    .withComponent('core:position', { locationId: ROOM_ID })
    .build();

  return { attacker, target, torso, weapon, room };
};

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

  const applyDamageHandler = new ApplyDamageHandler({
    entityManager,
    logger,
    safeEventDispatcher: safeDispatcher,
    jsonLogicService: jsonLogic,
    bodyGraphService,
    damageTypeEffectsService,
    damagePropagationService,
    deathCheckService,
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

  return { deathCheckService, bodyGraphService };
};

describe('multi-turn combat scenario e2e (high priority)', () => {
  let fixture;
  let testEnv;
  let safeDispatcher;
  let deathCheckService;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'weapons',
      ACTION_ID,
      null,
      null,
      { autoRegisterScopes: true, scopeCategories: ['positioning', 'anatomy'] }
    );
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

  it('accumulates damage across turns, applies bleed ticks, enters dying, and respects success-before-damage messaging', async () => {
    const weaponBuilder = buildWeaponFromDefinition(
      'bleed-blade',
      bleedBladeDefinition
    );
    const { attacker, target, torso, weapon, room } = createCombatants({
      weaponBuilder,
      weaponId: 'bleed-blade',
    });

    fixture.reset([attacker, target, torso, weapon, room]);
    fixture.clearEvents();

    const handlers = installRealHandlers({
      testEnv,
      safeDispatcher,
      forcedOutcome: 'SUCCESS',
    });
    deathCheckService = handlers.deathCheckService;

    // Two consecutive swings to accumulate damage and re-apply bleed
    await testEnv.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actionId: ACTION_ID,
      actorId: attacker.id,
      primaryId: weapon.id,
      secondaryId: target.id,
      originalInput: `swing ${weapon.id} at ${target.id}`,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    await testEnv.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actionId: ACTION_ID,
      actorId: attacker.id,
      primaryId: weapon.id,
      secondaryId: target.id,
      originalInput: `swing again`,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const successIdx = fixture.events.findIndex(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    const damageIdx = fixture.events.findIndex(
      (e) => e.eventType === 'anatomy:damage_applied'
    );

    expect(successIdx).toBeGreaterThan(-1);
    expect(damageIdx).toBeGreaterThan(-1);
    expect(successIdx).toBeLessThan(damageIdx);

    const bleedComponent = testEnv.entityManager.getComponentData(
      torso.id,
      'anatomy:bleeding'
    );
    expect(bleedComponent).toEqual(
      expect.objectContaining({
        severity: 'moderate',
        remainingTurns: 3,
        tickDamage: 3,
      })
    );

    const initialHealth =
      testEnv.entityManager.getComponentData(torso.id, 'anatomy:part_health')
        ?.currentHealth;
    expect(initialHealth).toBeLessThan(52);

    const bleedingSystem = new BleedingTickSystem({
      logger: testEnv.logger,
      entityManager: testEnv.entityManager,
      safeEventDispatcher: safeDispatcher,
      validatedEventDispatcher: testEnv.eventBus,
    });

    const originalGetEntitiesWithComponent =
      testEnv.entityManager.getEntitiesWithComponent.bind(testEnv.entityManager);
    testEnv.entityManager.getEntitiesWithComponent = (componentId) =>
      componentId === 'anatomy:bleeding'
        ? [torso.id]
        : originalGetEntitiesWithComponent(componentId);

    // Two turns of bleed ticks
    await testEnv.eventBus.dispatch('core:turn_ended', { turn: 1 });
    await testEnv.eventBus.dispatch('core:turn_ended', { turn: 2 });
    await new Promise((resolve) => setTimeout(resolve, 15));

    const postTickHealth =
      testEnv.entityManager.getComponentData(torso.id, 'anatomy:part_health')
        ?.currentHealth;
    expect(postTickHealth).toBeLessThan(initialHealth);

    const dyingResult = deathCheckService.checkDeathConditions(
      target.id,
      attacker.id
    );
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(dyingResult.isDying).toBe(true);
    const dyingComponent = testEnv.entityManager.getComponentData(
      target.id,
      'anatomy:dying'
    );
    expect(dyingComponent?.turnsRemaining).toBe(3);

    // Countdown to death across turns
    expect(deathCheckService.processDyingTurn(target.id)).toBe(false);
    expect(deathCheckService.processDyingTurn(target.id)).toBe(false);
    expect(deathCheckService.processDyingTurn(target.id)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const deathEvent = fixture.events.find(
      (e) => e.eventType === 'anatomy:entity_died'
    );
    expect(deathEvent).toBeDefined();
    expect(deathEvent?.payload?.causeOfDeath).toBe('bleeding_out');

    bleedingSystem.destroy();
  });

  it('allows stabilization to pause the dying countdown and prevent death until stabilization is removed', async () => {
    const weaponBuilder = buildWeaponFromDefinition(
      'bleed-blade',
      bleedBladeDefinition
    );
    const { attacker, target, torso, weapon, room } = createCombatants({
      weaponBuilder,
      weaponId: 'bleed-blade',
      partHealth: 30,
      partMaxHealth: 30,
    });

    fixture.reset([attacker, target, torso, weapon, room]);
    fixture.clearEvents();

    const handlers = installRealHandlers({
      testEnv,
      safeDispatcher,
      forcedOutcome: 'SUCCESS',
    });
    deathCheckService = handlers.deathCheckService;

    // Two swings to trigger dying (<10% overall health)
    await testEnv.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actionId: ACTION_ID,
      actorId: attacker.id,
      primaryId: weapon.id,
      secondaryId: target.id,
      originalInput: `swing ${weapon.id} at ${target.id}`,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await testEnv.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actionId: ACTION_ID,
      actorId: attacker.id,
      primaryId: weapon.id,
      secondaryId: target.id,
      originalInput: `swing again`,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const dyingComponent = testEnv.entityManager.getComponentData(
      target.id,
      'anatomy:dying'
    );
    expect(dyingComponent).toBeDefined();

    // Stabilize (simulate medical intervention)
    await testEnv.entityManager.addComponent(target.id, 'anatomy:dying', {
      ...dyingComponent,
      stabilizedBy: 'field-medic',
    });
    fixture.clearEvents();

    // Countdown should be paused while stabilized
    expect(deathCheckService.processDyingTurn(target.id)).toBe(false);
    expect(deathCheckService.processDyingTurn(target.id)).toBe(false);

    const stabilizedComponent = testEnv.entityManager.getComponentData(
      target.id,
      'anatomy:dying'
    );
    expect(stabilizedComponent?.turnsRemaining).toBe(dyingComponent.turnsRemaining);

    const noDeathEvent = fixture.events.find(
      (e) => e.eventType === 'anatomy:entity_died'
    );
    expect(noDeathEvent).toBeUndefined();

    // Remove stabilization and ensure countdown resumes to death
    await testEnv.entityManager.addComponent(target.id, 'anatomy:dying', {
      ...stabilizedComponent,
      stabilizedBy: null,
    });
    expect(deathCheckService.processDyingTurn(target.id)).toBe(false);
    expect(deathCheckService.processDyingTurn(target.id)).toBe(false);
    expect(deathCheckService.processDyingTurn(target.id)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const deathEvent = fixture.events.find(
      (e) => e.eventType === 'anatomy:entity_died'
    );
    expect(deathEvent).toBeDefined();
    expect(deathEvent?.payload?.causeOfDeath).toBe('bleeding_out');
  });
});
