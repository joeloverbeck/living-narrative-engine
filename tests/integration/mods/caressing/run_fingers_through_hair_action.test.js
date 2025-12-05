/**
 * @file Integration tests for the caressing:run_fingers_through_hair action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import runFingersThroughHairRule from '../../../../data/mods/caressing/rules/handle_run_fingers_through_hair.rule.json';
import eventIsActionRunFingersThroughHair from '../../../../data/mods/caressing/conditions/event-is-action-run-fingers-through-hair.condition.json';
import runFingersThroughHairAction from '../../../../data/mods/caressing/actions/run_fingers_through_hair.action.json';

describe('caressing:run_fingers_through_hair action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'caressing',
      'caressing:run_fingers_through_hair',
      runFingersThroughHairRule,
      eventIsActionRunFingersThroughHair
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes run fingers through hair action', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Alice', 'Bob'],
      ['torso', 'hair'],
      {
        location: 'bedroom',
      }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toContain('hair');
  });

  it('validates perceptible event message matches action success message', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Diana', 'Victor'],
      ['torso', 'hair'],
      {
        location: 'library',
      }
    );

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

  it('is not available when the target lacks hair anatomy', () => {
    const scenario = testFixture.createCloseActors(['Hare', 'Chicken']);

    testFixture.testEnv.actionIndex.buildIndex([runFingersThroughHairAction]);

    const availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    const ids = availableActions.map((action) => action.id);

    expect(ids).not.toContain('caressing:run_fingers_through_hair');
  });
});
