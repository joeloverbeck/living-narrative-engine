/**
 * @file Integration tests for the caressing:run_thumb_across_lips action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import runThumbAcrossLipsRule from '../../../../data/mods/caressing/rules/run_thumb_across_lips.rule.json';
import eventIsActionRunThumbAcrossLips from '../../../../data/mods/caressing/conditions/event-is-action-run-thumb-across-lips.condition.json';

describe('caressing:run_thumb_across_lips action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'caressing',
      'caressing:run_thumb_across_lips',
      runThumbAcrossLipsRule,
      eventIsActionRunThumbAcrossLips
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes run thumb across lips action', async () => {
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
