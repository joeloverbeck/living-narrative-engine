/**
 * @file Integration tests for sex-penile-oral:suckle_testicle_lying_close action discovery.
 * @description Ensures the lying-down suckle action only appears when both partners are lying close with at least one uncovered testicle.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  buildLickTesticlesLyingCloseScenario,
  installLyingCloseUncoveredTesticleScopeOverride,
} from '../../../common/mods/sex-penile-oral/lickTesticlesLyingCloseFixtures.js';
import suckleTesticleLyingCloseAction from '../../../../data/mods/sex-penile-oral/actions/suckle_testicle_lying_close.action.json';

const ACTION_ID = 'sex-penile-oral:suckle_testicle_lying_close';

/**
 * Configures action discovery for test scenarios.
 *
 * @param {import('../../../common/mods/ModTestFixture.js').ModTestFixture} fixture - Test fixture instance
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([suckleTesticleLyingCloseAction]);
}

describe('sex-penile-oral:suckle_testicle_lying_close action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad('sex-penile-oral', ACTION_ID);
    restoreScopeResolver = installLyingCloseUncoveredTesticleScopeOverride(testFixture);
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
  it('appears when both participants are lying close with uncovered testicles', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("suckle on {primary}'s testicle");
  });

  // Positive test case - only one testicle uncovered
  it('appears when only one testicle remains uncovered', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      coverLeftTesticle: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
  });

  // Negative test cases
  it('does NOT appear when both testicles are covered', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      coverLeftTesticle: true,
      coverRightTesticle: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when actor is not lying down', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      includeActorLying: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when primary is not lying down', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      includePrimaryLying: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when mutual closeness is not established', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when participants are on different furniture', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      useDifferentFurniture: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when actor has giving_blowjob component', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      actorGivingBlowjob: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when target is fucking actor vaginally', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      targetFuckingActor: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
