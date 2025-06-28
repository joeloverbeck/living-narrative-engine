import { describe, it, expect, jest } from '@jest/globals';
import {
  writeContextVariable,
} from '../../../src/utils/contextVariableUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import * as safeDispatchModule from '../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js');

describe('writeContextVariable additional branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles invalid names with no dispatcher', () => {
    const ctx = { evaluationContext: { context: {} } };
    const result = writeContextVariable('', 1, ctx, undefined, undefined);
    expect(result.success).toBe(false);
    // safeDispatchError should not be called when no dispatcher is available
    expect(safeDispatchModule.safeDispatchError).not.toHaveBeenCalled();
    expect(ctx.evaluationContext.context).toEqual({});
  });

  it('dispatches and returns failure when setContextValue throws', () => {
    const context = {};
    Object.defineProperty(context, 'foo', {
      set() {
        throw new Error('fail');
      },
    });
    const dispatcher = { dispatch: jest.fn() };
    const ctx = { evaluationContext: { context }, validatedEventDispatcher: dispatcher };

    const result = writeContextVariable('foo', 2, ctx, dispatcher, undefined);
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(safeDispatchModule.safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      expect.stringContaining('Failed to write variable'),
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('returns failure without dispatch when setContextValue throws and no dispatcher', () => {
    const context = {};
    Object.defineProperty(context, 'bar', {
      set() {
        throw new Error('fail');
      },
    });
    const ctx = { evaluationContext: { context } };

    const result = writeContextVariable('bar', 3, ctx, undefined, { error: jest.fn() });
    expect(result.success).toBe(false);
    expect(safeDispatchModule.safeDispatchError).not.toHaveBeenCalled();
  });
});
