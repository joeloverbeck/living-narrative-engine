import { describe, it, expect, jest } from '@jest/globals';
import { safeDispatchError } from '../../src/utils/safeDispatchError.js';
import { DISPLAY_ERROR_ID } from '../../src/constants/eventIds.js';

describe('safeDispatchError', () => {
  it('dispatches the display error event', () => {
    const dispatcher = { dispatch: jest.fn() };
    safeDispatchError(dispatcher, 'boom', { a: 1 });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_ERROR_ID, {
      message: 'boom',
      details: { a: 1 },
    });
  });

  it('throws if dispatcher is invalid', () => {
    expect(() => safeDispatchError({}, 'oops')).toThrow(
      "Invalid or missing method 'dispatch' on dependency 'safeDispatchError: dispatcher'."
    );
  });
});
