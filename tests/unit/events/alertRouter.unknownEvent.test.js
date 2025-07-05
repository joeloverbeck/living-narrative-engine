import AlertRouter from '../../../src/alerting/alertRouter.js';
import {
  SYSTEM_WARNING_OCCURRED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';
import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';

/**
 * @description Helper to create a router with a mocked dispatcher.
 * @returns {{router: AlertRouter, dispatcher: object}}
 */
function createRouter() {
  const dispatcher = {
    listeners: {},
    subscribe: jest.fn((name, cb) => {
      dispatcher.listeners[name] = cb;
    }),
    dispatch: jest.fn(),
  };
  const router = new AlertRouter({ safeEventDispatcher: dispatcher });
  return { router, dispatcher };
}

describe('AlertRouter additional branches', () => {
  let router;
  let dispatcher;

  beforeEach(() => {
    jest.useFakeTimers();
    ({ router, dispatcher } = createRouter());
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('unknown event names are ignored when queue flushes', () => {
    router.handleEvent('unknown:event', { message: 'no-op' });
    jest.advanceTimersByTime(5000);
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(router.queue).toEqual([]);
    expect(router.flushTimer).toBeNull();
  });

  test('constructor logs subscription errors', () => {
    const badDispatcher = {
      subscribe: jest.fn(() => {
        throw new Error('sub failure');
      }),
    };
    console.error = jest.fn();
    new AlertRouter({ safeEventDispatcher: badDispatcher });
    expect(console.error).toHaveBeenCalledWith(
      'AlertRouter subscription error:',
      expect.any(Error)
    );
  });
});
