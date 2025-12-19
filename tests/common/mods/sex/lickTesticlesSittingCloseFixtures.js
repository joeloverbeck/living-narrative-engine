/**
 * @file Shared fixtures for the lick testicles (sitting close) action suites.
 * @description Provides reusable builders for seated testicle teasing scenarios
 * where partners remain seated close together and at least one testicle is uncovered.
 * Includes a scope fallback used by tests when the integration harness cannot
 * evaluate the uncovered-testicle scope directly.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';

/**
 * Identifier for the seated lick testicles action.
 *
 * @type {string}
 */
export const LICK_TESTICLES_SITTING_CLOSE_ACTION_ID =
  'sex-penile-oral:lick_testicles_sitting_close';

/**
 * Default actor identifier used in seated licking scenarios.
 *
 * @type {string}
 */
export const LICK_TESTICLES_SITTING_CLOSE_ACTOR_ID = 'ava';

/**
 * Default primary partner identifier for seated licking scenarios.
 *
 * @type {string}
 */
export const LICK_TESTICLES_SITTING_CLOSE_PRIMARY_ID = 'nolan';

/**
 * Default room identifier for seated licking scenarios.
 *
 * @type {string}
 */
export const LICK_TESTICLES_SITTING_CLOSE_ROOM_ID = 'salon1';

/**
 * Default furniture identifier used for the shared seat.
 *
 * @type {string}
 */
export const LICK_TESTICLES_SITTING_CLOSE_FURNITURE_ID = 'sofa1';

/**
 * @typedef {object} LickTesticlesSittingCloseScenarioOptions
 * @property {boolean} [coverLeftTesticle=false] - Whether clothing should cover the left testicle socket.
 * @property {boolean} [coverRightTesticle=false] - Whether clothing should cover the right testicle socket.
 * @property {boolean} [includeActorSitting=true] - Whether the actor should have a sitting_on component.
 * @property {boolean} [includePrimarySitting=true] - Whether the primary partner should have a sitting_on component.
 * @property {boolean} [includeCloseness=true] - Whether both actors should have personal-space-states:closeness toward each other.
 */

/**
 * @description Builds a seated licking scenario with configurable seating and exposure.
 * @param {LickTesticlesSittingCloseScenarioOptions} [options] - Scenario customization options.
 * @returns {{
 *   entities: Array<object>,
 *   actorId: string,
 *   primaryId: string,
 *   roomId: string,
 *   furnitureId: string,
 *   leftTesticleId: string,
 *   rightTesticleId: string
 * }} Scenario data including built entities and common identifiers.
 */
export function buildLickTesticlesSittingCloseScenario(options = {}) {
  const {
    coverLeftTesticle = false,
    coverRightTesticle = false,
    includeActorSitting = true,
    includePrimarySitting = true,
    includeCloseness = true,
  } = options;

  const ACTOR_ID = LICK_TESTICLES_SITTING_CLOSE_ACTOR_ID;
  const PRIMARY_ID = LICK_TESTICLES_SITTING_CLOSE_PRIMARY_ID;
  const ROOM_ID = LICK_TESTICLES_SITTING_CLOSE_ROOM_ID;
  const FURNITURE_ID = LICK_TESTICLES_SITTING_CLOSE_FURNITURE_ID;

  const primaryTorsoId = `${PRIMARY_ID}_torso`;
  const primaryGroinId = `${PRIMARY_ID}_groin`;
  const primaryScrotumId = `${primaryGroinId}_scrotum`;
  const leftTesticleId = `${primaryScrotumId}_left`;
  const rightTesticleId = `${primaryScrotumId}_right`;

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

  const coveredSockets = [];
  if (coverLeftTesticle) {
    coveredSockets.push('left_testicle');
  }
  if (coverRightTesticle) {
    coveredSockets.push('right_testicle');
  }

  if (coveredSockets.length > 0) {
    primaryBuilder
      .withComponent('clothing:equipment', {
        equipped: {
          torso_lower: {
            base: [`${PRIMARY_ID}_briefs`],
          },
        },
      })
      .withComponent('clothing:slot_metadata', {
        slotMappings: {
          torso_lower: {
            coveredSockets,
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
      children: [primaryScrotumId],
      subType: 'groin',
    })
    .build();

  const primaryScrotum = new ModEntityBuilder(primaryScrotumId)
    .asBodyPart({
      parent: primaryGroinId,
      children: [leftTesticleId, rightTesticleId],
      subType: 'scrotum',
    })
    .build();

  const leftTesticle = new ModEntityBuilder(leftTesticleId)
    .asBodyPart({ parent: primaryScrotumId, children: [], subType: 'testicle' })
    .build();

  const rightTesticle = new ModEntityBuilder(rightTesticleId)
    .asBodyPart({ parent: primaryScrotumId, children: [], subType: 'testicle' })
    .build();

  const entities = [
    room,
    furniture,
    actor,
    primary,
    primaryTorso,
    primaryGroin,
    primaryScrotum,
    leftTesticle,
    rightTesticle,
  ];

  return {
    entities,
    actorId: ACTOR_ID,
    primaryId: PRIMARY_ID,
    roomId: ROOM_ID,
    furnitureId: FURNITURE_ID,
    leftTesticleId,
    rightTesticleId,
  };
}

/**
 * @description Installs a scope resolver fallback for uncovered testicle discovery.
 * @param {import('../ModTestFixture.js').ModTestFixture} testFixture - Active mod test fixture.
 * @returns {Function} Cleanup function restoring the original resolver.
 */
export function installSittingCloseUncoveredTesticleScopeOverride(testFixture) {
  const resolver = testFixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    const baseResult = originalResolveSync(scopeName, context);

    if (scopeName !== 'sex-core:actors_sitting_close_with_uncovered_testicle') {
      return baseResult;
    }

    if (
      baseResult?.success &&
      baseResult.value instanceof Set &&
      baseResult.value.size > 0
    ) {
      return baseResult;
    }

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
      const partnerCloseness =
        partner.components?.['personal-space-states:closeness']?.partners || [];

      if (!partnerSitting || !partnerCloseness.includes(actorId)) {
        return false;
      }

      const hasTesticle = testFixture.testEnv.jsonLogic.evaluate(
        { hasPartOfType: ['target', 'testicle'] },
        { target: partner }
      );

      if (!hasTesticle) {
        return false;
      }

      const leftCovered = testFixture.testEnv.jsonLogic.evaluate(
        { isSocketCovered: ['target', 'left_testicle'] },
        { target: partner }
      );

      const rightCovered = testFixture.testEnv.jsonLogic.evaluate(
        { isSocketCovered: ['target', 'right_testicle'] },
        { target: partner }
      );

      return !(leftCovered && rightCovered);
    });

    return { success: true, value: new Set(validPartners) };
  };

  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}
