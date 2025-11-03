/**
 * @file Integration tests for sex-physical-control:pull_head_to_clothed_crotch action discovery.
 * @description Validates seated clothed crotch dominance availability for close, seated partners.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  PULL_HEAD_TO_CLOTHED_CROTCH_ACTION_ID as ACTION_ID,
  PULL_HEAD_TO_CLOTHED_CROTCH_ACTOR_ID as ACTOR_ID,
  buildPullHeadToClothedCrotchScenario,
  installActorsSittingCloseScopeOverride,
} from '../../../common/mods/sex-physical-control/pullHeadToClothedCrotchFixtures.js';
import pullHeadToClothedCrotchAction from '../../../../data/mods/sex-physical-control/actions/pull_head_to_clothed_crotch.action.json';

/**
 * @description Registers the pull head to clothed crotch action for discovery.
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([pullHeadToClothedCrotchAction]);
}

describe('sex-physical-control:pull_head_to_clothed_crotch action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-physical-control', ACTION_ID);
    restoreScopeResolver = installActorsSittingCloseScopeOverride(testFixture);
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

  it('appears when both participants are seated close and the actor stays clothed', async () => {
    const { entities } = buildPullHeadToClothedCrotchScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("pull {primary}'s head to your clothed crotch");
  });

  it("does not appear when the actor's penis is uncovered", async () => {
    const { entities } = buildPullHeadToClothedCrotchScenario({ coverActorPenis: false });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when the actor is not sitting', async () => {
    const { entities } = buildPullHeadToClothedCrotchScenario({ includeActorSitting: false });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear without mutual closeness', async () => {
    const { entities } = buildPullHeadToClothedCrotchScenario({ includeCloseness: false });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
