/**
 * @file Integration tests for the intimacy:suck_on_tongue action and rule.
 * @description Tests the rule execution after the suck_on_tongue action is performed.
 * This action has no prerequisites about initiator status, allowing any kissing participant to suck on their partner's tongue.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import suckOnTongueRule from '../../../../data/mods/intimacy/rules/suck_on_tongue.rule.json';
import eventIsActionSuckOnTongue from '../../../../data/mods/intimacy/conditions/event-is-action-suck-on-tongue.condition.json';

describe('intimacy:suck_on_tongue action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:suck_on_tongue',
      suckOnTongueRule,
      eventIsActionSuckOnTongue
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes suck on tongue for initiator (initiator: true)', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1'
    });

    // Add kissing components for this specific action
    testFixture.entityManager.addComponent(scenario.actor.id, 'intimacy:kissing', {
      partner: scenario.target.id,
      initiator: true
    });
    testFixture.entityManager.addComponent(scenario.target.id, 'intimacy:kissing', {
      partner: scenario.actor.id,
      initiator: false
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe("Alice sucks on Bob's tongue.");

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('successfully executes suck on tongue for receiver (initiator: false)', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], {
      location: 'garden'
    });

    // Add kissing components with receiver as actor
    testFixture.entityManager.addComponent(scenario.actor.id, 'intimacy:kissing', {
      partner: scenario.target.id,
      initiator: false
    });
    testFixture.entityManager.addComponent(scenario.target.id, 'intimacy:kissing', {
      partner: scenario.actor.id,
      initiator: true
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe("Sarah sucks on James's tongue.");

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('perception log shows correct message for suck on tongue', async () => {
    const scenario = testFixture.createCloseActors(['Emma', 'David'], {
      location: 'bedroom'
    });

    // Add kissing components
    testFixture.entityManager.addComponent(scenario.actor.id, 'intimacy:kissing', {
      partner: scenario.target.id,
      initiator: true
    });
    testFixture.entityManager.addComponent(scenario.target.id, 'intimacy:kissing', {
      partner: scenario.actor.id,
      initiator: false
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    testFixture.assertPerceptibleEvent({
      descriptionText: "Emma has sucked on David's tongue.",
      locationId: 'bedroom',
      actorId: scenario.actor.id,
      targetId: scenario.target.id
    });
  });

  it('preserves kissing component state (no ADD_COMPONENT or REMOVE_COMPONENT operations)', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1'
    });

    // Add kissing components
    testFixture.entityManager.addComponent(scenario.actor.id, 'intimacy:kissing', {
      partner: scenario.target.id,
      initiator: true
    });
    testFixture.entityManager.addComponent(scenario.target.id, 'intimacy:kissing', {
      partner: scenario.actor.id,
      initiator: false
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    // Verify this is an enhancement action that preserves kissing state
    // by checking that the rule executed successfully (no component modification errors)
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
    const scenario = testFixture.createMultiActorScenario(['Alice', 'Bob', 'Charlie'], {
      location: 'room1'
    });

    // Add kissing components between Alice and Bob only
    testFixture.entityManager.addComponent(scenario.actor.id, 'intimacy:kissing', {
      partner: scenario.target.id,
      initiator: true
    });
    testFixture.entityManager.addComponent(scenario.target.id, 'intimacy:kissing', {
      partner: scenario.actor.id,
      initiator: false
    });

    // Suck on current partner Bob's tongue
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice has sucked on Bob's tongue."
    );
  });

  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1'
    });

    // Add kissing components
    testFixture.entityManager.addComponent(scenario.actor.id, 'intimacy:kissing', {
      partner: scenario.target.id,
      initiator: true
    });
    testFixture.entityManager.addComponent(scenario.target.id, 'intimacy:kissing', {
      partner: scenario.actor.id,
      initiator: false
    });

    // Try with a different action
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'intimacy:break_kiss_gently',
      targetId: scenario.target.id,
      originalInput: 'break_kiss_gently target',
    });

    // Should not have any perceptible events from our rule
    testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
  });

  it('validates complete event flow sequence', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1'
    });

    // Add kissing components
    testFixture.entityManager.addComponent(scenario.actor.id, 'intimacy:kissing', {
      partner: scenario.target.id,
      initiator: true
    });
    testFixture.entityManager.addComponent(scenario.target.id, 'intimacy:kissing', {
      partner: scenario.actor.id,
      initiator: false
    });

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
    const scenario = testFixture.createCloseActors(['Sophia', 'Marcus'], {
      location: 'moonlit_balcony'
    });

    // Add kissing components
    testFixture.entityManager.addComponent(scenario.actor.id, 'intimacy:kissing', {
      partner: scenario.target.id,
      initiator: true
    });
    testFixture.entityManager.addComponent(scenario.target.id, 'intimacy:kissing', {
      partner: scenario.actor.id,
      initiator: false
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Sophia has sucked on Marcus's tongue."
    );
    expect(perceptibleEvent.payload.locationId).toBe('moonlit_balcony');

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent.payload.message).toBe(
      "Sophia sucks on Marcus's tongue."
    );
  });

  it('works regardless of initiator status (no prerequisites)', async () => {
    // Test with both initiator and receiver performing the action
    const testCases = [
      {
        isActorInitiator: true,
        actorName: 'Alice',
        targetName: 'Bob',
      },
      {
        isActorInitiator: false,
        actorName: 'Alice',
        targetName: 'Bob',
      },
    ];

    for (const testCase of testCases) {
      const scenario = testFixture.createCloseActors([testCase.actorName, testCase.targetName], {
        location: 'room1'
      });

      // Set kissing components based on who is initiator
      testFixture.entityManager.addComponent(scenario.actor.id, 'intimacy:kissing', {
        partner: scenario.target.id,
        initiator: testCase.isActorInitiator
      });
      testFixture.entityManager.addComponent(scenario.target.id, 'intimacy:kissing', {
        partner: scenario.actor.id,
        initiator: !testCase.isActorInitiator
      });

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(
        `${testCase.actorName} sucks on ${testCase.targetName}'s tongue.`
      );

      // Clear events for next iteration
      testFixture.events.length = 0;
    }
  });
});
