/**
 * @file Integration tests for the intimacy:kiss_neck_sensually action and rule.
 * @description Tests the rule execution after the kiss_neck_sensually action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import kissNeckSensuallyRule from '../../../../data/mods/intimacy/rules/handle_kiss_neck_sensually.rule.json';
import eventIsActionKissNeckSensually from '../../../../data/mods/intimacy/conditions/event-is-action-kiss-neck-sensually.condition.json';

describe('intimacy:kiss_neck_sensually action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:kiss_neck_sensually',
      kissNeckSensuallyRule,
      eventIsActionKissNeckSensually
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes kiss neck sensually action between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    testFixture.assertActionSuccess("Alice kisses Bob's neck sensually.");
  });

  it('perception log shows correct message for kiss neck sensually action', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], {
      location: 'garden',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    testFixture.assertPerceptibleEvent({
      descriptionText: "Sarah kisses James's neck sensually.",
      locationId: 'garden',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });
  });

  it('handles multiple close partners correctly', async () => {
    const scenario = testFixture.createMultiActorScenario(
      ['Alice', 'Bob', 'Charlie'],
      { location: 'room1' }
    );

    // First kiss Bob's neck
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent1 = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent1.payload.descriptionText).toBe(
      "Alice kisses Bob's neck sensually."
    );

    // Clear events for the next test
    testFixture.clearEvents();

    // Then kiss Charlie's neck
    await testFixture.executeAction(
      scenario.actor.id,
      scenario.observers[0].id
    );

    const perceptibleEvent2 = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent2.payload.descriptionText).toBe(
      "Alice kisses Charlie's neck sensually."
    );
  });

  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    // Try with a different action - manually dispatch different actionId
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'intimacy:nuzzle_face_into_neck',
      targetId: scenario.target.id,
      originalInput: 'nuzzle_face_into_neck ' + scenario.target.id,
    });

    // Should not have any perceptible events from our rule
    const perceptibleEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents).toHaveLength(0);
  });

  it('generates proper perceptible event for observers', async () => {
    const scenario = testFixture.createCloseActors(['Elena', 'Marcus'], {
      location: 'bedroom',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Elena kisses Marcus's neck sensually."
    );
    expect(perceptibleEvent.payload.involvedEntities).toEqual([]);
  });

  it('validates perceptible event message matches action success message', async () => {
    const scenario = testFixture.createCloseActors(['Diana', 'Victor'], {
      location: 'library',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );

    expect(successEvent).toBeDefined();
    expect(perceptibleEvent).toBeDefined();

    // Both should have the same descriptive message
    const expectedMessage = "Diana kisses Victor's neck sensually.";
    expect(successEvent.payload.message).toBe(expectedMessage);
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
  });
});
