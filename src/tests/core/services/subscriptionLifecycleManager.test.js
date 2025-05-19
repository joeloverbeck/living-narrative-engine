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