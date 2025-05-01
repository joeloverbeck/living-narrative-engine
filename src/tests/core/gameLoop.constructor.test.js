// src/tests/core/gameLoop.constructor.test.js

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


// Mock entities for GameStateManager/TurnManager
const mockPlayer = {
    id: 'player1',
    name: 'Tester',
    getComponent: jest.fn(),
    hasComponent: jest.fn((componentId) => componentId === PLAYER_COMPONENT_ID) // Assuming PLAYER_COMPONENT_ID is defined elsewhere or imported
};
const mockNpc = {
    id: 'npc1',
    name: 'Goblin',
    getComponent: jest.fn(),
    hasComponent: jest.fn((componentId) => componentId === ACTOR_COMPONENT_ID) // Assuming ACTOR_COMPONENT_ID is defined elsewhere or imported
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
    // ***** FIX: Use turnManager key and the correctly named mock *****
    turnManager: mockTurnManager,
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

        // Reset Turn Manager Mocks
        // Use the correct mock name here too
        mockTurnManager.getCurrentActor.mockReturnValue(null); // Default to no entity available
        mockTurnManager.start.mockClear(); // Clear call history for methods checked in constructor
        mockTurnManager.stop.mockClear();
        mockTurnManager.advanceTurn.mockClear();
        // Clear any other TurnManager mocks used in other tests if needed
        mockTurnManager.isEmpty.mockReturnValue(true);

        // Reset Entity Manager Mock (Example: Clear active entities if needed)
        mockEntityManager.activeEntities = new Map();

        // Reset entity mocks (ensure clean state for hasComponent etc.)
        // Define these constants or import them if they are used
        const PLAYER_COMPONENT_ID = 'player';
        const ACTOR_COMPONENT_ID = 'actor';
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
            // Match more specific part of the error message if desired
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

        // ***** FIX: Test for turnManager, delete turnManager, expect turnManager error *****
        it('should throw an error if options.turnManager is missing or invalid', () => {
            const options = createValidOptions();
            // Delete the correct property
            delete options.turnManager;
            // Expect the error message thrown by the constructor for turnManager
            expect(() => new GameLoop(options)).toThrow(/options\.turnManager implementing ITurnManager/);

            // Also test invalid object (missing methods)
            options.turnManager = {};
            expect(() => new GameLoop(options)).toThrow(/options\.turnManager implementing ITurnManager/);
        });

        it('should throw an error if options object itself is missing', () => {
            // Checks the first required dependency listed in the constructor (after logger)
            expect(() => new GameLoop(undefined)).toThrow(/options\.gameDataRepository/);
            expect(() => new GameLoop(null)).toThrow(/options\.gameDataRepository/); // Also test null
        });

        // ***** FIX: This test should now pass because createValidOptions provides turnManager *****
        it('should successfully instantiate with valid mock dependencies', () => {
            expect(() => new GameLoop(createValidOptions())).not.toThrow();
        });

        // ***** FIX: This test should now pass the constructor call *****
        it("should subscribe to 'command:submit' on the event bus during construction", () => {
            // Constructor call should succeed now
            new GameLoop(createValidOptions());
            expect(mockEventBus.subscribe).toHaveBeenCalledWith(
                'command:submit',
                expect.any(Function) // Check that it subscribed with a function handler
            );
            // Add check for other subscriptions if needed, like 'turn:actor_changed'
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
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            }); // Suppress actual console output
            const options = createValidOptions();
            options.logger = {}; // Invalid logger

            expect(() => new GameLoop(options)).not.toThrow(/options\.logger/); // Shouldn't throw for logger
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid logger provided. Falling back to console.'));

            options.logger = null; // Test null logger
            expect(() => new GameLoop(options)).not.toThrow(/options\.logger/);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid logger provided. Falling back to console.'));

            consoleWarnSpy.mockRestore(); // Clean up spy
        });

        // Optional: Test logger usage if valid
        it('should use the provided valid logger', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            // createValidOptions provides a valid mockLogger
            const options = createValidOptions();

            expect(() => new GameLoop(options)).not.toThrow();
            // Ensure the fallback warning was NOT called
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            // Check if the provided logger was used for the info message
            expect(mockLogger.info).toHaveBeenCalledWith('GameLoop: Instance created with dependencies. Ready to start.');

            consoleWarnSpy.mockRestore();
        });

    }); // End describe('constructor')

    // --- Other test suites (start, stop, event handling etc.) would go here ---

}); // End describe('GameLoop')