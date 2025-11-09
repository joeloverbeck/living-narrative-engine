/**
 * @file Shared fixtures for the straddling penis milking and greedy riding action suites.
 * @description Provides reusable builders and scope helpers tailored for vaginal milking scenarios while straddling a partner,
 * and documents aliases used by additional riding actions so future vaginal penetration rides can share them.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';

/**
 * Identifier for the straddling penis milking action.
 * @type {string}
 */
export const STRADDLING_MILKING_ACTION_ID =
  'sex-vaginal-penetration:straddling_penis_milking';

/**
 * Identifier for the ride penis greedily action.
 * @type {string}
 */
export const RIDE_PENIS_GREEDILY_ACTION_ID =
  'sex-vaginal-penetration:ride_penis_greedily';

/**
 * Default actor identifier used in the shared scenarios.
 * @type {string}
 */
export const STRADDLING_MILKING_ACTOR_ID = 'selene';

/**
 * Default primary partner identifier used in the shared scenarios.
 * @type {string}
 */
export const STRADDLING_MILKING_PRIMARY_ID = 'marcus';

/**
 * Default room identifier for the shared scenarios.
 * @type {string}
 */
export const STRADDLING_MILKING_ROOM_ID = 'velvet_suite';

const PENIS_SCOPE_NAME =
  'sex-vaginal-penetration:actors_with_uncovered_penis_facing_each_other_or_target_facing_away';

/**
 * @typedef {object} StraddlingMilkingScenarioOptions
 * @description Configuration options for building a straddling milking scenario.
 * @property {boolean} [includeCloseness=true] - Whether to establish closeness between the partners.
 * @property {boolean} [includeStraddling=true] - Whether the actor starts straddling the partner.
 * @property {boolean} [targetFacingAway=false] - Whether the partner is facing away from the actor.
 * @property {boolean} [coverPenis=false] - Whether clothing covers the partner's penis socket.
 * @property {boolean} [coverVagina=false] - Whether clothing covers the actor's vagina socket.
 * @property {boolean} [includePenis=true] - Whether to include a penis anatomy part for the partner.
 * @property {boolean} [includeVagina=true] - Whether to include a vagina anatomy part for the actor.
 * @property {boolean} [actorSitting=false] - Whether the actor has the sitting component applied.
 * @property {boolean} [actorBeingFucked=true] - Whether the actor already has the penetration state component.
 * @property {boolean} [primaryAlreadyFucking=false] - Whether the partner already has the penetration component applied.
 */

/**
 * @description Builds the full entity graph required for straddling milking tests.
 * @param {StraddlingMilkingScenarioOptions} [options] - Scenario customization options.
 * @returns {Array<object>} Entities ready to be loaded into a test fixture.
 */
export function buildStraddlingMilkingScenario(options = {}) {
  const {
    includeCloseness = true,
    includeStraddling = true,
    targetFacingAway = false,
    coverPenis = false,
    coverVagina = false,
    includePenis = true,
    includeVagina = true,
    actorSitting = false,
    actorBeingFucked = true,
    primaryAlreadyFucking = false,
  } = options;

  const room = new ModEntityBuilder(STRADDLING_MILKING_ROOM_ID)
    .asRoom('Velvet Suite')
    .build();

  const actorPelvisId = includeVagina
    ? `${STRADDLING_MILKING_ACTOR_ID}_pelvis`
    : `${STRADDLING_MILKING_ACTOR_ID}_pelvis_no_vagina`;
  const actorVaginaId = `${actorPelvisId}_vagina`;

  const primaryGroinId = includePenis
    ? `${STRADDLING_MILKING_PRIMARY_ID}_groin`
    : `${STRADDLING_MILKING_PRIMARY_ID}_groin_no_penis`;
  const primaryPenisId = `${primaryGroinId}_penis`;

  const actorBuilder = new ModEntityBuilder(STRADDLING_MILKING_ACTOR_ID)
    .withName('Selene')
    .atLocation(STRADDLING_MILKING_ROOM_ID)
    .withBody(actorPelvisId)
    .asActor();

  const primaryBuilder = new ModEntityBuilder(STRADDLING_MILKING_PRIMARY_ID)
    .withName('Marcus')
    .atLocation(STRADDLING_MILKING_ROOM_ID)
    .withBody(primaryGroinId)
    .asActor();

  if (includeCloseness) {
    actorBuilder.closeToEntity(STRADDLING_MILKING_PRIMARY_ID);
    primaryBuilder.closeToEntity(STRADDLING_MILKING_ACTOR_ID);
  }

  if (includeStraddling) {
    actorBuilder.withComponent('positioning:straddling_waist', {
      target_id: STRADDLING_MILKING_PRIMARY_ID,
      facing_away: Boolean(targetFacingAway),
    });
  }

  if (actorBeingFucked) {
    actorBuilder.withComponent('positioning:being_fucked_vaginally', {
      actorId: STRADDLING_MILKING_PRIMARY_ID,
    });
  }

  if (primaryAlreadyFucking) {
    primaryBuilder.withComponent('positioning:fucking_vaginally', {
      targetId: STRADDLING_MILKING_ACTOR_ID,
    });
  }

  if (actorSitting) {
    actorBuilder.withComponent('positioning:sitting_on', {
      furniture_id: `${STRADDLING_MILKING_ROOM_ID}_ottoman`,
      spot_index: 0,
    });
  }

  if (targetFacingAway) {
    primaryBuilder.withComponent('positioning:facing_away', {
      facing_away_from: [STRADDLING_MILKING_ACTOR_ID],
    });
  }

  if (coverVagina) {
    actorBuilder
      .withComponent('clothing:equipment', {
        equipped: {
          torso_lower: {
            base: [`${STRADDLING_MILKING_ACTOR_ID}_skirt`],
          },
        },
      })
      .withComponent('clothing:slot_metadata', {
        slotMappings: {
          torso_lower: {
            coveredSockets: ['vagina'],
            allowedLayers: ['base', 'outer'],
          },
        },
      });
  }

  if (coverPenis) {
    primaryBuilder
      .withComponent('clothing:equipment', {
        equipped: {
          torso_lower: {
            base: [`${STRADDLING_MILKING_PRIMARY_ID}_pants`],
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

  const actorPelvisChildren = includeVagina ? [actorVaginaId] : [];
  const primaryGroinChildren = includePenis ? [primaryPenisId] : [];

  const actorPelvis = new ModEntityBuilder(actorPelvisId)
    .asBodyPart({
      parent: null,
      children: actorPelvisChildren,
      subType: 'pelvis',
    })
    .build();

  const primaryGroin = new ModEntityBuilder(primaryGroinId)
    .asBodyPart({
      parent: null,
      children: primaryGroinChildren,
      subType: 'groin',
    })
    .build();

  const entities = [room, actor, primary, actorPelvis, primaryGroin];

  if (includeVagina) {
    entities.push(
      new ModEntityBuilder(actorVaginaId)
        .asBodyPart({ parent: actorPelvisId, children: [], subType: 'vagina' })
        .build()
    );
  }

  if (includePenis) {
    entities.push(
      new ModEntityBuilder(primaryPenisId)
        .asBodyPart({ parent: primaryGroinId, children: [], subType: 'penis' })
        .build()
    );
  }

  if (coverVagina) {
    entities.push(
      new ModEntityBuilder(`${STRADDLING_MILKING_ACTOR_ID}_skirt`)
        .withName('Sheer Skirt')
        .build()
    );
  }

  if (coverPenis) {
    entities.push(
      new ModEntityBuilder(`${STRADDLING_MILKING_PRIMARY_ID}_pants`)
        .withName('Silk Pants')
        .build()
    );
  }

  if (actorSitting) {
    entities.push(
      new ModEntityBuilder(`${STRADDLING_MILKING_ROOM_ID}_ottoman`)
        .withName('Plush Ottoman')
        .atLocation(STRADDLING_MILKING_ROOM_ID)
        .build()
    );
  }

  return entities;
}

/**
 * @description Builds the full entity graph required for the greedy riding tests.
 * @param {StraddlingMilkingScenarioOptions} [options] - Scenario customization options.
 * @returns {Array<object>} Entities ready to be loaded into a test fixture.
 */
export function buildRidePenisGreedilyScenario(options = {}) {
  return buildStraddlingMilkingScenario(options);
}

/**
 * @description Determines whether a clothing socket is covered on an entity.
 * @param {object} entity - Entity instance to inspect.
 * @param {string} socketName - Anatomy socket identifier.
 * @returns {boolean} True if the socket is covered by any equipped clothing.
 */
function isSocketCovered(entity, socketName) {
  const equipment = entity?.components?.['clothing:equipment']?.equipped;
  const slotMetadata =
    entity?.components?.['clothing:slot_metadata']?.slotMappings;

  if (!equipment || !slotMetadata) {
    return false;
  }

  return Object.entries(slotMetadata).some(([slotName, metadata]) => {
    if (!metadata?.coveredSockets?.includes(socketName)) {
      return false;
    }

    const slotLayers = equipment[slotName];
    if (!slotLayers) {
      return false;
    }

    return Object.values(slotLayers).some(
      (items) => Array.isArray(items) && items.length > 0
    );
  });
}

/**
 * @description Traverses anatomy to determine whether an entity possesses a penis.
 * @param {object} testFixture - Active mod test fixture.
 * @param {string} entityId - Identifier of the entity to inspect.
 * @returns {boolean} True if the entity has a penis body part.
 */
function entityHasPenis(testFixture, entityId) {
  const entity = testFixture.entityManager.getEntityInstance(entityId);
  const bodyComponent = entity?.components?.['anatomy:body'];
  const rootId = bodyComponent?.body?.root;

  if (!rootId) {
    return false;
  }

  const visited = new Set();
  const stack = [rootId];

  while (stack.length > 0) {
    const partId = stack.pop();
    if (visited.has(partId)) {
      continue;
    }
    visited.add(partId);

    const partEntity = testFixture.entityManager.getEntityInstance(partId);
    const anatomyPart = partEntity?.components?.['anatomy:part'];

    if (!anatomyPart) {
      continue;
    }

    if (anatomyPart.subType === 'penis') {
      return true;
    }

    if (Array.isArray(anatomyPart.children)) {
      anatomyPart.children.forEach((childId) => {
        if (!visited.has(childId)) {
          stack.push(childId);
        }
      });
    }
  }

  return false;
}

/**
 * @description Resolves the uncovered penis scope using the active fixture state.
 * @param {object} testFixture - Active mod test fixture.
 * @param {object} context - Scope resolution context supplied by the engine.
 * @returns {{ success: boolean, value: Set<string> }} Resolution outcome.
 */
function resolveUncoveredPenisScope(testFixture, context) {
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

  const actorFacingAway =
    actorEntity?.components?.['positioning:facing_away']?.facing_away_from ||
    [];

  const validPartners = partners.filter((partnerId) => {
    const partner = testFixture.entityManager.getEntityInstance(partnerId);

    if (!partner) {
      return false;
    }

    if (!entityHasPenis(testFixture, partnerId)) {
      return false;
    }

    if (isSocketCovered(partner, 'penis')) {
      return false;
    }

    const partnerFacingAway =
      partner.components?.['positioning:facing_away']?.facing_away_from || [];

    const facingEachOther =
      !partnerFacingAway.includes(actorId) &&
      !actorFacingAway.includes(partnerId);
    const actorBehindTarget = partnerFacingAway.includes(actorId);

    if (!facingEachOther && !actorBehindTarget) {
      return false;
    }

    return true;
  });

  return { success: true, value: new Set(validPartners) };
}

/**
 * @description Installs a deterministic resolver for the uncovered penis scope used by the action target.
 * @param {object} testFixture - Active mod test fixture.
 * @returns {() => void} Cleanup callback that restores the previous resolver implementation.
 */
export function installStraddlingMilkingScopeOverrides(testFixture) {
  const resolver = testFixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === PENIS_SCOPE_NAME) {
      return resolveUncoveredPenisScope(testFixture, context);
    }

    return originalResolveSync(scopeName, context);
  };

  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}
