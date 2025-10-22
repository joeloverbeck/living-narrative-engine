/**
 * @file Integration tests for the sex-penile-oral:nuzzle_penis_through_clothing_sitting_close action and rule.
 * @description Verifies seated clothed nuzzling narration, perceptible event payload, and turn resolution.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  buildBreatheTeasinglyOnPenisSittingCloseScenario,
  installSittingCloseCoveredPenisScopeOverride,
} from '../../../common/mods/sex/breatheTeasinglyOnPenisSittingCloseFixtures.js';
import nuzzlePenisThroughClothingSittingCloseAction from '../../../../data/mods/sex-penile-oral/actions/nuzzle_penis_through_clothing_sitting_close.action.json';

const ACTION_ID = 'sex-penile-oral:nuzzle_penis_through_clothing_sitting_close';
const EXPECTED_MESSAGE =
  "Ava, leaning almost horizontally, nuzzles their face against the bulge of Nolan's crotch through the silk briefs.";

/**
 * @description Builds the action index with the seated clothed nuzzling action definition.
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([nuzzlePenisThroughClothingSittingCloseAction]);
}

describe('sex-penile-oral:nuzzle_penis_through_clothing_sitting_close action integration', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad('sex-penile-oral', ACTION_ID);
    restoreScopeResolver = installSittingCloseCoveredPenisScopeOverride(testFixture);
  });

  afterEach(() => {
    if (restoreScopeResolver) {
      restoreScopeResolver();
      restoreScopeResolver = null;
    }

    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  it('dispatches the seated clothed nuzzling narration and perceptible event', async () => {
    const { entities, actorId, primaryId, roomId, clothingId } =
      buildBreatheTeasinglyOnPenisSittingCloseScenario({ coverPrimaryPenis: true });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId, secondaryId: clothingId },
    });

    ModAssertionHelpers.assertActionSuccess(testFixture.events, EXPECTED_MESSAGE, {
      shouldEndTurn: true,
      shouldHavePerceptibleEvent: true,
    });

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: EXPECTED_MESSAGE,
      locationId: roomId,
      actorId,
      targetId: primaryId,
      perceptionType: 'action_target_general',
    });
  });

  it('does not fire rule for a different action', async () => {
    const entities = [
      new ModEntityBuilder('room1').asRoom('Room').build(),
      new ModEntityBuilder('ava')
        .withName('Ava')
        .atLocation('room1')
        .asActor()
        .build(),
    ];

    testFixture.reset(entities);

    const initialEventCount = testFixture.events.length;

    await testFixture.eventBus.dispatch('core:attempt_action', {
      actionId: 'core:wait',
      actorId: 'ava',
    });

    const newEventCount = testFixture.events.length;
    expect(newEventCount).toBe(initialEventCount + 1);
  });

  it('handles missing target gracefully', async () => {
    const entities = [
      new ModEntityBuilder('room1').asRoom('Room').build(),
      new ModEntityBuilder('ava')
        .withName('Ava')
        .atLocation('room1')
        .closeToEntity([])
        .asActor()
        .build(),
    ];

    testFixture.reset(entities);

    await expect(async () => {
      await testFixture.eventBus.dispatch('core:attempt_action', {
        actionId: ACTION_ID,
        actorId: 'ava',
        primaryId: 'ghost',
      });
    }).not.toThrow();

    const eventTypes = testFixture.events.map((event) => event.eventType);
    expect(eventTypes).toEqual(['core:attempt_action']);
  });
});
