// src/tests/core/gameLoop.isRunningGetter.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import GameLoop from '../../core/GameLoop.js';
// Assume ActionExecutor is imported if needed for type checks, though not strictly required for mocking
// import ActionExecutor from '../../actions/actionExecutor.js';
// Assuming component IDs are defined somewhere accessible, e.g., a constants file
const PLAYER_COMPONENT_ID = 'player';
const ACTOR_COMPONENT_ID = 'actor';


// --- Mock Dependencies ---
// (Mocks remain the same as provided in the initial code, except for TurnManager)
const mockEventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
};
const mockInputHandler = {
    enable: jest.fn(),
    disable: jest.fn(),
    clear: jest.fn(),
    setCommandCallback: jest.fn()
};
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
const mockCommandParser = {
    parse: jest.fn(),
};
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

// ****** CORRECTED MOCK: TurnManager ******
// Renamed from mockTurnOrderService and given ITurnManager methods
const mockTurnManager = {
    start: jest.fn().mockResolvedValue(undefined), // Added: Corresponds to ITurnManager.start
    stop: jest.fn().mockResolvedValue(undefined),   // Added: Corresponds to ITurnManager.stop
    getCurrentActor: jest.fn().mockReturnValue(null), // Added: Corresponds to ITurnManager.getCurrentActor
    advanceTurn: jest.fn().mockResolvedValue(undefined),// Added: Corresponds to ITurnManager.advanceTurn
    // Add other methods ONLY if GameLoop *directly* calls them (unlikely based on current GameLoop code)
};
// ****************************************


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
    inputHandler: mockInputHandler,
    commandParser: mockCommandParser,
    actionExecutor: mockActionExecutor,
    eventBus: mockEventBus,
    actionDiscoverySystem: mockActionDiscoverySystem,
    validatedEventDispatcher: mockvalidatedEventDispatcher,
    turnManager: mockTurnManager, // ***** CORRECTED: Use 'turnManager' key and the correct mock *****
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

        // Reset Command Parser Mock
        mockCommandParser.parse.mockReturnValue({actionId: null, error: 'Default mock parse', originalInput: ''});

        // ****** CORRECTED: Reset Turn Manager Mocks ******
        mockTurnManager.start.mockClear().mockResolvedValue(undefined); // Reset call count and return value
        mockTurnManager.stop.mockClear().mockResolvedValue(undefined);
        mockTurnManager.getCurrentActor.mockClear().mockReturnValue(null); // Default to no actor
        mockTurnManager.advanceTurn.mockClear().mockResolvedValue(undefined);
        // ***********************************************

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
            // Now the constructor should pass
            gameLoop = new GameLoop(createValidOptions());
            expect(gameLoop.isRunning).toBe(false);
        });

        it('should return true after successful start()', async () => {
            gameLoop = new GameLoop(createValidOptions());

            // --- CORRECTION ---
            // Mock `_processCurrentActorTurn` instead of `_processNextTurn`
            // We spy on this method because `start()` calls `turnManager.start()`,
            // which in turn might trigger events (`turn:actor_changed`) that call
            // `_processCurrentActorTurn`. We want to prevent that internal processing
            // just to check the `isRunning` flag set directly by `start()`.
            // --- START SPY ---
            processCurrentActorTurnSpy = jest.spyOn(GameLoop.prototype, '_processCurrentActorTurn')
                .mockResolvedValue(); // Simple mock to prevent execution
            // --- END SPY ---

            // Ensure turnManager.start resolves successfully (it does by default)
            // mockTurnManager.start.mockResolvedValue(); // Default is already resolved

            await gameLoop.start(); // This sets #isRunning = true, calls turnManager.start()

            // Now check the flag after start() completed its *own* logic
            expect(gameLoop.isRunning).toBe(true);
            // Check if turnManager.start was actually called
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);
            // --- END CORRECTION ---
        });

        it('should return false after stop() is called on a running loop', async () => { // Made async because stop() is async
            gameLoop = new GameLoop(createValidOptions());

            // Use the provided test helper to set the private state correctly
            gameLoop._test_setRunning(true); // Set #isRunning = true for the test

            expect(gameLoop.isRunning).toBe(true); // Pre-condition

            await gameLoop.stop(); // stop() is async now

            expect(gameLoop.isRunning).toBe(false);
            // Check if turnManager.stop was called
            expect(mockTurnManager.stop).toHaveBeenCalledTimes(1);
            // Check if inputHandler.disable was called
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
        });

        it('should return false after stop() is called on a stopped loop', async () => { // Made async because stop() is async
            gameLoop = new GameLoop(createValidOptions());
            expect(gameLoop.isRunning).toBe(false); // Pre-condition

            await gameLoop.stop(); // Call stop on already stopped loop

            expect(gameLoop.isRunning).toBe(false);
            // stop() should return early if already stopped, so mocks below shouldn't be called
            expect(mockTurnManager.stop).not.toHaveBeenCalled();
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
            // Event dispatches in stop() should also not happen
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:disable_input', expect.anything());
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:display_message', expect.anything());
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('game:stopped', expect.anything());
        });
    });

    // Other describe blocks for start(), stop(), processSubmittedCommand() etc. would go here...
});