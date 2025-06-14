// src/utils/actorValidation.js
/**
 * @file Utility function to validate an actor entity.
 * @note This is a placeholder for work to be done in T-004.
 */

/**
 * @typedef {import('../entities/entity.js').default} Entity
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

import { isNonEmptyString } from './textUtils.js';
import { getPrefixedLogger } from './loggerUtils.js';
import { DISPLAY_ERROR_ID } from '../constants/eventIds.js';

/**
 * Throws an error if the provided actor is invalid.
 * An actor is considered invalid if it is null, or has no ID.
 *
 * @param {Entity} actor - The actor entity to validate.
 * @param {ILogger} [logger] - An optional logger instance for logging errors.
 * @param {string} [contextName] - The name of the calling context for improved error messages.
 * @param {ISafeEventDispatcher} [safeEventDispatcher] - Dispatcher used to send DISPLAY_ERROR_ID events.
 * @throws {Error} If the actor is invalid.
 */
export function assertValidActor(
  actor,
  logger,
  contextName = 'UnknownContext',
  safeEventDispatcher
) {
  const log = getPrefixedLogger(logger, '[ActorValidation] ');
  if (!actor || !isNonEmptyString(actor.id)) {
    const errMsg = `${contextName}: actor is required and must have a valid id.`;
    const payload = {
      message: errMsg,
      details: { contextName, actorId: actor?.id ?? null, actor },
    };
    if (safeEventDispatcher?.dispatch) {
      safeEventDispatcher.dispatch(DISPLAY_ERROR_ID, payload);
    } else {
      log.warn(`${errMsg} - SafeEventDispatcher missing.`, { actor });
    }
    throw new Error(errMsg);
  }
}
