/**
 * @file Integration tests for sex-penile-oral:breathe_teasingly_on_penis_sitting_close action and rule.
 * @description Verifies seated teasing narration, perceptible event wiring, and payload metadata.
 */

import { describe, it, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  BREATHE_TEASINGLY_ON_PENIS_SITTING_CLOSE_ACTION_ID as ACTION_ID,
  BREATHE_TEASINGLY_ON_PENIS_SITTING_CLOSE_ACTOR_ID as ACTOR_ID,
  BREATHE_TEASINGLY_ON_PENIS_SITTING_CLOSE_PRIMARY_ID as PRIMARY_ID,
  BREATHE_TEASINGLY_ON_PENIS_SITTING_CLOSE_ROOM_ID as ROOM_ID,
  buildBreatheTeasinglyOnPenisSittingCloseScenario,
  installSittingCloseUncoveredPenisScopeOverride,
} from '../../../common/mods/sex/breatheTeasinglyOnPenisSittingCloseFixtures.js';
import breatheTeasinglyOnPenisSittingCloseAction from '../../../../data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis_sitting_close.action.json';

const EXPECTED_MESSAGE =
  "Ava breathes teasingly on Nolan's penis from up close, leaning toward Nolan's lap.";

/**
 * @description Builds the action index with the seated teasing action definition.
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([
    breatheTeasinglyOnPenisSittingCloseAction,
  ]);
}

describe('sex-penile-oral:breathe_teasingly_on_penis_sitting_close action integration', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-penile-oral',
      ACTION_ID
    );
    restoreScopeResolver =
      installSittingCloseUncoveredPenisScopeOverride(testFixture);
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

  it('dispatches the seated teasing narration and perceptible event', async () => {
    const { entities } = buildBreatheTeasinglyOnPenisSittingCloseScenario();
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
});
