/**
 * @file Integration tests for the kissing:kiss_neck_sensually action and rule.
 * @description Tests the rule execution after the kiss_neck_sensually action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import kissNeckSensuallyRule from '../../../../data/mods/kissing/rules/handle_kiss_neck_sensually.rule.json';
import eventIsActionKissNeckSensually from '../../../../data/mods/kissing/conditions/event-is-action-kiss-neck-sensually.condition.json';

describe('kissing:kiss_neck_sensually action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:kiss_neck_sensually',
      kissNeckSensuallyRule,
      eventIsActionKissNeckSensually
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes kiss neck sensually action between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toContain('neck');
  });

  it('validates perceptible event message matches action success message', async () => {
    const scenario = testFixture.createCloseActors(['Diana', 'Victor'], {
      location: 'library',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );

    expect(successEvent).toBeDefined();
    expect(perceptibleEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      perceptibleEvent.payload.descriptionText
    );
  });
});
