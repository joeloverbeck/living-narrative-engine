// src/utils/componentAccessUtils.js

/**
 * @module componentAccessUtils
 * @description Helper utilities for safely accessing component data on entities.
 */

import { getPrefixedLogger } from './loggerUtils.js';
import {
  isValidEntityManager,
  isValidEntity,
} from './entityValidationUtils.js';

/**
 * Checks that the provided identifier is a non-blank string.
 *
 * @param {*} id - Value to validate.
 * @returns {boolean} True when `id` is a non-empty string.
 * @private
 */
function _isValidId(id) {
  return typeof id === 'string' && id.trim() !== '';
}

/**
 * Checks that the manager or entity exposes a `getComponentData` method.
 *
 * @param {*} mgr - Value to validate.
 * @returns {boolean} True if `mgr.getComponentData` is a function.
 * @private
 */
function _isValidManager(mgr) {
  return !!mgr && typeof mgr.getComponentData === 'function';
}

/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * Safely retrieves component data from an entity.
 *
 * @param {Entity | any} entity - The entity instance to query. Must expose a
 *   `getComponentData` method.
 * @param {string} componentId - The component type ID to retrieve.
 * @returns {any | null} The component data if available, otherwise `null`.
 */
export function getComponentFromEntity(entity, componentId) {
  if (!_isValidId(componentId) || !_isValidManager(entity)) {
    return null;
  }

  try {
    const data = entity.getComponentData(componentId);
    return data ?? null;
  } catch {
    return null;
  }
}

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * Safely retrieves component data for an entity via an EntityManager.
 *
 * The function validates the entity ID, component ID and entity manager
 * before attempting to access the data. Any errors thrown during the
 * lookup are caught and `null` is returned.
 *
 * @param {string} entityId - The ID of the entity instance to query.
 * @param {string} componentId - The component type ID to retrieve.
 * @param {IEntityManager} entityManager - Manager used to access component data.
 * @returns {any | null} The component data if available, otherwise `null`.
 */
export function getComponentFromManager(entityId, componentId, entityManager) {
  if (!_isValidId(entityId) || !_isValidId(componentId)) {
    return null;
  }

  if (!_isValidManager(entityManager)) {
    return null;
  }

  try {
    const data = entityManager.getComponentData(entityId, componentId);
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves an entity instance when given either an instance or its ID.
 *
 * When a string ID is provided, the entity manager is validated using
 * {@link isValidEntityManager} before attempting retrieval via
 * `getEntityInstance`. The resulting entity is validated with
 * {@link isValidEntity}. Any failures are logged with the provided logger.
 *
 * @param {Entity | string} entityOrId - Entity instance or ID to resolve.
 * @param {IEntityManager} [entityManager] - Manager used when `entityOrId` is a string.
 * @param {import('../interfaces/ILogger.js').ILogger} [logger] - Optional logger for diagnostics.
 * @returns {Entity | null} The resolved entity instance or `null` when not found.
 */
export function resolveEntityInstance(entityOrId, entityManager, logger) {
  const log = getPrefixedLogger(logger, '[componentAccessUtils] ');

  if (isValidEntity(entityOrId)) {
    return entityOrId;
  }

  if (typeof entityOrId === 'string') {
    if (!isValidEntityManager(entityManager)) {
      log.warn(
        'resolveEntityInstance: invalid entityManager provided for ID lookup.'
      );
      return null;
    }

    const resolved = entityManager.getEntityInstance(entityOrId);
    if (isValidEntity(resolved)) {
      return resolved;
    }

    log.debug(
      `resolveEntityInstance: could not resolve entity for ID '${entityOrId}'.`
    );
    return null;
  }

  if (entityOrId !== null && entityOrId !== undefined) {
    log.debug('resolveEntityInstance: provided value is not a valid entity.');
  }

  return null;
}

// --- FILE END ---
