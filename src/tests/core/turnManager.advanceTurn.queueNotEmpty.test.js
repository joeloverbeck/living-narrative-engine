// src/tests/core/turnManager.advanceTurn.queueNotEmpty.test.js
// --- FILE START (Entire file content as requested, with corrections) ---

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import TurnManager from '../../core/turns/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../types/components.js';

// --- Mock Dependencies ---
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

const mockDispatcher = {
    dispatch: jest.fn(),
    dispatchValidated: jest.fn().mockResolvedValue(true),
    subscribe: jest.fn(), // <<< ADDED
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

const mockTurnHandler = {
    constructor: {name: 'MockTurnHandler'},
    startTurn: jest.fn().mockResolvedValue(undefined), // <<< CHANGED from handleTurn
    destroy: jest.fn().mockResolvedValue(undefined),   // <<< ADDED destroy
};

const mockTurnHandlerResolver = {
    resolveHandler: jest.fn().mockResolvedValue(mockTurnHandler),
};

// Mock Entity class minimally
const createMockEntity = (id, isActor = true, isPlayer = false) => ({
    id: id,
    hasComponent: jest.fn((componentId) => {
        if (componentId === ACTOR_COMPONENT_ID) return isActor;
        if (componentId === PLAYER_COMPONENT_ID) return isPlayer;
        return false;
    }),
});

// --- Test Suite ---

describe('TurnManager: advanceTurn() - Turn Advancement (Queue Not Empty)', () => {
    let instance;
    let stopSpy;
    let initialAdvanceTurnSpy;
    let turnEndedUnsubscribeMock = jest.fn();

    beforeEach(async () => { // Made beforeEach async
        jest.clearAllMocks();

        // Reset mock state
        mockEntityManager.activeEntities = new Map();
        mockTurnOrderService.isEmpty.mockReset().mockResolvedValue(false); // Default: Queue NOT empty
        mockTurnOrderService.getNextEntity.mockReset().mockResolvedValue(null); // Default reset
        mockTurnOrderService.clearCurrentRound.mockReset().mockResolvedValue();
        mockDispatcher.dispatchValidated.mockReset().mockResolvedValue(true);
        mockDispatcher.subscribe.mockReset().mockReturnValue(turnEndedUnsubscribeMock);
        turnEndedUnsubscribeMock.mockClear();

        mockTurnHandlerResolver.resolveHandler.mockClear().mockResolvedValue(mockTurnHandler);
        mockTurnHandler.startTurn.mockClear().mockResolvedValue(undefined);
        mockTurnHandler.destroy.mockClear().mockResolvedValue(undefined);


        instance = new TurnManager({
            logger: mockLogger,
            dispatcher: mockDispatcher,
            entityManager: mockEntityManager,
            turnOrderService: mockTurnOrderService,
            turnHandlerResolver: mockTurnHandlerResolver
        });

        // Spy on stop to verify calls and simulate unsubscribe
        stopSpy = jest.spyOn(instance, 'stop').mockImplementation(async () => {
            mockLogger.debug('Mocked instance.stop() called.');
            // Simulate internal state changes of stop for testing purposes if needed
            // instance._TurnManager_isRunning = false;
            // instance._TurnManager_currentActor = null;
            // Simulate calling the unsubscribe function
            if (typeof turnEndedUnsubscribeMock === 'function') { // <<< Check if it's a function
                turnEndedUnsubscribeMock();
            }
        });

        // --- Set instance to running state (simulating start()) ---
        initialAdvanceTurnSpy = jest.spyOn(instance, 'advanceTurn').mockImplementationOnce(async () => {
            // Prevent advanceTurn logic during start()
            mockLogger.debug('advanceTurn call during start() suppressed by mock.');
        });
        await instance.start(); // Sets #isRunning = true and subscribes
        initialAdvanceTurnSpy.mockRestore(); // Restore advanceTurn for actual testing

        // Clear mocks called during start() phase
        mockLogger.info.mockClear(); // Clear "Turn Manager started." log
        mockLogger.debug.mockClear(); // Clear suppressed advanceTurn log
        mockDispatcher.dispatchValidated.mockClear();
        mockDispatcher.subscribe.mockClear(); // Clear the subscribe call from start()
        mockTurnOrderService.isEmpty.mockClear(); // Clear mocks before actual test calls
        mockTurnOrderService.getNextEntity.mockClear();
        mockTurnHandlerResolver.resolveHandler.mockClear();

        // Re-apply default isEmpty mock for the actual tests focusing on queue NOT empty
        mockTurnOrderService.isEmpty.mockResolvedValue(false);
    });

    afterEach(async () => { // Make afterEach async if stop is async
        // Ensure stop is called if instance exists and has the spy
        // This helps clean up the state potentially modified by start()
        if (instance && stopSpy && !stopSpy.mock.calls.length) {
            // If stop wasn't called by a test, call it for cleanup
            // await instance.stop(); // Call the actual stop or the spy
        }
        // Restore all mocks ensures spies are handled correctly
        jest.restoreAllMocks();
        instance = null;
    });


    // --- Test Cases ---

    test('Successfully getting next entity: updates current actor, resolves and calls handler startTurn', async () => {
        // Arrange
        const nextActor = createMockEntity('actor-next', true, false); // AI actor
        const entityType = 'ai';
        mockTurnOrderService.getNextEntity.mockResolvedValue(nextActor);
        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler);

        // Act
        await instance.advanceTurn(); // Call directly, instance is running

        // Assert
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);

        // Verify state update and logging
        expect(instance.getCurrentActor()).toBe(nextActor);
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() initiating...');
        expect(mockLogger.debug).toHaveBeenCalledWith('Queue not empty, retrieving next entity.');
        expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn initiation for Entity: ${nextActor.id} (${entityType}) <<<`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`Resolving turn handler for entity ${nextActor.id}...`);

        // Check core:turn_started dispatch
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', {
            entityId: nextActor.id,
            entityType: entityType
        });

        // Verify resolver call
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledTimes(1);
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(nextActor);

        expect(mockLogger.debug).toHaveBeenCalledWith(`Calling startTurn on ${mockTurnHandler.constructor.name} for entity ${nextActor.id}`);
        expect(mockTurnHandler.startTurn).toHaveBeenCalledTimes(1);
        expect(mockTurnHandler.startTurn).toHaveBeenCalledWith(nextActor);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`TurnManager now WAITING for 'core:turn_ended' event.`)); // Check "waiting" log

        expect(stopSpy).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('getNextEntity() returns null/undefined unexpectedly: logs error, dispatches message, stops manager', async () => {
        // Arrange
        mockTurnOrderService.getNextEntity.mockResolvedValue(null); // Simulate unexpected null
        const expectedErrorMsg = 'Turn order inconsistency: getNextEntity() returned null/undefined when queue was not empty.';

        // Act
        await instance.advanceTurn();

        // Assert
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);

        // Verify error handling
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);

        // Check dispatch event and payload
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:system_error_occurred',
            {
                message: 'Internal Error: Turn order inconsistency detected. Stopping game.',
                type: 'error',
                details: expectedErrorMsg
            }
        );

        expect(stopSpy).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith('Mocked instance.stop() called.');
        // Check unsubscribe happens via stop spy:
        // Note: Checking turnEndedUnsubscribeMock directly might fail if stop() logic changes.
        // Relying on the stopSpy being called is generally sufficient.
        // If needed, add: expect(turnEndedUnsubscribeMock).toHaveBeenCalledTimes(1);

        expect(instance.getCurrentActor()).toBeNull();

        // Check that handler logic was NOT reached
        expect(mockTurnHandlerResolver.resolveHandler).not.toHaveBeenCalled();
        expect(mockTurnHandler.startTurn).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('>>> Starting turn'));
    });

    // --- MODIFIED TEST ---
    test('getNextEntity() throws an error: handles error internally, logs, dispatches, stops manager', async () => {
        // Arrange
        const thrownError = new Error("Database connection lost");
        mockTurnOrderService.getNextEntity.mockRejectedValue(thrownError); // Simulate async error

        // Act & Assert - Expect the promise to resolve because the error is caught internally
        await expect(instance.advanceTurn()).resolves.toBeUndefined();

        // Verify that TurnManager's *internal* error handling WAS triggered
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL Error during turn advancement logic (before handler initiation): ${thrownError.message}`),
            thrownError // Check that the original error object was logged
        );
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:system_error_occurred',
            expect.objectContaining({
                message: 'System Error during turn advancement. Stopping game.',
                type: 'error',
                details: thrownError.message
            })
        );
        expect(stopSpy).toHaveBeenCalledTimes(1); // Stop *was* called internally

        // Verify state after stop
        expect(mockLogger.debug).toHaveBeenCalledWith('Mocked instance.stop() called.');
        expect(instance.getCurrentActor()).toBeNull(); // Actor wasn't assigned or was cleared by stop

        // Check that handler logic was NOT reached
        expect(mockTurnHandlerResolver.resolveHandler).not.toHaveBeenCalled();
        expect(mockTurnHandler.startTurn).not.toHaveBeenCalled();
    });
    // --- END MODIFIED TEST ---


    test('Handles non-actor entity returned by getNextEntity: proceeds to resolve handler and call startTurn', async () => {
        // Arrange
        const nonActorEntity = createMockEntity('scenery-item', false); // NOT an actor
        const entityType = 'ai'; // It defaults to 'ai' if not player
        mockTurnOrderService.getNextEntity.mockResolvedValue(nonActorEntity);
        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler);

        // Act
        await instance.advanceTurn();

        // Assert
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        expect(instance.getCurrentActor()).toBe(nonActorEntity); // Current actor is set

        // Verify it logs the start initiation
        expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn initiation for Entity: ${nonActorEntity.id} (${entityType}) <<<`);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', {
            entityId: nonActorEntity.id,
            entityType: entityType
        });

        // Verify it proceeds to resolve handler
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledTimes(1);
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(nonActorEntity);

        expect(mockLogger.debug).toHaveBeenCalledWith(`Calling startTurn on ${mockTurnHandler.constructor.name} for entity ${nonActorEntity.id}`);
        expect(mockTurnHandler.startTurn).toHaveBeenCalledTimes(1);
        expect(mockTurnHandler.startTurn).toHaveBeenCalledWith(nonActorEntity);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`TurnManager now WAITING for 'core:turn_ended' event.`));

        expect(stopSpy).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('non-actor entity')); // No specific warning currently exists
    });

});
// --- FILE END ---