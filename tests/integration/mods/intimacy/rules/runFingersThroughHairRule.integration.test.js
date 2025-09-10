/**
 * @file Integration tests for the intimacy:run_fingers_through_hair rule.
 * @see data/mods/intimacy/rules/handle_run_fingers_through_hair.rule.json
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';
import runFingersThroughHairRule from '../../../../../data/mods/intimacy/rules/handle_run_fingers_through_hair.rule.json';
import eventIsActionRunFingersThroughHair from '../../../../../data/mods/intimacy/conditions/event-is-action-run-fingers-through-hair.condition.json';
describe('intimacy_handle_run_fingers_through_hair rule integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forRule(
      'intimacy',
      'intimacy:run_fingers_through_hair',
      runFingersThroughHairRule,
      eventIsActionRunFingersThroughHair
    );
  });

  afterEach(async () => {
    if (testFixture) {
      await testFixture.cleanup();
    }
  });

  it('performs run fingers through hair action successfully', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Beth']);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    // Note: assertPerceptibleEvent expects an object with expected properties
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();

    // Also check other expected events
    const eventTypes = testFixture.events.map((e) => e.eventType);
    expect(eventTypes).toContain('core:perceptible_event');
    expect(eventTypes).toContain('core:display_successful_action_result');
    expect(eventTypes).toContain('core:turn_ended');
  });

  it('perceptible event contains correct message', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Beth']);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice gently runs their fingers through Beth's hair."
    );
  });

  it('rule does not fire for different action', async () => {
    testFixture.reset([
      {
        id: 'actor1',
        components: {
          'core:name': { text: 'Alice' },
          'core:position': { locationId: 'room1' },
          'positioning:closeness': { partners: ['target1'] },
        },
      },
      {
        id: 'target1',
        components: {
          'core:name': { text: 'Bob' },
          'core:position': { locationId: 'room1' },
          'positioning:closeness': { partners: ['actor1'] },
        },
      },
    ]);

    // Manually dispatch a different action to test rule selectivity
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'intimacy:different_action',
      targetId: 'target1',
      originalInput: 'different_action target1',
    });

    const types = testFixture.events.map((e) => e.eventType);
    expect(types).not.toContain('core:perceptible_event');
    expect(types).not.toContain('core:display_successful_action_result');
    expect(types).not.toContain('core:turn_ended');
  });

  it('allows action when actor is kissing target (no forbidden components)', async () => {
    testFixture.reset([
      {
        id: 'actor1',
        components: {
          'core:name': { text: 'Alice' },
          'core:position': { locationId: 'room1' },
          'positioning:closeness': { partners: ['target1'] },
          'intimacy:kissing': { partner: 'target1' },
        },
      },
      {
        id: 'target1',
        components: {
          'core:name': { text: 'Bob' },
          'core:position': { locationId: 'room1' },
          'positioning:closeness': { partners: ['actor1'] },
          'intimacy:kissing': { partner: 'actor1' },
        },
      },
    ]);

    await testFixture.executeAction('actor1', 'target1');

    // Note: assertPerceptibleEvent expects an object with expected properties
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();

    // Also check other expected events
    const eventTypes = testFixture.events.map((e) => e.eventType);
    expect(eventTypes).toContain('core:perceptible_event');
    expect(eventTypes).toContain('core:display_successful_action_result');
    expect(eventTypes).toContain('core:turn_ended');

    // Use the already defined perceptibleEvent variable
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice gently runs their fingers through Bob's hair."
    );
  });

  it('works with multiple actors in location', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Beth']);

    // Add an observer in the same location
    testFixture.entityManager.createEntity('observer1');
    testFixture.entityManager.addComponent('observer1', 'core:name', {
      text: 'Charlie',
    });
    testFixture.entityManager.addComponent('observer1', 'core:position', {
      locationId: scenario.actor.locationId,
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    // Note: assertPerceptibleEvent expects an object with expected properties
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();

    // Also check other expected events
    const eventTypes = testFixture.events.map((e) => e.eventType);
    expect(eventTypes).toContain('core:perceptible_event');
    expect(eventTypes).toContain('core:display_successful_action_result');
    expect(eventTypes).toContain('core:turn_ended');

    // Already found perceptibleEvent above, just verify the payload
    expect(perceptibleEvent.payload.locationId).toBe('room1');
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
  });
});
