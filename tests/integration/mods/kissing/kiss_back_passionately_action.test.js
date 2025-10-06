/**
 * @file Integration tests for the kissing:kiss_back_passionately action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import kissBackPassionatelyRule from '../../../../data/mods/kissing/rules/kiss_back_passionately.rule.json';
import eventIsActionKissBackPassionately from '../../../../data/mods/kissing/conditions/event-is-action-kiss-back-passionately.condition.json';

describe('kissing:kiss_back_passionately action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:kiss_back_passionately',
      kissBackPassionatelyRule,
      eventIsActionKissBackPassionately
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes kiss back passionately action between close actors', async () => {
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
