/**
 * @file Handler for QUERY_COMPONENTS operation
 *
 * Retrieves multiple component types from an entity in a single operation.
 *
 * Operation flow:
 * 1. Validates operation parameters (entity_ref, component_types array, result_variable)
 * 2. Resolves entity reference to entity ID
 * 3. Queries entityManager for each component type in array
 * 4. Stores object map of component data in result_variable
 * 5. Uses missing_value for any components not found
 *
 * Related files:
 * @see data/schemas/operations/queryComponents.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - QueryComponentsHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 *
 * @extends ComponentOperationHandler
 */

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').EntityOperationDeps} EntityOperationDeps */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('./modifyComponentHandler.js').EntityRefObject} EntityRefObject */

import { writeContextVariable } from '../../utils/contextVariableUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';
import ComponentOperationHandler from './componentOperationHandler.js';

/**
 * @typedef {object} QueryComponentsOperationParams
 * @property {'actor'|'target'|string|EntityRefObject} entity_ref - Reference to the target entity.
 * @property {string[]} component_types - Array of component type IDs to query.
 * @property {string} result_variable - Variable name in executionContext.evaluationContext.context.
 * @property {*} [missing_value] - Optional value to store when a component is missing. Defaults to undefined.
 */

/**
 * @implements {OperationHandler}
 */
class QueryComponentsHandler extends ComponentOperationHandler {
  /** @type {IEntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;

  /**
   * @param {EntityOperationDeps} deps - Dependencies object
   */
  constructor({ entityManager, logger, safeEventDispatcher }) {
    super('QueryComponentsHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData'],
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
   * Execute the QUERY_COMPONENTS operation.
   *
   * @param {QueryComponentsParams} params
   * @param {ExecutionContext} executionContext
   */
  execute(params, executionContext) {
    const logger = this.getLogger(executionContext);

    if (
      !assertParamsObject(params, this.#dispatcher, 'QueryComponentsHandler')
    ) {
      return;
    }

    if (!ensureEvaluationContext(executionContext, this.#dispatcher, logger)) {
      return;
    }

    const { entity_ref, pairs } = params;

    if (!Array.isArray(pairs) || pairs.length === 0) {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentsHandler: "pairs" must be a non-empty array.',
        { params }
      );
      return;
    }

    for (const pair of pairs) {
      if (!pair || typeof pair !== 'object') continue;
      const { component_type, result_variable } = pair;
      const validated = this.validateEntityAndType(
        entity_ref,
        component_type,
        logger,
        'QueryComponentsHandler',
        executionContext
      );
      if (!validated) {
        safeDispatchError(
          this.#dispatcher,
          'QueryComponentsHandler: Invalid entity_ref or component_type in pair.',
          { pair }
        );
        continue;
      }
      const { entityId, type: trimmedType } = validated;
      if (
        !result_variable ||
        typeof result_variable !== 'string' ||
        !result_variable.trim()
      ) {
        safeDispatchError(
          this.#dispatcher,
          'QueryComponentsHandler: Invalid result_variable in pair.',
          { pair }
        );
        continue;
      }
      const sanitizedVariableName = result_variable.trim();
      let result;
      try {
        result = this.#entityManager.getComponentData(entityId, trimmedType);
      } catch (e) {
        safeDispatchError(
          this.#dispatcher,
          `QueryComponentsHandler: Error retrieving component "${trimmedType}" from entity "${entityId}"`,
          { error: e.message, stack: e.stack }
        );
        result = undefined;
      }

      const valueToStore = result === undefined ? null : result;
      writeContextVariable(
        sanitizedVariableName,
        valueToStore,
        executionContext,
        this.#dispatcher,
        logger
      );

      if (result !== undefined) {
        logger.debug(
          `QueryComponentsHandler: Stored component "${trimmedType}" value in "${sanitizedVariableName}".`
        );
      } else {
        logger.debug(
          `QueryComponentsHandler: Component "${trimmedType}" not found on entity "${entityId}". Stored null in "${sanitizedVariableName}".`
        );
      }
    }
  }
}

export default QueryComponentsHandler;
