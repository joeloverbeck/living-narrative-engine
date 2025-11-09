/**
 * @file Shared fixtures for the breathe teasingly on penis (lying close) action suites.
 * @description Provides reusable builders and scope overrides for lying-down teasing scenarios
 * where partners share close proximity on the same furniture and the primary's penis must be exposed.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';

/**
 * Identifier for the lying-down breathe teasingly on penis action.
 *
 * @type {string}
 */
export const BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_ACTION_ID =
  'sex-penile-oral:breathe_teasingly_on_penis_lying_close';

/**
 * Default actor identifier used in lying-down teasing scenarios.
 *
 * @type {string}
 */
export const BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_ACTOR_ID = 'ava';

/**
 * Default primary partner identifier for lying-down teasing scenarios.
 *
 * @type {string}
 */
export const BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_PRIMARY_ID = 'nolan';

/**
 * Default room identifier for lying-down teasing scenarios.
 *
 * @type {string}
 */
export const BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_ROOM_ID = 'bedroom1';

/**
 * Default furniture identifier used for the shared bed/furniture.
 *
 * @type {string}
 */
export const BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_FURNITURE_ID = 'bed1';

/**
 * Alternative furniture identifier for testing different furniture scenarios.
 *
 * @type {string}
 */
export const BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_FURNITURE_ID_ALT = 'bed2';

/**
 * @typedef {object} BreatheTeasinglyLyingScenarioOptions
 * @property {boolean} [coverPrimaryPenis=false] - Whether clothing should cover the primary's penis.
 * @property {boolean} [includeActorLying=true] - Whether the actor should have a lying_down component.
 * @property {boolean} [includePrimaryLying=true] - Whether the primary should have a lying_down component.
 * @property {boolean} [includeCloseness=true] - Whether both actors should have closeness toward each other.
 * @property {boolean} [useDifferentFurniture=false] - Whether the primary should lie on different furniture.
 * @property {boolean} [targetFuckingActorVaginally=false] - Whether the target has fucking_vaginally component referencing actor.
 */

/**
 * Builds a lying-down teasing scenario with configurable positioning and exposure.
 *
 * @param {BreatheTeasinglyLyingScenarioOptions} [options] - Scenario customization options.
 * @returns {{
 *   entities: Array<object>,
 *   actorId: string,
 *   primaryId: string,
 *   roomId: string,
 *   furnitureId: string,
 *   primaryPenisId: string,
 *   clothingId: string | null
 * }} Scenario data including built entities and common identifiers.
 */
export function buildBreatheTeasinglyOnPenisLyingCloseScenario(options = {}) {
  const {
    coverPrimaryPenis = false,
    includeActorLying = true,
    includePrimaryLying = true,
    includeCloseness = true,
    useDifferentFurniture = false,
    targetFuckingActorVaginally = false,
  } = options;

  const ACTOR_ID = BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_ACTOR_ID;
  const PRIMARY_ID = BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_PRIMARY_ID;
  const ROOM_ID = BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_ROOM_ID;
  const FURNITURE_ID = BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_FURNITURE_ID;
  const FURNITURE_ID_ALT = BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_FURNITURE_ID_ALT;

  const primaryTorsoId = `${PRIMARY_ID}_torso`;
  const primaryGroinId = `${PRIMARY_ID}_groin`;
  const primaryPenisId = `${primaryGroinId}_penis`;
  const primaryClothingId = `${PRIMARY_ID}_briefs`;

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Intimate Bedroom')
    .asRoom('Intimate Bedroom')
    .build();

  const furniture = new ModEntityBuilder(FURNITURE_ID)
    .withName('Shared Bed')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .withComponent('positioning:allows_lying', {})
    .build();

  const entities = [room, furniture];

  // Create alternative furniture if needed
  if (useDifferentFurniture) {
    const altFurniture = new ModEntityBuilder(FURNITURE_ID_ALT)
      .withName('Second Bed')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .withComponent('positioning:allows_lying', {})
      .build();
    entities.push(altFurniture);
  }

  const actorBuilder = new ModEntityBuilder(ACTOR_ID)
    .withName('Ava')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor();

  if (includeActorLying) {
    actorBuilder.withComponent('positioning:lying_down', {
      furniture_id: FURNITURE_ID,
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

  if (includePrimaryLying) {
    primaryBuilder.withComponent('positioning:lying_down', {
      furniture_id: useDifferentFurniture ? FURNITURE_ID_ALT : FURNITURE_ID,
    });
  }

  if (includeCloseness) {
    primaryBuilder.closeToEntity(ACTOR_ID);
  }

  if (targetFuckingActorVaginally) {
    primaryBuilder.withComponent('positioning:fucking_vaginally', {
      targetId: ACTOR_ID,
    });
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

  entities.push(actor, primary, primaryTorso, primaryGroin, primaryPenis);

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
 * Installs a scope resolver override for lying-down uncovered penis discovery.
 *
 * @param {import('../ModTestFixture.js').ModTestFixture} testFixture - Active mod test fixture.
 * @returns {() => void} Cleanup function restoring the original resolver.
 */
export function installLyingCloseUncoveredPenisScopeOverride(testFixture) {
  const resolver = testFixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-core:actors_lying_close_with_uncovered_penis') {
      const actorId = context?.actor?.id;

      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = testFixture.entityManager.getEntityInstance(actorId);
      const actorLying = actor?.components?.['positioning:lying_down'];
      const closenessPartners = actor?.components?.['positioning:closeness']?.partners;

      if (!actorLying || !Array.isArray(closenessPartners) || closenessPartners.length === 0) {
        return { success: true, value: new Set() };
      }

      const validPartners = closenessPartners.filter((partnerId) => {
        const partner = testFixture.entityManager.getEntityInstance(partnerId);

        if (!partner) {
          return false;
        }

        const partnerLying = partner.components?.['positioning:lying_down'];
        if (!partnerLying) {
          return false;
        }

        // Check if both actors are lying on the same furniture
        if (actorLying.furniture_id !== partnerLying.furniture_id) {
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

        // Check if partner is fucking the actor vaginally
        const partnerFuckingVaginally = partner.components?.['positioning:fucking_vaginally'];
        if (partnerFuckingVaginally && partnerFuckingVaginally.targetId === actorId) {
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
