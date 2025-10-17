/**
 * @file Integration tests reproducing hold_hand action bugs
 * @description These tests reproduce the ComponentOverrideNotFoundError that occurs
 * when executing hold_hand action when components don't exist on entities.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import holdHandRule from '../../../../data/mods/affection/rules/handle_hold_hand.rule.json';
import eventIsActionHoldHand from '../../../../data/mods/affection/conditions/event-is-action-hold-hand.condition.json';

const ACTION_ID = 'affection:hold_hand';

describe('hold_hand Action - Bug Reproduction', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      ACTION_ID,
      holdHandRule,
      eventIsActionHoldHand
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should execute hold_hand when no hand-holding components exist (first time)', async () => {
    // This test currently FAILS with ComponentOverrideNotFoundError
    // because the rule tries to remove components that don't exist

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Execute the hold_hand action
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    // Verify components were added
    const actorEntity = testFixture.entityManager.getEntityInstance(scenario.actor.id);
    const targetEntity = testFixture.entityManager.getEntityInstance(scenario.target.id);

    expect(actorEntity.components['affection:holding_hand']).toBeDefined();
    expect(targetEntity.components['affection:hand_held']).toBeDefined();

    const actorHoldingData = actorEntity.components['affection:holding_hand'];
    expect(actorHoldingData.held_entity_id).toBe(scenario.target.id);
    expect(actorHoldingData.initiated).toBe(true);

    const targetHandHeldData = targetEntity.components['affection:hand_held'];
    expect(targetHandHeldData.holding_entity_id).toBe(scenario.actor.id);
    expect(targetHandHeldData.consented).toBe(true);
  });

});
