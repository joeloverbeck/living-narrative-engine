/**
 * Diagnostic script to understand GOAP planning issue
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
    const flattenedId = componentId.replace(/:/g, '_');
    state.actor.components[flattenedId] = componentData;
  });
  return state;
}

async function diagnose() {
  console.log('=== GOAP Planning Diagnostic ===\n');

  const mineTask = createTestTask({
    id: 'test:mine',
    cost: 1,
    priority: 100,
    structuralGates: {
      description: 'Actor can mine',
      condition: { '==': [1, 1] },
    },
    planningPreconditions: [],
    planningEffects: [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:resources',
          field: 'gold',
          value: 5,
          mode: 'increment',
        },
      },
    ],
    refinementMethods: ['test:mine_method'],
    fallbackBehavior: 'replan',
  });

  console.log('Task definition:', JSON.stringify(mineTask, null, 2));

  const setup = await createGoapTestSetup({
    mockRefinement: true,
    tasks: {
      test: {
        [mineTask.id]: mineTask,
      },
    },
  });

  const actor = {
    id: 'actor-1',
    components: {
      'core:resources': { gold: 0 },
    },
  };
  setup.entityManager.addEntity(addFlattenedAliases(actor));

  console.log('\nActor entity:', actor);
  console.log('Actor components:', actor.components);

  const goal = createTestGoal({
    id: 'test:gather_gold',
    priority: 10,
    goalState: { '>=': [{ var: 'state.actor.components.core_resources.gold' }, 100] },
  });

  console.log('\nGoal:', JSON.stringify(goal, null, 2));

  setup.dataRegistry.register('goals', goal.id, goal);

  const world = { state: buildDualFormatState(actor), entities: {} };

  console.log('\nWorld state:', JSON.stringify(world, null, 2));

  console.log('\nCalling decideTurn...');
  const result = await setup.controller.decideTurn(actor, world);

  console.log('\nDecideTurn result:', result);

  const plan = setup.controller.getActivePlan(actor.id);
  console.log('\nActive plan:', plan);

  if (setup.testBed) {
    setup.testBed.cleanup();
  }
}

diagnose().catch(console.error);
