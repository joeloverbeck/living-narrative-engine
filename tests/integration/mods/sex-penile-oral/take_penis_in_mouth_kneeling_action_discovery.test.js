/**
 * @file Integration tests for sex-penile-oral:take_penis_in_mouth_kneeling action discovery.
 * @description Validates that the action appears when actor is kneeling before partner with uncovered penis.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import takePenisInMouthKneelingAction from '../../../../data/mods/sex-penile-oral/actions/take_penis_in_mouth_kneeling.action.json';

const ACTION_ID = 'sex-penile-oral:take_penis_in_mouth_kneeling';

/**
 * Builds a scenario where the ACTOR is kneeling before PRIMARY who has an uncovered penis.
 *
 * @param {object} options - Configuration options.
 * @param {boolean} options.coverPrimaryPenis - Whether to cover primary's penis.
 * @param {boolean} options.includeKneeling - Whether actor is kneeling.
 * @param {boolean} options.includeCloseness - Whether closeness is established.
 * @param {boolean} options.actorGivingBlowjob - Whether actor already giving blowjob.
 * @param {boolean} options.includePrimaryPenis - Whether primary has penis anatomy.
 * @returns {{entities: Array, actorId: string, primaryId: string, roomId: string, primaryPenisId: string}} Scenario data.
 */
function buildTakePenisInMouthKneelingScenario(options = {}) {
  const {
    coverPrimaryPenis = false,
    includeKneeling = true,
    includeCloseness = true,
    actorGivingBlowjob = false,
    includePrimaryPenis = true,
  } = options;

  const ACTOR_ID = 'ava';
  const PRIMARY_ID = 'nolan';
  const ROOM_ID = 'bedroom1';

  const primaryTorsoId = `${PRIMARY_ID}_torso`;
  const primaryGroinId = `${PRIMARY_ID}_groin`;
  const primaryPenisId = `${primaryGroinId}_penis`;
  const primaryClothingId = `${PRIMARY_ID}_pants`;

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Private Bedroom')
    .asRoom('Private Bedroom')
    .build();

  const actorBuilder = new ModEntityBuilder(ACTOR_ID)
    .withName('Ava')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor();

  if (includeKneeling) {
    actorBuilder.kneelingBefore(PRIMARY_ID);
  }

  if (includeCloseness) {
    actorBuilder.closeToEntity(PRIMARY_ID);
  }

  if (actorGivingBlowjob) {
    actorBuilder.withComponent('positioning:giving_blowjob', {
      receiving_entity_id: 'someone_else',
      initiated: true,
    });
  }

  const primaryBuilder = new ModEntityBuilder(PRIMARY_ID)
    .withName('Nolan')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor();

  if (includePrimaryPenis) {
    primaryBuilder.withBody(primaryTorsoId);
  }

  if (includeCloseness) {
    primaryBuilder.closeToEntity(ACTOR_ID);
  }

  if (coverPrimaryPenis && includePrimaryPenis) {
    primaryBuilder
      .withComponent('clothing:equipment', {
        equipped: {
          torso_lower: {
            base: [primaryClothingId],
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

  const actor = actorBuilder.build();
  const primary = primaryBuilder.build();

  const entities = [room, actor, primary];

  if (includePrimaryPenis) {
    const primaryTorso = new ModEntityBuilder(primaryTorsoId)
      .asBodyPart({
        parent: null,
        children: [primaryGroinId],
        subType: 'torso',
      })
      .build();

    const primaryGroin = new ModEntityBuilder(primaryGroinId)
      .asBodyPart({
        parent: primaryTorsoId,
        children: [primaryPenisId],
        subType: 'groin',
      })
      .withComponent('anatomy:part', {
        parent: primaryTorsoId,
        children: [primaryPenisId],
        subType: 'groin',
        sockets: {
          penis: {
            coveredBy: coverPrimaryPenis ? primaryClothingId : null,
            attachedPart: primaryPenisId,
          },
        },
      })
      .build();

    const primaryPenis = new ModEntityBuilder(primaryPenisId)
      .asBodyPart({ parent: primaryGroinId, children: [], subType: 'penis' })
      .build();

    entities.push(primaryTorso, primaryGroin, primaryPenis);
  }

  if (coverPrimaryPenis && includePrimaryPenis) {
    const primaryClothing = new ModEntityBuilder(primaryClothingId)
      .withName('dark trousers')
      .build();
    entities.push(primaryClothing);
  }

  return {
    entities,
    actorId: ACTOR_ID,
    primaryId: PRIMARY_ID,
    roomId: ROOM_ID,
    primaryPenisId,
  };
}

/**
 * Installs a scope resolver override for actor_kneeling_before_target_with_penis.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 * @returns {() => void} Cleanup function restoring the original resolver.
 */
function installKneelingBeforeTargetWithPenisScopeOverride(fixture) {
  const resolver = fixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-core:actor_kneeling_before_target_with_penis') {
      const actorId = context?.actor?.id;
      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = fixture.entityManager.getEntityInstance(actorId);
      const closenessPartners = actor?.components?.['positioning:closeness']?.partners;
      const kneelingBefore = actor?.components?.['positioning:kneeling_before']?.entityId;

      if (!Array.isArray(closenessPartners) || closenessPartners.length === 0) {
        return { success: true, value: new Set() };
      }

      if (!kneelingBefore) {
        return { success: true, value: new Set() };
      }

      const validPartners = closenessPartners.filter((partnerId) => {
        if (partnerId !== kneelingBefore) {
          return false;
        }

        const partner = fixture.entityManager.getEntityInstance(partnerId);
        if (!partner) {
          return false;
        }

        // Check if partner has uncovered penis
        const bodyId = partner.components?.['anatomy:body']?.body?.root;
        if (!bodyId) {
          return false;
        }

        const bodyPart = fixture.entityManager.getEntityInstance(bodyId);
        if (!bodyPart) {
          return false;
        }

        // Simple check for penis in groin socket
        /**
         * Recursively checks if a body part or its children has an uncovered penis socket.
         *
         * @param {object} part - Body part entity to check.
         * @returns {boolean} True if uncovered penis socket found.
         */
        function hasPenisSocket(part) {
          const sockets = part.components?.['anatomy:part']?.sockets;
          if (sockets?.penis?.attachedPart) {
            return sockets.penis.coveredBy === null;
          }

          // Check children
          const children = part.components?.['anatomy:part']?.children || [];
          for (const childId of children) {
            const child = fixture.entityManager.getEntityInstance(childId);
            if (child && hasPenisSocket(child)) {
              return true;
            }
          }
          return false;
        }

        return hasPenisSocket(bodyPart);
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
 * Registers the take penis in mouth kneeling action for discovery.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([takePenisInMouthKneelingAction]);
}

describe('sex-penile-oral:take_penis_in_mouth_kneeling action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-penile-oral', ACTION_ID);
    restoreScopeResolver = installKneelingBeforeTargetWithPenisScopeOverride(testFixture);
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

  it('appears when actor is kneeling before partner with uncovered penis', async () => {
    const { entities, actorId } = buildTakePenisInMouthKneelingScenario();

    configureActionDiscovery(testFixture);
    testFixture.reset(entities);

    const actions = await testFixture.discoverActions(actorId);

    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("take {primary}'s cock in your mouth");
  });

  it("does not appear when the partner's penis is covered", async () => {
    const { entities, actorId } = buildTakePenisInMouthKneelingScenario({
      coverPrimaryPenis: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when actor is not kneeling', async () => {
    const { entities, actorId } = buildTakePenisInMouthKneelingScenario({
      includeKneeling: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when closeness is not established', async () => {
    const { entities, actorId } = buildTakePenisInMouthKneelingScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when actor is already giving a blowjob', async () => {
    const { entities, actorId } = buildTakePenisInMouthKneelingScenario({
      actorGivingBlowjob: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
