/**
 * @file Integration tests for the affection:rest_head_on_shoulder action and rule.
 * @description Tests the rule execution after the rest_head_on_shoulder action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import handleRestHeadOnShoulderRule from '../../../../data/mods/affection/rules/handle_rest_head_on_shoulder.rule.json';
import eventIsActionRestHeadOnShoulder from '../../../../data/mods/affection/conditions/event-is-action-rest-head-on-shoulder.condition.json';

const EXPECTED_SENTENCE =
  "{actor} leans their head against {target}'s shoulder for comfort.";

describe('affection:rest_head_on_shoulder action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      'affection:rest_head_on_shoulder',
      handleRestHeadOnShoulderRule,
      eventIsActionRestHeadOnShoulder
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

  it('successfully executes rest head on shoulder between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'living_room',
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
      locationId: 'living_room',
      perceptionType: 'physical.target_action',
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

  it('formats message correctly with different names', async () => {
    const scenario = testFixture.createCloseActors(
      ['Sir Lancelot', 'Lady Guinevere'],
      {
        location: 'castle_hall',
      }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = findSuccessMessage();
    expect(successEvent.payload.message).toBe(
      EXPECTED_SENTENCE.replace('{actor}', 'Sir Lancelot').replace(
        '{target}',
        'Lady Guinevere'
      )
    );
  });

  it('emits perceptible event with correct metadata', async () => {
    const scenario = testFixture.createCloseActors(['Elena', 'Marcus'], {
      location: 'garden',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = findPerceptibleEvent();
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'physical.target_action'
    );
    expect(perceptibleEvent.payload.locationId).toBe('garden');
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
    expect(perceptibleEvent.payload.actorId).toBe(scenario.actor.id);
    expect(perceptibleEvent.payload.descriptionText).toBe(
      EXPECTED_SENTENCE.replace('{actor}', 'Elena').replace(
        '{target}',
        'Marcus'
      )
    );
  });

  it('action only fires for the correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'hugging:hug_tight',
      targetId: scenario.target.id,
      originalInput: 'hug_tight target',
    });

    const perceptibleEvent = findPerceptibleEvent();
    if (perceptibleEvent) {
      expect(perceptibleEvent.payload.descriptionText).not.toContain(
        'leans their head against'
      );
    }

    const successEvent = findSuccessMessage();
    expect(successEvent).toBeUndefined();
  });
});
