/**
 * @file Integration tests for the intimacy:nuzzle_face_into_neck action and rule.
 * @description Tests the rule execution after the nuzzle_face_into_neck action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import nuzzleFaceIntoNeckRule from '../../../../data/mods/intimacy/rules/nuzzle_face_into_neck.rule.json';
import eventIsActionNuzzleFaceIntoNeck from '../../../../data/mods/intimacy/conditions/event-is-action-nuzzle-face-into-neck.condition.json';

describe('intimacy:nuzzle_face_into_neck action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:nuzzle_face_into_neck',
      nuzzleFaceIntoNeckRule,
      eventIsActionNuzzleFaceIntoNeck
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes nuzzle face into neck action between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    testFixture.assertActionSuccess(
      "Alice nuzzles their face into Bob's neck."
    );
  });

  it('perception log shows correct message for nuzzle face into neck action', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], {
      location: 'garden',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    testFixture.assertPerceptibleEvent({
      descriptionText: "Sarah nuzzles their face into James's neck.",
      locationId: 'garden',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });
  });

  it('handles multiple close partners correctly', async () => {
    const scenario = testFixture.createMultiActorScenario(
      ['Alice', 'Bob', 'Charlie'],
      { location: 'room1' }
    );

    // First nuzzle Bob's neck
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent1 = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent1.payload.descriptionText).toBe(
      "Alice nuzzles their face into Bob's neck."
    );

    // Clear events for the next test
    testFixture.clearEvents();

    // Then nuzzle Charlie's neck
    await testFixture.executeAction(
      scenario.actor.id,
      scenario.observers[0].id
    );

    const perceptibleEvent2 = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent2.payload.descriptionText).toBe(
      "Alice nuzzles their face into Charlie's neck."
    );
  });

  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    // Try with a different action - manually dispatch different actionId
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'intimacy:place_hand_on_waist',
      targetId: scenario.target.id,
      originalInput: 'place_hand_on_waist ' + scenario.target.id,
    });

    // Should not have any perceptible events from our rule
    const perceptibleEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents).toHaveLength(0);
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
      "Elena nuzzles their face into Marcus's neck."
    );
    expect(perceptibleEvent.payload.involvedEntities).toEqual([]);
  });
});
