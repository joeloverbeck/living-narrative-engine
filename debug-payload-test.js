/**
 * Debug test to check payload structure and placeholder resolution
 */

import { describe, it, beforeEach, expect } from '@jest/globals';
import { ModTestFixture } from './tests/common/mods/ModTestFixture.js';
import pushOffRule from './data/mods/physical-control/rules/handle_push_off.rule.json' assert { type: 'json' };
import eventIsActionPushOff from './data/mods/physical-control/conditions/event-is-action-push-off.condition.json' assert { type: 'json' };

describe('Debug Payload and Placeholder Resolution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'physical-control',
      'physical-control:push_off',
      pushOffRule,
      eventIsActionPushOff
    );
  });

  it('debug payload structure and event handling', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    console.log('=== TEST SETUP ===');
    console.log('Actor ID:', scenario.actor.id);
    console.log('Target ID:', scenario.target.id);
    console.log('Actor closeness:', JSON.stringify(scenario.actor.components['positioning:closeness']));

    // Hook into event bus to see the actual payload
    const originalDispatch = testFixture.eventBus.dispatch;
    testFixture.eventBus.dispatch = function (eventType, payload) {
      console.log('=== EVENT DISPATCHED ===');
      console.log('Event type:', eventType);
      console.log('Payload:', JSON.stringify(payload, null, 2));
      return originalDispatch.call(this, eventType, payload);
    };

    console.log('=== EXECUTING ACTION ===');
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    console.log('=== AFTER ACTION ===');
    const actorAfter = testFixture.entityManager.getEntityInstance(scenario.actor.id);
    console.log('Actor closeness AFTER:', JSON.stringify(actorAfter.components['positioning:closeness']));

    // The test should fail if closeness remains attached to the target
    expect(actorAfter.components['positioning:closeness']).toBeUndefined();
  });
});
