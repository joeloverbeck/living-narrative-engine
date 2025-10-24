/**
 * @file Integration tests for sex-penile-oral:pull_own_penis_out_of_mouth action discovery.
 * @description Validates that the action appears when actor is receiving blowjob from partner.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import pullOwnPenisOutOfMouthAction from '../../../../data/mods/sex-penile-oral/actions/pull_own_penis_out_of_mouth.action.json';

const ACTION_ID = 'sex-penile-oral:pull_own_penis_out_of_mouth';

/**
 * Builds a scenario where the ACTOR is receiving a blowjob from PRIMARY.
 *
 * @param {object} options - Configuration options.
 * @param {boolean} options.includeReceivingBlowjob - Whether actor has receiving_blowjob component.
 * @param {boolean} options.includeCloseness - Whether closeness is established.
 * @param {boolean} options.mismatchedReferences - Whether entity references don't match.
 * @param {boolean} options.targetHasGivingBlowjob - Whether target has giving_blowjob.
 * @param {boolean} options.targetKneeling - Whether target is kneeling before actor.
 * @returns {{entities: Array, actorId: string, primaryId: string}} Scenario data.
 */
function buildPullOwnPenisOutScenario(options = {}) {
  const {
    includeReceivingBlowjob = true,
    includeCloseness = true,
    mismatchedReferences = false,
    targetHasGivingBlowjob = true,
    targetKneeling = false,
  } = options;

  const ACTOR_ID = 'nolan';
  const PRIMARY_ID = 'ava';
  const ROOM_ID = 'bedroom1';

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Private Bedroom')
    .asRoom('Private Bedroom')
    .build();

  const actorBuilder = new ModEntityBuilder(ACTOR_ID)
    .withName('Nolan')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor();

  if (includeReceivingBlowjob) {
    actorBuilder.withComponent('positioning:receiving_blowjob', {
      giving_entity_id: mismatchedReferences ? 'someone_else' : PRIMARY_ID,
      consented: true,
    });
  }

  if (includeCloseness) {
    actorBuilder.closeToEntity(PRIMARY_ID);
  }

  const primaryBuilder = new ModEntityBuilder(PRIMARY_ID)
    .withName('Ava')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor();

  if (targetHasGivingBlowjob) {
    primaryBuilder.withComponent('positioning:giving_blowjob', {
      receiving_entity_id: mismatchedReferences ? 'someone_else' : ACTOR_ID,
      initiated: true,
    });
  }

  if (includeCloseness) {
    primaryBuilder.closeToEntity(ACTOR_ID);
  }

  if (targetKneeling) {
    primaryBuilder.withComponent('positioning:kneeling_before', {
      target_id: ACTOR_ID,
    });
  }

  return {
    entities: [room, actorBuilder.build(), primaryBuilder.build()],
    actorId: ACTOR_ID,
    primaryId: PRIMARY_ID,
  };
}

/**
 * Installs a scope resolver override for actor_giving_blowjob_to_me that matches the fixed scope logic.
 * This uses raw closeness.partners (no kneeling filter) with blowjob component validation.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 * @returns {() => void} Cleanup function restoring the original resolver.
 */
function installActorGivingBlowjobToMeScopeOverride(fixture) {
  const resolver = fixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-penile-oral:actor_giving_blowjob_to_me') {
      const actorId = context?.actor?.id;
      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = fixture.entityManager.getEntityInstance(actorId);
      const receivingBlowjob = actor?.components?.['positioning:receiving_blowjob'];
      const closenessPartners = actor?.components?.['positioning:closeness']?.partners;

      if (!receivingBlowjob || !Array.isArray(closenessPartners)) {
        return { success: true, value: new Set() };
      }

      const givingEntityId = receivingBlowjob.giving_entity_id;
      if (!givingEntityId) {
        return { success: true, value: new Set() };
      }

      const target = fixture.entityManager.getEntityInstance(givingEntityId);
      const targetGivingBlowjob = target?.components?.['positioning:giving_blowjob'];

      // Validate bidirectional references and closeness
      const referencesMatch =
        targetGivingBlowjob?.receiving_entity_id === actorId &&
        receivingBlowjob.giving_entity_id === givingEntityId;

      const isClose = closenessPartners.includes(givingEntityId);

      if (referencesMatch && isClose) {
        return { success: true, value: new Set([givingEntityId]) };
      }

      return { success: true, value: new Set() };
    }

    return originalResolveSync(scopeName, context);
  };

  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}

/**
 * Registers the pull own penis out of mouth action for discovery.
 *
 * @param {object} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([pullOwnPenisOutOfMouthAction]);
}

describe('sex-penile-oral:pull_own_penis_out_of_mouth - Action Discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-penile-oral', ACTION_ID);
    restoreScopeResolver = installActorGivingBlowjobToMeScopeOverride(testFixture);
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

  it('should discover action when actor is receiving blowjob from partner', async () => {
    const scenario = buildPullOwnPenisOutScenario();
    configureActionDiscovery(testFixture);
    testFixture.reset(scenario.entities);

    const actions = await testFixture.discoverActions(scenario.actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("pull out your cock out of {primary}'s mouth");
  });

  it('should NOT discover action when actor lacks receiving_blowjob component', async () => {
    const scenario = buildPullOwnPenisOutScenario({
      includeReceivingBlowjob: false,
    });
    configureActionDiscovery(testFixture);
    testFixture.reset(scenario.entities);

    const actions = await testFixture.discoverActions(scenario.actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('should NOT discover action when closeness is not established', async () => {
    const scenario = buildPullOwnPenisOutScenario({
      includeCloseness: false,
    });
    configureActionDiscovery(testFixture);
    testFixture.reset(scenario.entities);

    const actions = await testFixture.discoverActions(scenario.actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('should NOT discover action when entity references are mismatched', async () => {
    const scenario = buildPullOwnPenisOutScenario({
      mismatchedReferences: true,
    });
    configureActionDiscovery(testFixture);
    testFixture.reset(scenario.entities);

    const actions = await testFixture.discoverActions(scenario.actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('should NOT discover action when target lacks giving_blowjob component', async () => {
    const scenario = buildPullOwnPenisOutScenario({
      targetHasGivingBlowjob: false,
    });
    configureActionDiscovery(testFixture);
    testFixture.reset(scenario.entities);

    const actions = await testFixture.discoverActions(scenario.actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('should discover action when target is kneeling before actor (regression test)', async () => {
    const scenario = buildPullOwnPenisOutScenario({
      targetKneeling: true,
    });
    configureActionDiscovery(testFixture);
    testFixture.reset(scenario.entities);

    const actions = await testFixture.discoverActions(scenario.actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("pull out your cock out of {primary}'s mouth");
  });
});
