/**
 * @file Tests for MathHandler.
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';

// Mock json-logic-js
jest.mock('json-logic-js', () => ({
  apply: jest.fn(),
}));

import MathHandler, {
  resolveOperand,
  evaluateExpression,
} from '../../../../src/logic/operationHandlers/mathHandler.js';

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('MathHandler', () => {
  let handler;
  let logger;
  let safeEventDispatcher;
  let execCtx;
  let mockJsonLogic;

  beforeEach(() => {
    logger = makeLogger();
    safeEventDispatcher = { dispatch: jest.fn() };
    mockJsonLogic = jest.requireMock('json-logic-js');
    mockJsonLogic.apply.mockReset();
    // Default mock behavior for existing tests
    mockJsonLogic.apply.mockImplementation((rule, data) => {
      if (rule && rule.var) {
        // Handle dot notation like 'context.a'
        const path = rule.var.split('.');
        let result = data;
        for (const key of path) {
          result = result?.[key];
        }
        return result;
      }
      return undefined;
    });

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

  describe('Parameter Validation Edge Cases', () => {
    test('handles null params', () => {
      handler.execute(null, execCtx);
      expect(logger.warn).toHaveBeenCalledWith(
        'MATH: params missing or invalid.',
        { params: null }
      );
    });

    test('handles undefined params', () => {
      handler.execute(undefined, execCtx);
      expect(logger.warn).toHaveBeenCalledWith(
        'MATH: params missing or invalid.',
        { params: undefined }
      );
    });

    test('handles empty result_variable', () => {
      const params = {
        result_variable: '',
        expression: { operator: 'add', operands: [1, 2] },
      };
      handler.execute(params, execCtx);
      expect(logger.warn).toHaveBeenCalledWith(
        'MATH: "result_variable" must be a non-empty string.'
      );
    });

    test('handles whitespace-only result_variable', () => {
      const params = {
        result_variable: '   ',
        expression: { operator: 'add', operands: [1, 2] },
      };
      handler.execute(params, execCtx);
      expect(logger.warn).toHaveBeenCalledWith(
        'MATH: "result_variable" must be a non-empty string.'
      );
    });

    test('handles null expression', () => {
      const params = {
        result_variable: 'res',
        expression: null,
      };
      handler.execute(params, execCtx);
      expect(logger.warn).toHaveBeenCalledWith(
        'MATH: "expression" must be an object.'
      );
    });

    test('handles non-object expression', () => {
      const params = {
        result_variable: 'res',
        expression: 'invalid',
      };
      handler.execute(params, execCtx);
      expect(logger.warn).toHaveBeenCalledWith(
        'MATH: "expression" must be an object.'
      );
    });

    test('handles missing evaluationContext', () => {
      const invalidExecCtx = { logger };
      const params = {
        result_variable: 'res',
        expression: { operator: 'add', operands: [1, 2] },
      };
      handler.execute(params, invalidExecCtx);
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message:
            'ensureEvaluationContext: executionContext.evaluationContext.context is missing or invalid.',
        })
      );
    });
  });

  describe('Mathematical Operations Edge Cases', () => {
    test('modulo by zero stores null', () => {
      const params = {
        result_variable: 'res',
        expression: { operator: 'modulo', operands: [7, 0] },
      };
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context.res).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('MATH: Modulo by zero.');
    });

    test('unknown operator stores null', () => {
      const params = {
        result_variable: 'res',
        expression: { operator: 'power', operands: [2, 3] },
      };
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context.res).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "MATH: Unknown operator 'power'."
      );
    });

    test('performs multiply operation', () => {
      const params = {
        result_variable: 'res',
        expression: { operator: 'multiply', operands: [4, 5] },
      };
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context.res).toBe(20);
    });

    test('performs divide operation', () => {
      const params = {
        result_variable: 'res',
        expression: { operator: 'divide', operands: [10, 2] },
      };
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context.res).toBe(5);
    });

    test('performs modulo operation', () => {
      const params = {
        result_variable: 'res',
        expression: { operator: 'modulo', operands: [7, 3] },
      };
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context.res).toBe(1);
    });
  });
});

describe('resolveOperand', () => {
  let logger;
  let dispatcher;
  let mockJsonLogic;

  beforeEach(() => {
    logger = makeLogger();
    dispatcher = { dispatch: jest.fn() };
    mockJsonLogic = jest.requireMock('json-logic-js');
    mockJsonLogic.apply.mockReset();
  });

  test('returns number operands directly', () => {
    expect(resolveOperand(42, {}, logger, dispatcher)).toBe(42);
  });

  test('resolves variable references', () => {
    mockJsonLogic.apply.mockReturnValue(123);
    const context = { value: 123 };
    expect(resolveOperand({ var: 'value' }, context, logger, dispatcher)).toBe(
      123
    );
  });

  test('handles variable resolution errors', () => {
    mockJsonLogic.apply.mockImplementation(() => {
      throw new Error('Variable resolution failed');
    });

    const result = resolveOperand({ var: 'invalid' }, {}, logger, dispatcher);
    expect(result).toBe(NaN);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:system_error_occurred',
      expect.objectContaining({
        message: 'MATH: Error resolving variable operand.',
        details: expect.objectContaining({
          error: 'Variable resolution failed',
          stack: expect.stringContaining('Error: Variable resolution failed'),
        }),
      })
    );
  });

  test('handles nested expressions', () => {
    const expression = { operator: 'add', operands: [1, 2] };
    expect(resolveOperand(expression, {}, logger, dispatcher)).toBe(3);
  });

  test('warns about invalid operands', () => {
    expect(resolveOperand('invalid', {}, logger, dispatcher)).toBe(NaN);
    expect(logger.warn).toHaveBeenCalledWith(
      'MATH: Invalid operand encountered.',
      { operand: 'invalid' }
    );
  });

  test('handles non-numeric variable resolution', () => {
    mockJsonLogic.apply.mockReturnValue('hello');
    const context = { text: 'hello' };
    expect(resolveOperand({ var: 'text' }, context, logger, dispatcher)).toBe(
      NaN
    );
  });
});

describe('evaluateExpression', () => {
  let logger;
  let dispatcher;

  beforeEach(() => {
    logger = makeLogger();
    dispatcher = { dispatch: jest.fn() };
  });

  test('returns NaN for invalid expression', () => {
    expect(evaluateExpression(null, {}, logger, dispatcher)).toBe(NaN);
    expect(evaluateExpression('string', {}, logger, dispatcher)).toBe(NaN);
  });

  test('returns NaN for invalid operands array', () => {
    expect(
      evaluateExpression(
        { operator: 'add', operands: [1] },
        {},
        logger,
        dispatcher
      )
    ).toBe(NaN);
    expect(
      evaluateExpression(
        { operator: 'add', operands: [1, 2, 3] },
        {},
        logger,
        dispatcher
      )
    ).toBe(NaN);
    expect(
      evaluateExpression(
        { operator: 'add', operands: 'not-array' },
        {},
        logger,
        dispatcher
      )
    ).toBe(NaN);
  });

  test('warns about non-numeric operands', () => {
    const expr = { operator: 'add', operands: ['a', 'b'] };
    expect(evaluateExpression(expr, {}, logger, dispatcher)).toBe(NaN);
    expect(logger.warn).toHaveBeenCalledWith(
      'MATH: operands must resolve to numbers.',
      { left: NaN, right: NaN }
    );
  });

  test('performs all mathematical operations', () => {
    expect(
      evaluateExpression(
        { operator: 'add', operands: [3, 2] },
        {},
        logger,
        dispatcher
      )
    ).toBe(5);
    expect(
      evaluateExpression(
        { operator: 'subtract', operands: [3, 2] },
        {},
        logger,
        dispatcher
      )
    ).toBe(1);
    expect(
      evaluateExpression(
        { operator: 'multiply', operands: [3, 2] },
        {},
        logger,
        dispatcher
      )
    ).toBe(6);
    expect(
      evaluateExpression(
        { operator: 'divide', operands: [6, 2] },
        {},
        logger,
        dispatcher
      )
    ).toBe(3);
    expect(
      evaluateExpression(
        { operator: 'modulo', operands: [7, 3] },
        {},
        logger,
        dispatcher
      )
    ).toBe(1);
  });
});
