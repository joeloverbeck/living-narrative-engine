// src/actions/utils/discoveryErrorUtils.js

/**
 * @module discoveryErrorUtils
 * @description Utilities for creating and parsing discovery errors.
 */

/**
 * Creates a standardized error object for action discovery.
 *
 * @param {string} actionId - ID of the action that failed.
 * @param {string|null} targetId - ID of the target entity, if available.
 * @param {Error|string} error - The encountered error instance or message.
 * @param {any|null} [details] - Optional additional error details.
 * @returns {{ actionId: string, targetId: string|null, error: Error|string, details: any|null }}
 *   The standardized error object.
 */
export function createDiscoveryError(
  actionId,
  targetId,
  error,
  details = null
) {
  return { actionId, targetId, error, details };
}

/**
 * Extracts a target entity ID from various error shapes.
 *
 * @param {Error|object} error - The error thrown during action processing.
 * @returns {string|null} The resolved target entity ID or null if not present.
 */
export function extractTargetId(error) {
  return error?.targetId ?? error?.target?.entityId ?? error?.entityId ?? null;
}
