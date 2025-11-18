/**
 * @file Integration tests for the sex-vaginal-penetration:ride_penis_greedily action and rule.
 * @description Validates greedy riding narration, mutual component application, and
 * idempotent penetration state handling while straddling.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  buildRidePenisGreedilyScenario,
  RIDE_PENIS_GREEDILY_ACTION_ID,
  STRADDLING_MILKING_ACTOR_ID,
  STRADDLING_MILKING_PRIMARY_ID,
  STRADDLING_MILKING_ROOM_ID,
} from '../../../common/mods/sex/straddlingPenisMilkingFixtures.js';

const ACTION_ID = RIDE_PENIS_GREEDILY_ACTION_ID;
const EXPECTED_MESSAGE =
  "Selene rides Marcus's penis greedily, wet slaps echoing as their groins meet.";

describe('sex-vaginal-penetration:ride_penis_greedily action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-vaginal-penetration',
      ACTION_ID
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  /**
   *
   * @param additionalOptions
   */
  async function performAction(additionalOptions = {}) {
    await testFixture.executeAction(
      STRADDLING_MILKING_ACTOR_ID,
      STRADDLING_MILKING_PRIMARY_ID,
      {
        additionalPayload: {
          primaryId: STRADDLING_MILKING_PRIMARY_ID,
          ...additionalOptions.additionalPayload,
        },
        ...additionalOptions.executionOptions,
      }
    );
  }

  it('performs the greedy riding action successfully', async () => {
    testFixture.reset(buildRidePenisGreedilyScenario());

    await performAction();

    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      EXPECTED_MESSAGE,
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );
  });

  it('emits matching descriptive copy for the perceptible event and UI success message', async () => {
    testFixture.reset(buildRidePenisGreedilyScenario());

    await performAction();

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: EXPECTED_MESSAGE,
      locationId: STRADDLING_MILKING_ROOM_ID,
      actorId: STRADDLING_MILKING_ACTOR_ID,
      targetId: STRADDLING_MILKING_PRIMARY_ID,
      perceptionType: 'action_target_general',
    });
  });

  it('applies vaginal penetration components to actor and primary partner', async () => {
    testFixture.reset(buildRidePenisGreedilyScenario());

    await performAction();

    const actorComponent = testFixture.entityManager.getComponentData(
      STRADDLING_MILKING_ACTOR_ID,
      'positioning:being_fucked_vaginally'
    );
    expect(actorComponent).toEqual({ actorId: STRADDLING_MILKING_PRIMARY_ID });

    const primaryComponent = testFixture.entityManager.getComponentData(
      STRADDLING_MILKING_PRIMARY_ID,
      'positioning:fucking_vaginally'
    );
    expect(primaryComponent).toEqual({ targetId: STRADDLING_MILKING_ACTOR_ID });
  });

  it('does not reapply penetration components when they already reference the partner', async () => {
    testFixture.reset(
      buildRidePenisGreedilyScenario({
        actorBeingFucked: true,
        primaryAlreadyFucking: true,
      })
    );

    await performAction();

    const componentEvents = testFixture.events.filter(
      (event) =>
        event.eventType === 'core:component_added' &&
        (event.payload?.componentTypeId === 'positioning:being_fucked_vaginally' ||
          event.payload?.componentTypeId === 'positioning:fucking_vaginally')
    );
    expect(componentEvents).toHaveLength(0);

    const actorComponent = testFixture.entityManager.getComponentData(
      STRADDLING_MILKING_ACTOR_ID,
      'positioning:being_fucked_vaginally'
    );
    expect(actorComponent).toEqual({ actorId: STRADDLING_MILKING_PRIMARY_ID });

    const primaryComponent = testFixture.entityManager.getComponentData(
      STRADDLING_MILKING_PRIMARY_ID,
      'positioning:fucking_vaginally'
    );
    expect(primaryComponent).toEqual({ targetId: STRADDLING_MILKING_ACTOR_ID });
  });

  it('dispatches a single perceptible event for the action outcome', async () => {
    testFixture.reset(buildRidePenisGreedilyScenario());

    await performAction();

    const perceptibleEvents = testFixture.events.filter(
      (event) => event.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents).toHaveLength(1);
    expect(perceptibleEvents[0].payload.descriptionText).toBe(EXPECTED_MESSAGE);
  });

  it('rejects execution when the actor lacks the vaginal penetration state', async () => {
    testFixture.reset(
      buildRidePenisGreedilyScenario({ actorBeingFucked: false })
    );

    await expect(performAction()).rejects.toThrow(
      /missing required component/i
    );
  });
});
