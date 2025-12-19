/**
 * @file Shared fixtures for the press against chest action suites.
 * @description Provides reusable entity builders for front-facing breast press scenarios.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';

/**
 * Identifier for the press against chest action.
 *
 * @type {string}
 */
export const PRESS_AGAINST_CHEST_ACTION_ID =
  'sex-breastplay:press_against_chest';

/**
 * Default actor identifier used in press against chest scenarios.
 *
 * @type {string}
 */
export const PRESS_AGAINST_CHEST_ACTOR_ID = 'lyra';

/**
 * Scope that resolves close partners facing each other.
 *
 * @type {string}
 */
export const PRESS_AGAINST_CHEST_SCOPE_ID =
  'personal-space:close_actors_facing_each_other';

/**
 * Default target identifier used in press against chest scenarios.
 *
 * @type {string}
 */
export const PRESS_AGAINST_CHEST_TARGET_ID = 'darius';

/**
 * Default room identifier for breast pressing scenes.
 *
 * @type {string}
 */
export const PRESS_AGAINST_CHEST_ROOM_ID = 'amethyst_suite';

/**
 * @typedef {object} PressAgainstChestScenarioOptions
 * @property {boolean} [includeCloseness=true] - Whether both partners should begin in closeness.
 * @property {boolean} [actorHasBreasts=true] - Whether the acting partner should include breast anatomy.
 * @property {boolean} [actorFacingAwayFromTarget=false] - Whether the actor should face away from the target.
 * @property {boolean} [targetFacingAwayFromActor=false] - Whether the target should face away from the actor.
 */

/**
 * @description Builds a scenario for testing the press against chest action.
 * @param {PressAgainstChestScenarioOptions} [options] - Scenario customization options.
 * @returns {{
 *   entities: Array<object>,
 *   actorId: string,
 *   targetId: string,
 *   roomId: string,
 *   actorTorsoId: string,
 *   actorLeftBreastId: string|null,
 *   actorRightBreastId: string|null
 * }} Configured scenario entities and identifiers.
 */
export function buildPressAgainstChestScenario(options = {}) {
  const {
    includeCloseness = true,
    actorHasBreasts = true,
    actorFacingAwayFromTarget = false,
    targetFacingAwayFromActor = false,
  } = options;

  const actorId = PRESS_AGAINST_CHEST_ACTOR_ID;
  const targetId = PRESS_AGAINST_CHEST_TARGET_ID;
  const roomId = PRESS_AGAINST_CHEST_ROOM_ID;
  const actorTorsoId = `${actorId}_torso`;
  const actorLeftBreastId = `${actorId}_left_breast`;
  const actorRightBreastId = `${actorId}_right_breast`;

  const room = new ModEntityBuilder(roomId).asRoom('Amethyst Suite').build();

  const actorBuilder = new ModEntityBuilder(actorId)
    .withName('Lyra')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .asActor()
    .withBody(actorTorsoId)
    .withComponent('positioning:facing_away', {
      facing_away_from: actorFacingAwayFromTarget ? [targetId] : [],
    });

  if (includeCloseness) {
    actorBuilder.closeToEntity(targetId);
  }

  const targetBuilder = new ModEntityBuilder(targetId)
    .withName('Darius')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .asActor()
    .withComponent('positioning:facing_away', {
      facing_away_from: targetFacingAwayFromActor ? [actorId] : [],
    });

  if (includeCloseness) {
    targetBuilder.closeToEntity(actorId);
  }

  const entities = [room, actorBuilder.build(), targetBuilder.build()];

  const actorTorso = new ModEntityBuilder(actorTorsoId)
    .asBodyPart({
      parent: null,
      children: actorHasBreasts ? [actorLeftBreastId, actorRightBreastId] : [],
      subType: 'torso',
    })
    .build();

  entities.push(actorTorso);

  if (actorHasBreasts) {
    const leftBreast = new ModEntityBuilder(actorLeftBreastId)
      .asBodyPart({ parent: actorTorsoId, children: [], subType: 'breast' })
      .build();
    const rightBreast = new ModEntityBuilder(actorRightBreastId)
      .asBodyPart({ parent: actorTorsoId, children: [], subType: 'breast' })
      .build();

    entities.push(leftBreast, rightBreast);
  }

  return {
    entities,
    actorId,
    targetId,
    roomId,
    actorTorsoId,
    actorLeftBreastId: actorHasBreasts ? actorLeftBreastId : null,
    actorRightBreastId: actorHasBreasts ? actorRightBreastId : null,
  };
}
