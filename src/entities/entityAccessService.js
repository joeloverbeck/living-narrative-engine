/**
 * @file EntityAccessService
 * @description Utility service for resolving entities and manipulating components.
 */

import { getPrefixedLogger, ensureValidLogger } from '../utils/loggerUtils.js';
import { isValidEntity } from '../utils/entityValidationUtils.js';
import { isNonBlankString } from '../utils/textUtils.js';
import { safeExecute } from '../utils/safeExecutionUtils.js';
import {
  readComponent,
  writeComponent,
} from '../utils/componentAccessUtils.js';

/** @typedef {import('./entity.js').default} Entity */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Resolve an entity instance from either an entity object or its ID.
 *
 * @param {Entity | string} entityOrId - Entity instance or ID.
 * @param {IEntityManager} [entityManager] - Manager used when resolving by ID.
 * @param {ILogger} [logger] - Optional logger for diagnostics.
 * @returns {Entity | null} The resolved entity instance or `null` if not found.
 */
export function resolveEntity(entityOrId, entityManager, logger) {
  const log = getPrefixedLogger(logger, '[EntityAccessService] ');

  if (isValidEntity(entityOrId)) {
    return entityOrId;
  }

  if (typeof entityOrId === 'string') {
    if (
      !entityManager ||
      typeof entityManager.getEntityInstance !== 'function'
    ) {
      log.warn('resolveEntity: invalid entityManager provided for ID lookup.');
      return null;
    }
    const resolved = entityManager.getEntityInstance(entityOrId);
    if (isValidEntity(resolved)) {
      return resolved;
    }
    log.debug(
      `resolveEntity: could not resolve entity for ID '${entityOrId}'.`
    );
    return null;
  }

  if (entityOrId !== null && entityOrId !== undefined) {
    log.debug('resolveEntity: provided value is not a valid entity.');
  }

  return null;
}

/**
 * Retrieve component data from an entity or entity ID.
 *
 * @param {Entity | string | object} entityOrId - Entity instance, ID, or pseudo-entity.
 * @param {string} componentId - Component identifier to retrieve.
 * @param {object} [options]
 * @param {IEntityManager} [options.entityManager] - Manager used when resolving by ID.
 * @param {ILogger} [options.logger] - Logger for diagnostics.
 * @returns {any | null} The component data or `null` when not found.
 */
export function getComponent(
  entityOrId,
  componentId,
  { entityManager, logger } = {}
) {
  const log = getPrefixedLogger(logger, '[EntityAccessService] ');

  if (!isNonBlankString(componentId)) {
    log.debug('getComponent: invalid componentId.');
    return null;
  }

  const entity = resolveEntity(entityOrId, entityManager, logger);
  if (entity) {
    const { success, result } = safeExecute(
      () => entity.getComponentData(componentId),
      log,
      'EntityAccessService.getComponent'
    );
    if (success && result !== undefined) {
      return result ?? null;
    }
    // fall back to manager if provided
    if (
      typeof entityOrId === 'string' &&
      entityManager &&
      typeof entityManager.getComponentData === 'function'
    ) {
      const { success: mgrSuccess, result: mgrResult } = safeExecute(
        () => entityManager.getComponentData(entityOrId, componentId),
        log,
        'EntityAccessService.getComponent'
      );
      return mgrSuccess ? (mgrResult ?? null) : null;
    }
    return null;
  }
  if (
    typeof entityOrId === 'string' &&
    entityManager &&
    typeof entityManager.getComponentData === 'function'
  ) {
    const { success, result } = safeExecute(
      () => entityManager.getComponentData(entityOrId, componentId),
      log,
      'EntityAccessService.getComponent'
    );
    if (success) {
      return result ?? null;
    }
  }

  // Fallback for plain objects used as pseudo-entities
  return readComponent(entityOrId, componentId);
}

/**
 * Write component data to an entity or entity ID.
 *
 * @param {Entity | string | object} entityOrId - Entity instance, ID, or pseudo-entity.
 * @param {string} componentId - Component identifier to write.
 * @param {any} data - Data to store.
 * @param {object} [options]
 * @param {IEntityManager} [options.entityManager] - Manager used when resolving by ID.
 * @param {ILogger} [options.logger] - Logger for diagnostics.
 * @returns {boolean} `true` if the component was written, otherwise `false`.
 */
export function setComponent(
  entityOrId,
  componentId,
  data,
  { entityManager, logger } = {}
) {
  const log = getPrefixedLogger(logger, '[EntityAccessService] ');

  if (!isNonBlankString(componentId)) {
    log.debug('setComponent: invalid componentId.');
    return false;
  }

  const entity = resolveEntity(entityOrId, entityManager, logger);
  if (entity) {
    if (typeof entity.addComponent === 'function') {
      entity.addComponent(componentId, data);
      return true;
    }
    if (entity.components && typeof entity.components === 'object') {
      entity.components[componentId] = data;
      return true;
    }
    log.debug(
      'setComponent: target entity does not support component updates.'
    );
    return false;
  }
  if (
    typeof entityOrId === 'string' &&
    entityManager &&
    typeof entityManager.getEntityInstance === 'function' &&
    typeof entityManager.getComponentData === 'function'
  ) {
    const target = entityManager.getEntityInstance(entityOrId);
    if (target) {
      if (typeof target.addComponent === 'function') {
        target.addComponent(componentId, data);
        return true;
      }
      if (target.components && typeof target.components === 'object') {
        target.components[componentId] = data;
        return true;
      }
    }
  }

  // Fallback for plain objects used as pseudo-entities
  return writeComponent(entityOrId, componentId, data);
}

export default {
  resolveEntity,
  getComponent,
  setComponent,
};
