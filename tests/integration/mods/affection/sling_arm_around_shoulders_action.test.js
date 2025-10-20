/**
 * @file Integration tests for the affection:sling_arm_around_shoulders action and rule.
 * @description Tests the rule execution after the sling_arm_around_shoulders action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import slingArmAroundShouldersRule from '../../../../data/mods/affection/rules/sling_arm_around_shoulders.rule.json';
import eventIsActionSlingArmAroundShoulders from '../../../../data/mods/affection/conditions/event-is-action-sling-arm-around-shoulders.condition.json';

describe('affection:sling_arm_around_shoulders action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      'affection:sling_arm_around_shoulders',
      slingArmAroundShouldersRule,
      eventIsActionSlingArmAroundShoulders
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes sling arm around shoulders action between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toContain('arm');
    expect(successEvent.payload.message).toContain('shoulder');
  });

  it('handles multiple close actors correctly', async () => {
    const scenario = testFixture.createMultiActorScenario(
      ['Alice', 'Bob', 'Charlie'],
      {
        location: 'room1',
      }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
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

    // Both should have the same descriptive message
    expect(successEvent.payload.message).toBe(
      perceptibleEvent.payload.descriptionText
    );
  });
});
