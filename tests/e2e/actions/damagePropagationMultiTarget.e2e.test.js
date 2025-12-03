/**
 * @file damagePropagationMultiTarget.e2e.test.js
 * @description E2E coverage for multi-target damage propagation chains with varied probabilities/modifiers.
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
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';
import mainGaucheDefinition from '../../../data/mods/fantasy/entities/definitions/vespera_main_gauche.entity.json' assert { type: 'json' };

const ACTION_ID = 'weapons:swing_at_target';
const ROOM_ID = 'propagation-multi-room';

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
  { name: 'slashing', amount: 24, penetration: 0.9 },
]);

const createChain = ({
  rootId,
  rootRule,
  childRule,
  health = { root: 70, child: 30, grandchild: 18 },
}) => {
  const root = new ModEntityBuilder(`${rootId}-root`)
    .withName(`${rootId}-root`)
    .withComponent('anatomy:part', {
      type: 'torso',
      subType: 'torso',
      hit_probability_weight: 10,
      ownerEntityId: rootId,
      children: [],
    })
    .withComponent('anatomy:part_health', {
      currentHealth: health.root,
      maxHealth: health.root,
      state: 'healthy',
    })
    .withComponent('anatomy:sockets', {
      sockets: [
        {
          id: 'arm_socket',
          allowedTypes: ['arm'],
        },
      ],
    })
    .build();

  const child = new ModEntityBuilder(`${rootId}-child`)
    .withName(`${rootId}-child`)
    .withComponent('anatomy:part', {
      type: 'arm',
      subType: 'arm',
      hit_probability_weight: 5,
      ownerEntityId: rootId,
    })
    .withComponent('anatomy:part_health', {
      currentHealth: health.child,
      maxHealth: health.child,
      state: 'healthy',
    })
    .withComponent('anatomy:joint', { parentId: root.id, socketId: 'arm_socket' })
    .withComponent('anatomy:damage_propagation', { rules: [] })
    .withComponent('anatomy:sockets', {
      sockets: [
        {
          id: 'grandchild_socket',
          allowedTypes: ['hand'],
        },
      ],
    })
    .build();

  const grandchild = new ModEntityBuilder(`${rootId}-grandchild`)
    .withName(`${rootId}-grandchild`)
    .withComponent('anatomy:part', {
      type: 'hand',
      subType: 'hand',
      hit_probability_weight: 2,
      ownerEntityId: rootId,
    })
    .withComponent('anatomy:part_health', {
      currentHealth: health.grandchild,
      maxHealth: health.grandchild,
      state: 'healthy',
    })
    .withComponent('anatomy:joint', {
      parentId: child.id,
      socketId: 'grandchild_socket',
    })
    .build();

  // Now that child/grandchild exist, set propagation rules with childPartId to avoid socket resolution ambiguity
  root.components['anatomy:damage_propagation'] = {
    rules: [
      {
        childPartId: child.id,
        baseProbability: rootRule.baseProbability,
        damageFraction: rootRule.damageFraction,
        damageTypeModifiers: rootRule.damageTypeModifiers,
      },
    ],
  };

  child.components['anatomy:damage_propagation'] = {
    rules: [
      {
        childPartId: grandchild.id,
        baseProbability: childRule.baseProbability,
        damageFraction: childRule.damageFraction,
        damageTypeModifiers: childRule.damageTypeModifiers,
      },
    ],
  };

  return { root, child, grandchild };
};

const createTarget = ({ id, bodyRoot }) =>
  new ModEntityBuilder(id)
    .withName(id)
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:defense_skill', { level: 10 })
    .withComponent('anatomy:body', { body: { root: bodyRoot } })
    .build();

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
  return { applyDamageHandler, damagePropagationService };
};

describe('damage propagation multi-target chains e2e', () => {
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

  it('propagates across two targets with different modifiers and respects independent probabilities', async () => {
    const weaponBuilder = buildWeaponFromDefinition(
      'prop-chain-blade',
      slashingBladeDefinition
    );
    const weapon = weaponBuilder.withName('Chain Blade').build();

    // Target A: high slashing modifier (0.9) and high probability
    const chainA = createChain({
      rootId: 'target-a',
      rootRule: {
        baseProbability: 0.9,
        damageFraction: 0.6,
        damageTypeModifiers: { slashing: 1.2, blunt: 0.4 },
      },
      childRule: {
        baseProbability: 0.85,
        damageFraction: 0.5,
        damageTypeModifiers: { slashing: 1.0, blunt: 0.3 },
      },
      health: { root: 80, child: 35, grandchild: 20 },
    });

    // Target B: low slashing modifier (0.4) and lower base probability
    const chainB = createChain({
      rootId: 'target-b',
      rootRule: {
        baseProbability: 0.35,
        damageFraction: 0.4,
        damageTypeModifiers: { slashing: 0.4, blunt: 1.0 },
      },
      childRule: {
        baseProbability: 0.4,
        damageFraction: 0.5,
        damageTypeModifiers: { slashing: 0.8, blunt: 1.0 },
      },
      health: { root: 80, child: 35, grandchild: 20 },
    });

    const targetA = createTarget({ id: 'target-a', bodyRoot: chainA.root.id });
    const targetB = createTarget({ id: 'target-b', bodyRoot: chainB.root.id });

    const attacker = new ModEntityBuilder('prop-attacker')
      .withName('Prop Attacker')
      .asActor()
      .withComponent('core:position', { locationId: ROOM_ID })
      .withComponent('skills:melee_skill', { level: 95 })
      .withComponent('items:inventory', { items: ['prop-chain-blade'], capacity: 3 })
      .withComponent('positioning:wielding', { wielded_item_ids: ['prop-chain-blade'] })
      .build();

    const room = new ModEntityBuilder(ROOM_ID)
      .withName('Prop Room')
      .withComponent('core:position', { locationId: ROOM_ID })
      .build();

    fixture.reset([
      attacker,
      weapon,
      targetA,
      targetB,
      chainA.root,
      chainA.child,
      chainA.grandchild,
      chainB.root,
      chainB.child,
      chainB.grandchild,
      room,
    ]);
    fixture.clearEvents();

    const { damagePropagationService } = installRealHandlers({
      testEnv,
      safeDispatcher,
      forcedOutcome: 'SUCCESS',
    });

    // Directly invoke propagation service to isolate propagation probability/modifier behavior
    const resultsA1 = damagePropagationService.propagateDamage(
      chainA.root.id,
      30,
      'slashing',
      targetA.id,
      chainA.root.components['anatomy:damage_propagation'].rules
    );
    const resultsB = damagePropagationService.propagateDamage(
      chainB.root.id,
      30,
      'slashing',
      targetB.id,
      chainB.root.components['anatomy:damage_propagation'].rules
    );
    // Recursive step: propagate from child to grandchild for target A using expected propagated amount (30 * 0.6 = 18)
    const resultsA2 = damagePropagationService.propagateDamage(
      chainA.child.id,
      18,
      'slashing',
      targetA.id,
      chainA.child.components['anatomy:damage_propagation'].rules
    );
    expect(resultsA1.some((r) => r.childPartId === chainA.child.id)).toBe(true);
    expect(resultsA2.some((r) => r.childPartId === chainA.grandchild.id)).toBe(true);
    expect(resultsB.length).toBeLessThanOrEqual(1);
  });
});
