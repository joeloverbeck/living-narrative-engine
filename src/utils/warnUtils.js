// src/utils/warnUtils.js
// -----------------------------------------------------------------------------
// Utility helpers for standard warning messages.
// -----------------------------------------------------------------------------

/**
 * @module warnUtils
 * @description Helper for standardized warning messages when no active turn is present.
 */

/** @typedef {import('./loggerUtils.js').Logger} Logger */

/**
 * Logs a standardized warning when a method is invoked without an active turn.
 *
 * @param {Logger} logger - Logger used for output.
 * @param {string} stateName - Name of the state issuing the warning.
 * @param {string} methodName - Name of the calling method.
 * @param {string} actorId - ID of the actor involved.
 * @returns {void}
 */
export function warnNoActiveTurn(logger, stateName, methodName, actorId) {
  const needsIdleNote =
    methodName.startsWith('Command') ||
    methodName.startsWith('handleTurnEndedEvent');

  const message = `${stateName}: ${methodName}${actorId} but no turn is active${
    needsIdleNote ? ' (handler is Idle).' : '.'
  }`;
  logger.warn(message);
}

export default { warnNoActiveTurn };
