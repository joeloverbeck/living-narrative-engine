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
import { isNonBlankString } from './textUtils.js';
import { safeCall } from './safeExecutionUtils.js';

/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * Safely retrieves component data from an entity.
 *
 * @param {Entity | any} entity - The entity instance to query. Must expose a
 *   `getComponentData` method.
 * @param {string} componentId - The component type ID to retrieve.
 * @param {import('../interfaces/ILogger.js').ILogger} [logger] - Optional logger
 *   for debug messages.
 * @returns {any | null} The component data if available, otherwise `null`.
 */
export function getComponentFromEntity(entity, componentId, logger) {
  const moduleLogger = getPrefixedLogger(logger, '[componentAccessUtils] ');

  if (!isNonBlankString(componentId) || !isValidEntity(entity)) {
    moduleLogger.debug(
      'getComponentFromEntity: invalid entity or componentId.'
    );
    return null;
  }

  const { success, result, error } = safeCall(() =>
    entity.getComponentData(componentId)
  );
  if (success) {
    return result ?? null;
  }
  moduleLogger.debug(
    'getComponentFromEntity: error retrieving component data.',
    error
  );
  return null;
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
 * @param logger
 * @returns {any | null} The component data if available, otherwise `null`.
 */
export function getComponentFromManager(
  entityId,
  componentId,
  entityManager,
  logger
) {
  const moduleLogger = getPrefixedLogger(logger, '[componentAccessUtils] ');

  if (!isNonBlankString(entityId) || !isNonBlankString(componentId)) {
    moduleLogger.debug(
      'getComponentFromManager: invalid entityId or componentId.'
    );
    return null;
  }

  if (!isValidEntityManager(entityManager)) {
    moduleLogger.debug(
      'getComponentFromManager: invalid entityManager provided.'
    );
    return null;
  }

  const { success, result, error } = safeCall(() =>
    entityManager.getComponentData(entityId, componentId)
  );
  if (success) {
    return result ?? null;
  }
  moduleLogger.debug(
    `getComponentFromManager: error retrieving '${componentId}' for entity '${entityId}'.`,
    error
  );
  return null;
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
  const moduleLogger = getPrefixedLogger(logger, '[componentAccessUtils] ');

  if (isValidEntity(entityOrId)) {
    return entityOrId;
  }

  if (typeof entityOrId === 'string') {
    if (!isValidEntityManager(entityManager)) {
      moduleLogger.warn(
        'resolveEntityInstance: invalid entityManager provided for ID lookup.'
      );
      return null;
    }

    const resolved = entityManager.getEntityInstance(entityOrId);
    if (isValidEntity(resolved)) {
      return resolved;
    }

    moduleLogger.debug(
      `resolveEntityInstance: could not resolve entity for ID '${entityOrId}'.`
    );
    return null;
  }

  if (entityOrId !== null && entityOrId !== undefined) {
    moduleLogger.debug(
      'resolveEntityInstance: provided value is not a valid entity.'
    );
  }

  return null;
}

/**
 * @description Retrieves component data from an entity. Works with full
 * Entity instances exposing `getComponentData` as well as plain objects that
 * store data under a `components` property.
 * @param {object} entity - Target entity instance or pseudo-entity.
 * @param {string} componentId - ID of the component to fetch.
 * @returns {any | null} The component data if found, otherwise `null`.
 */
export function readComponent(entity, componentId) {
  if (!entity) {
    return null;
  }
  if (typeof entity.getComponentData === 'function') {
    return entity.getComponentData(componentId);
  }
  return entity.components?.[componentId] ?? null;
}

/**
 * @description Writes component data back to an entity. Uses `addComponent`
 * when available, falling back to direct assignment on a `components` bag.
 * @param {object} entity - Target entity instance or pseudo-entity.
 * @param {string} componentId - ID of the component to write.
 * @param {any} data - Data to store.
 * @returns {boolean} `true` if the data was stored, otherwise `false`.
 */
export function writeComponent(entity, componentId, data) {
  if (!entity) {
    return false;
  }
  if (typeof entity.addComponent === 'function') {
    entity.addComponent(componentId, data);
    return true;
  }
  if (entity.components && typeof entity.components === 'object') {
    entity.components[componentId] = data;
    return true;
  }
  return false;
}

// --- FILE END ---
