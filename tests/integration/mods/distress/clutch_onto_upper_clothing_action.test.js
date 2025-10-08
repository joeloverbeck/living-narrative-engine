/**
 * @file Integration tests for the distress:clutch_onto_upper_clothing rule behavior.
 * @description Validates the full multi-target pipeline, ensuring perceptible messaging, success text, and turn handling all align.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import clutchOntoUpperClothingRule from '../../../../data/mods/distress/rules/clutch_onto_upper_clothing.rule.json';
import eventIsActionClutchOntoUpperClothing from '../../../../data/mods/distress/conditions/event-is-action-clutch-onto-upper-clothing.condition.json';

const ACTION_ID = 'distress:clutch_onto_upper_clothing';

describe('distress:clutch_onto_upper_clothing rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'distress',
      ACTION_ID,
      clutchOntoUpperClothingRule,
      eventIsActionClutchOntoUpperClothing
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('dispatches matching perceptible and success messages while ending the turn', async () => {
    const scenario = testFixture.createCloseActors(['Evelyn', 'Marco'], {
      location: 'sanctuary',
    });

    const garment = {
      id: 'garment-distress-1',
      components: {
        'core:name': { text: 'wool coat' },
        'core:position': { locationId: 'sanctuary' },
      },
    };

    scenario.target.components['clothing:equipment'] = {
      equipped: {
        torso_upper: { base: garment.id },
      },
    };

    const room = ModEntityScenarios.createRoom('sanctuary', 'Sanctuary');
    testFixture.reset([room, scenario.actor, scenario.target, garment]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: ACTION_ID,
      primaryId: scenario.target.id,
      secondaryId: garment.id,
      originalInput: 'clutch clothing',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const expectedMessage =
      "Evelyn clutches pleadingly onto Marco's wool coat.";

    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      expectedMessage
    );
    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: expectedMessage,
      locationId: 'sanctuary',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
      perceptionType: 'action_target_general',
    });
  });

  it('only triggers for the distress clothing clutch action id', async () => {
    const scenario = testFixture.createCloseActors(['Nova', 'Quinn']);

    const garment = {
      id: 'garment-distress-2',
      components: {
        'core:name': { text: 'cotton blouse' },
      },
    };

    scenario.target.components['clothing:equipment'] = {
      equipped: {
        torso_upper: { base: garment.id },
      },
    };

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target, garment]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'distress:nonexistent_action',
      primaryId: scenario.target.id,
      secondaryId: garment.id,
      originalInput: 'clutch clothing',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(successEvent).toBeUndefined();
    expect(perceptibleEvent).toBeUndefined();
  });
});
