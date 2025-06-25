import { describe, test, expect, jest, afterEach } from '@jest/globals';
import { ensureEvaluationContext } from '../../../src/utils/evaluationContextUtils.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js');

afterEach(() => {
  jest.clearAllMocks();
});

describe('ensureEvaluationContext', () => {
  test('returns context when available', () => {
    const ctx = { evaluationContext: { context: { foo: 1 } } };
    const result = ensureEvaluationContext(ctx, null, null);
    expect(result).toBe(ctx.evaluationContext.context);
    expect(safeDispatchError).not.toHaveBeenCalled();
  });

  test('dispatches error and returns null when context missing', () => {
    const dispatcher = { dispatch: jest.fn() };
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const result = ensureEvaluationContext({}, dispatcher, logger);
    expect(result).toBeNull();
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'executionContext.evaluationContext.context is missing or invalid.',
      expect.any(Object),
      expect.anything()
    );
  });
});
