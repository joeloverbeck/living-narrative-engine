/**
 * @file burnPoisonExtended.e2e.test.js
 * @description E2E coverage for part-scope poison ticking and multi-target burn stacking.
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
import BurningTickSystem from '../../../src/anatomy/services/burningTickSystem.js';
import PoisonTickSystem from '../../../src/anatomy/services/poisonTickSystem.js';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';
import rapierDefinition from '../../../data/mods/fantasy/entities/definitions/vespera_rapier.entity.json' assert { type: 'json' };
import mainGaucheDefinition from '../../../data/mods/fantasy/entities/definitions/vespera_main_gauche.entity.json' assert { type: 'json' };

const ACTION_ID = 'weapons:swing_at_target';
const ROOM_ID = 'burn-poison-room';

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

const burnBladeDefinition = cloneWith(rapierDefinition, [
  {
    name: 'burning_slash',
    amount: 8,
    penetration: 0.2,
    burn: {
      enabled: true,
      dps: 2,
      durationTurns: 3,
      canStack: true,
    },
  },
]);

const partScopePoisonDefinition = cloneWith(mainGaucheDefinition, [
  {
    name: 'slashing',
    amount: 4,
    penetration: 0.6,
    poison: {
      enabled: true,
      tick: 2,
      durationTurns: 3,
      scope: 'part',
    },
  },
]);

const createTarget = ({ id, health = 24, maxHealth = 24 }) => {
  const part = new ModEntityBuilder(`${id}-part`)
    .withName(`${id}-part`)
    .withComponent('anatomy:part', {
      type: 'torso',
      subType: 'torso',
      orientation: 'mid',
      ownerEntityId: id,
      children: [],
    })
    .withComponent('anatomy:part_health', {
      currentHealth: health,
      maxHealth,
      status: 'healthy',
    })
    .build();

  const actor = new ModEntityBuilder(id)
    .withName(id)
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:defense_skill', { level: 8 })
    .withComponent('anatomy:body', { body: { root: part.id } })
    .build();

  return { actor, part };
};

const createAttacker = ({ weaponId }) =>
  new ModEntityBuilder('burn-poison-attacker')
    .withName('BurnPoison Attacker')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:melee_skill', { level: 95 })
    .withComponent('items:inventory', { items: [weaponId], capacity: 5 })
    .withComponent('positioning:wielding', { wielded_item_ids: [weaponId] })
    .build();

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

  return { damageTypeEffectsService };
};

describe('burn/poison extended e2e', () => {
  let fixture;
  let testEnv;
  let safeDispatcher;

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

  it('ticks part-scope poison over turns and expires the component', async () => {
    const weaponBuilder = buildWeaponFromDefinition(
      'poison-part-blade',
      partScopePoisonDefinition
    );
    const attacker = createAttacker({ weaponId: 'poison-part-blade' });
    const { actor: target, part } = createTarget({ id: 'poison-target', health: 18, maxHealth: 18 });
    const room = new ModEntityBuilder(ROOM_ID)
      .withName('Room')
      .withComponent('core:position', { locationId: ROOM_ID })
      .build();
    const weapon = weaponBuilder.withName('Poison Part Blade').build();

    fixture.reset([attacker, target, part, room, weapon]);
    fixture.clearEvents();

    installRealHandlers({
      testEnv,
      safeDispatcher,
      forcedOutcome: 'SUCCESS',
      rngProvider: () => 0.2,
    });

    await testEnv.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actionId: ACTION_ID,
      actorId: attacker.id,
      primaryId: weapon.id,
      secondaryId: target.id,
      originalInput: 'poison strike',
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const poisonComponent = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:poisoned'
    );
    expect(poisonComponent).toEqual(
      expect.objectContaining({
        remainingTurns: 3,
        tickDamage: 2,
      })
    );

    const poisonSystem = new PoisonTickSystem({
      logger: testEnv.logger,
      entityManager: testEnv.entityManager,
      safeEventDispatcher: safeDispatcher,
      validatedEventDispatcher: testEnv.eventBus,
    });
    const originalGetter =
      testEnv.entityManager.getEntitiesWithComponent.bind(testEnv.entityManager);
    testEnv.entityManager.getEntitiesWithComponent = (componentId) =>
      componentId === 'anatomy:poisoned'
        ? [part.id]
        : originalGetter(componentId);

    await poisonSystem.processTick();
    await poisonSystem.processTick();
    await poisonSystem.processTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const remainingComponent = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:poisoned'
    );
    const health = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:part_health'
    )?.currentHealth;

    expect(remainingComponent).toBeNull();
    expect(health).toBeLessThan(18);

    const stoppedEvent = fixture.events.find(
      (e) => e.eventType === 'anatomy:poisoned_stopped'
    );
    expect(stoppedEvent?.payload?.partId).toBe(part.id);

    poisonSystem.destroy();
  });

  it('stacks burn independently across multiple targets', async () => {
    const weaponBuilder = buildWeaponFromDefinition('burn-blade', burnBladeDefinition);
    const attacker = createAttacker({ weaponId: 'burn-blade' });
    const { actor: targetA, part: partA } = createTarget({ id: 'target-a', health: 40, maxHealth: 40 });
    const { actor: targetB, part: partB } = createTarget({ id: 'target-b', health: 40, maxHealth: 40 });
    const room = new ModEntityBuilder(ROOM_ID)
      .withName('Room')
      .withComponent('core:position', { locationId: ROOM_ID })
      .build();
    const weapon = weaponBuilder.withName('Burn Blade').build();

    fixture.reset([attacker, targetA, targetB, partA, partB, room, weapon]);
    fixture.clearEvents();

    installRealHandlers({
      testEnv,
      safeDispatcher,
      forcedOutcome: 'SUCCESS',
      rngProvider: () => 0.33,
    });

    // Initial burn on both targets
    await testEnv.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actionId: ACTION_ID,
      actorId: attacker.id,
      primaryId: weapon.id,
      secondaryId: targetA.id,
      originalInput: 'burn A',
    });
    await testEnv.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actionId: ACTION_ID,
      actorId: attacker.id,
      primaryId: weapon.id,
      secondaryId: targetB.id,
      originalInput: 'burn B',
    });
    await new Promise((resolve) => setTimeout(resolve, 25));

    // Second pass to stack burns independently
    await testEnv.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actionId: ACTION_ID,
      actorId: attacker.id,
      primaryId: weapon.id,
      secondaryId: targetA.id,
      originalInput: 'burn A again',
    });
    await testEnv.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actionId: ACTION_ID,
      actorId: attacker.id,
      primaryId: weapon.id,
      secondaryId: targetB.id,
      originalInput: 'burn B again',
    });
    await new Promise((resolve) => setTimeout(resolve, 25));

    const burnA = testEnv.entityManager.getComponentData(
      partA.id,
      'anatomy:burning'
    );
    const burnB = testEnv.entityManager.getComponentData(
      partB.id,
      'anatomy:burning'
    );

    expect(burnA).toEqual(
      expect.objectContaining({ stackedCount: 2, tickDamage: 4, remainingTurns: 3 })
    );
    expect(burnB).toEqual(
      expect.objectContaining({ stackedCount: 2, tickDamage: 4, remainingTurns: 3 })
    );

    const burningSystem = new BurningTickSystem({
      logger: testEnv.logger,
      entityManager: testEnv.entityManager,
      safeEventDispatcher: safeDispatcher,
      validatedEventDispatcher: testEnv.eventBus,
    });
    const originalGetter =
      testEnv.entityManager.getEntitiesWithComponent.bind(testEnv.entityManager);
    testEnv.entityManager.getEntitiesWithComponent = (componentId) =>
      componentId === 'anatomy:burning'
        ? [partA.id, partB.id]
        : originalGetter(componentId);

    await burningSystem.processTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const burnAAfterTick = testEnv.entityManager.getComponentData(
      partA.id,
      'anatomy:burning'
    );
    const burnBAfterTick = testEnv.entityManager.getComponentData(
      partB.id,
      'anatomy:burning'
    );

    expect(burnAAfterTick?.remainingTurns).toBe(2);
    expect(burnBAfterTick?.remainingTurns).toBe(2);

    burningSystem.destroy();
  });
});
