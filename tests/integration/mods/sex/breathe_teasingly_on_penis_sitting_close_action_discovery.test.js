/**
 * @file Integration tests for sex-penile-oral:breathe_teasingly_on_penis_sitting_close action discovery.
 * @description Validates seated teasing action availability for close partners with an exposed penis.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  BREATHE_TEASINGLY_ON_PENIS_SITTING_CLOSE_ACTION_ID as ACTION_ID,
  BREATHE_TEASINGLY_ON_PENIS_SITTING_CLOSE_ACTOR_ID as ACTOR_ID,
  buildBreatheTeasinglyOnPenisSittingCloseScenario,
  installSittingCloseUncoveredPenisScopeOverride,
} from '../../../common/mods/sex/breatheTeasinglyOnPenisSittingCloseFixtures.js';
import breatheTeasinglyOnPenisSittingCloseAction from '../../../../data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis_sitting_close.action.json';

/**
 * @description Registers the seated teasing action for discovery.
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([
    breatheTeasinglyOnPenisSittingCloseAction,
  ]);
}

describe('sex-penile-oral:breathe_teasingly_on_penis_sitting_close action discovery', () => {
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
    const { entities } = buildBreatheTeasinglyOnPenisSittingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("breathe teasingly on {primary}'s penis");
  });

  it("does not appear when the partner's penis is covered", async () => {
    const { entities } = buildBreatheTeasinglyOnPenisSittingCloseScenario({
      coverPrimaryPenis: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when the actor is not sitting', async () => {
    const { entities } = buildBreatheTeasinglyOnPenisSittingCloseScenario({
      includeActorSitting: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear without mutual closeness', async () => {
    const { entities } = buildBreatheTeasinglyOnPenisSittingCloseScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
