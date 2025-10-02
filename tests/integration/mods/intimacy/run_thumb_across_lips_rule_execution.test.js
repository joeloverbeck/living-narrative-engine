/**
 * @file Integration tests for the intimacy:run_thumb_across_lips action and rule.
 * @description Tests the rule execution after the run_thumb_across_lips action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import runThumbAcrossLipsRule from '../../../../data/mods/intimacy/rules/run_thumb_across_lips.rule.json';
import eventIsActionRunThumbAcrossLips from '../../../../data/mods/intimacy/conditions/event-is-action-run-thumb-across-lips.condition.json';

describe('intimacy:run_thumb_across_lips action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:run_thumb_across_lips',
      runThumbAcrossLipsRule,
      eventIsActionRunThumbAcrossLips
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes run thumb across lips action between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice runs a thumb across Bob's lips."
    );

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  // eslint-disable-next-line jest/expect-expect -- Uses assertPerceptibleEvent helper
  it('perception log shows correct message for run thumb across lips action', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], {
      location: 'garden',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    testFixture.assertPerceptibleEvent({
      descriptionText: "Sarah runs a thumb across James's lips.",
      locationId: 'garden',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });
  });

  it('handles multiple close partners correctly', async () => {
    const scenario = testFixture.createMultiActorScenario([
      'Alice',
      'Bob',
      'Charlie',
    ]);

    // First run thumb across Bob's lips
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    let perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice runs a thumb across Bob's lips."
    );

    // Clear events for the next test
    testFixture.events.length = 0;

    // Then run thumb across Charlie's lips
    await testFixture.executeAction(
      scenario.actor.id,
      scenario.observers[0].id
    );

    perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice runs a thumb across Charlie's lips."
    );
  });

  // eslint-disable-next-line jest/expect-expect -- Uses assertOnlyExpectedEvents helper
  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Try with a different action
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'intimacy:peck_on_lips',
      targetId: scenario.target.id,
      originalInput: 'peck_on_lips target',
    });

    // Should not have any perceptible events from our rule
    testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
  });
});
