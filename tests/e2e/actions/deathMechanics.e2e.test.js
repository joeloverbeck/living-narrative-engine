/**
 * @file deathMechanics.e2e.test.js
 * @description Critical e2e coverage for death resolution and dying countdown using the real APPLY_DAMAGE flow.
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

const ACTION_ID = 'weapons:swing_at_target';
const ROOM_ID = 'death-room';

const createSafeDispatcher = (eventBus) => ({
  dispatch: (eventType, payload) => eventBus.dispatch(eventType, payload),
});

const buildActorWithVitals = ({
  actorId = 'victim',
  torsoHealth = 100,
  heartHealth = 40,
  brainHealth = 40,
  spineHealth = 40,
} = {}) => {
  const torso = new ModEntityBuilder(`${actorId}-torso`)
    .withName('Torso')
    .withComponent('anatomy:part', { subType: 'torso', orientation: 'mid' })
    .withComponent('anatomy:part_health', {
      currentHealth: torsoHealth,
      maxHealth: 100,
      state: 'healthy',
      turnsInState: 0,
    })
    .build();

  const heart = new ModEntityBuilder(`${actorId}-heart`)
    .withName('Heart')
    .withComponent('anatomy:part', { subType: 'heart', orientation: 'mid' })
    .withComponent('anatomy:joint', { parentId: torso.id, socketId: 'heart_socket' })
    .withComponent('anatomy:part_health', {
      currentHealth: heartHealth,
      maxHealth: heartHealth,
      state: 'healthy',
      turnsInState: 0,
    })
    .withComponent('anatomy:vital_organ', { organType: 'heart' })
    .build();

  const brain = new ModEntityBuilder(`${actorId}-brain`)
    .withName('Brain')
    .withComponent('anatomy:part', { subType: 'brain', orientation: 'mid' })
    .withComponent('anatomy:joint', { parentId: torso.id, socketId: 'brain_socket' })
    .withComponent('anatomy:part_health', {
      currentHealth: brainHealth,
      maxHealth: brainHealth,
      state: 'healthy',
      turnsInState: 0,
    })
    .withComponent('anatomy:vital_organ', { organType: 'brain' })
    .build();

  const spine = new ModEntityBuilder(`${actorId}-spine`)
    .withName('Spine')
    .withComponent('anatomy:part', { subType: 'spine', orientation: 'mid' })
    .withComponent('anatomy:joint', { parentId: torso.id, socketId: 'spine_socket' })
    .withComponent('anatomy:part_health', {
      currentHealth: spineHealth,
      maxHealth: spineHealth,
      state: 'healthy',
      turnsInState: 0,
    })
    .withComponent('anatomy:vital_organ', { organType: 'spine' })
    .build();

  const actor = new ModEntityBuilder(actorId)
    .withName('Test Subject')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('anatomy:body', {
      body: {
        root: torso.id,
        parts: {
          torso: torso.id,
          heart: heart.id,
          brain: brain.id,
          spine: spine.id,
        },
      },
    })
    .build();

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Grim Chamber')
    .withComponent('core:position', { locationId: ROOM_ID })
    .build();

  const attacker = new ModEntityBuilder('attacker')
    .withName('Attacker')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .build();

  return { actor, parts: { torso, heart, brain, spine }, room, attacker };
};

describe('death mechanics e2e (critical)', () => {
  let fixture;
  let testEnv;
  let safeDispatcher;
  let bodyGraphService;
  let deathCheckService;
  let applyDamageHandler;

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

  const applyDamage = async ({ entityId, partId, amount, actorId = 'attacker', damageType = 'piercing' }) => {
    await applyDamageHandler.execute(
      {
        entity_ref: entityId,
        part_ref: partId,
        amount,
        damage_type: damageType,
      },
      {
        evaluationContext: { context: {} },
        logger: testEnv.logger,
        actorId,
      }
    );
    await new Promise((resolve) => setTimeout(resolve, 15));
  };

  const pushToDyingThreshold = async ({ actor, parts, attacker }) => {
    await applyDamage({
      entityId: actor.id,
      partId: parts.torso.id,
      amount: 95,
      actorId: attacker.id,
      damageType: 'blunt',
    });
    await applyDamage({
      entityId: actor.id,
      partId: parts.heart.id,
      amount: 37,
      actorId: attacker.id,
      damageType: 'piercing',
    });
    await applyDamage({
      entityId: actor.id,
      partId: parts.brain.id,
      amount: 37,
      actorId: attacker.id,
      damageType: 'crushing',
    });
    await applyDamage({
      entityId: actor.id,
      partId: parts.spine.id,
      amount: 37,
      actorId: attacker.id,
      damageType: 'slashing',
    });
  };

  const prepareActor = async (options = {}) => {
    const { actor, parts, room, attacker } = buildActorWithVitals(options);
    fixture.reset([actor, parts.torso, parts.heart, parts.brain, parts.spine, room, attacker]);
    fixture.clearEvents();

    bodyGraphService = new BodyGraphService({
      entityManager: testEnv.entityManager,
      logger: testEnv.logger,
      eventDispatcher: safeDispatcher,
    });

    const damageTypeEffectsService = new DamageTypeEffectsService({
      entityManager: testEnv.entityManager,
      logger: testEnv.logger,
      safeEventDispatcher: safeDispatcher,
      rngProvider: () => 0.25,
    });

    const damagePropagationService = new DamagePropagationService({
      entityManager: testEnv.entityManager,
      logger: testEnv.logger,
      eventBus: safeDispatcher,
    });

    const injuryAggregationService = new InjuryAggregationService({
      entityManager: testEnv.entityManager,
      logger: testEnv.logger,
      bodyGraphService,
    });

    deathCheckService = new DeathCheckService({
      entityManager: testEnv.entityManager,
      logger: testEnv.logger,
      eventBus: safeDispatcher,
      injuryAggregationService,
      bodyGraphService,
    });

    const damageAccumulator = new DamageAccumulator({
      logger: testEnv.logger,
    });

    const damageNarrativeComposer = new DamageNarrativeComposer({
      logger: testEnv.logger,
    });

    applyDamageHandler = new ApplyDamageHandler({
      logger: testEnv.logger,
      entityManager: testEnv.entityManager,
      safeEventDispatcher: safeDispatcher,
      jsonLogicService: testEnv.jsonLogic,
      bodyGraphService,
      damageTypeEffectsService,
      damagePropagationService,
      deathCheckService,
      damageAccumulator,
      damageNarrativeComposer,
    });

    await bodyGraphService.buildAdjacencyCache(parts.torso.id);
    return { actor, parts, attacker };
  };

  it('triggers immediate death when the heart is destroyed', async () => {
    const { actor, parts, attacker } = await prepareActor({ heartHealth: 25 });

    await applyDamage({
      entityId: actor.id,
      partId: parts.heart.id,
      amount: 30,
      actorId: attacker.id,
    });

    const deathEvent = fixture.events.find((e) => e.eventType === 'anatomy:entity_died');
    const deadComponent = testEnv.entityManager.getComponentData(actor.id, 'anatomy:dead');
    const dyingComponent = testEnv.entityManager.getComponentData(actor.id, 'anatomy:dying');

    expect(deathEvent).toBeDefined();
    expect(deathEvent.payload).toEqual(
      expect.objectContaining({
        entityId: actor.id,
        causeOfDeath: 'vital_organ_destroyed',
        vitalOrganDestroyed: 'heart',
        killedBy: attacker.id,
      })
    );
    expect(deadComponent).toBeDefined();
    expect(dyingComponent).toBeNull();
  });

  it('triggers immediate death when the brain is destroyed', async () => {
    const { actor, parts, attacker } = await prepareActor({ brainHealth: 20 });

    await applyDamage({
      entityId: actor.id,
      partId: parts.brain.id,
      amount: 25,
      actorId: attacker.id,
      damageType: 'crushing',
    });

    const deathEvent = fixture.events.find((e) => e.eventType === 'anatomy:entity_died');
    const message = deathEvent?.payload?.finalMessage || '';

    expect(deathEvent).toBeDefined();
    expect(deathEvent.payload.vitalOrganDestroyed).toBe('brain');
    expect(message.length).toBeGreaterThan(0);
    // Production code generates narrative-appropriate death messages that may not contain "dead"
    // Brain death message: "dies from massive head trauma."
    expect(message.toLowerCase()).toContain('dies');
  });

  it('enters dying state when overall health drops below 10%', async () => {
    const { actor, parts, attacker } = await prepareActor({ torsoHealth: 100 });

    await pushToDyingThreshold({ actor, parts, attacker });

    const dyingComponent = testEnv.entityManager.getComponentData(actor.id, 'anatomy:dying');
    const dyingEvent = fixture.events.find((e) => e.eventType === 'anatomy:entity_dying');

    expect(dyingComponent).toBeDefined();
    expect(dyingComponent.turnsRemaining).toBe(3);
    expect(dyingComponent.causeOfDying).toBe('overall_health_critical');
    expect(dyingEvent).toBeDefined();
    expect(dyingEvent.payload.turnsRemaining).toBe(3);
    expect(testEnv.entityManager.getComponentData(actor.id, 'anatomy:dead')).toBeNull();
  });

  it('expires the dying countdown into death when turns reach zero', async () => {
    const { actor, parts, attacker } = await prepareActor({ torsoHealth: 100 });

    await pushToDyingThreshold({ actor, parts, attacker });

    fixture.clearEvents();

    expect(deathCheckService.processDyingTurn(actor.id)).toBe(false);
    expect(deathCheckService.processDyingTurn(actor.id)).toBe(false);
    expect(deathCheckService.processDyingTurn(actor.id)).toBe(true);

    const deathEvent = fixture.events.find((e) => e.eventType === 'anatomy:entity_died');
    const deadComponent = testEnv.entityManager.getComponentData(actor.id, 'anatomy:dead');

    expect(deathEvent).toBeDefined();
    expect(deathEvent.payload.causeOfDeath).toBe('bleeding_out');
    expect(deadComponent).toBeDefined();
  });

  it('includes full payload details on entity_died events', async () => {
    const { actor, parts, attacker } = await prepareActor({ spineHealth: 10 });

    await applyDamage({
      entityId: actor.id,
      partId: parts.spine.id,
      amount: 15,
      actorId: attacker.id,
      damageType: 'piercing',
    });

    const deathEvent = fixture.events.find((e) => e.eventType === 'anatomy:entity_died');

    expect(deathEvent).toBeDefined();
    expect(deathEvent.payload).toEqual(
      expect.objectContaining({
        entityId: actor.id,
        entityName: 'Test Subject',
        causeOfDeath: 'vital_organ_destroyed',
        vitalOrganDestroyed: 'spine',
        killedBy: attacker.id,
        // Production code generates narrative-appropriate death messages
        // Spine destruction message: "collapses as their spine is destroyed."
        finalMessage: expect.stringContaining('spine'),
      })
    );
    expect(deathEvent.payload.timestamp).toBeGreaterThan(0);
  });
});
