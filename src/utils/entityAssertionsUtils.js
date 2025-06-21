// src/utils/entityAssertions.js
/**
 * @file Provides assertion utilities for entity validation.
 */

/**
 * @typedef {import('../entities/entity.js').default} Entity
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

import { isNonBlankString } from './textUtils.js';
import { getModuleLogger } from './loggerUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';

/**
 * Throws an error if the provided entity is invalid.
 * An entity is invalid if it is null or lacks a non-blank `id` property.
 *
 * @param {Entity} entity - The entity to validate.
 * @param {ILogger} [logger] - Optional logger for warnings.
 * @param {string} [contextName] - Name of the calling context.
 * @param {ISafeEventDispatcher} [safeEventDispatcher] - Optional dispatcher for SYSTEM_ERROR_OCCURRED_ID events.
 * @throws {Error} If the entity is invalid.
 */
export function assertValidEntity(
  entity,
  logger,
  contextName = 'UnknownContext',
  safeEventDispatcher
) {
  const log = getModuleLogger('EntityValidation', logger);
  if (!entity || !isNonBlankString(entity.id)) {
    const errMsg = `${contextName}: entity is required and must have a valid id.`;
    const payload = {
      message: errMsg,
      details: { contextName, entityId: entity?.id ?? null, entity },
    };
    if (safeEventDispatcher?.dispatch) {
      safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, payload);
    } else {
      log.warn(`${errMsg} - SafeEventDispatcher missing.`, { entity });
    }
    throw new Error(errMsg);
  }
}

/**
 * Backwards compatibility wrapper for actor validation.
 *
 * @param {Entity} actor - Actor entity being validated.
 * @param {ILogger} [logger] - Logger used for warnings when dispatcher missing.
 * @param {string} [contextName] - Calling context for clearer error messages.
 * @param {ISafeEventDispatcher} [safeEventDispatcher] - Dispatcher for SYSTEM_ERROR_OCCURRED_ID events.
 * @deprecated Use {@link assertValidEntity} instead.
 * @throws {Error}
 */
export function assertValidActor(
  actor,
  logger,
  contextName = 'UnknownContext',
  safeEventDispatcher
) {
  assertValidEntity(actor, logger, contextName, safeEventDispatcher);
}
