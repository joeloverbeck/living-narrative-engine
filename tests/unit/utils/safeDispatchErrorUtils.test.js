import { describe, it, expect, jest } from '@jest/globals';
import {
  safeDispatchError,
  InvalidDispatcherError,
} from '../../../src/utils/safeDispatchErrorUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

describe('safeDispatchError', () => {
  it('dispatches the display error event', () => {
    const dispatcher = { dispatch: jest.fn() };
    safeDispatchError(dispatcher, 'boom', { a: 1 });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'boom',
      details: { a: 1 },
    });
  });

  it('throws if dispatcher is invalid', () => {
    const call = () => safeDispatchError({}, 'oops');
    expect(call).toThrow(InvalidDispatcherError);
    let error;
    try {
      call();
    } catch (err) {
      error = err;
    }
    expect(error.message).toBe(
      "Invalid or missing method 'dispatch' on dependency 'safeDispatchError: dispatcher'."
    );
    expect(error.details).toEqual({ functionName: 'safeDispatchError' });
  });
});
