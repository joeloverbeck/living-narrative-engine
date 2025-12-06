/**
 * Diagnostic test to verify state format synchronization
 */

import { describe, it, expect } from '@jest/globals';
import { createGoapTestSetup } from '../../integration/goap/testFixtures/goapTestSetup.js';
import { createTestGoal } from '../../integration/goap/testFixtures/testGoalFactory.js';
import { createTestTask } from '../../integration/goap/testFixtures/testTaskFactory.js';

/**
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
  return { ...actor, components: modifiedComponents };
}

/**
 *
 * @param actor
 */
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

describe('State Sync Diagnostic', () => {
  it('should sync all three state formats after effects simulation', async () => {
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

    console.log('\n=== Initial State ===');
    console.log(
      'Flat hash:',
      JSON.stringify(initialState['test_actor:core:stats'])
    );
    console.log(
      'Nested (colon):',
      JSON.stringify(initialState.actor.components['core:stats'])
    );
    console.log(
      'Nested (flattened):',
      JSON.stringify(initialState.actor.components['core_stats'])
    );

    const simResult = setup.effectsSimulator.simulateEffects(
      initialState,
      healTask.planningEffects,
      { actor: 'test_actor', actorId: 'test_actor' }
    );

    console.log('\n=== After Simulation ===');
    console.log('Simulation success:', simResult.success);
    console.log(
      'Flat hash:',
      JSON.stringify(simResult.state['test_actor:core:stats'])
    );
    console.log(
      'Nested (colon):',
      JSON.stringify(simResult.state.actor?.components?.['core:stats'])
    );
    console.log(
      'Nested (flattened):',
      JSON.stringify(simResult.state.actor?.components?.['core_stats'])
    );

    expect(simResult.success).toBe(true);
    expect(simResult.state['test_actor:core:stats'].health).toBe(40);
    expect(simResult.state.actor?.components?.['core:stats']?.health).toBe(40);
    expect(simResult.state.actor?.components?.['core_stats']?.health).toBe(40);

    const goal = createTestGoal({
      id: 'test:heal_self',
      goalState: {
        '>=': [{ var: 'state.actor.components.core_stats.health' }, 80],
      },
      relevance: { '==': [true, true] },
      priority: 10,
    });

    console.log('\n=== Distance Calculation ===');
    const beforeDistance = setup.heuristicRegistry.calculate(
      'goal-distance',
      initialState,
      goal,
      []
    );
    console.log('Before distance:', beforeDistance);

    const afterDistance = setup.heuristicRegistry.calculate(
      'goal-distance',
      simResult.state,
      goal,
      []
    );
    console.log('After distance:', afterDistance);
    console.log('Reduction:', beforeDistance - afterDistance);

    expect(beforeDistance).toBe(70); // 80 - 10
    expect(afterDistance).toBe(40); // 80 - 40
    expect(beforeDistance - afterDistance).toBe(30);

    setup.testBed.cleanup();
  });
});
