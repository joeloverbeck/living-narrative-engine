/**
 * @file Integration tests for sex-penile-oral:suckle_testicle_lying_close action execution.
 * @description Validates rule execution produces correct narrative output and events.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  buildLickTesticlesLyingCloseScenario,
  installLyingCloseUncoveredTesticleScopeOverride,
} from '../../../common/mods/sex-penile-oral/lickTesticlesLyingCloseFixtures.js';
import suckleTesticleLyingCloseAction from '../../../../data/mods/sex-penile-oral/actions/suckle_testicle_lying_close.action.json';

const ACTION_ID = 'sex-penile-oral:suckle_testicle_lying_close';
const EXPECTED_MESSAGE =
  "Ava wraps her lips around Nolan's scrotum and sucks carefully on one testicle, tracing it with the tongue.";

/**
 * Configures action discovery for test scenarios.
 *
 * @param {import('../../../common/mods/ModTestFixture.js').ModTestFixture} fixture - Test fixture instance
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([suckleTesticleLyingCloseAction]);
}

describe('sex-penile-oral:suckle_testicle_lying_close action execution', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-penile-oral',
      ACTION_ID
    );
    restoreScopeResolver =
      installLyingCloseUncoveredTesticleScopeOverride(testFixture);
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

  it('successfully executes lying-down testicle suckling action', async () => {
    expect.hasAssertions();
    const { entities, actorId, primaryId, roomId } =
      buildLickTesticlesLyingCloseScenario();
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
