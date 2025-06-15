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
import { DISPLAY_ERROR_ID } from '../../constants/eventIds.js';
import { safeDispatchError } from '../../utils/safeDispatchError.js';
import { resolveEntityId } from '../../utils/entityRefUtils.js';
import { setContextValue } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils.js';

/**
 * @class ModifyArrayFieldHandler
 * @description Handles the 'MODIFY_ARRAY_FIELD' operation. It provides safe, atomic
 * operations on an array field inside a component using a clone-and-replace strategy.
 */
class ModifyArrayFieldHandler {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager - The entity management service.
   * @param {ILogger} deps.logger - The logging service.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Dispatcher for error events.
   */
  constructor({ entityManager, logger, safeEventDispatcher }) {
    if (
      !entityManager ||
      typeof entityManager.getComponentData !== 'function' ||
      typeof entityManager.addComponent !== 'function'
    ) {
      throw new Error(
        "Dependency 'IEntityManager' with getComponentData and addComponent methods is required."
      );
    }
    if (!logger || typeof logger.warn !== 'function') {
      throw new Error("Dependency 'ILogger' with a 'warn' method is required.");
    }
    if (
      !safeEventDispatcher ||
      typeof safeEventDispatcher.dispatch !== 'function'
    ) {
      throw new Error(
        "Dependency 'ISafeEventDispatcher' with dispatch method is required."
      );
    }
    this.#entityManager = entityManager;
    this.#logger = logger;
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
    const log = executionContext?.logger ?? this.#logger;
    if (!assertParamsObject(params, log, 'MODIFY_ARRAY_FIELD')) {
      return;
    }
    // 1. Resolve Entity ID
    const entityId = resolveEntityId(params.entity_ref, executionContext);
    if (!entityId) {
      log.warn(
        `MODIFY_ARRAY_FIELD: Could not resolve entity_ref: ${JSON.stringify(
          params.entity_ref
        )}`
      );
      return;
    }

    // 2. Validate Parameters
    const { component_type, field, mode, result_variable } = params;
    if (!component_type || !field || !mode) {
      log.warn(
        `MODIFY_ARRAY_FIELD: Missing required parameters (component_type, field, or mode) for entity ${entityId}.`
      );
      return;
    }

    // 3. Fetch and Clone Component
    const originalComponentData = this.#entityManager.getComponentData(
      entityId,
      component_type
    );
    if (!originalComponentData) {
      log.warn(
        `MODIFY_ARRAY_FIELD: Component '${component_type}' not found on entity '${entityId}'.`
      );
      return;
    }
    const clonedComponentData = cloneDeep(originalComponentData);

    // 4. Locate the Target Array Field
    const targetArray = resolvePath(clonedComponentData, field);
    if (!Array.isArray(targetArray)) {
      log.warn(
        `MODIFY_ARRAY_FIELD: Field path '${field}' in component '${component_type}' on entity '${entityId}' does not point to an array.`
      );
      return;
    }
    let result = null;

    // 5. Apply the Modification
    log.debug(
      `MODIFY_ARRAY_FIELD: Performing '${mode}' on field '${field}' for entity '${entityId}'.`
    );
    switch (mode) {
      case 'push':
        if (params.value === undefined) {
          log.warn(
            `MODIFY_ARRAY_FIELD: 'push' mode requires a 'value' parameter.`
          );
          return;
        }
        targetArray.push(params.value);
        result = targetArray;
        break;

      case 'push_unique': {
        if (params.value === undefined) {
          log.warn(
            `MODIFY_ARRAY_FIELD: 'push_unique' mode requires a 'value' parameter.`
          );
          return;
        }

        let exists = false;
        // For primitives, `includes` is correct and efficient.
        if (typeof params.value !== 'object' || params.value === null) {
          exists = targetArray.includes(params.value);
        } else {
          // For objects, `includes` fails. We must find by value, not reference.
          // Using JSON.stringify is a practical way to compare simple data objects.
          const valueAsJson = JSON.stringify(params.value);
          exists = targetArray.some(
            (item) => JSON.stringify(item) === valueAsJson
          );
        }

        if (!exists) {
          targetArray.push(params.value);
        } else {
          log.debug(
            `MODIFY_ARRAY_FIELD: Value for 'push_unique' already exists in array on field '${field}'.`
          );
        }
        result = targetArray;
        break;
      }

      case 'pop':
        if (targetArray.length > 0) {
          result = targetArray.pop();
        } else {
          log.debug(
            `MODIFY_ARRAY_FIELD: Attempted to 'pop' from an empty array on field '${field}'.`
          );
          result = undefined; // Or null, consistent with other engine logic
        }
        break;

      case 'remove_by_value': {
        if (params.value === undefined) {
          log.warn(
            `MODIFY_ARRAY_FIELD: 'remove_by_value' mode requires a 'value' parameter.`
          );
          return;
        }

        let index;
        // For primitives, `indexOf` is correct and efficient.
        if (typeof params.value !== 'object' || params.value === null) {
          index = targetArray.indexOf(params.value);
        } else {
          // For objects, `indexOf` fails because `cloneDeep` creates new object references.
          // We must find the item by comparing its value, not its reference.
          // Using findIndex with JSON.stringify is a practical way to compare simple data objects.
          const valueAsJson = JSON.stringify(params.value);
          index = targetArray.findIndex(
            (item) => JSON.stringify(item) === valueAsJson
          );
        }

        if (index > -1) {
          targetArray.splice(index, 1);
        } else {
          log.debug(
            `MODIFY_ARRAY_FIELD: Value for 'remove_by_value' not found in array on field '${field}'.`
          );
        }
        result = targetArray;
        break;
      }

      default:
        log.warn(`MODIFY_ARRAY_FIELD: Unknown mode '${mode}'.`);
        return;
    }

    // 6. Commit Changes via Clone-and-Replace
    try {
      this.#entityManager.addComponent(
        entityId,
        component_type,
        clonedComponentData
      );
      log.debug(
        `MODIFY_ARRAY_FIELD: Successfully committed changes to component '${component_type}' on entity '${entityId}'.`
      );
    } catch (error) {
      safeDispatchError(
        this.#dispatcher,
        'MODIFY_ARRAY_FIELD: Failed to commit changes via addComponent.',
        {
          error: error.message,
          entityId,
          componentType: component_type,
        }
      );
      return; // Abort if the update fails
    }

    // 7. Store Result if requested
    if (result_variable) {
      const stored = setContextValue(
        result_variable,
        result,
        executionContext,
        this.#dispatcher,
        log
      );
      if (stored) {
        log.debug(
          `MODIFY_ARRAY_FIELD: Stored result in context variable '${result_variable}'.`
        );
      }
    }
  }
}

export default ModifyArrayFieldHandler;
