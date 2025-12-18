/**
 * @file Integration tests for sex-penile-oral:guide_blowjob_with_hand action discovery.
 * @description Validates that the action appears when actor is receiving blowjob from partner.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import guideBlowjobWithHandAction from '../../../../data/mods/sex-penile-oral/actions/guide_blowjob_with_hand.action.json';

const ACTION_ID = 'sex-penile-oral:guide_blowjob_with_hand';

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
function buildGuideBlowjobScenario(options = {}) {
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

  if (targetKneeling) {
    primaryBuilder.kneelingBefore(ACTOR_ID);
  }

  if (targetHasGivingBlowjob) {
    primaryBuilder.withComponent('sex-states:giving_blowjob', {
      receiving_entity_id: mismatchedReferences ? 'someone_else' : ACTOR_ID,
      initiated: true,
    });
  }

  if (includeCloseness) {
    primaryBuilder.closeToEntity(ACTOR_ID);
  }

  return {
    entities: [room, actorBuilder.build(), primaryBuilder.build()],
    actorId: ACTOR_ID,
    primaryId: PRIMARY_ID,
  };
}

/**
 * Installs a scope resolver override for actor_giving_blowjob_to_me that matches the fixed scope logic.
 * This resolves to the entity currently giving the actor a blowjob.
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
        actor?.components?.['positioning:closeness']?.partners;

      // IMPORTANT: No kneeling filter here (same as receiving_blowjob_from_actor)
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
 * Registers the guide blowjob with hand action for discovery.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([guideBlowjobWithHandAction]);
}

describe('sex-penile-oral:guide_blowjob_with_hand action discovery', () => {
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
    const { entities, actorId } = buildGuideBlowjobScenario();

    configureActionDiscovery(testFixture);
    testFixture.reset(entities);

    const actions = await testFixture.discoverActions(actorId);

    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe(
      "guide {primary}'s blowjob with your hand"
    );
  });

  it('does not appear when actor lacks receiving_blowjob component', async () => {
    const { entities, actorId } = buildGuideBlowjobScenario({
      includeReceivingBlowjob: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when closeness is not established', async () => {
    const { entities, actorId } = buildGuideBlowjobScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when entity references are mismatched', async () => {
    const { entities, actorId } = buildGuideBlowjobScenario({
      mismatchedReferences: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when target lacks giving_blowjob component', async () => {
    const { entities, actorId } = buildGuideBlowjobScenario({
      targetHasGivingBlowjob: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('DOES appear when target is kneeling before actor (regression test)', async () => {
    // This is the key test - the scope should allow kneeling scenarios
    // where the giving partner kneels before the receiving partner
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
      .asActor()
      .closeToEntity(PRIMARY_ID)
      .withComponent('sex-states:receiving_blowjob', {
        giving_entity_id: PRIMARY_ID,
        consented: true,
      });

    const primaryBuilder = new ModEntityBuilder(PRIMARY_ID)
      .withName('Ava')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor()
      .kneelingBefore(ACTOR_ID) // KEY: Target is kneeling
      .closeToEntity(ACTOR_ID)
      .withComponent('sex-states:giving_blowjob', {
        receiving_entity_id: ACTOR_ID,
        initiated: true,
      });

    const entities = [room, actorBuilder.build(), primaryBuilder.build()];
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    // This should PASS with the raw closeness.partners scope
    expect(discovered).toBeDefined();
    expect(discovered.template).toBe(
      "guide {primary}'s blowjob with your hand"
    );
  });
});
