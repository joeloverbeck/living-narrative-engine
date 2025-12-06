/**
 * @file Tests for AlertRouter behavior.
 */

import AlertRouter from '../../../src/alerting/alertRouter.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  SYSTEM_WARNING_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

describe('AlertRouter', () => {
  let router;
  let mockDispatcher;

  beforeEach(() => {
    jest.useFakeTimers();

    // Mock SafeEventDispatcher
    mockDispatcher = {
      listeners: {},
      subscribe: jest.fn((eventName, listener) => {
        // Store the listener so tests can manually invoke it.
        mockDispatcher.listeners[eventName] = listener;
      }),
      dispatch: jest.fn(),
    };

    router = new AlertRouter({ safeEventDispatcher: mockDispatcher });
  });

  afterEach(() => {
    // Clear any pending timers & restore console spies
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('Dispatch warning before UI registers → event enqueued → after 5 seconds → console.warn called once', () => {
    // Spy on console.warn
    console.warn = jest.fn();
    console.error = jest.fn(); // just in case

    // Simulate a warning event before UI is ready
    const payload = { message: 'Test warning message' };
    // --- FIX: Invoke the listener with the full event object, not just the payload ---
    mockDispatcher.listeners[SYSTEM_WARNING_OCCURRED_ID]({
      name: SYSTEM_WARNING_OCCURRED_ID,
      payload,
    });

    // Still nothing happens until timer expires
    expect(console.warn).not.toHaveBeenCalled();

    // Fast-forward 5 seconds
    jest.advanceTimersByTime(5000);

    // The queue should have been flushed to console.warn exactly once
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith('Test warning message');

    // No console.error for this valid warning
    expect(console.error).not.toHaveBeenCalled();
  });

  test('Dispatch error, then call notifyUIReady() before 5 seconds → forwarding to UI instead of logging', () => {
    console.warn = jest.fn();
    console.error = jest.fn();

    const payload = { message: 'Test error message' };
    // Simulate an error event
    // --- FIX: Invoke the listener with the full event object ---
    mockDispatcher.listeners[SYSTEM_ERROR_OCCURRED_ID]({
      name: SYSTEM_ERROR_OCCURRED_ID,
      payload,
    });

    // Immediately call notifyUIReady() (within 5s)
    router.notifyUIReady();

    // Should dispatch "core:display_error" exactly once
    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'core:display_error',
      payload
    );

    // Advance time to make sure the flush-timer (if any) didn't still fire
    jest.advanceTimersByTime(5000);
    // No console.error should have been called, because we never flushed to console
    expect(console.error).not.toHaveBeenCalled();

    // Similarly, no console.warn
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('Dispatch when UI is already ready → immediate forwarding (no queue)', () => {
    console.warn = jest.fn();
    console.error = jest.fn();

    // Tell router the UI is ready first
    router.notifyUIReady();

    // Now simulate a warning event
    const payload = { message: 'Immediate warning after UI ready' };
    // --- FIX: Invoke the listener with the full event object ---
    mockDispatcher.listeners[SYSTEM_WARNING_OCCURRED_ID]({
      name: SYSTEM_WARNING_OCCURRED_ID,
      payload,
    });

    // Since uiReady === true, it should forward immediately:
    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'core:display_warning',
      payload
    );

    // No console.warn at all
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('Malformed payload → console.error called; router remains alive', () => {
    // Spy on console.error and console.warn
    console.error = jest.fn();
    console.warn = jest.fn();

    // Simulate a warning event with no `message` field
    // --- FIX: Invoke the listener with the full event object ---
    mockDispatcher.listeners[SYSTEM_WARNING_OCCURRED_ID]({
      name: SYSTEM_WARNING_OCCURRED_ID,
      payload: { foo: 'bar' },
    });

    // Advance 5 seconds to trigger flush
    jest.advanceTimersByTime(5000);

    // Because payload.message was missing, the flush logic throws and logs once
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      expect.any(Error)
    );
    // No console.warn since it never saw a valid message
    expect(console.warn).not.toHaveBeenCalled();

    // Now verify router still works for subsequent valid events
    console.error.mockClear();
    console.warn.mockClear();

    // Second event is valid
    const validPayload = { message: 'Now a valid warning' };
    // --- FIX: Invoke the listener with the full event object ---
    mockDispatcher.listeners[SYSTEM_WARNING_OCCURRED_ID]({
      name: SYSTEM_WARNING_OCCURRED_ID,
      payload: validPayload,
    });

    // Advance timer again
    jest.advanceTimersByTime(5000);

    // Now this time it should console.warn properly
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith('Now a valid warning');
    // No new console.error (aside from the first malformed one)
    expect(console.error).not.toHaveBeenCalled();
  });

  test('Queued error event flushes to console.error', () => {
    console.warn = jest.fn();
    console.error = jest.fn();

    const payload = { message: 'Critical failure detected' };
    mockDispatcher.listeners[SYSTEM_ERROR_OCCURRED_ID]({
      name: SYSTEM_ERROR_OCCURRED_ID,
      payload,
    });

    jest.advanceTimersByTime(5000);

    expect(console.error).toHaveBeenCalledWith('Critical failure detected');
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('handleEvent logs errors when forwardToUI throws', () => {
    console.error = jest.fn();
    router.uiReady = true;
    router.forwardToUI = jest.fn(() => {
      throw new Error('Immediate failure');
    });

    mockDispatcher.listeners[SYSTEM_WARNING_OCCURRED_ID]({
      name: SYSTEM_WARNING_OCCURRED_ID,
      payload: { message: 'should still continue' },
    });

    expect(console.error).toHaveBeenCalledWith(
      'AlertRouter error:',
      expect.any(Error)
    );
  });

  test('notifyUIReady logs and recovers from forwardToUI errors', () => {
    console.error = jest.fn();

    mockDispatcher.listeners[SYSTEM_WARNING_OCCURRED_ID]({
      name: SYSTEM_WARNING_OCCURRED_ID,
      payload: { message: 'queued while ui loads' },
    });

    router.forwardToUI = jest.fn(() => {
      throw new Error('Forwarding failed');
    });

    router.notifyUIReady();

    expect(console.error).toHaveBeenCalledWith(
      'AlertRouter error forwarding queued event:',
      expect.any(Error)
    );
    expect(router.queue).toEqual([]);
    expect(router.uiReady).toBe(true);
  });

  test('forwardToUI logs dispatch errors from dispatcher', () => {
    console.error = jest.fn();

    const failingDispatcher = {
      subscribe: jest.fn(),
      dispatch: jest.fn(() => {
        throw new Error('Dispatch failure');
      }),
    };

    const failingRouter = new AlertRouter({
      safeEventDispatcher: failingDispatcher,
    });

    failingRouter.forwardToUI(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'boom',
    });

    expect(console.error).toHaveBeenCalledWith(
      'AlertRouter dispatch error:',
      expect.any(Error)
    );
  });

  test('flush timer outer catch logs unexpected iteration failures', () => {
    console.error = jest.fn();

    mockDispatcher.listeners[SYSTEM_WARNING_OCCURRED_ID]({
      name: SYSTEM_WARNING_OCCURRED_ID,
      payload: { message: 'will trigger outer catch' },
    });

    router.queue = null;

    jest.advanceTimersByTime(5000);

    expect(console.error).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      expect.any(Error)
    );
    expect(router.queue).toEqual([]);
    expect(router.flushTimer).toBeNull();
  });
});
