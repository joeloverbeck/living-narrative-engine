/**
 * @file Operation handler wrapper for FOR_EACH flow control
 *
 * Wraps the flow handler from src/logic/flowHandlers/forEachHandler.js to make it
 * accessible through the operation registry. This allows FOR_EACH operations to work
 * in both top-level action sequences (via actionSequence.js) and nested contexts
 * (via operationInterpreter.js).
 *
 * Operation flow:
 * 1. Extract collection path, item_variable, and actions from parameters
 * 2. Resolve collection from evaluation context
 * 3. Iterate over collection, setting item_variable for each iteration
 * 4. Execute actions for each item in the collection
 *
 * Related files:
 * @see src/logic/flowHandlers/forEachHandler.js - Underlying flow handler implementation
 * @see data/schemas/operations/forEach.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - ForEachHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('./baseOperationHandler.js').default} BaseOperationHandler */
/** @typedef {import('../operationInterpreter.js').default} OperationInterpreter */
/** @typedef {import('../jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */

import { handleForEach } from '../flowHandlers/forEachHandler.js';
import { executeActionSequence } from '../actionSequence.js';

/**
 * @typedef {object} ForEachOperationParams
 * @property {string} collection - Path to the collection in the evaluation context
 * @property {string} item_variable - Variable name to bind each item to
 * @property {Array<*>} actions - Actions to execute for each item
 */

/**
 * Operation handler for FOR_EACH flow control.
 *
 * This handler wraps the flow handler to make it accessible through the
 * operation registry, allowing FOR_EACH operations to work in nested contexts.
 */
class ForEachHandler {
  /** @type {() => OperationInterpreter} */
  #operationInterpreterResolver;
  /** @type {JsonLogicEvaluationService} */
  #jsonLogic;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} deps
   * @param {() => OperationInterpreter} deps.operationInterpreter - Lazy resolver for interpreter
   * @param {JsonLogicEvaluationService} deps.jsonLogic - JSON Logic evaluation service
   * @param {ILogger} deps.logger - Logger service instance
   * @throws {Error} If dependencies are invalid
   */
  constructor({ operationInterpreter, jsonLogic, logger }) {
    // Accept both function (lazy resolver) and object (direct instance)
    if (!operationInterpreter) {
      throw new Error('ForEachHandler requires a valid OperationInterpreter resolver or instance.');
    }

    // Validate based on type
    const isFunction = typeof operationInterpreter === 'function';
    const isObject = typeof operationInterpreter === 'object' && typeof operationInterpreter.execute === 'function';

    if (!isFunction && !isObject) {
      throw new Error('ForEachHandler requires operationInterpreter to be either a resolver function or an object with execute() method.');
    }

    if (!jsonLogic || typeof jsonLogic.evaluate !== 'function') {
      throw new Error('ForEachHandler requires a valid JsonLogicEvaluationService instance.');
    }
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error('ForEachHandler requires a valid ILogger instance.');
    }

    // Normalize to always use a resolver function
    this.#operationInterpreterResolver = isFunction ? operationInterpreter : () => operationInterpreter;
    this.#jsonLogic = jsonLogic;
    this.#logger = logger;
  }

  /**
   * Execute the FOR_EACH operation.
   *
   * @param {ForEachOperationParams} params - Operation parameters
   * @param {ExecutionContext} executionContext - Current execution context
   * @returns {Promise<void>}
   */
  async execute(params, executionContext) {
    const logger = this.#logger;

    if (!params || typeof params !== 'object') {
      logger.error('ForEachHandler: Invalid parameters object. FOR_EACH operation cancelled.', { params });
      return;
    }

    // Create the operation node structure expected by the flow handler
    const node = {
      type: 'FOR_EACH',
      parameters: params,
    };

    // Create the nested context with all required properties
    const nestedContext = {
      ...executionContext,
      jsonLogic: this.#jsonLogic,
      scopeLabel: 'FOR_EACH',
    };

    // Resolve the operation interpreter when needed
    const operationInterpreter = this.#operationInterpreterResolver();

    // Delegate to the flow handler
    await handleForEach(
      node,
      nestedContext,
      logger,
      operationInterpreter,
      executeActionSequence
    );
  }
}

export default ForEachHandler;
