/**
 * @file Shared fixtures for the rub penis against penis action suites.
 * @description Provides reusable entity builders and scenario helpers for penis-to-penis rubbing
 * interactions, supporting both action execution and discovery integration tests.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';

/**
 * Identifier for the rub penis against penis action.
 * @type {string}
 */
export const RUB_PENIS_AGAINST_PENIS_ACTION_ID = 'sex-dry-intimacy:rub_penis_against_penis';

/**
 * Default actor identifier used in the penis rubbing scenarios.
 * @type {string}
 */
export const RUB_PENIS_AGAINST_PENIS_ACTOR_ID = 'alex';

/**
 * Default primary partner identifier used in the penis rubbing scenarios.
 * @type {string}
 */
export const RUB_PENIS_AGAINST_PENIS_PRIMARY_ID = 'blake';

/**
 * Default room identifier for the penis rubbing scenarios.
 * @type {string}
 */
export const RUB_PENIS_AGAINST_PENIS_ROOM_ID = 'room1';

/**
 * @typedef {object} RubPenisAgainstPenisScenarioOptions
 * @property {boolean} [includeCloseness=true] - Whether the participants share closeness.
 * @property {boolean} [includeActorPenis=true] - Whether the actor possesses a penis anatomy part.
 * @property {boolean} [coverActorPenis=false] - Whether the actor's penis socket is covered by clothing.
 * @property {boolean} [coverTargetPenis=false] - Whether the target's penis socket is covered by clothing.
 * @property {boolean} [targetFacingAway=false] - Whether the target faces away from the actor.
 * @property {boolean} [actorFacingAway=false] - Whether the actor faces away from the target.
 */

/**
 * @description Builds entities for penis-to-penis rubbing scenarios with configurable anatomy and exposure.
 * @param {RubPenisAgainstPenisScenarioOptions} [options] - Scenario customization options.
 * @returns {{
 *   entities: Array<object>,
 *   actorId: string,
 *   primaryId: string,
 *   roomId: string,
 *   actorPenisId: string|null,
 *   targetPenisId: string
 * }} Structured scenario data including built entities and common identifiers.
 */
export function buildRubPenisAgainstPenisScenario(options = {}) {
  const {
    includeCloseness = true,
    includeActorPenis = true,
    coverActorPenis = false,
    coverTargetPenis = false,
    targetFacingAway = false,
    actorFacingAway = false,
  } = options;

  const actorGroinId = includeActorPenis
    ? `${RUB_PENIS_AGAINST_PENIS_ACTOR_ID}_groin`
    : `${RUB_PENIS_AGAINST_PENIS_ACTOR_ID}_groin_no_penis`;
  const actorPenisId = `${actorGroinId}_penis`;
  const targetGroinId = `${RUB_PENIS_AGAINST_PENIS_PRIMARY_ID}_groin`;
  const targetPenisId = `${targetGroinId}_penis`;

  const room = new ModEntityBuilder(RUB_PENIS_AGAINST_PENIS_ROOM_ID)
    .asRoom('Intimate Alcove')
    .build();

  const actorBuilder = new ModEntityBuilder(RUB_PENIS_AGAINST_PENIS_ACTOR_ID)
    .withName('Alex')
    .atLocation(RUB_PENIS_AGAINST_PENIS_ROOM_ID)
    .withLocationComponent(RUB_PENIS_AGAINST_PENIS_ROOM_ID)
    .withBody(actorGroinId)
    .asActor();

  const targetBuilder = new ModEntityBuilder(RUB_PENIS_AGAINST_PENIS_PRIMARY_ID)
    .withName('Blake')
    .atLocation(RUB_PENIS_AGAINST_PENIS_ROOM_ID)
    .withLocationComponent(RUB_PENIS_AGAINST_PENIS_ROOM_ID)
    .withBody(targetGroinId)
    .asActor();

  if (includeCloseness) {
    actorBuilder.closeToEntity(RUB_PENIS_AGAINST_PENIS_PRIMARY_ID);
    targetBuilder.closeToEntity(RUB_PENIS_AGAINST_PENIS_ACTOR_ID);
  }

  if (targetFacingAway) {
    targetBuilder.withComponent('positioning:facing_away', {
      facing_away_from: [RUB_PENIS_AGAINST_PENIS_ACTOR_ID],
    });
  }

  if (actorFacingAway) {
    actorBuilder.withComponent('positioning:facing_away', {
      facing_away_from: [RUB_PENIS_AGAINST_PENIS_PRIMARY_ID],
    });
  }

  if (coverActorPenis) {
    actorBuilder
      .withComponent('clothing:equipment', {
        equipped: {
          torso_lower: {
            base: [`${RUB_PENIS_AGAINST_PENIS_ACTOR_ID}_briefs`],
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

  if (coverTargetPenis) {
    targetBuilder
      .withComponent('clothing:equipment', {
        equipped: {
          torso_lower: {
            base: [`${RUB_PENIS_AGAINST_PENIS_PRIMARY_ID}_briefs`],
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
  const target = targetBuilder.build();

  const actorGroin = new ModEntityBuilder(actorGroinId)
    .asBodyPart({
      parent: null,
      children: includeActorPenis ? [actorPenisId] : [],
      subType: 'groin',
      sockets: {
        penis: {
          coveredBy: null,
          attachedPart: includeActorPenis ? actorPenisId : null,
        },
      },
    })
    .build();

  const targetGroin = new ModEntityBuilder(targetGroinId)
    .asBodyPart({
      parent: null,
      children: [targetPenisId],
      subType: 'groin',
      sockets: {
        penis: { coveredBy: null, attachedPart: targetPenisId },
      },
    })
    .build();

  const entities = [room, actor, target, actorGroin, targetGroin];

  if (includeActorPenis) {
    const actorPenis = new ModEntityBuilder(actorPenisId)
      .asBodyPart({ parent: actorGroinId, children: [], subType: 'penis' })
      .build();
    entities.push(actorPenis);
  }

  const targetPenis = new ModEntityBuilder(targetPenisId)
    .asBodyPart({ parent: targetGroinId, children: [], subType: 'penis' })
    .build();
  entities.push(targetPenis);

  return {
    entities,
    actorId: RUB_PENIS_AGAINST_PENIS_ACTOR_ID,
    primaryId: RUB_PENIS_AGAINST_PENIS_PRIMARY_ID,
    roomId: RUB_PENIS_AGAINST_PENIS_ROOM_ID,
    actorPenisId: includeActorPenis ? actorPenisId : null,
    targetPenisId,
  };
}

/**
 * Installs a scope override for `sex-core:actors_with_penis_facing_each_other`.
 * The override mirrors the scope logic by filtering the actor's closeness partners
 * for uncovered penises that are not facing away or kneeling incompatibly.
 *
 * @param {import('../ModTestFixture.js').ModTestFixture} testFixture - Active mod test fixture.
 * @returns {Function} Cleanup function that restores the original resolver.
 */
export function installPenisFacingEachOtherScopeOverride(testFixture) {
  const resolver = testFixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-core:actors_with_penis_facing_each_other') {
      const actorId = context?.actor?.id;

      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = testFixture.entityManager.getEntityInstance(actorId);
      const closeness = actor?.components?.['positioning:closeness'];
      const partners = Array.isArray(closeness?.partners)
        ? closeness.partners
        : [];

      const validPartners = partners.filter((partnerId) => {
        const partner = testFixture.entityManager.getEntityInstance(partnerId);

        if (!partner) {
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

        const facingAwayFrom = Array.isArray(
          partner.components?.['positioning:facing_away']?.facing_away_from
        )
          ? partner.components['positioning:facing_away'].facing_away_from
          : [];

        if (facingAwayFrom.includes(actorId)) {
          return false;
        }

        const actorFacingAwayFrom = Array.isArray(
          actor.components?.['positioning:facing_away']?.facing_away_from
        )
          ? actor.components['positioning:facing_away'].facing_away_from
          : [];

        if (actorFacingAwayFrom.includes(partnerId)) {
          return false;
        }

        const partnerKneeling =
          partner.components?.['positioning:kneeling_before']?.entityId ===
          actorId;
        const actorKneeling =
          actor.components?.['positioning:kneeling_before']?.entityId ===
          partnerId;

        if (partnerKneeling || actorKneeling) {
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
