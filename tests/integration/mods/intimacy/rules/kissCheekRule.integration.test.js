/**
 * @file Integration tests for the intimacy:kiss_cheek rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';
import kissCheekRule from '../../../../../data/mods/intimacy/rules/kiss_cheek.rule.json';
import eventIsActionKissCheek from '../../../../../data/mods/intimacy/conditions/event-is-action-kiss-cheek.condition.json';

describe('intimacy_handle_kiss_cheek rule integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forRule(
      'intimacy',
      'intimacy:kiss_cheek',
      kissCheekRule,
      eventIsActionKissCheek
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('performs kiss cheek action successfully', async () => {
    const scenario = testFixture.createCloseActors(['Actor', 'Target'], {
      location: 'room1'
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const types = testFixture.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });
});
