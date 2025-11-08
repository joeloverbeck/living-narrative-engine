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
 * Paths (expressed as arrays of keys) where JSON Logic evaluation should be skipped.
 * Supports wildcard segments using the string '*'.
 *
 * Currently used to ensure QUERY_ENTITIES filters keep their JSON Logic conditions
 * so that handlers such as QueryEntitiesHandler can evaluate them against
 * component data instead of the interpreter eagerly resolving them.
 */
const JSON_LOGIC_SKIP_PATHS = Object.freeze([
  ['filters', '*', 'with_component_data', 'condition'],
]);

const JSON_LOGIC_OPERATOR_HINTS = Object.freeze([
  'var',
  'cat',
  'if',
  '==',
  '!=',
  '>',
  '<',
  '>=',
  '<=',
  'and',
  'or',
  'not',
  '+',
  '-',
  '*',
  '/',
  '%',
  'in',
  'map',
  'filter',
  'reduce',
  'all',
  'none',
  'some',
  'merge',
  'missing',
  'missing_some',
  '===',
  '!==',
  '!',
  '!!',
  'log',
  'substr',
  'min',
  'max',
]);

const JSON_LOGIC_OPERATORS_EXPECT_ARRAY = new Set([
  'if',
  'and',
  'or',
  'cat',
  'map',
  'filter',
  'reduce',
  'all',
  'none',
  'some',
  'merge',
  'in',
  '==',
  '!=',
  '>',
  '<',
  '>=',
  '<=',
  '+',
  '-',
  '*',
  '/',
  '%',
  'missing',
  'missing_some',
]);

const REGISTERED_JSON_LOGIC_OPERATORS = new Set([
  ...JSON_LOGIC_OPERATORS_EXPECT_ARRAY,
  'var',
  ...JSON_LOGIC_OPERATOR_HINTS,
]);

if (
  jsonLogic &&
  typeof jsonLogic === 'object' &&
  !jsonLogic.__operationInterpreterPatched
) {
  Object.defineProperty(jsonLogic, '__operationInterpreterPatched', {
    value: true,
    enumerable: false,
    configurable: true,
    writable: false,
  });

  const originalAddOperation =
    typeof jsonLogic.add_operation === 'function'
      ? jsonLogic.add_operation.bind(jsonLogic)
      : null;

  if (originalAddOperation) {
    jsonLogic.add_operation = function patchedAddOperation(name, code) {
      if (typeof name === 'string') {
        REGISTERED_JSON_LOGIC_OPERATORS.add(name);
      }
      return originalAddOperation(name, code);
    };
  }

  const originalRemoveOperation =
    typeof jsonLogic.rm_operation === 'function'
      ? jsonLogic.rm_operation.bind(jsonLogic)
      : null;

  if (originalRemoveOperation) {
    jsonLogic.rm_operation = function patchedRemoveOperation(name) {
      if (typeof name === 'string') {
        REGISTERED_JSON_LOGIC_OPERATORS.delete(name);
      }
      return originalRemoveOperation(name);
    };
  }
}

/**
 * Checks if an operator is registered in JSON Logic
 *
 * @param {string} operator - The operator name to check
 * @returns {boolean} True if operator is registered
 */
function isKnownJsonLogicOperator(operator) {
  return REGISTERED_JSON_LOGIC_OPERATORS.has(operator);
}

/**
 * Determines whether an object is a JSON Logic expression with a valid operand shape.
 *
 * @param {unknown} candidate - Value to inspect.
 * @returns {boolean} True when the value should be treated as JSON Logic.
 */
function hasValidJsonLogicShape(candidate) {
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    Array.isArray(candidate)
  ) {
    return false;
  }

  const keys = Object.keys(candidate);
  if (keys.length !== 1) {
    return false;
  }

  const operator = keys[0];
  const operand = candidate[operator];

  if (JSON_LOGIC_OPERATORS_EXPECT_ARRAY.has(operator)) {
    if (!Array.isArray(operand)) {
      return false;
    }
    return true;
  }

  if (operator === 'var') {
    if (
      !(
        typeof operand === 'string' ||
        (Array.isArray(operand) && operand.length > 0)
      )
    ) {
      return false;
    }
    return true;
  }

  if (!isKnownJsonLogicOperator(operator)) {
    return false;
  }

  if (
    typeof jsonLogic.is_logic === 'function' &&
    jsonLogic.is_logic(candidate) &&
    operand &&
    typeof operand === 'object' &&
    !Array.isArray(operand)
  ) {
    if (hasValidJsonLogicShape(operand)) {
      return true;
    }
  }

  return true;
}

/**
 * Determines if the current traversal path should skip JSON Logic evaluation.
 *
 * @param {Array<string>} path - The traversal path represented as an array of keys.
 * @param {Array<Array<string>>} skipPaths - Collection of paths where evaluation is disallowed.
 * @returns {boolean} True when evaluation must be skipped for the provided path.
 */
function shouldSkipJsonLogicEvaluation(path, skipPaths) {
  return skipPaths.some((skipPath) => {
    if (skipPath.length !== path.length) {
      return false;
    }
    for (let i = 0; i < skipPath.length; i += 1) {
      const expected = skipPath[i];
      if (expected === '*') {
        continue;
      }
      if (expected !== path[i]) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Performs diagnostic checks on operation registration
 *
 * IMPORTANT: This function must be browser-compatible.
 * Cannot use Node.js modules (fs, path, require).
 *
 * @param {string} operationType - Operation type to diagnose
 * @param {boolean} handlerRegistered - Whether handler is registered in registry
 * @returns {object} Diagnostic results
 */
function diagnoseOperationRegistration(operationType, handlerRegistered) {
  const diagnostics = {
    schemaExists: null, // Cannot check in browser
    schemaReferenced: null, // Cannot check in browser
    inWhitelist: false,
    tokenDefined: null, // Cannot check reliably in browser
    handlerRegistered: false,
  };

  try {
    // Check whitelist
    diagnostics.inWhitelist = KNOWN_OPERATION_TYPES.includes(operationType);

    // Check if handler is registered in the registry
    diagnostics.handlerRegistered = handlerRegistered;

    // Note: Schema and token checks require file system access and are not
    // feasible in a browser-compatible implementation. These checks should be
    // done during build/validation time, not runtime.
  } catch {
    // If diagnostics fail, continue with what we have
  }

  return diagnostics;
}

/**
 * Recursively evaluate JSON Logic expressions in an object.
 * Detects if a value is a JSON Logic expression (non-empty plain object)
 * and evaluates it using the provided context.
 *
 * @param {unknown} value - Value to potentially evaluate
 * @param {object} evaluationContext - Context data for JSON Logic evaluation
 * @param {ILogger} logger - Logger instance
 * @param {Set<string>} skipKeys - Keys to skip during evaluation
 * @param {Array<Array<string>>} skipEvaluationPaths - Specific key paths where evaluation should not occur.
 * @param {Array<string>} currentPath - Path of keys leading to the current value.
 * @returns {unknown} Evaluated value
 */
function evaluateJsonLogicRecursively(
  value,
  evaluationContext,
  logger,
  skipKeys = new Set(),
  skipEvaluationPaths = [],
  currentPath = []
) {
  // Skip if value is null or undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      evaluateJsonLogicRecursively(
        item,
        evaluationContext,
        logger,
        skipKeys,
        skipEvaluationPaths,
        currentPath.concat(String(index))
      )
    );
  }

  // Check if this is a plain object that could be JSON Logic
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value);

    // If it's an empty object, return it as-is
    if (keys.length === 0) {
      return value;
    }

    if (shouldSkipJsonLogicEvaluation(currentPath, skipEvaluationPaths)) {
      return value;
    }

    // Check if this looks like a JSON Logic expression
    // JSON Logic expressions are objects with operator keys like 'var', 'cat', 'if', etc.
    // We detect this by checking if it has known JSON Logic operators or starts with typical operators
    const isLikelyJsonLogic = hasValidJsonLogicShape(value);

    if (isLikelyJsonLogic) {
      try {
        const result = jsonLogic.apply(value, evaluationContext);
        logger.debug(
          `OperationInterpreter: Evaluated JSON Logic expression. Input: ${JSON.stringify(value)}, Result: ${JSON.stringify(result)}`
        );
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.startsWith('Unrecognized operation ')) {
          logger.warn(
            `OperationInterpreter: Failed to evaluate JSON Logic expression: ${message}. Using original value.`
          );
          return value;
        }
        // Fall through to treat as a plain object when encountering an
        // unrecognized operation wrapper so nested JSON Logic expressions are
        // still evaluated.
      }
    }

    // Otherwise, recursively process object properties (unless they're in skipKeys)
    const result = {};
    for (const key of keys) {
      if (skipKeys.has(key)) {
        result[key] = value[key];
      } else {
        result[key] = evaluateJsonLogicRecursively(
          value[key],
          evaluationContext,
          logger,
          skipKeys,
          skipEvaluationPaths,
          currentPath.concat(key)
        );
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
   * @param {Operation} operation - The operation to execute
   * @param {ExecutionContext} executionContext - The execution context
   * @returns {unknown|void} Result of the operation handler or void if operation is invalid
   */
  execute(operation, executionContext) {
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
          ACTION_ARRAY_KEYS,
          JSON_LOGIC_SKIP_PATHS
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
    this.#logger.debug(`Executing handler for operation type "${opType}"…`);
    this.#logger.debug(
      `[DEBUG] OperationInterpreter.execute - Executing handler for operation type "${opType}"`
    );

    let handlerResult;
    try {
      handlerResult = handler(paramsForHandler, executionContext);
    } catch (handlerErr) {
      this.#logger.debug(
        `Handler for operation "${opType}" threw – re-throwing to caller.`
      );
      this.#logger.debug(
        `[DEBUG] OperationInterpreter.execute - Handler for "${opType}" threw error:`,
        handlerErr
      );
      throw handlerErr;
    }

    const isPromiseLike =
      handlerResult && typeof handlerResult.then === 'function';

    if (isPromiseLike) {
      return handlerResult
        .then((result) => {
          this.#logger.debug(
            `[DEBUG] OperationInterpreter.execute - Handler for "${opType}" completed successfully`
          );
          return result;
        })
        .catch((handlerErr) => {
          this.#logger.debug(
            `Handler for operation "${opType}" threw – re-throwing to caller.`
          );
          this.#logger.debug(
            `[DEBUG] OperationInterpreter.execute - Handler for "${opType}" threw error:`,
            handlerErr
          );
          throw handlerErr;
        });
    }

    this.#logger.debug(
      `[DEBUG] OperationInterpreter.execute - Handler for "${opType}" completed successfully`
    );
    return handlerResult;
  }
}

export const __internal = Object.freeze({
  evaluateJsonLogicRecursively,
  hasValidJsonLogicShape,
  shouldSkipJsonLogicEvaluation,
  JSON_LOGIC_SKIP_PATHS,
  diagnoseOperationRegistration,
});

export default OperationInterpreter;
