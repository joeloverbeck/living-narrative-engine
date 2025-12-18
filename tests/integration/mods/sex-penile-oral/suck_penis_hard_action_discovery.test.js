/**
 * @file Integration tests for sex-penile-oral:suck_penis_hard action discovery.
 * @description Validates that the action appears when actor is giving blowjob with hard intensity intent.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import suckPenisHardAction from '../../../../data/mods/sex-penile-oral/actions/suck_penis_hard.action.json';

const ACTION_ID = 'sex-penile-oral:suck_penis_hard';

/**
 * Builds a scenario where the ACTOR is giving a blowjob to PRIMARY with hard intensity intent.
 *
 * @param {object} options - Configuration options.
 * @param {boolean} options.includeGivingBlowjob - Whether actor has giving_blowjob component.
 * @param {boolean} options.includeCloseness - Whether closeness is established.
 * @param {boolean} options.mismatchedReferences - Whether entity references don't match.
 * @param {boolean} options.targetHasReceivingBlowjob - Whether target has receiving_blowjob.
 * @returns {{entities: Array, actorId: string, primaryId: string}} Scenario data.
 */
function buildSuckPenisHardScenario(options = {}) {
  const {
    includeGivingBlowjob = true,
    includeCloseness = true,
    mismatchedReferences = false,
    targetHasReceivingBlowjob = true,
  } = options;

  const ACTOR_ID = 'ava';
  const PRIMARY_ID = 'nolan';
  const ROOM_ID = 'bedroom1';

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Private Bedroom')
    .asRoom('Private Bedroom')
    .build();

  const actorBuilder = new ModEntityBuilder(ACTOR_ID)
    .withName('Ava')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor();

  if (includeGivingBlowjob) {
    actorBuilder.withComponent('sex-states:giving_blowjob', {
      receiving_entity_id: mismatchedReferences ? 'someone_else' : PRIMARY_ID,
      initiated: true,
    });
  }

  if (includeCloseness) {
    actorBuilder.closeToEntity(PRIMARY_ID);
  }

  const primaryBuilder = new ModEntityBuilder(PRIMARY_ID)
    .withName('Nolan')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor();

  if (targetHasReceivingBlowjob) {
    primaryBuilder.withComponent('sex-states:receiving_blowjob', {
      giving_entity_id: mismatchedReferences ? 'someone_else' : ACTOR_ID,
      consented: true,
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
 * Installs a scope resolver override for receiving_blowjob_from_actor that matches the fixed scope logic.
 * This uses raw closeness.partners (no kneeling filter) with blowjob component validation.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 * @returns {() => void} Cleanup function restoring the original resolver.
 */
function installReceivingBlowjobFromActorScopeOverride(fixture) {
  const resolver = fixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-penile-oral:receiving_blowjob_from_actor') {
      const actorId = context?.actor?.id;
      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = fixture.entityManager.getEntityInstance(actorId);
      const givingBlowjob = actor?.components?.['sex-states:giving_blowjob'];
      const closenessPartners =
        actor?.components?.['positioning:closeness']?.partners;

      // IMPORTANT: No kneeling filter here (unlike positioning:close_actors)
      // This allows the action to work when actor is kneeling before target
      if (!givingBlowjob || !Array.isArray(closenessPartners)) {
        return { success: true, value: new Set() };
      }

      const receivingEntityId = givingBlowjob.receiving_entity_id;
      if (!receivingEntityId) {
        return { success: true, value: new Set() };
      }

      // Check if receiving entity exists and has matching receiving_blowjob component
      const receivingEntity =
        fixture.entityManager.getEntityInstance(receivingEntityId);
      if (!receivingEntity) {
        return { success: true, value: new Set() };
      }

      const receivingBlowjob =
        receivingEntity.components?.['sex-states:receiving_blowjob'];
      if (!receivingBlowjob) {
        return { success: true, value: new Set() };
      }

      // Validate bidirectional references
      if (
        receivingBlowjob.giving_entity_id === actorId &&
        closenessPartners.includes(receivingEntityId)
      ) {
        return { success: true, value: new Set([receivingEntityId]) };
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
 * Registers the suck penis hard action for discovery.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([suckPenisHardAction]);
}

describe('sex-penile-oral:suck_penis_hard action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-penile-oral', ACTION_ID);
    restoreScopeResolver =
      installReceivingBlowjobFromActorScopeOverride(testFixture);
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

  it('appears when actor is giving blowjob to partner with hard intensity', async () => {
    const { entities, actorId } = buildSuckPenisHardScenario();

    configureActionDiscovery(testFixture);
    testFixture.reset(entities);

    const actions = await testFixture.discoverActions(actorId);

    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("suck {primary}'s cock hard");
  });

  it('does not appear when actor lacks giving_blowjob component', async () => {
    const { entities, actorId } = buildSuckPenisHardScenario({
      includeGivingBlowjob: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when closeness is not established', async () => {
    const { entities, actorId } = buildSuckPenisHardScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when entity references are mismatched', async () => {
    const { entities, actorId } = buildSuckPenisHardScenario({
      mismatchedReferences: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when target lacks receiving_blowjob component', async () => {
    const { entities, actorId } = buildSuckPenisHardScenario({
      targetHasReceivingBlowjob: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('discovers exactly one action when all prerequisites are met', async () => {
    const { entities, actorId } = buildSuckPenisHardScenario();

    configureActionDiscovery(testFixture);
    testFixture.reset(entities);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.filter((action) => action.id === ACTION_ID);

    expect(discovered).toHaveLength(1);
  });
});
