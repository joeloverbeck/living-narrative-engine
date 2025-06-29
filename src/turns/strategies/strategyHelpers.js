// src/turns/strategies/strategyHelpers.js
// -----------------------------------------------------------------------------
// Strategy Helper Functions
// -----------------------------------------------------------------------------

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum */

/**
 * Validates that the provided directive matches the expected directive.
 * Throws an error when a mismatch occurs.
 *
 * @param {object} params - Helper parameters.
 * @param {TurnDirectiveEnum} params.expected - The directive the strategy expects.
 * @param {TurnDirectiveEnum} params.actual - The directive provided to the strategy.
 * @param {{ error?(msg: string): void }} params.logger - Logger for error reporting.
 * @param {string} params.className - The invoking class name for error messages.
 * @throws {Error} When the actual directive does not match the expected directive.
 */
export function assertDirective({ expected, actual, logger, className }) {
  if (actual !== expected) {
    const message = `${className}: Received wrong directive (${actual}). Expected ${expected}.`;
    logger?.error?.(message);
    throw new Error(message);
  }
}

/**
 * Retrieves the actor from the provided turn context or ends the turn with an
 * error when none exists.
 *
 * @param {object} params - Helper parameters.
 * @param {ITurnContext} params.turnContext - The active turn context.
 * @param {{ error?(msg: string): void }} params.logger - Logger for error reporting.
 * @param {string} params.className - The invoking class name for error messages.
 * @param {string} params.errorMsg - Message to use when no actor is present.
 * @returns {Entity|null} The actor from the context, or null if missing.
 */
export function requireContextActor({
  turnContext,
  logger,
  className,
  errorMsg,
}) {
  const actor = turnContext.getActor();
  if (!actor) {
    const message = `${className}: ${errorMsg}`;
    logger?.error?.(message);
    turnContext.endTurn(new Error(message));
    return null;
  }
  return actor;
}
