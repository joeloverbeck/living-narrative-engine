/**
 * @file Integration tests for the kissing:lean_in_for_deep_kiss action and rule.
 * @description Tests the rule execution after the lean_in_for_deep_kiss action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import leanInForDeepKissRule from '../../../../data/mods/kissing/rules/lean_in_for_deep_kiss.rule.json';
import eventIsActionLeanInForDeepKiss from '../../../../data/mods/kissing/conditions/event-is-action-lean-in-for-deep-kiss.condition.json';

describe('kissing:lean_in_for_deep_kiss action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:lean_in_for_deep_kiss',
      leanInForDeepKissRule,
      eventIsActionLeanInForDeepKiss
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully initiates deep kiss between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'bedroom',
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

  it('generates correct perceptible event for kiss initiation', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'bedroom',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
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

    // Both should have the same descriptive message
    expect(successEvent.payload.message).toBe(
      perceptibleEvent.payload.descriptionText
    );
  });
});
