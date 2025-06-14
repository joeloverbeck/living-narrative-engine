// src/utils/actorValidation.js
/**
 * @file Utility function to validate an actor entity.
 * @note This is a placeholder for work to be done in T-004.
 */

/**
 * @typedef {import('../entities/entity.js').default} Entity
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

import { isNonEmptyString } from './textUtils.js';
import { ensureValidLogger } from './loggerUtils.js';

/**
 * Throws an error if the provided actor is invalid.
 * An actor is considered invalid if it is null, or has no ID.
 *
 * @param {Entity} actor - The actor entity to validate.
 * @param {ILogger} [logger] - An optional logger instance for logging errors.
 * @param {string} [contextName] - The name of the calling context for improved error messages.
 * @throws {Error} If the actor is invalid.
 */
export function assertValidActor(
  actor,
  logger,
  contextName = 'UnknownContext'
) {
  const log = ensureValidLogger(logger, 'ActorValidation');
  if (!actor || !isNonEmptyString(actor.id)) {
    const errMsg = `${contextName}: actor is required and must have a valid id.`;
    log.error(errMsg, { actor });
    throw new Error(errMsg);
  }
}
