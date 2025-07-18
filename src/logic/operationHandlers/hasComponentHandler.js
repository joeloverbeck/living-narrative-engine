/**
 * @file This operation handler determins if a component exists in an entity.
 * @see src/logic/operationHandlers/hasComponentHandler.js
 */

// --- Type-hints --------------------------------------------------------------
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('./modifyComponentHandler.js').EntityRefObject} EntityRefObject */

import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';
import ComponentOperationHandler from './componentOperationHandler.js';

/**
 * Parameters accepted by {@link HasComponentHandler#execute}.
 *
 * @typedef {object} HasComponentOperationParams
 * @property {'actor'|'target'|string|EntityRefObject} entity_ref - Required. Reference to the entity to check.
 * @property {string} component_type - Required. The namespaced type ID of the component to check for.
 * @property {string} result_variable - Required. The context variable where the boolean result (true/false) will be stored.
 */

// -----------------------------------------------------------------------------
// Handler implementation
// -----------------------------------------------------------------------------

/**
 * @implements {OperationHandler}
 */
class HasComponentHandler extends ComponentOperationHandler {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * Creates an instance of HasComponentHandler.
   *
   * @param {EntityOperationDeps} dependencies - Dependencies object.
   * @throws {Error} If required dependencies are missing or invalid.
   */
  constructor({ entityManager, logger, safeEventDispatcher }) {
    super('HasComponentHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['hasComponent'],
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
   * Resolves an entity reference to an entity ID.
   * (Copied from ModifyComponentHandler as the logic is identical)
   *
   * @private
   * @param {HasComponentOperationParams['entity_ref']} ref - The entity reference from parameters.
   * @param {ExecutionContext} ctx - The execution context.
   * @returns {string | null} The resolved entity ID or null.
   */

  /**
   * Executes the HAS_COMPONENT operation.
   *
   * @param {HasComponentOperationParams | null | undefined} params - The parameters for the operation.
   * @param {ExecutionContext} executionContext - The execution context.
   * @returns {void}
   */
  execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // 1. Validate Parameters
    if (!assertParamsObject(params, log, 'HAS_COMPONENT')) {
      return;
    }

    const { entity_ref, component_type, result_variable } = params;

    // 2. Resolve and validate entity reference
    const entityId = this.validateEntityRef(
      entity_ref,
      log,
      'HAS_COMPONENT',
      executionContext
    );
    if (!entityId) {
      // Will warn and default result later
    }
    const trimmedComponentType = this.requireComponentType(
      component_type,
      log,
      'HAS_COMPONENT'
    );
    if (!trimmedComponentType) {
      return;
    }
    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      log.warn(
        'HAS_COMPONENT: "result_variable" parameter must be a non-empty string.'
      );
      return;
    }

    const trimmedResultVar = result_variable.trim();

    // 3. Perform check and store result
    let result = false; // Default to false
    if (!entityId) {
      log.warn(
        `HAS_COMPONENT: Could not resolve entity from entity_ref. Storing 'false' in "${trimmedResultVar}".`,
        {
          entity_ref,
        }
      );
      // `result` is already false, so we just proceed to storage.
    } else {
      try {
        result = this.#entityManager.hasComponent(
          entityId,
          trimmedComponentType
        );
        log.debug(
          `HAS_COMPONENT: Entity "${entityId}" ${
            result ? 'has' : 'does not have'
          } component "${trimmedComponentType}". Storing result in "${trimmedResultVar}".`
        );
      } catch (e) {
        safeDispatchError(
          this.#dispatcher,
          `HAS_COMPONENT: An error occurred while checking for component "${trimmedComponentType}" on entity "${entityId}". Storing 'false'.`,
          {
            error: e.message,
            stack: e.stack,
            entityId,
            componentType: trimmedComponentType,
            resultVariable: trimmedResultVar,
          }
        );
        result = false; // Ensure result is false on error
      }
    }

    // 4. Store the final boolean result in the context
    tryWriteContextVariable(
      result_variable,
      result,
      executionContext,
      this.#dispatcher,
      log
    );
  }
}

export default HasComponentHandler;
