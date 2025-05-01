// src/tests/core/gameLoop.internalEventHandling.test.js
// ****** CORRECTED FILE ******
// Removed tests for #handleSubmittedCommandFromEvent as per Ticket 3.1.6.5

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import GameLoop from '../../core/GameLoop.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from "../../types/components.js";

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
const mockGameDataRepository = {};
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
const mockTurnManager = {
    start: jest.fn(),
    stop: jest.fn(),
    getCurrentActor: jest.fn().mockReturnValue(null),
    advanceTurn: jest.fn(),
    isEmpty: jest.fn().mockReturnValue(true),
    startNewRound: jest.fn(),
    clearCurrentRound: jest.fn(),
};
// ****** ADDED MOCK FOR TURN HANDLER RESOLVER ******
const mockTurnHandlerResolver = {
    resolveHandler: jest.fn()
};
// ***************************************************


// Mock entities
const mockPlayer = {
    id: 'player1',
    name: 'Tester',
    getComponent: jest.fn(),
    hasComponent: jest.fn((componentId) =>
        componentId === PLAYER_COMPONENT_ID || componentId === ACTOR_COMPONENT_ID
    )
};
const mockNpc = {
    id: 'npc1',
    name: 'Goblin',
    getComponent: jest.fn(),
    hasComponent: jest.fn((componentId) => componentId === ACTOR_COMPONENT_ID)
};
const mockLocation = {id: 'room:test', name: 'Test Chamber', getComponent: jest.fn()};

// ****** Helper Function (Corrected) ******
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
    turnHandlerResolver: mockTurnHandlerResolver, // <-- Added missing mock
    logger: mockLogger,
});
// ****** Helper Function END ******


// --- Test Suite ---
describe('GameLoop', () => {
    let gameLoop = null; // Define in outer scope for cleanup in afterEach
    let processCmdSpy = null; // Define spies in outer scope
    let promptInputSpy = null;

    // --- Top Level Setup ---
    beforeEach(() => {
        // Clear ALL mocks ONCE at the beginning of EACH test run (for both describe blocks)
        jest.clearAllMocks();

        // --- Reset mocks to default states ---
        mockGameStateManager.getPlayer.mockReturnValue(null);
        mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
        mockActionExecutor.executeAction.mockResolvedValue({success: true, messages: []});
        mockCommandParser.parse.mockReturnValue({actionId: null, error: 'Default mock parse', originalInput: ''});
        // Reset TurnManager mocks (can use mockClear, but resetting return values is safer)
        mockTurnManager.start.mockResolvedValue();
        mockTurnManager.stop.mockResolvedValue();
        mockTurnManager.getCurrentActor.mockReturnValue(null);
        mockTurnManager.advanceTurn.mockResolvedValue();
        mockTurnManager.isEmpty.mockReturnValue(true);
        // Reset Entity mocks (critical!) - Restore default implementation after clearAllMocks
        mockPlayer.hasComponent.mockImplementation((id) => id === PLAYER_COMPONENT_ID || id === ACTOR_COMPONENT_ID);
        mockNpc.hasComponent.mockImplementation((id) => id === ACTOR_COMPONENT_ID);
        // Reset other mocks if necessary
        mockActionDiscoverySystem.getValidActions.mockResolvedValue([]);
        mockEntityManager.activeEntities = new Map();
        mockTurnHandlerResolver.resolveHandler.mockReturnValue(null); // Default mock return for resolver if needed
    });

    // General cleanup after ANY test in this file
    afterEach(async () => {
        // Restore spies
        if (processCmdSpy) processCmdSpy.mockRestore();
        if (promptInputSpy) promptInputSpy.mockRestore();
        processCmdSpy = null;
        promptInputSpy = null;

        // Stop and nullify game loop instance
        if (gameLoop && gameLoop.isRunning) {
            await gameLoop.stop(); // Ensure stop is called if running
        }
        if (gameLoop && typeof gameLoop.stop === 'function' && !gameLoop.isRunning) {
            // If not running but instance exists, ensure turn manager stop is called if needed
            // This might be redundant if stop() always calls turnManager.stop()
            await gameLoop.stop(); // Call stop anyway to ensure cleanup consistency? Or just nullify? Let's nullify for now.
        }
        gameLoop = null;
    });


    // --- Internal Event Handling (#handleSubmittedCommandFromEvent) ---
    // ***** SECTION REMOVED AS PER TICKET 3.1.6.5 *****
    // describe('Internal Event Handling (#handleSubmittedCommandFromEvent)', () => {
    //     ... tests for the removed handler ...
    // });
    // *****************************************************

    // Placeholder test to ensure the suite still runs
    it('should have other tests for remaining internal event handlers (e.g., turn changes)', () => {
        expect(true).toBe(true);
        // TODO: Add tests for #handleTurnActorChanged and #handleTurnManagerStopped
    });


}); // End describe GameLoop