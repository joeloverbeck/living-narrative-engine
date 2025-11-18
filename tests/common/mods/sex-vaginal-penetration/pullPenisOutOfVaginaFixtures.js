/**
 * @file Shared fixtures for pull_penis_out_of_vagina action tests.
 * @description Provides reusable builders and scope helpers for vaginal penetration withdrawal scenarios.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';

export const ACTION_ID = 'sex-vaginal-penetration:pull_penis_out_of_vagina';
export const SCOPE_NAME = 'sex-vaginal-penetration:actors_being_fucked_vaginally_by_me';

/**
 * @typedef {object} PenetrationScenarioOptions
 * @property {boolean} [includeCloseness=true] - Whether partners are close
 * @property {boolean} [includePenetrationComponents=true] - Whether to add fucking/being_fucked components
 * @property {boolean} [includePenis=true] - Whether actor has penis
 * @property {boolean} [includeVagina=true] - Whether target has vagina
 * @property {boolean} [coverPenis=false] - Whether penis is covered
 * @property {boolean} [actorId='alice'] - Actor entity ID
 * @property {boolean} [targetId='beth'] - Target entity ID
 * @property {boolean} [roomId='bedroom'] - Room entity ID
 */

/**
 * Builds a penetration scenario with alice penetrating beth.
 *
 * @param {PenetrationScenarioOptions} [options] - Scenario options
 * @returns {Array<object>} Array of entities
 */
export function buildPenetrationScenario(options = {}) {
  const {
    includeCloseness = true,
    includePenetrationComponents = true,
    includePenis = true,
    includeVagina = true,
    coverPenis = false,
    actorId = 'alice',
    targetId = 'beth',
    roomId = 'bedroom',
  } = options;

  const room = new ModEntityBuilder(roomId).asRoom('Bedroom').build();

  const actorBuilder = new ModEntityBuilder(actorId)
    .withName('Alice', 'Smith')
    .atLocation(roomId)
    .asActor();

  const targetBuilder = new ModEntityBuilder(targetId)
    .withName('Beth', 'Jones')
    .atLocation(roomId)
    .asActor();

  if (includeCloseness) {
    actorBuilder.closeToEntity(targetId);
    targetBuilder.closeToEntity(actorId);
  }

  if (includePenetrationComponents) {
    actorBuilder.withComponent('positioning:fucking_vaginally', {
      targetId: targetId,
    });
    targetBuilder.withComponent('positioning:being_fucked_vaginally', {
      actorId: actorId,
    });
  }

  const entities = [room, actorBuilder.build(), targetBuilder.build()];

  // Add anatomy parts if requested
  if (includePenis) {
    const actorGroinId = `${actorId}Groin`;
    const actorPenisId = `${actorId}Penis`;

    actorBuilder.withBody(actorGroinId);

    const actorGroin = new ModEntityBuilder(actorGroinId)
      .asBodyPart({ parent: null, children: [actorPenisId], subType: 'groin' })
      .build();

    const actorPenis = new ModEntityBuilder(actorPenisId)
      .asBodyPart({ parent: actorGroinId, children: [], subType: 'penis' })
      .build();

    entities.push(actorGroin, actorPenis);
  }

  if (includeVagina) {
    const targetPelvisId = `${targetId}Pelvis`;
    const targetVaginaId = `${targetId}Vagina`;

    targetBuilder.withBody(targetPelvisId);

    const targetPelvis = new ModEntityBuilder(targetPelvisId)
      .asBodyPart({ parent: null, children: [targetVaginaId], subType: 'pelvis' })
      .build();

    const targetVagina = new ModEntityBuilder(targetVaginaId)
      .asBodyPart({ parent: targetPelvisId, children: [], subType: 'vagina' })
      .build();

    entities.push(targetPelvis, targetVagina);
  }

  if (coverPenis && includePenis) {
    actorBuilder
      .withComponent('clothing:equipment', {
        equipped: { torso_lower: { base: [`${actorId}_underwear`] } },
      })
      .withComponent('clothing:slot_metadata', {
        slotMappings: {
          torso_lower: { coveredSockets: ['penis'] },
        },
      });
  }

  // Rebuild actor and target with updated components
  entities[1] = actorBuilder.build();
  entities[2] = targetBuilder.build();

  return entities;
}

/**
 * Resolves the actors_being_fucked_vaginally_by_me scope.
 * Filters partners from closeness who have being_fucked_vaginally with matching actorId.
 *
 * @param {object} testFixture - Test fixture
 * @param {object} context - Scope resolution context
 * @returns {{ success: boolean, value: Set<string> }} Resolution result
 */
function resolveBeingFuckedVaginallyScope(testFixture, context) {
  const actorId = context?.actor?.id;

  if (!actorId) {
    return { success: true, value: new Set() };
  }

  const actorEntity = testFixture.entityManager.getEntityInstance(actorId);
  const closeness = actorEntity?.components?.['positioning:closeness'];
  const partners = Array.isArray(closeness?.partners) ? closeness.partners : [];

  if (partners.length === 0) {
    return { success: true, value: new Set() };
  }

  const validPartners = partners.filter((partnerId) => {
    const partner = testFixture.entityManager.getEntityInstance(partnerId);

    if (!partner) {
      return false;
    }

    const beingFucked = partner.components?.['positioning:being_fucked_vaginally'];
    if (!beingFucked) {
      return false;
    }

    // Check if the target is being fucked by this specific actor
    return beingFucked.actorId === actorId;
  });

  return { success: true, value: new Set(validPartners) };
}

/**
 * Installs scope override for actors_being_fucked_vaginally_by_me.
 *
 * @param {object} testFixture - Test fixture
 * @returns {() => void} Cleanup function to restore original resolver
 */
export function installPullOutScopeOverride(testFixture) {
  const resolver = testFixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === SCOPE_NAME) {
      return resolveBeingFuckedVaginallyScope(testFixture, context);
    }

    return originalResolveSync(scopeName, context);
  };

  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}
