// -----------------------------------------------------------------------------
//  OperationInterpreter
//  (v1.2.0 — defers placeholder resolution inside nested action-arrays)
// -----------------------------------------------------------------------------

import { resolvePlaceholders } from '../utils/contextUtils.js';
import { BaseService } from '../utils/serviceBase.js';
import { getNormalizedOperationType } from '../utils/operationTypeUtils.js';
import jsonLogic from 'json-logic-js';

/** @typedef {import('../../data/schemas/operation.schema.json').Operation} Operation */
/** @typedef {import('./defs.js').ExecutionContext}                               ExecutionContext */
/** @typedef {import('../interfaces/coreServices.js').ILogger}                    ILogger */
/** @typedef {import('./operationRegistry.js').default}                           OperationRegistry */

const ACTION_ARRAY_KEYS = new Set(['then_actions', 'else_actions', 'actions']);

/**
 * Recursively evaluate JSON Logic expressions in an object.
 * Detects if a value is a JSON Logic expression (non-empty plain object)
 * and evaluates it using the provided context.
 *
 * @param {*} value - Value to potentially evaluate
 * @param {object} evaluationContext - Context data for JSON Logic evaluation
 * @param {ILogger} logger - Logger instance
 * @param {Set<string>} skipKeys - Keys to skip during evaluation
 * @returns {*} Evaluated value
 */
function evaluateJsonLogicRecursively(value, evaluationContext, logger, skipKeys = new Set()) {
  // Skip if value is null or undefined
  if (value == null) {
    return value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => evaluateJsonLogicRecursively(item, evaluationContext, logger, skipKeys));
  }

  // Check if this is a plain object that could be JSON Logic
  if (typeof value === 'object') {
    const keys = Object.keys(value);

    // If it's an empty object, return it as-is
    if (keys.length === 0) {
      return value;
    }

    // Check if this looks like a JSON Logic expression
    // JSON Logic expressions are objects with operator keys like 'var', 'cat', 'if', etc.
    // We detect this by checking if it has known JSON Logic operators or starts with typical operators
    const jsonLogicOperators = ['var', 'cat', 'if', '==', '!=', '>', '<', '>=', '<=', 'and', 'or', 'not', '+', '-', '*', '/', '%', 'in', 'map', 'filter', 'reduce', 'all', 'none', 'some', 'merge', 'missing', 'missing_some'];
    const hasJsonLogicOperator = keys.some(key => jsonLogicOperators.includes(key));

    if (hasJsonLogicOperator) {
      try {
        const result = jsonLogic.apply(value, evaluationContext);
        logger.debug(`OperationInterpreter: Evaluated JSON Logic expression. Input: ${JSON.stringify(value)}, Result: ${JSON.stringify(result)}`);
        return result;
      } catch (error) {
        logger.warn(`OperationInterpreter: Failed to evaluate JSON Logic expression: ${error.message}. Using original value.`);
        return value;
      }
    }

    // Otherwise, recursively process object properties (unless they're in skipKeys)
    const result = {};
    for (const key of keys) {
      if (skipKeys.has(key)) {
        result[key] = value[key];
      } else {
        result[key] = evaluateJsonLogicRecursively(value[key], evaluationContext, logger, skipKeys);
      }
    }
    return result;
  }

  // Primitive values (string, number, boolean) - return as-is
  return value;
}

class OperationInterpreter extends BaseService {
  /** @type {ILogger} */ #logger;
  /** @type {OperationRegistry} */ #registry;

  constructor({ logger, operationRegistry }) {
    super();
    this.#logger = this._init('OperationInterpreter', logger, {
      operationRegistry: {
        value: operationRegistry,
        requiredMethods: ['getHandler'],
      },
    });
    this.#registry = operationRegistry;

    this.#logger.debug(
      'OperationInterpreter Initialized (using OperationRegistry).'
    );
  }

  /**
   * Executes one operation.
   *
   * @param {Operation}      operation
   * @param {ExecutionContext} executionContext
   */
  async execute(operation, executionContext) {
    const opType = getNormalizedOperationType(
      operation?.type,
      this.#logger,
      'OperationInterpreter.execute'
    );

    if (!opType) {
      this.#logger.error(
        'OperationInterpreter received invalid operation object (missing type).',
        { operation }
      );
      return;
    }

    const handler = this.#registry.getHandler(opType);

    if (!handler) {
      this.#logger.error(
        `---> HANDLER NOT FOUND for operation type: "${opType}".`
      );
      return;
    }

    // -----------------------------------------------------------------------
    //  🔑  NEW LOGIC:  don't interpolate placeholders inside nested actions
    // -----------------------------------------------------------------------
    let paramsForHandler;
    try {
      if (operation.parameters && typeof operation.parameters === 'object') {
        // Step 1: Resolve string placeholders like "{event.payload.actorId}"
        const withResolvedPlaceholders = resolvePlaceholders(
          operation.parameters,
          executionContext,
          this.#logger,
          '',
          ACTION_ARRAY_KEYS
        );

        // Step 2: Evaluate JSON Logic expressions in parameters
        // This handles cases like field: {"cat": ["spots.", {"var": "context.targetIndex"}]}
        paramsForHandler = evaluateJsonLogicRecursively(
          withResolvedPlaceholders,
          executionContext.evaluationContext,
          this.#logger,
          ACTION_ARRAY_KEYS
        );
      } else {
        paramsForHandler = operation.parameters;
      }
    } catch (interpolationErr) {
      this.#logger.error(
        `Error resolving placeholders for operation "${opType}". Skipping handler.`,
        interpolationErr
      );
      return;
    }

    // -----------------------------------------------------------------------
    //  Execute the actual handler
    // -----------------------------------------------------------------------
    try {
      this.#logger.debug(`Executing handler for operation type "${opType}"…`);
      this.#logger.debug(
        `[DEBUG] OperationInterpreter.execute - Executing handler for operation type "${opType}"`
      );
      await handler(paramsForHandler, executionContext);
      this.#logger.debug(
        `[DEBUG] OperationInterpreter.execute - Handler for "${opType}" completed successfully`
      );
    } catch (handlerErr) {
      // Bubble up – SystemLogicInterpreter will handle halting the sequence
      this.#logger.debug(
        `Handler for operation "${opType}" threw – re-throwing to caller.`
      );
      this.#logger.debug(
        `[DEBUG] OperationInterpreter.execute - Handler for "${opType}" threw error:`,
        handlerErr
      );
      throw handlerErr;
    }
  }
}

export default OperationInterpreter;
