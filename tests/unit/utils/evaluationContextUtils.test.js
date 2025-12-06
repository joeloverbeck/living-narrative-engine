import { describe, test, expect, jest } from '@jest/globals';
import {
  ensureEvaluationContext,
  getEvaluationContext,
} from '../../../src/utils/evaluationContextUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import { expectNoDispatch } from '../../common/engine/dispatchTestUtils.js';
import * as safeDispatchErrorUtils from '../../../src/utils/safeDispatchErrorUtils.js';

const safeDispatchSpy = jest.spyOn(safeDispatchErrorUtils, 'safeDispatchError');

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const makeDispatcher = () => ({ dispatch: jest.fn() });

describe('ensureEvaluationContext', () => {
  const messageMatcher =
    /ensureEvaluationContext: executionContext\.evaluationContext\.context is missing or invalid\./;

  beforeEach(() => {
    jest.clearAllMocks();
    safeDispatchSpy.mockClear();
  });

  afterAll(() => {
    safeDispatchSpy.mockRestore();
  });

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

  test('logs an error when dispatcher is not provided', () => {
    const ctx = { evaluationContext: {} };
    const logger = makeLogger();

    const result = ensureEvaluationContext(ctx, null, logger);

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringMatching(messageMatcher)
    );
    expect(safeDispatchSpy).not.toHaveBeenCalled();
  });

  test('logs an error when dispatcher lacks dispatch function', () => {
    const ctx = { evaluationContext: {} };
    const dispatcher = {};
    const logger = makeLogger();

    const result = ensureEvaluationContext(ctx, dispatcher, logger);

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringMatching(messageMatcher)
    );
    expect(safeDispatchSpy).not.toHaveBeenCalled();
  });
});

describe('getEvaluationContext', () => {
  test('returns context when present', () => {
    const ctx = { evaluationContext: { context: { a: 1 } } };

    const result = getEvaluationContext(ctx);

    expect(result).toBe(ctx.evaluationContext.context);
  });

  test('returns null when context missing', () => {
    const ctx = { evaluationContext: {} };

    const result = getEvaluationContext(ctx);

    expect(result).toBeNull();
  });
});
