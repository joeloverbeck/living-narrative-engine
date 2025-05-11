// src/tests/core/turnManager.advanceTurn.roundStart.test.js
// --- FILE START (Entire file content as requested, with corrections) ---

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import TurnManager from '../../core/turns/turnManager.js';
import {ACTOR_COMPONENT_ID} from '../../types/components.js';

// Mocks for dependencies
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

const mockDispatcher = {
    dispatch: jest.fn(),
    dispatchValidated: jest.fn().mockResolvedValue(true),
    subscribe: jest.fn(),
};

const mockEntityManager = {
    activeEntities: new Map(),
    getEntityInstance: jest.fn(),
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

// Mock Entity class minimally
const mockEntity = (id, isActor) => ({
    id: id,
    hasComponent: jest.fn((componentId) => componentId === ACTOR_COMPONENT_ID ? isActor : false),
});

describe('TurnManager: advanceTurn() - Round Start (Queue Empty)', () => {
    let instance;
    let stopSpy;
    let advanceTurnSpy; // General spy for advanceTurn
    let turnEndedUnsubscribeMock = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset mock state
        mockEntityManager.activeEntities = new Map();
        mockTurnOrderService.isEmpty.mockReset();
        mockTurnOrderService.startNewRound.mockReset().mockResolvedValue(undefined);
        mockTurnOrderService.clearCurrentRound.mockReset().mockResolvedValue(undefined);
        mockDispatcher.dispatchValidated.mockReset().mockResolvedValue(true);
        mockDispatcher.subscribe.mockReset().mockReturnValue(turnEndedUnsubscribeMock);
        mockTurnHandlerResolver.resolveHandler.mockReset().mockResolvedValue(null);
        turnEndedUnsubscribeMock.mockClear();


        instance = new TurnManager({
            logger: mockLogger,
            dispatcher: mockDispatcher,
            entityManager: mockEntityManager,
            turnOrderService: mockTurnOrderService,
            turnHandlerResolver: mockTurnHandlerResolver
        });

        // Define the spy here for the actual advanceTurn method
        advanceTurnSpy = jest.spyOn(instance, 'advanceTurn');

        // Spy on stop - Keep the condition to ensure start was called.
        stopSpy = jest.spyOn(instance, 'stop').mockImplementation(async () => {
            mockLogger.debug('Mocked instance.stop() called.');
            // Check if start() was successfully logged before stop was invoked.
            const started = mockLogger.info.mock.calls.some(call => call[0] === 'Turn Manager started.');
            mockLogger.debug(`Stop spy: Was manager started? ${started}`);
            if (started) {
                mockLogger.debug('Stop spy: Calling turnEndedUnsubscribeMock');
                turnEndedUnsubscribeMock();
            } else {
                mockLogger.debug('Stop spy: Not calling turnEndedUnsubscribeMock (manager start log not found)');
            }
            // Minimal stop actions for spy - the real stop is more complex
            instance._TurnManager_isRunning = false; // Simulate stop effect if needed by other tests
        });

        // Clear constructor/setup logs AFTER instantiation and spy setup
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
    });

    afterEach(() => {
        // Restore all mocks ensures spies are handled correctly
        jest.restoreAllMocks();
        instance = null;
    });

    // --- Test Cases ---

    test('advanceTurn() does nothing with a debug log if not running', async () => {
        // Arrange: #isRunning is false by default
        // Act: Call advanceTurn directly
        await instance.advanceTurn();

        // Assert
        expect(mockLogger.debug).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'TurnManager.advanceTurn() called while manager is not running. Returning.'
        );
        expect(mockTurnOrderService.isEmpty).not.toHaveBeenCalled();
        expect(stopSpy).not.toHaveBeenCalled();
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
        expect(mockDispatcher.subscribe).not.toHaveBeenCalled(); // subscribe happens in start()
        expect(turnEndedUnsubscribeMock).not.toHaveBeenCalled();
    });


    test('No active actors found: logs error, dispatches message, and stops', async () => {
        // Arrange
        const nonActorEntity = mockEntity('nonActor1', false);
        mockEntityManager.activeEntities.set('nonActor1', nonActorEntity);
        mockTurnOrderService.isEmpty.mockResolvedValueOnce(true); // Queue is empty for the check inside advanceTurn
        const expectedErrorMsg = 'Cannot start a new round: No active entities with an Actor component found.';

        // Mock the advanceTurn called by start() *just* to prevent interference IF NEEDED,
        // but often better to let start call the real advanceTurn and track calls.
        // Let's try letting start() call the real advanceTurn.
        // advanceTurnSpy.mockImplementationOnce(async () => {
        //     mockLogger.debug('advanceTurn called by start() - allowing real execution');
        //     advanceTurnSpy.mockRestore(); // Restore for subsequent calls
        //     await instance.advanceTurn();
        //     advanceTurnSpy = jest.spyOn(instance, 'advanceTurn'); // Re-spy
        // });


        // Act (Part 1): Start the manager to set #isRunning = true. This WILL call advanceTurn itself.
        // The test setup (no actors) means this first advanceTurn call will fail.
        await instance.start(); // This calls advanceTurn once.

        // Assert (on the results of the advanceTurn call triggered by start)
        expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.'); // Log from start()
        expect(mockDispatcher.subscribe).toHaveBeenCalledTimes(1); // Ensure subscription happened in start()
        expect(advanceTurnSpy).toHaveBeenCalledTimes(1); // The call from start()

        // Check logs from the advanceTurn call triggered by start()
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() initiating...');
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1); // Should be called now
        expect(mockLogger.info).toHaveBeenCalledWith('Turn queue is empty. Attempting to start a new round.');
        expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg); // Error logged

        // Check dispatch and stop from the advanceTurn call
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:system_error_occurred',
            {
                message: 'System Error: No active actors found to start a round. Stopping game.',
                type: 'error',
                details: expectedErrorMsg
            }
        );

        expect(stopSpy).toHaveBeenCalledTimes(1); // stop() called by the advanceTurn call
        expect(mockLogger.debug).toHaveBeenCalledWith('Mocked instance.stop() called.');
        expect(turnEndedUnsubscribeMock).toHaveBeenCalledTimes(1); // Unsubscribe SHOULD be called by stop spy because start() was logged
    });

    test('No active actors found (empty map): logs error, dispatches message, and stops', async () => {
        // Arrange
        mockEntityManager.activeEntities = new Map(); // Explicitly empty map
        mockTurnOrderService.isEmpty.mockResolvedValueOnce(true);
        const expectedErrorMsg = 'Cannot start a new round: No active entities with an Actor component found.';

        // Act: Start the manager, which will immediately call advanceTurn and fail
        await instance.start();

        // Assert (on the results of the advanceTurn call triggered by start)
        expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.');
        expect(advanceTurnSpy).toHaveBeenCalledTimes(1); // Call from start()

        // Check logs from the advanceTurn call triggered by start()
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() initiating...');
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith('Turn queue is empty. Attempting to start a new round.');
        expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);

        // Check dispatch and stop from the advanceTurn call
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:system_error_occurred',
            {
                message: 'System Error: No active actors found to start a round. Stopping game.',
                type: 'error',
                details: expectedErrorMsg
            }
        );

        expect(stopSpy).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith('Mocked instance.stop() called.');
        expect(turnEndedUnsubscribeMock).toHaveBeenCalledTimes(1); // Unsubscribe called by stop spy
    });

    test('Actors found, successful round start: logs info, calls startNewRound, and recurses', async () => {
        // Arrange
        const actor1 = mockEntity('actor1', true);
        const actor2 = mockEntity('actor2', true);
        const nonActor = mockEntity('nonActor', false);
        mockEntityManager.activeEntities.set('actor1', actor1);
        mockEntityManager.activeEntities.set('nonActor', nonActor);
        mockEntityManager.activeEntities.set('actor2', actor2);

        // Setup mocks for the *first* call to advanceTurn (triggered by start)
        mockTurnOrderService.isEmpty.mockResolvedValueOnce(true); // Queue is empty initially
        mockTurnOrderService.startNewRound.mockResolvedValueOnce(undefined); // Success

        // The *second* call to advanceTurn (recursive) will find the queue NOT empty.
        // Let's assume getNextEntity works for this test's purpose. We'll mock it to return actor1.
        // We also need to resolve a handler for actor1 to prevent that path from erroring.
        mockTurnOrderService.isEmpty.mockResolvedValueOnce(false); // For the second call
        mockTurnOrderService.getNextEntity.mockResolvedValueOnce(actor1);
        // Mock a basic handler - the test focus is round start, not turn execution
        const mockHandler = {startTurn: jest.fn().mockResolvedValue(undefined), destroy: jest.fn()};
        mockTurnHandlerResolver.resolveHandler.mockResolvedValueOnce(mockHandler);


        // Act: Call start(), which triggers the first advanceTurn, which should succeed, start a round, and recurse.
        await instance.start();

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.');
        // Expect two calls: 1 from start(), 1 from successful round start recursion
        expect(advanceTurnSpy).toHaveBeenCalledTimes(2);

        // --- Assertions for the FIRST advanceTurn call ---
        // It finds the queue empty...
        expect(mockLogger.info).toHaveBeenCalledWith('Turn queue is empty. Attempting to start a new round.');
        // It finds actors... (Check presence and count)
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringMatching(/Found 2 actors to start the round: (actor1, actor2|actor2, actor1)/)
        );
        // It calls startNewRound...
        expect(mockTurnOrderService.startNewRound).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith(
            expect.arrayContaining([actor1, actor2]),
            'round-robin' // Assuming default strategy
        );
        expect(mockTurnOrderService.startNewRound.mock.calls[0][0]).toHaveLength(2); // Ensure only actors passed
        // It logs success...
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`Successfully started a new round with 2 actors using the 'round-robin' strategy.`)
        );
        // It logs the intent to recurse...
        expect(mockLogger.debug).toHaveBeenCalledWith('New round started, recursively calling advanceTurn() to process the first turn.');


        // --- Assertions for the SECOND advanceTurn call (the recursion) ---
        // It finds the queue NOT empty... (isEmpty was mocked to return false for the second call)
        expect(mockLogger.debug).toHaveBeenCalledWith('Queue not empty, retrieving next entity.'); // Log from second call
        // It gets the next entity...
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        // It logs turn start...
        expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn initiation for Entity: ${actor1.id} (ai) <<<`); // Assuming actor1 is AI
        // It dispatches turn started...
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', {
            entityId: actor1.id,
            entityType: 'ai'
        }); // Assuming AI
        // It resolves the handler...
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledTimes(1);
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(actor1);
        // It calls startTurn on the handler...
        expect(mockHandler.startTurn).toHaveBeenCalledTimes(1);
        expect(mockHandler.startTurn).toHaveBeenCalledWith(actor1);
        // It logs waiting for the turn end event
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`TurnManager now WAITING for 'core:turn_ended' event.`));


        // Ensure stop was NOT called and no system errors dispatched
        expect(stopSpy).not.toHaveBeenCalled();
        // Dispatch validated *was* called for core:turn_started, so check count or filter
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', expect.anything());
        // Ensure no system error dispatches
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalledWith('core:system_error_occurred', expect.anything());


    });


    test('Error during startNewRound: logs error, dispatches message, and stops', async () => {
        // Arrange
        const actor1 = mockEntity('actor1', true);
        mockEntityManager.activeEntities.set('actor1', actor1);
        const startRoundError = new Error('Queue init failed'); // The specific error message

        // Set mocks for the advanceTurn execution path that fails
        mockTurnOrderService.isEmpty.mockResolvedValueOnce(true); // Tries to start round
        mockTurnOrderService.startNewRound.mockRejectedValueOnce(startRoundError); // startNewRound fails

        // Act: Start the manager, which will call advanceTurn and encounter the error
        await instance.start();

        // Assert logs/calls from the direct advanceTurn call triggered by start()
        expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.'); // From start()
        expect(advanceTurnSpy).toHaveBeenCalledTimes(1); // The call from start()

        expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() initiating...');
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1); // Called in the advanceTurn call
        expect(mockLogger.info).toHaveBeenCalledWith('Turn queue is empty. Attempting to start a new round.');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found 1 actors to start the round: ${actor1.id}`));
        expect(mockTurnOrderService.startNewRound).toHaveBeenCalledTimes(1); // Attempted

        // Check the specific error logging from the CATCH block in advanceTurn
        const expectedLogMsg = `CRITICAL Error during turn advancement logic (before handler initiation): ${startRoundError.message}`;
        expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg, startRoundError);

        // Check the dispatch from the CATCH block - verify details field correctness
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:system_error_occurred',
            {
                message: 'System Error during turn advancement. Stopping game.',
                type: 'error',
                details: startRoundError.message // <<< CORRECTED: Expect the original error message
            }
        );

        // Check stop was called from the CATCH block
        expect(stopSpy).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith('Mocked instance.stop() called.');
        expect(turnEndedUnsubscribeMock).toHaveBeenCalledTimes(1); // Unsubscribe called because start() was logged

        expect(mockTurnHandlerResolver.resolveHandler).not.toHaveBeenCalled(); // Fails before handler resolution
    });

});
// --- FILE END ---