// src/tests/core/gameLoop.constructor.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import GameLoop from '../../core/GameLoop.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from "../../types/components.js";

// --- Mock Dependencies ---
const mockEventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
};
const mockGameStateManager = {
    getPlayer: jest.fn(),
    getCurrentLocation: jest.fn(),
    setPlayer: jest.fn(),
    setCurrentLocation: jest.fn()
};
const mockGameDataRepository = {};
const mockEntityManager = {
    activeEntities: new Map()
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
const mockTurnManager = {
    start: jest.fn(),
    stop: jest.fn(),
    getCurrentActor: jest.fn().mockReturnValue(null),
    advanceTurn: jest.fn(),
    isEmpty: jest.fn().mockReturnValue(true),
    startNewRound: jest.fn(),
    getNextEntity: jest.fn().mockReturnValue(null),
    clearCurrentRound: jest.fn(),
};
const mockTurnHandlerResolver = {
    resolveHandler: jest.fn(),
};


// Mock entities
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
const mockLocation = {id: 'room:test', name: 'Test Chamber', getComponent: jest.fn()};

// Helper to create a complete, valid options object
const createValidOptions = () => ({
    gameDataRepository: mockGameDataRepository,
    entityManager: mockEntityManager,
    gameStateManager: mockGameStateManager,
    actionExecutor: mockActionExecutor,
    eventBus: mockEventBus,
    actionDiscoverySystem: mockActionDiscoverySystem,
    validatedEventDispatcher: mockvalidatedEventDispatcher,
    turnManager: mockTurnManager,
    turnHandlerResolver: mockTurnHandlerResolver,
    logger: mockLogger,
});

// --- Test Suite ---

describe('GameLoop', () => {
    let gameLoop;
    let consoleWarnSpy;

    // Reset mocks before each test to ensure isolation
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

        // Reset Turn Manager Mocks
        mockTurnManager.getCurrentActor.mockReturnValue(null);
        mockTurnManager.start.mockClear();
        mockTurnManager.stop.mockClear();
        mockTurnManager.advanceTurn.mockClear();
        mockTurnManager.isEmpty.mockReturnValue(true);

        // Reset Turn Handler Resolver Mock
        mockTurnHandlerResolver.resolveHandler.mockClear();

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
        // Restore console spy
        if (consoleWarnSpy) {
            consoleWarnSpy.mockRestore();
            consoleWarnSpy = null;
        }

        // Ensure game loop is stopped if a test accidentally leaves it running
        if (gameLoop && gameLoop.isRunning) {
            try {
                // We might need to mock dependencies for stop() if called here,
                // but ideally tests should clean up themselves.
                // For safety, let's mock the unsubscribe just in case.
                mockEventBus.unsubscribe.mockClear(); // Clear previous calls
                gameLoop.stop();
            } catch (e) {
                console.error("Error stopping gameLoop in afterEach:", e);
            }
        }
        gameLoop = null;
    });

    // --- Constructor Tests ---
    describe('constructor', () => {
        // --- Dependency Validation Tests ---
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

        it('should throw an error if options.turnHandlerResolver is missing or invalid', () => {
            const options = createValidOptions();
            delete options.turnHandlerResolver;
            expect(() => new GameLoop(options)).toThrow(/options\.turnHandlerResolver implementing ITurnHandlerResolver/);

            options.turnHandlerResolver = {};
            expect(() => new GameLoop(options)).toThrow(/options\.turnHandlerResolver implementing ITurnHandlerResolver/);
        });

        it('should throw an error if options object itself is missing', () => {
            expect(() => new GameLoop(undefined)).toThrow(/options\.gameDataRepository/);
            expect(() => new GameLoop(null)).toThrow(/options\.gameDataRepository/);
        });

        it('should successfully instantiate with valid mock dependencies', () => {
            expect(() => new GameLoop(createValidOptions())).not.toThrow();
        });

        // ***** TEST REMOVED *****
        // This test is no longer valid because subscriptions were moved from the constructor to the start() method.
        // it("should subscribe to required events on the event bus during construction", () => { ... });
        // ************************

        it('should initialize isRunning state to false', () => {
            gameLoop = new GameLoop(createValidOptions());
            expect(gameLoop.isRunning).toBe(false);
            // Also ensure subscribe was NOT called in constructor
            expect(mockEventBus.subscribe).not.toHaveBeenCalled();
        });

        // --- Logger Tests ---
        it('should fallback to console if logger is invalid', () => {
            const options = createValidOptions();
            options.logger = {}; // Invalid logger

            expect(() => new GameLoop(options)).not.toThrow(/options\.logger/);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid logger provided. Falling back to console.'));
            consoleWarnSpy.mockClear();

            options.logger = null; // Test null logger
            expect(() => new GameLoop(options)).not.toThrow(/options\.logger/);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid logger provided. Falling back to console.'));
        });

        it('should use the provided valid logger', () => {
            const options = createValidOptions();
            expect(() => new GameLoop(options)).not.toThrow();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith('GameLoop: Instance created with dependencies. Ready to start.');
        });

    }); // End describe('constructor')

}); // End describe('GameLoop')