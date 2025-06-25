/**
 * @file Implements the MATH operation handler which evaluates mathematical expressions.
 */

import jsonLogic from 'json-logic-js';
import BaseOperationHandler from './baseOperationHandler.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */

/**
 * @typedef {object} MathExpression
 * @property {string} operator
 * @property {Array<number|object|MathExpression>} operands
 */

/**
 * Resolve an operand value which may be a literal number, a variable reference
 * or a nested expression.
 *
 * @description Exported for unit testing.
 * @param {number|object} operand - Operand to resolve.
 * @param {object} context - Evaluation context passed to json-logic.
 * @param {ILogger} logger - Logger for warnings.
 * @param {ISafeEventDispatcher} dispatcher - Dispatcher for error events.
 * @returns {number} Resolved numeric value or `NaN` on failure.
 */
export function resolveOperand(operand, context, logger, dispatcher) {
  if (typeof operand === 'number') return operand;
  if (operand && typeof operand === 'object') {
    if (Object.prototype.hasOwnProperty.call(operand, 'var')) {
      try {
        const raw = jsonLogic.apply({ var: operand.var }, context);
        const num = Number(raw);
        return Number.isNaN(num) ? NaN : num;
      } catch (e) {
        safeDispatchError(
          dispatcher,
          'MATH: Error resolving variable operand.',
          { error: e.message, stack: e.stack }
        );
        return NaN;
      }
    }
    if (operand.operator) {
      return evaluateExpression(operand, context, logger, dispatcher);
    }
  }
  logger.warn('MATH: Invalid operand encountered.', { operand });
  return NaN;
}

/**
 * Recursively evaluate a {@link MathExpression}.
 *
 * @description Exported for unit testing.
 * @param {MathExpression} expr - Expression to evaluate.
 * @param {object} context - Evaluation context used for variable resolution.
 * @param {ILogger} logger - Logger for warnings.
 * @param {ISafeEventDispatcher} dispatcher - Dispatcher for error events.
 * @returns {number} The numeric result or `NaN` if evaluation fails.
 */
export function evaluateExpression(expr, context, logger, dispatcher) {
  if (!expr || typeof expr !== 'object') return NaN;
  const { operator, operands } = expr;
  if (!Array.isArray(operands) || operands.length !== 2) return NaN;
  const left = resolveOperand(operands[0], context, logger, dispatcher);
  const right = resolveOperand(operands[1], context, logger, dispatcher);
  if (
    typeof left !== 'number' ||
    typeof right !== 'number' ||
    Number.isNaN(left) ||
    Number.isNaN(right)
  ) {
    logger.warn('MATH: operands must resolve to numbers.', { left, right });
    return NaN;
  }
  switch (operator) {
    case 'add':
      return left + right;
    case 'subtract':
      return left - right;
    case 'multiply':
      return left * right;
    case 'divide':
      if (right === 0) {
        logger.warn('MATH: Division by zero.');
        return NaN;
      }
      return left / right;
    case 'modulo':
      if (right === 0) {
        logger.warn('MATH: Modulo by zero.');
        return NaN;
      }
      return left % right;
    default:
      logger.warn(`MATH: Unknown operator '${operator}'.`);
      return NaN;
  }
}

/**
 * @class MathHandler
 * @description Evaluates a recursive math expression and stores the numeric result in a context variable.
 * @implements {OperationHandler}
 */
class MathHandler extends BaseOperationHandler {
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger - Logging service.
   * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} deps.safeEventDispatcher - Dispatcher for error events.
   */
  constructor({ logger, safeEventDispatcher }) {
    super('MathHandler', {
      logger: { value: logger },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Execute the MATH operation.
   *
   * @param {{result_variable:string, expression:MathExpression}|null|undefined} params
   * @param {ExecutionContext} executionContext
   */
  execute(params, executionContext) {
    const log = this.getLogger(executionContext);
    if (!assertParamsObject(params, log, 'MATH')) {
      return;
    }
    const { result_variable, expression } = params;
    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      log.warn('MATH: "result_variable" must be a non-empty string.');
      return;
    }
    if (!expression || typeof expression !== 'object') {
      log.warn('MATH: "expression" must be an object.');
      return;
    }

    if (!ensureEvaluationContext(executionContext, this.#dispatcher, log)) {
      return;
    }

    const value = evaluateExpression(
      expression,
      executionContext.evaluationContext,
      log,
      this.#dispatcher
    );
    const finalNumber =
      typeof value === 'number' && !Number.isNaN(value) ? value : null;
    if (finalNumber === null) {
      log.warn('MATH: expression did not resolve to a numeric result.');
    }
    const resultObj = tryWriteContextVariable(
      result_variable,
      finalNumber,
      executionContext,
      this.#dispatcher,
      log
    );
    if (!resultObj.success) {
      // writeContextVariable already handled logging/dispatching
    }
  }

  // Private evaluation helpers removed in favor of external functions.
}

export default MathHandler;
