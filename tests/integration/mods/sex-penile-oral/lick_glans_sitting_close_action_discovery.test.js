/**
 * @file Integration tests for sex-penile-oral:lick_glans_sitting_close action discovery.
 * @description Validates the seated glans licking action availability for close partners with an exposed penis.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  buildBreatheTeasinglyOnPenisSittingCloseScenario,
  installSittingCloseUncoveredPenisScopeOverride,
} from '../../../common/mods/sex/breatheTeasinglyOnPenisSittingCloseFixtures.js';
import lickGlansSittingCloseAction from '../../../../data/mods/sex-penile-oral/actions/lick_glans_sitting_close.action.json';

const ACTION_ID = 'sex-penile-oral:lick_glans_sitting_close';

/**
 * @description Registers the seated glans licking action for discovery.
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([lickGlansSittingCloseAction]);
}

describe('sex-penile-oral:lick_glans_sitting_close action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-penile-oral', ACTION_ID);
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

  it('appears when both participants are sitting close with an uncovered penis', async () => {
    const { entities, actorId } =
      buildBreatheTeasinglyOnPenisSittingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("lick {primary}'s glans");
  });

  it("does not appear when the partner's penis is covered", async () => {
    const { entities, actorId } =
      buildBreatheTeasinglyOnPenisSittingCloseScenario({
        coverPrimaryPenis: true,
      });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when the actor is not sitting', async () => {
    const { entities, actorId } =
      buildBreatheTeasinglyOnPenisSittingCloseScenario({
        includeActorSitting: false,
      });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear without mutual closeness', async () => {
    const { entities, actorId } =
      buildBreatheTeasinglyOnPenisSittingCloseScenario({
        includeCloseness: false,
      });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
