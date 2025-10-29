/**
 * @file Shared fixtures for the nuzzle bare breasts action suites.
 * @description Provides reusable entity builders for breast nuzzling scenarios.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';

/**
 * Identifier for the nuzzle bare breasts action.
 * @type {string}
 */
export const NUZZLE_BARE_BREASTS_ACTION_ID =
  'sex-breastplay:nuzzle_bare_breasts';

/**
 * Identifier for the lick breasts action.
 * @type {string}
 */
export const LICK_BREASTS_ACTION_ID = 'sex-breastplay:lick_breasts';

/**
 * Default actor identifier used in breast nuzzling scenarios.
 * @type {string}
 */
export const NUZZLE_BARE_BREASTS_ACTOR_ID = 'selene';

/**
 * Scope used to discover bare breast nuzzling partners.
 * @type {string}
 */
export const NUZZLE_BARE_BREASTS_SCOPE_ID =
  'sex-breastplay:actors_with_breasts_facing_each_other';

/**
 * Default target identifier used in breast nuzzling scenarios.
 * @type {string}
 */
export const NUZZLE_BARE_BREASTS_TARGET_ID = 'mira';

/**
 * Default room identifier for intimate breastplay scenes.
 * @type {string}
 */
export const NUZZLE_BARE_BREASTS_ROOM_ID = 'velvet_suite';

/**
 * @typedef {object} NuzzleBareBreastsScenarioOptions
 * @property {boolean} [includeCloseness=true] - Whether both partners should start in closeness.
 * @property {boolean} [includeBreastAnatomy=true] - Whether the target should include breast anatomy parts.
 * @property {boolean} [actorGivingBlowjob=false] - Whether the actor should have the positioning:giving_blowjob component.
 */

/**
 * @description Builds a scenario for testing the nuzzle bare breasts action.
 * @param {NuzzleBareBreastsScenarioOptions} [options] - Scenario customization options.
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
export function buildNuzzleBareBreastsScenario(options = {}) {
  const {
    includeCloseness = true,
    includeBreastAnatomy = true,
    actorGivingBlowjob = false,
  } = options;

  const actorId = NUZZLE_BARE_BREASTS_ACTOR_ID;
  const targetId = NUZZLE_BARE_BREASTS_TARGET_ID;
  const roomId = NUZZLE_BARE_BREASTS_ROOM_ID;
  const torsoId = `${targetId}_torso`;
  const leftBreastId = `${targetId}_left_breast`;
  const rightBreastId = `${targetId}_right_breast`;

  const room = new ModEntityBuilder(roomId).asRoom('Velvet Suite').build();

  const actorBuilder = new ModEntityBuilder(actorId)
    .withName('Selene')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .asActor()
    .withComponent('positioning:facing_away', { facing_away_from: [] });

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
    .withName('Mira')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .asActor()
    .withComponent('positioning:facing_away', { facing_away_from: [] })
    .withBody(torsoId);

  if (includeCloseness) {
    targetBuilder.closeToEntity(actorId);
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
 * @description Installs a scope resolver override for bare breast intimacy discovery.
 * @param {import('../ModTestFixture.js').ModTestFixture} testFixture - Active mod test fixture instance.
 * @returns {() => void} Cleanup function to restore the original resolver.
 */
export function installBareBreastsScopeOverride(testFixture) {
  const resolver = testFixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === NUZZLE_BARE_BREASTS_SCOPE_ID) {
      const actorId = context?.actor?.id;

      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = testFixture.entityManager.getEntityInstance(actorId);
      const closenessPartners =
        actor?.components?.['positioning:closeness']?.partners;

      if (!Array.isArray(closenessPartners) || closenessPartners.length === 0) {
        return { success: true, value: new Set() };
      }

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

        const facingAway = partner.components?.['positioning:facing_away'];
        if (
          Array.isArray(facingAway?.facing_away_from) &&
          facingAway.facing_away_from.includes(actorId)
        ) {
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
