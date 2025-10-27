// src/utils/warnUtils.js
// -----------------------------------------------------------------------------
// Utility helpers for standard warning messages.
// -----------------------------------------------------------------------------

/**
 * @module warnUtils
 * @description Helper for standardized warning messages when no active turn is present.
 */

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} Logger
 * Logger interface used throughout the application.
 */

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
  const stateLabel =
    typeof stateName === 'string' && stateName.trim().length > 0
      ? stateName.trim()
      : 'UnknownState';
  const methodLabel =
    typeof methodName === 'string' && methodName.length > 0
      ? methodName
      : 'Unknown method';
  const actorLabel =
    typeof actorId === 'string' && actorId.length > 0
      ? actorId
      : 'unknown actor';

  const needsIdleNote =
    methodLabel.startsWith('Command') ||
    methodLabel.startsWith('handleTurnEndedEvent');

  const requiresSeparator = !/[\s(]$/.test(methodLabel);
  const formattedMethod = requiresSeparator
    ? `${methodLabel} `
    : methodLabel;

  const message = `${stateLabel}: ${formattedMethod}${actorLabel} but no turn is active${
    needsIdleNote ? ' (handler is Idle).' : '.'
  }`;
  logger.warn(message);
}

export default { warnNoActiveTurn };
