// src/tests/core/turnManager.minimal.test.js

import {beforeEach, describe, expect, jest, test, afterEach} from '@jest/globals'; // Added afterEach
import TurnManager from '../../core/turnManager.js';

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
const mockDispatcher = {dispatchValidated: jest.fn()}; // Need dispatchValidated for constructor
const mockTurnHandlerResolver = {resolve: jest.fn()}; // <<< ADDED: Minimal mock for the required dependency

describe('TurnManager Minimal Test', () => {
    let instance;
    let stopSpy; // Add spy based on the expected code path

    beforeEach(() => {
        jest.clearAllMocks(); // Important

        // Reset the mock property if tests might modify it
        mockEntityManager.activeEntities = new Map();

        instance = new TurnManager({
            logger: mockLogger,
            dispatcher: mockDispatcher,
            entityManager: mockEntityManager,
            turnOrderService: mockTurnOrderService,
            turnHandlerResolver: mockTurnHandlerResolver // <<< ADDED: Pass the mock dependency
        });

        // Add stopSpy setup since the 'no actors' path calls stop
        stopSpy = jest.spyOn(instance, 'stop');
        stopSpy.mockImplementation(async () => {
            // Minimal mock implementation - just track calls
            mockLogger.debug('Mocked instance.stop() called.');
        });
    });

    // Add afterEach to restore spies
    afterEach(() => {
        if (stopSpy) stopSpy.mockRestore();
        instance = null;
    });


    test('start() should call isEmpty and handle empty activeEntities when queue is empty', async () => { // More descriptive name
        // Arrange: Mock dependencies needed by the advanceTurn call inside start
        mockTurnOrderService.isEmpty.mockResolvedValueOnce(true); // Simulate empty queue
        // activeEntities is already an empty Map via beforeEach

        // Act: Call start(), which should set #isRunning and call advanceTurn
        await instance.start();

        // Assert
        // Check logs/calls from both start() and advanceTurn()
        expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.'); // From start()
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() called.'); // From advanceTurn()

        // THE KEY ASSERTION: Should pass now
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);

        // Assertions for the "No Actors Found" path that follows:
        expect(mockLogger.info).toHaveBeenCalledWith('Turn queue is empty. Attempting to start a new round.');
        // Check that activeEntities was accessed (implicitly successful if no TypeError)
        expect(mockLogger.error).toHaveBeenCalledWith('Cannot start a new round: No active entities with an Actor component found.');
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'textUI:display_message', {text: expect.stringContaining('No active actors'), type: 'error'}
        );
        // Check stop was called
        expect(stopSpy).toHaveBeenCalledTimes(1);


        // Optional: Verify the 'not running' log was NOT called
        expect(mockLogger.debug).not.toHaveBeenCalledWith(
            expect.stringContaining('not running')
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
            expect.stringContaining('not running')
        );
        expect(mockTurnOrderService.isEmpty).not.toHaveBeenCalled();
        expect(stopSpy).not.toHaveBeenCalled(); // stop should not be called here
    });
});