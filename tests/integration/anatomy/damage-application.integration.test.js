/**
 * Integration tests for Damage Application Mechanics end-to-end flow.
 * Uses real ApplyDamageHandler with SimpleEntityManager and BodyGraphService.
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import ApplyDamageHandler from '../../../src/logic/operationHandlers/applyDamageHandler.js';
import BodyGraphService from '../../../src/anatomy/bodyGraphService.js';
import DamagePropagationService from '../../../src/anatomy/services/damagePropagationService.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

const PART_COMPONENT_ID = 'anatomy:part';
const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const JOINT_COMPONENT_ID = 'anatomy:joint';
const BODY_COMPONENT_ID = 'anatomy:body';
const DAMAGE_PROPAGATION_COMPONENT_ID = 'anatomy:damage_propagation';

const DAMAGE_APPLIED_EVENT = 'anatomy:damage_applied';
const PART_HEALTH_CHANGED_EVENT = 'anatomy:part_health_changed';
const PART_DESTROYED_EVENT = 'anatomy:part_destroyed';

const ids = {
  actor: 'actor-1',
  torso: 'torso-1',
  head: 'head-1',
  arm: 'arm-1',
  heart: 'heart-1',
};

describe('Damage Application Mechanics', () => {
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {import('../../../src/interfaces/coreServices.js').ILogger} */
  let logger;
  /** @type {{ dispatch: jest.Mock }} */
  let dispatcher;
  /** @type {JsonLogicEvaluationService} */
  let jsonLogicService;
  /** @type {BodyGraphService} */
  let bodyGraphService;
  /** @type {ApplyDamageHandler} */
  let handler;
  /** @type {object} */
  let executionContext;

  beforeEach(async () => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    entityManager = new SimpleEntityManager();
    jsonLogicService = new JsonLogicEvaluationService({ logger });
    bodyGraphService = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });
    // Mock damageTypeEffectsService with required method
    const damageTypeEffectsService = {
      applyEffectsForDamage: jest.fn().mockResolvedValue(undefined),
    };
    // Use real DamagePropagationService for integration testing
    const damagePropagationService = new DamagePropagationService({
      logger,
      entityManager,
      eventBus: dispatcher,
    });
    // Mock deathCheckService with required method
    const deathCheckService = {
      checkDeathConditions: jest.fn().mockResolvedValue(undefined),
    };
    handler = new ApplyDamageHandler({
      logger,
      entityManager,
      safeEventDispatcher: dispatcher,
      jsonLogicService,
      bodyGraphService,
      damageTypeEffectsService,
      damagePropagationService,
      deathCheckService,
    });
    executionContext = {
      evaluationContext: { context: {} },
      logger,
    };

    await seedAnatomy();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  async function seedAnatomy() {
    await entityManager.addComponent(ids.actor, BODY_COMPONENT_ID, {
      recipeId: 'test:humanoid',
      body: {
        root: ids.torso,
        parts: {
          torso: ids.torso,
          head: ids.head,
          arm: ids.arm,
          heart: ids.heart,
        },
      },
    });

    await entityManager.addComponent(ids.torso, PART_COMPONENT_ID, {
      subType: 'torso',
      ownerEntityId: ids.actor,
      hit_probability_weight: 50,
    });
    // Use standalone damage_propagation component (new format)
    // Using damage_types whitelist to only allow piercing damage (matches original test behavior)
    await entityManager.addComponent(ids.torso, DAMAGE_PROPAGATION_COMPONENT_ID, {
      rules: [
        {
          childPartId: ids.heart,
          baseProbability: 1,
          damageFraction: 0.5,
          damage_types: ['piercing'], // Only piercing damage propagates (whitelist)
        },
      ],
    });
    await entityManager.addComponent(ids.torso, PART_HEALTH_COMPONENT_ID, {
      currentHealth: 100,
      maxHealth: 100,
      state: 'healthy',
      turnsInState: 0,
    });

    await entityManager.addComponent(ids.head, PART_COMPONENT_ID, {
      subType: 'head',
      ownerEntityId: ids.actor,
      hit_probability_weight: 20,
    });
    await entityManager.addComponent(ids.head, PART_HEALTH_COMPONENT_ID, {
      currentHealth: 100,
      maxHealth: 100,
      state: 'healthy',
      turnsInState: 0,
    });
    await entityManager.addComponent(ids.head, JOINT_COMPONENT_ID, {
      parentId: ids.torso,
      socketId: 'neck',
    });

    await entityManager.addComponent(ids.arm, PART_COMPONENT_ID, {
      subType: 'arm',
      ownerEntityId: ids.actor,
      hit_probability_weight: 30,
    });
    await entityManager.addComponent(ids.arm, PART_HEALTH_COMPONENT_ID, {
      currentHealth: 100,
      maxHealth: 100,
      state: 'healthy',
      turnsInState: 0,
    });
    await entityManager.addComponent(ids.arm, JOINT_COMPONENT_ID, {
      parentId: ids.torso,
      socketId: 'shoulder',
    });

    await entityManager.addComponent(ids.heart, PART_COMPONENT_ID, {
      subType: 'heart',
      ownerEntityId: ids.actor,
      hit_probability_weight: 0, // Internal; exclude from random hits
    });
    await entityManager.addComponent(ids.heart, PART_HEALTH_COMPONENT_ID, {
      currentHealth: 50,
      maxHealth: 50,
      state: 'healthy',
      turnsInState: 0,
    });
    await entityManager.addComponent(ids.heart, JOINT_COMPONENT_ID, {
      parentId: ids.torso,
      socketId: 'thorax',
    });
  }

  function getEventPayloads(eventId) {
    return dispatcher.dispatch.mock.calls
      .filter(([id]) => id === eventId)
      .map(([, payload]) => payload);
  }

  test('targeted hit damages only the specified part and emits events', async () => {
    await handler.execute(
      {
        entity_ref: ids.actor,
        part_ref: ids.arm,
        amount: 50,
        damage_type: 'cutting',
      },
      executionContext
    );

    expect(entityManager.getComponentData(ids.arm, PART_HEALTH_COMPONENT_ID)).toMatchObject({
      currentHealth: 50,
      state: 'wounded',
    });
    expect(entityManager.getComponentData(ids.torso, PART_HEALTH_COMPONENT_ID).currentHealth).toBe(
      100
    );
    expect(entityManager.getComponentData(ids.head, PART_HEALTH_COMPONENT_ID).currentHealth).toBe(
      100
    );
    expect(entityManager.getComponentData(ids.heart, PART_HEALTH_COMPONENT_ID).currentHealth).toBe(
      50
    );

    const damageEvents = getEventPayloads(DAMAGE_APPLIED_EVENT);
    expect(damageEvents).toHaveLength(1);
    expect(damageEvents[0]).toMatchObject({
      entityId: ids.actor,
      partId: ids.arm,
      amount: 50,
      damageType: 'cutting',
      propagatedFrom: null,
    });

    const healthEvents = getEventPayloads(PART_HEALTH_CHANGED_EVENT);
    expect(healthEvents).toHaveLength(1);
    expect(healthEvents[0]).toMatchObject({
      partEntityId: ids.arm,
      previousHealth: 100,
      newHealth: 50,
    });
  });

  test('untargeted hits distribute according to weights (deterministic RNG)', async () => {
    const randomSpy = jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.1) // Torso
      .mockReturnValueOnce(0.65) // Mid-range: head/arm depending on order
      .mockReturnValueOnce(0.95); // High-end: remaining weighted part

    await handler.execute(
      { entity_ref: ids.actor, part_ref: null, amount: 10, damage_type: 'blunt' },
      executionContext
    );
    await handler.execute(
      { entity_ref: ids.actor, part_ref: null, amount: 10, damage_type: 'blunt' },
      executionContext
    );
    await handler.execute(
      { entity_ref: ids.actor, part_ref: null, amount: 10, damage_type: 'blunt' },
      executionContext
    );

    randomSpy.mockRestore();

    const torsoHealth = entityManager.getComponentData(ids.torso, PART_HEALTH_COMPONENT_ID).currentHealth;
    const headHealth = entityManager.getComponentData(ids.head, PART_HEALTH_COMPONENT_ID).currentHealth;
    const armHealth = entityManager.getComponentData(ids.arm, PART_HEALTH_COMPONENT_ID).currentHealth;
    const heartHealth = entityManager.getComponentData(ids.heart, PART_HEALTH_COMPONENT_ID)
      .currentHealth;

    expect(torsoHealth).toBe(90);
    expect(headHealth).toBe(90);
    expect(armHealth).toBe(90);
    expect(heartHealth).toBe(50);

    const targetedParts = getEventPayloads(DAMAGE_APPLIED_EVENT).map((event) => event.partId);
    expect(new Set(targetedParts)).toEqual(new Set([ids.torso, ids.head, ids.arm]));
    expect(targetedParts).not.toContain(ids.heart);
  });

  test('propagation applies fractioned damage to child parts', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0); // Force propagation success

    await handler.execute(
      {
        entity_ref: ids.actor,
        part_ref: ids.torso,
        amount: 40,
        damage_type: 'piercing',
      },
      executionContext
    );

    randomSpy.mockRestore();

    expect(entityManager.getComponentData(ids.torso, PART_HEALTH_COMPONENT_ID).currentHealth).toBe(
      60
    );
    expect(entityManager.getComponentData(ids.heart, PART_HEALTH_COMPONENT_ID).currentHealth).toBe(
      30
    );

    const damageEvents = getEventPayloads(DAMAGE_APPLIED_EVENT);
    expect(damageEvents).toHaveLength(2);
    const heartEvent = damageEvents.find((event) => event.partId === ids.heart);
    expect(heartEvent).toMatchObject({
      propagatedFrom: ids.torso,
      amount: 20,
      damageType: 'piercing',
    });
  });

  test('lethal damage marks part destroyed and emits destruction event', async () => {
    await handler.execute(
      {
        entity_ref: ids.actor,
        part_ref: ids.head,
        amount: 200,
        damage_type: 'fire',
      },
      executionContext
    );

    const headHealth = entityManager.getComponentData(ids.head, PART_HEALTH_COMPONENT_ID);
    expect(headHealth.currentHealth).toBe(0);
    expect(headHealth.state).toBe('destroyed');

    const destroyedEvents = getEventPayloads(PART_DESTROYED_EVENT);
    expect(destroyedEvents).toHaveLength(1);
    expect(destroyedEvents[0]).toMatchObject({
      partId: ids.head,
      entityId: ids.actor,
    });
  });

  test('missing body and part_ref triggers safe error dispatch', async () => {
    const lonelyId = 'lonely-actor';
    await handler.execute(
      {
        entity_ref: lonelyId,
        part_ref: null,
        amount: 10,
        damage_type: 'poke',
      },
      executionContext
    );

    const errorEvents = getEventPayloads(SYSTEM_ERROR_OCCURRED_ID);
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toMatchObject({
      message: expect.stringContaining('Could not resolve target part'),
      details: expect.any(Object),
    });
  });

  test('health state transitions follow thresholds', async () => {
    await handler.execute(
      { entity_ref: ids.actor, part_ref: ids.head, amount: 10, damage_type: 'blunt' },
      executionContext
    );
    expect(entityManager.getComponentData(ids.head, PART_HEALTH_COMPONENT_ID).state).toBe(
      'healthy'
    );

    await handler.execute(
      { entity_ref: ids.actor, part_ref: ids.head, amount: 25, damage_type: 'blunt' },
      executionContext
    );
    expect(entityManager.getComponentData(ids.head, PART_HEALTH_COMPONENT_ID).state).toBe(
      'scratched'
    );

    await handler.execute(
      { entity_ref: ids.actor, part_ref: ids.head, amount: 20, damage_type: 'blunt' },
      executionContext
    );
    expect(entityManager.getComponentData(ids.head, PART_HEALTH_COMPONENT_ID).state).toBe(
      'wounded'
    );

    // 45% - 24% = 21% → injured (21-40% threshold)
    await handler.execute(
      { entity_ref: ids.actor, part_ref: ids.head, amount: 24, damage_type: 'blunt' },
      executionContext
    );
    expect(entityManager.getComponentData(ids.head, PART_HEALTH_COMPONENT_ID).state).toBe(
      'injured'
    );

    // 21% - 21% = 0% → destroyed (0% threshold)
    await handler.execute(
      { entity_ref: ids.actor, part_ref: ids.head, amount: 21, damage_type: 'blunt' },
      executionContext
    );
    expect(entityManager.getComponentData(ids.head, PART_HEALTH_COMPONENT_ID).state).toBe(
      'destroyed'
    );
  });

  test('turnsInState increments when state stays the same', async () => {
    await handler.execute(
      { entity_ref: ids.actor, part_ref: ids.head, amount: 5, damage_type: 'blunt' },
      executionContext
    );
    expect(entityManager.getComponentData(ids.head, PART_HEALTH_COMPONENT_ID)).toMatchObject({
      currentHealth: 95,
      state: 'healthy',
      turnsInState: 1,
    });

    await handler.execute(
      { entity_ref: ids.actor, part_ref: ids.head, amount: 5, damage_type: 'blunt' },
      executionContext
    );
    expect(entityManager.getComponentData(ids.head, PART_HEALTH_COMPONENT_ID)).toMatchObject({
      currentHealth: 90,
      state: 'healthy',
      turnsInState: 2,
    });
  });

  test('propagation is skipped when target is not a child of the damaged part', async () => {
    const orphanId = 'orphan-1';
    await entityManager.addComponent(orphanId, PART_COMPONENT_ID, {
      subType: 'orphan',
      ownerEntityId: ids.actor,
      hit_probability_weight: 0,
    });
    await entityManager.addComponent(orphanId, PART_HEALTH_COMPONENT_ID, {
      currentHealth: 30,
      maxHealth: 30,
      state: 'healthy',
      turnsInState: 0,
    });
    await entityManager.addComponent(orphanId, JOINT_COMPONENT_ID, {
      parentId: 'someone-else',
      socketId: 'misc',
    });

    // Add orphan to damage propagation rules using standalone component
    const existingPropagation = entityManager.getComponentData(
      ids.torso,
      DAMAGE_PROPAGATION_COMPONENT_ID
    );
    await entityManager.addComponent(ids.torso, DAMAGE_PROPAGATION_COMPONENT_ID, {
      rules: [
        ...(existingPropagation?.rules || []),
        {
          childPartId: orphanId,
          baseProbability: 1,
          damageFraction: 1,
          damageTypeModifiers: { piercing: 1.0 },
        },
      ],
    });

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    await handler.execute(
      { entity_ref: ids.actor, part_ref: ids.torso, amount: 20, damage_type: 'piercing' },
      executionContext
    );

    randomSpy.mockRestore();

    expect(entityManager.getComponentData(orphanId, PART_HEALTH_COMPONENT_ID).currentHealth).toBe(
      30
    );

    const orphanDamageEvents = getEventPayloads(DAMAGE_APPLIED_EVENT).filter(
      (event) => event.partId === orphanId
    );
    expect(orphanDamageEvents).toHaveLength(0);
  });
});
