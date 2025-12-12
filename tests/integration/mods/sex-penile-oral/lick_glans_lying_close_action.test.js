import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  buildLickGlansLyingCloseScenario,
  installLyingCloseUncoveredPenisScopeOverride,
} from '../../../common/mods/sex-penile-oral/lickGlansLyingCloseFixtures.js';
import lickGlansLyingCloseAction from '../../../../data/mods/sex-penile-oral/actions/lick_glans_lying_close.action.json';

const ACTION_ID = 'sex-penile-oral:lick_glans_lying_close';
const EXPECTED_MESSAGE =
  "Ava, their head before Nolan's crotch, licks Nolan's glans sensually, coating it in warm saliva.";

/**
 * Configures action discovery for test scenarios.
 *
 * @param {import('../../../common/mods/ModTestFixture.js').ModTestFixture} fixture - Test fixture instance
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([lickGlansLyingCloseAction]);
}

describe('sex-penile-oral:lick_glans_lying_close action execution', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-penile-oral',
      ACTION_ID
    );
    restoreScopeResolver =
      installLyingCloseUncoveredPenisScopeOverride(testFixture);
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

  it('successfully executes lying-down glans licking action', async () => {
    expect.hasAssertions();
    const { entities, actorId, primaryId, roomId } =
      buildLickGlansLyingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
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
      locationId: roomId,
      actorId,
      targetId: primaryId,
      perceptionType: 'physical.target_action',
    });
  });
});
