// src/utils/locationUtils.js

import { EXITS_COMPONENT_ID } from '../constants/componentIds.js';
import { safeDispatchError } from './safeDispatchErrorUtils.js';
import { isNonBlankString } from './textUtils.js';
import { getPrefixedLogger } from './loggerUtils.js';
import {
  isValidEntityManager,
  isValidEntity,
} from './entityValidationUtils.js';
import { resolveEntityInstance } from './componentAccessUtils.js';

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/ILogger.js').ILogger} ILogger */

/**
 * @typedef {object} ExitData
 * @property {string} direction - Keyword for this exit's direction.
 * @property {string} target - ID of the destination location (resolved instance ID).
 * @property {string} [description] - Optional exit description.
 * @property {string} [blocker] - Optional ID of an entity blocking the exit (resolved instance ID).
 * @property {boolean} [locked] - Flag indicating if the exit is locked.
 * @property {string[]} [requiredKeys] - IDs of entities that unlock the exit.
 * @property {object} [conditions] - JsonLogic conditions for availability.
 */

/**
 * Retrieve the exits component data from a location entity.
 *
 * @private
 * @param {Entity | string} locationEntityOrId - Entity instance or ID to check.
 * @param {IEntityManager} entityManager - Used to fetch the entity when an ID is provided.
 * @param {ILogger} [logger] - Optional logger for debug messages.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher -
 * Safe dispatcher for error events.
 * @returns {ExitData[] | null} Array of exit objects or null when unavailable.
 */
function _getExitsComponentData(
  locationEntityOrId,
  entityManager,
  logger,
  dispatcher
) {
  const log = getPrefixedLogger(logger, '[locationUtils] ');
  if (
    typeof locationEntityOrId === 'string' &&
    !isValidEntityManager(entityManager)
  ) {
    const message =
      "_getExitsComponentData: EntityManager is required when passing location ID, but it's invalid.";
    const details = {
      locationId: locationEntityOrId,
      entityManagerValid:
        !!entityManager &&
        typeof entityManager.getEntityInstance === 'function',
    };
    safeDispatchError(dispatcher, message, details);

    return null;
  }

  const locationEntity = resolveEntityInstance(
    locationEntityOrId,
    entityManager,
    log
  );

  if (!isValidEntity(locationEntity)) {
    const id =
      typeof locationEntityOrId === 'string'
        ? locationEntityOrId
        : locationEntity?.id || 'unknown';
    log.warn(
      `_getExitsComponentData: Location entity not found or invalid for ID/object: ${id}`
    );
    return null;
  }

  const exitsData = locationEntity.getComponentData(EXITS_COMPONENT_ID);
  if (!Array.isArray(exitsData)) {
    log.debug(
      `_getExitsComponentData: Location '${locationEntity.id}' has no '${EXITS_COMPONENT_ID}' component, or it's not an array.`
    );
    return null;
  }
  return /** @type {ExitData[]} */ (exitsData);
}

/**
 * Get details for a specific exit by direction name.
 *
 * @param {Entity | string} locationEntityOrId - Location entity or its ID.
 * @param {string} directionName - Direction to search for.
 * @param {IEntityManager} entityManager - Manager used to fetch the entity.
 * @param {ILogger} [logger] - Optional logger for diagnostics.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher -
 * Safe dispatcher for error events.
 * @returns {ExitData | null} The exit data if found, otherwise null.
 */
export function getExitByDirection(
  locationEntityOrId,
  directionName,
  entityManager,
  logger,
  dispatcher
) {
  const log = getPrefixedLogger(logger, '[locationUtils] ');
  if (!isNonBlankString(directionName)) {
    log.debug('getExitByDirection: Invalid or empty directionName provided.');
    return null;
  }

  const exitsData = _getExitsComponentData(
    locationEntityOrId,
    entityManager,
    log,
    dispatcher
  );
  if (!exitsData || exitsData.length === 0) {
    return null;
  }

  const normalizedDirName = directionName.toLowerCase().trim();
  for (const exit of exitsData) {
    if (
      exit &&
      isNonBlankString(exit.direction) &&
      exit.direction.toLowerCase().trim() === normalizedDirName
    ) {
      if (isNonBlankString(exit.target)) {
        return exit;
      }
      const locId =
        typeof locationEntityOrId === 'string'
          ? locationEntityOrId
          : locationEntityOrId?.id || 'unknown';
      log.warn(
        `getExitByDirection: Found exit for direction '${directionName}' in location '${locId}', but its target ID ('target' property) is invalid: ${JSON.stringify(
          // CHANGED warning message
          exit
        )}`
      );
      return null; // Return null if target is invalid for the found direction
    }
  }
  const locId =
    typeof locationEntityOrId === 'string'
      ? locationEntityOrId
      : locationEntityOrId?.id || 'unknown';
  log.debug(
    `getExitByDirection: No exit found for direction '${directionName}' in location '${locId}'.`
  );
  return null;
}

/**
 * Get all valid and available exits from a location.
 *
 * @param {Entity | string} locationEntityOrId - Location entity or its ID.
 * @param {IEntityManager} entityManager - Manager used to fetch the entity.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher -
 * Safe dispatcher for error events.
 * @param {ILogger} [logger] - Optional logger for diagnostics.
 * @returns {ExitData[]} Array of valid exit objects.
 */
export function getAvailableExits(
  locationEntityOrId,
  entityManager,
  dispatcher,
  logger
) {
  const log = getPrefixedLogger(logger, '[locationUtils] ');
  const exitsData = _getExitsComponentData(
    locationEntityOrId,
    entityManager,
    log,
    dispatcher
  );
  if (!exitsData || exitsData.length === 0) {
    return [];
  }

  const validExits = [];
  const locIdForLog =
    typeof locationEntityOrId === 'string'
      ? locationEntityOrId
      : locationEntityOrId?.id || 'unknown';

  for (const exit of exitsData) {
    if (
      exit &&
      typeof exit === 'object' &&
      isNonBlankString(exit.direction) &&
      isNonBlankString(exit.target)
    ) {
      validExits.push(exit);
    } else {
      log.warn(
        `getAvailableExits: Invalid exit object found in location '${locIdForLog}' (expected 'direction' and 'target' to be non-empty strings): ${JSON.stringify(
          // Enhanced warning message
          exit
        )}. Skipping.`
      );
    }
  }
  return validExits;
}

export { _getExitsComponentData };
