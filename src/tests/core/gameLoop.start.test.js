// src/tests/core/gameLoop.start.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import GameLoop from '../../core/GameLoop.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from "../../types/components.js"; // Import component IDs

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
    getPlayer: jest.fn(),
    getCurrentLocation: jest.fn(),
    setPlayer: jest.fn(),
    setCurrentLocation: jest.fn()
};
const mockGameDataRepository = {};
const mockEntityManager = {
    activeEntities: new Map() // Initialized empty, will be populated in tests
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
const mockTurnOrderService = {
    isEmpty: jest.fn().mockReturnValue(true), // Default: empty
    startNewRound: jest.fn(),
    getNextEntity: jest.fn().mockReturnValue(null), // Default: null
    clearCurrentRound: jest.fn(),
};

// Mock entities
const mockPlayer = {
    id: 'player1',
    name: 'Tester',
    getComponent: jest.fn(),
    // *** IMPORTANT: Mock hasComponent to handle both PLAYER and ACTOR checks ***
    hasComponent: jest.fn((componentId) => {
        return componentId === PLAYER_COMPONENT_ID || componentId === ACTOR_COMPONENT_ID;
    })
};
const mockNpc = { // Keep NPC mock for potential future tests
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

    // Reset mocks before each test to ensure isolation (Top Level)
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset Game State Manager Mocks
        mockGameStateManager.getPlayer.mockReturnValue(null);
        mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);

        // Reset Action Executor Mock
        mockActionExecutor.executeAction.mockResolvedValue({
            success: true,
            messages: [{text: 'Default mock action executed'}]
        });

        // Reset Command Parser Mock
        mockCommandParser.parse.mockReturnValue({actionId: null, error: 'Default mock parse', originalInput: ''});

        // Reset Turn Order Service Mocks (Defaults)
        // Ensure isEmpty mock implementation is reset correctly *before* potentially setting it statefully
        mockTurnOrderService.isEmpty.mockReset().mockReturnValue(true);
        mockTurnOrderService.getNextEntity.mockReset().mockReturnValue(null);
        mockTurnOrderService.startNewRound.mockReset(); // Also reset startNewRound calls
        mockTurnOrderService.clearCurrentRound.mockReset();


        // Reset Entity Manager Mock
        mockEntityManager.activeEntities = new Map(); // Clear entities

        // Reset entity mocks (Ensure hasComponent is reset if modified in specific tests)
        mockPlayer.hasComponent.mockImplementation((componentId) => {
            return componentId === PLAYER_COMPONENT_ID || componentId === ACTOR_COMPONENT_ID;
        });
        mockNpc.hasComponent.mockImplementation((componentId) => componentId === ACTOR_COMPONENT_ID);
    });

    afterEach(() => {
        // Ensure game loop is stopped if a test accidentally leaves it running
        if (gameLoop && gameLoop.isRunning) {
            gameLoop.stop(); // Call stop to clean up
        }
        gameLoop = null; // Help GC
    });


    // --- start() Method Tests ---
    describe('start', () => {
        beforeEach(() => {
            // *** Setup mocks specifically for start() tests to prevent immediate stop() ***

            // 1. Ensure an actor exists in the EntityManager
            mockEntityManager.activeEntities.set(mockPlayer.id, mockPlayer);

            // 2. Configure TurnOrderService behavior for the first turn cycle:
            //    - isEmpty() returns true initially (triggers startNewRound)
            //    - isEmpty() returns false subsequently (indicates round started)
            //    - getNextEntity() returns the player after the round starts
            mockTurnOrderService.isEmpty.mockReturnValueOnce(true).mockReturnValue(false);
            mockTurnOrderService.getNextEntity.mockReturnValue(mockPlayer);

            // 3. Ensure GameStateManager can provide a location for the player
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);


            // Create GameLoop instance AFTER setting up mocks for this specific describe block
            gameLoop = new GameLoop(createValidOptions());

        });

        it('Success Case: should set isRunning to true, log info, and dispatch game:started', async () => {
            expect(gameLoop.isRunning).toBe(false); // Pre-condition

            await gameLoop.start(); // Call start

            // Assertions: Check the direct effects of start()
            expect(gameLoop.isRunning).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith('GameLoop: Started.');
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('game:started', {});

            // Indirect assertion: _processNextTurn should have run, found the player,
            // and called promptInput (via textUI:enable_input event)
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'textUI:enable_input',
                expect.objectContaining({entityId: mockPlayer.id})
            );
            // Check if TurnOrderService methods were called as expected
            // --- REMOVED INCORRECT ASSERTION --- expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
            expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith(
                [mockPlayer], // Should have found the player actor
                'round-robin' // The default strategy in GameLoop
            );
            // Check the CORRECT total number of calls for isEmpty
            expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(2); // Initial check + check after recursive call
            expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1); // Called after startNewRound

        });

        it('should log a warning and not change state if already running', async () => {
            // Start it once (setup in beforeEach handles the mocks for this)
            await gameLoop.start();
            expect(gameLoop.isRunning).toBe(true);

            // --- Reset mocks called by the FIRST start ---
            // Clear calls, but DO NOT reset the mock implementation set in the describe's beforeEach
            mockLogger.warn.mockClear();
            mockEventBus.dispatch.mockClear();
            mockTurnOrderService.startNewRound.mockClear();
            mockTurnOrderService.getNextEntity.mockClear();
            mockTurnOrderService.isEmpty.mockClear(); // Clear calls to isEmpty as well
            mockvalidatedEventDispatcher.dispatchValidated.mockClear();

            // --- Call start again ---
            await gameLoop.start();

            // Assertions for the SECOND call
            expect(gameLoop.isRunning).toBe(true); // Should still be true
            expect(mockLogger.warn).toHaveBeenCalledWith('GameLoop: start() called but loop is already running.');
            expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Ensure only called once

            // Ensure game state wasn't significantly altered by the second call
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('game:started', {});
            expect(mockTurnOrderService.isEmpty).not.toHaveBeenCalled(); // Should not be called again
            expect(mockTurnOrderService.startNewRound).not.toHaveBeenCalled();
            expect(mockTurnOrderService.getNextEntity).not.toHaveBeenCalled();
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:enable_input', expect.anything());


        });
    });

    // --- Other describe blocks for stop(), processSubmittedCommand(), etc. would go here ---

}); // End describe('GameLoop')

// --- Type Imports ---
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/gameStateManager.js').default} GameStateManager */
/** @typedef {import('../core/inputHandler.js').default} InputHandler */
/** @typedef {import('../core/commandParser.js').default} CommandParser */
/** @typedef {import('../../actions/actionExecutor.js').default} ActionExecutor */
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../systems/actionDiscoverySystem.js').ActionDiscoverySystem} ActionDiscoverySystem */
/** @typedef {import('../core/services/consoleLogger.js').default} ILogger */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../core/interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../core/interfaces/ITurnOrderService.js').TurnOrderStrategy} TurnOrderStrategy */


// --- Define the options object structure ---
/**
 * @typedef {object} GameLoopOptions
 * @property {GameDataRepository} gameDataRepository
 * @property {EntityManager} entityManager
 * @property {GameStateManager} gameStateManager
 * @property {InputHandler} inputHandler
 * @property {CommandParser} commandParser
 * @property {ActionExecutor} actionExecutor
 * @property {EventBus} eventBus
 * @property {ActionDiscoverySystem} actionDiscoverySystem
 * @property {ValidatedEventDispatcher} validatedEventDispatcher
 * @property {ITurnOrderService} turnOrderService
 * @property {ILogger} logger
 */