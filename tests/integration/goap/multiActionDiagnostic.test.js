/**
 * @file Diagnostic test to identify multi-action planning failure
 * @description Uses GOAP debugging tools to trace planning behavior
 * @see tickets/GOAP-MULTIACTION-DIAGNOSTIC-REPORT.md
 * @see docs/goap/debugging-tools.md
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
 * Helper to add flattened component aliases to an actor entity
 *
 * @param actor
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
 * Helper to build dual-format state for GOAP planning
 *
 * @param actor
 */
function buildDualFormatState(actor) {
  const state = {
    actor: {
      id: actor.id,
      components: {},
    },
  };

  Object.keys(actor.components).forEach((componentId) => {
    const componentData = { ...actor.components[componentId] };

    // Flat hash format
    const flatKey = `${actor.id}:${componentId}`;
    state[flatKey] = componentData;

    // Nested format with original key
    state.actor.components[componentId] = componentData;

    // Flattened alias
    const flattenedId = componentId.replace(/:/g, '_');
    state.actor.components[flattenedId] = componentData;
  });

  return state;
}

describe('GOAP Multi-Action Planning Diagnostic', () => {
  let setup;
  let goapDebugger;
  let eventTraceProbe;
  let detachProbeHandle;

  beforeEach(async () => {
    // Create eat task that reduces hunger by 60
    const eatTask = createTestTask({
      id: 'test:eat',
      cost: 5,
      priority: 100,
      structuralGates: {
        description: 'Actor can eat',
        condition: { '==': [1, 1] },
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

    setup = await createGoapTestSetup({
      mockRefinement: true,
      tasks: {
        test: {
          [eatTask.id]: eatTask,
        },
      },
    });

    // Create GOAP debugger
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

  it('DIAGNOSTIC: Test 1.2 - Multiple actions required (hunger 90 → 10)', async () => {
    // Setup: hunger=90, goal is hunger ≤ 10
    // Expected: 2 eat actions (90 → 30 → -30 clamped to 0)
    // Actual: Planning fails (returns null)

    const actor = {
      id: 'test_actor',
      components: {
        'core:needs': { hunger: 90 },
      },
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:reduce_hunger',
      priority: 10,
      goalState: {
        '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 10],
      },
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };

    console.log('\n========================================');
    console.log('DIAGNOSTIC TEST 1.2: Multiple Actions Required');
    console.log('========================================\n');

    console.log('Initial State:');
    console.log('  hunger:', actor.components['core:needs'].hunger);
    console.log('  goal: hunger ≤ 10');
    console.log('  task: eat (decrement 60)');
    console.log('  expected plan: [eat, eat] → 90 → 30 → -30 (clamped to 0)\n');

    // Calculate initial distance
    const initialDistance = setup.heuristicRegistry.calculate(
      'goal-distance',
      world.state,
      goal,
      []
    );
    console.log('Initial distance to goal:', initialDistance);
    console.log('  calculation: 90 > 10 → distance = 90 - 10 = 80\n');

    // Start debugging trace
    goapDebugger.startTrace('test_actor');

    console.log('Starting planning...\n');

    // Execute planning
    let planningResult;
    try {
      planningResult = await setup.controller.decideTurn(actor, world);
      console.log('Planning completed without error\n');
    } catch (err) {
      console.log('Planning threw error:', err.message, '\n');
      throw err;
    }

    // Check events
    const events = setup.eventBus.getEvents();

    console.log('=== EVENT BUS ANALYSIS ===\n');
    const eventTypes = events.map((e) => e.type);
    console.log('Events dispatched:', eventTypes);

    const planningStarted = events.find(
      (e) => e.type === GOAP_EVENTS.PLANNING_STARTED
    );
    const planningCompleted = events.find(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );
    const planningFailed = events.find(
      (e) => e.type === GOAP_EVENTS.PLANNING_FAILED
    );

    console.log('\nPlanning lifecycle events:');
    console.log('  PLANNING_STARTED:', planningStarted ? '✓ YES' : '✗ NO');
    console.log('  PLANNING_COMPLETED:', planningCompleted ? '✓ YES' : '✗ NO');
    console.log('  PLANNING_FAILED:', planningFailed ? '✓ YES' : '✗ NO');

    if (planningCompleted) {
      console.log('\nPLANNING_COMPLETED payload:');
      console.log(JSON.stringify(planningCompleted.payload, null, 2));
    }

    if (planningFailed) {
      console.log('\nPLANNING_FAILED payload:');
      console.log(JSON.stringify(planningFailed.payload, null, 2));
    }

    // Check failure history
    console.log('\n=== FAILURE HISTORY ===\n');
    const failures = goapDebugger.getFailureHistory('test_actor');
    console.log('Failed goals:', failures.failedGoals.length);
    if (failures.failedGoals.length > 0) {
      failures.failedGoals.forEach((f) => {
        console.log(`  - ${f.goalId}: ${f.reason}`);
      });
    }

    console.log('Failed tasks:', failures.failedTasks.length);
    if (failures.failedTasks.length > 0) {
      failures.failedTasks.forEach((f) => {
        console.log(`  - ${f.taskId}: ${f.reason}`);
      });
    }

    // Inspect plan
    console.log('\n=== PLAN INSPECTION ===\n');
    const planJSON = goapDebugger.inspectPlanJSON('test_actor');
    if (planJSON && planJSON.plan) {
      console.log('Plan found!');
      console.log('  Goal:', planJSON.plan.goalId);
      console.log('  Tasks:', planJSON.plan.tasks.length);
      planJSON.plan.tasks.forEach((task, i) => {
        console.log(`    ${i + 1}. ${task.taskId}`);
      });
    } else {
      console.log('No plan found');
      console.log('planJSON:', JSON.stringify(planJSON, null, 2));
    }

    // Generate full report
    console.log('\n=== FULL DEBUG REPORT ===\n');
    goapDebugger.stopTrace('test_actor');
    const report = goapDebugger.generateReport('test_actor');
    console.log(report);

    console.log('\n========================================');
    console.log('END DIAGNOSTIC TEST 1.2');
    console.log('========================================\n');

    // Assertions for investigation
    console.log('ASSERTION RESULTS:\n');

    if (planningCompleted) {
      console.log('✓ Planning completed (unexpected success!)');
      expect(planningCompleted).toBeDefined();
      expect(planningCompleted.payload.tasks.length).toBeGreaterThan(0);
    } else if (planningFailed) {
      console.log('✗ Planning failed (this is the bug we are investigating)');
      console.log('  Reason:', planningFailed.payload.reason);
      expect(planningFailed).toBeDefined();
    } else {
      console.log('⚠ Planning did not complete or fail (unexpected state)');
      expect(false).toBe(true); // Force test failure to investigate
    }
  });

  it('DIAGNOSTIC: Test 1.1 - Single action sufficient (baseline)', async () => {
    // Baseline test that SHOULD work
    // hunger=80, goal is hunger ≤ 30
    // Expected: 1 eat action (80 → 20)

    const actor = {
      id: 'test_actor',
      components: {
        'core:needs': { hunger: 80 },
      },
    };
    setup.registerPlanningActor(actor);

    const goal = createTestGoal({
      id: 'test:reduce_hunger',
      priority: 10,
      goalState: {
        '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 30],
      },
    });

    setup.dataRegistry.register('goals', goal.id, goal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };

    console.log('\n========================================');
    console.log('DIAGNOSTIC TEST 1.1: Single Action (Baseline)');
    console.log('========================================\n');

    console.log('Initial State:');
    console.log('  hunger:', actor.components['core:needs'].hunger);
    console.log('  goal: hunger ≤ 30');
    console.log('  task: eat (decrement 60)');
    console.log('  expected plan: [eat] → 80 → 20\n');

    goapDebugger.startTrace('test_actor');

    await setup.controller.decideTurn(actor, world);

    const events = setup.eventBus.getEvents();
    const planningCompleted = events.find(
      (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
    );

    console.log('Planning result:', planningCompleted ? 'SUCCESS' : 'FAILED');

    if (planningCompleted) {
      console.log('Plan tasks:', planningCompleted.payload.tasks);
      console.log(
        'Expected: 1 task, Actual:',
        planningCompleted.payload.tasks.length
      );
    }

    goapDebugger.stopTrace('test_actor');

    console.log('\n========================================');
    console.log('END DIAGNOSTIC TEST 1.1');
    console.log('========================================\n');

    expect(planningCompleted).toBeDefined();
    expect(planningCompleted.payload.tasks.length).toBe(1);
  });
});
