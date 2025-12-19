/**
 * @file Shared fixtures for the breathe teasingly on penis (sitting close) action suites.
 * @description Provides reusable builders and scope overrides for seated teasing scenarios
 * where partners share close seating and the primary's penis must be exposed.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';

/**
 * Identifier for the seated breathe teasingly on penis action.
 *
 * @type {string}
 */
export const BREATHE_TEASINGLY_ON_PENIS_SITTING_CLOSE_ACTION_ID =
  'sex-penile-oral:breathe_teasingly_on_penis_sitting_close';

/**
 * Default actor identifier used in seated teasing scenarios.
 *
 * @type {string}
 */
export const BREATHE_TEASINGLY_ON_PENIS_SITTING_CLOSE_ACTOR_ID = 'ava';

/**
 * Default primary partner identifier for seated teasing scenarios.
 *
 * @type {string}
 */
export const BREATHE_TEASINGLY_ON_PENIS_SITTING_CLOSE_PRIMARY_ID = 'nolan';

/**
 * Default room identifier for seated teasing scenarios.
 *
 * @type {string}
 */
export const BREATHE_TEASINGLY_ON_PENIS_SITTING_CLOSE_ROOM_ID = 'salon1';

/**
 * Default furniture identifier used for the shared seat.
 *
 * @type {string}
 */
export const BREATHE_TEASINGLY_ON_PENIS_SITTING_CLOSE_FURNITURE_ID = 'sofa1';

/**
 * @typedef {object} BreatheTeasinglySittingScenarioOptions
 * @property {boolean} [coverPrimaryPenis=false] - Whether clothing should cover the primary partner's penis socket.
 * @property {boolean} [includeActorSitting=true] - Whether the actor should have a sitting_on component.
 * @property {boolean} [includePrimarySitting=true] - Whether the primary partner should have a sitting_on component.
 * @property {boolean} [includeCloseness=true] - Whether both actors should have personal-space-states:closeness toward each other.
 */

/**
 * @description Builds a seated teasing scenario with configurable seating and exposure.
 * @param {BreatheTeasinglySittingScenarioOptions} [options] - Scenario customization options.
 * @returns {{
 *   entities: Array<object>,
 *   actorId: string,
 *   primaryId: string,
 *   roomId: string,
 *   furnitureId: string,
 *   primaryPenisId: string
 * }} Scenario data including built entities and common identifiers.
 */
export function buildBreatheTeasinglyOnPenisSittingCloseScenario(options = {}) {
  const {
    coverPrimaryPenis = false,
    includeActorSitting = true,
    includePrimarySitting = true,
    includeCloseness = true,
  } = options;

  const ACTOR_ID = BREATHE_TEASINGLY_ON_PENIS_SITTING_CLOSE_ACTOR_ID;
  const PRIMARY_ID = BREATHE_TEASINGLY_ON_PENIS_SITTING_CLOSE_PRIMARY_ID;
  const ROOM_ID = BREATHE_TEASINGLY_ON_PENIS_SITTING_CLOSE_ROOM_ID;
  const FURNITURE_ID = BREATHE_TEASINGLY_ON_PENIS_SITTING_CLOSE_FURNITURE_ID;

  const primaryTorsoId = `${PRIMARY_ID}_torso`;
  const primaryGroinId = `${PRIMARY_ID}_groin`;
  const primaryPenisId = `${primaryGroinId}_penis`;
  const primaryClothingId = `${PRIMARY_ID}_briefs`;

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Velvet Salon')
    .asRoom('Velvet Salon')
    .build();

  const furniture = new ModEntityBuilder(FURNITURE_ID)
    .withName('Plush Loveseat')
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
    .withName('Ava')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor();

  if (includeActorSitting) {
    actorBuilder.withComponent('positioning:sitting_on', {
      furniture_id: FURNITURE_ID,
      spot_index: 0,
    });
  }

  if (includeCloseness) {
    actorBuilder.closeToEntity(PRIMARY_ID);
  }

  const primaryBuilder = new ModEntityBuilder(PRIMARY_ID)
    .withName('Nolan')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .withBody(primaryTorsoId);

  if (includePrimarySitting) {
    primaryBuilder.withComponent('positioning:sitting_on', {
      furniture_id: FURNITURE_ID,
      spot_index: 1,
    });
  }

  if (includeCloseness) {
    primaryBuilder.closeToEntity(ACTOR_ID);
  }

  if (coverPrimaryPenis) {
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
      sockets: {
        penis: { coveredBy: null, attachedPart: primaryPenisId },
      },
    })
    .build();

  const primaryPenis = new ModEntityBuilder(primaryPenisId)
    .asBodyPart({ parent: primaryGroinId, children: [], subType: 'penis' })
    .build();

  const entities = [
    room,
    furniture,
    actor,
    primary,
    primaryTorso,
    primaryGroin,
    primaryPenis,
  ];

  if (coverPrimaryPenis) {
    const primaryClothing = new ModEntityBuilder(primaryClothingId)
      .withName('silk briefs')
      .build();
    entities.push(primaryClothing);
  }

  return {
    entities,
    actorId: ACTOR_ID,
    primaryId: PRIMARY_ID,
    roomId: ROOM_ID,
    furnitureId: FURNITURE_ID,
    primaryPenisId,
    clothingId: coverPrimaryPenis ? primaryClothingId : null,
  };
}

/**
 * @description Installs a scope resolver override for seated uncovered penis discovery.
 * @param {import('../ModTestFixture.js').ModTestFixture} testFixture - Active mod test fixture.
 * @returns {Function} Cleanup function restoring the original resolver.
 */
export function installSittingCloseUncoveredPenisScopeOverride(testFixture) {
  const resolver = testFixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-core:actors_sitting_close_with_uncovered_penis') {
      const actorId = context?.actor?.id;

      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = testFixture.entityManager.getEntityInstance(actorId);
      const actorSitting = actor?.components?.['positioning:sitting_on'];
      const closenessPartners =
        actor?.components?.['personal-space-states:closeness']?.partners;

      if (
        !actorSitting ||
        !Array.isArray(closenessPartners) ||
        closenessPartners.length === 0
      ) {
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

        const hasPenis = testFixture.testEnv.jsonLogic.evaluate(
          { hasPartOfType: ['target', 'penis'] },
          { target: partner }
        );

        if (!hasPenis) {
          return false;
        }

        const penisCovered = testFixture.testEnv.jsonLogic.evaluate(
          { isSocketCovered: ['target', 'penis'] },
          { target: partner }
        );

        if (penisCovered) {
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

/**
 * @description Installs a scope resolver override for seated covered penis discovery.
 * @param {import('../ModTestFixture.js').ModTestFixture} testFixture - Active mod test fixture.
 * @returns {Function} Cleanup function restoring the original resolver.
 */
export function installSittingCloseCoveredPenisScopeOverride(testFixture) {
  const resolver = testFixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-core:actors_sitting_close_with_covered_penis') {
      const actorId = context?.actor?.id;

      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = testFixture.entityManager.getEntityInstance(actorId);
      const actorSitting = actor?.components?.['positioning:sitting_on'];
      const closenessPartners =
        actor?.components?.['personal-space-states:closeness']?.partners;

      if (
        !actorSitting ||
        !Array.isArray(closenessPartners) ||
        closenessPartners.length === 0
      ) {
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

        const hasPenis = testFixture.testEnv.jsonLogic.evaluate(
          { hasPartOfType: ['target', 'penis'] },
          { target: partner }
        );

        if (!hasPenis) {
          return false;
        }

        const penisCovered = testFixture.testEnv.jsonLogic.evaluate(
          { isSocketCovered: ['target', 'penis'] },
          { target: partner }
        );

        return Boolean(penisCovered);
      });

      return { success: true, value: new Set(validPartners) };
    }

    if (
      scopeName ===
      'clothing:target_topmost_torso_lower_clothing_no_accessories'
    ) {
      const targetId = context?.target?.id || context?.primary?.id;

      if (!targetId) {
        return { success: true, value: new Set() };
      }

      const target = testFixture.entityManager.getEntityInstance(targetId);
      const equipment = target?.components?.['clothing:equipment'];

      if (!equipment?.equipped) {
        return { success: true, value: new Set() };
      }

      const torsoLowerLayers = equipment.equipped.torso_lower;

      if (!torsoLowerLayers) {
        return { success: true, value: new Set() };
      }

      const priorityLayers = ['outer', 'base', 'underwear'];

      for (const layer of priorityLayers) {
        const items = torsoLowerLayers[layer];

        if (Array.isArray(items) && items.length > 0) {
          return { success: true, value: new Set([items[0]]) };
        }

        if (typeof items === 'string' && items) {
          return { success: true, value: new Set([items]) };
        }
      }

      return { success: true, value: new Set() };
    }

    return originalResolveSync(scopeName, context);
  };

  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}
