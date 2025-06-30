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
import {
  validateEntityRef as utilValidateEntityRef,
  validateComponentType as utilValidateComponentType,
} from '../../utils/operationValidationUtils.js';

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
   * @param {ILogger} [log] - Logger used for warnings.
   * @param {string} [operationName] - Optional operation name prefix for logging.
   * @returns {string|null} Trimmed component type or null if invalid.
   */
  validateComponentType(type, log = this.logger, operationName) {
    return utilValidateComponentType(type, log, operationName);
  }

  /**
   * Validate the provided entity reference and resolve it to an ID.
   *
   * @param {'actor'|'target'|string|EntityRefObject} entityRef - Reference to resolve.
   * @param {ILogger} log - Logger used for warnings.
   * @param {string} [operationName] - Optional operation name prefix for logging.
   * @param {ExecutionContext} executionContext - Execution context for resolution.
   * @returns {string|null} The resolved ID or null when invalid.
   */
  validateEntityRef(entityRef, log, operationName, executionContext) {
    return utilValidateEntityRef(
      entityRef,
      executionContext,
      log,
      undefined,
      operationName
    );
  }

  /**
   * Require a valid component type string.
   *
   * @param {*} type - Raw component type.
   * @param {ILogger} log - Logger used for warnings.
   * @param {string} [operationName] - Optional operation name prefix for logging.
   * @returns {string|null} Trimmed component type or null if invalid.
   */
  requireComponentType(type, log, operationName) {
    return utilValidateComponentType(type, log, operationName);
  }

  /**
   * Validate entity reference and component type together.
   *
   * @param {'actor'|'target'|string|EntityRefObject} entityRef
   * @param {*} componentType
   * @param {ILogger} logger
   * @param {string} [operationName]
   * @param {ExecutionContext} ctx
   * @returns {{ entityId: string, type: string } | null}
   */
  validateEntityAndType(entityRef, componentType, logger, operationName, ctx) {
    const entityId = this.validateEntityRef(
      entityRef,
      logger,
      operationName,
      ctx
    );
    if (!entityId) return null;
    const type = this.requireComponentType(
      componentType,
      logger,
      operationName
    );
    if (!type) return null;
    return { entityId, type };
  }
}

export default ComponentOperationHandler;
