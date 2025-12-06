/**
 * @file Integration tests for the sex-physical-control:guide_hand_to_clothed_crotch rule execution.
 * @description Ensures the clothed crotch guidance action logs the proper narrative beat and metadata.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  GUIDE_HAND_TO_CLOTHED_CROTCH_ACTION_ID as ACTION_ID,
  GUIDE_HAND_TO_CLOTHED_CROTCH_ACTOR_ID as ACTOR_ID,
  GUIDE_HAND_TO_CLOTHED_CROTCH_PRIMARY_ID as PRIMARY_ID,
  GUIDE_HAND_TO_CLOTHED_CROTCH_ROOM_ID as ROOM_ID,
  buildGuideHandToClothedCrotchScenario,
} from '../../../common/mods/sex-physical-control/guideHandToClothedCrotchFixtures.js';

const SUCCESS_MESSAGE =
  "Marin takes Avery's wrist gently and guides their hand to the clothed bulge of Marin's crotch.";

describe('sex-physical-control:guide_hand_to_clothed_crotch rule', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-physical-control',
      ACTION_ID
    );

    const { entities } = buildGuideHandToClothedCrotchScenario();
    testFixture.reset(entities);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  it('executes successfully and ends the turn', async () => {
    await testFixture.executeAction(ACTOR_ID, PRIMARY_ID);

    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      SUCCESS_MESSAGE,
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );
  });

  it('produces matching log and perceptible event messages', async () => {
    await testFixture.executeAction(ACTOR_ID, PRIMARY_ID);

    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );
    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(successEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(SUCCESS_MESSAGE);
    expect(successEvent.payload.message).toBe(SUCCESS_MESSAGE);
  });

  it('provides the correct perception metadata', async () => {
    await testFixture.executeAction(ACTOR_ID, PRIMARY_ID);

    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
    expect(perceptibleEvent.payload.locationId).toBe(ROOM_ID);
    expect(perceptibleEvent.payload.targetId).toBe(PRIMARY_ID);
    expect(perceptibleEvent.payload.actorId).toBe(ACTOR_ID);
  });

  it('does not fire for unrelated actions', async () => {
    const minimalEntities = [
      new ModEntityBuilder('room_min').asRoom('Minimal Room').build(),
      new ModEntityBuilder('idle_actor')
        .withName('Idle Actor')
        .atLocation('room_min')
        .asActor()
        .build(),
    ];

    testFixture.reset(minimalEntities);

    const initialEventCount = testFixture.events.length;

    await testFixture.eventBus.dispatch('core:attempt_action', {
      actionId: 'core:wait',
      actorId: 'idle_actor',
    });

    expect(testFixture.events.length).toBe(initialEventCount + 1);
  });

  it('includes the success macro in the rule definition', () => {
    expect(testFixture.ruleFile.rule_id).toBe(
      'handle_guide_hand_to_clothed_crotch'
    );
    expect(testFixture.ruleFile.event_type).toBe('core:attempt_action');
    expect(testFixture.conditionFile.id).toBe(
      'sex-physical-control:event-is-action-guide-hand-to-clothed-crotch'
    );

    const lastAction = testFixture.ruleFile.actions.at(-1);
    expect(lastAction.macro).toBe('core:logSuccessAndEndTurn');
  });
});
