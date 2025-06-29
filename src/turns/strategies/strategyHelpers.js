// src/turns/strategies/strategyHelpers.js
/**
 * Helper functions shared by turn directive strategies.
 *
 * @module strategyHelpers
 */

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Validates that a directive matches the expected value.
 * Throws an error and logs when the directive is unexpected.
 *
 * @param {object} params
 * @param {*} params.expected - Expected directive constant.
 * @param {*} params.actual - Actual directive value.
 * @param {ILogger} params.logger - Logger for error output.
 * @param {string} params.className - Name of the calling strategy class.
 * @throws {Error} When the directive differs from the expected value.
 * @returns {void}
 */
export function assertDirective({ expected, actual, logger, className }) {
  if (actual !== expected) {
    const msg = `${className}: Received wrong directive (${actual}). Expected ${expected}.`;
    if (logger && typeof logger.error === 'function') {
      logger.error(msg);
    }
    throw new Error(msg);
  }
}

/**
 * Retrieves the actor from the provided ITurnContext. If no actor is present,
 * logs an error and ends the turn with that error.
 *
 * @param {object} params
 * @param {ITurnContext} params.turnContext - The turn context providing getActor and endTurn.
 * @param {ILogger} params.logger - Logger for error output.
 * @param {string} params.className - Name of the calling strategy class.
 * @param {string} params.errorMsg - Error message used when the actor is missing.
 * @returns {import('../../entities/entity.js').default | null} The actor or null when missing.
 */
export function requireContextActor({
  turnContext,
  logger,
  className,
  errorMsg,
}) {
  const contextActor = turnContext.getActor();
  if (!contextActor) {
    const msg = errorMsg || `${className}: No actor found in ITurnContext.`;
    if (logger && typeof logger.error === 'function') {
      logger.error(msg);
    }
    turnContext.endTurn(new Error(msg));
    return null;
  }
  return contextActor;
}
