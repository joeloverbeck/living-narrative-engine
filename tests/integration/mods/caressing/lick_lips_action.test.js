/**
 * @file Integration tests for the caressing:lick_lips action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import lickLipsRule from '../../../../data/mods/caressing/rules/lick_lips.rule.json';
import eventIsActionLickLips from '../../../../data/mods/caressing/conditions/event-is-action-lick-lips.condition.json';
import lickLipsAction from '../../../../data/mods/caressing/actions/lick_lips.action.json';

describe('caressing:lick_lips action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'caressing',
      'caressing:lick_lips',
      lickLipsRule,
      eventIsActionLickLips
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes lick lips action', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Alice', 'Bob'],
      ['torso', 'mouth'],
      {
        location: 'room1',
      }
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
      ['torso', 'mouth'],
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

  it('is not available when the target lacks a mouth body part', () => {
    const scenario = testFixture.createCloseActors(['Ivy', 'Jonas'], {
      location: 'kitchen',
    });

    testFixture.testEnv.actionIndex.buildIndex([lickLipsAction]);

    const availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    const ids = availableActions.map((action) => action.id);

    expect(ids).not.toContain('caressing:lick_lips');
  });
});
