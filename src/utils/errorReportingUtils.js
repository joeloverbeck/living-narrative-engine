/**
 * @file Utilities for reporting missing actor IDs.
 */

/**
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../interfaces/coreServices.js').ILogger|Console} ILogger
 */

import { safeDispatchError } from './safeDispatchErrorUtils.js';

/**
 * @description Dispatches a system warning and logs when an actor ID is missing.
 * @param {ISafeEventDispatcher|null} dispatcher - Dispatcher for system errors.
 * @param {ILogger} logger - Logger instance for warnings.
 * @param {string|null|undefined} providedId - Actor ID originally supplied.
 * @param {string} fallbackId - Fallback ID that will be used.
 * @returns {void}
 */
export function reportMissingActorId(
  dispatcher,
  logger,
  providedId,
  fallbackId
) {
  const message = 'Actor ID must be provided but was missing.';
  if (dispatcher) {
    safeDispatchError(
      dispatcher,
      message,
      { providedActorId: providedId ?? null, fallbackActorId: fallbackId },
      logger
    );
  }
  logger.warn(`Actor ID was missing; fell back to '${fallbackId}'.`);
}

// --- FILE END ---
