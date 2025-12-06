/**
 * @file Integration tests for the affection:place_hand_on_knee action and rule.
 * @description Verifies successful execution, perception metadata, and guard conditions for the knee placement action.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import placeHandOnKneeRule from '../../../../data/mods/affection/rules/place_hand_on_knee.rule.json';
import eventIsActionPlaceHandOnKnee from '../../../../data/mods/affection/conditions/event-is-action-place-hand-on-knee.condition.json';

const ACTION_ID = 'affection:place_hand_on_knee';
const EXPECTED_SENTENCE = "{actor} places a hand on {target}'s knee.";

describe('affection:place_hand_on_knee action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      ACTION_ID,
      placeHandOnKneeRule,
      eventIsActionPlaceHandOnKnee
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

  const createSeatedScenario = (actorName, targetName, locationId) => {
    const location = locationId || 'room1';
    const scenario = testFixture.createSittingPair({
      locationId: location,
      roomId: location,
      roomName: `${location} room`,
      seatedActors: [
        { id: 'actor1', name: actorName, spotIndex: 0, locationId: location },
        { id: 'actor2', name: targetName, spotIndex: 1, locationId: location },
      ],
    });

    const [actor, target] = scenario.seatedActors;
    return { actor, target };
  };

  it('produces matching success and perceptible messages with correct metadata', async () => {
    const scenario = createSeatedScenario('Alice', 'Bob', 'garden_patio');

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
      locationId: 'garden_patio',
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

  it('propagates location, target, and perception metadata exactly as configured', async () => {
    const scenario = createSeatedScenario('Serena', 'Miguel', 'sunroom');

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = findPerceptibleEvent();
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      EXPECTED_SENTENCE.replace('{actor}', 'Serena').replace(
        '{target}',
        'Miguel'
      )
    );
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
    expect(perceptibleEvent.payload.locationId).toBe('sunroom');
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
  });

  it('does not fire when a different affection action is attempted', async () => {
    const scenario = createSeatedScenario('Tina', 'Ravi', 'lounge');

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
