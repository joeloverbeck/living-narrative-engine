// src/tests/core/gameLoop.promptInput.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import GameLoop from '../../core/GameLoop.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from "../../types/components.js";
// Assume ActionExecutor is imported if needed for type checks, though not strictly required for mocking
// import ActionExecutor from '../../actions/actionExecutor.js';

// --- Mock Dependencies ---
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
    getPlayer: jest.fn(),
    getCurrentLocation: jest.fn(),
    setPlayer: jest.fn(),
    setCurrentLocation: jest.fn()
};
const mockGameDataRepository = {}; // Basic mock object
const mockEntityManager = {
    activeEntities: new Map()
};
const mockCommandParser = {
    parse: jest.fn(),
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

// ****** CORRECTED MOCK: TurnManager ******
// Renamed from mockTurnOrderService and added required methods
const mockTurnManager = {
    // ITurnManager methods required by GameLoop constructor
    start: jest.fn(),
    stop: jest.fn(),
    getCurrentActor: jest.fn().mockReturnValue(null), // Default to null initially
    advanceTurn: jest.fn(),

    // Keep potentially needed methods from original mock if used elsewhere (or remove if unused)
    // isEmpty: jest.fn().mockReturnValue(true),
    // startNewRound: jest.fn(),
    // getNextEntity: jest.fn().mockReturnValue(null), // Replaced by getCurrentActor for GameLoop needs
    // clearCurrentRound: jest.fn(),
};
// *******************************************


// Mock entities for GameStateManager/TurnManager
const mockPlayer = {
    id: 'player1',
    name: 'Tester',
    getComponent: jest.fn(),
    // Ensure hasComponent is correctly mocked here or in beforeEach
    hasComponent: jest.fn((componentId) => componentId === PLAYER_COMPONENT_ID)
};
const mockNpc = {
    id: 'npc1',
    name: 'Goblin',
    getComponent: jest.fn(),
    // Ensure hasComponent is correctly mocked here or in beforeEach
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
    turnManager: mockTurnManager, // Use the corrected mock
    logger: mockLogger,
});

// --- Test Suite ---

describe('GameLoop', () => {
    let gameLoop;
    let promptInputSpy; // Assuming this might be used in other tests, keep if needed
    let processNextTurnSpy; // Assuming this might be used in other tests, keep if needed

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

        // Reset Turn Manager Mocks (Focus on methods checked/used)
        mockTurnManager.start.mockClear(); // Clear call history
        mockTurnManager.stop.mockClear();
        mockTurnManager.getCurrentActor.mockClear();
        mockTurnManager.getCurrentActor.mockReturnValue(null); // Reset to default null
        mockTurnManager.advanceTurn.mockClear();

        // Reset Entity Manager Mock
        mockEntityManager.activeEntities = new Map();

        // Reset entity mocks (ensure clean state for hasComponent etc.)
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
            gameLoop.stop(); // Assuming stop is synchronous or add await if needed
        }
        gameLoop = null; // Help GC
    });


    // --- promptInput() Method Tests ---
    describe('promptInput', () => {
        // Remove gameLoop variable from here, declare inside beforeEach

        // Updated beforeEach for promptInput tests
        beforeEach(() => {
            // Mocks should be cleared by the top-level beforeEach already
            // Reset entity mocks specifically for this context if needed (already done above)
            mockPlayer.hasComponent.mockImplementation((componentId) => componentId === PLAYER_COMPONENT_ID);
            mockNpc.hasComponent.mockImplementation((componentId) => componentId === ACTOR_COMPONENT_ID);

            // Instantiate GameLoop HERE for each test in this describe block
            // This will now pass the constructor check because mockTurnManager has the required methods
            gameLoop = new GameLoop(createValidOptions());

            // *** USE THE NEW TEST METHODS TO SET STATE ***
            // Default state for most tests in this block: Running and Player's Turn
            gameLoop._test_setRunning(true);
            // ***** REMOVED OBSOLETE CALL *****
            // gameLoop._test_setInternalCurrentTurnEntity(mockPlayer); // This sets the internal state directly << REMOVED
            // *********************************

            // Default TurnManager state for Player turn tests
            // (can be overridden in specific tests if needed)
            mockTurnManager.getCurrentActor.mockReturnValue(mockPlayer);

            // Optional logging (keep if helpful)
            // console.log(`TEST beforeEach: State set via _test_ methods. isRunning=${gameLoop.isRunning}, turnManager.getCurrentActor returns=${mockTurnManager.getCurrentActor()?.id}`);

        });

        it('When Running and Player Turn: should call inputHandler.enable', async () => { // Mark as async because promptInput is async
            // Arrange (done in beforeEach, including setting mockTurnManager)
            // console.log(`TEST (enable): Entering test. isRunning=${gameLoop.isRunning}, turnManager.getCurrentActor returns=${mockTurnManager.getCurrentActor()?.id}`);
            // Act
            await gameLoop.promptInput(); // Await the async call
            // Assert
            expect(mockTurnManager.getCurrentActor).toHaveBeenCalledTimes(1); // Verify promptInput checked the turn
            expect(mockInputHandler.enable).toHaveBeenCalledTimes(1);
        });

        it('When Running and Player Turn: should dispatch textUI:enable_input event with default placeholder and entityId', async () => { // Mark as async
            // Arrange (done in beforeEach, including setting mockTurnManager)
            // console.log(`TEST (dispatch default): Entering test. isRunning=${gameLoop.isRunning}, turnManager.getCurrentActor returns=${mockTurnManager.getCurrentActor()?.id}`);
            // Act
            await gameLoop.promptInput(); // Await the async call
            // Assert
            expect(mockTurnManager.getCurrentActor).toHaveBeenCalledTimes(1); // Verify promptInput checked the turn
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:enable_input', {
                placeholder: 'Enter command...',
                entityId: mockPlayer.id
            });
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
        });


        it('When Running and Player Turn: should dispatch textUI:enable_input event with provided placeholder and entityId', async () => { // Mark as async
            // Arrange (done in beforeEach, including setting mockTurnManager)
            const customMessage = 'What now?';
            // console.log(`TEST (dispatch custom): Entering test. isRunning=${gameLoop.isRunning}, turnManager.getCurrentActor returns=${mockTurnManager.getCurrentActor()?.id}`);
            // Act
            await gameLoop.promptInput(customMessage); // Await the async call
            // Assert
            expect(mockTurnManager.getCurrentActor).toHaveBeenCalledTimes(1); // Verify promptInput checked the turn
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:enable_input', {
                placeholder: customMessage,
                entityId: mockPlayer.id
            });
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
        });

        // Test requiring STOPPED state
        it('When Stopped: should not call inputHandler.enable or dispatch event', async () => { // Mark as async
            // Arrange: Override the default state from beforeEach
            gameLoop._test_setRunning(false); // Set to stopped
            mockTurnManager.getCurrentActor.mockReturnValue(null); // Ensure TurnManager also reports no actor (overrides beforeEach)

            // console.log(`TEST (Stopped): Entering test. isRunning=${gameLoop.isRunning}, turnManager.getCurrentActor returns=${mockTurnManager.getCurrentActor()?.id}`);
            // Act
            await gameLoop.promptInput(); // Await the async call
            // Assert
            expect(mockLogger.debug).toHaveBeenCalledWith('promptInput called while not running.');
            expect(mockTurnManager.getCurrentActor).not.toHaveBeenCalled(); // Should exit before checking turn
            expect(mockInputHandler.enable).not.toHaveBeenCalled();
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:enable_input', expect.any(Object));
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:disable_input', expect.any(Object));
        });

        // Test requiring NOT PLAYER TURN state
        it('When Running BUT Not Player Turn: should log debug, disable input, and dispatch disable event', async () => { // Mark as async
            // Arrange: Override the default state from beforeEach
            gameLoop._test_setRunning(true); // Ensure running
            mockTurnManager.getCurrentActor.mockReturnValue(mockNpc); // Set TurnManager mock to return NPC (overrides beforeEach)
            // ***** REMOVED OBSOLETE CALL *****
            // gameLoop._test_setInternalCurrentTurnEntity(mockNpc); // Set internal entity << REMOVED
            // *********************************

            // console.log(`TEST (Not Player): Entering test. isRunning=${gameLoop.isRunning}, turnManager.getCurrentActor returns=${mockTurnManager.getCurrentActor()?.id}`);
            // Act
            await gameLoop.promptInput(); // Await the async call
            // Assert
            expect(mockTurnManager.getCurrentActor).toHaveBeenCalledTimes(1); // Verify promptInput checked the turn
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("promptInput called, but it's not a player's turn"));
            expect(mockLogger.debug).not.toHaveBeenCalledWith('promptInput called while not running.');

            expect(mockInputHandler.enable).not.toHaveBeenCalled();
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1); // Should disable
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:disable_input', {message: "Waiting for others..."}); // Should dispatch disable
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:enable_input', expect.any(Object)); // Should NOT dispatch enable
        });
    }); // End describe('promptInput')
});