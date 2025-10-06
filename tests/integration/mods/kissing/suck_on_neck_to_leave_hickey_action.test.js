/**
 * @file Integration tests for the kissing:suck_on_neck_to_leave_hickey action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import suckOnNeckToLeaveHickeyRule from '../../../../data/mods/kissing/rules/handle_suck_on_neck_to_leave_hickey.rule.json';
import eventIsActionSuckOnNeckToLeaveHickey from '../../../../data/mods/kissing/conditions/event-is-action-suck-on-neck-to-leave-hickey.condition.json';

describe('kissing:suck_on_neck_to_leave_hickey action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:suck_on_neck_to_leave_hickey',
      suckOnNeckToLeaveHickeyRule,
      eventIsActionSuckOnNeckToLeaveHickey
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes suck on neck to leave hickey action between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
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
