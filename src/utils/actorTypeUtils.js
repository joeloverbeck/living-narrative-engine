// src/utils/actorTypeUtils.js

/**
 * @file Utility to determine the actor type string.
 */

/**
 * Determines the actor type for event payloads.
 *
 * @description
 * Returns `'ai'` when the provided actor has an `isAi` property set to
 * `true`. For all other cases, `'human'` is returned. The function may be
 * extended later to handle additional actor classifications.
 * @param {object} actor - Actor entity or model to inspect.
 * @returns {string} `'ai'` if the actor is flagged as AI, otherwise `'human'`.
 */
export function getActorType(actor) {
  return actor && actor.isAi === true ? 'ai' : 'human';
}
