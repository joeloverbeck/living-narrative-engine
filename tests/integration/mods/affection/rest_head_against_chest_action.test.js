/**
 * @file Integration tests for the affection:rest_head_against_chest action and rule.
 * @description Verifies the rule emits matching success and perceptible events while ending the actor's turn.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import handleRestHeadAgainstChestRule from '../../../../data/mods/affection/rules/handle_rest_head_against_chest.rule.json';
import eventIsActionRestHeadAgainstChest from '../../../../data/mods/affection/conditions/event-is-action-rest-head-against-chest.condition.json';

const ACTION_ID = 'affection:rest_head_against_chest';
const EXPECTED_MESSAGE =
  "{actor} rests their head against {primary}'s chest, between her breasts.";

describe('affection:rest_head_against_chest action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      ACTION_ID,
      handleRestHeadAgainstChestRule,
      eventIsActionRestHeadAgainstChest
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  const findSuccessEvent = () =>
    testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
  const findPerceptibleEvent = () =>
    testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

  it('executes successfully for close actors with breast anatomy', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Alice', 'Beth'],
      ['torso', 'breast', 'breast'],
      { location: 'intimate_corner' }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = findSuccessEvent();
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      EXPECTED_MESSAGE.replace('{actor}', 'Alice').replace('{primary}', 'Beth')
    );

    testFixture.assertPerceptibleEvent({
      descriptionText: EXPECTED_MESSAGE.replace('{actor}', 'Alice').replace(
        '{primary}',
        'Beth'
      ),
      locationId: 'intimate_corner',
      perceptionType: 'action_target_general',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });

    const turnEndedEvent = testFixture.events.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.entityId).toBe(scenario.actor.id);
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('formats the success message correctly for different names', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Serena', 'Valeria'],
      ['torso', 'breast', 'breast'],
      { location: 'balcony' }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = findSuccessEvent();
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      EXPECTED_MESSAGE.replace('{actor}', 'Serena').replace('{primary}', 'Valeria')
    );
  });

  it('emits perceptible metadata aligned with the success event', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Maya', 'Natalie'],
      ['torso', 'breast', 'breast'],
      { location: 'library_nook' }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = findPerceptibleEvent();
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      EXPECTED_MESSAGE.replace('{actor}', 'Maya').replace('{primary}', 'Natalie')
    );
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
    expect(perceptibleEvent.payload.locationId).toBe('library_nook');
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
    expect(perceptibleEvent.payload.actorId).toBe(scenario.actor.id);
  });
});
