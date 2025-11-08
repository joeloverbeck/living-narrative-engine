/**
 * @file Operation handler wrapper for IF flow control
 *
 * Wraps the flow handler from src/logic/flowHandlers/ifHandler.js to make it
 * accessible through the operation registry. This allows IF operations to work
 * in both top-level action sequences (via actionSequence.js) and nested contexts
 * (via operationInterpreter.js).
 *
 * Operation flow:
 * 1. Extract condition, then_actions, and else_actions from parameters
 * 2. Evaluate condition using JSON Logic
 * 3. Execute appropriate action sequence based on condition result
 *
 * Related files:
 * @see src/logic/flowHandlers/ifHandler.js - Underlying flow handler implementation
 * @see data/schemas/operations/if.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - IfHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('./baseOperationHandler.js').default} BaseOperationHandler */
/** @typedef {import('../operationInterpreter.js').default} OperationInterpreter */
/** @typedef {import('../jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */

import { handleIf } from '../flowHandlers/ifHandler.js';
import { executeActionSequence } from '../actionSequence.js';

/**
 * @typedef {object} IfOperationParams
 * @property {*} condition - JSON Logic condition to evaluate
 * @property {Array<*>} [then_actions] - Actions to execute if condition is true
 * @property {Array<*>} [else_actions] - Actions to execute if condition is false
 */

/**
 * Operation handler for IF flow control.
 *
 * This handler wraps the flow handler to make it accessible through the
 * operation registry, allowing IF operations to work in nested contexts.
 */
class IfHandler {
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
      throw new Error('IfHandler requires a valid OperationInterpreter resolver or instance.');
    }

    // Validate based on type
    const isFunction = typeof operationInterpreter === 'function';
    const isObject = typeof operationInterpreter === 'object' && typeof operationInterpreter.execute === 'function';

    if (!isFunction && !isObject) {
      throw new Error('IfHandler requires operationInterpreter to be either a resolver function or an object with execute() method.');
    }

    if (!jsonLogic || typeof jsonLogic.evaluate !== 'function') {
      throw new Error('IfHandler requires a valid JsonLogicEvaluationService instance.');
    }
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error('IfHandler requires a valid ILogger instance.');
    }

    // Normalize to always use a resolver function
    this.#operationInterpreterResolver = isFunction ? operationInterpreter : () => operationInterpreter;
    this.#jsonLogic = jsonLogic;
    this.#logger = logger;
  }

  /**
   * Execute the IF operation.
   *
   * @param {IfOperationParams} params - Operation parameters
   * @param {ExecutionContext} executionContext - Current execution context
   * @returns {Promise<void>}
   */
  async execute(params, executionContext) {
    const logger = this.#logger;

    if (!params || typeof params !== 'object') {
      logger.error('IfHandler: Invalid parameters object. IF operation cancelled.', { params });
      return;
    }

    // Create the operation node structure expected by the flow handler
    const node = {
      type: 'IF',
      parameters: params,
    };

    // Create the nested context with all required properties
    const nestedContext = {
      ...executionContext,
      jsonLogic: this.#jsonLogic,
      scopeLabel: 'IF',
    };

    // Resolve the operation interpreter when needed
    const operationInterpreter = this.#operationInterpreterResolver();

    // Delegate to the flow handler
    await handleIf(
      node,
      nestedContext,
      logger,
      operationInterpreter,
      executeActionSequence
    );
  }
}

export default IfHandler;
