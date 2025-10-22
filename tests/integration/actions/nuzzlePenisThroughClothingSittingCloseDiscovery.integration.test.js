/**
 * @file Integration tests for nuzzle_penis_through_clothing_sitting_close action discovery.
 * @description Validates the seated clothed nuzzling action availability for partners sharing close seating.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import {
  buildBreatheTeasinglyOnPenisSittingCloseScenario,
  installSittingCloseCoveredPenisScopeOverride,
} from '../../common/mods/sex/breatheTeasinglyOnPenisSittingCloseFixtures.js';
import nuzzlePenisThroughClothingSittingCloseAction from '../../../data/mods/sex-penile-oral/actions/nuzzle_penis_through_clothing_sitting_close.action.json';

const ACTION_ID = 'sex-penile-oral:nuzzle_penis_through_clothing_sitting_close';

/**
 * @description Registers the seated clothed nuzzle action for discovery.
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([nuzzlePenisThroughClothingSittingCloseAction]);
}

describe('sex-penile-oral:nuzzle_penis_through_clothing_sitting_close action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-penile-oral', ACTION_ID);
    restoreScopeResolver = installSittingCloseCoveredPenisScopeOverride(testFixture);
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

  it('appears when both participants sit close together with a clothed penis', async () => {
    const { entities, actorId } = buildBreatheTeasinglyOnPenisSittingCloseScenario({
      coverPrimaryPenis: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("nuzzle against {primary}'s penis through the {secondary}");
  });

  it('does not appear when the partner\'s penis is uncovered', async () => {
    const { entities, actorId } = buildBreatheTeasinglyOnPenisSittingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when the actor is not sitting', async () => {
    const { entities, actorId } = buildBreatheTeasinglyOnPenisSittingCloseScenario({
      coverPrimaryPenis: true,
      includeActorSitting: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear without mutual closeness', async () => {
    const { entities, actorId } = buildBreatheTeasinglyOnPenisSittingCloseScenario({
      coverPrimaryPenis: true,
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
