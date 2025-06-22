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
import { applyArrayModification } from '../utils/arrayModifyUtils.js';
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
   * @description Fetch the component and target array to modify.
   * @param {string} entityId
   * @param {string} compType
   * @param {string} field
   * @param {ILogger} log
   * @returns {{data: object, array: Array}|null}
   * @private
   */
  #fetchTargetArray(entityId, compType, field, log) {
    const originalComponentData = this.#entityManager.getComponentData(
      entityId,
      compType
    );
    if (!originalComponentData) {
      log.warn(
        `MODIFY_ARRAY_FIELD: Component '${compType}' not found on entity '${entityId}'.`
      );
      return null;
    }
    const clonedComponentData = cloneDeep(originalComponentData);
    const targetArray = resolvePath(clonedComponentData, field);
    if (!Array.isArray(targetArray)) {
      log.warn(
        `MODIFY_ARRAY_FIELD: Field path '${field}' in component '${compType}' on entity '${entityId}' does not point to an array.`
      );
      return null;
    }
    return { data: clonedComponentData, array: targetArray };
  }

  /**
   * @description Apply the requested modification to the array.
   * @param {'push'|'push_unique'|'pop'|'remove_by_value'} mode
   * @param {Array} targetArray
   * @param {*} value
   * @param {string} field
   * @param {string} entityId
   * @param {ILogger} log
   * @returns {{array: Array, result: *}|null} New array and result value
   * @private
   */
  #applyModification(mode, targetArray, value, field, entityId, log) {
    log.debug(
      `MODIFY_ARRAY_FIELD: Performing '${mode}' on field '${field}' for entity '${entityId}'.`
    );

    const validModes = ['push', 'push_unique', 'pop', 'remove_by_value'];
    if (!validModes.includes(mode)) {
      log.warn(`MODIFY_ARRAY_FIELD: Unknown mode '${mode}'.`);
      return null;
    }

    if (
      value === undefined &&
      (mode === 'push' || mode === 'push_unique' || mode === 'remove_by_value')
    ) {
      log.warn(
        `MODIFY_ARRAY_FIELD: '${mode}' mode requires a 'value' parameter.`
      );
      return null;
    }

    let poppedItem;
    let newArray = targetArray;

    switch (mode) {
      case 'push':
        newArray = applyArrayModification(mode, targetArray, value, log);
        break;
      case 'push_unique': {
        let exists = false;
        if (typeof value !== 'object' || value === null) {
          exists = targetArray.includes(value);
        } else {
          const valueAsJson = JSON.stringify(value);
          exists = targetArray.some(
            (item) => JSON.stringify(item) === valueAsJson
          );
        }
        if (exists) {
          log.debug(
            `MODIFY_ARRAY_FIELD: Value for 'push_unique' already exists in array on field '${field}'.`
          );
        } else {
          newArray = applyArrayModification(mode, targetArray, value, log);
        }
        break;
      }
      case 'pop':
        if (targetArray.length === 0) {
          log.debug(
            `MODIFY_ARRAY_FIELD: Attempted to 'pop' from an empty array on field '${field}'.`
          );
          poppedItem = undefined;
        } else {
          poppedItem = targetArray[targetArray.length - 1];
          newArray = applyArrayModification('pop', targetArray, value, log);
        }
        break;
      case 'remove_by_value': {
        let index;
        if (typeof value !== 'object' || value === null) {
          index = targetArray.indexOf(value);
        } else {
          const valueAsJson = JSON.stringify(value);
          index = targetArray.findIndex(
            (item) => JSON.stringify(item) === valueAsJson
          );
        }
        if (index > -1) {
          newArray = [...targetArray];
          newArray.splice(index, 1);
        } else {
          log.debug(
            `MODIFY_ARRAY_FIELD: Value for 'remove_by_value' not found in array on field '${field}'.`
          );
        }
        break;
      }
    }

    return {
      array: newArray,
      result: mode === 'pop' ? poppedItem : newArray,
    };
  }

  /**
   * @description Commit the modified component data back to the entity manager.
   * @param {string} entityId
   * @param {string} compType
   * @param {object} data
   * @param {ILogger} log
   * @returns {boolean}
   * @private
   */
  #commitChanges(entityId, compType, data, log) {
    try {
      this.#entityManager.addComponent(entityId, compType, data);
      log.debug(
        `MODIFY_ARRAY_FIELD: Successfully committed changes to component '${compType}' on entity '${entityId}'.`
      );
      return true;
    } catch (error) {
      safeDispatchError(
        this.#dispatcher,
        'MODIFY_ARRAY_FIELD: Failed to commit changes via addComponent.',
        {
          error: error.message,
          entityId,
          componentType: compType,
        }
      );
      return false;
    }
  }

  /**
   * @param {object} deps
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
    const log = this.getLogger(executionContext);
    if (!assertParamsObject(params, log, 'MODIFY_ARRAY_FIELD')) {
      return;
    }
    // 1. Resolve Entity ID
    const entityId = this.resolveEntity(params.entity_ref, executionContext);
    if (!entityId) {
      log.warn(
        `MODIFY_ARRAY_FIELD: Could not resolve entity_ref: ${JSON.stringify(params.entity_ref)}`
      );
      return;
    }

    // 2. Validate Parameters
    const { component_type, field, mode, result_variable, value } = params;
    const compType = this.validateComponentType(component_type);
    if (!compType || !field || !mode) {
      log.warn(
        `MODIFY_ARRAY_FIELD: Missing required parameters (component_type, field, or mode) for entity ${entityId}.`
      );
      return;
    }

    // 3. Fetch target array
    const fetched = this.#fetchTargetArray(entityId, compType, field, log);
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
      log
    );
    if (modification === null) {
      return;
    }

    // 4b. Set new array immutably
    setByPath(clonedComponentData, field, modification.array);

    // 5. Commit
    if (!this.#commitChanges(entityId, compType, clonedComponentData, log)) {
      return;
    }

    // 6. Store Result if requested
    if (result_variable) {
      const res = tryWriteContextVariable(
        result_variable,
        modification.result,
        executionContext,
        this.#dispatcher,
        log
      );
      if (res.success) {
        log.debug(
          `MODIFY_ARRAY_FIELD: Stored result in context variable '${result_variable}'.`
        );
      }
    }
  }
}

export default ModifyArrayFieldHandler;
