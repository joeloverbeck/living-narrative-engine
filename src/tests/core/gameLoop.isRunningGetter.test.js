// src/tests/core/gameLoop.isRunningGetter.test.js
// ****** MODIFIED FILE ******

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import GameLoop from '../../core/GameLoop.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from "../../types/components.js";
// Assume ActionExecutor is imported if needed for type checks, though not strictly required for mocking
// import ActionExecutor from '../../actions/actionExecutor.js';
// Assuming component IDs are defined somewhere accessible, e.g., a constants file


// --- Mock Dependencies ---
// (Mocks remain the same as provided in the initial code, except for TurnManager)
const mockEventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
};
// REMOVED: mockInputHandler
// const mockInputHandler = {
//     enable: jest.fn(),
//     disable: jest.fn(),
//     clear: jest.fn(),
//     setCommandCallback: jest.fn()
// };
const mockGameStateManager = {
    getPlayer: jest.fn(), // Still needed for some older tests, though start() doesn't use it
    getCurrentLocation: jest.fn(), // Still needed for some older tests + executeAction
    setPlayer: jest.fn(),
    setCurrentLocation: jest.fn()
};
const mockGameDataRepository = {}; // Basic mock object
const mockEntityManager = { // Basic mock, might need more detail for turn order tests
    activeEntities: new Map()
};
// REMOVED: mockCommandParser
// const mockCommandParser = {
//     parse: jest.fn(),
// };
const mockActionExecutor = {
    executeAction: jest.fn(), // Key mock
};

const mockActionDiscoverySystem = {
    getValidActions: jest.fn().mockResolvedValue([]), // Return empty array as default
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

// Mock: TurnManager (implements ITurnManager)
const mockTurnManager = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    getCurrentActor: jest.fn().mockReturnValue(null),
    advanceTurn: jest.fn().mockResolvedValue(undefined),
};

// ****** ADDED MOCK: TurnHandlerResolver (implements ITurnHandlerResolver) ******
// This was missing, causing the constructor error.
const mockTurnHandlerResolver = {
    resolveHandler: jest.fn(), // Needs the function checked by the constructor
    // We don't need a specific implementation for these tests, just the function's existence.
};
// *******************************************************************************


// Mock entities for GameStateManager/TurnManager
const mockPlayer = {
    id: 'player1',
    name: 'Tester',
    getComponent: jest.fn(),
    hasComponent: jest.fn((componentId) => componentId === PLAYER_COMPONENT_ID)
};
const mockNpc = {
    id: 'npc1',
    name: 'Goblin',
    getComponent: jest.fn(),
    hasComponent: jest.fn((componentId) => componentId === ACTOR_COMPONENT_ID)
};
const mockLocation = {id: 'room:test', name: 'Test Chamber', getComponent: jest.fn() /* Add if needed */};

// Helper to create a complete, valid options object
const createValidOptions = () => ({
    gameDataRepository: mockGameDataRepository,
    entityManager: mockEntityManager,
    gameStateManager: mockGameStateManager,
    // REMOVED: inputHandler: mockInputHandler,
    // REMOVED: commandParser: mockCommandParser,
    actionExecutor: mockActionExecutor,
    eventBus: mockEventBus,
    actionDiscoverySystem: mockActionDiscoverySystem,
    validatedEventDispatcher: mockvalidatedEventDispatcher,
    turnManager: mockTurnManager,
    turnHandlerResolver: mockTurnHandlerResolver, // ***** ADDED: Provide the required dependency *****
    logger: mockLogger,
});

// --- Test Suite ---

describe('GameLoop', () => {
    let gameLoop;
    let processNextTurnSpy; // Spy for the old core loop method - might need removal/update depending on refactor
    let processCurrentActorTurnSpy; // Spy for the new turn processing method

    // Reset mocks before each test to ensure isolation (Top Level)
    beforeEach(() => {
        jest.clearAllMocks(); // Clear standard mocks BETWEEN tests

        // Reset Game State Manager Mocks
        mockGameStateManager.getPlayer.mockReturnValue(null); // Keep default null for constructor tests etc.
        mockGameStateManager.getCurrentLocation.mockReturnValue(null); // Keep default null

        // Reset Action Executor Mock
        mockActionExecutor.executeAction.mockResolvedValue({
            success: true,
            messages: [{text: 'Default mock action executed'}]
        }); // Adjusted default return

        // Reset Command Parser Mock (No longer needed)
        // mockCommandParser.parse.mockReturnValue({actionId: null, error: 'Default mock parse', originalInput: ''});

        // Reset Turn Manager Mocks
        mockTurnManager.start.mockClear().mockResolvedValue(undefined); // Reset call count and return value
        mockTurnManager.stop.mockClear().mockResolvedValue(undefined);
        mockTurnManager.getCurrentActor.mockClear().mockReturnValue(null); // Default to no actor
        mockTurnManager.advanceTurn.mockClear().mockResolvedValue(undefined);

        // ****** ADDED: Reset Turn Handler Resolver Mock ******
        mockTurnHandlerResolver.resolveHandler.mockClear();
        // You might want to add a default mock implementation if tests need it:
        // mockTurnHandlerResolver.resolveHandler.mockReturnValue({ handleTurn: jest.fn() });
        // ****************************************************

        // Reset Entity Manager Mock (Example: Clear active entities if needed)
        mockEntityManager.activeEntities = new Map();

        // Reset entity mocks (ensure clean state for hasComponent etc.)
        mockPlayer.hasComponent.mockImplementation((componentId) => componentId === PLAYER_COMPONENT_ID);
        mockNpc.hasComponent.mockImplementation((componentId) => componentId === ACTOR_COMPONENT_ID);

    });

    afterEach(() => {
        // Restore spies
        if (processNextTurnSpy) {
            processNextTurnSpy.mockRestore();
            processNextTurnSpy = null;
        }
        if (processCurrentActorTurnSpy) {
            processCurrentActorTurnSpy.mockRestore();
            processCurrentActorTurnSpy = null;
        }

        // Ensure game loop is stopped if a test accidentally leaves it running
        // Use a try-catch as stop() might be mocked or throw if not initialized
        try {
            if (gameLoop && gameLoop.isRunning) {
                // Use await if stop is async, otherwise remove await
                gameLoop.stop();
            }
        } catch (e) {
            // Ignore errors during cleanup stop
        }
        gameLoop = null; // Ensure cleanup
    });


    // --- isRunning Getter Test ---
    describe('isRunning getter', () => {
        it('should return false initially', () => {
            // Now the constructor should pass with the added mockTurnHandlerResolver
            gameLoop = new GameLoop(createValidOptions());
            expect(gameLoop.isRunning).toBe(false);
        });

        it('should return true after successful start()', async () => {
            gameLoop = new GameLoop(createValidOptions()); // Should pass constructor now

            // Spy on internal method to prevent full turn processing, just check start() logic
            processCurrentActorTurnSpy = jest.spyOn(GameLoop.prototype, '_processCurrentActorTurn')
                .mockResolvedValue(); // Simple mock to prevent execution

            // Ensure turnManager.start resolves successfully (it does by default)
            await gameLoop.start(); // This sets #isRunning = true, calls turnManager.start()

            // Now check the flag after start() completed its *own* logic
            expect(gameLoop.isRunning).toBe(true);
            // Check if turnManager.start was actually called
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);
        });

        it('should return false after stop() is called on a running loop', async () => { // Made async because stop() is async
            gameLoop = new GameLoop(createValidOptions()); // Should pass constructor now

            // Use the provided test helper to set the private state correctly
            gameLoop._test_setRunning(true); // Set #isRunning = true for the test

            expect(gameLoop.isRunning).toBe(true); // Pre-condition

            await gameLoop.stop(); // stop() is async now

            expect(gameLoop.isRunning).toBe(false);
            // Check if turnManager.stop was called
            expect(mockTurnManager.stop).toHaveBeenCalledTimes(1);
            // Check if inputHandler.disable was called (it's now done via event)
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:disable_input', expect.any(Object));
        });

        it('should return false after stop() is called on a stopped loop', async () => { // Made async because stop() is async
            gameLoop = new GameLoop(createValidOptions()); // Should pass constructor now
            expect(gameLoop.isRunning).toBe(false); // Pre-condition

            await gameLoop.stop(); // Call stop on already stopped loop

            expect(gameLoop.isRunning).toBe(false);
            // stop() should return early if already stopped, so mocks below shouldn't be called
            expect(mockTurnManager.stop).not.toHaveBeenCalled();
            // Check if inputHandler.disable was called (it's now done via event)
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:disable_input', expect.anything());
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:display_message', expect.anything());
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('game:stopped', expect.anything());
        });
    });

    // Other describe blocks for start(), stop(), processSubmittedCommand() etc. would go here...
});