/**
 * Diagnostic test to inspect planning events from failing scenario
 */

import { describe, it, expect } from '@jest/globals';
import { createGoapTestSetup } from '../integration/goap/testFixtures/goapTestSetup.js';
import { createTestGoal } from '../integration/goap/testFixtures/testGoalFactory.js';
import { createTestTask } from '../integration/goap/testFixtures/testTaskFactory.js';
import { GOAP_EVENTS } from '../../src/goap/events/goapEvents.js';

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

describe('Planning Events Diagnostic', () => {
  it('should trace events during multi-action numeric goal planning', async () => {
    console.log('\n=== Inspecting Planning Events ===\n');

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

    console.log('1. Executing decideTurn with goal: health >= 80, current: 10\n');
    await setup.controller.decideTurn(actor, world);

    const events = setup.eventBus.getEvents();

    console.log(`2. Total events dispatched: ${events.length}\n`);

    console.log('3. Event types:');
    const eventCounts = {};
    events.forEach(e => {
      eventCounts[e.type] = (eventCounts[e.type] || 0) + 1;
    });
    Object.entries(eventCounts).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    console.log('\n4. Detailed events:');
    events.forEach((e, idx) => {
      console.log(`\n   Event ${idx + 1}: ${e.type}`);
      if (e.payload) {
        console.log(`   Payload:`, JSON.stringify(e.payload, null, 2));
      }
    });

    const planningCompleted = events.some(e => e.type === GOAP_EVENTS.PLANNING_COMPLETED);
    const planningFailed = events.some(e => e.type === GOAP_EVENTS.PLANNING_FAILED);

    console.log(`\n5. Planning result:`);
    console.log(`   PLANNING_COMPLETED: ${planningCompleted}`);
    console.log(`   PLANNING_FAILED: ${planningFailed}`);

    if (planningFailed) {
      const failureEvent = events.find(e => e.type === GOAP_EVENTS.PLANNING_FAILED);
      console.log(`\n6. Failure details:`);
      console.log(`   Reason:`, failureEvent?.payload?.reason);
    }

    console.log('\n=== Inspection Complete ===\n');

    setup.testBed.cleanup();
  });
});
