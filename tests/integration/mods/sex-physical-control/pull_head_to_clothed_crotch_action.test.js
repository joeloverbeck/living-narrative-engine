/**
 * @file Integration tests for sex-physical-control:pull_head_to_clothed_crotch action and rule.
 * @description Verifies seated clothed crotch dominance narration, perceptible payload, and metadata wiring.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  PULL_HEAD_TO_CLOTHED_CROTCH_ACTION_ID as ACTION_ID,
  PULL_HEAD_TO_CLOTHED_CROTCH_ACTOR_ID as ACTOR_ID,
  PULL_HEAD_TO_CLOTHED_CROTCH_PRIMARY_ID as PRIMARY_ID,
  PULL_HEAD_TO_CLOTHED_CROTCH_ROOM_ID as ROOM_ID,
  buildPullHeadToClothedCrotchScenario,
  installActorsSittingCloseScopeOverride,
} from '../../../common/mods/sex-physical-control/pullHeadToClothedCrotchFixtures.js';
import pullHeadToClothedCrotchAction from '../../../../data/mods/sex-physical-control/actions/pull_head_to_clothed_crotch.action.json';

const EXPECTED_MESSAGE =
  "Dante, holding the back of Mira's head, pulls them down to Dante's bulging, clothed crotch.";

/**
 * @description Builds the action index with the clothed crotch dominance action definition.
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([pullHeadToClothedCrotchAction]);
}

describe('sex-physical-control:pull_head_to_clothed_crotch action integration', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-physical-control',
      ACTION_ID
    );
    restoreScopeResolver = installActorsSittingCloseScopeOverride(testFixture);
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

  it('dispatches the clothed crotch dominance narration and perceptible event', async () => {
    const { entities } = buildPullHeadToClothedCrotchScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(ACTOR_ID, PRIMARY_ID, {
      additionalPayload: { primaryId: PRIMARY_ID },
    });

    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      EXPECTED_MESSAGE,
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: EXPECTED_MESSAGE,
      locationId: ROOM_ID,
      actorId: ACTOR_ID,
      targetId: PRIMARY_ID,
      perceptionType: 'physical.target_action',
    });
  });

  it('fails the clothing coverage prerequisite when the actor loses their clothed tease', async () => {
    const { entities, actorId, primaryId } =
      buildPullHeadToClothedCrotchScenario({
        coverActorPenis: false,
      });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actor = testFixture.entityManager.getEntityInstance(actorId);
    const primary = testFixture.entityManager.getEntityInstance(primaryId);
    const coveragePrerequisite = pullHeadToClothedCrotchAction.prerequisites[1];

    const prerequisiteResult = testFixture.testEnv.jsonLogic.evaluate(
      coveragePrerequisite.logic,
      { actor, primary }
    );

    expect(prerequisiteResult).toBe(false);
  });
});
