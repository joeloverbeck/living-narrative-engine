/**
 * @file Integration tests for the affection:rest_head_against_flat_chest action and rule.
 * @description Verifies the flat-chested rule emits matching success and perceptible events while ending the actor's turn.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import handleRestHeadAgainstFlatChestRule from '../../../../data/mods/affection/rules/handle_rest_head_against_flat_chest.rule.json';
import eventIsActionRestHeadAgainstFlatChest from '../../../../data/mods/affection/conditions/event-is-action-rest-head-against-flat-chest.condition.json';

const ACTION_ID = 'affection:rest_head_against_flat_chest';
const EXPECTED_MESSAGE = "{actor} rests their head on {primary}'s chest.";

describe('affection:rest_head_against_flat_chest action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      ACTION_ID,
      handleRestHeadAgainstFlatChestRule,
      eventIsActionRestHeadAgainstFlatChest
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

  it('executes successfully for close actors without breast anatomy', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Alice', 'Devon'],
      ['torso'],
      { location: 'quiet_corner' }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = findSuccessEvent();
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      EXPECTED_MESSAGE.replace('{actor}', 'Alice').replace('{primary}', 'Devon')
    );

    testFixture.assertPerceptibleEvent({
      descriptionText: EXPECTED_MESSAGE.replace('{actor}', 'Alice').replace(
        '{primary}',
        'Devon'
      ),
      locationId: 'quiet_corner',
      perceptionType: 'physical.target_action',
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
      ['Serena', 'Kai'],
      ['torso'],
      { location: 'balcony' }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = findSuccessEvent();
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      EXPECTED_MESSAGE.replace('{actor}', 'Serena').replace('{primary}', 'Kai')
    );
  });

  it('emits perceptible metadata aligned with the success event', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Maya', 'Rin'],
      ['torso'],
      { location: 'library_nook' }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = findPerceptibleEvent();
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      EXPECTED_MESSAGE.replace('{actor}', 'Maya').replace('{primary}', 'Rin')
    );
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'physical.target_action'
    );
    expect(perceptibleEvent.payload.locationId).toBe('library_nook');
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
    expect(perceptibleEvent.payload.actorId).toBe(scenario.actor.id);
  });
});
