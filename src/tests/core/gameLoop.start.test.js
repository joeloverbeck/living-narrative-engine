// src/tests/core/gameLoop.start.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import GameLoop from '../../core/GameLoop.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from "../../types/components.js"; // Import component IDs

// --- Mock Dependencies ---
const mockEventBus = {
    dispatch: jest.fn().mockResolvedValue(undefined), // Make async if needed
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
const mockValidatedEventDispatcher = { // Corrected variable name casing
    dispatchValidated: jest.fn().mockResolvedValue(undefined), // Make async
};

// NEW: Mock for ITurnManager interface
const mockTurnManager = {
    start: jest.fn().mockResolvedValue(undefined), // GameLoop awaits this
    stop: jest.fn().mockResolvedValue(undefined),  // GameLoop awaits this
    getCurrentActor: jest.fn().mockReturnValue(null), // Returns the entity or null
    advanceTurn: jest.fn().mockResolvedValue(undefined) // GameLoop awaits this
};


// Mock entities
const mockPlayer = {
    id: 'player1',
    name: 'Tester',
    getComponent: jest.fn(),
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
    validatedEventDispatcher: mockValidatedEventDispatcher, // Corrected variable name
    turnManager: mockTurnManager, // Use the correct key and the new mock
    logger: mockLogger,
});

// --- Test Suite ---

describe('GameLoop', () => {
    let gameLoop;

    // Reset mocks before each test to ensure isolation (Top Level)
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset Game State Manager Mocks
        mockGameStateManager.getPlayer.mockReturnValue(null); // Default to no player initially
        mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation); // Default location

        // Reset Action Executor Mock
        mockActionExecutor.executeAction.mockResolvedValue({
            success: true,
            messages: [{text: 'Default mock action executed'}]
        });

        // Reset Command Parser Mock
        mockCommandParser.parse.mockReturnValue({actionId: null, error: 'Default mock parse', originalInput: ''});

        // Reset Turn Manager Mocks (Defaults for ITurnManager)
        mockTurnManager.start.mockClear().mockResolvedValue(undefined);
        mockTurnManager.stop.mockClear().mockResolvedValue(undefined);
        mockTurnManager.getCurrentActor.mockClear().mockReturnValue(null); // Start with no actor
        mockTurnManager.advanceTurn.mockClear().mockResolvedValue(undefined);


        // Reset Entity Manager Mock
        mockEntityManager.activeEntities = new Map(); // Clear entities

        // Reset entity mocks
        mockPlayer.hasComponent.mockImplementation((componentId) => {
            return componentId === PLAYER_COMPONENT_ID || componentId === ACTOR_COMPONENT_ID;
        });
        mockNpc.hasComponent.mockImplementation((componentId) => componentId === ACTOR_COMPONENT_ID);

        // Reset Event Dispatcher Mocks
        mockValidatedEventDispatcher.dispatchValidated.mockClear();
        mockEventBus.dispatch.mockClear(); // Also clear the regular event bus

    });

    afterEach(async () => { // Make afterEach async if stop() is async
        // Ensure game loop is stopped if a test accidentally leaves it running
        if (gameLoop && gameLoop.isRunning) {
            await gameLoop.stop(); // Call async stop to clean up
        }
        gameLoop = null; // Help GC
    });


    // --- start() Method Tests ---
    describe('start', () => {
        // No specific beforeEach needed here anymore, as GameLoop creation is the SUT
        // The top-level beforeEach handles general mock setup.

        it('Success Case: should set isRunning to true, log info, dispatch game:started, and start TurnManager', async () => {
            // Setup necessary preconditions if any (e.g., player entity)
            // Although start doesn't directly use entities, TurnManager might implicitly need them later.
            mockEntityManager.activeEntities.set(mockPlayer.id, mockPlayer);
            mockGameStateManager.getPlayer.mockReturnValue(mockPlayer); // If needed for some internal logic

            // Create GameLoop instance WITHIN the test or a specific beforeEach for this describe
            gameLoop = new GameLoop(createValidOptions());
            expect(gameLoop.isRunning).toBe(false); // Pre-condition

            await gameLoop.start(); // Call start

            // Assertions: Check the direct effects of start()
            expect(gameLoop.isRunning).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith('GameLoop: Started.');
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('game:started', {});

            // Assert that the TurnManager was started
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);

            // Assertion removed: Checking for 'textUI:enable_input' here is testing implementation detail
            // of the turn manager event flow, not the start() method directly.
            // expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(...)
        });

        it('should log a warning and not change state or call TurnManager.start if already running', async () => {
            // Create GameLoop instance
            gameLoop = new GameLoop(createValidOptions());

            // Start it once
            await gameLoop.start();
            expect(gameLoop.isRunning).toBe(true);

            // --- Reset mocks called by the FIRST start ---
            mockLogger.info.mockClear(); // Clear info logs from first start
            mockLogger.warn.mockClear();
            mockEventBus.dispatch.mockClear();
            mockTurnManager.start.mockClear(); // Clear the start call from the first run

            // --- Call start again ---
            await gameLoop.start();

            // Assertions for the SECOND call
            expect(gameLoop.isRunning).toBe(true); // Should still be true
            expect(mockLogger.warn).toHaveBeenCalledWith('GameLoop: start() called but loop is already running.');
            expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Ensure only called once for the second attempt

            // Ensure game state wasn't significantly altered by the second call
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('game:started', {});
            expect(mockTurnManager.start).not.toHaveBeenCalled(); // Crucial: TurnManager.start should not be called again
            // expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:enable_input', expect.anything()); // This wasn't called anyway

        });

        it('should log error, dispatch message, and stop if TurnManager.start() fails', async () => {
            // Arrange: Setup TurnManager.start to reject
            const startError = new Error("TurnManager failed to initialize");
            mockTurnManager.start.mockRejectedValue(startError);

            // Create GameLoop instance
            gameLoop = new GameLoop(createValidOptions());

            expect(gameLoop.isRunning).toBe(false); // Pre-condition

            // Act: Call start, expecting it to handle the error
            await gameLoop.start();

            // Assert: Check that the loop attempted to start but then stopped
            expect(gameLoop.isRunning).toBe(false); // Should be false after failure and subsequent stop()
            expect(mockLogger.error).toHaveBeenCalledWith(
                `GameLoop: Failed to start TurnManager: ${startError.message}`,
                startError // Check if the error object itself was logged
            );
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:display_message', {
                text: `Critical Error: Could not start turn management. ${startError.message}`,
                type: 'error'
            });

            // Check that stop() was called implicitly (by checking mocks called within stop)
            expect(mockInputHandler.disable).toHaveBeenCalled();
            expect(mockTurnManager.stop).toHaveBeenCalled(); // GameLoop's stop calls TurnManager's stop
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('game:stopped', {}); // Stop should dispatch this
        });


    });

    // --- Other describe blocks for stop(), processSubmittedCommand(), etc. would go here ---

}); // End describe('GameLoop')

// --- Type Imports --- (Keep these updated)
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/interfaces/IGameStateManager.js').IGameStateManager} IGameStateManager */ // Use Interface
/** @typedef {import('../core/interfaces/IInputHandler.js').IInputHandler} IInputHandler */ // Use Interface
/** @typedef {import('../core/interfaces/ICommandParser.js').ICommandParser} ICommandParser */ // Use Interface
/** @typedef {import('../core/interfaces/IActionExecutor.js').IActionExecutor} IActionExecutor */ // Use Interface
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../core/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */ // Use Interface
/** @typedef {import('../core/interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */ // Use Interface
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../core/interfaces/ITurnManager.js').ITurnManager} ITurnManager */ // Use Interface
/** @typedef {import('../core/interfaces/ITurnOrderService.js').TurnOrderStrategy} TurnOrderStrategy */ // Keep if needed elsewhere, but not directly by GameLoop


// --- Define the options object structure --- (Keep aligned with GameLoop constructor)
/**
 * @typedef {object} GameLoopOptions
 * @property {GameDataRepository} gameDataRepository
 * @property {EntityManager} entityManager
 * @property {IGameStateManager} gameStateManager
 * @property {IInputHandler} inputHandler
 * @property {ICommandParser} commandParser
 * @property {IActionExecutor} actionExecutor
 * @property {EventBus} eventBus
 * @property {IActionDiscoverySystem} actionDiscoverySystem
 * @property {IValidatedEventDispatcher} validatedEventDispatcher
 * @property {ITurnManager} turnManager // Changed from turnOrderService
 * @property {ILogger} logger
 */