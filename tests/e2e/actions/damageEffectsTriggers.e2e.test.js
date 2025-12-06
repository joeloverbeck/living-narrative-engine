/**
 * @file damageEffectsTriggers.e2e.test.js
 * @description High-priority e2e coverage for immediate damage effects (bleed, fracture, dismember)
 * using the real APPLY_DAMAGE handler wired through swing_at_target.
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
import BurningTickSystem from '../../../src/anatomy/services/burningTickSystem.js';
import PoisonTickSystem from '../../../src/anatomy/services/poisonTickSystem.js';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';
import rapierDefinition from '../../../data/mods/fantasy/entities/definitions/vespera_rapier.entity.json' assert { type: 'json' };
import longswordDefinition from '../../../data/mods/fantasy/entities/definitions/threadscar_melissa_longsword.entity.json' assert { type: 'json' };
import practiceStickDefinition from '../../../data/mods/fantasy/entities/definitions/rill_practice_stick.entity.json' assert { type: 'json' };
import mainGaucheDefinition from '../../../data/mods/fantasy/entities/definitions/vespera_main_gauche.entity.json' assert { type: 'json' };

const ACTION_ID = 'weapons:swing_at_target';
const ROOM_ID = 'effects-room';

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

const burnRapierDefinition = cloneWith(rapierDefinition, [
  {
    name: 'burning_slash',
    amount: 6,
    penetration: 0.2,
    burn: {
      enabled: true,
      dps: 2,
      durationTurns: 3,
      canStack: true,
    },
  },
]);

const poisonDaggerDefinition = cloneWith(mainGaucheDefinition, [
  {
    name: 'slashing',
    amount: 4,
    penetration: 0.6,
    poison: {
      enabled: true,
      tick: 2,
      durationTurns: 4,
      scope: 'entity',
    },
  },
]);

const createCombatants = ({
  weaponBuilder,
  weaponId,
  partHealth = 50,
  partMaxHealth = 50,
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
    .withName('Effect Target')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:defense_skill', { level: 10 })
    .withComponent('anatomy:body', { body: { root: part.id } })
    .build();

  const weapon = weaponBuilder.withName('Effect Test Weapon').build();

  const attacker = new ModEntityBuilder(`${weaponId}-attacker`)
    .withName('Effect Attacker')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:melee_skill', { level: 90 })
    .withComponent('items:inventory', { items: [weaponId], capacity: 5 })
    .withComponent('positioning:wielding', { wielded_item_ids: [weaponId] })
    .build();

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Effect Room')
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

  return { damageTypeEffectsService, eventBus };
};

describe('damage effects triggers e2e', () => {
  let fixture;
  let testEnv;
  let safeDispatcher;
  let effectService;

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

    const handlers = installRealHandlers({
      testEnv,
      safeDispatcher,
      forcedOutcome: 'SUCCESS',
      rngProvider,
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

    await new Promise((resolve) => setTimeout(resolve, 20));

    return { attacker, target, part };
  };

  it('applies bleed effect with correct severity and component attachment for slashing damage', async () => {
    const { part } = await executeSwing({
      weaponDefinition: rapierDefinition,
      weaponId: 'bleed-rapier',
      partHealth: 60,
      partMaxHealth: 60,
      rngProvider: () => 0.42,
    });

    expect(effectService.applyEffectsForDamage).toHaveBeenCalled();

    const bleedEvent = fixture.events.find(
      (e) => e.eventType === 'anatomy:bleeding_started'
    );
    const bleedComponent = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:bleeding'
    );

    expect(bleedEvent).toBeDefined();
    expect(bleedEvent?.payload?.severity).toBe('minor');
    expect(bleedComponent).toEqual(
      expect.objectContaining({
        severity: 'minor',
        tickDamage: 1,
        remainingTurns: 2,
      })
    );
  });

  it('triggers fracture (with stun) when blunt damage meets threshold', async () => {
    const { target, part } = await executeSwing({
      weaponDefinition: practiceStickDefinition,
      weaponId: 'fracture-stick',
      partHealth: 6,
      partMaxHealth: 6,
      rngProvider: () => 0.05, // ensure stun passes 10% chance
    });

    const fractureEvent = fixture.events.find(
      (e) => e.eventType === 'anatomy:fractured'
    );

    const fractureComponent = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:fractured'
    );
    const stunnedComponent = testEnv.entityManager.getComponentData(
      target.id,
      'anatomy:stunned'
    );

    expect(fractureEvent).toBeDefined();
    expect(fractureEvent?.payload?.stunApplied).toBe(true);
    expect(fractureComponent).toEqual(
      expect.objectContaining({ sourceDamageType: 'blunt' })
    );
    expect(stunnedComponent).toEqual(
      expect.objectContaining({ remainingTurns: 1 })
    );
  });

  it('dispatches dismemberment and short-circuits other effects when threshold exceeded', async () => {
    const { part } = await executeSwing({
      weaponDefinition: longswordDefinition,
      weaponId: 'dismember-long',
      partHealth: 20,
      partMaxHealth: 20,
      rngProvider: () => 0.5,
    });

    const dismemberEvent = fixture.events.find(
      (e) => e.eventType === 'anatomy:dismembered'
    );
    const bleedComponent = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:bleeding'
    );

    const partHealth = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:part_health'
    );

    expect(dismemberEvent).toBeDefined();
    expect(partHealth.currentHealth).toBeLessThanOrEqual(0);
    expect(bleedComponent).toBeNull();
  });

  it('applies burn effect with duration, damage, and stacking metadata', async () => {
    const { part } = await executeSwing({
      weaponDefinition: burnRapierDefinition,
      weaponId: 'burn-rapier',
      partHealth: 40,
      partMaxHealth: 40,
      rngProvider: () => 0.33,
    });

    const burnEvent = fixture.events.find(
      (e) => e.eventType === 'anatomy:burning_started'
    );
    const burnComponent = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:burning'
    );

    expect(burnEvent).toBeDefined();
    expect(burnEvent?.payload?.stackedCount).toBe(1);
    expect(burnComponent).toEqual(
      expect.objectContaining({
        remainingTurns: 3,
        tickDamage: 2,
        stackedCount: 1,
      })
    );
  });

  it('applies poison to the entity scope when configured, leaving part clean', async () => {
    const { target, part } = await executeSwing({
      weaponDefinition: poisonDaggerDefinition,
      weaponId: 'poison-dagger',
      partHealth: 30,
      partMaxHealth: 30,
      rngProvider: () => 0.2,
    });

    // Ensure entity-level health exists for tick processing
    await testEnv.entityManager.addComponent(target.id, 'core:health', {
      currentHealth: 20,
      maxHealth: 20,
    });

    const poisonEvent = fixture.events.find(
      (e) => e.eventType === 'anatomy:poisoned_started'
    );
    const entityPoison = testEnv.entityManager.getComponentData(
      target.id,
      'anatomy:poisoned'
    );
    const partPoison = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:poisoned'
    );

    expect(poisonEvent).toBeDefined();
    expect(poisonEvent?.payload?.scope).toBe('entity');
    expect(poisonEvent?.payload?.partId).toBeUndefined();
    expect(entityPoison).toEqual(
      expect.objectContaining({
        remainingTurns: 4,
        tickDamage: 2,
      })
    );
    expect(partPoison).toBeNull();
  });

  it('stacks burn applications and ticks down duration while dealing burn damage each turn', async () => {
    const { attacker, target, part } = await executeSwing({
      weaponDefinition: burnRapierDefinition,
      weaponId: 'burn-rapier-stack',
      partHealth: 40,
      partMaxHealth: 40,
      rngProvider: () => 0.33,
    });

    // Second application to stack burn
    await testEnv.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actionId: ACTION_ID,
      actorId: attacker.id,
      primaryId: 'burn-rapier-stack',
      secondaryId: target.id,
      originalInput: 'swing again',
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const burnComponent = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:burning'
    );
    expect(burnComponent).toEqual(
      expect.objectContaining({
        tickDamage: 4,
        stackedCount: 2,
        remainingTurns: 3,
      })
    );

    const burningSystem = new BurningTickSystem({
      logger: testEnv.logger,
      entityManager: testEnv.entityManager,
      safeEventDispatcher: safeDispatcher,
      validatedEventDispatcher: testEnv.eventBus,
    });

    // Ensure entity manager exposes burning part for tick processing
    testEnv.entityManager.getEntitiesWithComponent = () => [part.id];

    // Process three turns
    await burningSystem.processTick();
    await burningSystem.processTick();
    await burningSystem.processTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const finalHealth = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:part_health'
    )?.currentHealth;
    const remainingBurn = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:burning'
    );

    expect(remainingBurn).toBeNull();
    expect(finalHealth).toBeLessThan(40); // ticks applied damage

    burningSystem.destroy();
  });

  it('ticks poison over turns and expires the component with stopped event', async () => {
    const { target, part } = await executeSwing({
      weaponDefinition: poisonDaggerDefinition,
      weaponId: 'poison-dagger-tick',
      partHealth: 30,
      partMaxHealth: 30,
      rngProvider: () => 0.2,
    });

    await testEnv.entityManager.addComponent(target.id, 'core:health', {
      currentHealth: 12,
      maxHealth: 12,
    });

    const poisonSystem = new PoisonTickSystem({
      logger: testEnv.logger,
      entityManager: testEnv.entityManager,
      safeEventDispatcher: safeDispatcher,
      validatedEventDispatcher: testEnv.eventBus,
    });

    testEnv.entityManager.getEntitiesWithComponent = (componentId) =>
      componentId === 'anatomy:poisoned' ? [target.id] : [];

    await poisonSystem.processTick();
    await poisonSystem.processTick();
    await poisonSystem.processTick();
    await poisonSystem.processTick(); // should expire
    await new Promise((resolve) => setTimeout(resolve, 10));

    const remainingComponent = testEnv.entityManager.getComponentData(
      target.id,
      'anatomy:poisoned'
    );
    const health = testEnv.entityManager.getComponentData(
      target.id,
      'core:health'
    )?.currentHealth;

    expect(remainingComponent).toBeNull();
    expect(health).toBeLessThan(12);

    poisonSystem.destroy();
  });
});
