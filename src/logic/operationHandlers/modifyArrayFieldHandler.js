/**
 * @file This operation handler modifies the contents of an array field in a specified component.
 * @see src/logic/operationHandlers/modifyArrayFieldHandler.js
 */

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('./modifyComponentHandler.js').EntityRefObject} EntityRefObject */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { resolvePath } from '../../utils/objectUtils.js';
import { cloneDeep } from 'lodash';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';
import ComponentOperationHandler from './componentOperationHandler.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';
import {
  advancedArrayModify,
  ARRAY_MODIFICATION_MODES,
} from '../utils/arrayModifyUtils.js';
import { setByPath } from '../utils/objectPathUtils.js';

/**
 * @class ModifyArrayFieldHandler
 * @description Handles the 'MODIFY_ARRAY_FIELD' operation. It provides safe, atomic
 * operations on an array field inside a component using a clone-and-replace strategy.
 */
class ModifyArrayFieldHandler extends ComponentOperationHandler {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * Fetch the component and target array to modify.
   *
   * @param {string} entityId - The entity identifier.
   * @param {string} componentType - Component type name.
   * @param {string} field - Dot path to the array field.
   * @param {ILogger} logger - Logger for warnings.
   * @returns {{data: object, array: Array}|null} The cloned data and target array.
   * @private
   */
  #fetchTargetArray(entityId, componentType, field, logger) {
    const originalComponentData = this.#entityManager.getComponentData(
      entityId,
      componentType
    );
    if (!originalComponentData) {
      logger.warn(
        `MODIFY_ARRAY_FIELD: Component '${componentType}' not found on entity '${entityId}'.`
      );
      return null;
    }
    const clonedComponentData = cloneDeep(originalComponentData);
    const targetArray = resolvePath(clonedComponentData, field);
    if (!Array.isArray(targetArray)) {
      logger.warn(
        `MODIFY_ARRAY_FIELD: Field path '${field}' in component '${componentType}' on entity '${entityId}' does not point to an array.`
      );
      return null;
    }
    return { data: clonedComponentData, array: targetArray };
  }

  /**
   * Apply the requested modification to the array.
   *
   * @param {'push'|'push_unique'|'pop'|'remove_by_value'} mode - Operation type.
   * @param {Array} targetArray - The array to modify.
   * @param {*} value - Value used for push-like modes.
   * @param {string} field - Dot path to the array field.
   * @param {string} entityId - The entity identifier.
   * @param {ILogger} logger - Logger instance.
   * @returns {{nextArray: Array, result: *, modified: boolean}|null} Modification outcome.
   * Returns a new array via `nextArray`; the original `targetArray` is never
   * mutated.
   * @private
   */
  #applyModification(mode, targetArray, value, field, entityId, logger) {
    logger.debug(
      `MODIFY_ARRAY_FIELD: Performing '${mode}' on field '${field}' for entity '${entityId}'.`
    );

    if (!ARRAY_MODIFICATION_MODES.includes(mode)) {
      logger.warn(`MODIFY_ARRAY_FIELD: Unknown mode '${mode}'.`);
      return null;
    }

    if (
      value === undefined &&
      (mode === 'push' || mode === 'push_unique' || mode === 'remove_by_value')
    ) {
      logger.warn(
        `MODIFY_ARRAY_FIELD: '${mode}' mode requires a 'value' parameter.`
      );
      return null;
    }

    if (mode === 'pop' && targetArray.length === 0) {
      logger.debug(
        `MODIFY_ARRAY_FIELD: Attempted to 'pop' from an empty array on field '${field}'.`
      );
    }

    const { nextArray, result, modified } = advancedArrayModify(
      mode,
      targetArray,
      value,
      logger
    );

    if (mode === 'push_unique' && !modified) {
      logger.debug(
        `MODIFY_ARRAY_FIELD: Value for 'push_unique' already exists in array on field '${field}'.`
      );
    }

    if (mode === 'remove_by_value' && !modified) {
      logger.debug(
        `MODIFY_ARRAY_FIELD: Value for 'remove_by_value' not found in array on field '${field}'.`
      );
    }

    return {
      nextArray,
      result,
      modified,
    };
  }

  /**
   * Commit the modified component data back to the entity manager.
   *
   * @param {string} entityId - The entity identifier.
   * @param {string} componentType - Component type name.
   * @param {object} data - Modified component data.
   * @param {ILogger} logger - Logger instance.
   * @returns {boolean} True if commit succeeded.
   * @private
   */
  #commitChanges(entityId, componentType, data, logger) {
    try {
      this.#entityManager.addComponent(entityId, componentType, data);
      logger.debug(
        `MODIFY_ARRAY_FIELD: Successfully committed changes to component '${componentType}' on entity '${entityId}'.`
      );
      return true;
    } catch (error) {
      safeDispatchError(
        this.#dispatcher,
        'MODIFY_ARRAY_FIELD: Failed to commit changes via addComponent.',
        {
          error: error.message,
          entityId,
          componentType: componentType,
        }
      );
      return false;
    }
  }

  /**
   * Create a new ModifyArrayFieldHandler.
   *
   * @param {object} deps - The handler dependencies.
   * @param {IEntityManager} deps.entityManager - The entity management service.
   * @param {ILogger} deps.logger - The logging service.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Dispatcher for error events.
   */
  constructor({ entityManager, logger, safeEventDispatcher }) {
    super('ModifyArrayFieldHandler', {
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
   * Executes the array modification operation.
   *
   * @param {object} params - The parameters for the operation.
   * @param {string|object} params.entity_ref - Reference to the target entity.
   * @param {string} params.component_type - The namespaced ID of the component.
   * @param {string} params.field - Dot-separated path to the array field.
   * @param {'push'|'push_unique'|'pop'|'remove_by_value'} params.mode - The operation to perform.
   * @param {*} [params.value] - The value for 'push', 'push_unique', or 'remove_by_value'.
   * @param {string} [params.result_variable] - Optional variable to store the result.
   * @param {ExecutionContext} executionContext - The current execution context.
   */
  execute(params, executionContext) {
    const logger = this.getLogger(executionContext);
    if (!assertParamsObject(params, logger, 'MODIFY_ARRAY_FIELD')) {
      return;
    }
    const { entity_ref, component_type, field, mode, result_variable, value } =
      params;
    const validated = this.validateEntityAndType(
      entity_ref,
      component_type,
      logger,
      'MODIFY_ARRAY_FIELD',
      executionContext
    );
    if (!validated) {
      return;
    }
    const { entityId, type: componentType } = validated;
    if (!field || !mode) {
      logger.warn(
        `MODIFY_ARRAY_FIELD: Missing required parameters (component_type, field, or mode) for entity ${entityId}.`
      );
      return;
    }

    // 3. Fetch target array
    const fetched = this.#fetchTargetArray(
      entityId,
      componentType,
      field,
      logger
    );
    if (!fetched) {
      return;
    }
    const { data: clonedComponentData, array: targetArray } = fetched;

    // 4. Modify
    const modification = this.#applyModification(
      mode,
      targetArray,
      value,
      field,
      entityId,
      logger
    );
    if (!modification) {
      return;
    }
    setByPath(clonedComponentData, field, modification.nextArray);

    // 5. Commit
    if (
      !this.#commitChanges(entityId, componentType, clonedComponentData, logger)
    ) {
      return;
    }

    // 6. Store Result if requested
    if (result_variable) {
      if (
        !ensureEvaluationContext(executionContext, this.#dispatcher, logger)
      ) {
        return;
      }
      const res = tryWriteContextVariable(
        result_variable,
        modification.result,
        executionContext,
        this.#dispatcher,
        logger
      );
      if (res.success) {
        logger.debug(
          `MODIFY_ARRAY_FIELD: Stored result in context variable '${result_variable}'.`
        );
      }
    }
  }
}

export default ModifyArrayFieldHandler;
