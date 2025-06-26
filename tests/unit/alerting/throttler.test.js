/**
 * @file Unit tests for the Throttler class.
 * @see ../../src/alerting/throttler.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { Throttler } from '../../../src/alerting/throttler.js';
import { expectNoDispatch } from '../../common/engine/dispatchTestUtils.js';

// Create a mock dispatcher that conforms to the ISafeEventDispatcher interface for testing.
const mockDispatcher = {
  dispatch: jest.fn(),
  // Including other interface methods for completeness, though they are not used by Throttler.
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
};

describe('Throttler', () => {
  const key = 'test-key';
  const payload = { message: 'Test message', details: { statusCode: 404 } };
  const throttleWindowMs = 10000;

  // Set up and tear down timers and mocks for each test
  beforeEach(() => {
    jest.useFakeTimers();
    // Clear any previous mock calls before each test run.
    mockDispatcher.dispatch.mockClear();
  });

  afterEach(() => {
    // Restore real timers after each test to avoid side effects.
    jest.useRealTimers();
  });

  /**
   * Test Case 1: First Event
   */
  it('should allow the first event and not dispatch immediately', () => {
    const throttler = new Throttler(mockDispatcher, 'warning');

    // Act
    const result = throttler.allow(key, payload);

    // Assert
    expect(result).toBe(true);
    expectNoDispatch(mockDispatcher.dispatch);
  });

  /**
   * Test Case 2: Duplicate Events (Suppression)
   */
  it('should suppress subsequent identical events within the 10-second window', () => {
    const throttler = new Throttler(mockDispatcher, 'error');

    // Act: First event is allowed
    throttler.allow(key, payload);

    // Act: Subsequent events should be suppressed
    const result2 = throttler.allow(key, payload);
    const result3 = throttler.allow(key, payload);

    // Assert
    expect(result2).toBe(false);
    expect(result3).toBe(false);
    expectNoDispatch(mockDispatcher.dispatch);
  });

  /**
   * Test Case 3: Coalesced Summary Emission (Warning)
   */
  it('should emit a coalesced summary with warning severity after 10 seconds if duplicates were suppressed', () => {
    const throttler = new Throttler(mockDispatcher, 'warning');

    // Arrange: Allow one event and suppress two duplicates
    throttler.allow(key, payload); // First event
    throttler.allow(key, payload); // Suppressed duplicate
    throttler.allow(key, payload); // Suppressed duplicate

    // Act: Advance time to trigger the summary dispatch
    jest.advanceTimersByTime(throttleWindowMs);

    // Assert
    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'core:display_warning',
      {
        message:
          "Warning: 'Test message' occurred 2 more times in the last 10 seconds.",
        details: payload.details,
      }
    );
  });

  /**
   * Test Case 3: Coalesced Summary Emission (Error)
   */
  it('should emit a coalesced summary with error severity after 10 seconds if duplicates were suppressed', () => {
    const throttler = new Throttler(mockDispatcher, 'error');
    const errorPayload = {
      message: 'Critical failure',
      details: { code: 500 },
    };

    // Arrange
    throttler.allow(key, errorPayload); // First
    throttler.allow(key, errorPayload); // Suppressed

    // Act
    jest.advanceTimersByTime(throttleWindowMs);

    // Assert
    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith('core:display_error', {
      message:
        "Error: 'Critical failure' occurred 1 more times in the last 10 seconds.",
      details: errorPayload.details,
    });
  });

  /**
   * Test Case 4: No Summary for No Duplicates
   */
  it('should not emit a summary if no duplicates occurred within the window', () => {
    const throttler = new Throttler(mockDispatcher, 'error');

    // Arrange: Only one event occurs
    throttler.allow(key, payload);

    // Act: Advance time past the throttle window
    jest.advanceTimersByTime(throttleWindowMs);

    // Assert
    expectNoDispatch(mockDispatcher.dispatch);
  });

  /**
   * Test Case 5: State Reset and Cleanup
   */
  it('should treat an event as new after the throttling window has closed', () => {
    const throttler = new Throttler(mockDispatcher, 'warning');

    // Arrange: Process a single event and let its timer expire
    throttler.allow(key, payload);
    jest.advanceTimersByTime(throttleWindowMs);

    // Assert that no summary was dispatched for the first event
    expectNoDispatch(mockDispatcher.dispatch);

    // Act: A "new" event with the same key arrives after the window
    const result = throttler.allow(key, payload);

    // Assert: It should be allowed again, and no dispatch should happen immediately
    expect(result).toBe(true);
    expectNoDispatch(mockDispatcher.dispatch);

    // Act: Let the new timer run to completion to ensure no unexpected summary
    jest.advanceTimersByTime(throttleWindowMs);
    expectNoDispatch(mockDispatcher.dispatch);
  });

  it('should handle multiple keys independently', () => {
    const throttler = new Throttler(mockDispatcher, 'warning');
    const key1 = 'key-one';
    const payload1 = { message: 'Message One' };
    const key2 = 'key-two';
    const payload2 = { message: 'Message Two' };

    // Arrange: First events for two different keys
    expect(throttler.allow(key1, payload1)).toBe(true);
    expect(throttler.allow(key2, payload2)).toBe(true);

    // Arrange: Suppress an event for the first key
    expect(throttler.allow(key1, payload1)).toBe(false);

    // Act: Advance time
    jest.advanceTimersByTime(throttleWindowMs);

    // Assert: Only one summary dispatch should occur (for key1)
    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'core:display_warning',
      {
        message:
          "Warning: 'Message One' occurred 1 more times in the last 10 seconds.",
        details: undefined,
      }
    );
  });

  it('should throw an error if an invalid dispatcher is provided', () => {
    // Assert
    expect(() => new Throttler(null, 'warning')).toThrow(
      'Throttler: A valid ISafeEventDispatcher instance is required.'
    );
    expect(() => new Throttler({}, 'error')).toThrow(
      'Throttler: A valid ISafeEventDispatcher instance is required.'
    );
  });
});
