// src/tests/core/gameLoop.promptInput.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import GameLoop from '../../core/GameLoop.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from "../../types/components.js";
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
    turnOrderService: mockTurnOrderService,
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
        mockGameStateManager.getPlayer.mockReturnValue(null);
        mockGameStateManager.getCurrentLocation.mockReturnValue(null);

        // Reset Action Executor Mock
        mockActionExecutor.executeAction.mockResolvedValue({
            success: true,
            messages: [{text: 'Default mock action executed'}]
        });

        // Reset Command Parser Mock
        mockCommandParser.parse.mockReturnValue({actionId: null, error: 'Default mock parse', originalInput: ''});

        // Reset Turn Order Service Mocks
        mockTurnOrderService.isEmpty.mockReturnValue(true);
        mockTurnOrderService.getNextEntity.mockReturnValue(null);

        // Reset Entity Manager Mock
        mockEntityManager.activeEntities = new Map();

        // Reset entity mocks (ensure clean state for hasComponent etc.)
        // This setup ensures the mocks are fresh for each test in the OUTER describe
        mockPlayer.hasComponent.mockImplementation((componentId) => componentId === PLAYER_COMPONENT_ID);
        mockNpc.hasComponent.mockImplementation((componentId) => componentId === ACTOR_COMPONENT_ID);

    });

    afterEach(() => {
        if (promptInputSpy) {
            promptInputSpy.mockRestore();
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


    // --- promptInput() Method Tests ---
    describe('promptInput', () => {
        // Remove gameLoop variable from here, declare inside beforeEach

        // Updated beforeEach for promptInput tests
        beforeEach(() => {
            jest.clearAllMocks(); // Keep clearing mocks specific to this describe block
            mockPlayer.hasComponent.mockImplementation((componentId) => componentId === PLAYER_COMPONENT_ID);
            mockNpc.hasComponent.mockImplementation((componentId) => componentId === ACTOR_COMPONENT_ID);

            // Instantiate GameLoop here for each test in this describe block
            gameLoop = new GameLoop(createValidOptions());

            // *** USE THE NEW TEST METHODS TO SET STATE ***
            // Default state for most tests in this block: Running and Player's Turn
            gameLoop._test_setRunning(true);
            gameLoop._test_setCurrentTurnEntity(mockPlayer);

            const testName = expect.getState ? expect.getState().currentTestName : 'Current Test';
            // Optional: Add logging to confirm state *after* setting via test methods
            console.log(`TEST beforeEach (${testName}): State set via _test_ methods. isRunning=${gameLoop.isRunning}, currentEntityId=${gameLoop['_GameLoop__currentTurnEntity']?.id}`); // Use internal access for logging only if needed, getter is primary check

        });

        // No changes needed for the first three 'it' blocks (they use the default state from beforeEach)
        it('When Running and Player Turn: should call inputHandler.enable', () => {
            // Arrange (done in beforeEach)
            console.log(`TEST (enable): Entering test. isRunning=${gameLoop.isRunning}, entity=${gameLoop['_GameLoop__currentTurnEntity']?.id}`); // Log state at test start
            // Act
            gameLoop.promptInput();
            // Assert
            expect(mockInputHandler.enable).toHaveBeenCalledTimes(1);
        });

        it('When Running and Player Turn: should dispatch textUI:enable_input event with default placeholder and entityId', () => {
            // Arrange (done in beforeEach)
            console.log(`TEST (dispatch default): Entering test. isRunning=${gameLoop.isRunning}, entity=${gameLoop['_GameLoop__currentTurnEntity']?.id}`); // Log state at test start
            // Act
            gameLoop.promptInput();
            // Assert
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:enable_input', {
                placeholder: 'Enter command...',
                entityId: mockPlayer.id
            });
            // Keep negative assertions
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
        });


        it('When Running and Player Turn: should dispatch textUI:enable_input event with provided placeholder and entityId', () => {
            // Arrange (done in beforeEach)
            const customMessage = 'What now?';
            console.log(`TEST (dispatch custom): Entering test. isRunning=${gameLoop.isRunning}, entity=${gameLoop['_GameLoop__currentTurnEntity']?.id}`); // Log state at test start
            // Act
            gameLoop.promptInput(customMessage);
            // Assert
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:enable_input', {
                placeholder: customMessage,
                entityId: mockPlayer.id
            });
            // Keep negative assertions
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
        });

        // Test requiring STOPPED state
        it('When Stopped: should not call inputHandler.enable or dispatch event', () => {
            // Arrange: Override the default state from beforeEach
            gameLoop._test_setRunning(false); // Set to stopped
            gameLoop._test_setCurrentTurnEntity(null); // Clear entity just in case

            console.log(`TEST (Stopped): Entering test. isRunning=${gameLoop.isRunning}, entity=${gameLoop['_GameLoop__currentTurnEntity']?.id}`); // Log state at test start
            // Act
            gameLoop.promptInput();
            // Assert
            expect(mockLogger.debug).toHaveBeenCalledWith('promptInput called while not running.'); // This log should now ONLY happen here
            expect(mockInputHandler.enable).not.toHaveBeenCalled();
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:enable_input', expect.any(Object));
            expect(mockInputHandler.disable).not.toHaveBeenCalled(); // Important: Still shouldn't disable if called when stopped
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:disable_input', expect.any(Object));
        });

        // Test requiring NOT PLAYER TURN state
        it('When Running BUT Not Player Turn: should log debug, disable input, and dispatch disable event', () => {
            // Arrange: Override the default state from beforeEach
            gameLoop._test_setRunning(true); // Ensure running
            gameLoop._test_setCurrentTurnEntity(mockNpc); // Set to NPC turn

            console.log(`TEST (Not Player): Entering test. isRunning=${gameLoop.isRunning}, entity=${gameLoop['_GameLoop__currentTurnEntity']?.id}`); // Log state at test start
            // Act
            gameLoop.promptInput();
            // Assert
            // Verify the *correct* debug log now
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("promptInput called, but it's not a player's turn"));
            expect(mockLogger.debug).not.toHaveBeenCalledWith('promptInput called while not running.'); // Verify the other log *didn't* happen

            expect(mockInputHandler.enable).not.toHaveBeenCalled(); // Should NOT enable
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1); // SHOULD disable
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:disable_input', {message: "Waiting for others..."}); // Should dispatch disable
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:enable_input', expect.any(Object)); // Should NOT dispatch enable
        });
    }); // End describe('promptInput')
});