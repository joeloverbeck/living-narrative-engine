// src/tests/core/gameLoop.isRunningGetter.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import GameLoop from '../../core/GameLoop.js';
// Assume ActionExecutor is imported if needed for type checks, though not strictly required for mocking
// import ActionExecutor from '../../actions/actionExecutor.js';

// --- Mock Dependencies ---
// (Mocks remain the same as provided in the initial code)
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

// ****** NEW MOCK: TurnOrderService ******
const mockTurnOrderService = {
    isEmpty: jest.fn().mockReturnValue(true), // Default to empty initially
    startNewRound: jest.fn(),
    getNextEntity: jest.fn().mockReturnValue(null), // Default to no entity
    clearCurrentRound: jest.fn(), // Added for stop() testability
    // Add other methods if GameLoop uses them directly
};
// ****************************************


// Mock entities for GameStateManager/TurnOrderService
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
    turnOrderService: mockTurnOrderService, // ***** ADD THIS LINE *****
    logger: mockLogger,
});

// --- Test Suite ---

describe('GameLoop', () => {
    let gameLoop;
    let promptInputSpy;
    let processNextTurnSpy; // Spy for the new core loop method

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

        // Reset Turn Order Service Mocks
        mockTurnOrderService.isEmpty.mockReturnValue(true); // Default to empty queue
        mockTurnOrderService.getNextEntity.mockReturnValue(null); // Default to no entity available

        // Reset Entity Manager Mock (Example: Clear active entities if needed)
        mockEntityManager.activeEntities = new Map();

        // Reset entity mocks (ensure clean state for hasComponent etc.)
        mockPlayer.hasComponent.mockImplementation((componentId) => componentId === PLAYER_COMPONENT_ID);
        mockNpc.hasComponent.mockImplementation((componentId) => componentId === ACTOR_COMPONENT_ID);

    });

    afterEach(() => {
        if (promptInputSpy) {
            promptInputSpy.mockRestore(); // Restore original implementation
            promptInputSpy = null;
        }
        // Make sure to restore the spy if it was created
        if (processNextTurnSpy) {
            processNextTurnSpy.mockRestore();
            processNextTurnSpy = null;
        }
        // Ensure game loop is stopped if a test accidentally leaves it running
        if (gameLoop && gameLoop.isRunning) {
            gameLoop.stop();
        }
    });


    // --- isRunning Getter Test ---
    describe('isRunning getter', () => {
        it('should return false initially', () => {
            gameLoop = new GameLoop(createValidOptions());
            expect(gameLoop.isRunning).toBe(false);
        });

        it('should return true after successful start()', async () => { // async because start is
            gameLoop = new GameLoop(createValidOptions());

            // --- CORRECTION ---
            // Mock _processNextTurn to prevent it from immediately calling stop()
            // Use the correct method name ('_processNextTurn')
            processNextTurnSpy = jest.spyOn(gameLoop, '_processNextTurn')
                .mockImplementation(async () => {
                    // Do nothing for this test, just prevent original execution
                    gameLoop._test_setRunning(true); // Ensure the flag stays set if start() relies on this
                    // Note: Alternatively, configure mocks (entityManager, turnOrderService)
                    // so that _processNextTurn *doesn't* call stop(). Mocking the method
                    // directly is simpler for testing just the start() flag setting.
                    // If start() itself should *not* call _processNextTurn, then the mock is essential.
                    // If start() *should* call it but it shouldn't stop, then configure mocks.
                    // Given the structure, mocking it seems appropriate here.
                    // Let's assume start *does* set the flag and *then* calls processNextTurn.
                    // We just need to ensure processNextTurn doesn't immediately unset it *in this test*.
                    // A simpler mock might just be:
                    // .mockResolvedValue(); // or .mockImplementation(async () => {});
                    // Let's re-evaluate the simplest mock:
                });
            // Recreate the spy with a simple mock that does nothing
            if (processNextTurnSpy) processNextTurnSpy.mockRestore(); // Clear previous spy if any
            processNextTurnSpy = jest.spyOn(gameLoop, '_processNextTurn').mockResolvedValue(); // Mock it to do nothing


            await gameLoop.start(); // This sets #isRunning = true, then calls the mocked _processNextTurn

            // Now check the flag after start() completed its *own* logic
            expect(gameLoop.isRunning).toBe(true);
            // --- END CORRECTION ---
        });

        // --- OBSOLETE TEST REMOVED ---
        // This test is no longer valid because start() itself doesn't fail in a way
        // that prevents isRunning from becoming true. Failure happens later in the turn loop.
        /*
        it('should return false after start() fails', () => { ... });
        */
        // --- END REMOVED TEST ---


        it('should return false after stop() is called on a running loop', () => {
            gameLoop = new GameLoop(createValidOptions());

            // --- CORRECTION ---
            // Use the provided test helper to set the private state correctly
            gameLoop._test_setRunning(true); // Set #isRunning = true for the test
            // --- END CORRECTION ---

            expect(gameLoop.isRunning).toBe(true); // Pre-condition (should now pass)
            gameLoop.stop();
            expect(gameLoop.isRunning).toBe(false);
        });

        it('should return false after stop() is called on a stopped loop', () => {
            gameLoop = new GameLoop(createValidOptions());
            expect(gameLoop.isRunning).toBe(false); // Pre-condition
            gameLoop.stop(); // Call stop on already stopped loop
            expect(gameLoop.isRunning).toBe(false);
        });
    });
});