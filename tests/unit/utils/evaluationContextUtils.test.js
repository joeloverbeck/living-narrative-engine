import { describe, test, expect, jest } from '@jest/globals';
import { ensureEvaluationContext } from '../../../src/utils/evaluationContextUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import { expectNoDispatch } from '../../common/engine/dispatchTestUtils.js';

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const makeDispatcher = () => ({ dispatch: jest.fn() });

describe('ensureEvaluationContext', () => {
  test('returns context when present', () => {
    const ctx = { evaluationContext: { context: { foo: 1 } } };
    const dispatcher = makeDispatcher();
    const logger = makeLogger();

    const result = ensureEvaluationContext(ctx, dispatcher, logger);

    expect(result).toBe(ctx.evaluationContext.context);
    expectNoDispatch(dispatcher.dispatch);
  });

  test('dispatches error and returns null when context missing', () => {
    const ctx = { evaluationContext: {} };
    const dispatcher = makeDispatcher();
    const logger = makeLogger();

    const result = ensureEvaluationContext(ctx, dispatcher, logger);

    expect(result).toBeNull();
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          'evaluationContext.context is missing'
        ),
      })
    );
  });
});
