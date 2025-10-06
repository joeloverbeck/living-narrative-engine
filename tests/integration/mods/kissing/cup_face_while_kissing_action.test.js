/**
 * @file Integration tests for the kissing:cup_face_while_kissing action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import cupFaceWhileKissingRule from '../../../../data/mods/kissing/rules/cup_face_while_kissing.rule.json';
import eventIsActionCupFaceWhileKissing from '../../../../data/mods/kissing/conditions/event-is-action-cup-face-while-kissing.condition.json';

describe('kissing:cup_face_while_kissing action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:cup_face_while_kissing',
      cupFaceWhileKissingRule,
      eventIsActionCupFaceWhileKissing
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes cup face while kissing action between close actors', async () => {
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
