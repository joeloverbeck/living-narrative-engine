// tests/utils/safeEventDispatcher.test.js
// --- FILE START ---

import { SafeEventDispatcher } from '../../src/events/safeEventDispatcher.js'; // Assuming path is src/events/
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- Mocks ---

// Mock ILogger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock IValidatedEventDispatcher
const mockVed = {
  dispatchValidated: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
};

// --- Reset Mocks Before Each Test ---
beforeEach(() => {
  jest.clearAllMocks();
});

// --- Test Suite ---

describe('SafeEventDispatcher', () => {
  it('should throw an error if logger dependency is missing or invalid', () => {
    expect(
      () =>
        new SafeEventDispatcher({
          validatedEventDispatcher: mockVed,
          logger: null,
        })
    ).toThrow(
      'SafeEventDispatcher: Invalid or missing logger dependency (requires error, debug, info methods).'
    );
    expect(
      () =>
        new SafeEventDispatcher({
          validatedEventDispatcher: mockVed,
          logger: {},
        })
    ).toThrow(
      'SafeEventDispatcher: Invalid or missing logger dependency (requires error, debug, info methods).'
    );
  });

  it('should throw an error if validatedEventDispatcher dependency is missing or invalid', () => {
    const expectedErrorMessage =
      'SafeEventDispatcher Constructor: Invalid or missing validatedEventDispatcher dependency (requires dispatchValidated, subscribe, and unsubscribe methods).';
    expect(
      () =>
        new SafeEventDispatcher({
          validatedEventDispatcher: null,
          logger: mockLogger,
        })
    ).toThrow(expectedErrorMessage);
    expect(
      () =>
        new SafeEventDispatcher({
          validatedEventDispatcher: {},
          logger: mockLogger,
        })
    ).toThrow(expectedErrorMessage);
    expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessage);
  });

  it('should successfully instantiate with valid dependencies', () => {
    expect(
      () =>
        new SafeEventDispatcher({
          validatedEventDispatcher: mockVed,
          logger: mockLogger,
        })
    ).not.toThrow();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'SafeEventDispatcher: Instance created successfully.'
    );
  });

  // --- dispatch Tests ---

  const testEventName = 'test:event';
  const testPayload = { data: 'value' };
  const expectedDefaultOptions = {}; // The default options object passed when none are provided to dispatch

  it('AC1: should return true and not log error when VED.dispatchValidated resolves true', async () => {
    mockVed.dispatchValidated.mockResolvedValue(true);
    const dispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: mockVed,
      logger: mockLogger,
    });

    // Call dispatch with two arguments
    const result = await dispatcher.dispatch(testEventName, testPayload);

    expect(result).toBe(true);
    // Expect VED.dispatchValidated to be called with three arguments (eventName, payload, defaultOptions)
    expect(mockVed.dispatchValidated).toHaveBeenCalledWith(
      testEventName,
      testPayload,
      expectedDefaultOptions
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `SafeEventDispatcher: Successfully dispatched event '${testEventName}'.`
    );
  });

  it('AC2: should return false and log error when VED.dispatchValidated resolves false', async () => {
    mockVed.dispatchValidated.mockResolvedValue(false);
    const dispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: mockVed,
      logger: mockLogger,
    });

    // Call dispatch with two arguments
    const result = await dispatcher.dispatch(testEventName, testPayload);

    expect(result).toBe(false);
    // Expect VED.dispatchValidated to be called with three arguments
    expect(mockVed.dispatchValidated).toHaveBeenCalledWith(
      testEventName,
      testPayload,
      expectedDefaultOptions
    );
    expect(mockLogger.error).not.toHaveBeenCalled(); // VED returns false, SED logs a warn.
    expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Changed from error to warn as per SED implementation.
    expect(mockLogger.warn).toHaveBeenCalledWith(
      // Changed from error to warn
      `SafeEventDispatcher: Underlying VED failed to dispatch event '${testEventName}' (returned false). See VED logs for details. Payload: ${JSON.stringify(testPayload)}`
    );
  });

  it('AC3: should return false and log error when VED.dispatchValidated throws an exception', async () => {
    const testError = new Error('VED dispatch failed!');
    mockVed.dispatchValidated.mockRejectedValue(testError);
    const dispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: mockVed,
      logger: mockLogger,
    });

    // Call dispatch with two arguments
    const result = await dispatcher.dispatch(testEventName, testPayload);

    expect(result).toBe(false);
    // Expect VED.dispatchValidated to be called with three arguments
    expect(mockVed.dispatchValidated).toHaveBeenCalledWith(
      testEventName,
      testPayload,
      expectedDefaultOptions
    );
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      `SafeEventDispatcher: Exception caught while dispatching event '${testEventName}'. Error: ${testError.message}`,
      // The second argument to logger.error should be the object with payload, error, and options
      {
        payload: testPayload,
        error: testError,
        options: expectedDefaultOptions,
      }
    );
  });
});

// --- FILE END ---
