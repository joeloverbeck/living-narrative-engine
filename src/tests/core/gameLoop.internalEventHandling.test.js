// src/tests/core/gameLoop.internalEventHandling.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import GameLoop from '../../core/GameLoop.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from "../../types/components.js";
// REMOVED: import { CORE_EVENTS } from '../../core/eventBus.js'; // Removed incorrect import

// --- Mock Dependencies ---
const mockEventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
};
const mockGameStateManager = {
    getPlayer: jest.fn(),
    getCurrentLocation: jest.fn(),
    setPlayer: jest.fn(),
    setCurrentLocation: jest.fn()
};
const mockGameDataRepository = {};
const mockEntityManager = {
    activeEntities: new Map()
};
const mockActionExecutor = {
    executeAction: jest.fn(),
};
const mockActionDiscoverySystem = {
    getValidActions: jest.fn().mockResolvedValue([]),
};
const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
const mockvalidatedEventDispatcher = {
    dispatchValidated: jest.fn(),
};
const mockTurnManager = {
    start: jest.fn(),
    stop: jest.fn(),
    getCurrentActor: jest.fn().mockReturnValue(null), // Default mock
    advanceTurn: jest.fn(),
    isEmpty: jest.fn().mockReturnValue(true),
    startNewRound: jest.fn(),
    clearCurrentRound: jest.fn(),
};
const mockTurnHandlerResolver = {
    resolveHandler: jest.fn()
};
const mockTurnHandler = {
    handleTurn: jest.fn()
};


// Mock entities
const mockPlayer = {
    id: 'player1',
    name: 'Tester',
    getComponent: jest.fn(),
    hasComponent: jest.fn((componentId) =>
        componentId === PLAYER_COMPONENT_ID || componentId === ACTOR_COMPONENT_ID
    )
};
const mockNpc = {
    id: 'npc1',
    name: 'Goblin',
    getComponent: jest.fn(),
    hasComponent: jest.fn((componentId) => componentId === ACTOR_COMPONENT_ID)
};
const mockLocation = {id: 'room:test', name: 'Test Chamber', getComponent: jest.fn()};

// Helper Function (Corrected)
const createValidOptions = () => ({
    gameDataRepository: mockGameDataRepository,
    entityManager: mockEntityManager,
    gameStateManager: mockGameStateManager,
    actionExecutor: mockActionExecutor,
    eventBus: mockEventBus,
    actionDiscoverySystem: mockActionDiscoverySystem,
    validatedEventDispatcher: mockvalidatedEventDispatcher,
    turnManager: mockTurnManager,
    turnHandlerResolver: mockTurnHandlerResolver,
    logger: mockLogger,
});


// --- Test Suite ---
describe('GameLoop', () => {
    let gameLoop = null;

    // --- Top Level Setup ---
    beforeEach(() => {
        jest.clearAllMocks();

        // --- Reset mocks to default states ---
        mockGameStateManager.getPlayer.mockReturnValue(null);
        mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
        mockActionExecutor.executeAction.mockResolvedValue({success: true, messages: []});
        mockTurnManager.start.mockResolvedValue();
        mockTurnManager.stop.mockResolvedValue();
        mockTurnManager.getCurrentActor.mockReturnValue(null); // Reset to null
        mockTurnManager.advanceTurn.mockResolvedValue();
        mockTurnManager.isEmpty.mockReturnValue(true);
        mockPlayer.hasComponent.mockImplementation((id) => id === PLAYER_COMPONENT_ID || id === ACTOR_COMPONENT_ID);
        mockNpc.hasComponent.mockImplementation((id) => id === ACTOR_COMPONENT_ID);
        mockActionDiscoverySystem.getValidActions.mockResolvedValue([]);
        mockEntityManager.activeEntities = new Map();
        mockTurnHandlerResolver.resolveHandler.mockReturnValue(null);
        mockTurnHandler.handleTurn.mockResolvedValue();
    });

    // General cleanup
    afterEach(async () => {
        if (gameLoop && gameLoop.isRunning) {
            await gameLoop.stop();
        }
        gameLoop = null;
    });

    // ***** START: Tests for 'turn:actor_changed' Event Trigger *****
    describe("Internal Event Handling ('turn:actor_changed')", () => { // Updated describe title

        // Helper to get the subscribed handler function
        const getSubscribedHandler = (eventName) => {
            const call = mockEventBus.subscribe.mock.calls.find(
                (callArgs) => callArgs[0] === eventName
            );
            return call ? call[1] : null;
        };

        it('should resolve and delegate to the turn handler when one is found', async () => {
            // Arrange
            const options = createValidOptions();
            gameLoop = new GameLoop(options);
            await gameLoop.start(); // Start the loop to set up subscriptions
            gameLoop._test_setRunning(true); // Force running state if start doesn't guarantee it before event

            const actor = mockNpc;
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler); // Ensure async resolution is handled
            mockTurnManager.getCurrentActor.mockReturnValue(actor); // Ensure TurnManager returns the actor when asked inside handler

            const eventName = 'turn:actor_changed'; // Use string literal
            const handleTurnActorChanged = getSubscribedHandler(eventName);
            expect(handleTurnActorChanged).toBeInstanceOf(Function); // Verify we found the handler

            // Act
            await handleTurnActorChanged({currentActor: actor, previousActor: null}); // Simulate event emission

            // Assert
            // 1. Test Handler Resolution
            expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledTimes(1);
            expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(actor);

            // 2. Test Handler Delegation
            expect(mockTurnHandler.handleTurn).toHaveBeenCalledTimes(1);
            expect(mockTurnHandler.handleTurn).toHaveBeenCalledWith(actor);

            // 3. Test TurnManager interaction
            expect(mockTurnManager.advanceTurn).not.toHaveBeenCalled();
        });

        it('should advance the turn via TurnManager if no handler is resolved', async () => {
            // Arrange
            const options = createValidOptions();
            gameLoop = new GameLoop(options);
            await gameLoop.start();
            gameLoop._test_setRunning(true);

            const actor = mockNpc;
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(null); // No handler found (async)
            mockTurnManager.getCurrentActor.mockReturnValue(actor);

            const eventName = 'turn:actor_changed'; // Use string literal
            const handleTurnActorChanged = getSubscribedHandler(eventName);
            expect(handleTurnActorChanged).toBeInstanceOf(Function);

            // Act
            await handleTurnActorChanged({currentActor: actor, previousActor: null});

            // Assert
            // 1. Test Handler Resolution Attempt
            expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledTimes(1);
            expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(actor);

            // 2. Test Handler Delegation (should not happen)
            expect(mockTurnHandler.handleTurn).not.toHaveBeenCalled();

            // 3. Test TurnManager interaction (should be called as fallback)
            expect(mockTurnManager.advanceTurn).toHaveBeenCalledTimes(1);
        });

        it('should log an error and advance turn if handler delegation fails', async () => {
            // Arrange
            const options = createValidOptions();
            gameLoop = new GameLoop(options);
            await gameLoop.start();
            gameLoop._test_setRunning(true);

            const actor = mockNpc;
            const handlerError = new Error('Handler failed');
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler);
            mockTurnHandler.handleTurn.mockRejectedValue(handlerError); // Simulate handler failure
            mockTurnManager.getCurrentActor.mockReturnValue(actor);

            const eventName = 'turn:actor_changed'; // Use string literal
            const handleTurnActorChanged = getSubscribedHandler(eventName);
            expect(handleTurnActorChanged).toBeInstanceOf(Function);

            // Act
            await handleTurnActorChanged({currentActor: actor, previousActor: null});

            // Assert
            // 1. Resolution and Delegation Attempt
            expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledTimes(1);
            expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(actor);
            expect(mockTurnHandler.handleTurn).toHaveBeenCalledTimes(1);
            expect(mockTurnHandler.handleTurn).toHaveBeenCalledWith(actor);

            // 2. Error Logging
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Error during delegated turn handling for ${actor.id}`),
                handlerError
            );

            // 3. TurnManager interaction (should advance turn on error)
            expect(mockTurnManager.advanceTurn).toHaveBeenCalledTimes(1);
        });

        it("should subscribe to 'turn:actor_changed' on start", async () => { // Updated test title
            // Arrange
            const options = createValidOptions();
            gameLoop = new GameLoop(options);
            const eventName = 'turn:actor_changed'; // Use string literal

            // Act
            await gameLoop.start();

            // Assert
            expect(mockEventBus.subscribe).toHaveBeenCalledWith(
                eventName, // Use string literal
                expect.any(Function)
            );
            // Ensure the handler we found is actually stored
            const handler = getSubscribedHandler(eventName);
            expect(handler).toBeInstanceOf(Function);
        });

        it("should unsubscribe from 'turn:actor_changed' on stop", async () => { // Updated test title
            // Arrange
            const options = createValidOptions();
            gameLoop = new GameLoop(options);
            const eventName = 'turn:actor_changed'; // Use string literal
            await gameLoop.start(); // Start to subscribe
            const handler = getSubscribedHandler(eventName); // Get the specific handler instance

            // Act
            await gameLoop.stop();

            // Assert
            expect(mockEventBus.unsubscribe).toHaveBeenCalledWith(
                eventName, // Use string literal
                handler // Check that the specific handler function instance was unsubscribed
            );
        });

    });
    // ***** END: Tests for 'turn:actor_changed' Event Trigger *****


    // Placeholder test
    it('should have other tests for remaining internal event handlers (e.g., turn manager stopped)', () => {
        expect(true).toBe(true);
        // TODO: Add tests for #handleTurnManagerStopped if needed ('turn:manager_stopped')
    });


}); // End describe GameLoop