/**
 * @file Validation utilities for turn state actors.
 */

/**
 * @typedef {import('../../../entities/entity.js').default} Entity
 */

/**
 * Ensures the provided actor is valid.
 *
 * @param {Entity} actor - Actor entity to validate.
 * @param {string} stateName - Name of the calling state.
 * @returns {?string} Error message when actor is invalid, otherwise `null`.
 */
export function assertValidActor(actor, stateName) {
  if (!actor || typeof actor.id === 'undefined') {
    return `${stateName}: invalid actorEntity.`;
  }
  return null;
}

/**
 * Validates that two actors represent the same entity.
 *
 * @param {Entity} expectedActor - Actor expected by the state.
 * @param {Entity} contextActor - Actor retrieved from context.
 * @param {string} stateName - Name of the calling state.
 * @returns {?string} Error message when actors do not match, otherwise `null`.
 */
export function assertMatchingActor(expectedActor, contextActor, stateName) {
  const expectedError = assertValidActor(expectedActor, stateName);
  if (expectedError) return expectedError;
  const contextError = assertValidActor(contextActor, stateName);
  if (contextError) return contextError;

  if (expectedActor.id !== contextActor.id) {
    return `${stateName}: Actor in ITurnContext ('${contextActor.id}') does not match actor provided to state's startTurn ('${expectedActor.id}').`;
  }
  return null;
}

/**
 * @description Validates that the provided context exposes required methods.
 * @param {object|null} ctx - ITurnContext-like object to inspect.
 * @param {string[]} methods - Method names expected on the context.
 * @returns {string[]} Array of method names that are missing or not functions.
 */
export function validateContextMethods(ctx, methods) {
  if (!ctx) {
    return [...methods];
  }
  return methods.filter((m) => typeof ctx[m] !== 'function');
}
