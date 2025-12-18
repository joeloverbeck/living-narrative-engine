import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../../common/mods/ModEntityBuilder.js';
import stopFollowingRule from '../../../../../data/mods/companionship/rules/stop_following.rule.json';
import eventIsActionStopFollowing from '../../../../../data/mods/companionship/conditions/event-is-action-stop-following.condition.json';

// Don't spam console on every import
// console.log('=== RULE STRUCTURE ===');
// console.log('Rule actions:', JSON.stringify(stopFollowingRule.actions, null, 2));

const ACTION_ID = 'companionship:stop_following';

describe('debug stop_following', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'companionship',
      ACTION_ID,
      stopFollowingRule,
      eventIsActionStopFollowing
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('debug events', async () => {
    const scenario = testFixture.createCloseActors(['Squire', 'Lord Byron'], {
      location: 'great_hall',
    });

    // Set up the following relationship (actor is following target)
    scenario.actor.components['companionship:following'] = {
      leaderId: scenario.target.id,
    };
    scenario.target.components['companionship:leading'] = {
      followers: [scenario.actor.id],
    };

    const room = ModEntityScenarios.createRoom('great_hall', 'Great Hall');
    testFixture.reset([room, scenario.actor, scenario.target]);

    console.log('=== ENTITIES ===');
    console.log('Actor ID:', scenario.actor.id);
    console.log('Target ID:', scenario.target.id);
    console.log('Actor following leaderId:', scenario.actor.components['companionship:following']?.leaderId);

    // stop_following is a self-action (no target needed)
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: ACTION_ID,
      originalInput: 'stop following',
    });

    await new Promise((resolve) => setTimeout(resolve, 100)); // Longer wait to ensure async ops complete

    console.log('=== ALL EVENTS (count: ' + testFixture.events.length + ') ===');
    testFixture.events.forEach((e, i) => {
      console.log(`Event ${i}: ${e.eventType}`, JSON.stringify(e.payload, null, 2));
    });

    // Check for error events (including system errors)
    const errorEvents = testFixture.events.filter(e =>
      e.eventType === 'core:system_error_occurred' ||
      e.eventType?.toLowerCase().includes('error'));
    if (errorEvents.length > 0) {
      console.log('=== ERROR EVENTS ===');
      errorEvents.forEach(e => console.log(JSON.stringify(e, null, 2)));
    }

    // Check if actors are in same location
    const actorPosition = testFixture.getComponent('actor1', 'core:position');
    const targetPosition = testFixture.getComponent('target1', 'core:position');
    console.log('=== POST-EXECUTION STATE ===');
    console.log('Actor position:', actorPosition);
    console.log('Target position:', targetPosition);

    // Check if following relationship was broken
    const actorFollowing = testFixture.getComponent('actor1', 'companionship:following');
    const targetLeading = testFixture.getComponent('target1', 'companionship:leading');
    console.log('Actor following after:', actorFollowing);
    console.log('Target leading after:', targetLeading);

    // Check if perceptible event was dispatched
    const perceptibleEvent = testFixture.events.find(e => e.eventType === 'core:perceptible_event');
    console.log('Perceptible event found:', !!perceptibleEvent);
    if (perceptibleEvent) {
      console.log('Perceptible event payload:', JSON.stringify(perceptibleEvent.payload, null, 2));
    }

    expect(true).toBe(true);
  });
});
