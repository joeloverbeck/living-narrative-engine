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
    tasks: {
      test: {
        [healTask.id]: healTask,
      },
    },
  });

  const actor = {
    id: 'test_actor',
    components: {
      'core:stats': { health: 10 },
    },
  };
  setup.entityManager.addEntity(addFlattenedAliases(actor));

  const goal = createTestGoal({
    id: 'test:heal_self',
    goalState: { '>=': [{ var: 'state.actor.components.core_stats.health' }, 80] },
    relevance: { '==': [true, true] },
    priority: 10,
  });

  setup.dataRegistry.register('goals', goal.id, goal);

  const world = {
    state: buildDualFormatState(actor),
    entities: {},
  };

  await setup.controller.decideTurn(actor, world);

  const events = setup.eventBus.getAll();
  console.log('\n=== ALL EVENTS ===');
  events.forEach((e, idx) => {
    console.log(`Event ${idx + 1}: ${e.type}`);
    console.log('Payload:', JSON.stringify(e.payload, null, 2));
  });

  setup.testBed.cleanup();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
