/**
 * @file Validation utilities for turn state actors.
 */

/**
 * @typedef {import('../../../entities/entity.js').default} Entity
 */

import { UNKNOWN_ENTITY_ID } from '../../../constants/unknownIds.js';

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
 * @param {object|null} turnContext - ITurnContext-like object to inspect.
 * @param {string[]} methods - Method names expected on the context.
 * @returns {string[]} Array of method names that are missing or not functions.
 */
export function validateContextMethods(turnContext, methods) {
  if (!turnContext) {
    return [...methods];
  }
  return methods.filter((m) => typeof turnContext[m] !== 'function');
}

/**
 * Validates that an ITurnContext is present and optionally that the actor
 * within it matches an expected actor.
 *
 * @description Additional validation helper used by multiple states.
 * @param {import('../../interfaces/ITurnContext.js').ITurnContext|null} turnContext
 *   - The current turn context.
 * @param {?Entity} [expectedActor] - Actor expected to be in the context.
 * @param {string} stateName - Name of the calling state for error messages.
 * @returns {Entity} The actor retrieved from the context.
 * @throws {Error} If the context or actor is missing or mismatched.
 */
export function validateActorInContext(turnContext, expectedActor, stateName) {
  const actorIdForLog = expectedActor?.id ?? UNKNOWN_ENTITY_ID;
  if (!turnContext || typeof turnContext.getActor !== 'function') {
    throw new Error(
      `${stateName}: ITurnContext is missing or invalid. Expected concrete handler to set it up. Actor: ${actorIdForLog}.`
    );
  }

  const contextActor = turnContext.getActor();
  const errorMsg = expectedActor
    ? assertMatchingActor(expectedActor, contextActor, stateName)
    : assertValidActor(contextActor, stateName);

  if (errorMsg) {
    throw new Error(errorMsg);
  }

  return contextActor;
}

/**
 * Retrieves and validates the actor's strategy from context.
 *
 * @description Ensures a usable IActorTurnStrategy is available.
 * @param {import('../../interfaces/ITurnContext.js').ITurnContext|null} turnContext
 *   - The current turn context.
 * @param {Entity} actor - Actor whose strategy is expected.
 * @param {string} stateName - Name of the calling state for error messages.
 * @returns {import('../../interfaces/IActorTurnStrategy.js').IActorTurnStrategy}
 *   The resolved strategy.
 * @throws {Error} If the strategy is missing or malformed.
 */
export function retrieveStrategyFromContext(turnContext, actor, stateName) {
  if (!turnContext || typeof turnContext.getStrategy !== 'function') {
    throw new Error(
      `${stateName}: ITurnContext is missing or does not provide getStrategy().`
    );
  }

  const actorError = assertValidActor(actor, stateName);
  if (actorError) {
    throw new Error(actorError);
  }

  const strategy = turnContext.getStrategy();
  if (!strategy || typeof strategy.decideAction !== 'function') {
    const msg = `${stateName}: No valid IActorTurnStrategy found for actor ${actor.id} or strategy is malformed (missing decideAction).`;
    throw new Error(msg);
  }

  return strategy;
}

/**
 * Validates that a command string is a non-empty string.
 *
 * @param {any} commandString - The command string to validate.
 * @param {(message: string) => void} onError - Callback to execute with an error message if validation fails.
 * @returns {void}
 */
export function validateCommandString(commandString, onError) {
  if (typeof commandString !== 'string' || commandString.trim() === '') {
    onError('commandString must be a non-empty string.');
  }
}

/**
 * Validates that a turn action object is valid.
 * Currently checks for the presence and type of actionDefinitionId.
 *
 * @param {any} turnAction - The turn action to validate.
 * @param {(message: string) => void} onError - Callback to execute with an error message if validation fails.
 * @returns {void}
 */
export function validateTurnAction(turnAction, onError) {
  if (turnAction === null) {
    return;
  }
  if (typeof turnAction !== 'object') {
    onError('turnAction must be an object.');
    return;
  }
  if (
    typeof turnAction.actionDefinitionId !== 'string' ||
    turnAction.actionDefinitionId.trim() === ''
  ) {
    onError('turnAction.actionDefinitionId must be a non-empty string.');
  }
  // Add other critical turnAction property checks here if necessary
}
