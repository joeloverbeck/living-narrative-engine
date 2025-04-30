// src/tests/core/GameLoop.test.js

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
            expect(() => new GameLoop(options)).toThrow(/options\.gameStateManager/);
        });

        it('should throw an error if options.inputHandler is missing or invalid', () => {
            const options = createValidOptions();
            delete options.inputHandler;
            expect(() => new GameLoop(options)).toThrow(/options\.inputHandler/);
            options.inputHandler = {}; // Missing methods
            expect(() => new GameLoop(options)).toThrow(/options\.inputHandler/);
        });

        it('should throw an error if options.commandParser is missing or invalid', () => {
            const options = createValidOptions();
            delete options.commandParser;
            expect(() => new GameLoop(options)).toThrow(/options\.commandParser/);
            options.commandParser = {}; // Missing 'parse'
            expect(() => new GameLoop(options)).toThrow(/options\.commandParser/);
        });

        it('should throw an error if options.actionExecutor is missing or invalid', () => {
            const options = createValidOptions();
            delete options.actionExecutor;
            expect(() => new GameLoop(options)).toThrow(/options\.actionExecutor/);
            options.actionExecutor = {}; // Missing 'executeAction'
            expect(() => new GameLoop(options)).toThrow(/options\.actionExecutor/);
        });

        it('should throw an error if options.eventBus is missing or invalid', () => {
            const options = createValidOptions();
            delete options.eventBus;
            expect(() => new GameLoop(options)).toThrow(/options\.eventBus/);
            options.eventBus = {}; // Missing methods
            expect(() => new GameLoop(options)).toThrow(/options\.eventBus/);
        });

        it('should throw an error if options.actionDiscoverySystem is missing or invalid', () => {
            const options = createValidOptions();
            delete options.actionDiscoverySystem;
            expect(() => new GameLoop(options)).toThrow(/options\.actionDiscoverySystem/);
            options.actionDiscoverySystem = {}; // Missing methods
            expect(() => new GameLoop(options)).toThrow(/options\.actionDiscoverySystem/);
        });

        it('should throw an error if options.validatedEventDispatcher is missing or invalid', () => {
            const options = createValidOptions();
            delete options.validatedEventDispatcher;
            expect(() => new GameLoop(options)).toThrow(/options\.validatedEventDispatcher/);
            options.validatedEventDispatcher = {}; // Missing methods
            expect(() => new GameLoop(options)).toThrow(/options\.validatedEventDispatcher/);
        });

        it('should throw an error if options.turnOrderService is missing', () => { // ***** NEW TEST *****
            const options = createValidOptions();
            delete options.turnOrderService;
            expect(() => new GameLoop(options)).toThrow(/options\.turnOrderService/);
        });

        it('should throw an error if options object itself is missing', () => {
            // Checks the first required dependency listed in the constructor
            expect(() => new GameLoop(undefined)).toThrow(/options\.gameDataRepository/);
        });

        it('should successfully instantiate with valid mock dependencies', () => {
            expect(() => new GameLoop(createValidOptions())).not.toThrow();
        });

        it("should subscribe to 'command:submit' on the event bus during construction", () => {
            new GameLoop(createValidOptions());
            expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
            expect(mockEventBus.subscribe).toHaveBeenCalledWith(
                'command:submit',
                expect.any(Function) // Check that it subscribed with a function handler
            );
        });

        it('should initialize isRunning state to false', () => {
            gameLoop = new GameLoop(createValidOptions());
            expect(gameLoop.isRunning).toBe(false);
        });
    });

}); // End describe('GameLoop')
