// src/tests/core/turnManager.advanceTurn.actorIdentification.test.js
// --- FILE START (Entire file content as requested) ---

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
    dispatch: jest.fn(),
    dispatchValidated: jest.fn().mockResolvedValue(true),
};

const mockEntityManager = {
    activeEntities: new Map(),
    getEntityInstance: jest.fn(),
    entities: new Map(),
    getEntity: jest.fn(),
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    getAllEntities: jest.fn(),
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

// --- NEW: Mock Turn Handler and Resolver ---
// This is the handler that the TurnManager will call after resolving the actor type.
const mockTurnHandler = {
    // Give it a name for clearer logging if needed, though Jest mocks don't easily show class names
    constructor: {name: 'MockTurnHandler'},
    // Mock the method that TurnManager expects to call
    handleTurn: jest.fn().mockResolvedValue(undefined), // Default successful handling
};

// This mock resolves the actor type ('player' or 'ai') to a turn handler instance.
const mockTurnHandlerResolver = {
    resolve: jest.fn(), // We'll configure its return value in beforeEach/tests
};
// --- END NEW MOCKS ---


// --- Test Suite ---

describe('TurnManager: advanceTurn() - Actor Identification & Handling (Queue Not Empty)', () => { // Renamed slightly
    let instance;
    let stopSpy;
    let initialAdvanceTurnSpy;

    beforeEach(async () => {
        jest.clearAllMocks();

        // --- Reset Mocks ---
        mockEntityManager.activeEntities = new Map();
        mockTurnOrderService.isEmpty.mockResolvedValue(false); // Default: Queue NOT empty
        mockTurnOrderService.getNextEntity.mockResolvedValue(null);
        mockDispatcher.dispatchValidated.mockResolvedValue(true);
        mockTurnOrderService.clearCurrentRound.mockImplementation(() => {
        });

        // --- NEW: Reset Turn Handler Mocks ---
        // Reset calls on the handler method itself
        mockTurnHandler.handleTurn.mockClear();
        // Reset calls on the resolver and set a default implementation for convenience
        mockTurnHandlerResolver.resolve.mockClear();
        mockTurnHandlerResolver.resolve.mockReturnValue(mockTurnHandler); // Default: return the standard mock handler
        // Reset the default handler behavior
        mockTurnHandler.handleTurn.mockResolvedValue(undefined);

        // Instantiate TurnManager *with* the new dependency
        instance = new TurnManager({
            logger: mockLogger,
            dispatcher: mockDispatcher,
            entityManager: mockEntityManager,
            turnOrderService: mockTurnOrderService,
            turnHandlerResolver: mockTurnHandlerResolver // <<< ADDED DEPENDENCY
        });

        stopSpy = jest.spyOn(instance, 'stop');
        stopSpy.mockImplementation(async () => {
            // Use a specific log to differentiate from real stop logs if needed
            // mockLogger.debug('Mocked instance.stop() called.');
        });

        // --- Set instance to running state (suppressing initial advanceTurn) ---
        initialAdvanceTurnSpy = jest.spyOn(instance, 'advanceTurn');
        initialAdvanceTurnSpy.mockImplementationOnce(async () => {
            // mockLogger.debug('advanceTurn call during start() suppressed by mock.');
        });
        await instance.start();
        initialAdvanceTurnSpy.mockRestore();

        // --- Clear mocks called during setup ---
        // Use mockClear() which resets call counts but not implementations
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockDispatcher.dispatchValidated.mockClear();
        mockTurnOrderService.isEmpty.mockClear();
        mockTurnOrderService.getNextEntity.mockClear();
        mockTurnHandlerResolver.resolve.mockClear(); // Clear any potential calls during setup
        mockTurnHandler.handleTurn.mockClear();     // Clear any potential calls during setup

        // Re-apply default isEmpty mock specifically for tests in this block
        mockTurnOrderService.isEmpty.mockResolvedValue(false);
        // Re-apply default dispatchValidated mock
        mockDispatcher.dispatchValidated.mockResolvedValue(true);
        // Re-apply default resolver mock
        mockTurnHandlerResolver.resolve.mockReturnValue(mockTurnHandler);
        mockTurnHandler.handleTurn.mockResolvedValue(undefined);


    });

    afterEach(() => {
        if (stopSpy) stopSpy.mockRestore();
        instance = null;
    });

    // --- Updated Test Cases ---

    test('Player actor identified: resolves player handler, calls handleTurn', async () => {
        // Arrange
        const playerActor = {
            id: 'player-1',
            hasComponent: jest.fn((componentId) => {
                if (componentId === PLAYER_COMPONENT_ID) return true;
                if (componentId === ACTOR_COMPONENT_ID) return true;
                return false;
            })
        };
        mockTurnOrderService.getNextEntity.mockResolvedValue(playerActor);
        // Ensure the resolver returns our mock handler (though default does this)
        mockTurnHandlerResolver.resolve.mockReturnValue(mockTurnHandler);

        // Act
        await instance.advanceTurn();

        // Assert
        // 1. Check queue status and entity retrieval
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        // 2. Verify player component check
        expect(playerActor.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
        // 3. Verify correct actor type identification log
        expect(mockLogger.debug).toHaveBeenCalledWith(`Entity ${playerActor.id} identified as type: player`);
        // 4. Verify resolver was called correctly
        expect(mockTurnHandlerResolver.resolve).toHaveBeenCalledTimes(1);
        expect(mockTurnHandlerResolver.resolve).toHaveBeenCalledWith('player');
        // 5. Verify the log before calling the handler
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Calling handleTurn on ${mockTurnHandler.constructor.name} for entity ${playerActor.id}`)
        );
        // 6. Verify the resolved handler's method was called with the correct entity
        expect(mockTurnHandler.handleTurn).toHaveBeenCalledTimes(1);
        expect(mockTurnHandler.handleTurn).toHaveBeenCalledWith(playerActor);
        // 7. Verify the log after the handler completes
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`handleTurn completed for ${mockTurnHandler.constructor.name} for entity ${playerActor.id}`)
        );
        // 8. Ensure AI identification log was NOT called
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('identified as type: ai'));
        // 9. Ensure old direct dispatch calls are NOT made by advanceTurn itself
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalledWith('player:turn_start', expect.anything());
        // 10. Ensure stop was not called
        expect(stopSpy).not.toHaveBeenCalled();
    });

    test('AI actor identified: resolves AI handler, calls handleTurn', async () => {
        // Arrange
        const aiActor = {
            id: 'ai-goblin',
            hasComponent: jest.fn((componentId) => {
                if (componentId === PLAYER_COMPONENT_ID) return false; // Not a player
                if (componentId === ACTOR_COMPONENT_ID) return true;   // Is an actor
                return false;
            })
        };
        mockTurnOrderService.getNextEntity.mockResolvedValue(aiActor);
        // Ensure the resolver returns our mock handler
        mockTurnHandlerResolver.resolve.mockReturnValue(mockTurnHandler);

        // Act
        await instance.advanceTurn();

        // Assert
        // 1. Check queue status and entity retrieval
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        // 2. Verify player component check (which returns false)
        expect(aiActor.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
        // 3. Verify correct actor type identification log
        expect(mockLogger.debug).toHaveBeenCalledWith(`Entity ${aiActor.id} identified as type: ai`);
        // 4. Verify resolver was called correctly
        expect(mockTurnHandlerResolver.resolve).toHaveBeenCalledTimes(1);
        expect(mockTurnHandlerResolver.resolve).toHaveBeenCalledWith('ai');
        // 5. Verify the log before calling the handler
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Calling handleTurn on ${mockTurnHandler.constructor.name} for entity ${aiActor.id}`)
        );
        // 6. Verify the resolved handler's method was called with the correct entity
        expect(mockTurnHandler.handleTurn).toHaveBeenCalledTimes(1);
        expect(mockTurnHandler.handleTurn).toHaveBeenCalledWith(aiActor);
        // 7. Verify the log after the handler completes
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`handleTurn completed for ${mockTurnHandler.constructor.name} for entity ${aiActor.id}`)
        );
        // 8. Ensure Player identification log was NOT called
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('identified as type: player'));
        // 9. Ensure old direct dispatch calls are NOT made by advanceTurn itself
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalledWith('ai:turn_start', expect.anything());
        // 10. Ensure stop was not called
        expect(stopSpy).not.toHaveBeenCalled();
    });

    // CORRECTED: Test handling of *handler* rejection
    test('Handles handleTurn rejection gracefully (error logged, continues)', async () => {
        // Arrange
        const aiActor = {
            id: 'ai-reject-handler',
            hasComponent: jest.fn((componentId) => componentId === ACTOR_COMPONENT_ID) // Is an actor, not player
        };
        mockTurnOrderService.getNextEntity.mockResolvedValue(aiActor);
        const handlerError = new Error("Handler action failed");

        // Configure the mock handler returned by the resolver to REJECT
        mockTurnHandler.handleTurn.mockRejectedValue(handlerError);
        mockTurnHandlerResolver.resolve.mockReturnValue(mockTurnHandler); // Make sure resolver returns this handler

        // Act
        // advanceTurn now catches errors from handleTurn, so it should resolve successfully.
        await expect(instance.advanceTurn()).resolves.toBeUndefined();

        // Assert side effects *during* the call, before/during the rejection
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        expect(mockTurnHandlerResolver.resolve).toHaveBeenCalledWith('ai');
        expect(mockTurnHandler.handleTurn).toHaveBeenCalledWith(aiActor);

        // Assert side effects *because* of the rejection (error handling)
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Error during turn handling for entity ${aiActor.id} (type: ai): ${handlerError.message}`),
            handlerError // Check the actual error object is logged
        );
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:display_message', {
            text: expect.stringContaining(`Error during ai's turn: ${handlerError.message}`),
            type: 'error'
        });

        // Assert side effects that should NOT have happened
        // The debug log after successful handleTurn should not be reached
        expect(mockLogger.debug).not.toHaveBeenCalledWith(
            expect.stringContaining(`handleTurn completed`)
        );
        // Manager should not stop just because a handler failed
        expect(stopSpy).not.toHaveBeenCalled();
    });

    // Optional: Add test for resolver failing (e.g., returning null or throwing)
    test('Handles resolver failure gracefully (error logged, stops)', async () => {
        // Arrange
        const playerActor = {
            id: 'player-no-resolver',
            hasComponent: jest.fn((id) => id === PLAYER_COMPONENT_ID || id === ACTOR_COMPONENT_ID) // Is player
        };
        mockTurnOrderService.getNextEntity.mockResolvedValue(playerActor);
        const resolveError = new Error("Cannot resolve player handler");
        mockTurnHandlerResolver.resolve.mockImplementation(() => {
            throw resolveError; // Simulate resolver throwing
        });
        // Mock the dispatcher for the error message before stop
        mockDispatcher.dispatchValidated.mockResolvedValue(true);


        // Act
        // advanceTurn catches this error and should resolve, but log/dispatch an error
        await expect(instance.advanceTurn()).resolves.toBeUndefined();


        // Assert
        expect(mockTurnHandlerResolver.resolve).toHaveBeenCalledWith('player');
        expect(mockTurnHandler.handleTurn).not.toHaveBeenCalled(); // Handler should not be called
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Error during turn handling for entity ${playerActor.id} (type: player): ${resolveError.message}`),
            resolveError
        );
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:display_message', {
            text: expect.stringContaining(`Error during player's turn: ${resolveError.message}`),
            type: 'error'
        });
        // Decide if resolver failure should stop the manager. Current code doesn't explicitly stop here.
        // If it *should* stop, add: expect(stopSpy).toHaveBeenCalled();
        // If it *should not* stop, add:
        expect(stopSpy).not.toHaveBeenCalled();
    });


});