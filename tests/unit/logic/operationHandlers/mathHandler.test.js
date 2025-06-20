/**
 * @file Tests for MathHandler.
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import MathHandler from '../../../../src/logic/operationHandlers/mathHandler.js';

describe('MathHandler', () => {
  let handler;
  let logger;
  let safeEventDispatcher;
  let execCtx;

  beforeEach(() => {
    logger = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    safeEventDispatcher = { dispatch: jest.fn() };
    handler = new MathHandler({
      logger,
      safeEventDispatcher,
    });
    execCtx = {
      evaluationContext: {
        context: { a: 10, b: 2, c: 'foo' },
      },
      logger,
    };
  });

  test('performs addition with literals', () => {
    const params = {
      result_variable: 'res',
      expression: { operator: 'add', operands: [1, 2] },
    };
    handler.execute(params, execCtx);
    expect(execCtx.evaluationContext.context.res).toBe(3);
  });

  test('performs subtraction using context variables', () => {
    const params = {
      result_variable: 'res',
      expression: {
        operator: 'subtract',
        operands: [{ var: 'context.a' }, { var: 'context.b' }],
      },
    };
    handler.execute(params, execCtx);
    expect(execCtx.evaluationContext.context.res).toBe(8);
  });

  test('handles nested expressions', () => {
    const params = {
      result_variable: 'res',
      expression: {
        operator: 'multiply',
        operands: [{ operator: 'add', operands: [{ var: 'context.a' }, 2] }, 3],
      },
    };
    handler.execute(params, execCtx);
    expect(execCtx.evaluationContext.context.res).toBe(36);
  });

  test('division by zero stores null', () => {
    const params = {
      result_variable: 'res',
      expression: { operator: 'divide', operands: [5, 0] },
    };
    handler.execute(params, execCtx);
    expect(execCtx.evaluationContext.context.res).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  test('non-numeric operand results in null', () => {
    const params = {
      result_variable: 'res',
      expression: {
        operator: 'add',
        operands: [{ var: 'context.c' }, 2],
      },
    };
    handler.execute(params, execCtx);
    expect(execCtx.evaluationContext.context.res).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });
});
