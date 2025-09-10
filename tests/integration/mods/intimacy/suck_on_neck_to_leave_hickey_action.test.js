/**
 * @file Integration tests for the intimacy:suck_on_neck_to_leave_hickey action and rule.
 * @description Tests the rule execution after the suck_on_neck_to_leave_hickey action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import suckOnNeckToLeaveHickeyRule from '../../../../data/mods/intimacy/rules/handle_suck_on_neck_to_leave_hickey.rule.json';
import eventIsActionSuckOnNeckToLeaveHickey from '../../../../data/mods/intimacy/conditions/event-is-action-suck-on-neck-to-leave-hickey.condition.json';

describe('intimacy:suck_on_neck_to_leave_hickey action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:suck_on_neck_to_leave_hickey',
      suckOnNeckToLeaveHickeyRule,
      eventIsActionSuckOnNeckToLeaveHickey
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes suck on neck to leave hickey action between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice has sucked on Bob's neck, leaving a hickey."
    );

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('perception log shows correct message for suck on neck to leave hickey action', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], {
      location: 'garden',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    testFixture.assertPerceptibleEvent({
      descriptionText: "Sarah has sucked on James's neck, leaving a hickey.",
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

    // First suck on Bob's neck to leave a hickey
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    let perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice has sucked on Bob's neck, leaving a hickey."
    );

    // Clear events for the next test
    testFixture.events.length = 0;

    // Then suck on Charlie's neck to leave a hickey
    await testFixture.executeAction(
      scenario.actor.id,
      scenario.observers[0].id
    );

    perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice has sucked on Charlie's neck, leaving a hickey."
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
      actionId: 'intimacy:kiss_neck_sensually',
      targetId: scenario.target.id,
      originalInput: 'kiss_neck_sensually target',
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
      "Elena has sucked on Marcus's neck, leaving a hickey."
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
    const expectedMessage =
      "Diana has sucked on Victor's neck, leaving a hickey.";
    expect(successEvent.payload.message).toBe(expectedMessage);
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
  });

  it('works correctly when actor is behind target', async () => {
    const scenario = testFixture.createCloseActors(['Emma', 'Liam'], {
      location: 'living_room',
    });

    // Add facing_away component to target
    testFixture.entityManager.addComponent(
      scenario.target.id,
      'positioning:facing_away',
      {
        facing_away_from: [scenario.actor.id],
      }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Emma has sucked on Liam's neck, leaving a hickey."
    );
  });

  it('demonstrates intimate and possessive nature of the action', async () => {
    const scenario = testFixture.createCloseActors(['Aria', 'Kai'], {
      location: 'private_room',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();

    // The message should convey the intimate and marking nature of the action
    expect(perceptibleEvent.payload.descriptionText).toContain('sucked on');
    expect(perceptibleEvent.payload.descriptionText).toContain('neck');
    expect(perceptibleEvent.payload.descriptionText).toContain('hickey');
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Aria has sucked on Kai's neck, leaving a hickey."
    );
  });
});
