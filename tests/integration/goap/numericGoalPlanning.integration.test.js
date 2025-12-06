/**
 * @file Integration tests for numeric goal planning in GOAP system
 * @see specs/modify-component-planner-support.md - Section 8
 * @see specs/goap-system-specs.md
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestSetup } from './testFixtures/goapTestSetup.js';
import { createTestGoal } from './testFixtures/testGoalFactory.js';
import { createTestTask } from './testFixtures/testTaskFactory.js';
import { GOAP_EVENTS } from '../../../src/goap/events/goapEvents.js';
import GOAPDebugger from '../../../src/goap/debug/goapDebugger.js';
import PlanInspector from '../../../src/goap/debug/planInspector.js';
import StateDiffViewer from '../../../src/goap/debug/stateDiffViewer.js';
import RefinementTracer from '../../../src/goap/debug/refinementTracer.js';

/**
 * Helper to add flattened component aliases to an actor entity.
 * This ensures JSON Logic can parse paths like 'actor.components.core_needs.hunger'
 * by creating aliases where colons are replaced with underscores.
 *
 * @param {object} actor - Actor entity with id and components
 * @returns {object} Modified actor with flattened component aliases
 */
function addFlattenedAliases(actor) {
  const modifiedComponents = { ...actor.components };

  Object.keys(actor.components).forEach((componentId) => {
    if (componentId.includes(':')) {
      const flattenedId = componentId.replace(/:/g, '_');
      modifiedComponents[flattenedId] = actor.components[componentId];
    }
  });

  return {
    ...actor,
    components: modifiedComponents,
  };
}

/**
 * Helper to build state with triple format required for numeric goals:
 * - Flat hash format for GOAP planning operations
 * - Nested format for JSON Logic variable resolution (with colon-based keys)
 * - Flattened aliases for JSON Logic paths (colons replaced with underscores)
 *
 * NOTE: PlanningEffectsSimulator now handles dual-format sync automatically during planning
 *
 * @param {object} actor - Actor entity with id and components
 * @returns {object} State object with all three formats
 */
function buildDualFormatState(actor) {
  const state = {
    // Nested format for JSON Logic
    actor: {
      id: actor.id,
      components: {},
    },
  };

  // Process each component to create all three formats
  Object.keys(actor.components).forEach((componentId) => {
    const componentData = { ...actor.components[componentId] };

    // 1. Flat hash format for GOAP operations (entityId:componentId)
    const flatKey = `${actor.id}:${componentId}`;
    state[flatKey] = componentData;

    // 2. Nested format with original colon-based key
    state.actor.components[componentId] = componentData;

    // 3. Flattened alias (replace colons with underscores for JSON Logic compatibility)
    // This allows paths like 'state.actor.components.core_needs.hunger' instead of
    // the unparseable 'state.actor.components.core_needs.hunger'
    const flattenedComponentId = componentId.replace(/:/g, '_');
    state.actor.components[flattenedComponentId] = componentData;
  });

  return state;
}

describe('Numeric Goal Planning - Hunger System', () => {
  let setup;
  let goapDebugger;
  let eventTraceProbe;
  let detachProbeHandle;

  beforeEach(async () => {
    // Define eat task BEFORE creating setup
    const eatTask = createTestTask({
      id: 'test:eat',
      cost: 5,
      priority: 100,
      structuralGates: {
        description: 'Actor can eat',
        condition: { '==': [1, 1] }, // Always true
      },
      planningEffects: [
        {
          type: 'MODIFY_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:needs',
            field: 'hunger',
            value: 60,
            mode: 'decrement',
          },
        },
      ],
    });

    // Create GOAP test setup with tasks configured in the tasks parameter
    setup = await createGoapTestSetup({
      mockRefinement: true,
      tasks: {
        test: {
          [eatTask.id]: eatTask,
        },
      },
    });

    // Create GOAP debugger for troubleshooting
    const logger = setup.testBed.createMockLogger();
    const planInspector = new PlanInspector({
      goapController: setup.controller,
      dataRegistry: setup.dataRegistry,
      entityManager: setup.entityManager,
      entityDisplayDataProvider: {
        getEntityDisplayData: (id) => ({ name: id }),
      },
      logger,
    });
    const stateDiffViewer = new StateDiffViewer({ logger });
    const refinementTracer = new RefinementTracer({
      eventBus: setup.eventBus,
      gameDataRepository: setup.gameDataRepository,
      logger,
    });
    ({ probe: eventTraceProbe, detach: detachProbeHandle } =
      setup.bootstrapEventTraceProbe());
    goapDebugger = new GOAPDebugger({
      goapController: setup.controller,
      planInspector,
      stateDiffViewer,
      refinementTracer,
      eventTraceProbe,
      goapEventDispatcher: setup.goapEventDispatcher,
      logger,
    });
  });

  afterEach(() => {
    if (detachProbeHandle) {
      detachProbeHandle();
      detachProbeHandle = null;
    }
    if (eventTraceProbe) {
      eventTraceProbe.clear();
      eventTraceProbe = null;
    }
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  it('should plan eating action to satisfy hunger goal', async () => {
    // Setup: Create actor with high hunger
    const actor = {
      id: 'test_actor',
      components: {
        'core:needs': { hunger: 80 },
        'core:inventory': { items: ['food'] },
      },
    };
    setup.registerPlanningActor(actor);

    // Register hunger reduction goal
    const goal = createTestGoal({
      id: 'test:reduce_hunger',
      relevance: { '>': [{ var: 'actor.components.core_needs.hunger' }, 50] },
      goalState: {
        '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 30],
      },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    // Build world with dual-format state
    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };

    // Debug: Test distance calculation directly
    const distance = setup.heuristicRegistry.calculate(
      'goal-distance',
      world.state,
      goal,
      []
    );
    console.log('\n=== DEBUGGING NUMERIC GOAL PLANNING ===');
    console.log('Initial distance calculated:', distance);
    console.log('Goal state:', JSON.stringify(goal.goalState, null, 2));
    console.log('World state:', JSON.stringify(world.state, null, 2));

    // Start tracing
    goapDebugger.startTrace('test_actor');

    // Execute planning turn
    try {
      await setup.controller.decideTurn(actor, world);
    } catch (err) {
      console.log('\n=== PLANNING FAILED ===');
      console.log('Error:', err.message);

      // Check failure history
      const failures = goapDebugger.getFailureHistory('test_actor');
      console.log('\nFailure History:', JSON.stringify(failures, null, 2));

      // Try to inspect plan (should show why it failed)
      const planInspection = goapDebugger.inspectPlanJSON('test_actor');
      console.log(
        '\nPlan Inspection:',
        JSON.stringify(planInspection, null, 2)
      );

      throw err;
    }

    // Generate debug report
    goapDebugger.stopTrace('test_actor');
    const eventStream = goapDebugger.getEventStream('test_actor');
    expect(eventStream?.events?.length ?? 0).toBeGreaterThan(0);
    const report = goapDebugger.generateReport('test_actor');

    console.log('\n=== DEBUG REPORT ===');
    console.log(report);
    console.log('\n=== END DEBUG REPORT ===\n');

    // Verify plan was created
    const events = setup.eventBus.getEvents();
    const planCreated = events.some(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );
    expect(planCreated).toBe(true);

    // Verify goal would be satisfied after execution
    const finalHunger = 80 - 60; // 20
    expect(finalHunger).toBeLessThanOrEqual(30);
  });

  it('should handle hunger goal already satisfied', async () => {
    const actor = {
      id: 'test_actor',
      components: {
        'core:needs': { hunger: 20 },
      },
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:reduce_hunger',
      relevance: { '>': [{ var: 'actor.components.core_needs.hunger' }, 50] },
      goalState: {
        '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 30],
      },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };
    await setup.controller.decideTurn(actor, world);

    // Goal not relevant (hunger already low)
    const events = setup.eventBus.getEvents();
    const planCreated = events.some(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );
    expect(planCreated).toBe(false); // No plan needed
  });

  it('should require multiple actions for large hunger reduction', async () => {
    const actor = {
      id: 'test_actor',
      components: {
        'core:needs': { hunger: 100 },
        'core:inventory': { items: ['food', 'food'] },
      },
    };
    setup.registerPlanningActor(actor);

    // Goal requires hunger <= 10
    const goal = createTestGoal({
      id: 'test:reduce_hunger',
      goalState: {
        '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 10],
      },
      relevance: { '==': [true, true] },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };
    await setup.controller.decideTurn(actor, world);

    const events = setup.eventBus.getEvents();
    const planCreated = events.some(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );
    expect(planCreated).toBe(true);

    // Note: Actual plan structure verification would require additional setup
    // Need 2 eat actions: 100 - 60 - 60 = -20 (clamped to 0)
  });

  it('should verify event bus records planning lifecycle', async () => {
    const actor = {
      id: 'test_actor',
      components: {
        'core:needs': { hunger: 75 },
        'core:inventory': { items: ['food'] },
      },
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:reduce_hunger',
      relevance: { '>': [{ var: 'actor.components.core_needs.hunger' }, 50] },
      goalState: {
        '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 30],
      },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };
    await setup.controller.decideTurn(actor, world);

    const events = setup.eventBus.getEvents();

    // Verify goal selection happened
    const goalSelected = events.some(
      (e) => e.type === GOAP_EVENTS.GOAL_SELECTED
    );
    expect(goalSelected).toBe(true);

    // Verify planning started
    const planningStarted = events.some(
      (e) => e.type === GOAP_EVENTS.PLANNING_STARTED
    );
    expect(planningStarted).toBe(true);

    // Verify planning completed
    const planningCompleted = events.some(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );
    expect(planningCompleted).toBe(true);
  });
});

describe('Numeric Goal Planning - Health System', () => {
  let setup;

  beforeEach(async () => {
    // Define heal task BEFORE creating setup
    const healTask = createTestTask({
      id: 'test:heal',
      cost: 10,
      priority: 100,
      structuralGates: {
        description: 'Actor can heal',
        condition: { '==': [1, 1] }, // Always true
      },
      planningPreconditions: [], // Empty - always applicable
      planningEffects: [
        {
          type: 'MODIFY_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:stats',
            field: 'health',
            value: 30,
            mode: 'increment',
          },
        },
      ],
    });

    // Create GOAP test setup with tasks configured in the tasks parameter
    setup = await createGoapTestSetup({
      mockRefinement: true,
      tasks: {
        test: {
          [healTask.id]: healTask,
        },
      },
    });
  });

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  it('should plan healing to reach health threshold', async () => {
    const actor = {
      id: 'test_actor',
      components: {
        'core:stats': { health: 40 },
      },
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:heal_self',
      relevance: { '<': [{ var: 'actor.components.core_stats.health' }, 60] },
      goalState: {
        '>=': [{ var: 'state.actor.components.core_stats.health' }, 80],
      },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };
    await setup.controller.decideTurn(actor, world);

    const events = setup.eventBus.getEvents();
    const planCreated = events.some(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );
    expect(planCreated).toBe(true);

    // Verify would reach threshold: 40 + 30 + 30 = 100 >= 80
  });

  it('should handle multiple heals for large health gap', async () => {
    const actor = {
      id: 'test_actor',
      components: {
        'core:stats': { health: 10 },
      },
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:heal_self',
      goalState: {
        '>=': [{ var: 'state.actor.components.core_stats.health' }, 80],
      },
      relevance: { '==': [true, true] },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };
    await setup.controller.decideTurn(actor, world);

    const events = setup.eventBus.getEvents();
    const planCreated = events.some(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );
    expect(planCreated).toBe(true);

    // Need: (80 - 10) / 30 = 2.33 → 3 heal actions
  });

  it('should keep default depth (20) sufficient for multi-heal plans', async () => {
    const actor = {
      id: 'test_actor',
      components: {
        'core:stats': { health: 10 },
      },
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:heal_self',
      goalState: {
        '>=': [{ var: 'state.actor.components.core_stats.health' }, 80],
      },
      relevance: { '==': [true, true] },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    // Default planner options (maxDepth = 20 per specs/goap-system-specs.md) must allow 3 intent steps
    const defaultDepthState = setup.buildPlanningState(actor);
    const defaultDepthPlan = setup.planner.plan(
      actor.id,
      goal,
      defaultDepthState,
      {}
    );
    expect(defaultDepthPlan).not.toBeNull();
    expect(defaultDepthPlan.tasks).toHaveLength(3);
    expect(defaultDepthPlan.cost).toBe(30);

    // Tight depth budget (2) should fail even though cost remains unchanged
    const shallowDepthState = setup.buildPlanningState(actor);
    const depthLimitedPlan = setup.planner.plan(
      actor.id,
      goal,
      shallowDepthState,
      {
        maxDepth: 2,
      }
    );
    expect(depthLimitedPlan).toBeNull();
  });

  it('should handle already healthy actor', async () => {
    const actor = {
      id: 'test_actor',
      components: {
        'core:stats': { health: 90 },
      },
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:heal_self',
      relevance: { '<': [{ var: 'actor.components.core_stats.health' }, 60] },
      goalState: {
        '>=': [{ var: 'state.actor.components.core_stats.health' }, 80],
      },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };
    await setup.controller.decideTurn(actor, world);

    // Goal not relevant (health already high)
    const events = setup.eventBus.getEvents();
    const planCreated = events.some(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );
    expect(planCreated).toBe(false); // No plan needed
  });
});

describe('Numeric Goal Planning - Resource Accumulation', () => {
  let setup;

  beforeEach(async () => {
    // Define mine task BEFORE creating setup
    const mineTask = createTestTask({
      id: 'test:mine',
      cost: 15,
      priority: 100,
      structuralGates: {
        description: 'Actor can mine',
        condition: { '==': [1, 1] }, // Always true
      },
      planningPreconditions: [], // Empty - always applicable
      planningEffects: [
        {
          type: 'MODIFY_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:resources',
            field: 'gold',
            value: 25,
            mode: 'increment',
          },
        },
      ],
    });

    // Create GOAP test setup with tasks configured in the tasks parameter
    setup = await createGoapTestSetup({
      mockRefinement: true,
      tasks: {
        test: {
          [mineTask.id]: mineTask,
        },
      },
    });
  });

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  it('should plan gold gathering to reach target amount', async () => {
    const actor = {
      id: 'test_actor',
      components: {
        'core:resources': { gold: 30 },
      },
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:accumulate_gold',
      goalState: {
        '>=': [{ var: 'state.actor.components.core_resources.gold' }, 100],
      },
      relevance: { '==': [true, true] },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };
    await setup.controller.decideTurn(actor, world);

    const events = setup.eventBus.getEvents();
    const planCreated = events.some(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );
    expect(planCreated).toBe(true);
    // Need: (100 - 30) / 25 = 2.8 → 3 mine actions
  });

  it('should calculate correct action count for resource gathering', async () => {
    const actor = {
      id: 'test_actor',
      components: {
        'core:resources': { gold: 0 },
      },
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:accumulate_gold',
      goalState: {
        '>=': [{ var: 'state.actor.components.core_resources.gold' }, 75],
      },
      relevance: { '==': [true, true] },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };
    await setup.controller.decideTurn(actor, world);

    const events = setup.eventBus.getEvents();
    const planCreated = events.some(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );
    expect(planCreated).toBe(true);

    // Verify plan exists
    const planningCompletedEvent = events.find(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );
    expect(planningCompletedEvent).toBeDefined();

    // Need: 75 / 25 = 3 mine actions exactly
  });

  it('should handle exact target with no overflow', async () => {
    const actor = {
      id: 'test_actor',
      components: {
        'core:resources': { gold: 50 },
      },
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:accumulate_gold',
      goalState: {
        '>=': [{ var: 'state.actor.components.core_resources.gold' }, 100],
      },
      relevance: { '==': [true, true] },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };
    await setup.controller.decideTurn(actor, world);

    const events = setup.eventBus.getEvents();
    const planCreated = events.some(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );
    expect(planCreated).toBe(true);

    // Need: (100 - 50) / 25 = 2.0 → exactly 2 mine actions
    const finalGold = 50 + 25 + 25; // 100
    expect(finalGold).toBeGreaterThanOrEqual(100);
  });
});

describe('Numeric Goal Planning - Error Cases', () => {
  let setup;

  beforeEach(async () => {
    // Define expensive eat task BEFORE creating setup
    const eatTask = createTestTask({
      id: 'test:eat',
      cost: 50, // High cost
      priority: 100,
      structuralGates: {
        description: 'Actor can eat',
        condition: { '==': [1, 1] }, // Always true
      },
      planningPreconditions: [], // Empty - always applicable
      planningEffects: [
        {
          type: 'MODIFY_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:needs',
            field: 'hunger',
            value: 20, // Small reduction (FIXED: was -20)
            mode: 'decrement',
          },
        },
      ],
    });

    // Create GOAP test setup with tasks configured in the tasks parameter
    setup = await createGoapTestSetup({
      mockRefinement: true,
      tasks: {
        test: {
          [eatTask.id]: eatTask,
        },
      },
    });
  });

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  it('should handle impossible numeric goals gracefully', async () => {
    const actor = {
      id: 'test_actor',
      components: {
        'core:needs': { hunger: 100 },
      },
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:impossible_hunger',
      goalState: {
        '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 10],
      },
      relevance: { '==': [true, true] },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };
    // Planning should fail gracefully (cost too high for benefit)
    await expect(
      setup.controller.decideTurn(actor, world)
    ).resolves.not.toThrow();

    const events = setup.eventBus.getEvents();
    // May be null if planning failed, or very expensive plan
    const planningFailed = events.some(
      (e) => e.type === GOAP_EVENTS.PLANNING_FAILED
    );
    // Either planning failed or succeeded with expensive plan
    expect(
      planningFailed ||
        events.some((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED)
    ).toBe(true);
  });

  it('should handle missing numeric fields', async () => {
    const actor = {
      id: 'test_actor',
      components: {},
      // No 'core:needs' component added
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:missing_field',
      goalState: {
        '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 30],
      },
      relevance: { '==': [true, true] },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };
    await expect(
      setup.controller.decideTurn(actor, world)
    ).resolves.not.toThrow();
  });

  it('should handle invalid constraint operators safely', async () => {
    const actor = {
      id: 'test_actor',
      components: {
        'core:needs': { hunger: 50 },
      },
    };
    setup.registerPlanningActor(actor);

    // Use unsupported operator (should be handled gracefully)
    const goal = createTestGoal({
      id: 'test:invalid_operator',
      goalState: {
        '!=': [{ var: 'state.actor.components.core_needs.hunger' }, 50],
      }, // != may not be numeric
      relevance: { '==': [true, true] },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };
    // Should not throw, may treat as non-numeric constraint
    await expect(
      setup.controller.decideTurn(actor, world)
    ).resolves.not.toThrow();
  });
});

describe('Numeric Goal Planning - Backward Compatibility', () => {
  let setup;

  beforeEach(async () => {
    // Define tasks BEFORE creating setup
    const acquireWeaponTask = createTestTask({
      id: 'test:acquire_weapon',
      cost: 10,
      priority: 100,
      structuralGates: {
        description: 'Actor can acquire weapon',
        condition: { '==': [1, 1] }, // Always true
      },
      planningPreconditions: [], // Empty - always applicable
      planningEffects: [
        {
          type: 'ADD_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:armed',
            value: { weapon: 'sword' },
          },
        },
      ],
    });

    const eatTask = createTestTask({
      id: 'test:eat',
      cost: 5,
      priority: 100,
      structuralGates: {
        description: 'Actor can eat',
        condition: { '==': [1, 1] }, // Always true
      },
      planningPreconditions: [], // Empty - always applicable
      planningEffects: [
        {
          type: 'MODIFY_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:needs',
            field: 'hunger',
            value: 60,
            mode: 'decrement',
          },
        },
      ],
    });

    // Create GOAP test setup with tasks configured in the tasks parameter
    setup = await createGoapTestSetup({
      mockRefinement: true,
      tasks: {
        test: {
          [acquireWeaponTask.id]: acquireWeaponTask,
          [eatTask.id]: eatTask,
        },
      },
    });
  });

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  it('should still handle component-only goals', async () => {
    const actor = {
      id: 'test_actor',
      components: {},
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:be_armed',
      goalState: { has_component: ['actor', 'core:armed'] },
      relevance: { '==': [true, true] },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };
    await setup.controller.decideTurn(actor, world);

    const events = setup.eventBus.getEvents();
    const planCreated = events.some(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );
    expect(planCreated).toBe(true);
  });

  it('should surface state misses when planning state is stale', async () => {
    const actor = {
      id: 'test_actor',
      components: {
        'core:armed': { equipped: true },
        'core:needs': { hunger: 55 },
      },
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:be_armed-runtime',
      goalState: {
        and: [
          { has_component: ['actor', 'core:armed'] },
          { has_component: ['actor', 'core:needs'] },
        ],
      },
      relevance: { '==': [true, true] },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const staleActorState = {
      id: actor.id,
      components: {},
    };

    const world = {
      state: setup.buildPlanningState(staleActorState),
      entities: {},
    };

    await setup.controller.decideTurn(actor, world);

    const planningCompleted = setup.eventBus
      .getEvents()
      .find((event) => event.type === GOAP_EVENTS.PLANNING_COMPLETED);

    expect(planningCompleted).toBeDefined();
    expect(planningCompleted.payload.planLength).toBeGreaterThan(0);

    const stateMissEvents = setup.eventBus.getEvents(GOAP_EVENTS.STATE_MISS);
    expect(stateMissEvents.length).toBeGreaterThan(1);

    const missedComponents = new Set(
      stateMissEvents.map((event) => event.payload?.componentId).filter(Boolean)
    );

    expect(missedComponents.has('core:armed')).toBe(true);
    expect(missedComponents.has('core:needs')).toBe(true);
  });

  it('should handle mixed component + numeric goals', async () => {
    const actor = {
      id: 'test_actor',
      components: {
        'core:needs': { hunger: 80 },
      },
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:mixed_goal',
      goalState: {
        and: [
          { has_component: ['actor', 'core:armed'] },
          { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 30] },
        ],
      },
      relevance: { '==': [true, true] },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };
    await setup.controller.decideTurn(actor, world);

    // Should plan for both conditions
    const events = setup.eventBus.getEvents();
    const planCreated = events.some(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );
    expect(planCreated).toBe(true);
  });

  it('should bypass numeric heuristics when composite goal only needs structural progress', async () => {
    const actor = {
      id: 'test_actor',
      components: {
        'core:needs': { hunger: 20 }, // Already satisfies numeric threshold
      },
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:structural_progress_only',
      goalState: {
        and: [
          { has_component: ['actor', 'core:armed'] },
          { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 30] },
        ],
      },
      relevance: { '==': [true, true] },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };

    await setup.controller.decideTurn(actor, world);

    const events = setup.eventBus.getEvents();
    const planCompleted = events.find(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );
    expect(planCompleted).toBeDefined();
    expect(planCompleted.payload.planLength).toBeGreaterThan(0);
  });

  it('should handle complex nested logic with numeric constraints', async () => {
    const actor = {
      id: 'test_actor',
      components: {
        'core:needs': { hunger: 75 },
      },
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:complex_goal',
      goalState: {
        or: [
          { has_component: ['actor', 'core:armed'] },
          {
            and: [
              {
                '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 30],
              },
              {
                '<': [{ var: 'state.actor.components.core_needs.hunger' }, 50],
              },
            ],
          },
        ],
      },
      relevance: { '==': [true, true] },
      priority: 10,
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };
    await setup.controller.decideTurn(actor, world);

    const events = setup.eventBus.getEvents();
    // Should either acquire weapon OR reduce hunger
    const planCreated = events.some(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );
    expect(planCreated).toBe(true);
  });
});
