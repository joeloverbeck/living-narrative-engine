/**
 * @file Integration tests for sex-physical-control:pull_head_to_bare_penis action discovery.
 * @description Validates that the action appears when actor has uncovered penis and both are sitting close.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import pullHeadToBarePenisAction from '../../../../data/mods/sex-physical-control/actions/pull_head_to_bare_penis.action.json';

const ACTION_ID = 'sex-physical-control:pull_head_to_bare_penis';

/**
 * Builds a scenario where the ACTOR has an uncovered penis and both are sitting close.
 * This differs from breathe teasingly fixture where PRIMARY has the penis.
 *
 * @param {object} options - Configuration options.
 * @param {boolean} options.coverActorPenis - Whether to cover actor's penis.
 * @param {boolean} options.includeActorSitting - Whether actor is sitting.
 * @param {boolean} options.includePrimarySitting - Whether primary is sitting.
 * @param {boolean} options.includeCloseness - Whether closeness is established.
 * @param {boolean} options.includeActorPenis - Whether actor has penis anatomy.
 * @returns {{entities: Array, actorId: string, primaryId: string, roomId: string, furnitureId: string, actorPenisId: string}} Scenario data.
 */
function buildPullHeadToBarePenisScenario(options = {}) {
  const {
    coverActorPenis = false,
    includeActorSitting = true,
    includePrimarySitting = true,
    includeCloseness = true,
    includeActorPenis = true,
  } = options;

  const ACTOR_ID = 'dante';
  const PRIMARY_ID = 'mira';
  const ROOM_ID = 'parlor1';
  const FURNITURE_ID = 'couch1';

  const actorTorsoId = `${ACTOR_ID}_torso`;
  const actorGroinId = `${ACTOR_ID}_groin`;
  const actorPenisId = `${actorGroinId}_penis`;
  const actorClothingId = `${ACTOR_ID}_pants`;

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Private Parlor')
    .asRoom('Private Parlor')
    .build();

  const furniture = new ModEntityBuilder(FURNITURE_ID)
    .withName('Velvet Couch')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .withComponent('sitting:allows_sitting', {
      spots: [
        includeActorSitting ? ACTOR_ID : null,
        includePrimarySitting ? PRIMARY_ID : null,
      ],
    })
    .build();

  const actorBuilder = new ModEntityBuilder(ACTOR_ID)
    .withName('Dante')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor();

  if (includeActorPenis) {
    actorBuilder.withBody(actorTorsoId);
  }

  if (includeActorSitting) {
    actorBuilder.withComponent('positioning:sitting_on', {
      furniture_id: FURNITURE_ID,
      spot_index: 0,
    });
  }

  if (includeCloseness) {
    actorBuilder.closeToEntity(PRIMARY_ID);
  }

  if (coverActorPenis && includeActorPenis) {
    actorBuilder
      .withComponent('clothing:equipment', {
        equipped: {
          torso_lower: {
            base: [actorClothingId],
          },
        },
      })
      .withComponent('clothing:slot_metadata', {
        slotMappings: {
          torso_lower: {
            coveredSockets: ['penis'],
            allowedLayers: ['base', 'outer'],
          },
        },
      });
  }

  const primaryBuilder = new ModEntityBuilder(PRIMARY_ID)
    .withName('Mira')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor();

  if (includePrimarySitting) {
    primaryBuilder.withComponent('positioning:sitting_on', {
      furniture_id: FURNITURE_ID,
      spot_index: 1,
    });
  }

  if (includeCloseness) {
    primaryBuilder.closeToEntity(ACTOR_ID);
  }

  const actor = actorBuilder.build();
  const primary = primaryBuilder.build();

  const entities = [room, furniture, actor, primary];

  if (includeActorPenis) {
    const actorTorso = new ModEntityBuilder(actorTorsoId)
      .asBodyPart({
        parent: null,
        children: [actorGroinId],
        subType: 'torso',
      })
      .build();

    const actorGroin = new ModEntityBuilder(actorGroinId)
      .asBodyPart({
        parent: actorTorsoId,
        children: [actorPenisId],
        subType: 'groin',
        sockets: {
          penis: { coveredBy: null, attachedPart: actorPenisId },
        },
      })
      .build();

    const actorPenis = new ModEntityBuilder(actorPenisId)
      .asBodyPart({ parent: actorGroinId, children: [], subType: 'penis' })
      .build();

    entities.push(actorTorso, actorGroin, actorPenis);
  }

  if (coverActorPenis && includeActorPenis) {
    const actorClothing = new ModEntityBuilder(actorClothingId)
      .withName('dark trousers')
      .build();
    entities.push(actorClothing);
  }

  return {
    entities,
    actorId: ACTOR_ID,
    primaryId: PRIMARY_ID,
    roomId: ROOM_ID,
    furnitureId: FURNITURE_ID,
    actorPenisId,
  };
}

/**
 * Installs a scope resolver override for actors_sitting_close.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 * @returns {() => void} Cleanup function restoring the original resolver.
 */
function installActorsSittingCloseScopeOverride(fixture) {
  const resolver = fixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sitting:actors_sitting_close') {
      const actorId = context?.actor?.id;
      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = fixture.entityManager.getEntityInstance(actorId);
      const closenessPartners =
        actor?.components?.['personal-space-states:closeness']?.partners;

      if (!Array.isArray(closenessPartners) || closenessPartners.length === 0) {
        return { success: true, value: new Set() };
      }

      const validPartners = closenessPartners.filter((partnerId) => {
        const partner = fixture.entityManager.getEntityInstance(partnerId);
        if (!partner) {
          return false;
        }

        // Both must be sitting
        return Boolean(partner.components?.['positioning:sitting_on']);
      });

      return { success: true, value: new Set(validPartners) };
    }

    return originalResolveSync(scopeName, context);
  };

  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}

/**
 * Registers the pull head to bare penis action for discovery.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([pullHeadToBarePenisAction]);
}

describe('sex-physical-control:pull_head_to_bare_penis action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-physical-control',
      ACTION_ID
    );
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

  it('appears when actor has uncovered penis and both are sitting close', async () => {
    const { entities, actorId } = buildPullHeadToBarePenisScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe(
      "pull {primary}'s head onto your bare penis"
    );
  });

  it("does not appear when actor's penis is covered", async () => {
    const { entities, actorId } = buildPullHeadToBarePenisScenario({
      coverActorPenis: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when actor is not sitting', async () => {
    const { entities, actorId } = buildPullHeadToBarePenisScenario({
      includeActorSitting: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when closeness is not established', async () => {
    const { entities, actorId } = buildPullHeadToBarePenisScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when actor is already receiving a blowjob', async () => {
    const { entities, actorId } = buildPullHeadToBarePenisScenario();

    // Add receiving_blowjob component to actor
    const actorEntity = entities.find((e) => e.id === actorId);
    if (!actorEntity.components) actorEntity.components = {};
    actorEntity.components['sex-states:receiving_blowjob'] = {
      giving_entity_id: 'someone_else',
      consented: true,
    };

    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when actor lacks penis anatomy', async () => {
    const { entities, actorId } = buildPullHeadToBarePenisScenario({
      includeActorPenis: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
