/**
 * @file Integration tests for sex-penile-oral:take_penis_in_mouth_lying_close action discovery.
 * @description Ensures the lying-down take_penis_in_mouth action only appears when both partners are lying close with an uncovered penis.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  buildLickGlansLyingCloseScenario,
  installLyingCloseUncoveredPenisScopeOverride,
} from '../../../common/mods/sex-penile-oral/lickGlansLyingCloseFixtures.js';
import takePenisInMouthLyingCloseAction from '../../../../data/mods/sex-penile-oral/actions/take_penis_in_mouth_lying_close.action.json';

const ACTION_ID = 'sex-penile-oral:take_penis_in_mouth_lying_close';

/**
 * Configures action discovery for test scenarios.
 *
 * @param {import('../../../common/mods/ModTestFixture.js').ModTestFixture} fixture - Test fixture instance
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([takePenisInMouthLyingCloseAction]);
}

describe('sex-penile-oral:take_penis_in_mouth_lying_close action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-penile-oral', ACTION_ID);
    restoreScopeResolver = installLyingCloseUncoveredPenisScopeOverride(testFixture);
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

  // Positive test case
  it('appears when both participants are lying close with uncovered penis', async () => {
    const { entities, actorId } = buildLickGlansLyingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("take {primary}'s cock in your mouth");
  });

  // Negative test cases
  it('does NOT appear when primary penis is covered', async () => {
    const { entities, actorId } = buildLickGlansLyingCloseScenario({
      coverPrimaryPenis: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when actor is not lying down', async () => {
    const { entities, actorId } = buildLickGlansLyingCloseScenario({
      includeActorLying: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when primary is not lying down', async () => {
    const { entities, actorId } = buildLickGlansLyingCloseScenario({
      includePrimaryLying: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when mutual closeness is not established', async () => {
    const { entities, actorId } = buildLickGlansLyingCloseScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when participants are on different furniture', async () => {
    const { entities, actorId } = buildLickGlansLyingCloseScenario({
      useDifferentFurniture: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when actor has giving_blowjob component', async () => {
    const { entities, actorId } = buildLickGlansLyingCloseScenario({
      actorGivingBlowjob: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
