/**
 * @file Integration tests for sex-penile-oral:take_penis_in_mouth_lying_close action execution.
 * @description Validates rule execution produces correct narrative output, events, and component changes.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  buildLickGlansLyingCloseScenario,
  installLyingCloseUncoveredPenisScopeOverride,
} from '../../../common/mods/sex-penile-oral/lickGlansLyingCloseFixtures.js';
import takePenisInMouthLyingCloseAction from '../../../../data/mods/sex-penile-oral/actions/take_penis_in_mouth_lying_close.action.json';
import '../../../common/mods/domainMatchers.js';

const ACTION_ID = 'sex-penile-oral:take_penis_in_mouth_lying_close';
const EXPECTED_MESSAGE =
  "Ava takes Nolan's cock in the mouth, bathing it in hot saliva.";

/**
 * Configures action discovery for test scenarios.
 *
 * @param {import('../../../common/mods/ModTestFixture.js').ModTestFixture} fixture - Test fixture instance
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([takePenisInMouthLyingCloseAction]);
}

describe('sex-penile-oral:take_penis_in_mouth_lying_close action execution', () => {
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

  it('successfully executes lying-down take penis in mouth action', async () => {
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

  it('adds giving_blowjob component to actor with correct data', async () => {
    const { entities, actorId, primaryId } = buildLickGlansLyingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    const actor = testFixture.entityManager.getEntityInstance(actorId);
    expect(actor).toHaveComponent('sex-states:giving_blowjob');
    expect(actor).toHaveComponentData('sex-states:giving_blowjob', {
      receiving_entity_id: primaryId,
      initiated: true,
    });
  });

  it('adds receiving_blowjob component to primary with correct data', async () => {
    const { entities, actorId, primaryId } = buildLickGlansLyingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    const primary = testFixture.entityManager.getEntityInstance(primaryId);
    expect(primary).toHaveComponent('sex-states:receiving_blowjob');
    expect(primary).toHaveComponentData('sex-states:receiving_blowjob', {
      giving_entity_id: actorId,
      consented: true,
    });
  });
});
