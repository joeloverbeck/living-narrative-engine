/**
 * @file Tests for AlertRouter behavior.
 */

import AlertRouter from '../../src/alerting/alertRouter.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../src/constants/eventIds.js';
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

    // --- FIX: Instantiate AlertRouter with the correct dependency object structure ---
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
    mockDispatcher.listeners['core:system_warning_occurred'](
      'core:system_warning_occurred',
      payload
    );

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
    mockDispatcher.listeners[SYSTEM_ERROR_OCCURRED_ID](
      SYSTEM_ERROR_OCCURRED_ID,
      payload
    );

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
    mockDispatcher.listeners['core:system_warning_occurred'](
      'core:system_warning_occurred',
      payload
    );

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
    mockDispatcher.listeners['core:system_warning_occurred'](
      'core:system_warning_occurred',
      { foo: 'bar' }
    );

    // Advance 5 seconds to trigger flush
    jest.advanceTimersByTime(5000);

    // Because payload.message was missing, the flush logic throws and logs once
    expect(console.error).toHaveBeenCalled();
    // No console.warn since it never saw a valid message

    // Now verify router still works for subsequent valid events
    console.error.mockClear();
    console.warn.mockClear();

    // Second event is valid
    const validPayload = { message: 'Now a valid warning' };
    mockDispatcher.listeners['core:system_warning_occurred'](
      'core:system_warning_occurred',
      validPayload
    );

    // Advance timer again
    jest.advanceTimersByTime(5000);

    // Now this time it should console.warn properly
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith('Now a valid warning');
    // No new console.error (aside from the first malformed one)
    expect(console.error).not.toHaveBeenCalled();
  });
});
