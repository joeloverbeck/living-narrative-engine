/**
 * @file Integration tests for the intimacy:brush_hand action and rule.
 * @description Tests the rule execution after the brush_hand action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import brushHandRule from '../../../../data/mods/intimacy/rules/brush_hand.rule.json';
import eventIsActionBrushHand from '../../../../data/mods/intimacy/conditions/event-is-action-brush-hand.condition.json';

describe('intimacy:brush_hand action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:brush_hand',
      brushHandRule,
      eventIsActionBrushHand
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes brush hand action between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice brushes Bob's hand with their own."
    );

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('perception log shows correct message for brush hand action', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], {
      location: 'garden',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    testFixture.assertPerceptibleEvent({
      descriptionText: "Sarah brushes James's hand with their own.",
      locationId: 'garden',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });
  });

  it('handles multiple close partners correctly', async () => {
    const scenario = testFixture.createMultiActorScenario([
      'Alice',
      'Bob',
      'Charlie',
    ]);

    // First brush Bob's hand
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    let perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice brushes Bob's hand with their own."
    );

    // Clear events for the next test
    testFixture.events.length = 0;

    // Then brush Charlie's hand
    await testFixture.executeAction(
      scenario.actor.id,
      scenario.observers[0].id
    );

    perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice brushes Charlie's hand with their own."
    );
  });

  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Try with a different action
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'intimacy:place_hand_on_waist',
      targetId: scenario.target.id,
      originalInput: 'place_hand_on_waist target',
    });

    // Should not have any perceptible events from our rule
    testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
  });
});
