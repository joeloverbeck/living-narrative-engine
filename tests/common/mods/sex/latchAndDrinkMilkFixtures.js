/**
 * @file Shared fixtures for the latch and drink milk action suites.
 * @description Provides reusable builders for lactation-focused breastplay scenarios.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';
import { installBareBreastsScopeOverride } from './nuzzleBareBreastsFixtures.js';

/**
 * Identifier for the latch and drink milk action.
 *
 * @type {string}
 */
export const LATCH_AND_DRINK_MILK_ACTION_ID =
  'sex-breastplay:latch_and_drink_milk';

/**
 * Identifier for the scope used by the latch and drink milk action.
 *
 * @type {string}
 */
export const LATCH_AND_DRINK_MILK_SCOPE_ID =
  'sex-breastplay:actors_with_breasts_facing_each_other';

/**
 * Default actor identifier in latch and drink milk scenarios.
 *
 * @type {string}
 */
export const LATCH_AND_DRINK_MILK_ACTOR_ID = 'selene';

/**
 * Default target identifier in latch and drink milk scenarios.
 *
 * @type {string}
 */
export const LATCH_AND_DRINK_MILK_TARGET_ID = 'mira';

/**
 * Default room identifier for lactation-focused intimacy scenes.
 *
 * @type {string}
 */
export const LATCH_AND_DRINK_MILK_ROOM_ID = 'nursing_den';

/**
 * @typedef {object} LatchAndDrinkMilkScenarioOptions
 * @property {boolean} [includeCloseness=true] - Whether the partners begin in close proximity.
 * @property {boolean} [targetLactating=true] - Whether the target has the lactation marker component.
 * @property {boolean} [actorGivingBlowjob=false] - Whether the actor starts with the giving blowjob component.
 * @property {boolean} [targetFacingAwayFromActor=false] - Whether the target is facing away from the actor.
 * @property {boolean} [actorFacingAwayFromTarget=false] - Whether the actor is facing away from the target.
 */

/**
 * @description Builds a latch and drink milk scenario for discovery and execution tests.
 * @param {LatchAndDrinkMilkScenarioOptions} [options] - Scenario customization options.
 * @returns {{
 *   entities: Array<object>,
 *   actorId: string,
 *   targetId: string,
 *   roomId: string,
 *   torsoId: string,
 *   leftBreastId: string,
 *   rightBreastId: string
 * }} Entity definitions and identifiers ready to load into a mod test fixture.
 */
export function buildLatchAndDrinkMilkScenario(options = {}) {
  const {
    includeCloseness = true,
    targetLactating = true,
    actorGivingBlowjob = false,
    targetFacingAwayFromActor = false,
    actorFacingAwayFromTarget = false,
  } = options;

  const actorId = LATCH_AND_DRINK_MILK_ACTOR_ID;
  const targetId = LATCH_AND_DRINK_MILK_TARGET_ID;
  const roomId = LATCH_AND_DRINK_MILK_ROOM_ID;
  const torsoId = `${targetId}_torso`;
  const leftBreastId = `${targetId}_left_breast`;
  const rightBreastId = `${targetId}_right_breast`;

  const room = new ModEntityBuilder(roomId).asRoom('Nursing Den').build();

  const actorBuilder = new ModEntityBuilder(actorId)
    .withName('Selene')
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
    .withName('Mira')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .asActor()
    .withComponent('positioning:facing_away', {
      facing_away_from: targetFacingAwayFromActor ? [actorId] : [],
    })
    .withBody(torsoId);

  if (includeCloseness) {
    targetBuilder.closeToEntity(actorId);
  }

  if (targetLactating) {
    targetBuilder.withComponent('sex-breastplay:is_lactating', {});
  }

  const roomEntity = room;
  const actorEntity = actorBuilder.build();
  const targetEntity = targetBuilder.build();

  const torso = new ModEntityBuilder(torsoId)
    .asBodyPart({
      parent: null,
      children: [leftBreastId, rightBreastId],
      subType: 'torso',
    })
    .build();

  const leftBreast = new ModEntityBuilder(leftBreastId)
    .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
    .build();
  const rightBreast = new ModEntityBuilder(rightBreastId)
    .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
    .build();

  return {
    entities: [
      roomEntity,
      actorEntity,
      targetEntity,
      torso,
      leftBreast,
      rightBreast,
    ],
    actorId,
    targetId,
    roomId,
    torsoId,
    leftBreastId,
    rightBreastId,
  };
}

/**
 * Expected narration emitted by the latch and drink milk rule.
 *
 * @type {string}
 */
export const LATCH_AND_DRINK_MILK_NARRATION =
  "Selene suckles at Mira's nipple, drawing milk and drinking it.";

/**
 * @description Installs a scope override that filters for lactating partners while preserving breastplay constraints.
 * @param {import('../ModTestFixture.js').ModTestFixture} testFixture - Active mod test fixture instance.
 * @returns {() => void} Cleanup function that restores the previous scope resolver behavior.
 */
export function installLatchAndDrinkMilkScopeOverride(testFixture) {
  const restoreBareBreasts = installBareBreastsScopeOverride(testFixture);
  const resolver = testFixture.testEnv.unifiedScopeResolver;
  const previousResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    const result = previousResolveSync(scopeName, context);

    if (
      scopeName === LATCH_AND_DRINK_MILK_SCOPE_ID &&
      result?.success &&
      result.value instanceof Set
    ) {
      const filteredPartners = [...result.value].filter((partnerId) => {
        const partner = testFixture.entityManager.getEntityInstance(partnerId);

        if (!partner) {
          return false;
        }

        return Boolean(partner.components?.['sex-breastplay:is_lactating']);
      });

      return { success: true, value: new Set(filteredPartners) };
    }

    return result;
  };

  return () => {
    resolver.resolveSync = previousResolveSync;
    restoreBareBreasts();
  };
}
