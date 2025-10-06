/**
 * @file Integration tests for the kissing:nibble_lower_lip action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import nibbleLowerLipRule from '../../../../data/mods/kissing/rules/nibble_lower_lip.rule.json';
import eventIsActionNibbleLowerLip from '../../../../data/mods/kissing/conditions/event-is-action-nibble-lower-lip.condition.json';

describe('kissing:nibble_lower_lip action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:nibble_lower_lip',
      nibbleLowerLipRule,
      eventIsActionNibbleLowerLip
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes nibble lower lip action between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
  });
});
