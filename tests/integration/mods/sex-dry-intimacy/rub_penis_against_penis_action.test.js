/**
 * @file Integration tests for the sex-dry-intimacy:rub_penis_against_penis action and rule.
 * @description Validates narrative output, perceptible events, and guard rails for the penis-to-penis rubbing action.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  buildRubPenisAgainstPenisScenario,
  RUB_PENIS_AGAINST_PENIS_ACTION_ID,
  RUB_PENIS_AGAINST_PENIS_ACTOR_ID,
  RUB_PENIS_AGAINST_PENIS_PRIMARY_ID,
  RUB_PENIS_AGAINST_PENIS_ROOM_ID,
} from '../../../common/mods/sex-dry-intimacy/rubPenisAgainstPenisFixtures.js';

const ACTION_ID = RUB_PENIS_AGAINST_PENIS_ACTION_ID;
const ACTOR_ID = RUB_PENIS_AGAINST_PENIS_ACTOR_ID;
const PRIMARY_ID = RUB_PENIS_AGAINST_PENIS_PRIMARY_ID;
const ROOM_ID = RUB_PENIS_AGAINST_PENIS_ROOM_ID;
const EXPECTED_MESSAGE =
  "Alex rubs their penis against Blake's penis, making both intimately aware of the differences in their genital organs.";

describe('sex-dry-intimacy:rub_penis_against_penis action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-dry-intimacy', ACTION_ID);

    const { entities } = buildRubPenisAgainstPenisScenario();
    testFixture.reset(entities);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  it('performs the rub penis against penis action successfully', async () => {
    await testFixture.executeAction(ACTOR_ID, PRIMARY_ID);

    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      EXPECTED_MESSAGE,
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );
  });

  it('emits a perceptible event with the expected metadata', async () => {
    await testFixture.executeAction(ACTOR_ID, PRIMARY_ID);

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: EXPECTED_MESSAGE,
      locationId: ROOM_ID,
      actorId: ACTOR_ID,
      targetId: PRIMARY_ID,
      perceptionType: 'action_target_general',
    });
  });

  it('emits a matching success message for the actor', async () => {
    await testFixture.executeAction(ACTOR_ID, PRIMARY_ID);

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );

    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(EXPECTED_MESSAGE);
  });

  it('ignores unrelated actions dispatched into the event bus', async () => {
    const baselineEvents = testFixture.events.length;

    await testFixture.eventBus.dispatch('core:attempt_action', {
      actionId: 'core:wait',
      actorId: ACTOR_ID,
    });

    expect(testFixture.events.length).toBe(baselineEvents + 1);
    const successEvents = testFixture.events.filter(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    expect(successEvents).toHaveLength(0);
  });
});
