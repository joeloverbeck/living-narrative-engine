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

  /**
   * Validate the provided entity reference and resolve it to an ID.
   *
   * @param {'actor'|'target'|string|EntityRefObject} entityRef - Reference to resolve.
   * @param {ILogger} log - Logger used for warnings.
   * @param {string} [opName] - Optional operation name prefix for logging.
   * @param {ExecutionContext} executionContext - Execution context for resolution.
   * @returns {string|null} The resolved ID or null when invalid.
   */
  validateEntityRef(entityRef, log, opName, executionContext) {
    const prefix = opName ? `${opName}: ` : '';
    if (!entityRef) {
      log.warn(`${prefix}"entity_ref" parameter is required.`);
      return null;
    }
    const resolved = this.resolveEntity(entityRef, executionContext);
    if (!resolved) {
      log.warn(`${prefix}Could not resolve entity id from entity_ref.`, {
        entity_ref: entityRef,
      });
      return null;
    }
    return resolved;
  }

  /**
   * Require a valid component type string.
   *
   * @param {*} type - Raw component type.
   * @param {ILogger} log - Logger used for warnings.
   * @param {string} [opName] - Optional operation name prefix for logging.
   * @returns {string|null} Trimmed component type or null if invalid.
   */
  requireComponentType(type, log, opName) {
    const prefix = opName ? `${opName}: ` : '';
    const trimmed = this.validateComponentType(type);
    if (!trimmed) {
      log.warn(
        `${prefix}Invalid or missing "component_type" parameter (must be non-empty string).`
      );
      return null;
    }
    return trimmed;
  }
}

export default ComponentOperationHandler;
