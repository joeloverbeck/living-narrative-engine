/**
 * @file Integration tests for sex-penile-oral:ejaculate_in_mouth action discovery.
 * @description Validates that the action appears when actor is receiving blowjob and can climax.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import ejaculateInMouthAction from '../../../../data/mods/sex-penile-oral/actions/ejaculate_in_mouth.action.json';

const ACTION_ID = 'sex-penile-oral:ejaculate_in_mouth';

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
function buildEjaculateInMouthScenario(options = {}) {
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
    actorBuilder.withComponent('sex-states:receiving_blowjob', {
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
    primaryBuilder.withComponent('sex-states:giving_blowjob', {
      receiving_entity_id: mismatchedReferences ? 'someone_else' : ACTOR_ID,
      initiated: true,
    });
  }

  if (includeCloseness) {
    primaryBuilder.closeToEntity(ACTOR_ID);
  }

  if (targetKneeling) {
    primaryBuilder.withComponent('positioning:kneeling_before', {
      kneeling_before_id: ACTOR_ID,
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
      const receivingBlowjob =
        actor?.components?.['sex-states:receiving_blowjob'];
      const closenessPartners =
        actor?.components?.['personal-space-states:closeness']?.partners;

      // IMPORTANT: No kneeling filter here (unlike positioning:close_actors)
      // This allows the action to work when target is kneeling before actor
      if (!receivingBlowjob || !Array.isArray(closenessPartners)) {
        return { success: true, value: new Set() };
      }

      const givingEntityId = receivingBlowjob.giving_entity_id;
      if (!givingEntityId) {
        return { success: true, value: new Set() };
      }

      // Check if giving entity exists and has matching giving_blowjob component
      const givingEntity =
        fixture.entityManager.getEntityInstance(givingEntityId);
      if (!givingEntity) {
        return { success: true, value: new Set() };
      }

      const givingBlowjob =
        givingEntity.components?.['sex-states:giving_blowjob'];
      if (!givingBlowjob) {
        return { success: true, value: new Set() };
      }

      // Validate bidirectional references
      if (
        givingBlowjob.receiving_entity_id === actorId &&
        closenessPartners.includes(givingEntityId)
      ) {
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
 * Registers the ejaculate in mouth action for discovery.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([ejaculateInMouthAction]);
}

describe('sex-penile-oral:ejaculate_in_mouth action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-penile-oral', ACTION_ID);
    restoreScopeResolver =
      installActorGivingBlowjobToMeScopeOverride(testFixture);
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

  it('appears when actor is receiving blowjob from partner', async () => {
    const { entities, actorId } = buildEjaculateInMouthScenario();

    configureActionDiscovery(testFixture);
    testFixture.reset(entities);

    const actions = await testFixture.discoverActions(actorId);

    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("ejaculate in {primary}'s mouth");
  });

  it('does not appear when actor lacks receiving_blowjob component', async () => {
    const { entities, actorId } = buildEjaculateInMouthScenario({
      includeReceivingBlowjob: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when closeness is not established', async () => {
    const { entities, actorId } = buildEjaculateInMouthScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when entity references are mismatched', async () => {
    const { entities, actorId } = buildEjaculateInMouthScenario({
      mismatchedReferences: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when target lacks giving_blowjob component', async () => {
    const { entities, actorId } = buildEjaculateInMouthScenario({
      targetHasGivingBlowjob: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('DOES appear when target is kneeling before actor', async () => {
    const { entities, actorId } = buildEjaculateInMouthScenario({
      targetKneeling: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("ejaculate in {primary}'s mouth");
  });

  it('discovers exactly one action when all prerequisites are met', async () => {
    const { entities, actorId } = buildEjaculateInMouthScenario();

    configureActionDiscovery(testFixture);
    testFixture.reset(entities);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.filter((action) => action.id === ACTION_ID);

    expect(discovered).toHaveLength(1);
  });
});
