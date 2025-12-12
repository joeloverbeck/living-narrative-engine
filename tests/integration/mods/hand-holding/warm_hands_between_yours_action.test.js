/**
 * @file Integration tests for the hand-holding:warm_hands_between_yours action and rule.
 * @description Verifies the hand warming action produces the expected narrative output.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import handleWarmHandsRule from '../../../../data/mods/hand-holding/rules/handle_warm_hands_between_yours.rule.json';
import eventIsActionWarmHands from '../../../../data/mods/hand-holding/conditions/event-is-action-warm-hands-between-yours.condition.json';

const ACTION_ID = 'hand-holding:warm_hands_between_yours';

describe('hand-holding:warm_hands_between_yours action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      ACTION_ID,
      handleWarmHandsRule,
      eventIsActionWarmHands
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('emits matching success and perceptible messages when executed', async () => {
    const scenario = testFixture.createCloseActors(['Amelia', 'Jonah'], {
      location: 'garden',
    });

    scenario.actor.components['hand-holding:holding_hand'] = {
      held_entity_id: scenario.target.id,
      initiated: true,
    };
    scenario.target.components['hand-holding:hand_held'] = {
      holding_entity_id: scenario.actor.id,
      consented: true,
    };

    const room = ModEntityScenarios.createRoom('garden', 'Garden');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(successEvent).toBeDefined();
    expect(perceptibleEvent).toBeDefined();

    const expectedMessage = "Amelia warms Jonah's hands between theirs.";
    expect(successEvent.payload.message).toBe(expectedMessage);
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'physical.target_action'
    );
    expect(perceptibleEvent.payload.locationId).toBe('garden');
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );

    expect(actorInstance.components['hand-holding:holding_hand']).toEqual({
      held_entity_id: scenario.target.id,
      initiated: true,
    });
    expect(targetInstance.components['hand-holding:hand_held']).toEqual({
      holding_entity_id: scenario.actor.id,
      consented: true,
    });
  });
});
