/**
 * @file hitResolutionControls.e2e.test.js
 * @description E2E coverage for hit resolution controls: hit_strategy (reuse_cached),
 * hint_part, named RNG (rng_ref), and multi-entry weapon distribution.
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
import DamageTypeEffectsService from '../../../src/anatomy/services/damageTypeEffectsService.js';
import DamagePropagationService from '../../../src/anatomy/services/damagePropagationService.js';
import InjuryAggregationService from '../../../src/anatomy/services/injuryAggregationService.js';
import DeathCheckService from '../../../src/anatomy/services/deathCheckService.js';
import DamageAccumulator from '../../../src/anatomy/services/damageAccumulator.js';
import DamageNarrativeComposer from '../../../src/anatomy/services/damageNarrativeComposer.js';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';

/**
 * Builds a safe dispatcher that mirrors the EventBus dispatch signature.
 */
const createSafeDispatcher = (eventBus) => ({
  dispatch: (eventType, payload) => eventBus.dispatch(eventType, payload),
});

/**
 * Creates a target entity with multiple distinct body parts (Head, Torso, Arms, Legs)
 * to ensure hit distribution can be tested.
 */
const createMultiPartTarget = (roomId) => {
  const parts = [];
  
  // Helper to create a part
  const createPart = (id, type, name, weight = 10) => {
    return new ModEntityBuilder(id)
      .withName(name)
      .withComponent('anatomy:part', {
        type: type,
        subType: type,
        hitWeight: weight,
        children: [],
        ownerEntityId: 'target'
      })
      .withComponent('anatomy:part_health', {
        currentHealth: 100,
        maxHealth: 100,
        status: 'healthy',
      });
  };

  const head = createPart('target-head', 'head', 'Head').withComponent('anatomy:joint', { parentId: 'target-torso' });
  const torso = createPart('target-torso', 'torso', 'Torso'); // Root has no joint
  const leftArm = createPart('target-larm', 'arm', 'Left Arm').withComponent('anatomy:joint', { parentId: 'target-torso' });
  const rightArm = createPart('target-rarm', 'arm', 'Right Arm').withComponent('anatomy:joint', { parentId: 'target-torso' });
  const leftLeg = createPart('target-lleg', 'leg', 'Left Leg').withComponent('anatomy:joint', { parentId: 'target-torso' });
  const rightLeg = createPart('target-rleg', 'leg', 'Right Leg').withComponent('anatomy:joint', { parentId: 'target-torso' });

  parts.push(head.build(), torso.build(), leftArm.build(), rightArm.build(), leftLeg.build(), rightLeg.build());

  // Re-build torso with children
  const torsoWithChildren = new ModEntityBuilder('target-torso')
    .withName('Torso')
    .withComponent('anatomy:part', {
      type: 'torso',
      subType: 'torso',
      hitWeight: 10,
      children: ['target-head', 'target-larm', 'target-rarm', 'target-lleg', 'target-rleg'],
      ownerEntityId: 'target'
    })
    .withComponent('anatomy:part_health', {
      currentHealth: 100,
      maxHealth: 100,
      status: 'healthy',
    })
    .build();
    
  // Update parts list
  const partsMap = {
    'target-head': head.build(),
    'target-torso': torsoWithChildren,
    'target-larm': leftArm.build(),
    'target-rarm': rightArm.build(),
    'target-lleg': leftLeg.build(),
    'target-rleg': rightLeg.build()
  };

  const target = new ModEntityBuilder('target')
    .withName('Target')
    .asActor()
    .withComponent('core:position', { locationId: roomId })
    .withComponent('anatomy:body', { body: { root: 'target-torso' } })
    .build();

  return { target, parts: partsMap };
};

const installRealHandlers = ({
  testEnv,
  safeDispatcher,
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

  operationRegistry.register(
    'APPLY_DAMAGE',
    applyDamageHandler.execute.bind(applyDamageHandler)
  );

  return { applyDamageHandler, damageAccumulator };
};

describe('hitResolutionControls (e2e)', () => {
  let fixture;
  let testEnv;
  let safeDispatcher;
  const ROOM_ID = 'room1';

  beforeEach(async () => {
    const rule = {
      rule_id: 'test:setup_rule',
      event_type: 'test:setup_event',
      actions: [
        { type: 'LOG', parameters: { message: 'Setup complete' } }
      ]
    };
    const condition = {
      id: 'test:setup_event',
      description: 'Trigger setup event',
      logic: {
        '==': [{ var: 'event.eventType' }, 'test:setup_event']
      }
    };

    fixture = await ModTestFixture.forRule(
      'test', 
      'test:setup_rule', 
      rule, 
      condition, 
      { 
        autoRegisterScopes: true,
        scopeCategories: ['anatomy']
      }
    );
    testEnv = fixture.testEnv;
    safeDispatcher = createSafeDispatcher(testEnv.eventBus);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fixture) {
      fixture.cleanup();
    }
  });

  /**
   * Helper to setup the test scenario
   */
  const setupScenario = async () => {
    const { target, parts } = createMultiPartTarget(ROOM_ID);
    
    const room = new ModEntityBuilder(ROOM_ID)
      .withName('Test Room')
      .withComponent('core:position', { locationId: ROOM_ID })
      .build();

    // Add entities to fixture
    const entities = [target, room, ...Object.values(parts)];
    fixture.reset(entities); // This resets operationRegistry

    // Install real handlers on the NEW registry
    const handlers = installRealHandlers({ testEnv, safeDispatcher });

    // Context with aliases for resolution
    const context = {
      evaluationContext: {
        event: { payload: {} },
        context: {},
        target: { id: target.id },
        secondary: { id: target.id }
      },
      target: { id: target.id },
      secondary: { id: target.id }
    };

    return { target, parts, context, handlers };
  };

  it('should reuse cached hit location when hit_strategy.reuse_cached is true (default)', async () => {
    const { context } = await setupScenario();

    const operation = {
      type: 'APPLY_DAMAGE',
      parameters: {
        entity_ref: 'target',
        damage_entry: { name: 'blunt', amount: 5 },
        hit_strategy: { reuse_cached: true } 
      }
    };

    // Execute 3 times
    await testEnv.operationInterpreter.execute(operation, context);
    await testEnv.operationInterpreter.execute(operation, context);
    await testEnv.operationInterpreter.execute(operation, context);

    // Collect damage events
    const damageEvents = fixture.events.filter(e => e.eventType === 'anatomy:damage_applied');
    expect(damageEvents.length).toBe(3);

    // All hits should be on the same part
    const firstPartId = damageEvents[0].payload.partId;
    expect(firstPartId).toBeDefined();
    
    damageEvents.forEach(event => {
      expect(event.payload.partId).toBe(firstPartId);
    });
  });

  it('should resolve different parts for each damage entry when reuse_cached is false', async () => {
    // Action: Loop applying damage with reuse_cached: false
    const mockRng = jest.spyOn(Math, 'random')
      .mockReturnValueOnce(0.0) // Hit first part (Head)
      .mockReturnValueOnce(0.99) // Hit last part (Right Leg)
      .mockReturnValueOnce(0.5); // Hit middle part

    const { context } = await setupScenario();

    const operation = {
      type: 'APPLY_DAMAGE',
      parameters: {
        entity_ref: 'target',
        damage_entry: { name: 'blunt', amount: 5 },
        hit_strategy: { reuse_cached: false }
      }
    };

    // Execute 3 times
    await testEnv.operationInterpreter.execute(operation, context);
    await testEnv.operationInterpreter.execute(operation, context);
    await testEnv.operationInterpreter.execute(operation, context);

    const damageEvents = fixture.events.filter(e => e.eventType === 'anatomy:damage_applied');
    expect(damageEvents.length).toBe(3);

    const partIds = damageEvents.map(e => e.payload.partId);
    const uniqueParts = new Set(partIds);
    
    // With our mock RNG, we expect at least 2 different parts
    expect(uniqueParts.size).toBeGreaterThan(1);
  });

  it('should target specified part when hint_part is provided', async () => {
    const { context } = await setupScenario();

    const operation = {
        type: 'APPLY_DAMAGE',
        parameters: {
          entity_ref: 'target',
          damage_entry: { name: 'blunt', amount: 5 },
          hit_strategy: { hint_part: 'target-head' }
        }
    };

    await testEnv.operationInterpreter.execute(operation, context);

    const damageEvent = fixture.events.find(e => e.eventType === 'anatomy:damage_applied');
    expect(damageEvent).toBeDefined();
    expect(damageEvent.payload.partId).toBe('target-head');
  });

  it('should produce consistent hit locations when using same rng_ref seed', async () => {
    const { context: baseContext } = await setupScenario();
    
    const customRng = jest.fn();
    // Inject rngRegistry into context
    const context = {
      ...baseContext,
      rngRegistry: { 'my-seeded-rng': customRng }
    };

    const operation = {
        type: 'APPLY_DAMAGE',
        parameters: {
          entity_ref: 'target',
          damage_entry: { name: 'blunt', amount: 5 },
          rng_ref: 'my-seeded-rng',
          hit_strategy: { reuse_cached: false } // Force re-roll to test RNG
        }
    };
    
    // Run 1
    customRng.mockReturnValue(0.0); // First part (Torso)
    await testEnv.operationInterpreter.execute(operation, context);
    
    expect(customRng).toHaveBeenCalled();
    const event1 = fixture.events.find(e => e.eventType === 'anatomy:damage_applied');
    expect(event1.payload.partId).toBe('target-torso');
    
    fixture.clearEvents();
    
    // Run 2 - same seed value from RNG
    customRng.mockReturnValue(0.0); 
    await testEnv.operationInterpreter.execute(operation, context);
    
    const event2 = fixture.events.find(e => e.eventType === 'anatomy:damage_applied');
    expect(event2.payload.partId).toBe('target-torso');
  });

  it('should produce different hit locations with different rng_ref seeds (simulated)', async () => {
    const { context: baseContext } = await setupScenario();
    
    const customRng = jest.fn();
    const context = {
      ...baseContext,
      rngRegistry: { 'my-seeded-rng': customRng }
    };

    const operation = {
        type: 'APPLY_DAMAGE',
        parameters: {
          entity_ref: 'target',
          damage_entry: { name: 'blunt', amount: 5 },
          rng_ref: 'my-seeded-rng',
          hit_strategy: { reuse_cached: false } // Force re-roll
        }
    };
    
    // Run 1
    customRng.mockReturnValue(0.0); // Torso
    await testEnv.operationInterpreter.execute(operation, context);
    const event1 = fixture.events.find(e => e.eventType === 'anatomy:damage_applied');
    
    fixture.clearEvents();
    
    // Run 2
    customRng.mockReturnValue(0.99); // Last part (Should be Right Leg in order)
    await testEnv.operationInterpreter.execute(operation, context);
    const event2 = fixture.events.find(e => e.eventType === 'anatomy:damage_applied');
    
    expect(event1.payload.partId).not.toBe(event2.payload.partId);
  });
});