// src/entities/utils/entityFetchHelpers.js

import { InvalidEntityIdError } from '../errors/invalidEntityIdError.js';

/**
 * @module entityFetchHelpers
 * @description Utility helpers for retrieving entities with consistent
 * validation and error handling.
 */

/**
 * @description Fetch an entity instance from the provided manager.
 * @param {import('../interfaces/IEntityManager.js').IEntityManager} entityManager - The entity manager instance.
 * @param {import('../interfaces/CommonTypes.js').NamespacedId | string} entityId - Identifier of the entity to fetch.
 * @returns {import('../entity.js').default} The fetched entity instance.
 * @throws {InvalidEntityIdError} When entityId is falsy.
 */
export function fetchEntity(entityManager, entityId) {
  if (!entityId) {
    throw new InvalidEntityIdError(entityId);
  }
  return entityManager.getEntityInstance(entityId);
}

/**
 * @description Execute a callback with a fetched entity if available.
 * @param {import('../interfaces/IEntityManager.js').IEntityManager} entityManager - The entity manager instance.
 * @param {import('../interfaces/CommonTypes.js').NamespacedId | string} entityId - Identifier of the entity.
 * @param {*} fallback - Value returned when the entity is missing or invalid.
 * @param {(entity: import('../entity.js').default) => *} callback - Callback executed with the entity.
 * @param {import('../interfaces/ILogger.js').ILogger} logger - Logger for diagnostics.
 * @param {string} logPrefix - Prefix to prepend to log messages.
 * @param {string} [notFoundMsg] - Message logged when the entity cannot be found.
 * @returns {*} The callback result or the fallback value.
 */
export function withEntity(
  entityManager,
  entityId,
  fallback,
  callback,
  logger,
  logPrefix,
  notFoundMsg
) {
  let entity;
  try {
    entity = fetchEntity(entityManager, entityId);
  } catch (error) {
    if (error instanceof InvalidEntityIdError) {
      logger.warn(
        `${logPrefix} fetchEntity called with null or empty entityId.`
      );
      return fallback;
    }
    throw error;
  }

  if (!entity) {
    if (notFoundMsg) {
      logger.debug(`${logPrefix} ${notFoundMsg}`);
    }
    return fallback;
  }

  return callback(entity);
}

export default {
  fetchEntity,
  withEntity,
};
