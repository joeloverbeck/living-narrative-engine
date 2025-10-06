/**
 * @file Integration tests for the kissing:suck_on_tongue action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import suckOnTongueRule from '../../../../data/mods/kissing/rules/suck_on_tongue.rule.json';
import eventIsActionSuckOnTongue from '../../../../data/mods/kissing/conditions/event-is-action-suck-on-tongue.condition.json';

describe('kissing:suck_on_tongue action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:suck_on_tongue',
      suckOnTongueRule,
      eventIsActionSuckOnTongue
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes suck on tongue action between close actors', async () => {
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
