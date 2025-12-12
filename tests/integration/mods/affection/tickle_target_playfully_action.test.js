/**
 * @file Integration tests for the affection:tickle_target_playfully action and rule.
 * @description Verifies the playful tickling action produces the expected narrative output and event flow.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import handleTickleTargetPlayfullyRule from '../../../../data/mods/affection/rules/handle_tickle_target_playfully.rule.json';
import eventIsActionTickleTargetPlayfully from '../../../../data/mods/affection/conditions/event-is-action-tickle-target-playfully.condition.json';

const ACTION_ID = 'affection:tickle_target_playfully';

const EXPECTED_ALLOWED_EVENTS = [
  'core:attempt_action',
  'core:perceptible_event',
  'core:display_successful_action_result',
  'core:action_success',
  'core:turn_ended',
];

describe('affection:tickle_target_playfully action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      ACTION_ID,
      handleTickleTargetPlayfullyRule,
      eventIsActionTickleTargetPlayfully
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

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(successEvent).toBeDefined();
    expect(perceptibleEvent).toBeDefined();

    const expectedMessage = "Amelia drives a playful tickle up Jonah's sides.";
    expect(successEvent.payload.message).toBe(expectedMessage);
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'physical.target_action'
    );
    expect(perceptibleEvent.payload.locationId).toBe('garden');
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
    expect(perceptibleEvent.payload.actorId).toBe(scenario.actor.id);

    testFixture.assertOnlyExpectedEvents(EXPECTED_ALLOWED_EVENTS);
  });
});
