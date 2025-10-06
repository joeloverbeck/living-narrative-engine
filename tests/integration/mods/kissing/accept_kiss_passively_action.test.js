/**
 * @file Integration tests for the kissing:accept_kiss_passively action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import acceptKissPassivelyRule from '../../../../data/mods/kissing/rules/accept_kiss_passively.rule.json';
import eventIsActionAcceptKissPassively from '../../../../data/mods/kissing/conditions/event-is-action-accept-kiss-passively.condition.json';

describe('kissing:accept_kiss_passively action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:accept_kiss_passively',
      acceptKissPassivelyRule,
      eventIsActionAcceptKissPassively
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes accept kiss passively action between close actors', async () => {
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
