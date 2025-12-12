/**
 * @file Integration tests for the kissing:kiss_cheek action and rule.
 * @description Tests the rule execution after the kiss_cheek action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import kissCheekRule from '../../../../data/mods/kissing/rules/kiss_cheek.rule.json';
import eventIsActionKissCheek from '../../../../data/mods/kissing/conditions/event-is-action-kiss-cheek.condition.json';

describe('kissing:kiss_cheek action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:kiss_cheek',
      kissCheekRule,
      eventIsActionKissCheek
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes kiss cheek action between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice leans in to kiss Bob's cheek softly."
    );

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('perception log shows correct message for kiss cheek action', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], {
      location: 'garden',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    testFixture.assertPerceptibleEvent({
      descriptionText: "Sarah leans in to kiss James's cheek softly.",
      locationId: 'garden',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });
  });

  it('handles multiple close partners correctly', async () => {
    const scenario = testFixture.createMultiActorScenario(
      ['Alice', 'Bob', 'Charlie'],
      {
        location: 'room1',
      }
    );

    // First kiss Bob's cheek
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    let perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice leans in to kiss Bob's cheek softly."
    );

    // Clear events for the next test
    testFixture.events.length = 0;

    // Then kiss Charlie's cheek
    await testFixture.executeAction(
      scenario.actor.id,
      scenario.observers[0].id
    );

    perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice leans in to kiss Charlie's cheek softly."
    );
  });

  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    // Try with a different action
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'caressing:lick_lips',
      targetId: scenario.target.id,
      originalInput: 'lick_lips target',
    });

    // Should not have any perceptible events from our rule
    testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
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
      'physical.target_action'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Elena leans in to kiss Marcus's cheek softly."
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
    const expectedMessage = "Diana leans in to kiss Victor's cheek softly.";
    expect(successEvent.payload.message).toBe(expectedMessage);
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
  });
});
