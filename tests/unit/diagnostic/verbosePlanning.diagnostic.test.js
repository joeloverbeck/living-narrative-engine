/**
 * Verbose diagnostic with console spies to see planner logic
 */

import { describe, it } from '@jest/globals';
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

describe('Verbose Planning Diagnostic', () => {
  it('should show detailed planner execution', async () => {
    console.log('\n=== VERBOSE PLANNING DIAGNOSTIC ===\n');

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

    console.log('1. Task created with planningScope:', healTask.planningScope);

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
      state: buildDualFormatState(actor),
      entities: {},
    };

    console.log('2. Executing decideTurn...\n');
    await setup.controller.decideTurn(actor, world);

    const events = setup.eventBus.getEvents();

    const planningCompleted = events.find(
      (e) => e.type === 'goap:planning_completed'
    );
    const planningFailed = events.find(
      (e) => e.type === 'goap:planning_failed'
    );

    console.log('\n3. Results:');
    if (planningCompleted) {
      console.log('   ✓ PLANNING_COMPLETED');
      console.log('   Plan length:', planningCompleted.payload?.planLength);
      console.log(
        '   Tasks:',
        JSON.stringify(planningCompleted.payload?.tasks)
      );
    }

    if (planningFailed) {
      console.log('   ✗ PLANNING_FAILED');
      console.log('   Reason:', planningFailed.payload?.reason);
    }

    setup.testBed.cleanup();
    console.log('\n=== DIAGNOSTIC COMPLETE ===\n');
  });
});
