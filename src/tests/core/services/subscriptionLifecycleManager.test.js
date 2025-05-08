// src/tests/core/services/subscriptionLifecycleManager.test.js

import {jest, describe, it, expect, beforeEach} from '@jest/globals';
import SubscriptionLifecycleManager from '../../../core/services/subscriptionLifecycleManager.js';
import {TURN_ENDED_ID} from '../../../core/constants/eventIds.js';

// --- Mock Dependencies ---
const mockLogger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(), // Generic log, specific methods are preferred by the class
};

const mockCommandInputPort = {
    onCommand: jest.fn(),
};

const mockSafeEventDispatcher = {
    subscribe: jest.fn(),
};

const CLASS_NAME_PREFIX = 'SubscriptionLifecycleManager: ';

describe('SubscriptionLifecycleManager - Command Input', () => {
    let manager;
    let mockCommandHandler;

    beforeEach(() => {
        jest.clearAllMocks();

        mockCommandHandler = jest.fn();

        // Instantiate the manager for each test
        manager = new SubscriptionLifecycleManager({
            logger: mockLogger,
            commandInputPort: mockCommandInputPort,
            safeEventDispatcher: mockSafeEventDispatcher,
        });

        // The constructor logs 'SubscriptionLifecycleManager: Initialized.'
        // Clear this specific log to avoid interference with test-specific log assertions.
        const initMessage = `${CLASS_NAME_PREFIX}Initialized.`;
        if (mockLogger.debug.mock.calls.some(call => call[0] === initMessage)) {
            // Clears all calls from mockLogger.debug, effectively removing the constructor's log call
            // from consideration for subsequent assertions in this test suite's tests.
            mockLogger.debug.mockClear();
        }
    });

    describe('Test Case 1: Successful command subscription and unsubscription', () => {
        let mockUnsubscribeCommandFn;

        beforeEach(() => {
            mockUnsubscribeCommandFn = jest.fn();
            mockCommandInputPort.onCommand.mockReturnValue(mockUnsubscribeCommandFn);
        });

        it('should subscribe, log, and then unsubscribe successfully, calling the unsubscribe function and logging', () => {
            // Act: Subscribe
            const subscriptionResult = manager.subscribeToCommandInput(mockCommandHandler);

            // Assert: Subscription
            expect(subscriptionResult).toBe(true);
            expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1);
            expect(mockCommandInputPort.onCommand).toHaveBeenCalledWith(mockCommandHandler);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Attempting to subscribe to command input.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Successfully subscribed to command input.`);

            // Act: Unsubscribe
            manager.unsubscribeFromCommandInput();

            // Assert: Unsubscription
            expect(mockUnsubscribeCommandFn).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Unsubscribing from command input.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Command input unsubscribe process completed.`);

            // Verify state by trying to unsubscribe again
            mockLogger.debug.mockClear();
            mockUnsubscribeCommandFn.mockClear();
            manager.unsubscribeFromCommandInput();
            expect(mockUnsubscribeCommandFn).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromCommandInput called but no active command subscription to unsubscribe.`);
        });
    });

    describe('Test Case 2: subscribeToCommandInput when onCommand fails (returns null)', () => {
        beforeEach(() => {
            mockCommandInputPort.onCommand.mockReturnValue(null);
        });

        it('should return false, log error, and not be subscribed', () => {
            // Act
            const subscriptionResult = manager.subscribeToCommandInput(mockCommandHandler);

            // Assert
            expect(subscriptionResult).toBe(false);
            expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1);
            expect(mockCommandInputPort.onCommand).toHaveBeenCalledWith(mockCommandHandler);
            expect(mockLogger.error).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Failed to subscribe to command input. onCommand did not return an unsubscribe function.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Attempting to subscribe to command input.`);
            expect(mockLogger.debug).not.toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Successfully subscribed to command input.`);

            mockLogger.debug.mockClear();
            manager.unsubscribeFromCommandInput();
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromCommandInput called but no active command subscription to unsubscribe.`);
        });
    });

    describe('Test Case 2b: subscribeToCommandInput when onCommand fails (returns undefined)', () => {
        beforeEach(() => {
            mockCommandInputPort.onCommand.mockReturnValue(undefined);
        });

        it('should return false, log error, and not be subscribed', () => {
            // Act
            const subscriptionResult = manager.subscribeToCommandInput(mockCommandHandler);

            // Assert
            expect(subscriptionResult).toBe(false);
            expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1);
            expect(mockCommandInputPort.onCommand).toHaveBeenCalledWith(mockCommandHandler);
            expect(mockLogger.error).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Failed to subscribe to command input. onCommand did not return an unsubscribe function.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Attempting to subscribe to command input.`);
            expect(mockLogger.debug).not.toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Successfully subscribed to command input.`);
        });
    });

    describe('Test Case 2c: subscribeToCommandInput when onCommand throws an error', () => {
        const subscriptionError = new Error('Port unavailable');
        beforeEach(() => {
            mockCommandInputPort.onCommand.mockImplementation(() => {
                throw subscriptionError;
            });
        });

        it('should return false, log error, and not be subscribed', () => {
            // Act
            const subscriptionResult = manager.subscribeToCommandInput(mockCommandHandler);

            // Assert
            expect(subscriptionResult).toBe(false);
            expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1);
            expect(mockCommandInputPort.onCommand).toHaveBeenCalledWith(mockCommandHandler);
            expect(mockLogger.error).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Error during command input subscription attempt: ${subscriptionError.message}`, subscriptionError);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Attempting to subscribe to command input.`);
            expect(mockLogger.debug).not.toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Successfully subscribed to command input.`);
        });
    });


    describe('Test Case 3: subscribeToCommandInput when already subscribed', () => {
        let mockUnsubscribeCommandFn1;
        let mockUnsubscribeCommandFn2;
        let mockCommandHandler1;
        let mockCommandHandler2;

        beforeEach(() => {
            mockUnsubscribeCommandFn1 = jest.fn();
            mockUnsubscribeCommandFn2 = jest.fn();
            mockCommandHandler1 = jest.fn();
            mockCommandHandler2 = jest.fn();

            mockCommandInputPort.onCommand.mockReturnValueOnce(mockUnsubscribeCommandFn1);
            manager.subscribeToCommandInput(mockCommandHandler1);

            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear(); // Clear debug logs from the first subscription
            mockCommandInputPort.onCommand.mockClear();
        });

        it('should unsubscribe the previous, subscribe the new, log warning, and return true', () => {
            mockCommandInputPort.onCommand.mockReturnValueOnce(mockUnsubscribeCommandFn2);

            const reSubscriptionResult = manager.subscribeToCommandInput(mockCommandHandler2);

            expect(reSubscriptionResult).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}subscribeToCommandInput called when already subscribed. Unsubscribing from previous command input first.`);
            expect(mockUnsubscribeCommandFn1).toHaveBeenCalledTimes(1);
            expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1); // This is for the *new* subscription call
            expect(mockCommandInputPort.onCommand).toHaveBeenCalledWith(mockCommandHandler2);
            // Logs for the new subscription
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Attempting to subscribe to command input.`); // For the new subscription
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Successfully subscribed to command input.`); // For the new subscription

            mockLogger.debug.mockClear();
            manager.unsubscribeFromCommandInput();
            expect(mockUnsubscribeCommandFn2).toHaveBeenCalledTimes(1);
            expect(mockUnsubscribeCommandFn1).toHaveBeenCalledTimes(1); // Already called once
        });
    });

    describe('Test Case 4: unsubscribeFromCommandInput when not subscribed', () => {
        it('should not throw errors, not call any unsubscribe function, and log appropriately', () => {
            manager.unsubscribeFromCommandInput();

            expect(mockCommandInputPort.onCommand).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromCommandInput called but no active command subscription to unsubscribe.`);
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });
    });

    describe('Test Case 5: Error handling during unsubscribeFromCommandInput call', () => {
        let mockUnsubscribeCommandFnWhichThrows;
        const unsubscribeError = new Error('Failed to remove listener');

        beforeEach(() => {
            mockUnsubscribeCommandFnWhichThrows = jest.fn(() => {
                throw unsubscribeError;
            });
            mockCommandInputPort.onCommand.mockReturnValue(mockUnsubscribeCommandFnWhichThrows);

            manager.subscribeToCommandInput(mockCommandHandler);
            mockLogger.debug.mockClear(); // Clear logs from subscription
            mockLogger.error.mockClear();
        });

        it('should catch error, log it, set state to unsubscribed, and not re-throw', () => {
            let didThrow = false;
            try {
                manager.unsubscribeFromCommandInput();
            } catch (e) {
                didThrow = true;
            }

            expect(didThrow).toBe(false);
            expect(mockUnsubscribeCommandFnWhichThrows).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Error during command input unsubscription: ${unsubscribeError.message}`, unsubscribeError);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Unsubscribing from command input.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Command input unsubscribe process completed.`);

            mockLogger.debug.mockClear();
            mockLogger.error.mockClear();
            mockUnsubscribeCommandFnWhichThrows.mockClear();

            manager.unsubscribeFromCommandInput();
            expect(mockUnsubscribeCommandFnWhichThrows).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromCommandInput called but no active command subscription to unsubscribe.`);
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });

    describe('Input validation for subscribeToCommandInput', () => {
        it('should return false and log error if commandHandler is not a function', () => {
            const result1 = manager.subscribeToCommandInput(null);
            expect(result1).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}subscribeToCommandInput: commandHandler must be a function.`);
            mockLogger.error.mockClear();

            const result2 = manager.subscribeToCommandInput(undefined);
            expect(result2).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}subscribeToCommandInput: commandHandler must be a function.`);
            mockLogger.error.mockClear();

            const result3 = manager.subscribeToCommandInput("not a function");
            expect(result3).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}subscribeToCommandInput: commandHandler must be a function.`);
        });
    });
});


describe('SubscriptionLifecycleManager - Turn Ended Event', () => {
    let manager;
    let mockTurnEndedListener;

    beforeEach(() => {
        jest.clearAllMocks();
        mockTurnEndedListener = jest.fn();

        manager = new SubscriptionLifecycleManager({
            logger: mockLogger,
            commandInputPort: mockCommandInputPort, // Still needed by constructor
            safeEventDispatcher: mockSafeEventDispatcher,
        });

        const initMessage = `${CLASS_NAME_PREFIX}Initialized.`;
        if (mockLogger.debug.mock.calls.some(call => call[0] === initMessage)) {
            mockLogger.debug.mockClear();
        }
    });

    describe('Test Case 1: Successful TURN_ENDED_ID event subscription and unsubscription', () => {
        let mockUnsubscribeTurnEndedFn;

        beforeEach(() => {
            mockUnsubscribeTurnEndedFn = jest.fn();
            mockSafeEventDispatcher.subscribe.mockReturnValue(mockUnsubscribeTurnEndedFn);
        });

        it('should subscribe, log, and then unsubscribe successfully, calling the unsubscribe function and logging', () => {
            // Act: Subscribe
            const subscriptionResult = manager.subscribeToTurnEnded(mockTurnEndedListener);

            // Assert: Subscription
            expect(subscriptionResult).toBe(true);
            expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledTimes(1);
            expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledWith(TURN_ENDED_ID, mockTurnEndedListener);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Attempting to subscribe to ${TURN_ENDED_ID} event.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Successfully subscribed to ${TURN_ENDED_ID} event.`);

            // Act: Unsubscribe
            manager.unsubscribeFromTurnEnded();

            // Assert: Unsubscription
            expect(mockUnsubscribeTurnEndedFn).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Unsubscribing from ${TURN_ENDED_ID} event.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}${TURN_ENDED_ID} event unsubscribe process completed.`);

            // Verify state by trying to unsubscribe again
            mockLogger.debug.mockClear();
            mockUnsubscribeTurnEndedFn.mockClear();
            manager.unsubscribeFromTurnEnded();
            expect(mockUnsubscribeTurnEndedFn).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromTurnEnded called but no active ${TURN_ENDED_ID} subscription.`);
        });
    });

    describe('Test Case 2: subscribeToTurnEnded when subscribe fails', () => {
        it('should return false, log error, and not be subscribed (when subscribe returns null)', () => {
            mockSafeEventDispatcher.subscribe.mockReturnValue(null);
            const subscriptionResult = manager.subscribeToTurnEnded(mockTurnEndedListener);

            expect(subscriptionResult).toBe(false);
            expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledWith(TURN_ENDED_ID, mockTurnEndedListener);
            expect(mockLogger.error).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Failed to subscribe to ${TURN_ENDED_ID}. SafeEventDispatcher.subscribe did not return an unsubscribe function.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Attempting to subscribe to ${TURN_ENDED_ID} event.`);
            expect(mockLogger.debug).not.toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Successfully subscribed to ${TURN_ENDED_ID} event.`);

            mockLogger.debug.mockClear();
            manager.unsubscribeFromTurnEnded();
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromTurnEnded called but no active ${TURN_ENDED_ID} subscription.`);
        });

        it('should return false, log error, and not be subscribed (when subscribe returns undefined)', () => {
            mockSafeEventDispatcher.subscribe.mockReturnValue(undefined);
            const subscriptionResult = manager.subscribeToTurnEnded(mockTurnEndedListener);

            expect(subscriptionResult).toBe(false);
            expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledWith(TURN_ENDED_ID, mockTurnEndedListener);
            expect(mockLogger.error).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Failed to subscribe to ${TURN_ENDED_ID}. SafeEventDispatcher.subscribe did not return an unsubscribe function.`);
            // Adding missing debug log checks from original for consistency
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Attempting to subscribe to ${TURN_ENDED_ID} event.`);
            expect(mockLogger.debug).not.toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Successfully subscribed to ${TURN_ENDED_ID} event.`);
        });

        it('should return false, log error, and not be subscribed (when subscribe throws)', () => {
            const subscriptionError = new Error('Dispatcher unavailable');
            mockSafeEventDispatcher.subscribe.mockImplementation(() => {
                throw subscriptionError;
            });
            const subscriptionResult = manager.subscribeToTurnEnded(mockTurnEndedListener);

            expect(subscriptionResult).toBe(false);
            expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledWith(TURN_ENDED_ID, mockTurnEndedListener);
            expect(mockLogger.error).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Error during ${TURN_ENDED_ID} event subscription attempt: ${subscriptionError.message}`, subscriptionError);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Attempting to subscribe to ${TURN_ENDED_ID} event.`);
            expect(mockLogger.debug).not.toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Successfully subscribed to ${TURN_ENDED_ID} event.`);
        });
    });

    describe('Test Case 3: subscribeToTurnEnded when already subscribed', () => {
        let mockUnsubscribeFn1;
        let mockUnsubscribeFn2;
        let mockListener1;
        let mockListener2;

        beforeEach(() => {
            mockUnsubscribeFn1 = jest.fn();
            mockUnsubscribeFn2 = jest.fn();
            mockListener1 = jest.fn();
            mockListener2 = jest.fn();

            mockSafeEventDispatcher.subscribe.mockReturnValueOnce(mockUnsubscribeFn1);
            manager.subscribeToTurnEnded(mockListener1); // First subscription

            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear(); // Clear debug logs from the first subscription
            mockSafeEventDispatcher.subscribe.mockClear();
        });

        it('should unsubscribe the previous, subscribe the new, log warning, and return true', () => {
            mockSafeEventDispatcher.subscribe.mockReturnValueOnce(mockUnsubscribeFn2);

            const reSubscriptionResult = manager.subscribeToTurnEnded(mockListener2);

            expect(reSubscriptionResult).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}subscribeToTurnEnded called when already subscribed to ${TURN_ENDED_ID}. Unsubscribing first.`);
            expect(mockUnsubscribeFn1).toHaveBeenCalledTimes(1);

            expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledTimes(1); // For the new subscription
            expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledWith(TURN_ENDED_ID, mockListener2);
            // Logs for the new subscription
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Attempting to subscribe to ${TURN_ENDED_ID} event.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Successfully subscribed to ${TURN_ENDED_ID} event.`);

            mockLogger.debug.mockClear();
            manager.unsubscribeFromTurnEnded();
            expect(mockUnsubscribeFn2).toHaveBeenCalledTimes(1);
            expect(mockUnsubscribeFn1).toHaveBeenCalledTimes(1); // Already called once
        });
    });

    describe('Test Case 4: unsubscribeFromTurnEnded when not subscribed', () => {
        it('should not throw errors, not call any unsubscribe function, and log appropriately', () => {
            manager.unsubscribeFromTurnEnded();

            expect(mockSafeEventDispatcher.subscribe).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromTurnEnded called but no active ${TURN_ENDED_ID} subscription.`);
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });
    });

    describe('Test Case 5: Error handling during unsubscribeFromTurnEnded call', () => {
        let mockUnsubscribeTurnEndedFnWhichThrows;
        const unsubscribeError = new Error('Failed to remove turn ended listener');

        beforeEach(() => {
            mockUnsubscribeTurnEndedFnWhichThrows = jest.fn(() => {
                throw unsubscribeError;
            });
            mockSafeEventDispatcher.subscribe.mockReturnValue(mockUnsubscribeTurnEndedFnWhichThrows);

            manager.subscribeToTurnEnded(mockTurnEndedListener);
            mockLogger.debug.mockClear(); // Clear logs from subscription
            mockLogger.error.mockClear();
        });

        it('should catch error, log it, set state to unsubscribed, and not re-throw', () => {
            let didThrow = false;
            try {
                manager.unsubscribeFromTurnEnded();
            } catch (e) {
                didThrow = true;
            }

            expect(didThrow).toBe(false);
            expect(mockUnsubscribeTurnEndedFnWhichThrows).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Error during ${TURN_ENDED_ID} event unsubscription: ${unsubscribeError.message}`, unsubscribeError);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Unsubscribing from ${TURN_ENDED_ID} event.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}${TURN_ENDED_ID} event unsubscribe process completed.`);

            mockLogger.debug.mockClear();
            mockLogger.error.mockClear();
            mockUnsubscribeTurnEndedFnWhichThrows.mockClear();

            manager.unsubscribeFromTurnEnded();
            expect(mockUnsubscribeTurnEndedFnWhichThrows).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromTurnEnded called but no active ${TURN_ENDED_ID} subscription.`);
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });

    describe('Input validation for subscribeToTurnEnded', () => {
        it('should return false and log error if turnEndedListener is not a function', () => {
            const result1 = manager.subscribeToTurnEnded(null);
            expect(result1).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}subscribeToTurnEnded: turnEndedListener must be a function for ${TURN_ENDED_ID}.`);
            mockLogger.error.mockClear();

            const result2 = manager.subscribeToTurnEnded(undefined);
            expect(result2).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}subscribeToTurnEnded: turnEndedListener must be a function for ${TURN_ENDED_ID}.`);
            mockLogger.error.mockClear();

            const result3 = manager.subscribeToTurnEnded("not a function");
            expect(result3).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}subscribeToTurnEnded: turnEndedListener must be a function for ${TURN_ENDED_ID}.`);
        });
    });
});

describe('SubscriptionLifecycleManager - unsubscribeAll', () => {
    let manager;
    let mockCmdUnsubFn;
    let mockEventUnsubFn;
    let mockCommandHandler;
    let mockTurnEndedListener;

    beforeEach(() => {
        jest.clearAllMocks();

        mockCmdUnsubFn = jest.fn();
        mockEventUnsubFn = jest.fn();
        mockCommandHandler = jest.fn();
        mockTurnEndedListener = jest.fn();

        manager = new SubscriptionLifecycleManager({
            logger: mockLogger,
            commandInputPort: mockCommandInputPort,
            safeEventDispatcher: mockSafeEventDispatcher,
        });

        const initMessage = `${CLASS_NAME_PREFIX}Initialized.`;
        if (mockLogger.debug.mock.calls.some(call => call[0] === initMessage)) {
            mockLogger.debug.mockClear();
        }
    });

    describe('Test Case 1: unsubscribeAll clears both subscriptions', () => {
        beforeEach(() => {
            // Arrange: Subscribe to both
            mockCommandInputPort.onCommand.mockReturnValue(mockCmdUnsubFn);
            manager.subscribeToCommandInput(mockCommandHandler);

            mockSafeEventDispatcher.subscribe.mockReturnValue(mockEventUnsubFn);
            manager.subscribeToTurnEnded(mockTurnEndedListener);

            // Clear logs from subscription phase AND clear mocks for logger, commandInputPort, safeEventDispatcher
            jest.clearAllMocks();
            // Re-mock the return values for onCommand and subscribe as they are cleared by jest.clearAllMocks()
            // but they might be needed if the SUT calls them again (though not in this specific path of unsubscribeAll)
            // For this specific test, the unsubscribe functions (mockCmdUnsubFn, mockEventUnsubFn) are what's critical.
            // The calls to onCommand and subscribe happen *before* this beforeEach's jest.clearAllMocks()
        });

        it('should call both unsubscribe functions, log relevant messages, and mark subscriptions as inactive', () => {
            // Act
            manager.unsubscribeAll();

            // Assert: Unsubscribe functions called
            expect(mockCmdUnsubFn).toHaveBeenCalledTimes(1);
            expect(mockEventUnsubFn).toHaveBeenCalledTimes(1);

            // Assert: Logs for unsubscribeAll
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeAll called. Clearing all managed subscriptions.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeAll completed.`);

            // Assert: Logs for individual unsubscriptions (these are called by the respective unsubscribe methods)
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Unsubscribing from command input.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Command input unsubscribe process completed.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Unsubscribing from ${TURN_ENDED_ID} event.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}${TURN_ENDED_ID} event unsubscribe process completed.`);

            // Assert: State is unsubscribed (check by trying to unsubscribe again)
            mockLogger.debug.mockClear(); // Clear logs from unsubscribeAll
            mockCmdUnsubFn.mockClear();
            mockEventUnsubFn.mockClear();

            manager.unsubscribeFromCommandInput();
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromCommandInput called but no active command subscription to unsubscribe.`);
            expect(mockCmdUnsubFn).not.toHaveBeenCalled();

            manager.unsubscribeFromTurnEnded();
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromTurnEnded called but no active ${TURN_ENDED_ID} subscription.`);
            expect(mockEventUnsubFn).not.toHaveBeenCalled();
        });
    });

    describe('Test Case 2: unsubscribeAll when only command is subscribed', () => {
        beforeEach(() => {
            // Arrange: Subscribe only to command
            mockCommandInputPort.onCommand.mockReturnValue(mockCmdUnsubFn);
            manager.subscribeToCommandInput(mockCommandHandler);

            // Clear logs from subscription phase
            jest.clearAllMocks();
        });

        it('should call command unsubscribe, log, and not error for event unsubscription', () => {
            // Act
            manager.unsubscribeAll();

            // Assert: Command unsubscribe function called
            expect(mockCmdUnsubFn).toHaveBeenCalledTimes(1);
            expect(mockEventUnsubFn).not.toHaveBeenCalled(); // Event unsubscribe should not be called directly if not subscribed

            // Assert: Logs for unsubscribeAll
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeAll called. Clearing all managed subscriptions.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeAll completed.`);

            // Assert: Logs for individual unsubscriptions
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Unsubscribing from command input.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Command input unsubscribe process completed.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromTurnEnded called but no active ${TURN_ENDED_ID} subscription.`); // From the call within unsubscribeAll

            // Assert: State is unsubscribed
            mockLogger.debug.mockClear();
            manager.unsubscribeFromCommandInput();
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromCommandInput called but no active command subscription to unsubscribe.`);
            manager.unsubscribeFromTurnEnded();
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromTurnEnded called but no active ${TURN_ENDED_ID} subscription.`);
        });
    });

    describe('Test Case 3: unsubscribeAll when only event is subscribed', () => {
        beforeEach(() => {
            // Arrange: Subscribe only to event
            mockSafeEventDispatcher.subscribe.mockReturnValue(mockEventUnsubFn);
            manager.subscribeToTurnEnded(mockTurnEndedListener);

            // Clear logs from subscription phase
            jest.clearAllMocks();
        });

        it('should call event unsubscribe, log, and not error for command unsubscription', () => {
            // Act
            manager.unsubscribeAll();

            // Assert: Event unsubscribe function called
            expect(mockEventUnsubFn).toHaveBeenCalledTimes(1);
            expect(mockCmdUnsubFn).not.toHaveBeenCalled(); // Command unsubscribe should not be called directly if not subscribed

            // Assert: Logs for unsubscribeAll
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeAll called. Clearing all managed subscriptions.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeAll completed.`);

            // Assert: Logs for individual unsubscriptions
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}Unsubscribing from ${TURN_ENDED_ID} event.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}${TURN_ENDED_ID} event unsubscribe process completed.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromCommandInput called but no active command subscription to unsubscribe.`); // From the call within unsubscribeAll

            // Assert: State is unsubscribed
            mockLogger.debug.mockClear();
            manager.unsubscribeFromCommandInput();
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromCommandInput called but no active command subscription to unsubscribe.`);
            manager.unsubscribeFromTurnEnded();
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromTurnEnded called but no active ${TURN_ENDED_ID} subscription.`);
        });
    });

    describe('Test Case 4: unsubscribeAll when neither is subscribed', () => {
        beforeEach(() => {
            // Arrange: No subscriptions.
            // jest.clearAllMocks() in the main beforeEach of this suite handles ensuring mocks are clean.
            // The manager is new and hasn't had subscribe methods called yet in this test.
        });

        it('should not call any specific unsubscribe functions, log appropriately, and not error', () => {
            // Act
            manager.unsubscribeAll();

            // Assert: No specific unsubscribe functions called (mockCmdUnsubFn and mockEventUnsubFn were never returned by mocks in this test's context)
            expect(mockCmdUnsubFn).not.toHaveBeenCalled();
            expect(mockEventUnsubFn).not.toHaveBeenCalled();

            // Assert: Logs for unsubscribeAll
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeAll called. Clearing all managed subscriptions.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeAll completed.`);

            // Assert: Logs indicating nothing to unsubscribe for each type (from calls within unsubscribeAll)
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromCommandInput called but no active command subscription to unsubscribe.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromTurnEnded called but no active ${TURN_ENDED_ID} subscription.`);

            // Assert: No errors (implicit if test passes, but check error/warn logs specifically)
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();

            // Assert: State remains unsubscribed
            mockLogger.debug.mockClear(); // Clear logs from the unsubscribeAll call
            manager.unsubscribeFromCommandInput();
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromCommandInput called but no active command subscription to unsubscribe.`);
            manager.unsubscribeFromTurnEnded();
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_NAME_PREFIX}unsubscribeFromTurnEnded called but no active ${TURN_ENDED_ID} subscription.`);
        });
    });
});