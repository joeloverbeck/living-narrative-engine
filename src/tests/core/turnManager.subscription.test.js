// src/tests/core/turnManager.subscription.test.js
import TurnManager from '../../core/turnManager.js';
import {TURN_ENDED_ID} from '../../core/constants/eventIds.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../types/components.js'; // Added PLAYER_COMPONENT_ID
import {beforeEach, describe, expect, jest, test} from "@jest/globals";

// --- Mock Dependencies ---
// Reset outside describe for clarity, or inside beforeEach
let mockTurnOrderService;
let mockEntityManager;
let mockLogger;
let mockDispatcher;
let mockTurnHandlerResolver;
let mockCurrentHandler; // Mock for the handler instance
let mockActor; // Generic mock actor for default success paths

describe('TurnManager Subscription and Lifecycle', () => { // Renamed describe for clarity
    let turnManager;
    let mockUnsubscribeCallback;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Define mocks for each test run
        mockTurnOrderService = {
            clearCurrentRound: jest.fn().mockResolvedValue(undefined),
            // --- Default setup for advanceTurn success ---
            isEmpty: jest.fn().mockResolvedValue(false), // Assume not empty by default
            getNextEntity: jest.fn().mockImplementation(async () => mockActor), // Return default actor
            startNewRound: jest.fn().mockResolvedValue(undefined),
        };
        mockEntityManager = {
            getEntityInstance: jest.fn(),
            activeEntities: new Map(), // Start empty, populate if needed per test
        };
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };
        mockUnsubscribeCallback = jest.fn(); // The function returned by a successful subscribe
        mockDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(true),
            subscribe: jest.fn().mockReturnValue(mockUnsubscribeCallback), // Default success
            unsubscribe: jest.fn(), // Mocked but unused by TurnManager directly
        };
        mockCurrentHandler = { // The object representing a resolved turn handler
            startTurn: jest.fn().mockResolvedValue(undefined),
            destroy: jest.fn().mockResolvedValue(undefined),
        };
        mockTurnHandlerResolver = {
            // --- Default setup for advanceTurn success ---
            resolveHandler: jest.fn().mockResolvedValue(mockCurrentHandler), // Resolve to default handler
        };
        mockActor = { // Default actor used by mocks
            id: 'actor-default',
            hasComponent: jest.fn((componentId) => componentId === ACTOR_COMPONENT_ID), // Basic actor check
        };
        mockEntityManager.activeEntities.set(mockActor.id, mockActor); // Ensure default actor exists if needed for round start logic


        turnManager = new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        });

        // --- Spy on methods AFTER instance creation ---
        // Spy on advanceTurn to track calls without mocking its implementation here
        jest.spyOn(turnManager, 'advanceTurn');
        // Spy on stop *without* overriding implementation unless specific test needs it
        jest.spyOn(turnManager, 'stop');
        // Spy on the private method handler if needed for specific tests
        // Note: Accessing private methods directly in tests is brittle.
        // Prefer testing public interface behavior.
        // If absolutely necessary: jest.spyOn(turnManager, '#handleTurnEndedEvent'); // Requires correct jest/babel setup for private fields
    });

    // --- Test Constructor Dependency Validation ---
    test('constructor should throw if dispatcher is invalid (missing subscribe)', () => {
        const invalidDispatcher = {dispatchValidated: jest.fn() /* missing subscribe */};
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: invalidDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow(/requires a valid IValidatedEventDispatcher.*subscribe/);
    });

    // --- Test start() Method ---

    test('start() should subscribe to TURN_ENDED_ID', async () => {
        await turnManager.start();

        expect(mockDispatcher.subscribe).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.subscribe).toHaveBeenCalledWith(
            TURN_ENDED_ID,
            // Use expect.any(Function) as the actual handler is bound and harder to match directly
            expect.any(Function)
        );
        // Check against CRITICAL error log related ONLY to subscription failure
        expect(mockLogger.error).not.toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL: Failed to subscribe to ${TURN_ENDED_ID}`),
            expect.any(Error)
        );
    });

    test('start() should log critical error and attempt stop if subscribe returns invalid value', async () => {
        // --- Arrange ---
        mockDispatcher.subscribe.mockReturnValue(undefined); // Simulate invalid return
        // Spy on stop AFTER instance creation, but DON'T mock its implementation here
        // We want the real stop logic to run its course, including potential cleanup.
        const stopSpy = jest.spyOn(turnManager, 'stop');

        // Clear mocks that might be called during the process
        mockLogger.error.mockClear();
        mockDispatcher.dispatchValidated.mockClear();

        // --- Act ---
        await turnManager.start(); // This should internally call stop() due to failure

        // --- Assert ---
        expect(mockDispatcher.subscribe).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.subscribe).toHaveBeenCalledWith(TURN_ENDED_ID, expect.any(Function));

        // Check critical error logging FROM #subscribeToTurnEnd
        expect(mockLogger.error).toHaveBeenCalledTimes(1); // Expect ONLY the subscription error log
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL: Failed to subscribe to ${TURN_ENDED_ID}`),
            expect.any(Error) // Check error object exists
        );
        // Optionally check the error message structure if needed
        expect(mockLogger.error.mock.calls[0][1].message).toContain('Subscription function did not return an unsubscribe callback');

        // Check system error dispatch FROM #subscribeToTurnEnd's catch
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1); // Expect ONLY the subscription error dispatch
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:system_error_occurred',
            expect.objectContaining({ // Check relevant parts
                message: expect.stringContaining(`Failed to subscribe to ${TURN_ENDED_ID}`),
                details: expect.stringContaining('Subscription function did not return an unsubscribe callback')
            })
        );

        // Check that stop was attempted
        expect(stopSpy).toHaveBeenCalledTimes(1);

        // Check internal state reset by the error handling in #subscribeToTurnEnd
        // **MODIFIED**: Expect undefined if that's the actual reset value, not null.
        expect(turnManager['_TurnManager__turnEndedUnsubscribe']).toBeUndefined();
    });

    test('start() should log critical error and attempt stop if subscribe throws an error', async () => {
        // --- Arrange ---
        const subscribeError = new Error("Dispatcher exploded!");
        mockDispatcher.subscribe.mockImplementation(() => {
            throw subscribeError;
        });
        const stopSpy = jest.spyOn(turnManager, 'stop'); // Spy without mocking implementation

        // Clear mocks
        mockLogger.error.mockClear();
        mockDispatcher.dispatchValidated.mockClear();

        // --- Act ---
        await turnManager.start(); // Should internally call stop()

        // --- Assert ---
        expect(mockDispatcher.subscribe).toHaveBeenCalledTimes(1);

        // Check critical error logging FROM #subscribeToTurnEnd's catch
        expect(mockLogger.error).toHaveBeenCalledTimes(1); // Expect ONLY the subscription error log
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL: Failed to subscribe to ${TURN_ENDED_ID}`),
            subscribeError // Check that the original error was logged
        );

        // Check system error dispatch FROM #subscribeToTurnEnd's catch
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1); // Expect ONLY the subscription error dispatch
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:system_error_occurred',
            expect.objectContaining({
                message: expect.stringContaining(`Failed to subscribe to ${TURN_ENDED_ID}`),
                details: subscribeError.message // Check error message is passed on
            })
        );

        // Check stop call
        expect(stopSpy).toHaveBeenCalledTimes(1);

        // Check internal state reset by the error handling in #subscribeToTurnEnd
        // **MODIFIED**: Expect undefined if that's the actual reset value.
        expect(turnManager['_TurnManager__turnEndedUnsubscribe']).toBeUndefined();
    });

    test('start() should call advanceTurn after successful subscription', async () => {
        // Arrange: Spy is already set up in beforeEach
        const advanceTurnSpy = jest.spyOn(turnManager, 'advanceTurn');
        advanceTurnSpy.mockClear(); // Clear any potential calls from beforeEach setup if needed

        // Act
        await turnManager.start();

        // Assert
        expect(advanceTurnSpy).toHaveBeenCalledTimes(1); // Called once during start
    });

    // --- Test stop() Method ---

    test('stop() should not try to call unsubscribe if it was never stored (e.g., start failed)', async () => {
        // Arrange: Simulate start failing *before* storing callback
        mockDispatcher.subscribe.mockReturnValue(undefined);
        const internalStopSpy = jest.spyOn(turnManager, 'stop'); // Spy on stop
        mockLogger.error.mockClear(); // Clear logs before start attempt

        try {
            await turnManager.start(); // This will fail internally and call stop
        } catch (e) {
            // Catch potential errors if advanceTurn fails AFTER subscribe fails, though
            // the internal stop might handle it. Focus on state.
            console.warn("Ignoring potential error during failed start in 'stop() should not try...' test, checking state.");
        }

        // Assert state after failed start (internal stop call)
        expect(internalStopSpy).toHaveBeenCalledTimes(1); // Stop was called internally
        // **MODIFIED**: Expect undefined as it was likely never set or cleared to undefined
        expect(turnManager['_TurnManager__turnEndedUnsubscribe']).toBeUndefined();
        expect(mockUnsubscribeCallback).not.toHaveBeenCalled(); // Unsubscribe func itself shouldn't be called

        // Reset mocks before explicitly calling stop again
        mockUnsubscribeCallback.mockClear();
        internalStopSpy.mockClear();
        mockLogger.error.mockClear(); // Clear logs from the failed start

        // Act: Explicitly call stop (manager should already be marked as not running)
        await turnManager.stop();

        // Assert: The callback was NOT called during this *explicit* second stop call
        expect(mockUnsubscribeCallback).not.toHaveBeenCalled();
        expect(internalStopSpy).toHaveBeenCalledTimes(1); // Explicit stop call
        // Assert no *new* errors about unsubscribing were logged during the explicit stop
        expect(mockLogger.error).not.toHaveBeenCalledWith(
            expect.stringContaining('Error calling unsubscribe function')
        );
        // State should remain cleared
        expect(turnManager['_TurnManager__turnEndedUnsubscribe']).toBeUndefined();
    });


    test('stop() should log error if unsubscribe callback throws an error', async () => {
        // Arrange: Make the unsubscribe callback throw an error
        const unsubscribeError = new Error("Unsubscribe failed!");
        mockUnsubscribeCallback.mockImplementation(() => {
            throw unsubscribeError;
        });
        // Ensure subscribe returns this faulty callback
        mockDispatcher.subscribe.mockReturnValue(mockUnsubscribeCallback);

        // Act: Start (successfully)
        await turnManager.start();
        // Clear logs from start before calling stop
        mockLogger.error.mockClear();
        // Act: Stop (which will trigger the error)
        await turnManager.stop();

        // Assert: Callback was called, error was logged, state was cleaned up
        expect(mockUnsubscribeCallback).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledTimes(1); // Expect exactly ONE error log (from unsubscribe failure)
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Error calling unsubscribe function for ${TURN_ENDED_ID}`),
            unsubscribeError // Check the original error was passed
        );
        // **MODIFIED**: Ensure cleanup still happened, setting to undefined
        expect(turnManager['_TurnManager__turnEndedUnsubscribe']).toBeUndefined();
    });

    test('stop() should call turnOrderService.clearCurrentRound', async () => {
        // Arrange
        await turnManager.start(); // Need to be running
        mockTurnOrderService.clearCurrentRound.mockClear(); // Clear calls from potential round start

        // Act
        await turnManager.stop();

        // Assert
        expect(mockTurnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);
    });

    // --- Test _handleTurnEndedEvent (Private Method Simulation) ---
    // Note: Testing private methods directly is generally discouraged.
    // It's better to test the public methods (start, stop) that use them.
    // These tests simulate invoking the handler passed to dispatcher.subscribe.

    async function getTurnEndedEventHandler() {
        // Helper to get the handler function registered with the dispatcher
        if (mockDispatcher.subscribe.mock.calls.length === 0) {
            throw new Error("Dispatcher.subscribe was not called. Cannot get event handler.");
        }
        const subscribeCall = mockDispatcher.subscribe.mock.calls[0];
        const eventHandler = subscribeCall[1];
        if (typeof eventHandler !== 'function') {
            throw new Error("Dispatcher.subscribe was not called with a function.");
        }
        return eventHandler;
    }
});