/**
 * Diagnostic to verify state format synchronization
 * Run with: NODE_ENV=test node diagnostic-state-sync.js
 */

import { createGoapTestSetup } from './tests/integration/goap/testFixtures/goapTestSetup.js';
import { createTestGoal } from './tests/integration/goap/testFixtures/testGoalFactory.js';
import { createTestTask } from './tests/integration/goap/testFixtures/testTaskFactory.js';

function addFlattenedAliases(actor) {
  const modifiedComponents = { ...actor.components };
  Object.keys(actor.components).forEach((componentId) => {
    if (componentId.includes(':')) {
      const flattenedId = componentId.replace(/:/g, '_');
      modifiedComponents[flattenedId] = actor.components[componentId];
    }
  });
  return { ...actor, components: modifiedComponents };
}

function buildDualFormatState(actor) {
  const state = { actor: { id: actor.id, components: {} } };
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

async function main() {
  console.log('\n=== State Sync Diagnostic ===\n');

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

  const setup = await createGoapTestSetup({
    mockRefinement: true,
    tasks: { test: { [healTask.id]: healTask } },
  });

  const actor = {
    id: 'test_actor',
    components: {
      'core:stats': { health: 10 },
    },
  };

  setup.entityManager.addEntity(addFlattenedAliases(actor));

  const initialState = buildDualFormatState(actor);

  console.log('1. Initial state structure:');
  console.log('   Flat hash:', JSON.stringify(initialState['test_actor:core:stats']));
  console.log('   Nested (colon):', JSON.stringify(initialState.actor.components['core:stats']));
  console.log('   Nested (flattened):', JSON.stringify(initialState.actor.components['core_stats']));

  console.log('\n2. Simulating heal task (+30 health)...');
  const simResult = setup.effectsSimulator.simulateEffects(
    initialState,
    healTask.planningEffects,
    { actor: 'test_actor', actorId: 'test_actor' }
  );

  if (!simResult.success) {
    console.log('   ❌ Simulation failed:', simResult.error);
    setup.testBed.cleanup();
    process.exit(1);
  }

  console.log('   ✓ Simulation succeeded');

  console.log('\n3. State after simulation:');
  console.log('   Flat hash:', JSON.stringify(simResult.state['test_actor:core:stats']));
  console.log('   Nested (colon):', JSON.stringify(simResult.state.actor?.components?.['core:stats']));
  console.log('   Nested (flattened):', JSON.stringify(simResult.state.actor?.components?.['core_stats']));

  const goal = createTestGoal({
    id: 'test:heal_self',
    goalState: { '>=': [{ var: 'state.actor.components.core_stats.health' }, 80] },
    relevance: { '==': [true, true] },
    priority: 10,
  });

  console.log('\n4. Distance calculation (goal: health >= 80):');
  const beforeDistance = setup.heuristicRegistry.calculate(
    'goal-distance',
    initialState,
    goal,
    []
  );
  console.log(`   Before: ${beforeDistance} (health at 10)`);

  const afterDistance = setup.heuristicRegistry.calculate(
    'goal-distance',
    simResult.state,
    goal,
    []
  );
  console.log(`   After: ${afterDistance} (health at 40)`);
  console.log(`   Reduction: ${beforeDistance - afterDistance}`);
  console.log(`   Expected reduction: 30`);

  if (Math.abs((beforeDistance - afterDistance) - 30) < 0.01) {
    console.log('   ✅ Distance reduction is correct!');
  } else {
    console.log('   ❌ Distance reduction is WRONG!');
  }

  setup.testBed.cleanup();
  console.log('\n=== Diagnostic Complete ===\n');
}

main().catch(err => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
