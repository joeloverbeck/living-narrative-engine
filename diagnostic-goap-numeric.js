/**
 * Diagnostic script to investigate GOAP numeric goal planning failures
 * Run with: NODE_ENV=test node diagnostic-goap-numeric.js
 */

import { createGoapTestSetup } from './tests/integration/goap/testFixtures/goapTestSetup.js';
import { createTestGoal } from './tests/integration/goap/testFixtures/testGoalFactory.js';
import { createTestTask } from './tests/integration/goap/testFixtures/testTaskFactory.js';
import { GOAP_EVENTS } from './src/goap/events/goapEvents.js';

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

function buildDualFormatState(actor) {
  const state = {
    actor: {
      id: actor.id,
      components: {},
    },
  };

  Object.keys(actor.components).forEach((componentId) => {
    const componentData = { ...actor.components[componentId] };
    const flatKey = `${actor.id}:${componentId}`;
    state[flatKey] = componentData;
    state.actor.components[componentId] = componentData;
    const flattenedComponentId = componentId.replace(/:/g, '_');
    state.actor.components[flattenedComponentId] = componentData;
  });

  return state;
}

async function runDiagnostic() {
  console.log('\n=== GOAP Numeric Goal Planning Diagnostic ===\n');

  // Create heal task
  const healTask = createTestTask({
    id: 'test:heal',
    cost: 10,
    priority: 100,
    structuralGates: {
      description: 'Actor can heal',
      condition: { '==': [1, 1] },
    },
    planningPreconditions: [],
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

  console.log('1. Created heal task:', healTask.id);
  console.log('   Cost:', healTask.cost);
  console.log('   Effects:', JSON.stringify(healTask.planningEffects, null, 2));

  // Create GOAP setup
  const setup = await createGoapTestSetup({
    mockRefinement: true,
    tasks: {
      test: {
        [healTask.id]: healTask,
      },
    },
  });

  console.log('\n2. Created GOAP test setup');

  // Create actor with low health
  const actor = {
    id: 'test_actor',
    components: {
      'core:stats': { health: 10 },
    },
  };
  setup.entityManager.addEntity(addFlattenedAliases(actor));

  console.log('\n3. Created actor:', actor.id);
  console.log('   Health:', actor.components['core:stats'].health);

  // Create goal
  const goal = createTestGoal({
    id: 'test:heal_self',
    goalState: { '>=': [{ var: 'state.actor.components.core_stats.health' }, 80] },
    relevance: { '==': [true, true] },
    priority: 10,
  });

  setup.dataRegistry.register('goals', goal.id, goal);

  console.log('\n4. Registered goal:', goal.id);
  console.log('   Goal state:', JSON.stringify(goal.goalState, null, 2));

  // Build world
  const world = {
    state: buildDualFormatState(actor),
    entities: {},
  };

  console.log('\n5. Built world state');
  console.log('   State keys:', Object.keys(world.state));

  // Check task library
  console.log('\n6. Checking task library...');
  const tasksInRepo = setup.gameDataRepository.get('tasks');
  console.log('   Tasks in repository:', JSON.stringify(tasksInRepo, null, 2));

  // Try planning
  console.log('\n7. Attempting planning...');
  try {
    await setup.controller.decideTurn(actor, world);
    console.log('   ✓ decideTurn completed without errors');
  } catch (err) {
    console.log('   ✗ decideTurn failed:', err.message);
    console.log('   Stack:', err.stack);
  }

  // Check events
  const events = setup.eventBus.getAll();
  console.log('\n8. Event Bus Results:');
  console.log('   Total events:', events.length);

  const eventTypes = events.map(e => e.type);
  console.log('   Event types:', eventTypes);

  const planningCompleted = events.some(e => e.type === GOAP_EVENTS.PLANNING_COMPLETED);
  const planningFailed = events.some(e => e.type === GOAP_EVENTS.PLANNING_FAILED);

  console.log('   Planning completed?', planningCompleted);
  console.log('   Planning failed?', planningFailed);

  // Check for planning failed events with details
  const failureEvents = events.filter(e => e.type === GOAP_EVENTS.PLANNING_FAILED);
  if (failureEvents.length > 0) {
    console.log('\n9. Planning Failure Details:');
    failureEvents.forEach((event, idx) => {
      console.log(`   Failure ${idx + 1}:`);
      console.log('     Payload:', JSON.stringify(event.payload, null, 2));
    });
  }

  // Check for goal/task failure events
  const goalFailures = events.filter(e => e.type === GOAP_EVENTS.GOAL_FAILED);
  const taskFailures = events.filter(e => e.type === GOAP_EVENTS.TASK_FAILED);

  if (goalFailures.length > 0) {
    console.log('\n10. Goal Failures:');
    goalFailures.forEach((event, idx) => {
      console.log(`   Failure ${idx + 1}:`);
      console.log('     Payload:', JSON.stringify(event.payload, null, 2));
    });
  }

  if (taskFailures.length > 0) {
    console.log('\n11. Task Failures:');
    taskFailures.forEach((event, idx) => {
      console.log(`   Failure ${idx + 1}:`);
      console.log('     Payload:', JSON.stringify(event.payload, null, 2));
    });
  }

  setup.testBed.cleanup();
  console.log('\n=== Diagnostic Complete ===\n');
}

runDiagnostic().catch(err => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
