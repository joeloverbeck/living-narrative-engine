/**
 * @file Utility functions for validating operation parameters.
 * @module operationValidationUtils
 */

/** @typedef {import('../logic/defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../logic/operationHandlers/modifyComponentHandler.js').EntityRefObject} EntityRefObject */

import { resolveEntityId } from './entityRefUtils.js';
import { safeDispatchError } from './safeDispatchErrorUtils.js';
import { ensureValidLogger } from './loggerUtils.js';

/**
 * Validate and resolve an entity reference. Emits warnings or error events on failure.
 *
 * @param {'actor'|'target'|string|EntityRefObject} entityRef - Reference to resolve.
 * @param {ExecutionContext} executionContext - Execution context used for keyword resolution.
 * @param {ILogger} logger - Logger used for warnings.
 * @param {ISafeEventDispatcher} [dispatcher] - Optional dispatcher for error events.
 * @param {string} [operationName] - Optional prefix for log messages.
 * @returns {string|null} Resolved entity id or `null` when invalid.
 */
export function validateEntityRef(
  entityRef,
  executionContext,
  logger,
  dispatcher,
  operationName = ''
) {
  const log = ensureValidLogger(logger, 'validateEntityRef');
  const prefix = operationName ? `${operationName}: ` : '';

  if (!entityRef) {
    const message = `${prefix}"entity_ref" parameter is required.`;
    if (dispatcher && typeof dispatcher.dispatch === 'function') {
      safeDispatchError(dispatcher, message, { entity_ref: entityRef }, log);
    } else {
      log.warn(message);
    }
    return null;
  }

  const resolved = resolveEntityId(entityRef, executionContext);
  if (!resolved) {
    const message = `${prefix}Could not resolve entity id from entity_ref.`;
    if (dispatcher && typeof dispatcher.dispatch === 'function') {
      safeDispatchError(dispatcher, message, { entity_ref: entityRef }, log);
    } else {
      log.warn(message, { entity_ref: entityRef });
    }
    return null;
  }

  return resolved;
}

/**
 * Validate a component type string.
 *
 * @param {*} type - Raw component type value.
 * @param {ILogger} logger - Logger used for warnings.
 * @param {string} [operationName] - Optional prefix for log messages.
 * @returns {string|null} Trimmed component type or `null` when invalid.
 */
export function validateComponentType(type, logger, operationName = '') {
  const log = ensureValidLogger(logger, 'validateComponentType');
  const prefix = operationName ? `${operationName}: ` : '';

  if (typeof type !== 'string') {
    log.warn(
      `${prefix}Invalid or missing "component_type" parameter (must be non-empty string).`
    );
    return null;
  }

  const trimmed = type.trim();
  if (!trimmed) {
    log.warn(
      `${prefix}Invalid or missing "component_type" parameter (must be non-empty string).`
    );
    return null;
  }

  return trimmed;
}

export default {
  validateEntityRef,
  validateComponentType,
};
