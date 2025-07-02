// src/turns/strategies/strategyHelpers.js
/**
 * Helper functions shared by turn directive strategies.
 *
 * @module strategyHelpers
 */

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Retrieves the logger from the turnContext and the class name from the
 * provided instance.
 *
 * @param {object} instance - The strategy instance (`this`).
 * @param {ITurnContext} turnContext - Context providing `getLogger`.
 * @returns {{ logger: ILogger, className: string }} Object containing logger
 *          and class name.
 */
export function getLoggerAndClass(instance, turnContext) {
  return {
    logger: turnContext.getLogger(),
    className: instance.constructor.name,
  };
}

/**
 * Builds a standardized error message when the wrong directive is supplied.
 *
 * @param {string} className - Name of the strategy class.
 * @param {*} actual - The directive provided.
 * @param {*} expected - The directive expected.
 * @returns {string} The formatted error message.
 */
export function buildWrongDirectiveMessage(className, actual, expected) {
  return `${className}: Received wrong directive (${actual}). Expected ${expected}.`;
}

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
    const msg = buildWrongDirectiveMessage(className, actual, expected);
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

/**
 * Determines the appropriate Error object when ending a turn due to failure.
 *
 * @param {import('../../types/commandResult.js').CommandResult} commandResult -
 *        Result produced by command processing.
 * @param {string} actorId - ID of the actor whose turn is ending.
 * @param {string} directive - Directive triggering the turn end.
 * @returns {Error} The error instance describing the failure.
 */
export function resolveTurnEndError(commandResult, actorId, directive) {
  if (commandResult?.error instanceof Error) {
    return commandResult.error;
  }
  if (commandResult?.error !== undefined && commandResult?.error !== null) {
    return new Error(String(commandResult.error));
  }
  return new Error(
    `Turn for actor ${actorId} ended by directive '${directive}' (failure).`
  );
}
