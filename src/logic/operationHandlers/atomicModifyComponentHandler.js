// src/logic/operationHandlers/atomicModifyComponentHandler.js

// -----------------------------------------------------------------------------
//  ATOMIC_MODIFY_COMPONENT Handler — Atomic check-and-set operation for components
//  Combines query and modify into a single atomic operation to prevent race conditions
// -----------------------------------------------------------------------------

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

import ComponentOperationHandler from './componentOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { deepClone } from '../../utils/cloneUtils.js';
import { setByPath } from '../../utils/objectPathUtils.js';
import { writeContextVariable } from '../../utils/contextVariableUtils.js';

/**
 * @typedef {object} EntityRefObject
 * @property {string} entityId
 */

/**
 * @typedef {object} AtomicModifyComponentOperationParams
 * @property {'actor'|'target'|string|EntityRefObject} entity_ref - Target entity reference
 * @property {string}  component_type - Component type to modify
 * @property {string}  field - Dot-separated path to the field
 * @property {*}       expected_value - Expected current value for atomic check
 * @property {*}       new_value - Value to set if check passes
 * @property {string}  result_variable - Context variable to store success/failure result
 */

/**
 * @implements {OperationHandler}
 */
class AtomicModifyComponentHandler extends ComponentOperationHandler {
  /** @type {EntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;

  /**
   * @param {EntityOperationDeps} deps - Dependencies object
   */
  constructor({ entityManager, logger, safeEventDispatcher }) {
    super('AtomicModifyComponentHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'addComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Executes an ATOMIC_MODIFY_COMPONENT operation.
   * Atomically checks if a field equals the expected value and modifies it if so.
   *
   * @param {AtomicModifyComponentOperationParams|null|undefined} params
   * @param {ExecutionContext} executionContext
   */
  async execute(params, executionContext) {
    const logger = this.getLogger(executionContext);

    // ── validate base params ───────────────────────────────────────
    if (!assertParamsObject(params, logger, 'ATOMIC_MODIFY_COMPONENT')) {
      return;
    }
    
    const { 
      entity_ref, 
      component_type, 
      field, 
      expected_value, 
      new_value, 
      result_variable 
    } = params;

    // ── validate entity and component type together ─────────────────
    const validated = this.validateEntityAndType(
      entity_ref,
      component_type,
      logger,
      'ATOMIC_MODIFY_COMPONENT',
      executionContext
    );
    if (!validated) {
      this.#storeResult(false, result_variable, executionContext, logger);
      return;
    }
    const { entityId, type: componentType } = validated;

    // ── validate field parameter ───────────────────────────────────
    if (
      field === null ||
      field === undefined ||
      typeof field !== 'string' ||
      !field.trim()
    ) {
      logger.warn('ATOMIC_MODIFY_COMPONENT: "field" must be a non-empty string.');
      this.#storeResult(false, result_variable, executionContext, logger);
      return;
    }

    // ── validate result_variable parameter ──────────────────────────
    if (
      result_variable === null ||
      result_variable === undefined ||
      typeof result_variable !== 'string' ||
      !result_variable.trim()
    ) {
      logger.warn('ATOMIC_MODIFY_COMPONENT: "result_variable" must be a non-empty string.');
      return;
    }

    // ── fetch & clone component data ───────────────────────────────
    const current = this.#entityManager.getComponentData(entityId, componentType);

    if (current === undefined) {
      logger.warn(
        `ATOMIC_MODIFY_COMPONENT: Component "${componentType}" not found on entity "${entityId}".`
      );
      this.#storeResult(false, result_variable, executionContext, logger);
      return;
    }
    if (typeof current !== 'object' || current === null) {
      logger.warn(
        `ATOMIC_MODIFY_COMPONENT: Component "${componentType}" on entity "${entityId}" is not an object.`
      );
      this.#storeResult(false, result_variable, executionContext, logger);
      return;
    }

    // ── atomic check and modify ────────────────────────────────────
    const currentValue = this.#getByPath(current, field.trim());
    const expectedValueMatches = this.#deepEqual(currentValue, expected_value);

    if (!expectedValueMatches) {
      logger.debug(
        `ATOMIC_MODIFY_COMPONENT: Atomic check failed for "${componentType}.${field}" on entity "${entityId}". Expected: ${JSON.stringify(expected_value)}, Found: ${JSON.stringify(currentValue)}`
      );
      this.#storeResult(false, result_variable, executionContext, logger);
      return;
    }

    // ── perform atomic modification ─────────────────────────────────
    const updatedComponent = deepClone(current);
    const success = setByPath(updatedComponent, field.trim(), new_value);
    
    if (!success) {
      logger.warn(
        `ATOMIC_MODIFY_COMPONENT: Failed to set path "${field}" on component "${componentType}".`
      );
      this.#storeResult(false, result_variable, executionContext, logger);
      return;
    }

    // ── commit via EntityManager ───────────────────────────────────
    try {
      const addSuccess = await this.#entityManager.addComponent(
        entityId,
        componentType,
        updatedComponent
      );
      
      if (addSuccess) {
        logger.debug(
          `ATOMIC_MODIFY_COMPONENT: Successfully modified "${componentType}.${field}" on "${entityId}" from ${JSON.stringify(expected_value)} to ${JSON.stringify(new_value)}`
        );
        this.#storeResult(true, result_variable, executionContext, logger);
      } else {
        logger.warn(
          `ATOMIC_MODIFY_COMPONENT: EntityManager.addComponent reported an unexpected failure for component "${componentType}" on entity "${entityId}".`
        );
        this.#storeResult(false, result_variable, executionContext, logger);
      }
    } catch (e) {
      safeDispatchError(
        this.#dispatcher,
        'ATOMIC_MODIFY_COMPONENT: Error during EntityManager.addComponent.',
        {
          error: e.message,
          stack: e.stack,
          entityId,
          componentType,
          field,
          expected_value,
          new_value,
        }
      );
      this.#storeResult(false, result_variable, executionContext, logger);
    }
  }

  /**
   * Store the operation result in the execution context.
   *
   * @param {boolean} success - Whether the operation succeeded
   * @param {string} resultVariable - Context variable name to store result
   * @param {ExecutionContext} executionContext - Current execution context
   * @param {ILogger} logger - Logger instance
   * @private
   */
  #storeResult(success, resultVariable, executionContext, logger) {
    if (!resultVariable || typeof resultVariable !== 'string') {
      return;
    }

    const result = writeContextVariable(
      resultVariable.trim(),
      success,
      executionContext,
      this.#dispatcher,
      logger
    );

    if (!result.success) {
      logger.warn(
        `ATOMIC_MODIFY_COMPONENT: Failed to store result in context variable "${resultVariable}"`
      );
    } else {
      logger.debug(
        `ATOMIC_MODIFY_COMPONENT: Stored result ${success} in context variable "${resultVariable}"`
      );
    }
  }

  /**
   * Deep equality comparison for atomic check.
   *
   * @param {*} a - First value
   * @param {*} b - Second value  
   * @returns {boolean} Whether values are deeply equal
   * @private
   */
  #deepEqual(a, b) {
    if (a === b) return true;
    
    if (a === null || b === null) return a === b;
    if (a === undefined || b === undefined) return a === b;
    
    if (typeof a !== typeof b) return false;
    
    if (typeof a !== 'object') return a === b;
    
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.#deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.#deepEqual(a[key], b[key])) return false;
    }
    
    return true;
  }

  /**
   * Get a value from an object using a dot-separated path.
   *
   * @param {Record<string, any>} obj - Object to query
   * @param {string} path - Dot-separated path (e.g., 'a.b.c')
   * @returns {*} The value at the path, or undefined if not found
   * @private
   */
  #getByPath(obj, path) {
    const parts = path.split('.').filter(Boolean);
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }
}

export default AtomicModifyComponentHandler;