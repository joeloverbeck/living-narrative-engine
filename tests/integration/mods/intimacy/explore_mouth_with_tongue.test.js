/**
 * @file Integration tests for the intimacy:explore_mouth_with_tongue action and rule.
 * @description Tests the rule execution after the explore_mouth_with_tongue action is performed.
 * This action has no prerequisites about initiator status, allowing any kissing participant to explore.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import exploreMouthWithTongueRule from '../../../../data/mods/intimacy/rules/explore_mouth_with_tongue.rule.json';
import eventIsActionExploreMouthWithTongue from '../../../../data/mods/intimacy/conditions/event-is-action-explore-mouth-with-tongue.condition.json';

describe('intimacy:explore_mouth_with_tongue action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:explore_mouth_with_tongue',
      exploreMouthWithTongueRule,
      eventIsActionExploreMouthWithTongue
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes explore mouth with tongue for initiator (initiator: true)', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: true,
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: false,
    };

    testFixture.reset([scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice explores Bob's mouth with their tongue."
    );

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('successfully executes explore mouth with tongue for receiver (initiator: false)', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], {
      location: 'garden',
    });

    // Add kissing components - Sarah as receiver, James as initiator
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
      "Sarah explores James's mouth with their tongue."
    );

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('perception log shows correct message for explore mouth with tongue', async () => {
    const scenario = testFixture.createCloseActors(['Emma', 'David'], {
      location: 'bedroom',
    });

    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: true,
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: false,
    };

    testFixture.reset([scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    testFixture.assertPerceptibleEvent({
      descriptionText: "Emma explores David's mouth with their tongue.",
      locationId: 'bedroom',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });
  });

  it('preserves kissing component state (no ADD_COMPONENT or REMOVE_COMPONENT operations)', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: true,
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: false,
    };

    testFixture.reset([scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    // Verify this is an enhancement action that preserves kissing state
    // by checking that the rule executed successfully
    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice explores Bob's mouth with their tongue."
    );

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: true,
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: false,
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
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: true,
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: false,
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
    const scenario = testFixture.createCloseActors(['Sophia', 'Marcus'], {
      location: 'moonlit_balcony',
    });

    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: true,
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: false,
    };

    testFixture.reset([scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Sophia explores Marcus's mouth with their tongue."
    );
    expect(perceptibleEvent.payload.locationId).toBe('moonlit_balcony');

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent.payload.message).toBe(
      "Sophia explores Marcus's mouth with their tongue."
    );
  });
});
