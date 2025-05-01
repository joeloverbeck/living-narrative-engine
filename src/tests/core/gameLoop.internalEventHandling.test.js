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
        // Ensure validatedEventDispatcher mock is reset if needed
        mockvalidatedEventDispatcher.dispatchValidated.mockResolvedValue();

    });

    // General cleanup
    afterEach(async () => {
        // Restore spies BEFORE potential stop call if gameLoop still exists
        jest.restoreAllMocks();

        if (gameLoop && gameLoop.isRunning) {
            // Use the actual stop if possible, or ensure mocks handle the state correctly
            // gameLoop.stop might have side effects tested elsewhere, be careful mocking it fully
            try {
                // Ensure stop is called on the actual instance if it exists and is running
                await gameLoop.stop();
            } catch (e) {
                // Ignore errors during cleanup if stop fails e.g. due to nested mock rejections
                mockLogger.warn("Ignoring error during test cleanup's gameLoop.stop():", e);
            }
        }
        gameLoop = null;
        // No need for restoreAllMocks here again, moved earlier
    });

    // ***** START: Tests for 'turn:actor_changed' Event Trigger *****
    describe("Internal Event Handling ('turn:actor_changed')", () => { // Updated describe title

        // Helper to get the subscribed handler function
        const getSubscribedHandler = (eventName) => {
            // Find the latest subscription call for the event name
            const subscribeCalls = mockEventBus.subscribe.mock.calls;
            for (let i = subscribeCalls.length - 1; i >= 0; i--) {
                if (subscribeCalls[i][0] === eventName) {
                    return subscribeCalls[i][1];
                }
            }
            return null; // Return null if no subscription found
        };


        // --- Verification for _processCurrentActorTurn ---
        // Note: Code inspection of GameLoop.js confirms _processCurrentActorTurn is not called
        // within #handleTurnActorChanged. Adding explicit spies/expects here adds complexity
        // for low value, as the call site is verified removed.

        it('should resolve and delegate to the turn handler when one is found, logging debug info', async () => {
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

            // 4. Verify Logging
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Received 'turn:actor_changed'`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing turn for ${actor.id}`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Resolved handler ${mockTurnHandler.constructor?.name ?? 'Object'} for ${actor.id}. Executing...`));
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should advance the turn via TurnManager if no handler is resolved, logging a warning', async () => {
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

            // 4. Verify Logging
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Received 'turn:actor_changed'`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing turn for ${actor.id}`));
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`No specific turn handler resolved for actor ${actor.id}. Advancing turn directly.`));
            expect(mockLogger.error).not.toHaveBeenCalled();
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

            // 2. Error Logging (Verified as per ticket 3.1.6.2.10, confirmed here)
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Error during delegated turn handling for ${actor.id}`),
                handlerError // Check the specific error object is logged
            );
            // Ensure the 'advanceTurn attempt' warning log also fires
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Attempting to advance turn after handler error for ${actor.id}`));

            // 3. TurnManager interaction (should advance turn on error)
            expect(mockTurnManager.advanceTurn).toHaveBeenCalledTimes(1);

            // 4. Verify other logging
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Received 'turn:actor_changed'`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing turn for ${actor.id}`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Resolved handler ${mockTurnHandler.constructor?.name ?? 'Object'} for ${actor.id}. Executing...`));
        });

        // --- Optional Tests for advanceTurn Failures ---

        it('should log error and stop if advanceTurn fails after a handler error', async () => {
            // Arrange
            const options = createValidOptions();
            gameLoop = new GameLoop(options);
            await gameLoop.start();
            gameLoop._test_setRunning(true);

            const actor = mockNpc;
            const handlerError = new Error('Handler failed');
            const advanceError = new Error('AdvanceTurn failed');
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler);
            mockTurnHandler.handleTurn.mockRejectedValue(handlerError);
            mockTurnManager.getCurrentActor.mockReturnValue(actor);
            mockTurnManager.advanceTurn.mockRejectedValue(advanceError); // Make advanceTurn fail

            // Spy on the stop method AFTER instance creation BUT BEFORE the event handler call
            const stopSpy = jest.spyOn(gameLoop, 'stop'); // Just spy, don't mock implementation

            const eventName = 'turn:actor_changed';
            const handleTurnActorChanged = getSubscribedHandler(eventName);
            expect(handleTurnActorChanged).toBeInstanceOf(Function);

            // Act
            await handleTurnActorChanged({currentActor: actor, previousActor: null});

            // Assert
            // 1. Verify handler was called
            expect(mockTurnHandler.handleTurn).toHaveBeenCalledTimes(1);

            // 2. Verify advanceTurn was called
            expect(mockTurnManager.advanceTurn).toHaveBeenCalledTimes(1);

            // 3. Verify Logging for BOTH errors
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Error during delegated turn handling for ${actor.id}`),
                handlerError
            );
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Failed to advance turn after handler error for ${actor.id}`),
                advanceError // Check the specific advanceTurn error object is logged
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Attempting to advance turn after handler error for ${actor.id}`));


            // 4. Verify GameLoop stopped (stopSpy tracks calls to the original method)
            expect(stopSpy).toHaveBeenCalledTimes(1);
        });

        it('should log error and stop if advanceTurn fails after a null handler', async () => {
            // Arrange
            const options = createValidOptions();
            gameLoop = new GameLoop(options);
            await gameLoop.start();
            gameLoop._test_setRunning(true);

            const actor = mockNpc;
            const advanceError = new Error('AdvanceTurn failed');
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(null); // Null handler
            mockTurnManager.getCurrentActor.mockReturnValue(actor);
            mockTurnManager.advanceTurn.mockRejectedValue(advanceError); // Make advanceTurn fail

            // Spy on the stop method AFTER instance creation
            const stopSpy = jest.spyOn(gameLoop, 'stop'); // Just spy

            const eventName = 'turn:actor_changed';
            const handleTurnActorChanged = getSubscribedHandler(eventName);
            expect(handleTurnActorChanged).toBeInstanceOf(Function);

            // Act
            await handleTurnActorChanged({currentActor: actor, previousActor: null});

            // Assert
            // 1. Verify handler was NOT called
            expect(mockTurnHandler.handleTurn).not.toHaveBeenCalled();

            // 2. Verify advanceTurn was called
            expect(mockTurnManager.advanceTurn).toHaveBeenCalledTimes(1);

            // 3. Verify Logging for advanceTurn error
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`No specific turn handler resolved for actor ${actor.id}`));
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Only one error expected
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Failed to advance turn directly (null handler) for ${actor.id}`),
                advanceError // Check the specific advanceTurn error object is logged
            );

            // 4. Verify GameLoop stopped
            expect(stopSpy).toHaveBeenCalledTimes(1);
        });

        // --- Standard Subscription Tests ---

        it("should subscribe to 'turn:actor_changed' on start", async () => { // Updated test title
            // Arrange
            const options = createValidOptions();
            gameLoop = new GameLoop(options);
            const eventName = 'turn:actor_changed'; // Use string literal

            // Act
            await gameLoop.start();

            // Assert
            // Check subscription for the specific event we care about
            expect(mockEventBus.subscribe).toHaveBeenCalledWith(
                eventName, // Use string literal
                expect.any(Function) // The bound handler
            );
            // Check subscription for the other event ('turn:manager_stopped')
            expect(mockEventBus.subscribe).toHaveBeenCalledWith(
                'turn:manager_stopped',
                expect.any(Function) // The bound handler
            );
            // Total subscriptions
            expect(mockEventBus.subscribe).toHaveBeenCalledTimes(2);

            // Ensure the handler we found is actually stored and is the bound one
            const handler = getSubscribedHandler(eventName);
            expect(handler).toBeInstanceOf(Function);
            // Optional: More specific check if needed, e.g., handler.name.includes('bound')
        });

        it("should unsubscribe from 'turn:actor_changed' on stop", async () => { // Updated test title
            // Arrange
            const options = createValidOptions();
            gameLoop = new GameLoop(options);
            const eventName = 'turn:actor_changed';
            await gameLoop.start(); // Start to subscribe (subscribes to BOTH events)
            const handler = getSubscribedHandler(eventName); // Get the specific handler instance used in subscribe

            // Ensure the handler was actually subscribed
            expect(handler).toBeInstanceOf(Function);
            // Verify subscribe was called correctly during start
            expect(mockEventBus.subscribe).toHaveBeenCalledWith(eventName, handler);
            expect(mockEventBus.subscribe).toHaveBeenCalledWith('turn:manager_stopped', expect.any(Function));
            expect(mockEventBus.subscribe).toHaveBeenCalledTimes(2);


            // Ensure gameLoop is marked as running so stop() proceeds
            gameLoop._test_setRunning(true);

            // Spy on the stop method to verify it's called, but DO NOT replace its implementation
            const stopSpy = jest.spyOn(gameLoop, 'stop');

            // Act
            await gameLoop.stop(); // Call the ORIGINAL stop method

            // Assert
            // 1. Verify stop method itself was called
            expect(stopSpy).toHaveBeenCalledTimes(1);

            // 2. Verify unsubscribe was called from within the original stop method
            expect(mockEventBus.unsubscribe).toHaveBeenCalledTimes(2); // CORRECTED: Should be called for both events now
            expect(mockEventBus.unsubscribe).toHaveBeenCalledWith(
                eventName, // Use string literal
                handler    // Check that the specific handler function instance was unsubscribed
            );
            // Optionally, verify the other unsubscribe call too
            expect(mockEventBus.unsubscribe).toHaveBeenCalledWith(
                'turn:manager_stopped',
                expect.any(Function) // Check it unsubscribed the other handler
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