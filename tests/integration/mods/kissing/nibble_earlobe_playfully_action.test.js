/**
 * @file Integration tests for the kissing:nibble_earlobe_playfully action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import nibbleEarlobePlayfullyRule from '../../../../data/mods/kissing/rules/handle_nibble_earlobe_playfully.rule.json';
import eventIsActionNibbleEarlobePlayfully from '../../../../data/mods/kissing/conditions/event-is-action-nibble-earlobe-playfully.condition.json';
import nibbleEarlobePlayfullyAction from '../../../../data/mods/kissing/actions/nibble_earlobe_playfully.action.json';

describe('kissing:nibble_earlobe_playfully action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:nibble_earlobe_playfully',
      nibbleEarlobePlayfullyRule,
      eventIsActionNibbleEarlobePlayfully
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes nibble earlobe playfully action between close actors', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Alice', 'Bob'],
      ['torso', 'ear'],
      { location: 'room1' }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
  });

  it('validates perceptible event message matches action success message', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Diana', 'Victor'],
      ['torso', 'ear'],
      { location: 'library' }
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

  it('is not available when the target lacks an ear body part', () => {
    const scenario = testFixture.createCloseActors(['Sam', 'Taylor'], {
      location: 'studio',
    });

    testFixture.testEnv.actionIndex.buildIndex([nibbleEarlobePlayfullyAction]);

    const availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    const ids = availableActions.map((action) => action.id);

    expect(ids).not.toContain('kissing:nibble_earlobe_playfully');
  });
});
