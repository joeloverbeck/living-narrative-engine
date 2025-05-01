// src/tests/core/gameLoop.promptInput.test.js
// ****** MODIFIED FILE ******

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
// REMOVED: mockInputHandler
// const mockInputHandler = {
//     enable: jest.fn(),
//     disable: jest.fn(),
//     clear: jest.fn(),
//     setCommandCallback: jest.fn()
// };
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
// REMOVED: mockCommandParser
// const mockCommandParser = {
//     parse: jest.fn(),
// };
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
    // REMOVED: inputHandler: mockInputHandler,
    // REMOVED: commandParser: mockCommandParser,
    actionExecutor: mockActionExecutor,
    eventBus: mockEventBus,
    actionDiscoverySystem: mockActionDiscoverySystem,
    validatedEventDispatcher: mockvalidatedEventDispatcher,
    turnManager: mockTurnManager,
    turnHandlerResolver: mockTurnHandlerResolver, // <<< ADDED THE MISSING DEPENDENCY
    logger: mockLogger,
});

// --- Test Suite ---

describe('GameLoop (promptInput tests removed)', () => {
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

        // Reset Command Parser Mock (No longer needed)
        // mockCommandParser.parse.mockReturnValue({actionId: null, error: 'Default mock parse', originalInput: ''});

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


    // --- promptInput() Method Tests REMOVED ---
    // Note: Tests for _promptPlayerInput functionality (via the deprecated promptInput method)
    // have been removed as per ticket 3.1.6.4.
    // The PlayerTurnHandler should now be tested for this input prompting logic.

    it('Placeholder test: Ensures the suite runs after removing promptInput tests', () => {
        // Create instance to ensure constructor passes with updated options
        expect(() => new GameLoop(createValidOptions())).not.toThrow();
        expect(true).toBe(true);
    });


}); // End describe('GameLoop')