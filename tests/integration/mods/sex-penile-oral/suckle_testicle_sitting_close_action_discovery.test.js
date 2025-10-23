/**
 * @file Integration tests for sex-penile-oral:suckle_testicle_sitting_close action discovery.
 * @description Ensures the seated suckle action only appears when both partners are seated close with at least one uncovered testicle.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  buildLickTesticlesSittingCloseScenario,
  installSittingCloseUncoveredTesticleScopeOverride,
} from '../../../common/mods/sex/lickTesticlesSittingCloseFixtures.js';
import suckleTesticleSittingCloseAction from '../../../../data/mods/sex-penile-oral/actions/suckle_testicle_sitting_close.action.json';

const ACTION_ID = 'sex-penile-oral:suckle_testicle_sitting_close';

/**
 * @description Registers the seated suckle action for discovery.
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([suckleTesticleSittingCloseAction]);
}

describe('sex-penile-oral:suckle_testicle_sitting_close action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad('sex-penile-oral', ACTION_ID);
    restoreScopeResolver = installSittingCloseUncoveredTesticleScopeOverride(testFixture);
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

  it('appears when both participants are sitting close with an uncovered testicle', async () => {
    const { entities, actorId } = buildLickTesticlesSittingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("suckle on {primary}'s testicle");
  });

  it('appears when only one testicle remains uncovered', async () => {
    const { entities, actorId } = buildLickTesticlesSittingCloseScenario({
      coverLeftTesticle: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
  });

  it("does not appear when the partner's testicles are fully covered", async () => {
    const { entities, actorId } = buildLickTesticlesSittingCloseScenario({
      coverLeftTesticle: true,
      coverRightTesticle: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when the actor is not sitting', async () => {
    const { entities, actorId } = buildLickTesticlesSittingCloseScenario({
      includeActorSitting: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear without mutual closeness', async () => {
    const { entities, actorId } = buildLickTesticlesSittingCloseScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
