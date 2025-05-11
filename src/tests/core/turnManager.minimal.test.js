// src/tests/core/turnManager.minimal.test.js
// --- FILE START (Entire file content as requested) ---

import {beforeEach, describe, expect, jest, test, afterEach} from '@jest/globals'; // Added afterEach
import TurnManager from '../../core/turns/turnManager.js';
import {TURN_ENDED_ID} from "../../core/constants/eventIds.js";

// Absolute minimal mocks (ensure they satisfy constructor checks)
const mockLogger = {debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()};
const mockTurnOrderService = {
    isEmpty: jest.fn(),
    clearCurrentRound: jest.fn(),
    startNewRound: jest.fn(), // Added as it's called in advanceTurn
    getNextEntity: jest.fn()  // Added as it's called in advanceTurn
};
const mockEntityManager = {
    getEntityInstance: jest.fn(), // For constructor validation
    activeEntities: new Map()      // Keep this property
};
// Added mock subscribe method to satisfy TurnManager constructor validation
const mockDispatcher = {
    dispatchValidated: jest.fn(),
    subscribe: jest.fn(() => jest.fn()) // subscribe should return an unsubscribe function
};

// Changed 'resolve' to 'resolveHandler' to match the TurnManager constructor's expectation
const mockTurnHandlerResolver = {resolveHandler: jest.fn()};


describe('TurnManager Minimal Test', () => {
    let instance;
    let stopSpy; // Add spy based on the expected code path

    beforeEach(() => {
        jest.clearAllMocks(); // Important

        // Reset the mock property if tests might modify it
        mockEntityManager.activeEntities = new Map();

        // Provide all required mocks, including the updated dispatcher
        instance = new TurnManager({
            logger: mockLogger,
            dispatcher: mockDispatcher, // Pass the dispatcher with both methods
            entityManager: mockEntityManager,
            turnOrderService: mockTurnOrderService,
            turnHandlerResolver: mockTurnHandlerResolver
        });

        // --- FIX START ---
        // Spy on the 'stop' method WITHOUT replacing its implementation
        // This allows us to track calls while letting the original logic (including unsubscribe) run.
        stopSpy = jest.spyOn(instance, 'stop');
        // REMOVED: stopSpy.mockImplementation(...)
        // --- FIX END ---


        // --- REMOVED redundant mock setup ---
        // The mock is already defined to return jest.fn(), no need to set it again here.
        // REMOVED: mockDispatcher.subscribe.mockReturnValue(jest.fn());
    });

    // Add afterEach to restore spies
    afterEach(() => {
        if (stopSpy) stopSpy.mockRestore();
        instance = null; // Help garbage collection
    });


    test('start() should call isEmpty and handle empty activeEntities when queue is empty', async () => { // More descriptive name
        // Arrange: Mock dependencies needed by the advanceTurn call inside start
        mockTurnOrderService.isEmpty.mockResolvedValueOnce(true); // Simulate empty queue
        // activeEntities is already an empty Map via beforeEach

        // --- Get the mock unsubscribe function BEFORE calling start ---
        // We define the mock function that subscribe *will* return
        const mockUnsubscribeFn = jest.fn();
        mockDispatcher.subscribe.mockReturnValueOnce(mockUnsubscribeFn);

        // Act: Call start(), which should set #isRunning and call advanceTurn
        await instance.start();

        // Assert
        // Check logs/calls from both start() and advanceTurn()
        expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.'); // From start()
        expect(mockDispatcher.subscribe).toHaveBeenCalledWith(TURN_ENDED_ID, expect.any(Function)); // From start() -> #subscribeToTurnEnd
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() initiating...'); // From advanceTurn()

        // Check isEmpty was called
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);

        // Assertions for the "No Actors Found" path that follows:
        expect(mockLogger.info).toHaveBeenCalledWith('Turn queue is empty. Attempting to start a new round.');
        // Check that activeEntities was accessed (implicitly successful if no TypeError)
        expect(mockLogger.error).toHaveBeenCalledWith('Cannot start a new round: No active entities with an Actor component found.');

        // Check the system error dispatch
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:system_error_occurred', // Correct event name
            {
                message: 'System Error: No active actors found to start a round. Stopping game.', // Correct message
                type: 'error',                                                                    // Correct type
                details: 'Cannot start a new round: No active entities with an Actor component found.' // Correct details
            }
        );

        // Check stop was called (original implementation now runs)
        expect(stopSpy).toHaveBeenCalledTimes(1);

        // --- FIX: Check the specific mock function we told subscribe to return ---
        // Check unsubscribe was called within stop() -> #unsubscribeFromTurnEnd
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
        // REMOVED: const mockUnsubscribe = mockDispatcher.subscribe.mock.results[0].value;
        // REMOVED: expect(mockUnsubscribe).toHaveBeenCalledTimes(1);


        // Optional: Verify the 'not running' log was NOT called
        expect(mockLogger.debug).not.toHaveBeenCalledWith(
            expect.stringContaining('TurnManager.advanceTurn() called while manager is not running') // Adjusted text slightly based on previous run
        );
        // Optional: Verify start() didn't warn about already running
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining('already running')
        );
    });

    // Keep the test for the not-running case
    test('advanceTurn() should log "not running" if start() was not called', async () => {
        // Arrange - No arrangement needed, instance is not started

        // Act
        await instance.advanceTurn(); // Call advanceTurn directly

        // Assert
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('TurnManager.advanceTurn() called while manager is not running') // More specific check
        );
        expect(mockTurnOrderService.isEmpty).not.toHaveBeenCalled();
        expect(stopSpy).not.toHaveBeenCalled(); // stop should not be called here
        expect(mockDispatcher.subscribe).not.toHaveBeenCalled(); // subscribe is only called in start()
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled(); // No events dispatched when not running
    });
});
// --- FILE END ---