/**
 * @file Implements the MATH operation handler which evaluates mathematical expressions.
 */

import jsonLogic from 'json-logic-js';
import { DISPLAY_ERROR_ID } from '../../constants/eventIds.js';
import storeResult from '../../utils/contextVariableUtils.js';

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */

/**
 * @typedef {object} MathExpression
 * @property {string} operator
 * @property {Array<number|object|MathExpression>} operands
 */

/**
 * @class MathHandler
 * @description Evaluates a recursive math expression and stores the numeric result in a context variable.
 */
class MathHandler {
  /** @type {ILogger} */
  #logger;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger - Logging service.
   * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} deps.safeEventDispatcher - Dispatcher for error events.
   */
  constructor({ logger, safeEventDispatcher }) {
    if (!logger || typeof logger.warn !== 'function') {
      throw new Error('MathHandler requires a valid ILogger instance.');
    }
    if (
      !safeEventDispatcher ||
      typeof safeEventDispatcher.dispatch !== 'function'
    ) {
      throw new Error('MathHandler requires ISafeEventDispatcher.');
    }
    this.#logger = logger;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Execute the MATH operation.
   *
   * @param {{result_variable:string, expression:MathExpression}|null|undefined} params
   * @param {ExecutionContext} executionContext
   */
  execute(params, executionContext) {
    const log = executionContext?.logger ?? this.#logger;
    if (!params || typeof params !== 'object') {
      log.warn('MATH: parameters object missing or invalid.', { params });
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

    const value = this.#evaluate(
      expression,
      executionContext.evaluationContext
    );
    const finalNumber =
      typeof value === 'number' && !Number.isNaN(value) ? value : null;
    if (finalNumber === null) {
      log.warn('MATH: expression did not resolve to a numeric result.');
    }
    const stored = storeResult(
      result_variable.trim(),
      finalNumber,
      executionContext,
      this.#dispatcher,
      log
    );
    if (!stored) {
      // storeResult already handled logging/dispatching
    }
  }

  /**
   * Recursively evaluate a MathExpression.
   *
   * @private
   * @param {MathExpression} expr
   * @param {object} ctx
   * @returns {number}
   */
  #evaluate(expr, ctx) {
    if (!expr || typeof expr !== 'object') return NaN;
    const { operator, operands } = expr;
    if (!Array.isArray(operands) || operands.length !== 2) return NaN;
    const left = this.#resolveOperand(operands[0], ctx);
    const right = this.#resolveOperand(operands[1], ctx);
    if (
      typeof left !== 'number' ||
      typeof right !== 'number' ||
      Number.isNaN(left) ||
      Number.isNaN(right)
    ) {
      this.#logger.warn('MATH: operands must resolve to numbers.', {
        left,
        right,
      });
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
          this.#logger.warn('MATH: Division by zero.');
          return NaN;
        }
        return left / right;
      case 'modulo':
        if (right === 0) {
          this.#logger.warn('MATH: Modulo by zero.');
          return NaN;
        }
        return left % right;
      default:
        this.#logger.warn(`MATH: Unknown operator '${operator}'.`);
        return NaN;
    }
  }

  /**
   * Resolve an operand which may be a number, var reference or nested expression.
   *
   * @private
   * @param {number|object} operand
   * @param {object} ctx
   * @returns {number}
   */
  #resolveOperand(operand, ctx) {
    if (typeof operand === 'number') return operand;
    if (operand && typeof operand === 'object') {
      if (Object.prototype.hasOwnProperty.call(operand, 'var')) {
        try {
          const raw = jsonLogic.apply({ var: operand.var }, ctx);
          const num = Number(raw);
          return Number.isNaN(num) ? NaN : num;
        } catch (e) {
          this.#dispatcher.dispatch(DISPLAY_ERROR_ID, {
            message: 'MATH: Error resolving variable operand.',
            details: { error: e.message, stack: e.stack },
          });
          return NaN;
        }
      }
      if (operand.operator) {
        return this.#evaluate(operand, ctx);
      }
    }
    this.#logger.warn('MATH: Invalid operand encountered.', { operand });
    return NaN;
  }
}

export default MathHandler;
