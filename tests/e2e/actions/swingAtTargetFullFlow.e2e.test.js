/**
 * @file swingAtTargetFullFlow.e2e.test.js
 * @description Critical e2e coverage for the swing_at_target action: validates damage, effects,
 * outcome branching, and fumble mechanics end-to-end using the real APPLY_DAMAGE handler.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
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
import mainGaucheDefinition from '../../../data/mods/fantasy/entities/definitions/vespera_main_gauche.entity.json' assert { type: 'json' };
import { createDamageTypeEffectsService } from './helpers/damageTypeEffectsServiceFactory.js';

const ACTION_ID = 'weapons:swing_at_target';
const ROOM_ID = 'room1';

/**
 * Builds a safe dispatcher that mirrors the EventBus dispatch signature.
 * The production ApplyDamageHandler expects a safe dispatcher wrapper.
 */
const createSafeDispatcher = (eventBus) => ({
  dispatch: (eventType, payload) => eventBus.dispatch(eventType, payload),
});

/**
 * Helper to convert a mod entity definition into a ModEntityBuilder instance.
 */
const buildWeaponFromDefinition = (id, definition) => {
  const builder = new ModEntityBuilder(id);
  Object.entries(definition.components || {}).forEach(([componentId, data]) => {
    builder.withComponent(componentId, data);
  });
  return builder;
};

/**
 * Creates a simple target anatomy (torso only) and attacker/weapon trio.
 */
const createCombatants = ({ weaponBuilder, weaponId, attackSkill = 80 }) => {
  const torso = new ModEntityBuilder('target-torso')
    .withName('Target Torso')
    .withComponent('anatomy:part', {
      type: 'torso',
      subType: 'torso',
      children: [],
    })
    .withComponent('anatomy:part_health', {
      currentHealth: 100,
      maxHealth: 100,
      status: 'healthy',
    })
    .build();

  const target = new ModEntityBuilder('target')
    .withName('Target')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:defense_skill', { level: 10 })
    .withComponent('anatomy:body', { body: { root: torso.id } })
    .build();

  const weapon = weaponBuilder.withName('Test Weapon').build();

  const attacker = new ModEntityBuilder('attacker')
    .withName('Attacker')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:melee_skill', { level: attackSkill })
    .withComponent('items:inventory', { items: [weaponId], capacity: 5 })
    .withComponent('item-handling-states:wielding', { wielded_item_ids: [weaponId] })
    .build();

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Training Room')
    .withComponent('core:position', { locationId: ROOM_ID })
    .build();

  return { attacker, target, torso, weapon, room };
};

/**
 * Registers real handlers for APPLY_DAMAGE and RESOLVE_OUTCOME to make the
 * rule execution deterministic and feature-complete for these tests.
 */
const installRealHandlers = ({
  testEnv,
  safeDispatcher,
  forcedOutcome = 'SUCCESS',
}) => {
  const { entityManager, logger, jsonLogic, operationRegistry, eventBus } =
    testEnv;

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
  jest.spyOn(damageTypeEffectsService, 'applyEffectsForDamage');

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
      roll: forcedOutcome === 'FUMBLE' ? 100 : 1,
      threshold: 50,
      margin:
        forcedOutcome === 'SUCCESS'
          ? -49
          : forcedOutcome === 'CRITICAL_SUCCESS'
            ? -49
            : 50,
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

  return { damageTypeEffectsService, bodyGraphService, eventBus };
};

describe('swing_at_target full flow (critical e2e)', () => {
  let fixture;
  let testEnv;
  let safeDispatcher;
  /** @type {ReturnType<typeof installRealHandlers>['damageTypeEffectsService']} */
  let effectService;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('weapons', ACTION_ID, null, null, {
      autoRegisterScopes: true,
      scopeCategories: ['positioning', 'anatomy'],
    });
    testEnv = fixture.testEnv;
    safeDispatcher = createSafeDispatcher(testEnv.eventBus);
    jest.spyOn(Math, 'random').mockReturnValue(0); // Deterministic part selection
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fixture) {
      fixture.cleanup();
    }
  });

  const executeSwing = async ({
    forcedOutcome = 'SUCCESS',
    weaponDefinition,
    weaponId,
    attackSkill = 80,
  }) => {
    const weaponBuilder = buildWeaponFromDefinition(weaponId, weaponDefinition);
    const { attacker, target, torso, weapon, room } = createCombatants({
      weaponBuilder,
      weaponId,
      attackSkill,
    });

    fixture.reset([attacker, target, torso, weapon, room]);
    fixture.clearEvents();

    const handlers = installRealHandlers({
      testEnv,
      safeDispatcher,
      forcedOutcome,
    });
    effectService = handlers.damageTypeEffectsService;

    await testEnv.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actionId: ACTION_ID,
      actorId: attacker.id,
      primaryId: weapon.id,
      secondaryId: target.id,
      originalInput: `swing ${weapon.id} at ${target.id}`,
    });

    // Give the interpreter time to process async dispatchers
    await new Promise((resolve) => setTimeout(resolve, 15));

    return { attacker, target, torso, weapon };
  };

  it('runs full swing → damage → health update flow with success messaging', async () => {
    const { torso } = await executeSwing({
      forcedOutcome: 'SUCCESS',
      weaponDefinition: rapierDefinition,
      weaponId: 'rapier',
    });

    const damageEvents = fixture.events.filter(
      (e) => e.eventType === 'anatomy:damage_applied'
    );
    const healthEvents = fixture.events.filter(
      (e) => e.eventType === 'anatomy:part_health_changed'
    );
    const successMessages = fixture.events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );

    expect(damageEvents.length).toBeGreaterThan(0);
    expect(healthEvents.length).toBeGreaterThan(0);
    expect(successMessages.length).toBe(1);
    expect(successMessages[0].payload.message).toContain('swings');

    const health = testEnv.entityManager.getComponentData(
      torso.id,
      'anatomy:part_health'
    );
    expect(health.currentHealth).toBeLessThan(100);
  });

  it('applies slashing bleed effect when damage capabilities include bleed', async () => {
    const { torso } = await executeSwing({
      forcedOutcome: 'SUCCESS',
      weaponDefinition: rapierDefinition,
      weaponId: 'bleed-rapier',
    });

    expect(effectService.applyEffectsForDamage).toHaveBeenCalled();
    const bleedEvent = fixture.events.find(
      (e) => e.eventType === 'anatomy:bleeding_started'
    );
    const bleedComponent = testEnv.entityManager.getComponentData(
      torso.id,
      'anatomy:bleeding'
    );

    expect(bleedEvent).toBeDefined();
    expect(bleedComponent).toBeDefined();
  });

  it('respects exclude_damage_types by skipping piercing damage', async () => {
    const { torso } = await executeSwing({
      forcedOutcome: 'SUCCESS',
      weaponDefinition: mainGaucheDefinition,
      weaponId: 'piercer',
    });

    const health = testEnv.entityManager.getComponentData(
      torso.id,
      'anatomy:part_health'
    );
    expect(health.currentHealth).toBe(100);
  });

  it('applies the 1.5x multiplier on critical success', async () => {
    const { torso } = await executeSwing({
      forcedOutcome: 'CRITICAL_SUCCESS',
      weaponDefinition: rapierDefinition,
      weaponId: 'crit-rapier',
      attackSkill: 100,
    });

    const health = testEnv.entityManager.getComponentData(
      torso.id,
      'anatomy:part_health'
    );
    // Rapier base damage is 8 (slashing) → 12 expected
    expect(health.currentHealth).toBeCloseTo(88);
  });

  it('drops the weapon on fumble outcomes', async () => {
    const { attacker, weapon } = await executeSwing({
      forcedOutcome: 'FUMBLE',
      weaponDefinition: rapierDefinition,
      weaponId: 'fumble-rapier',
    });

    const wielding = testEnv.entityManager.getComponentData(
      attacker.id,
      'item-handling-states:wielding'
    );
    const weaponPosition = testEnv.entityManager.getComponentData(
      weapon.id,
      'core:position'
    );

    expect(wielding?.wielded_item_ids || []).not.toContain(weapon.id);
    expect(weaponPosition?.locationId).toBe(ROOM_ID);
  });
});
