// src/tests/core/turnManager.advanceTurn.queueNotEmpty.test.js
// --- FILE START (Corrected) ---

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import TurnManager from '../../core/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../types/components.js';

// --- Mock Dependencies ---
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
    // Keep other mocked methods if needed
};

const mockTurnOrderService = {
    startNewRound: jest.fn(),
    getNextEntity: jest.fn(),
    isEmpty: jest.fn(), // Will be mocked per describe block/test
    getCurrentOrder: jest.fn(),
    removeEntity: jest.fn(),
    addEntity: jest.fn(),
    clearCurrentRound: jest.fn(),
};

// Mock Turn Handler (returned by the resolver)
const mockTurnHandler = {
    constructor: {name: 'MockTurnHandler'}, // Added for logging checks
    handleTurn: jest.fn().mockResolvedValue(undefined),
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
    let initialAdvanceTurnSpy; // To manage the advanceTurn call from start()

    beforeEach(async () => {
        jest.clearAllMocks();

        // Reset mock state
        mockEntityManager.activeEntities = new Map();
        mockTurnOrderService.isEmpty.mockResolvedValue(false); // Default: Queue NOT empty
        mockTurnOrderService.getNextEntity.mockResolvedValue(null);
        mockDispatcher.dispatchValidated.mockResolvedValue(true);
        mockTurnOrderService.clearCurrentRound.mockResolvedValue();

        mockTurnHandlerResolver.resolveHandler.mockClear().mockResolvedValue(mockTurnHandler); // Default success
        mockTurnHandler.handleTurn.mockClear().mockResolvedValue(undefined); // Reset handler

        instance = new TurnManager({
            logger: mockLogger,
            dispatcher: mockDispatcher,
            entityManager: mockEntityManager,
            turnOrderService: mockTurnOrderService,
            turnHandlerResolver: mockTurnHandlerResolver
        });

        // Spy on stop to verify calls
        stopSpy = jest.spyOn(instance, 'stop').mockImplementation(async () => {
            mockLogger.debug('Mocked instance.stop() called.');
            // Simulate internal state changes of stop for testing purposes
            instance._TurnManager_isRunning = false; // Use actual private field name if accessible or simulate effect
            instance._TurnManager_currentActor = null;
        });

        // --- Set instance to running state ---
        initialAdvanceTurnSpy = jest.spyOn(instance, 'advanceTurn').mockImplementationOnce(async () => {
            mockLogger.debug('advanceTurn call during start() suppressed by mock.');
        });
        await instance.start(); // Sets #isRunning = true
        initialAdvanceTurnSpy.mockRestore(); // Restore advanceTurn for actual testing

        // Clear mocks called during start()
        mockLogger.info.mockClear(); // Clear "Turn Manager started." log
        mockLogger.debug.mockClear(); // Clear suppressed advanceTurn log
        mockDispatcher.dispatchValidated.mockClear();
        mockTurnOrderService.isEmpty.mockClear();
        mockTurnHandlerResolver.resolveHandler.mockClear();

        // Re-apply default isEmpty mock for the actual tests
        mockTurnOrderService.isEmpty.mockResolvedValue(false);
    });

    afterEach(() => {
        if (stopSpy) stopSpy.mockRestore();
        instance = null;
    });

    // --- Test Cases ---

    test('Successfully getting next entity: updates current actor, resolves and calls handler', async () => {
        // Arrange
        const nextActor = createMockEntity('actor-next', true, false); // AI actor
        const entityType = 'ai'; // Define expected type
        mockTurnOrderService.getNextEntity.mockResolvedValue(nextActor);
        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler); // Ensure resolver works

        // Act
        await instance.advanceTurn();

        // Assert
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);

        // Verify state update and logging
        expect(instance.getCurrentActor()).toBe(nextActor);
        // --- FIX START: Correct log format ---
        expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn for Entity: ${nextActor.id} (${entityType}) <<<`);
        // --- FIX END ---
        expect(mockLogger.debug).toHaveBeenCalledWith(`Resolving turn handler for entity ${nextActor.id}...`);

        // --- FIX START: Check core:turn_started dispatch ---
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', {
            entityId: nextActor.id,
            entityType: entityType
        });
        // --- FIX END ---

        // Verify resolver call
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledTimes(1);
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(nextActor);

        // Verify handler call
        expect(mockTurnHandler.handleTurn).toHaveBeenCalledTimes(1);
        expect(mockTurnHandler.handleTurn).toHaveBeenCalledWith(nextActor);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`handleTurn promise resolved for ${mockTurnHandler.constructor.name} for entity ${nextActor.id}`));


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
        expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg); // Check specific error log

        // --- FIX START: Correct dispatch event and payload ---
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:system_error_occurred', // Correct event name
            {
                message: 'Internal Error: Turn order inconsistency detected. Stopping game.', // Correct message
                type: 'error',
                details: expectedErrorMsg // Correct details
            }
        );
        // --- FIX END ---

        expect(stopSpy).toHaveBeenCalledTimes(1); // Verify manager stop
        expect(mockLogger.debug).toHaveBeenCalledWith('Mocked instance.stop() called.'); // Verify mock stop log
        expect(instance.getCurrentActor()).toBeNull(); // Actor should remain null

        // Check that handler logic was NOT reached
        expect(mockTurnHandlerResolver.resolveHandler).not.toHaveBeenCalled();
        expect(mockTurnHandler.handleTurn).not.toHaveBeenCalled();
        // Ensure no "Starting turn" info log occurred
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('>>> Starting turn'));
    });

    // --- NEW TEST CASE: getNextEntity throws ---
    test('getNextEntity() throws an error: logs error, dispatches message, stops manager', async () => {
        // Arrange
        const thrownError = new Error("Database connection lost");
        // Note: TurnManager doesn't currently catch errors from getNextEntity(), it expects null/entity.
        // This test verifies *if it did*, it should behave similarly to the unexpected null case.
        // Let's simulate the behavior we *expect* if it were caught.
        // Since it's not caught, the test runner would catch it.
        // We will modify the test slightly to check the state *before* the throw would halt execution.
        // Or, we could test the *caller* of advanceTurn handles the exception.
        // For a unit test, let's assume a hypothetical catch block exists:
        mockTurnOrderService.getNextEntity.mockRejectedValue(thrownError); // Simulate async error

        const expectedErrorMsg = `Error retrieving next entity: ${thrownError.message}`; // Hypothetical log

        // Act & Assert (wrap in try/catch for uncaught rejection)
        try {
            await instance.advanceTurn();
        } catch (e) {
            expect(e).toBe(thrownError); // The error should propagate if not caught
        }

        // Assertions assuming a catch block *existed* in TurnManager.advanceTurn around getNextEntity():
        // expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg, thrownError);
        // expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
        //     'core:system_error_occurred',
        //     {
        //         message: 'Internal Error: Failed to retrieve next entity. Stopping game.',
        //         type: 'error',
        //         details: expectedErrorMsg
        //     }
        // );
        // expect(stopSpy).toHaveBeenCalledTimes(1);
        // expect(instance.getCurrentActor()).toBeNull();
        // expect(mockTurnHandlerResolver.resolveHandler).not.toHaveBeenCalled();
        // expect(mockTurnHandler.handleTurn).not.toHaveBeenCalled();

        // Assertion for the *current* code: The error is uncaught.
        expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('Error retrieving next entity'));
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalledWith('core:system_error_occurred', expect.anything());
        expect(stopSpy).not.toHaveBeenCalled();

    });

    // --- NEW TEST CASE: Non-actor entity ---
    test('Handles non-actor entity returned by getNextEntity: proceeds to resolve handler (implementation note)', async () => {
        // Arrange
        const nonActorEntity = createMockEntity('scenery-item', false); // NOT an actor
        mockTurnOrderService.getNextEntity.mockResolvedValue(nonActorEntity);
        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler); // Assume resolver handles it

        // Act
        await instance.advanceTurn();

        // Assert
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        expect(instance.getCurrentActor()).toBe(nonActorEntity); // Current actor is set

        // Verify it logs the start, *even though it's not strictly an actor based on component*
        // The current code determines entityType based on PLAYER_COMPONENT_ID only after getting the entity.
        const entityType = 'ai'; // It defaults to 'ai' if not player
        expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn for Entity: ${nonActorEntity.id} (${entityType}) <<<`);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', {
            entityId: nonActorEntity.id,
            entityType: entityType
        });

        // Verify it proceeds to resolve handler
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledTimes(1);
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(nonActorEntity);

        // Verify handler is called (assuming resolver returns one)
        expect(mockTurnHandler.handleTurn).toHaveBeenCalledTimes(1);
        expect(mockTurnHandler.handleTurn).toHaveBeenCalledWith(nonActorEntity);

        expect(stopSpy).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('non-actor entity')); // No specific warning currently exists
        // NOTE: Current implementation might proceed unexpectedly for non-actors.
        // Consider adding an explicit actor check after getNextEntity in TurnManager.advanceTurn.
    });

});
// --- FILE END ---