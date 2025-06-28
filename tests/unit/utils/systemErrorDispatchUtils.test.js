import { describe, it, expect, jest } from '@jest/globals';
import { dispatchSystemErrorEvent } from '../../../src/utils/systemErrorDispatchUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

/**
 * @file tests/unit/utils/systemErrorDispatchUtils.test.js
 * @description Tests for dispatchSystemErrorEvent covering success and failure paths.
 */

describe('dispatchSystemErrorEvent', () => {
  it('dispatches system error event successfully', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    const logger = { error: jest.fn() };
    await dispatchSystemErrorEvent(dispatcher, 'msg', { a: 1 }, logger);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'msg',
      details: { a: 1 },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs when dispatch throws', async () => {
    const err = new Error('boom');
    const dispatcher = { dispatch: jest.fn().mockRejectedValue(err) };
    const logger = { error: jest.fn() };
    await dispatchSystemErrorEvent(dispatcher, 'bad', { foo: 'bar' }, logger);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to dispatch system error event: bad',
      {
        originalDetails: { foo: 'bar' },
        dispatchError: err,
      }
    );
  });

  it('handles missing logger gracefully', async () => {
    const dispatcher = {
      dispatch: jest.fn().mockRejectedValue(new Error('fail')),
    };
    await dispatchSystemErrorEvent(dispatcher, 'oops', {}, {});
    expect(dispatcher.dispatch).toHaveBeenCalled();
  });
});
