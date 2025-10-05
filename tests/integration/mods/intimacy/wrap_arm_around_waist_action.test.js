/**
 * @file Integration tests for the intimacy:wrap_arm_around_waist action and rule.
 * @description Tests the rule execution after the wrap_arm_around_waist action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import wrapArmAroundWaistRule from '../../../../data/mods/intimacy/rules/wrap_arm_around_waist.rule.json';
import eventIsActionWrapArmAroundWaist from '../../../../data/mods/intimacy/conditions/event-is-action-wrap-arm-around-waist.condition.json';

describe('intimacy:wrap_arm_around_waist action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:wrap_arm_around_waist',
      wrapArmAroundWaistRule,
      eventIsActionWrapArmAroundWaist
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes wrap arm around waist action between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice wraps an arm around Bob's waist."
    );

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('perceptible event shows correct message for wrap arm action', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], {
      location: 'garden',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    testFixture.assertPerceptibleEvent({
      descriptionText: "Sarah wraps an arm around James's waist.",
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

    // First wrap arm around Bob's waist
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    let perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice wraps an arm around Bob's waist."
    );

    // Clear events for the next test
    testFixture.events.length = 0;

    // Then wrap arm around Charlie's waist
    await testFixture.executeAction(
      scenario.actor.id,
      scenario.observers[0].id
    );

    perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice wraps an arm around Charlie's waist."
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
      actionId: 'intimacy:sling_arm_around_shoulders',
      targetId: scenario.target.id,
      originalInput: 'sling_arm_around_shoulders target',
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
      'action_target_general'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Elena wraps an arm around Marcus's waist."
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
    const expectedMessage = "Diana wraps an arm around Victor's waist.";
    expect(successEvent.payload.message).toBe(expectedMessage);
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
  });
});
