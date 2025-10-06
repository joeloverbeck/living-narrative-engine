/**
 * @file Integration tests for the caressing:nuzzle_face_into_neck action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import nuzzleFaceIntoNeckRule from '../../../../data/mods/caressing/rules/nuzzle_face_into_neck.rule.json';
import eventIsActionNuzzleFaceIntoNeck from '../../../../data/mods/caressing/conditions/event-is-action-nuzzle-face-into-neck.condition.json';

describe('caressing:nuzzle_face_into_neck action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'caressing',
      'caressing:nuzzle_face_into_neck',
      nuzzleFaceIntoNeckRule,
      eventIsActionNuzzleFaceIntoNeck
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes nuzzle face into neck action', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
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
    expect(successEvent.payload.message).toBe(
      perceptibleEvent.payload.descriptionText
    );
  });
});
