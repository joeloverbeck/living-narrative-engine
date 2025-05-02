// src/tests/core/turnManager.advanceTurn.roundStart.test.js
// --- FILE START (Corrected) ---

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import TurnManager from '../../core/turnManager.js';
import {ACTOR_COMPONENT_ID} from '../../types/components.js';

// Mocks for dependencies
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

const mockDispatcher = {
    dispatch: jest.fn(), // Keep if used elsewhere
    dispatchValidated: jest.fn().mockResolvedValue(true), // Default success
};

const mockEntityManager = {
    activeEntities: new Map(),
    getEntityInstance: jest.fn(), // Checked by constructor
    // Keep other mocked methods if needed by TurnManager directly
};

const mockTurnOrderService = {
    startNewRound: jest.fn(),
    getNextEntity: jest.fn(),
    isEmpty: jest.fn(),
    getCurrentOrder: jest.fn(),
    removeEntity: jest.fn(),
    addEntity: jest.fn(),
    clearCurrentRound: jest.fn(),
};

const mockTurnHandlerResolver = {
    resolveHandler: jest.fn(),
};
// --- END FIXED ---

// Mock Entity class minimally
const mockEntity = (id, isActor) => ({
    id: id,
    hasComponent: jest.fn((componentId) => componentId === ACTOR_COMPONENT_ID ? isActor : false),
});

describe('TurnManager: advanceTurn() - Round Start (Queue Empty)', () => {
    let instance;
    let stopSpy;

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset mock state
        mockEntityManager.activeEntities = new Map(); // Reset entities map
        mockTurnOrderService.isEmpty.mockReset(); // Reset specific mock states if needed
        mockTurnOrderService.startNewRound.mockReset().mockResolvedValue(undefined); // Default success
        mockTurnOrderService.clearCurrentRound.mockReset().mockResolvedValue(undefined); // Default success
        mockDispatcher.dispatchValidated.mockReset().mockResolvedValue(true); // Default success
        mockTurnHandlerResolver.resolveHandler.mockReset();
        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(null); // Default mock implementation


        instance = new TurnManager({
            logger: mockLogger,
            dispatcher: mockDispatcher,
            entityManager: mockEntityManager,
            turnOrderService: mockTurnOrderService,
            turnHandlerResolver: mockTurnHandlerResolver
        });

        // Spy on stop, ensuring it's fresh for each test
        stopSpy = jest.spyOn(instance, 'stop');
        stopSpy.mockImplementation(async () => {
            mockLogger.debug('Mocked instance.stop() called.');
        });

        // Clear constructor logs
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
    });

    afterEach(() => {
        if (stopSpy) stopSpy.mockRestore();
        instance = null;
    });

    // --- Test Cases ---

    test('advanceTurn() does nothing with a debug log if not running', async () => {
        // Arrange: instance #isRunning is false by default

        // Act
        await instance.advanceTurn();

        // Assert
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('advanceTurn() called while manager is not running')
        );
        expect(mockTurnOrderService.isEmpty).not.toHaveBeenCalled();
        expect(stopSpy).not.toHaveBeenCalled();
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled(); // Ensure no events dispatched
    });

    test('No active actors found: logs error, dispatches message, and stops', async () => {
        // Arrange
        const nonActorEntity = mockEntity('nonActor1', false);
        mockEntityManager.activeEntities.set('nonActor1', nonActorEntity);
        mockTurnOrderService.isEmpty.mockResolvedValueOnce(true); // Queue is empty
        const expectedErrorMsg = 'Cannot start a new round: No active entities with an Actor component found.';

        // Act: Call start() which calls advanceTurn()
        await instance.start();

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.'); // From start()
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() called.'); // From advanceTurn()
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg); // Check error log

        // --- FIX START: Correct dispatch event and payload ---
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:system_error_occurred', // Correct event name
            {
                message: 'System Error: No active actors found to start a round. Stopping game.', // Correct message
                type: 'error',
                details: expectedErrorMsg // Correct details
            }
        );
        // --- FIX END ---

        expect(stopSpy).toHaveBeenCalledTimes(1); // stop() should have been called
        expect(mockLogger.debug).toHaveBeenCalledWith('Mocked instance.stop() called.'); // Check stop log
    });

    test('No active actors found (empty map): logs error, dispatches message, and stops', async () => {
        // Arrange
        mockEntityManager.activeEntities = new Map(); // Explicitly empty map
        mockTurnOrderService.isEmpty.mockResolvedValueOnce(true);
        const expectedErrorMsg = 'Cannot start a new round: No active entities with an Actor component found.';


        // Act: Call start()
        await instance.start();

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.');
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() called.');
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg); // Check error log

        // --- FIX START: Correct dispatch event and payload ---
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:system_error_occurred', // Correct event name
            {
                message: 'System Error: No active actors found to start a round. Stopping game.', // Correct message
                type: 'error',
                details: expectedErrorMsg // Correct details
            }
        );
        // --- FIX END ---

        expect(stopSpy).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith('Mocked instance.stop() called.');
    });

    test('Actors found, successful round start: logs info, calls startNewRound, and recurses', async () => {
        // Arrange
        const actor1 = mockEntity('actor1', true);
        const actor2 = mockEntity('actor2', true);
        const nonActor = mockEntity('nonActor', false);
        mockEntityManager.activeEntities.set('actor1', actor1);
        mockEntityManager.activeEntities.set('nonActor', nonActor);
        mockEntityManager.activeEntities.set('actor2', actor2);

        mockTurnOrderService.startNewRound.mockResolvedValue(undefined); // Success
        mockTurnOrderService.isEmpty.mockResolvedValueOnce(true); // Empty on first check

        // Spy on advanceTurn BEFORE calling start
        const advanceTurnSpy = jest.spyOn(instance, 'advanceTurn');
        let callCount = 0;
        advanceTurnSpy.mockImplementation(async () => {
            callCount++;
            mockLogger.debug(`advanceTurn spy called (call #${callCount})`);
            if (callCount === 1) {
                // First call triggered by start(), execute original logic
                await Reflect.apply(TurnManager.prototype.advanceTurn, instance, []);
            } else if (callCount === 2) {
                // Second call is the recursion, mock it to prevent infinite loop
                mockLogger.debug(`Mocked advanceTurn call #${callCount} to prevent infinite loop`);
                // Simulate the recursive call would have found the queue NOT empty now
                mockTurnOrderService.isEmpty.mockResolvedValueOnce(false); // Setup for potential next check if logic ran
                mockTurnOrderService.getNextEntity.mockResolvedValueOnce(actor1); // Simulate it would get the next entity
                mockTurnHandlerResolver.resolveHandler.mockResolvedValueOnce({ handleTurn: jest.fn() }); // Simulate resolver would find a handler
            }
        });

        // Act: Call start(), which triggers the first advanceTurn call
        await instance.start();

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.');
        // Check logs/calls from the FIRST (real) advanceTurn execution
        expect(mockLogger.debug).toHaveBeenCalledWith('advanceTurn spy called (call #1)');
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() called.');
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1); // Only the first call's check happens in the real execution
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringMatching(/Found 2 actors to start the round: (actor1, actor2|actor2, actor1)/) // Handle map iteration order
        );
        expect(mockTurnOrderService.startNewRound).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith(
            expect.arrayContaining([actor1, actor2]), // Order depends on Map iteration, check content
            'round-robin'
        );
        expect(mockTurnOrderService.startNewRound.mock.calls[0][0]).toHaveLength(2); // Ensure exactly 2 actors passed

        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`Successfully started a new round with 2 actors using the 'round-robin' strategy.`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith('New round started, recursively calling advanceTurn() to process the first turn.');

        // Check the SPY was called twice (once by start, once by recursion which was caught)
        expect(advanceTurnSpy).toHaveBeenCalledTimes(2);
        expect(mockLogger.debug).toHaveBeenCalledWith('advanceTurn spy called (call #2)');
        expect(mockLogger.debug).toHaveBeenCalledWith('Mocked advanceTurn call #2 to prevent infinite loop');

        expect(stopSpy).not.toHaveBeenCalled();
        expect(mockTurnHandlerResolver.resolveHandler).not.toHaveBeenCalled(); // Resolver not called in first advanceTurn, mocked in second
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled(); // No error events dispatched

        advanceTurnSpy.mockRestore(); // Restore original method
    });

    test('Error during startNewRound: logs error, dispatches message, and stops', async () => {
        // Arrange
        const actor1 = mockEntity('actor1', true);
        mockEntityManager.activeEntities.set('actor1', actor1);
        const queueError = new Error('Queue init failed');
        mockTurnOrderService.startNewRound.mockRejectedValueOnce(queueError);
        mockTurnOrderService.isEmpty.mockResolvedValueOnce(true);
        const expectedErrorMsg = `Error starting new round: ${queueError.message}`;

        // Act: Call start()
        await instance.start();

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.');
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() called.');
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found 1 actors to start the round: ${actor1.id}`));
        expect(mockTurnOrderService.startNewRound).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg, queueError); // Check specific error log

        // --- FIX START: Correct dispatch event and payload ---
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:system_error_occurred', // Correct event name
            {
                message: `System Error: Failed to start a new round. Stopping game.`, // Correct message
                type: 'error',
                details: expectedErrorMsg // Correct details
            }
        );
        // --- FIX END ---

        expect(stopSpy).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith('Mocked instance.stop() called.');
        expect(mockTurnHandlerResolver.resolveHandler).not.toHaveBeenCalled();
    });
});
// --- FILE END ---