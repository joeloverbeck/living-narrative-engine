// src/tests/core/utils/safeEventDispatcher.test.js
// --- FILE START ---

import { SafeEventDispatcher } from '../../../core/utils/safeEventDispatcher.js';
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

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
    // Add other methods if needed by constructor validation, though not used by dispatchSafely
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
        expect(() => new SafeEventDispatcher({ validatedEventDispatcher: mockVed, logger: null }))
            .toThrow('SafeEventDispatcher: Invalid or missing logger dependency');
        expect(() => new SafeEventDispatcher({ validatedEventDispatcher: mockVed, logger: {} }))
            .toThrow('SafeEventDispatcher: Invalid or missing logger dependency');
    });

    it('should throw an error if validatedEventDispatcher dependency is missing or invalid', () => {
        expect(() => new SafeEventDispatcher({ validatedEventDispatcher: null, logger: mockLogger }))
            .toThrow('SafeEventDispatcher: Invalid or missing validatedEventDispatcher dependency');
        expect(() => new SafeEventDispatcher({ validatedEventDispatcher: {}, logger: mockLogger }))
            .toThrow('SafeEventDispatcher: Invalid or missing validatedEventDispatcher dependency');
        // Ensure logger was used for the error message if VED validation fails
        expect(mockLogger.error).toHaveBeenCalledWith(
            'SafeEventDispatcher Constructor: Invalid or missing validatedEventDispatcher dependency (requires dispatchValidated method).'
        );
    });

    it('should successfully instantiate with valid dependencies', () => {
        expect(() => new SafeEventDispatcher({ validatedEventDispatcher: mockVed, logger: mockLogger }))
            .not.toThrow();
        expect(mockLogger.info).toHaveBeenCalledWith('SafeEventDispatcher: Instance created successfully.');
    });

    // --- dispatchSafely Tests ---

    const testEventName = 'test:event';
    const testPayload = { data: 'value' };

    it('AC1: should return true and not log error when VED.dispatchValidated resolves true', async () => {
        mockVed.dispatchValidated.mockResolvedValue(true);
        const dispatcher = new SafeEventDispatcher({ validatedEventDispatcher: mockVed, logger: mockLogger });

        const result = await dispatcher.dispatchSafely(testEventName, testPayload);

        expect(result).toBe(true);
        expect(mockVed.dispatchValidated).toHaveBeenCalledWith(testEventName, testPayload);
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(`SafeEventDispatcher: Successfully dispatched event '${testEventName}'.`); // Check debug log
    });

    it('AC2: should return false and log error when VED.dispatchValidated resolves false', async () => {
        mockVed.dispatchValidated.mockResolvedValue(false);
        const dispatcher = new SafeEventDispatcher({ validatedEventDispatcher: mockVed, logger: mockLogger });

        const result = await dispatcher.dispatchSafely(testEventName, testPayload);

        expect(result).toBe(false);
        expect(mockVed.dispatchValidated).toHaveBeenCalledWith(testEventName, testPayload);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            `SafeEventDispatcher: Underlying VED failed to dispatch event '${testEventName}' (returned false). Payload: ${JSON.stringify(testPayload)}`
        );
    });

    it('AC3: should return false and log error when VED.dispatchValidated throws an exception', async () => {
        const testError = new Error('VED dispatch failed!');
        mockVed.dispatchValidated.mockRejectedValue(testError);
        const dispatcher = new SafeEventDispatcher({ validatedEventDispatcher: mockVed, logger: mockLogger });

        const result = await dispatcher.dispatchSafely(testEventName, testPayload);

        expect(result).toBe(false);
        expect(mockVed.dispatchValidated).toHaveBeenCalledWith(testEventName, testPayload);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            `SafeEventDispatcher: Exception caught while dispatching event '${testEventName}'. Error: ${testError.message}`,
            { payload: testPayload, error: testError } // Check that the error object itself is logged
        );
    });
});

// --- FILE END ---