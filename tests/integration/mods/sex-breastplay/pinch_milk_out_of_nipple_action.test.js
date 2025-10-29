/**
 * @file Integration tests for the sex-breastplay:pinch_milk_out_of_nipple action execution.
 * @description Validates narrative output, perception data, and turn handling for the lactation tease.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

const ACTION_ID = 'sex-breastplay:pinch_milk_out_of_nipple';
const EXPECTED_MESSAGE =
  'Mira pinches and rolls a nipple until milk beads at the tip.';
const ROOM_ID = 'milk_parlor';
const ACTOR_ID = 'mira';
const TORSO_ID = `${ACTOR_ID}_torso`;
const LEFT_BREAST_ID = `${ACTOR_ID}_left_breast`;
const RIGHT_BREAST_ID = `${ACTOR_ID}_right_breast`;

/**
 * @description Builds entities required to execute the pinch milk out of nipple action.
 * @returns {{ entities: Array<object>, actorId: string, roomId: string }} Entity collection and identifiers used in tests.
 */
function buildExecutionScenario() {
  const room = new ModEntityBuilder(ROOM_ID).asRoom('Milk Parlor').build();

  const actor = new ModEntityBuilder(ACTOR_ID)
    .withName('Mira')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .withBody(TORSO_ID)
    .withComponent('sex-breastplay:is_lactating', {})
    .build();

  const torso = new ModEntityBuilder(TORSO_ID)
    .asBodyPart({
      parent: null,
      children: [LEFT_BREAST_ID, RIGHT_BREAST_ID],
      subType: 'torso',
    })
    .build();

  const leftBreast = new ModEntityBuilder(LEFT_BREAST_ID)
    .asBodyPart({ parent: TORSO_ID, children: [], subType: 'breast' })
    .build();
  const rightBreast = new ModEntityBuilder(RIGHT_BREAST_ID)
    .asBodyPart({ parent: TORSO_ID, children: [], subType: 'breast' })
    .build();

  return {
    entities: [room, actor, torso, leftBreast, rightBreast],
    actorId: ACTOR_ID,
    roomId: ROOM_ID,
  };
}

describe('sex-breastplay:pinch_milk_out_of_nipple action integration', () => {
  let testFixture;
  let scenario;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-breastplay', ACTION_ID);
    scenario = buildExecutionScenario();
    testFixture.reset(scenario.entities);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  it('executes pinch milk out of nipple successfully', async () => {
    await testFixture.executeAction(scenario.actorId, null);

    testFixture.assertActionSuccess(EXPECTED_MESSAGE, {
      shouldEndTurn: true,
      shouldHavePerceptibleEvent: true,
    });
  });

  it('emits the correct perceptible event payload', async () => {
    await testFixture.executeAction(scenario.actorId, null);

    testFixture.assertPerceptibleEvent({
      descriptionText: EXPECTED_MESSAGE,
      locationId: scenario.roomId,
      actorId: scenario.actorId,
      targetId: null,
      perceptionType: 'action_self_general',
    });
  });

  it('does not trigger when a different action is attempted', async () => {
    testFixture.clearEvents();

    await testFixture.eventBus.dispatch('core:attempt_action', {
      actorId: scenario.actorId,
      actionId: 'core:wait',
      eventName: 'core:attempt_action',
    });

    testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
  });

  it('records the success message in the final event log', async () => {
    await testFixture.executeAction(scenario.actorId, null);

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );

    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(EXPECTED_MESSAGE);
  });
});
