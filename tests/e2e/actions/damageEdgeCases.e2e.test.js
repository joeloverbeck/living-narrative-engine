/**
 * @file damageEdgeCases.e2e.test.js
 * @description E2E coverage for APPLY_DAMAGE edge paths: non-health parts, non-positive damage, and exclude lists.
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
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import DamageTypeEffectsService from '../../../src/anatomy/services/damageTypeEffectsService.js';
import DamagePropagationService from '../../../src/anatomy/services/damagePropagationService.js';
import InjuryAggregationService from '../../../src/anatomy/services/injuryAggregationService.js';
import DeathCheckService from '../../../src/anatomy/services/deathCheckService.js';
import DamageAccumulator from '../../../src/anatomy/services/damageAccumulator.js';
import DamageNarrativeComposer from '../../../src/anatomy/services/damageNarrativeComposer.js';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';

const ROOM_ID = 'damage-edge-room';

const createSafeDispatcher = (eventBus) => ({
  dispatch: (eventType, payload) => eventBus.dispatch(eventType, payload),
});

const buildTargetPart = ({
  id = 'edge-part',
  ownerId = 'edge-target',
  withHealth = true,
  health = 60,
}) => {
  const builder = new ModEntityBuilder(id)
    .withName('Edge Part')
    .withComponent('anatomy:part', {
      type: 'torso',
      subType: 'torso',
      ownerEntityId: ownerId,
      hit_probability_weight: 10,
    });

  if (withHealth) {
    builder.withComponent('anatomy:part_health', {
      currentHealth: health,
      maxHealth: health,
      state: 'healthy',
    });
  }

  return builder.build();
};

const buildTargetActor = (id, rootPartId) =>
  new ModEntityBuilder(id)
    .withName('Edge Target')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:defense_skill', { level: 10 })
    .withComponent('anatomy:body', {
      body: {
        root: rootPartId,
        parts: { torso: rootPartId },
      },
    })
    .build();

describe('APPLY_DAMAGE edge cases', () => {
  let fixture;
  let testEnv;
  let safeDispatcher;
  let buildApplyDamageHandler;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'weapons',
      'weapons:swing_at_target',
      null,
      null,
      {
        autoRegisterScopes: true,
        scopeCategories: ['positioning', 'anatomy'],
      }
    );
    testEnv = fixture.testEnv;
    safeDispatcher = createSafeDispatcher(testEnv.eventBus);

    buildApplyDamageHandler = () => {
      const { entityManager, logger, jsonLogic } = testEnv;

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

      const damageAccumulator = new DamageAccumulator({ logger });
      const damageNarrativeComposer = new DamageNarrativeComposer({ logger });

      return new ApplyDamageHandler({
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
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fixture) {
      fixture.cleanup();
    }
  });

  const resetFixture = (entities) => {
    fixture.reset(entities);
    fixture.clearEvents();
  };

  const createExecutionContext = () => ({
    evaluationContext: { context: {} },
    logger: testEnv.logger,
  });

  it('emits damage_applied but no health change for parts without health', async () => {
    const part = buildTargetPart({ withHealth: false });
    const target = buildTargetActor('edge-target', part.id);

    resetFixture([part, target]);
    const applyDamageHandler = buildApplyDamageHandler();

    await applyDamageHandler.execute(
      {
        entity_ref: target.id,
        part_ref: part.id,
        damage_entry: { name: 'blunt', amount: 12 },
      },
      createExecutionContext()
    );

    const damageEvents = fixture.events.filter(
      (e) => e.eventType === 'anatomy:damage_applied'
    );
    const healthEvents = fixture.events.filter(
      (e) => e.eventType === 'anatomy:part_health_changed'
    );

    expect(damageEvents).toHaveLength(1);
    expect(healthEvents).toHaveLength(0);
    expect(
      testEnv.entityManager.hasComponent(part.id, 'anatomy:part_health')
    ).toBe(false);
  });

  it('does not create a health component when targeting healthless parts', async () => {
    const part = buildTargetPart({ withHealth: false });
    const target = buildTargetActor('edge-target-no-health', part.id);

    resetFixture([part, target]);
    const applyDamageHandler = buildApplyDamageHandler();

    await applyDamageHandler.execute(
      {
        entity_ref: target.id,
        part_ref: part.id,
        damage_entry: { name: 'slashing', amount: 8 },
      },
      createExecutionContext()
    );

    expect(
      testEnv.entityManager.hasComponent(part.id, 'anatomy:part_health')
    ).toBe(false);
    expect(
      fixture.events.some(
        (e) => e.eventType === 'anatomy:part_health_changed'
      )
    ).toBe(false);
  });

  it('early-returns on zero damage with no events or state change', async () => {
    const part = buildTargetPart({ health: 50 });
    const target = buildTargetActor('edge-target-zero', part.id);

    resetFixture([part, target]);
    const applyDamageHandler = buildApplyDamageHandler();

    await applyDamageHandler.execute(
      {
        entity_ref: target.id,
        part_ref: part.id,
        damage_entry: { name: 'piercing', amount: 0 },
      },
      createExecutionContext()
    );

    const health = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:part_health'
    );

    expect(health.currentHealth).toBe(50);
    expect(fixture.events.length).toBe(0);
  });

  it('skips negative damage entries', async () => {
    const part = buildTargetPart({ health: 40 });
    const target = buildTargetActor('edge-target-negative', part.id);

    resetFixture([part, target]);
    const applyDamageHandler = buildApplyDamageHandler();

    await applyDamageHandler.execute(
      {
        entity_ref: target.id,
        part_ref: part.id,
        damage_entry: { name: 'fire', amount: -5 },
      },
      createExecutionContext()
    );

    const health = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:part_health'
    );

    expect(health.currentHealth).toBe(40);
    expect(fixture.events.length).toBe(0);
  });

  it('applies only allowed entries when exclude list is present', async () => {
    const part = buildTargetPart({ health: 70 });
    const target = buildTargetActor('edge-target-exclude', part.id);

    resetFixture([part, target]);
    const applyDamageHandler = buildApplyDamageHandler();

    const executionContext = createExecutionContext();

    await applyDamageHandler.execute(
      {
        entity_ref: target.id,
        part_ref: part.id,
        damage_entry: { name: 'piercing', amount: 10 },
        exclude_damage_types: ['piercing'],
      },
      executionContext
    );

    await applyDamageHandler.execute(
      {
        entity_ref: target.id,
        part_ref: part.id,
        damage_entry: { name: 'slashing', amount: 12 },
        exclude_damage_types: ['piercing'],
      },
      executionContext
    );

    const health = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:part_health'
    );
    const damageEvents = fixture.events.filter(
      (e) => e.eventType === 'anatomy:damage_applied'
    );
    const healthEvents = fixture.events.filter(
      (e) => e.eventType === 'anatomy:part_health_changed'
    );

    expect(health.currentHealth).toBe(58);
    expect(damageEvents).toHaveLength(1);
    expect(damageEvents[0].payload?.damageType).toBe('slashing');
    expect(healthEvents).toHaveLength(1);
  });

  it('skips all entries when every type is excluded', async () => {
    const part = buildTargetPart({ health: 55 });
    const target = buildTargetActor('edge-target-exclude-all', part.id);

    resetFixture([part, target]);
    const applyDamageHandler = buildApplyDamageHandler();

    await applyDamageHandler.execute(
      {
        entity_ref: target.id,
        part_ref: part.id,
        damage_entry: { name: 'piercing', amount: 9 },
        exclude_damage_types: ['piercing'],
      },
      createExecutionContext()
    );

    const health = testEnv.entityManager.getComponentData(
      part.id,
      'anatomy:part_health'
    );

    expect(health.currentHealth).toBe(55);
    expect(fixture.events.length).toBe(0);
  });
});
