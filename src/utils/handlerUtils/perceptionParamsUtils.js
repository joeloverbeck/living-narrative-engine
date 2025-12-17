/**
 * @file Shared utilities for perception-related operation handlers
 *
 * Extracts common validation and normalization logic used by both
 * AddPerceptionLogEntryHandler and DispatchPerceptibleEventHandler.
 *
 * @see src/logic/operationHandlers/addPerceptionLogEntryHandler.js
 * @see src/logic/operationHandlers/dispatchPerceptibleEventHandler.js
 */

import { safeDispatchError } from '../safeDispatchErrorUtils.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

/**
 * Validates and trims a location_id parameter.
 *
 * @param {string|null|undefined} locationId - The location ID to validate.
 * @param {string} operationName - For error messages (e.g., 'ADD_PERCEPTION_LOG_ENTRY').
 * @param {ISafeEventDispatcher} dispatcher - For error dispatch.
 * @param {ILogger} logger - For logging.
 * @returns {string|null} Trimmed location_id or null if invalid.
 */
export function validateLocationId(
  locationId,
  operationName,
  dispatcher,
  logger
) {
  if (typeof locationId !== 'string' || !locationId.trim()) {
    safeDispatchError(
      dispatcher,
      `${operationName}: location_id is required`,
      { location_id: locationId },
      logger
    );
    return null;
  }
  return locationId.trim();
}

/**
 * Normalizes an array of entity IDs by filtering non-strings and trimming whitespace.
 * Handles both array and single-string inputs.
 *
 * @param {string[]|string|null|undefined} ids - Raw IDs from params.
 * @returns {string[]} Normalized array of trimmed IDs (empty array if input is invalid).
 */
export function normalizeEntityIds(ids) {
  if (Array.isArray(ids)) {
    return ids
      .filter((id) => typeof id === 'string' && id.trim())
      .map((id) => id.trim());
  }

  if (typeof ids === 'string') {
    const trimmed = ids.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
}

/**
 * Validates mutual exclusivity of recipientIds and excludedActorIds.
 *
 * @param {string[]} recipientIds - Explicit recipients (already normalized).
 * @param {string[]} excludedActorIds - Excluded actors (already normalized).
 * @param {string} operationName - For error/warning messages.
 * @param {ISafeEventDispatcher} dispatcher - For error dispatch.
 * @param {ILogger} logger - For logging.
 * @param {'warn'|'error'} behavior - How to handle conflict:
 *   - 'warn': Log warning, return true (continue with recipientIds)
 *   - 'error': Dispatch error, return false (abort operation)
 * @returns {boolean} True if valid (or warned and can continue), false if error dispatched.
 */
export function validateRecipientExclusionExclusivity(
  recipientIds,
  excludedActorIds,
  operationName,
  dispatcher,
  logger,
  behavior = 'error'
) {
  const hasRecipients = recipientIds.length > 0;
  const hasExclusions = excludedActorIds.length > 0;

  if (hasRecipients && hasExclusions) {
    if (behavior === 'warn') {
      logger.warn(
        `${operationName}: recipientIds and excludedActorIds both provided; using recipientIds only`
      );
      return true; // Continue with recipientIds
    }

    // behavior === 'error'
    safeDispatchError(
      dispatcher,
      `${operationName}: recipientIds and excludedActorIds are mutually exclusive`,
      { recipientIds, excludedActorIds },
      logger
    );
    return false; // Abort operation
  }

  return true; // Valid - no conflict
}

/**
 * Builds a standardized perception log entry object.
 *
 * @param {object} options - Entry construction options.
 * @param {string} options.descriptionText - Human-readable description.
 * @param {string} options.timestamp - ISO timestamp string.
 * @param {string} options.perceptionType - Category of perceptible event.
 * @param {string} options.actorId - Entity primarily responsible.
 * @param {string|null} [options.targetId=null] - Optional target entity.
 * @param {string[]} [options.involvedEntities=[]] - Optional other entity IDs.
 * @returns {object} Standardized log entry object.
 */
export function buildLogEntry({
  descriptionText,
  timestamp,
  perceptionType,
  actorId,
  targetId = null,
  involvedEntities = [],
}) {
  return {
    descriptionText,
    timestamp,
    perceptionType,
    actorId,
    targetId: targetId ?? null,
    involvedEntities: Array.isArray(involvedEntities) ? involvedEntities : [],
  };
}
