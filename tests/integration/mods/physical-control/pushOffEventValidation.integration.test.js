/**
 * @file Integration test to verify that the push_off action properly validates the closeness_with_target_broken event
 * @see src/logic/operationHandlers/breakClosenessWithTargetHandler.js
 * @description This test ensures that the personal-space:closeness_with_target_broken event
 * definition exists and can be validated without warnings.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import pushOffRule from '../../../../data/mods/physical-control/rules/handle_push_off.rule.json';
import eventIsActionPushOff from '../../../../data/mods/physical-control/conditions/event-is-action-push-off.condition.json';

describe('Push Off Action - Event Validation Integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'physical-control',
      'physical-control:push_off',
      pushOffRule,
      eventIsActionPushOff
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should not produce validation warnings for closeness_with_target_broken event', async () => {
    // Arrange - Create actors with closeness
    const scenario = testFixture.createCloseActors(['Alice', 'Beth']);

    // Clear any startup warnings from logger
    testFixture.logger.warn.mockClear();

    // Act - Execute the push off action
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    // Assert - Check that no "EventDefinition not found" warnings were logged
    const validationWarnings = testFixture.logger.warn.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('EventDefinition not found') &&
        call[0].includes('personal-space:closeness_with_target_broken')
    );

    // Log any warnings found for debugging
    if (validationWarnings.length > 0) {
      console.log('Unexpected validation warnings:', validationWarnings);
    }

    expect(validationWarnings).toHaveLength(0);
  });
});
