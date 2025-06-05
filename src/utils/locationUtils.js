// src/utils/locationUtils.js

import { EXITS_COMPONENT_ID } from '../constants/componentIds.js';

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/ILogger.js').ILogger} ILogger */

/**
 * @typedef {object} ExitData
 * @property {string} direction - Keyword for this exit's direction.
 * @property {string} targetLocationId - ID of the destination location.
 * @property {string} [description] - Optional exit description.
 * @property {string} [blocker] - Optional ID of an entity blocking the exit.
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
 * @returns {ExitData[] | null} Array of exit objects or null when unavailable.
 */
function _getExitsComponentData(locationEntityOrId, entityManager, logger) {
  let locationEntity = locationEntityOrId;

  if (typeof locationEntityOrId === 'string') {
    if (
      !entityManager ||
      typeof entityManager.getEntityInstance !== 'function'
    ) {
      logger?.error(
        "_getExitsComponentData: EntityManager is required when passing location ID, but it's invalid."
      );
      return null;
    }
    locationEntity = entityManager.getEntityInstance(locationEntityOrId);
  }

  if (
    !locationEntity ||
    typeof locationEntity.getComponentData !== 'function'
  ) {
    const id =
      typeof locationEntityOrId === 'string'
        ? locationEntityOrId
        : locationEntity?.id || 'unknown';
    logger?.warn(
      `_getExitsComponentData: Location entity not found or invalid for ID/object: ${id}`
    );
    return null;
  }

  const exitsData = locationEntity.getComponentData(EXITS_COMPONENT_ID);
  if (!Array.isArray(exitsData)) {
    logger?.debug(
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
 * @returns {ExitData | null} The exit data if found, otherwise null.
 */
export function getExitByDirection(
  locationEntityOrId,
  directionName,
  entityManager,
  logger
) {
  if (
    !directionName ||
    typeof directionName !== 'string' ||
    directionName.trim() === ''
  ) {
    logger?.debug(
      'getExitByDirection: Invalid or empty directionName provided.'
    );
    return null;
  }

  const exitsData = _getExitsComponentData(
    locationEntityOrId,
    entityManager,
    logger
  );
  if (!exitsData || exitsData.length === 0) {
    return null;
  }

  const normalizedDirName = directionName.toLowerCase().trim();
  for (const exit of exitsData) {
    if (
      exit &&
      typeof exit.direction === 'string' &&
      exit.direction.toLowerCase().trim() === normalizedDirName
    ) {
      if (
        typeof exit.targetLocationId === 'string' &&
        exit.targetLocationId.trim() !== ''
      ) {
        return exit;
      }
      const locId =
        typeof locationEntityOrId === 'string'
          ? locationEntityOrId
          : locationEntityOrId?.id || 'unknown';
      logger?.warn(
        `getExitByDirection: Found exit for direction '${directionName}' in location '${locId}', but its targetLocationId is invalid: ${JSON.stringify(
          exit
        )}`
      );
      return null;
    }
  }
  const locId =
    typeof locationEntityOrId === 'string'
      ? locationEntityOrId
      : locationEntityOrId?.id || 'unknown';
  logger?.debug(
    `getExitByDirection: No exit found for direction '${directionName}' in location '${locId}'.`
  );
  return null;
}

/**
 * Get all valid and available exits from a location.
 *
 * @param {Entity | string} locationEntityOrId - Location entity or its ID.
 * @param {IEntityManager} entityManager - Manager used to fetch the entity.
 * @param {ILogger} [logger] - Optional logger for diagnostics.
 * @returns {ExitData[]} Array of valid exit objects.
 */
export function getAvailableExits(locationEntityOrId, entityManager, logger) {
  const exitsData = _getExitsComponentData(
    locationEntityOrId,
    entityManager,
    logger
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
      typeof exit.direction === 'string' &&
      exit.direction.trim() !== '' &&
      typeof exit.targetLocationId === 'string' &&
      exit.targetLocationId.trim() !== ''
    ) {
      validExits.push(exit);
    } else {
      logger?.warn(
        `getAvailableExits: Invalid exit object found in location '${locIdForLog}': ${JSON.stringify(
          exit
        )}. Skipping.`
      );
    }
  }
  return validExits;
}

export { _getExitsComponentData };
