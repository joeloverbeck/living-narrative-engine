/**
 * @file Integration tests for the intimacy:thumb_wipe_cheek rule.
 * @see tests/integration/rules/intimacy/thumbWipeCheekRule.integration.test.js
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';
import thumbWipeCheekRule from '../../../../../data/mods/intimacy/rules/thumb_wipe_cheek.rule.json';
import eventIsActionThumbWipeCheek from '../../../../../data/mods/intimacy/conditions/event-is-action-thumb-wipe-cheek.condition.json';

describe('intimacy_handle_thumb_wipe_cheek rule integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forRule(
      'intimacy',
      'intimacy:thumb_wipe_cheek',
      thumbWipeCheekRule,
      eventIsActionThumbWipeCheek
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('performs thumb wipe cheek action successfully', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Beth']);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    // Check that expected events were generated
    const eventTypes = testFixture.events.map((e) => e.eventType);
    expect(eventTypes).toContain('core:perceptible_event');
    expect(eventTypes).toContain('core:display_successful_action_result');
    expect(eventTypes).toContain('core:turn_ended');

    // Verify the perceptible event content
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
  });
});
