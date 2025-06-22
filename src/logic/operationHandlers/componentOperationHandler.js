// src/logic/operationHandlers/componentOperationHandler.js

/**
 * @file Provides a base class for handlers that operate on entity components.
 * It extends BaseOperationHandler with helpers for resolving entity references
 * and validating component types.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */

import BaseOperationHandler from './baseOperationHandler.js';
import { resolveEntityId } from '../../utils/entityRefUtils.js';

/**
 * @typedef {object} EntityRefObject
 * @property {string} entityId
 */

/**
 * @class ComponentOperationHandler
 * @description Base class for handlers that operate on entity components.
 * It adds utility methods for common validation tasks.
 */
class ComponentOperationHandler extends BaseOperationHandler {
  /**
   * Resolve an entity reference to an ID string.
   *
   * @param {'actor'|'target'|string|EntityRefObject} entityRef
   * @param {ExecutionContext} executionContext
   * @returns {string|null} The resolved ID or null if invalid.
   */
  resolveEntity(entityRef, executionContext) {
    if (!entityRef) return null;
    return resolveEntityId(entityRef, executionContext);
  }

  /**
   * Validate a component type string.
   *
   * @param {*} type - Raw component type.
   * @returns {string|null} Trimmed component type or null if invalid.
   */
  validateComponentType(type) {
    if (typeof type !== 'string') return null;
    const trimmed = type.trim();
    return trimmed ? trimmed : null;
  }
}

export default ComponentOperationHandler;
