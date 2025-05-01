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

// Mock TurnManager (already corrected in your provided code)
const mockTurnManager = {
    start: jest.fn(),
    stop: jest.fn(),
    getCurrentActor: jest.fn().mockReturnValue(null),
    advanceTurn: jest.fn(),
};

// ****** ADDED MOCK: TurnHandlerResolver ******
// This was missing and caused the constructor error
const mockTurnHandlerResolver = {
    resolveHandler: jest.fn().mockReturnValue({ // Return a dummy handler object
        handleTurn: jest.fn() // Mock handleTurn as GameLoop might call it indirectly
    })
};
// ********************************************

// Mock entities for GameStateManager/TurnManager
const mockPlayer = {
    id: 'player1',
    name: 'Tester',
    getComponent: jest.fn(),
    hasComponent: jest.fn((componentId) => componentId === PLAYER_COMPONENT_ID),
    // Helper for debugging complex mocks if needed
    // getAllComponents: () => ({ 'player': {} }) // Example
};
const mockNpc = {
    id: 'npc1',
    name: 'Goblin',
    getComponent: jest.fn(),
    hasComponent: jest.fn((componentId) => componentId === ACTOR_COMPONENT_ID),
    // Helper for debugging complex mocks if needed
    // getAllComponents: () => ({ 'actor': {} }) // Example
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
    turnManager: mockTurnManager,
    turnHandlerResolver: mockTurnHandlerResolver, // <<< ADDED THE MISSING DEPENDENCY
    logger: mockLogger,
});

// --- Test Suite ---

describe('GameLoop', () => {
    let gameLoop;
    let promptInputSpy; // Keep if used elsewhere
    let processNextTurnSpy; // Keep if used elsewhere

    // Reset mocks before each test to ensure isolation (Top Level)
    beforeEach(() => {
        jest.clearAllMocks();

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

        // Reset Turn Manager Mocks
        mockTurnManager.start.mockClear();
        mockTurnManager.stop.mockClear();
        mockTurnManager.getCurrentActor.mockClear();
        mockTurnManager.getCurrentActor.mockReturnValue(null);
        mockTurnManager.advanceTurn.mockClear();

        // Reset Turn Handler Resolver Mock (Clear calls)
        mockTurnHandlerResolver.resolveHandler.mockClear();
        // You might want to reset the mock implementation if specific tests need different handlers
        mockTurnHandlerResolver.resolveHandler.mockReturnValue({handleTurn: jest.fn()});


        // Reset Entity Manager Mock
        mockEntityManager.activeEntities = new Map();

        // Reset entity mocks (ensure clean state for hasComponent etc.)
        // Use mockImplementation for consistent behavior reset
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
        if (gameLoop && gameLoop.isRunning) {
            // Using await since stop is async
            gameLoop.stop().catch(err => console.error("Error stopping game loop in afterEach:", err));
        }
        gameLoop = null;
    });


    // --- promptInput() Method Tests ---
    // Note: These tests now indirectly test the DEPRECATED promptInput method.
    // Ideally, tests should target the PlayerTurnHandler which now holds this logic.
    // Keeping them for now as per the provided code structure, but add a note.
    describe('promptInput (Testing DEPRECATED method)', () => {

        beforeEach(() => {
            // Instantiate GameLoop HERE for each test in this describe block
            // This will now pass the constructor check because mockTurnHandlerResolver is provided
            gameLoop = new GameLoop(createValidOptions()); // Should no longer throw

            // *** Set state using test helpers or TurnManager mocks ***
            // Default state for most tests: Running and Player's Turn
            gameLoop._test_setRunning(true); // Set internal state

            // Default TurnManager state for Player turn tests
            mockTurnManager.getCurrentActor.mockReturnValue(mockPlayer); // TurnManager reports player turn

            // Optional logging
            // console.log(`TEST beforeEach: isRunning=${gameLoop.isRunning}, turnManager.getCurrentActor returns=${mockTurnManager.getCurrentActor()?.id}`);
        });

        it('When Running and Player Turn: should call inputHandler.enable', async () => {
            // Arrange (done in beforeEach)
            // Act
            await gameLoop.promptInput(); // Call the (deprecated) method
            // Assert
            expect(mockTurnManager.getCurrentActor).toHaveBeenCalledTimes(1); // Verify promptInput checked the turn
            expect(mockInputHandler.enable).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('DEPRECATED: GameLoop.promptInput called')); // Verify deprecation warning
        });

        it('When Running and Player Turn: should dispatch textUI:enable_input event with default placeholder and entityId', async () => {
            // Arrange (done in beforeEach)
            // Act
            await gameLoop.promptInput(); // Call the (deprecated) method
            // Assert
            expect(mockTurnManager.getCurrentActor).toHaveBeenCalledTimes(1);
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:enable_input', {
                placeholder: 'Enter command...',
                entityId: mockPlayer.id
            });
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('DEPRECATED: GameLoop.promptInput called')); // Verify deprecation warning
        });

        it('When Running and Player Turn: should dispatch textUI:enable_input event with provided placeholder and entityId', async () => {
            // Arrange (done in beforeEach)
            const customMessage = 'What now?';
            // Act
            await gameLoop.promptInput(customMessage); // Call the (deprecated) method
            // Assert
            expect(mockTurnManager.getCurrentActor).toHaveBeenCalledTimes(1);
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:enable_input', {
                placeholder: customMessage,
                entityId: mockPlayer.id
            });
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('DEPRECATED: GameLoop.promptInput called')); // Verify deprecation warning
        });

        it('When Stopped: should not call inputHandler.enable or dispatch event', async () => {
            // Arrange: Override the default state from beforeEach
            gameLoop._test_setRunning(false); // Set to stopped
            mockTurnManager.getCurrentActor.mockReturnValue(null); // Ensure TurnManager reports no actor

            // Act
            await gameLoop.promptInput(); // Call the (deprecated) method
            // Assert
            // The method should exit early due to isRunning check
            expect(mockLogger.debug).toHaveBeenCalledWith('promptInput called while not running.');
            expect(mockTurnManager.getCurrentActor).not.toHaveBeenCalled(); // Should not check turn if not running
            expect(mockInputHandler.enable).not.toHaveBeenCalled();
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:enable_input', expect.any(Object));
            expect(mockInputHandler.disable).not.toHaveBeenCalled(); // Shouldn't disable if already stopped/not player turn
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:disable_input', expect.any(Object));
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('DEPRECATED: GameLoop.promptInput called')); // Verify deprecation warning
        });

        it('When Running BUT Not Player Turn: should log debug, disable input, and dispatch disable event', async () => {
            // Arrange: Override the default state from beforeEach
            gameLoop._test_setRunning(true); // Ensure running
            mockTurnManager.getCurrentActor.mockReturnValue(mockNpc); // Set TurnManager mock to return NPC

            // Act
            await gameLoop.promptInput(); // Call the (deprecated) method
            // Assert
            expect(mockTurnManager.getCurrentActor).toHaveBeenCalledTimes(1); // Verify promptInput checked the turn
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("promptInput called, but it's not a player's turn"));

            expect(mockInputHandler.enable).not.toHaveBeenCalled();
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1); // Should disable
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:disable_input', {message: "Waiting for others..."}); // Should dispatch disable
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:enable_input', expect.any(Object)); // Should NOT dispatch enable
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('DEPRECATED: GameLoop.promptInput called')); // Verify deprecation warning
        });
    }); // End describe('promptInput')
});