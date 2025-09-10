/**
 * @file Integration tests for the intimacy:massage_shoulders action and rule.
 * @description Tests the rule execution after the massage_shoulders action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import massageShouldersRule from '../../../../data/mods/intimacy/rules/handle_massage_shoulders.rule.json';
import eventIsActionMassageShoulders from '../../../../data/mods/intimacy/conditions/event-is-action-massage-shoulders.condition.json';

describe('intimacy:massage_shoulders action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:massage_shoulders',
      massageShouldersRule,
      eventIsActionMassageShoulders
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('performs massage shoulders action successfully', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Alice', 'Beth'],
      ['torso', 'arm', 'arm'],
      { location: 'room1' }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const eventTypes = testFixture.events.map((e) => e.eventType);
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );

    // Verify the massage text is in the perceptible event
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
  });

  it('does not fire rule for different action', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    const initialEventCount = testFixture.events.length;

    await testFixture.eventBus.dispatch('core:attempt_action', {
      actionId: 'core:wait',
      actorId: scenario.actor.id,
    });

    // Rule should not trigger for a different action
    const newEventCount = testFixture.events.length;
    expect(newEventCount).toBe(initialEventCount + 1); // Only the dispatched event
  });

  it('handles missing target gracefully', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    // This test verifies the rule handles missing entities gracefully
    await expect(async () => {
      await testFixture.eventBus.dispatch('core:attempt_action', {
        actionId: 'intimacy:massage_shoulders',
        actorId: scenario.actor.id,
        targetId: 'nonexistent',
      });
    }).not.toThrow();

    // With missing target, the rule should fail during GET_NAME operation
    // So only the initial attempt_action event should be present
    const eventTypes = testFixture.events.map((e) => e.eventType);
    expect(eventTypes).toEqual(['core:attempt_action']);
  });

  it('executes action with partner without arms', async () => {
    // This tests the edge case where the partner has no arms
    const scenario = testFixture.createCloseActors(['Alice', 'Carl'], {
      location: 'room1',
    });

    // Add anatomy components manually for Carl without arms
    scenario.target.components['anatomy:body'] = {
      body: { root: 'torso2' },
    };
    const torsoEntity = {
      id: 'torso2',
      components: {
        'anatomy:part': {
          parent: null,
          children: [], // No arms
          subType: 'torso',
        },
      },
    };

    testFixture.reset([scenario.actor, scenario.target, torsoEntity]);

    // The rule should still execute even if the scope wouldn't normally allow this
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const eventTypes = testFixture.events.map((e) => e.eventType);
    expect(eventTypes).toContain('core:perceptible_event');
  });
});
