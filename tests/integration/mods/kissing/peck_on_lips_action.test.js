/**
 * @file Integration tests for the kissing:peck_on_lips action and rule.
 * @description Tests the rule execution after the peck_on_lips action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import peckOnLipsRule from '../../../../data/mods/kissing/rules/peck_on_lips.rule.json';
import eventIsActionPeckOnLips from '../../../../data/mods/kissing/conditions/event-is-action-peck-on-lips.condition.json';
import peckOnLipsAction from '../../../../data/mods/kissing/actions/peck_on_lips.action.json';

describe('kissing:peck_on_lips action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:peck_on_lips',
      peckOnLipsRule,
      eventIsActionPeckOnLips
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes peck on lips action between close actors', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Alice', 'Bob'],
      ['torso', 'mouth'],
      { location: 'room1' }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toContain('peck');
  });

  it('validates perceptible event message matches action success message', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Diana', 'Victor'],
      ['torso', 'mouth'],
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

  it('is not available when the target lacks a mouth body part', () => {
    const scenario = testFixture.createCloseActors(['Ivy', 'Jonas']);

    testFixture.testEnv.actionIndex.buildIndex([peckOnLipsAction]);

    const availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    const ids = availableActions.map((action) => action.id);

    expect(ids).not.toContain('kissing:peck_on_lips');
  });
});
