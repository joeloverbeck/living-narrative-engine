/**
 * @file Integration tests for the intimacy:place_hand_on_waist rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';
import JsonLogicEvaluationService from '../../../../../src/logic/jsonLogicEvaluationService.js';
import placeHandOnWaistRule from '../../../../../data/mods/intimacy/rules/place_hand_on_waist.rule.json';
import eventIsActionPlaceHandOnWaist from '../../../../../data/mods/intimacy/conditions/event-is-action-place-hand-on-waist.condition.json';

describe('handle_place_hand_on_waist rule integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forRule(
      'intimacy',
      'intimacy:place_hand_on_waist',
      placeHandOnWaistRule,
      eventIsActionPlaceHandOnWaist
    );
  });

  afterEach(async () => {
    if (testFixture) {
      await testFixture.cleanup();
    }
  });

  it('condition evaluates correctly', () => {
    // Test that the condition works correctly
    const condition = eventIsActionPlaceHandOnWaist.logic;
    const jsonLogicService = new JsonLogicEvaluationService({
      logger: testFixture.logger,
    });

    // Check what the condition expects
    expect(condition).toEqual({
      '==': [{ var: 'event.payload.actionId' }, 'intimacy:place_hand_on_waist'],
    });

    // The event structure for attempt_action events
    const matchingData = {
      event: {
        payload: {
          actionId: 'intimacy:place_hand_on_waist',
        },
      },
    };

    expect(jsonLogicService.evaluate(condition, matchingData)).toBe(true);

    // Should not match when actionId is different
    const nonMatchingData = {
      event: {
        payload: {
          actionId: 'intimacy:different_action',
        },
      },
    };
    expect(jsonLogicService.evaluate(condition, nonMatchingData)).toBe(false);
  });

  it('performs place hand on waist action successfully', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Beth']);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

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
      "Alice places a hand on Beth's waist in an intimate gesture."
    );
  });

  it('rule does not fire for different action', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Beth']);

    // Use testRuleDoesNotTrigger for different action
    await testFixture.testRuleDoesNotTrigger(
      scenario.actor.id,
      'intimacy:different_action',
      scenario.target.id
    );

    const types = testFixture.events.map((e) => e.eventType);
    expect(types).not.toContain('core:perceptible_event');
    expect(types).not.toContain('core:display_successful_action_result');
    expect(types).not.toContain('core:turn_ended');
  });

  it('works with multiple actors in location', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Beth']);

    // Add an observer in the same location
    testFixture.entityManager.createEntity('observer1');
    testFixture.entityManager.addComponent('observer1', 'core:name', {
      text: 'Charlie',
    });
    testFixture.entityManager.addComponent('observer1', 'core:position', {
      locationId: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.locationId).toBe('room1');
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
  });

  it('works with different actor and target names', async () => {
    const scenario = testFixture.createCloseActors(['John', 'Mary']);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "John places a hand on Mary's waist in an intimate gesture."
    );
  });
});
