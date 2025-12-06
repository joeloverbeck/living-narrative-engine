/**
 * @file Integration tests for sex-dry-intimacy:rub_penis_against_penis action discovery.
 * @description Ensures the penis-to-penis rubbing action surfaces only when anatomy, exposure,
 * positioning, and closeness requirements are satisfied.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  buildRubPenisAgainstPenisScenario,
  RUB_PENIS_AGAINST_PENIS_ACTION_ID,
  RUB_PENIS_AGAINST_PENIS_ACTOR_ID,
  installPenisFacingEachOtherScopeOverride,
} from '../../../common/mods/sex-dry-intimacy/rubPenisAgainstPenisFixtures.js';
import rubPenisAgainstPenisAction from '../../../../data/mods/sex-dry-intimacy/actions/rub_penis_against_penis.action.json';

const ACTION_ID = RUB_PENIS_AGAINST_PENIS_ACTION_ID;
const ACTOR_ID = RUB_PENIS_AGAINST_PENIS_ACTOR_ID;

/**
 * @description Registers the rub penis against penis action for discovery.
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([rubPenisAgainstPenisAction]);
}

describe('sex-dry-intimacy:rub_penis_against_penis action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-dry-intimacy', ACTION_ID);
    restoreScopeResolver =
      installPenisFacingEachOtherScopeOverride(testFixture);
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

  it('appears when both participants are close with uncovered penises', async () => {
    const { entities } = buildRubPenisAgainstPenisScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actorEntity = testFixture.entityManager.getEntityInstance(ACTOR_ID);
    const prerequisitesPassed =
      testFixture.testEnv.prerequisiteService.evaluate(
        rubPenisAgainstPenisAction.prerequisites,
        rubPenisAgainstPenisAction,
        actorEntity
      );
    expect(prerequisitesPassed).toBe(true);
    expect(actorEntity.components['positioning:closeness']).toBeDefined();

    const candidateIds = testFixture.testEnv.actionIndex
      .getCandidateActions({ id: ACTOR_ID })
      .map((action) => action.id);
    expect(candidateIds).toContain(ACTION_ID);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe(
      "rub your penis against {primary}'s penis"
    );
  });

  it('does not appear when the actor lacks a penis', async () => {
    const { entities } = buildRubPenisAgainstPenisScenario({
      includeActorPenis: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actorEntity = testFixture.entityManager.getEntityInstance(ACTOR_ID);
    const prerequisitesPassed =
      testFixture.testEnv.prerequisiteService.evaluate(
        rubPenisAgainstPenisAction.prerequisites,
        rubPenisAgainstPenisAction,
        actorEntity
      );
    expect(prerequisitesPassed).toBe(false);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it("does not appear when the actor's penis is covered", async () => {
    const { entities } = buildRubPenisAgainstPenisScenario({
      coverActorPenis: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actorEntity = testFixture.entityManager.getEntityInstance(ACTOR_ID);
    const prerequisitesPassed =
      testFixture.testEnv.prerequisiteService.evaluate(
        rubPenisAgainstPenisAction.prerequisites,
        rubPenisAgainstPenisAction,
        actorEntity
      );
    expect(prerequisitesPassed).toBe(false);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it("does not appear when the target's penis is covered", async () => {
    const { entities } = buildRubPenisAgainstPenisScenario({
      coverTargetPenis: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear without closeness between the participants', async () => {
    const { entities } = buildRubPenisAgainstPenisScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when the target faces away from the actor', async () => {
    const { entities } = buildRubPenisAgainstPenisScenario({
      targetFacingAway: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when the actor faces away from the target', async () => {
    const { entities } = buildRubPenisAgainstPenisScenario({
      actorFacingAway: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
