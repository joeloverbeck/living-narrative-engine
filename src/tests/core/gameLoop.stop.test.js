// src/tests/core/gameLoop.stop.test.js

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
        if (processNextTurnSpy) {
            processNextTurnSpy.mockRestore();
            processNextTurnSpy = null;
        }
        // Ensure game loop is stopped if a test accidentally leaves it running
        if (gameLoop && gameLoop.isRunning) {
            gameLoop.stop();
        }
    });


    // --- stop() Method Tests ---
    describe('stop', () => {
        beforeEach(async () => { // Make async if start is async (keep async for consistency if start was ever async)
            // Setup for a running state before each stop test
            gameLoop = new GameLoop(createValidOptions());

            // --- CORRECTED STATE SETTING ---
            // Use the dedicated test helper method to set the private state reliably.
            gameLoop._test_setRunning(true);
            // -------------------------------

            // It's important to clear mocks AFTER setting up the initial state for the test,
            // so that mocks called during setup (like logger in constructor or _test_setRunning)
            // don't interfere with the assertions *within* the test itself.
            jest.clearAllMocks();
        });

        // --- Tests remain the same ---
        it('When Running: should set isRunning to false', () => {
            gameLoop.stop();
            expect(gameLoop.isRunning).toBe(false);
        });

        it('When Running: should call inputHandler.disable', () => {
            gameLoop.stop();
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
        });

        it('When Running: should dispatch textUI:disable_input event with message', () => { // Adjusted event name
            gameLoop.stop();
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:disable_input', {
                message: 'Game stopped.',
            });
        });

        it('When Running: should dispatch textUI:display_message event with info', () => { // Adjusted event name
            gameLoop.stop();
            // Use expect.objectContaining for flexibility if more properties might be added later
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:display_message', expect.objectContaining({
                text: 'Game stopped.',
                type: 'info',
            }));
        });

        it('When Running: should call turnOrderService.clearCurrentRound if available', () => {
            // This test setup within the 'it' block seems correct, ensuring the mock method exists
            // before creating the GameLoop instance *for this specific test*.
            // However, let's ensure the instance used is the one from beforeEach if the method is always expected.
            // If mockTurnOrderService *always* has clearCurrentRound mocked (as it does globally),
            // we don't need to recreate the gameLoop here.

            // Remove the local recreation unless absolutely necessary:
            // mockTurnOrderService.clearCurrentRound = jest.fn(); // Already mocked globally
            // gameLoop = new GameLoop(createValidOptions()); // Uses the instance from beforeEach
            // gameLoop._test_setRunning(true); // State already set in beforeEach

            gameLoop.stop();
            expect(mockTurnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);
        });

        it('When Running: should dispatch game:stopped event', () => {
            gameLoop.stop();
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('game:stopped', {});
        });

        it('When Already Stopped: should not perform actions', () => {
            // Arrange: Ensure the loop is stopped first using the method under test
            gameLoop._test_setRunning(true); // Start as running
            gameLoop.stop();                 // Stop it
            expect(gameLoop.isRunning).toBe(false); // Verify stopped

            // Clear mocks called by the *first* stop() call
            jest.clearAllMocks();

            // Act: Call stop again
            gameLoop.stop();

            // Assert: Check it remained stopped and actions were NOT performed
            expect(gameLoop.isRunning).toBe(false);
            // Check the logger message for stopping when already stopped
            expect(mockLogger.info).toHaveBeenCalledWith('GameLoop: Stop called, but already stopped.');
            // Check other actions were not called *again*
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled(); // Check generally, specific calls below are redundant if this passes
            // expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:disable_input', expect.any(Object)); // More specific checks
            // expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:display_message', expect.objectContaining({text: 'Game stopped.'}));
            expect(mockTurnOrderService.clearCurrentRound).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('game:stopped', {});
        });
    });
});