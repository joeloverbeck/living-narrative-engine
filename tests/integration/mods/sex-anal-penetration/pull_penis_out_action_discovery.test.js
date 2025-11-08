/**
 * @file Integration tests for sex-anal-penetration:pull_penis_out action discovery.
 * @description Validates that the action appears when actor is anally penetrating partner.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import pullPenisOutAction from '../../../../data/mods/sex-anal-penetration/actions/pull_penis_out.action.json';

const ACTION_ID = 'sex-anal-penetration:pull_penis_out';

/**
 * Builds a scenario where the ACTOR is anally penetrating PRIMARY.
 *
 * @param {object} options - Configuration options.
 * @param {boolean} options.includeFuckingAnally - Whether actor has fucking_anally component.
 * @param {boolean} options.includeCloseness - Whether closeness is established.
 * @param {boolean} options.mismatchedReferences - Whether entity references don't match.
 * @param {boolean} options.targetHasBeingFuckedAnally - Whether target has being_fucked_anally.
 * @returns {{entities: Array, actorId: string, primaryId: string}} Scenario data.
 */
function buildPullPenisOutScenario(options = {}) {
  const {
    includeFuckingAnally = true,
    includeCloseness = true,
    mismatchedReferences = false,
    targetHasBeingFuckedAnally = true,
  } = options;

  const ACTOR_ID = 'marcus';
  const PRIMARY_ID = 'lena';
  const ROOM_ID = 'bedroom1';

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Private Bedroom')
    .asRoom('Private Bedroom')
    .build();

  const actorBuilder = new ModEntityBuilder(ACTOR_ID)
    .withName('Marcus')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor();

  if (includeFuckingAnally) {
    actorBuilder.withComponent('positioning:fucking_anally', {
      being_fucked_entity_id: mismatchedReferences ? 'someone_else' : PRIMARY_ID,
      initiated: true,
    });
  }

  if (includeCloseness) {
    actorBuilder.closeToEntity(PRIMARY_ID);
  }

  const primaryBuilder = new ModEntityBuilder(PRIMARY_ID)
    .withName('Lena')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor();

  if (targetHasBeingFuckedAnally) {
    primaryBuilder.withComponent('positioning:being_fucked_anally', {
      fucking_entity_id: mismatchedReferences ? 'someone_else' : ACTOR_ID,
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
 * Installs a scope resolver override for actor_being_fucked_anally_by_me that matches the scope logic.
 * This uses raw closeness.partners with anal penetration component validation.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 * @returns {() => void} Cleanup function restoring the original resolver.
 */
function installActorBeingFuckedAnallyByMeScopeOverride(fixture) {
  const resolver = fixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-anal-penetration:actor_being_fucked_anally_by_me') {
      const actorId = context?.actor?.id;
      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = fixture.entityManager.getEntityInstance(actorId);
      const fuckingAnally = actor?.components?.['positioning:fucking_anally'];
      const closenessPartners = actor?.components?.['positioning:closeness']?.partners;

      if (!fuckingAnally || !Array.isArray(closenessPartners)) {
        return { success: true, value: new Set() };
      }

      const beingFuckedEntityId = fuckingAnally.being_fucked_entity_id;
      if (!beingFuckedEntityId) {
        return { success: true, value: new Set() };
      }

      // Check if receiving entity exists and has matching being_fucked_anally component
      const receivingEntity = fixture.entityManager.getEntityInstance(beingFuckedEntityId);
      if (!receivingEntity) {
        return { success: true, value: new Set() };
      }

      const beingFuckedAnally = receivingEntity.components?.['positioning:being_fucked_anally'];
      if (!beingFuckedAnally) {
        return { success: true, value: new Set() };
      }

      // Validate bidirectional references
      if (
        beingFuckedAnally.fucking_entity_id === actorId &&
        closenessPartners.includes(beingFuckedEntityId)
      ) {
        return { success: true, value: new Set([beingFuckedEntityId]) };
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
 * Registers the pull penis out action for discovery.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([pullPenisOutAction]);
}

describe('sex-anal-penetration:pull_penis_out action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-anal-penetration', ACTION_ID);
    restoreScopeResolver = installActorBeingFuckedAnallyByMeScopeOverride(testFixture);
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

  it('appears when actor is anally penetrating partner', async () => {
    const { entities, actorId } = buildPullPenisOutScenario();

    configureActionDiscovery(testFixture);
    testFixture.reset(entities);

    const actions = await testFixture.discoverActions(actorId);

    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe('pull your penis out of {primary}');
  });

  it('does not appear when actor lacks fucking_anally component', async () => {
    const { entities, actorId } = buildPullPenisOutScenario({
      includeFuckingAnally: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when closeness is not established', async () => {
    const { entities, actorId } = buildPullPenisOutScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when entity references are mismatched', async () => {
    const { entities, actorId } = buildPullPenisOutScenario({
      mismatchedReferences: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when target lacks being_fucked_anally component', async () => {
    const { entities, actorId } = buildPullPenisOutScenario({
      targetHasBeingFuckedAnally: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('appears when actor is in various positions during anal penetration', async () => {
    // Test that action works regardless of position (standing, kneeling, etc.)
    const ACTOR_ID = 'marcus';
    const PRIMARY_ID = 'lena';
    const ROOM_ID = 'bedroom1';

    const room = new ModEntityBuilder(ROOM_ID)
      .withName('Private Bedroom')
      .asRoom('Private Bedroom')
      .build();

    const actorBuilder = new ModEntityBuilder(ACTOR_ID)
      .withName('Marcus')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor()
      .closeToEntity(PRIMARY_ID)
      .withComponent('positioning:fucking_anally', {
        being_fucked_entity_id: PRIMARY_ID,
        initiated: true,
      });

    const primaryBuilder = new ModEntityBuilder(PRIMARY_ID)
      .withName('Lena')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor()
      .closeToEntity(ACTOR_ID)
      .withComponent('positioning:being_fucked_anally', {
        fucking_entity_id: ACTOR_ID,
        consented: true,
      });

    const entities = [room, actorBuilder.build(), primaryBuilder.build()];
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe('pull your penis out of {primary}');
  });
});
