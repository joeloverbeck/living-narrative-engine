/**
 * @file Integration tests for the affection:place_hands_on_shoulders action and rule.
 * @description Verifies successful execution, perception metadata, and guard conditions for the shoulders placement action.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import placeHandsOnShouldersRule from '../../../../data/mods/affection/rules/place_hands_on_shoulders.rule.json';
import eventIsActionPlaceHandsOnShoulders from '../../../../data/mods/affection/conditions/event-is-action-place-hands-on-shoulders.condition.json';

const ACTION_ID = 'affection:place_hands_on_shoulders';
const EXPECTED_SENTENCE = "{actor} places their hands on {target}'s shoulders.";

describe('affection:place_hands_on_shoulders action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      ACTION_ID,
      placeHandsOnShouldersRule,
      eventIsActionPlaceHandsOnShoulders
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  const findSuccessMessage = () =>
    testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );

  const findPerceptibleEvent = () =>
    testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

  it('produces matching success and perceptible messages with proper metadata', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'sunroom',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = findSuccessMessage();
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      EXPECTED_SENTENCE.replace('{actor}', 'Alice').replace('{target}', 'Bob')
    );

    testFixture.assertPerceptibleEvent({
      descriptionText: EXPECTED_SENTENCE.replace('{actor}', 'Alice').replace(
        '{target}',
        'Bob'
      ),
      locationId: 'sunroom',
      perceptionType: 'action_target_general',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });

    const turnEndedEvent = testFixture.events.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.entityId).toBe(scenario.actor.id);
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('formats messages correctly with different names', async () => {
    const scenario = testFixture.createCloseActors(['Serena', 'Miguel'], {
      location: 'balcony',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = findSuccessMessage();
    expect(successEvent.payload.message).toBe(
      EXPECTED_SENTENCE.replace('{actor}', 'Serena').replace(
        '{target}',
        'Miguel'
      )
    );

    const perceptibleEvent = findPerceptibleEvent();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      EXPECTED_SENTENCE.replace('{actor}', 'Serena').replace(
        '{target}',
        'Miguel'
      )
    );
  });

  it('does not fire when a different action is attempted', async () => {
    const scenario = testFixture.createCloseActors(['Tina', 'Ravi'], {
      location: 'lounge',
    });

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'affection:place_hand_on_waist',
      targetId: scenario.target.id,
      originalInput: 'place_hand_on_waist target',
    });

    const successEvent = findSuccessMessage();
    expect(successEvent).toBeUndefined();

    const perceptibleEvent = findPerceptibleEvent();
    if (perceptibleEvent) {
      expect(perceptibleEvent.payload.descriptionText).not.toBe(
        EXPECTED_SENTENCE.replace('{actor}', 'Tina').replace('{target}', 'Ravi')
      );
    }
  });
});
