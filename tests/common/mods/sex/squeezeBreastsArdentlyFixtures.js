/**
 * @file Shared fixtures for the squeeze breasts ardently action suites.
 * @description Provides reusable builders and scope overrides for ardent breast squeezing scenarios.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';

/**
 * Identifier for the squeeze breasts ardently action.
 * @type {string}
 */
export const SQUEEZE_BREASTS_ARDENTLY_ACTION_ID =
  'sex-breastplay:squeeze_breasts_ardently';

/**
 * Default actor identifier used in ardent breast squeezing scenarios.
 * @type {string}
 */
export const SQUEEZE_BREASTS_ARDENTLY_ACTOR_ID = 'liora';

/**
 * Scope identifier used to discover eligible targets.
 * @type {string}
 */
export const SQUEEZE_BREASTS_ARDENTLY_SCOPE_ID =
  'sex-breastplay:actors_with_breasts_facing_each_other_or_away';

/**
 * Default target identifier used in ardent breast squeezing scenarios.
 * @type {string}
 */
export const SQUEEZE_BREASTS_ARDENTLY_TARGET_ID = 'nerine';

/**
 * Default room identifier for ardent breastplay scenes.
 * @type {string}
 */
export const SQUEEZE_BREASTS_ARDENTLY_ROOM_ID = 'garnet_suite';

/**
 * @typedef {object} SqueezeBreastsArdentlyScenarioOptions
 * @property {boolean} [includeCloseness=true] - Whether both partners start in closeness.
 * @property {boolean} [includeBreastAnatomy=true] - Whether the target should include breast anatomy parts.
 * @property {boolean} [actorGivingBlowjob=false] - Whether the actor has the positioning:giving_blowjob component.
 * @property {boolean} [targetFacingAwayFromActor=false] - Whether the target is facing away from the actor (actor behind target).
 * @property {boolean} [actorFacingAwayFromTarget=false] - Whether the actor is facing away from the target.
 * @property {boolean} [breastsCovered=false] - Whether both chest sockets should be treated as covered by clothing.
 */

/**
 * @description Builds a scenario for testing the squeeze breasts ardently action.
 * @param {SqueezeBreastsArdentlyScenarioOptions} [options] - Scenario customization options.
 * @returns {{
 *   entities: Array<object>,
 *   actorId: string,
 *   targetId: string,
 *   roomId: string,
 *   torsoId: string,
 *   leftBreastId: string|null,
 *   rightBreastId: string|null
 * }} Configured scenario entities and identifiers.
 */
export function buildSqueezeBreastsArdentlyScenario(options = {}) {
  const {
    includeCloseness = true,
    includeBreastAnatomy = true,
    actorGivingBlowjob = false,
    targetFacingAwayFromActor = false,
    actorFacingAwayFromTarget = false,
    breastsCovered = false,
  } = options;

  const actorId = SQUEEZE_BREASTS_ARDENTLY_ACTOR_ID;
  const targetId = SQUEEZE_BREASTS_ARDENTLY_TARGET_ID;
  const roomId = SQUEEZE_BREASTS_ARDENTLY_ROOM_ID;
  const torsoId = `${targetId}_torso`;
  const leftBreastId = `${targetId}_left_breast`;
  const rightBreastId = `${targetId}_right_breast`;

  const room = new ModEntityBuilder(roomId).asRoom('Garnet Suite').build();

  const actorBuilder = new ModEntityBuilder(actorId)
    .withName('Liora')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .asActor()
    .withComponent('positioning:facing_away', {
      facing_away_from: actorFacingAwayFromTarget ? [targetId] : [],
    });

  if (includeCloseness) {
    actorBuilder.closeToEntity(targetId);
  }

  if (actorGivingBlowjob) {
    actorBuilder.withComponent('positioning:giving_blowjob', {
      receiving_entity_id: targetId,
      initiated: true,
    });
  }

  const targetBuilder = new ModEntityBuilder(targetId)
    .withName('Nerine')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .asActor()
    .withBody(torsoId)
    .withComponent('positioning:facing_away', {
      facing_away_from: targetFacingAwayFromActor ? [actorId] : [],
    });

  if (includeCloseness) {
    targetBuilder.closeToEntity(actorId);
  }

  if (breastsCovered) {
    targetBuilder
      .withComponent('clothing:equipment', {
        equipped: {
          torso_upper: {
            base: [`${targetId}_blouse`],
          },
        },
      })
      .withComponent('clothing:slot_metadata', {
        slotMappings: {
          torso_upper: {
            coveredSockets: ['left_chest', 'right_chest'],
            allowedLayers: ['base', 'outer'],
          },
        },
      });
  }

  const entities = [room, actorBuilder.build(), targetBuilder.build()];

  const torso = new ModEntityBuilder(torsoId)
    .asBodyPart({
      parent: null,
      children: includeBreastAnatomy ? [leftBreastId, rightBreastId] : [],
      subType: 'torso',
    })
    .build();

  entities.push(torso);

  if (includeBreastAnatomy) {
    const leftBreast = new ModEntityBuilder(leftBreastId)
      .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
      .build();
    const rightBreast = new ModEntityBuilder(rightBreastId)
      .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
      .build();

    entities.push(leftBreast, rightBreast);
  }

  return {
    entities,
    actorId,
    targetId,
    roomId,
    torsoId,
    leftBreastId: includeBreastAnatomy ? leftBreastId : null,
    rightBreastId: includeBreastAnatomy ? rightBreastId : null,
  };
}

/**
 * @description Installs a scope resolver override for ardent breast squeezing discovery.
 * @param {import('../ModTestFixture.js').ModTestFixture} testFixture - Active mod test fixture instance.
 * @returns {() => void} Cleanup function restoring the original resolver.
 */
export function installSqueezeBreastsArdentlyScopeOverride(testFixture) {
  const resolver = testFixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === SQUEEZE_BREASTS_ARDENTLY_SCOPE_ID) {
      const actorId = context?.actor?.id;

      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = testFixture.entityManager.getEntityInstance(actorId);

      if (!actor) {
        return { success: true, value: new Set() };
      }

      const closenessPartners =
        actor.components?.['positioning:closeness']?.partners;

      if (!Array.isArray(closenessPartners) || closenessPartners.length === 0) {
        return { success: true, value: new Set() };
      }

      const actorFacingAwayComponent =
        actor.components?.['positioning:facing_away'];
      const actorFacingAway = Array.isArray(
        actorFacingAwayComponent?.facing_away_from
      )
        ? actorFacingAwayComponent.facing_away_from
        : [];

      const validPartners = closenessPartners.filter((partnerId) => {
        const partner = testFixture.entityManager.getEntityInstance(partnerId);

        if (!partner) {
          return false;
        }

        const hasBreasts = testFixture.testEnv.jsonLogic.evaluate(
          { hasPartOfType: ['target', 'breast'] },
          { target: partner }
        );

        if (!hasBreasts) {
          return false;
        }

        const partnerFacingAwayComponent =
          partner.components?.['positioning:facing_away'];
        const partnerFacingAway = Array.isArray(
          partnerFacingAwayComponent?.facing_away_from
        )
          ? partnerFacingAwayComponent.facing_away_from
          : [];

        const facingEachOther =
          !actorFacingAway.includes(partnerId) &&
          !partnerFacingAway.includes(actorId);
        const actorBehind = partnerFacingAway.includes(actorId);

        if (!facingEachOther && !actorBehind) {
          return false;
        }

        const leftCovered = testFixture.testEnv.jsonLogic.evaluate(
          { isSocketCovered: ['target', 'left_chest'] },
          { target: partner }
        );
        const rightCovered = testFixture.testEnv.jsonLogic.evaluate(
          { isSocketCovered: ['target', 'right_chest'] },
          { target: partner }
        );

        return !(leftCovered && rightCovered);
      });

      return { success: true, value: new Set(validPartners) };
    }

    return originalResolveSync(scopeName, context);
  };

  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}
