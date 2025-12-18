/**
 * @file Integration tests for sex-penile-oral:take_penis_in_mouth action discovery.
 * @description Validates the seated penis-in-mouth action availability for close partners with an exposed penis.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  buildBreatheTeasinglyOnPenisSittingCloseScenario,
  installSittingCloseUncoveredPenisScopeOverride,
} from '../../../common/mods/sex/breatheTeasinglyOnPenisSittingCloseFixtures.js';
import takePenisInMouthAction from '../../../../data/mods/sex-penile-oral/actions/take_penis_in_mouth.action.json';

const ACTION_ID = 'sex-penile-oral:take_penis_in_mouth';

/**
 * Registers the take penis in mouth action for discovery.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([takePenisInMouthAction]);
}

describe('sex-penile-oral:take_penis_in_mouth action discovery', () => {
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
    expect(discovered.template).toBe("take {primary}'s penis in your mouth");
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

  it('does not appear when closeness is not established', async () => {
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

  it('does not appear when the actor is already giving a blowjob', async () => {
    const { entities, actorId } =
      buildBreatheTeasinglyOnPenisSittingCloseScenario();
    testFixture.reset(entities);

    // Manually add giving_blowjob component to actor using entity ID
    testFixture.entityManager.addComponent(
      actorId,
      'sex-states:giving_blowjob',
      {
        receiving_entity_id: 'some_other_entity',
        initiated: true,
      }
    );

    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
