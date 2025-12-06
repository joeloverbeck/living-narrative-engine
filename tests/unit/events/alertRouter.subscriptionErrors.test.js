import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AlertRouter from '../../../src/alerting/alertRouter.js';
import { SYSTEM_WARNING_OCCURRED_ID } from '../../../src/constants/eventIds.js';

/** @type {Console['error']} */
let originalConsoleError;

describe('AlertRouter additional coverage scenarios', () => {
  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    jest.useRealTimers();
  });

  it('logs subscription failures without throwing during construction', () => {
    const subscribeError = new Error('subscriber wiring failed');
    const dispatcher = {
      subscribe: jest.fn(() => {
        throw subscribeError;
      }),
    };

    expect(
      () => new AlertRouter({ safeEventDispatcher: dispatcher })
    ).not.toThrow();

    expect(dispatcher.subscribe).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      'AlertRouter subscription error:',
      subscribeError
    );
  });

  it('swallows queue push errors encountered before the UI is ready', () => {
    jest.useFakeTimers();
    const listeners = {};
    const dispatcher = {
      subscribe: jest.fn((eventName, listener) => {
        listeners[eventName] = listener;
      }),
      dispatch: jest.fn(),
    };

    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.queue = null;

    expect(() =>
      listeners[SYSTEM_WARNING_OCCURRED_ID]({
        name: SYSTEM_WARNING_OCCURRED_ID,
        payload: { message: 'queued while failing' },
      })
    ).not.toThrow();

    expect(console.error).toHaveBeenCalledWith(
      'AlertRouter error:',
      expect.any(Error)
    );
  });
});
