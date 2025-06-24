/**
 * @file Tests for mathHandler helper functions.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
  evaluateExpression,
  resolveOperand,
} from '../../../../src/logic/operationHandlers/mathHandler.js';

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('mathHandler helper functions', () => {
  let logger;
  let dispatcher;

  beforeEach(() => {
    logger = makeLogger();
    dispatcher = { dispatch: jest.fn() };
    jest.clearAllMocks();
  });

  test('evaluateExpression correctly handles nested expressions', () => {
    const expr = {
      operator: 'multiply',
      operands: [
        { operator: 'add', operands: [1, 2] },
        { operator: 'subtract', operands: [5, 3] },
      ],
    };
    const result = evaluateExpression(expr, {}, logger, dispatcher);
    expect(result).toBe(6);
  });

  test('evaluateExpression returns NaN and warns on division by zero', () => {
    const expr = { operator: 'divide', operands: [10, 0] };
    const result = evaluateExpression(expr, {}, logger, dispatcher);
    expect(result).toBeNaN();
    expect(logger.warn).toHaveBeenCalledWith('MATH: Division by zero.');
  });

  test('resolveOperand warns on invalid operand', () => {
    const operand = { foo: 'bar' };
    const result = resolveOperand(operand, {}, logger, dispatcher);
    expect(result).toBeNaN();
    expect(logger.warn).toHaveBeenCalledWith(
      'MATH: Invalid operand encountered.',
      { operand }
    );
  });
});
