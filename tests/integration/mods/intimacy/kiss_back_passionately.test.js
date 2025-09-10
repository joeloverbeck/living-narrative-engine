/**
 * @file Integration tests for the intimacy:kiss_back_passionately action and rule.
 * @description Tests the rule execution after the kiss_back_passionately action is performed.
 * Specifically tests the prerequisite that actors must be kiss receivers (not initiators).
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import kissBackPassionatelyRule from '../../../../data/mods/intimacy/rules/kiss_back_passionately.rule.json';
import eventIsActionKissBackPassionately from '../../../../data/mods/intimacy/conditions/event-is-action-kiss-back-passionately.condition.json';

describe('intimacy:kiss_back_passionately action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:kiss_back_passionately',
      kissBackPassionatelyRule,
      eventIsActionKissBackPassionately
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes kiss back passionately for receiver (initiator: false)', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: false,
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: true,
    };

    testFixture.reset([scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice returns Bob's kiss passionately."
    );

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('perception log shows correct message for kiss back passionately', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], {
      location: 'garden',
    });

    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: false,
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: true,
    };

    testFixture.reset([scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    testFixture.assertPerceptibleEvent({
      descriptionText: "Sarah has returned James's kiss passionately.",
      locationId: 'garden',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });
  });

  it('preserves kissing component state (no ADD_COMPONENT or REMOVE_COMPONENT operations)', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: false,
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: true,
    };

    testFixture.reset([scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    // Verify this is an enhancement action that preserves kissing state
    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('handles multiple kissing partners correctly', async () => {
    const scenario = testFixture.createMultiActorScenario(
      ['Alice', 'Bob', 'Charlie'],
      {
        location: 'room1',
      }
    );

    // Add kissing components between Alice and Bob
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: false,
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: true,
    };

    testFixture.reset(scenario.allEntities);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice has returned Bob's kiss passionately."
    );
  });

  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: false,
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: true,
    };

    testFixture.reset([scenario.actor, scenario.target]);

    // Try with a different action
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'intimacy:break_kiss_gently',
      targetId: scenario.target.id,
      originalInput: 'break_kiss_gently',
    });

    // Should not have any perceptible events from our rule
    testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
  });

  it('validates complete event flow sequence', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: false,
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: true,
    };

    testFixture.reset([scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const eventTypes = testFixture.events.map((e) => e.eventType);
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );

    // Verify order: perceptible -> success -> turn_ended
    const perceptibleIndex = eventTypes.indexOf('core:perceptible_event');
    const successIndex = eventTypes.indexOf(
      'core:display_successful_action_result'
    );
    const turnEndedIndex = eventTypes.indexOf('core:turn_ended');

    expect(perceptibleIndex).toBeLessThan(successIndex);
    expect(successIndex).toBeLessThan(turnEndedIndex);
  });

  it('works with different entity names and locations', async () => {
    const scenario = testFixture.createCloseActors(['Emily', 'Michael'], {
      location: 'park_bench',
    });

    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: false,
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: true,
    };

    testFixture.reset([scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Emily has returned Michael's kiss passionately."
    );
    expect(perceptibleEvent.payload.locationId).toBe('park_bench');

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent.payload.message).toBe(
      "Emily returns Michael's kiss passionately."
    );
  });

  it('demonstrates passionate vs passive messaging difference', async () => {
    const scenario = testFixture.createCloseActors(['Sophia', 'David'], {
      location: 'balcony',
    });

    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: false,
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: true,
    };

    testFixture.reset([scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.descriptionText).toContain('returned');
    expect(perceptibleEvent.payload.descriptionText).toContain('passionately');

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent.payload.message).toContain('returns');
    expect(successEvent.payload.message).toContain('passionately');
  });
});
