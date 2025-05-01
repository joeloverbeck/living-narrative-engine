// src/tests/core/gameLoop.constructor.test.js

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

// ****** MOCK: TurnManager (using the old mock but renaming for clarity) ******
// Renamed mockTurnOrderService to mockTurnManager for consistency
const mockTurnManager = {
    start: jest.fn(), // Added required methods for constructor check
    stop: jest.fn(),
    getCurrentActor: jest.fn().mockReturnValue(null), // Default to no entity
    advanceTurn: jest.fn(),
    // Keep original mocks if TurnOrderService specific methods were tested elsewhere
    isEmpty: jest.fn().mockReturnValue(true),
    startNewRound: jest.fn(),
    getNextEntity: jest.fn().mockReturnValue(null),
    clearCurrentRound: jest.fn(),
};
// ****************************************

// ****** MOCK: TurnHandlerResolver (NEW) ******
// Added mock for the required dependency
const mockTurnHandlerResolver = {
    resolveHandler: jest.fn(), // Must have the resolveHandler method
};
// ********************************************


// Mock entities for GameStateManager/TurnManager
// Define these constants or import them if they are used
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
    turnManager: mockTurnManager, // Correct key used
    // ***** FIX: Add the missing turnHandlerResolver mock *****
    turnHandlerResolver: mockTurnHandlerResolver,
    logger: mockLogger,
});

// --- Test Suite ---

describe('GameLoop', () => {
    let gameLoop;
    let promptInputSpy;
    let processNextTurnSpy; // Spy for the new core loop method
    let consoleWarnSpy; // Define spy here to access in afterEach if needed

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

        // Reset Turn Manager Mocks
        mockTurnManager.getCurrentActor.mockReturnValue(null);
        mockTurnManager.start.mockClear();
        mockTurnManager.stop.mockClear();
        mockTurnManager.advanceTurn.mockClear();
        mockTurnManager.isEmpty.mockReturnValue(true);

        // Reset Turn Handler Resolver Mock (NEW)
        mockTurnHandlerResolver.resolveHandler.mockClear(); // Clear its call history
        // Set a default mock implementation if needed for specific tests
        // mockTurnHandlerResolver.resolveHandler.mockReturnValue({ handleTurn: jest.fn() });

        // Reset Entity Manager Mock
        mockEntityManager.activeEntities = new Map();

        // Reset entity mocks
        mockPlayer.hasComponent.mockImplementation((componentId) => componentId === PLAYER_COMPONENT_ID);
        mockNpc.hasComponent.mockImplementation((componentId) => componentId === ACTOR_COMPONENT_ID);

        // Spy on console.warn for logger tests
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
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
        // Restore console spy
        if (consoleWarnSpy) {
            consoleWarnSpy.mockRestore();
            consoleWarnSpy = null;
        }

        // Ensure game loop is stopped if a test accidentally leaves it running
        if (gameLoop && gameLoop.isRunning) {
            // Need to mock stop dependencies if stop() is called here indirectly
            gameLoop.stop();
        }
        gameLoop = null; // Help garbage collection
    });

    // --- Constructor Tests ---
    describe('constructor', () => {
        // --- Existing constructor tests ---
        it('should throw an error if options.gameDataRepository is missing', () => {
            const options = createValidOptions();
            delete options.gameDataRepository;
            expect(() => new GameLoop(options)).toThrow(/options\.gameDataRepository/);
        });

        it('should throw an error if options.entityManager is missing', () => {
            const options = createValidOptions();
            delete options.entityManager;
            expect(() => new GameLoop(options)).toThrow(/options\.entityManager/);
        });

        it('should throw an error if options.gameStateManager is missing', () => {
            const options = createValidOptions();
            delete options.gameStateManager;
            expect(() => new GameLoop(options)).toThrow(/options\.gameStateManager implementing IGameStateManager/);
        });

        it('should throw an error if options.inputHandler is missing or invalid', () => {
            const options = createValidOptions();
            delete options.inputHandler;
            expect(() => new GameLoop(options)).toThrow(/options\.inputHandler implementing IInputHandler/);
            options.inputHandler = {}; // Missing methods
            expect(() => new GameLoop(options)).toThrow(/options\.inputHandler implementing IInputHandler/);
        });

        it('should throw an error if options.commandParser is missing or invalid', () => {
            const options = createValidOptions();
            delete options.commandParser;
            expect(() => new GameLoop(options)).toThrow(/options\.commandParser implementing ICommandParser/);
            options.commandParser = {}; // Missing 'parse'
            expect(() => new GameLoop(options)).toThrow(/options\.commandParser implementing ICommandParser/);
        });

        it('should throw an error if options.actionExecutor is missing or invalid', () => {
            const options = createValidOptions();
            delete options.actionExecutor;
            expect(() => new GameLoop(options)).toThrow(/options\.actionExecutor implementing IActionExecutor/);
            options.actionExecutor = {}; // Missing 'executeAction'
            expect(() => new GameLoop(options)).toThrow(/options\.actionExecutor implementing IActionExecutor/);
        });

        it('should throw an error if options.eventBus is missing or invalid', () => {
            const options = createValidOptions();
            delete options.eventBus;
            expect(() => new GameLoop(options)).toThrow(/options\.eventBus object/); // Match specific message
            options.eventBus = {}; // Missing methods
            expect(() => new GameLoop(options)).toThrow(/options\.eventBus object/);
        });

        it('should throw an error if options.actionDiscoverySystem is missing or invalid', () => {
            const options = createValidOptions();
            delete options.actionDiscoverySystem;
            expect(() => new GameLoop(options)).toThrow(/options\.actionDiscoverySystem implementing IActionDiscoverySystem/);
            options.actionDiscoverySystem = {}; // Missing methods
            expect(() => new GameLoop(options)).toThrow(/options\.actionDiscoverySystem implementing IActionDiscoverySystem/);
        });

        it('should throw an error if options.validatedEventDispatcher is missing or invalid', () => {
            const options = createValidOptions();
            delete options.validatedEventDispatcher;
            expect(() => new GameLoop(options)).toThrow(/options\.validatedEventDispatcher implementing IValidatedEventDispatcher/);
            options.validatedEventDispatcher = {}; // Missing methods
            expect(() => new GameLoop(options)).toThrow(/options\.validatedEventDispatcher implementing IValidatedEventDispatcher/);
        });

        it('should throw an error if options.turnManager is missing or invalid', () => {
            const options = createValidOptions();
            delete options.turnManager;
            expect(() => new GameLoop(options)).toThrow(/options\.turnManager implementing ITurnManager/);

            options.turnManager = {};
            expect(() => new GameLoop(options)).toThrow(/options\.turnManager implementing ITurnManager/);
        });

        // ***** NEW TEST: Test for turnHandlerResolver *****
        it('should throw an error if options.turnHandlerResolver is missing or invalid', () => {
            const options = createValidOptions();
            // Delete the required property
            delete options.turnHandlerResolver;
            // Expect the specific error message
            expect(() => new GameLoop(options)).toThrow(/options\.turnHandlerResolver implementing ITurnHandlerResolver/);

            // Also test invalid object (missing method)
            options.turnHandlerResolver = {};
            expect(() => new GameLoop(options)).toThrow(/options\.turnHandlerResolver implementing ITurnHandlerResolver/);
        });
        // ***********************************************

        it('should throw an error if options object itself is missing', () => {
            expect(() => new GameLoop(undefined)).toThrow(/options\.gameDataRepository/);
            expect(() => new GameLoop(null)).toThrow(/options\.gameDataRepository/);
        });

        // ***** FIX: This test should now pass because createValidOptions includes turnHandlerResolver *****
        it('should successfully instantiate with valid mock dependencies', () => {
            // Now that createValidOptions provides all dependencies, this should not throw
            expect(() => new GameLoop(createValidOptions())).not.toThrow();
        });

        // ***** FIX: This test should now pass the constructor call *****
        it("should subscribe to 'command:submit' on the event bus during construction", () => {
            // Constructor call should succeed now
            new GameLoop(createValidOptions());
            expect(mockEventBus.subscribe).toHaveBeenCalledWith(
                'command:submit',
                expect.any(Function)
            );
            // Check other subscriptions
            expect(mockEventBus.subscribe).toHaveBeenCalledWith(
                'turn:actor_changed',
                expect.any(Function)
            );
            expect(mockEventBus.subscribe).toHaveBeenCalledWith(
                'turn:manager_stopped',
                expect.any(Function)
            );
            // Check total number of subscriptions expected
            expect(mockEventBus.subscribe).toHaveBeenCalledTimes(3); // submit, actor_changed, manager_stopped
        });

        // ***** FIX: This test should now pass the constructor call *****
        it('should initialize isRunning state to false', () => {
            // Constructor call should succeed now
            gameLoop = new GameLoop(createValidOptions());
            expect(gameLoop.isRunning).toBe(false);
        });

        // Optional: Test logger fallback
        it('should fallback to console if logger is invalid', () => {
            // consoleWarnSpy is set up in beforeEach
            const options = createValidOptions();
            options.logger = {}; // Invalid logger

            expect(() => new GameLoop(options)).not.toThrow(/options\.logger/); // Shouldn't throw for logger
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid logger provided. Falling back to console.'));
            consoleWarnSpy.mockClear(); // Clear calls before next check

            options.logger = null; // Test null logger
            expect(() => new GameLoop(options)).not.toThrow(/options\.logger/);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid logger provided. Falling back to console.'));

            // No need to restore spy here, afterEach handles it
        });

        // Optional: Test logger usage if valid
        it('should use the provided valid logger', () => {
            // consoleWarnSpy is set up in beforeEach
            // createValidOptions provides a valid mockLogger by default
            const options = createValidOptions();

            // Constructor call should now succeed
            expect(() => new GameLoop(options)).not.toThrow();

            // Ensure the fallback warning was NOT called
            expect(consoleWarnSpy).not.toHaveBeenCalled();

            // Check if the provided logger was used for the info message during construction
            expect(mockLogger.info).toHaveBeenCalledWith('GameLoop: Instance created with dependencies. Ready to start.');

            // No need to restore spy here, afterEach handles it
        });

    }); // End describe('constructor')

    // --- Other test suites (start, stop, event handling etc.) would go here ---

}); // End describe('GameLoop')
