/**
 * @file Integration tests for the affection:squeeze_hand_reassuringly action and rule.
 * @description Verifies the reassuring hand squeeze action produces the expected narrative output.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import handleSqueezeHandReassuringlyRule from '../../../../data/mods/affection/rules/handle_squeeze_hand_reassuringly.rule.json';
import eventIsActionSqueezeHandReassuringly from '../../../../data/mods/affection/conditions/event-is-action-squeeze-hand-reassuringly.condition.json';

const ACTION_ID = 'affection:squeeze_hand_reassuringly';

describe('affection:squeeze_hand_reassuringly action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      ACTION_ID,
      handleSqueezeHandReassuringlyRule,
      eventIsActionSqueezeHandReassuringly
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

    const expectedMessage = "Amelia squeezes Jonah's hand reassuringly.";
    expect(successEvent.payload.message).toBe(expectedMessage);
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
    expect(perceptibleEvent.payload.locationId).toBe('garden');
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
  });
});
