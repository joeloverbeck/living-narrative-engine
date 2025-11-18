/**
 * @file Shared fixtures for the pull head to clothed crotch seated action suites.
 * @description Provides reusable builders and scope overrides for seated dominance scenarios
 * where the actor's penis remains clothed while guiding a close partner's head.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';

/**
 * Identifier for the pull head to clothed crotch action.
 *
 * @type {string}
 */
export const PULL_HEAD_TO_CLOTHED_CROTCH_ACTION_ID =
  'sex-physical-control:pull_head_to_clothed_crotch';

/**
 * Default actor identifier for clothed crotch teasing scenarios.
 *
 * @type {string}
 */
export const PULL_HEAD_TO_CLOTHED_CROTCH_ACTOR_ID = 'dante';

/**
 * Default primary partner identifier for clothed crotch teasing scenarios.
 *
 * @type {string}
 */
export const PULL_HEAD_TO_CLOTHED_CROTCH_PRIMARY_ID = 'mira';

/**
 * Default room identifier used for seated teasing scenarios.
 *
 * @type {string}
 */
export const PULL_HEAD_TO_CLOTHED_CROTCH_ROOM_ID = 'velvet_lounge';

/**
 * Default furniture identifier for the shared seat.
 *
 * @type {string}
 */
export const PULL_HEAD_TO_CLOTHED_CROTCH_FURNITURE_ID = 'velvet_loveseat';

/**
 * @typedef {object} PullHeadToClothedCrotchScenarioOptions
 * @property {boolean} [includeActorSitting=true] - Whether the actor has a sitting_on component.
 * @property {boolean} [includePrimarySitting=true] - Whether the primary partner has a sitting_on component.
 * @property {boolean} [includeCloseness=true] - Whether mutual closeness components are present.
 * @property {boolean} [coverActorPenis=true] - Whether clothing currently covers the actor's penis socket.
 */

/**
 * @description Builds a seated clothed crotch teasing scenario with configurable seating and coverage.
 * @param {PullHeadToClothedCrotchScenarioOptions} [options] - Scenario customization options.
 * @returns {{
 *   entities: Array<object>,
 *   actorId: string,
 *   primaryId: string,
 *   roomId: string,
 *   furnitureId: string,
 *   actorPenisId: string,
 *   actorClothingId: string
 * }} Scenario data including built entities and identifier references.
 */
export function buildPullHeadToClothedCrotchScenario(options = {}) {
  const {
    includeActorSitting = true,
    includePrimarySitting = true,
    includeCloseness = true,
    coverActorPenis = true,
  } = options;

  const actorId = PULL_HEAD_TO_CLOTHED_CROTCH_ACTOR_ID;
  const primaryId = PULL_HEAD_TO_CLOTHED_CROTCH_PRIMARY_ID;
  const roomId = PULL_HEAD_TO_CLOTHED_CROTCH_ROOM_ID;
  const furnitureId = PULL_HEAD_TO_CLOTHED_CROTCH_FURNITURE_ID;

  const actorTorsoId = `${actorId}_torso`;
  const actorGroinId = `${actorId}_groin`;
  const actorPenisId = `${actorGroinId}_penis`;
  const actorClothingId = `${actorId}_slacks`;

  const room = new ModEntityBuilder(roomId)
    .withName('Indigo Lounge')
    .asRoom('Indigo Lounge')
    .build();

  const furniture = new ModEntityBuilder(furnitureId)
    .withName('Tufted Loveseat')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .withComponent('positioning:allows_sitting', {
      spots: [includeActorSitting ? actorId : null, includePrimarySitting ? primaryId : null],
    })
    .build();

  const actorBuilder = new ModEntityBuilder(actorId)
    .withName('Dante')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .asActor()
    .withBody(actorTorsoId)
    .withComponent('clothing:slot_metadata', {
      slotMappings: {
        torso_lower: {
          coveredSockets: ['penis'],
          allowedLayers: ['underwear', 'base', 'outer'],
        },
      },
    });

  if (includeActorSitting) {
    actorBuilder.withComponent('positioning:sitting_on', {
      furniture_id: furnitureId,
      spot_index: 0,
    });
  }

  if (includeCloseness) {
    actorBuilder.closeToEntity(primaryId);
  }

  const actorEquipmentLayers = {
    underwear: [],
    base: coverActorPenis ? [actorClothingId] : [],
    outer: [],
  };

  actorBuilder.withComponent('clothing:equipment', {
    equipped: {
      torso_lower: actorEquipmentLayers,
    },
  });

  const primaryBuilder = new ModEntityBuilder(primaryId)
    .withName('Mira')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .asActor();

  if (includePrimarySitting) {
    primaryBuilder.withComponent('positioning:sitting_on', {
      furniture_id: furnitureId,
      spot_index: 1,
    });
  }

  if (includeCloseness) {
    primaryBuilder.closeToEntity(actorId);
  }

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
        penis: { coveredBy: coverActorPenis ? actorClothingId : null, attachedPart: actorPenisId },
      },
    })
    .build();

  const actorPenis = new ModEntityBuilder(actorPenisId)
    .asBodyPart({ parent: actorGroinId, children: [], subType: 'penis' })
    .build();

  const actorClothing = new ModEntityBuilder(actorClothingId)
    .withName('Tailored Slacks')
    .build();

  const actor = actorBuilder.build();
  const primary = primaryBuilder.build();

  const entities = [
    room,
    furniture,
    actor,
    primary,
    actorTorso,
    actorGroin,
    actorPenis,
    actorClothing,
  ];

  return {
    entities,
    actorId,
    primaryId,
    roomId,
    furnitureId,
    actorPenisId,
    actorClothingId,
  };
}

/**
 * @description Installs a scope resolver override for positioning:actors_sitting_close.
 * @param {import('../ModTestFixture.js').ModTestFixture} testFixture - Active mod test fixture.
 * @returns {Function} Cleanup function restoring the original resolver implementation.
 */
export function installActorsSittingCloseScopeOverride(testFixture) {
  const resolver = testFixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'positioning:actors_sitting_close') {
      const actorId = context?.actor?.id;

      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = testFixture.entityManager.getEntityInstance(actorId);

      if (!actor) {
        return { success: true, value: new Set() };
      }

      const actorSitting = actor.components?.['positioning:sitting_on'];
      const closenessPartners = actor.components?.['positioning:closeness']?.partners;

      if (!actorSitting || !Array.isArray(closenessPartners) || closenessPartners.length === 0) {
        return { success: true, value: new Set() };
      }

      const validPartners = closenessPartners.filter((partnerId) => {
        const partner = testFixture.entityManager.getEntityInstance(partnerId);

        if (!partner) {
          return false;
        }

        const partnerSitting = partner.components?.['positioning:sitting_on'];

        if (!partnerSitting) {
          return false;
        }

        const partnerCloseness = partner.components?.['positioning:closeness']?.partners;

        if (!Array.isArray(partnerCloseness) || !partnerCloseness.includes(actorId)) {
          return false;
        }

        return true;
      });

      return { success: true, value: new Set(validPartners) };
    }

    return originalResolveSync(scopeName, context);
  };

  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}
