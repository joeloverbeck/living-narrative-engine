// src/utils/locationUtils.js

import { EXITS_COMPONENT_ID } from '../constants/componentIds.js';
import { safeDispatchError } from './safeDispatchErrorUtils.js';
import { isNonBlankString } from './textUtils.js';
import { getModuleLogger } from './loggerUtils.js';
import {
  isValidEntityManager,
  isValidEntity,
} from './entityValidationUtils.js';
import { resolveEntityInstance } from './componentAccessUtils.js';

/**
 * Get the identifier string for a location entity or ID for logging.
 *
 * @param {Entity | string | null | undefined} locationEntityOrId - Location entity or ID.
 * @returns {string} Identifier string for logs.
 */
export function getLocationIdForLog(locationEntityOrId) {
  return typeof locationEntityOrId === 'string'
    ? locationEntityOrId
    : locationEntityOrId?.id || 'unknown';
}

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
 * Resolve a location entity from an instance or its ID.
 *
 * @private
 * @param {Entity | string} locationEntityOrId - Entity instance or ID.
 * @param {IEntityManager} entityManager - Manager used when an ID is provided.
 * @param {ILogger} [logger] - Optional logger for diagnostics.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher -
 * Safe dispatcher for error events.
 * @returns {Entity | null} The resolved location entity or `null`.
 */
function _resolveLocationEntity(
  locationEntityOrId,
  entityManager,
  logger,
  dispatcher
) {
  const log = getModuleLogger('locationUtils', logger);

  if (
    !locationEntityOrId ||
    (typeof locationEntityOrId === 'string' && locationEntityOrId.trim() === '')
  ) {
    log.debug('_resolveLocationEntity: locationEntityOrId is invalid.');
    return null;
  }

  if (
    typeof locationEntityOrId === 'string' &&
    !isValidEntityManager(entityManager)
  ) {
    const message =
      "_resolveLocationEntity: EntityManager is required when passing location ID, but it's invalid.";
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
    const id = getLocationIdForLog(
      typeof locationEntityOrId === 'string'
        ? locationEntityOrId
        : locationEntity
    );
    log.warn(
      `_resolveLocationEntity: Location entity not found or invalid for ID/object: ${id}`
    );
    return null;
  }

  return locationEntity;
}

/**
 * Retrieve the exits component data from a location entity.
 *
 * @private
 * @param {Entity} locationEntity - The resolved location entity.
 * @param {ILogger} [logger] - Optional logger for diagnostics.
 * @returns {ExitData[] | null} Array of exit objects or null when unavailable.
 */
function _readExitsComponent(locationEntity, logger) {
  const log = getModuleLogger('locationUtils', logger);
  const exitsData = locationEntity.getComponentData(EXITS_COMPONENT_ID);
  if (!Array.isArray(exitsData)) {
    log.debug(
      `_readExitsComponent: Location '${locationEntity.id}' has no '${EXITS_COMPONENT_ID}' component, or it's not an array.`
    );
    return null;
  }
  return /** @type {ExitData[]} */ (exitsData);
}

/**
 * Normalize a direction string for comparison.
 *
 * @private
 * @param {string} name - Direction name to normalize.
 * @returns {string} Normalized direction value.
 */
export function _normalizeDirection(name) {
  return isNonBlankString(name) ? name.toLowerCase().trim() : '';
}

/**
 * Validate whether an exit object has required properties.
 *
 * @private
 * @param {any} exit - Exit object to validate.
 * @returns {boolean} True if the exit is valid.
 */
export function _isValidExit(exit) {
  return (
    !!exit &&
    typeof exit === 'object' &&
    isNonBlankString(exit.direction) &&
    isNonBlankString(exit.target)
  );
}

/**
 * Fetch and validate exits component data from a location entity.
 *
 * @private
 * @param {Entity | string} locationEntityOrId - Entity instance or ID to check.
 * @param {IEntityManager} entityManager - Used to fetch the entity when an ID is provided.
 * @param {ILogger} [logger] - Optional logger for debug messages.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher -
 * Safe dispatcher for error events.
 * @returns {ExitData[] | null} Validated exit array or `null` when unavailable.
 */
function fetchValidExitData(
  locationEntityOrId,
  entityManager,
  logger,
  dispatcher
) {
  const locationEntity = _resolveLocationEntity(
    locationEntityOrId,
    entityManager,
    logger,
    dispatcher
  );

  if (!locationEntity) {
    return null;
  }

  return _readExitsComponent(locationEntity, logger);
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
  const log = getModuleLogger('locationUtils', logger);
  if (!isNonBlankString(directionName)) {
    log.debug('getExitByDirection: Invalid or empty directionName provided.');
    return null;
  }

  const exitsData = fetchValidExitData(
    locationEntityOrId,
    entityManager,
    log,
    dispatcher
  );

  if (!exitsData || exitsData.length === 0) {
    return null;
  }

  const normalizedDirName = _normalizeDirection(directionName);
  for (const exit of exitsData) {
    if (
      _isValidExit(exit) &&
      _normalizeDirection(exit.direction) === normalizedDirName
    ) {
      return exit;
    }
    if (
      exit &&
      isNonBlankString(exit.direction) &&
      _normalizeDirection(exit.direction) === normalizedDirName
    ) {
      const locId = getLocationIdForLog(locationEntityOrId);
      log.warn(
        `getExitByDirection: Found exit for direction '${directionName}' in location '${locId}', but its target ID ('target' property) is invalid: ${JSON.stringify(
          exit
        )}`
      );
      return null;
    }
  }
  const locId = getLocationIdForLog(locationEntityOrId);
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
  const log = getModuleLogger('locationUtils', logger);
  const exitsData = fetchValidExitData(
    locationEntityOrId,
    entityManager,
    log,
    dispatcher
  );
  if (!exitsData || exitsData.length === 0) {
    return [];
  }

  const validExits = [];
  const locIdForLog = getLocationIdForLog(locationEntityOrId);

  for (const exit of exitsData) {
    if (_isValidExit(exit)) {
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
