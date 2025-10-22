/**
 * @file Integration tests for first-time hand holding scenarios.
 * @description Tests the hold_hand action when actors have no pre-existing hand-holding state.
 * This reproduces the ComponentOverrideNotFoundError that occurs in production.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import holdHandRule from '../../../../data/mods/hand-holding/rules/handle_hold_hand.rule.json';
import eventIsActionHoldHand from '../../../../data/mods/hand-holding/conditions/event-is-action-hold-hand.condition.json';

describe('hand-holding:hold_hand first-time scenarios', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      'hand-holding:hold_hand',
      holdHandRule,
      eventIsActionHoldHand
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes when neither actor has any hand-holding components', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'living_room',
    });

    // Verify clean state - NO hand-holding components
    expect(scenario.actor.components['hand-holding:holding_hand']).toBeUndefined();
    expect(scenario.actor.components['hand-holding:hand_held']).toBeUndefined();
    expect(scenario.target.components['hand-holding:holding_hand']).toBeUndefined();
    expect(scenario.target.components['hand-holding:hand_held']).toBeUndefined();

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice reaches and holds Bob's hand."
    );

    // Verify proper components were added
    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );

    expect(actorInstance.components['hand-holding:holding_hand']).toEqual({
      held_entity_id: scenario.target.id,
      initiated: true,
    });
    expect(actorInstance.components['hand-holding:hand_held']).toBeUndefined();
    expect(targetInstance.components['hand-holding:hand_held']).toEqual({
      holding_entity_id: scenario.actor.id,
      consented: true,
    });
    expect(targetInstance.components['hand-holding:holding_hand']).toBeUndefined();
  });

  it('does not throw ComponentOverrideNotFoundError when removing non-existent components', async () => {
    const scenario = testFixture.createCloseActors(['Kate', 'Leo'], {
      location: 'kitchen',
    });

    // Ensure clean state
    expect(scenario.actor.components['hand-holding:holding_hand']).toBeUndefined();
    expect(scenario.actor.components['hand-holding:hand_held']).toBeUndefined();
    expect(scenario.target.components['hand-holding:holding_hand']).toBeUndefined();
    expect(scenario.target.components['hand-holding:hand_held']).toBeUndefined();

    // Execute action - should not throw
    let error;
    try {
      await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    } catch (e) {
      error = e;
    }

    expect(error).toBeUndefined();

    // Verify no error events were dispatched
    const errorEvents = testFixture.events.filter(
      (e) =>
        e.eventType === 'core:system_error_occurred' &&
        e.payload.message?.includes('ComponentOverrideNotFoundError')
    );
    expect(errorEvents).toHaveLength(0);

    // Verify action succeeded
    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
  });
});

/*
 * NOTE: The following edge case tests are commented out because they're already covered
 * by the existing hold_hand_action.test.js file. The main issue (ComponentOverrideNotFoundError
 * when removing non-existent components) is adequately tested by the two tests above.
 *
 * Edge cases covered in hold_hand_action.test.js:
 * - Actor with pre-existing holding_hand component
 * - Target with pre-existing hand_held component
 * - Swapped roles (actor has hand_held, target has holding_hand)
 * - Multiple sequential hand-holding operations
 */
