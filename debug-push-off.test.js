/**
 * Debug test for push_off MODIFY_ARRAY_FIELD issue
 */

import { describe, it, beforeEach, expect } from '@jest/globals';
import { ModTestFixture } from './tests/common/mods/ModTestFixture.js';
import pushOffRule from './data/mods/physical-control/rules/handle_push_off.rule.json' assert { type: 'json' };
import eventIsActionPushOff from './data/mods/physical-control/conditions/event-is-action-push-off.condition.json' assert { type: 'json' };

describe('Debug Push Off MODIFY_ARRAY_FIELD', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'physical-control',
      'physical-control:push_off',
      pushOffRule,
      eventIsActionPushOff
    );
  });

  it('debug array modification', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    console.log('=== BEFORE ACTION ===');
    console.log('Actor ID:', scenario.actor.id);
    console.log('Target ID:', scenario.target.id);

    const actorBefore = testFixture.entityManager.getEntityInstance(scenario.actor.id);
    console.log('Actor closeness BEFORE:', JSON.stringify(actorBefore.components['positioning:closeness']));

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    console.log('=== AFTER ACTION ===');
    const actorAfter = testFixture.entityManager.getEntityInstance(scenario.actor.id);
    console.log('Actor closeness AFTER:', JSON.stringify(actorAfter.components['positioning:closeness']));

    expect(actorAfter.components['positioning:closeness']).toBeUndefined();
  });
});
