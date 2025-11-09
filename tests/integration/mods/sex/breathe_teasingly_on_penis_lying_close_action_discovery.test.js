/**
 * @file Integration tests for sex-penile-oral:breathe_teasingly_on_penis_lying_close action discovery.
 * @description Validates lying-down teasing action availability for close partners with an exposed penis sharing the same furniture.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_ACTION_ID as ACTION_ID,
  BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_ACTOR_ID as ACTOR_ID,
  buildBreatheTeasinglyOnPenisLyingCloseScenario,
  installLyingCloseUncoveredPenisScopeOverride,
} from '../../../common/mods/sex/breatheTeasinglyOnPenisLyingCloseFixtures.js';
import breatheTeasinglyOnPenisLyingCloseAction from '../../../../data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis_lying_close.action.json';

/**
 * Registers the lying-down teasing action for discovery.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([breatheTeasinglyOnPenisLyingCloseAction]);
}

describe('sex-penile-oral:breathe_teasingly_on_penis_lying_close action discovery', () => {
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

  it('appears when both participants are lying close on the same furniture with an uncovered penis', async () => {
    const { entities } = buildBreatheTeasinglyOnPenisLyingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("breathe teasingly on {primary}'s penis");
  });

  it("does not appear when the primary's penis is covered by clothing", async () => {
    const { entities } = buildBreatheTeasinglyOnPenisLyingCloseScenario({
      coverPrimaryPenis: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when the actor is not lying down (missing lying_down component)', async () => {
    const { entities } = buildBreatheTeasinglyOnPenisLyingCloseScenario({
      includeActorLying: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when the primary is not lying down', async () => {
    const { entities } = buildBreatheTeasinglyOnPenisLyingCloseScenario({
      includePrimaryLying: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear without mutual closeness', async () => {
    const { entities } = buildBreatheTeasinglyOnPenisLyingCloseScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when actors are lying on different furniture (different furniture_id values)', async () => {
    const { entities } = buildBreatheTeasinglyOnPenisLyingCloseScenario({
      useDifferentFurniture: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
