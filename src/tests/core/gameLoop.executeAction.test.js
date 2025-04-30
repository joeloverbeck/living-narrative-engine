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


    // --- executeAction Tests (Ticket 4.3.3) ---
    // These seem correct based on the provided GameLoop executeAction implementation
    describe('executeAction', () => {

        // Define representative ParsedCommand objects
        const parsedCmdV = {
            actionId: 'action:inventory', directObjectPhrase: null, preposition: null, indirectObjectPhrase: null,
            originalInput: 'inventory', error: null,
        };
        const parsedCmdV_DO = {
            actionId: 'action:examine', directObjectPhrase: 'rusty key', preposition: null, indirectObjectPhrase: null,
            originalInput: 'examine rusty key', error: null,
        };
        const parsedCmdV_P_IO = {
            actionId: 'action:look', directObjectPhrase: null, preposition: 'in', indirectObjectPhrase: 'the box',
            originalInput: 'look in the box', error: null,
        };
        const parsedCmdV_DO_P_IO = {
            actionId: 'action:put', directObjectPhrase: 'the coin', preposition: 'in', indirectObjectPhrase: 'the slot',
            originalInput: 'put the coin in the slot', error: null,
        };

        // Setup specifically for executeAction tests
        beforeEach(() => {
            jest.clearAllMocks();

            // Set up required game state - *Important*: GameStateManager provides the location
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);

            gameLoop = new GameLoop(createValidOptions());

            // Set a default return value for the mocked actionExecutor
            mockActionExecutor.executeAction.mockResolvedValue({
                success: true,
                messages: [{text: 'Mock action success', type: 'info'}] // Added type for ActionResult compliance
            });
        });

        // Helper function to run common assertions on the captured context
        const assertActionContextStructure = (context, inputParsedCommand, expectedActingEntity) => {
            expect(context.actingEntity).toBe(expectedActingEntity); // Check the correct entity was passed
            expect(context.currentLocation).toBe(mockLocation); // Location from GameStateManager
            expect(context.parsedCommand).toBe(inputParsedCommand); // Strict equality (===) check
            expect(context.targets).toBeUndefined(); // GameLoop doesn't resolve targets here

            // Check Dependencies
            expect(context.gameDataRepository).toBe(mockGameDataRepository);
            expect(context.entityManager).toBe(mockEntityManager);
            expect(context.eventBus).toBe(mockEventBus); // Verify the eventBus itself is passed
            expect(context.logger).toBe(mockLogger); // Verify logger

            // Verify bound dispatch function
            expect(context.dispatch).toBeDefined();
            expect(typeof context.dispatch).toBe('function');
            mockEventBus.dispatch.mockClear(); // Clear before testing the bound function
            const testEventData = {detail: 'test data'};
            context.dispatch('test:event', testEventData);
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('test:event', testEventData);
        };

        // Test cases for different command structures
        it('should construct and pass correct ActionContext for V command', async () => {
            await gameLoop.executeAction(mockPlayer, parsedCmdV); // Pass actingEntity

            expect(mockActionExecutor.executeAction).toHaveBeenCalledTimes(1);
            const [capturedActionId, capturedContext] = mockActionExecutor.executeAction.mock.calls[0];
            expect(capturedActionId).toBe(parsedCmdV.actionId);
            assertActionContextStructure(capturedContext, parsedCmdV, mockPlayer); // Pass expected entity
        });

        it('should construct and pass correct ActionContext for V+DO command', async () => {
            await gameLoop.executeAction(mockPlayer, parsedCmdV_DO);
            expect(mockActionExecutor.executeAction).toHaveBeenCalledTimes(1);
            const [capturedActionId, capturedContext] = mockActionExecutor.executeAction.mock.calls[0];
            expect(capturedActionId).toBe(parsedCmdV_DO.actionId);
            assertActionContextStructure(capturedContext, parsedCmdV_DO, mockPlayer);
        });

        it('should construct and pass correct ActionContext for V+P+IO command', async () => {
            await gameLoop.executeAction(mockPlayer, parsedCmdV_P_IO);
            expect(mockActionExecutor.executeAction).toHaveBeenCalledTimes(1);
            const [capturedActionId, capturedContext] = mockActionExecutor.executeAction.mock.calls[0];
            expect(capturedActionId).toBe(parsedCmdV_P_IO.actionId);
            assertActionContextStructure(capturedContext, parsedCmdV_P_IO, mockPlayer);
        });

        it('should construct and pass correct ActionContext for V+DO+P+IO command', async () => {
            await gameLoop.executeAction(mockPlayer, parsedCmdV_DO_P_IO);
            expect(mockActionExecutor.executeAction).toHaveBeenCalledTimes(1);
            const [capturedActionId, capturedContext] = mockActionExecutor.executeAction.mock.calls[0];
            expect(capturedActionId).toBe(parsedCmdV_DO_P_IO.actionId);
            assertActionContextStructure(capturedContext, parsedCmdV_DO_P_IO, mockPlayer);
        });

        // Test case for safety check: Missing Acting Entity (though less likely if called internally)
        it('should log error, dispatch UI error and return failure if actingEntity is missing', async () => {
            const result = await gameLoop.executeAction(null, parsedCmdV); // Pass null entity

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('acting entity'));
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:display_message', {
                text: 'Internal Error: Game state inconsistent during action execution.',
                type: 'error'
            });
            expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();
            expect(result).toEqual({
                success: false,
                messages: [{text: expect.stringContaining('acting entity'), type: 'internal'}]
            });
        });

        // Test case for safety check: Missing Location from GameStateManager
        it('should log error, dispatch UI error and return failure if currentLocation is missing', async () => {
            mockGameStateManager.getCurrentLocation.mockReturnValue(null); // Simulate missing location

            const result = await gameLoop.executeAction(mockPlayer, parsedCmdV); // Entity is present

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('current location context'));
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:display_message', {
                text: 'Internal Error: Game state inconsistent during action execution.',
                type: 'error'
            });
            expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();
            expect(result).toEqual({
                success: false,
                messages: [{text: expect.stringContaining('current location context'), type: 'internal'}]
            });
        });

        // Test case for handling ActionExecutor errors
        it('should catch errors from actionExecutor.executeAction, log, dispatch UI error, and return failure', async () => {
            const actionError = new Error('Action failed miserably');
            mockActionExecutor.executeAction.mockRejectedValue(actionError); // Make executor throw

            const result = await gameLoop.executeAction(mockPlayer, parsedCmdV);

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Error during execution of action ${parsedCmdV.actionId}`), actionError);
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:display_message', {
                text: `Error performing action: ${actionError.message}`,
                type: 'error'
            });
            expect(result).toEqual({
                success: false,
                messages: [{text: `Exception during action execution: ${actionError.message}`, type: 'internal'}]
            });
        });

        // Test case for handling invalid ActionResult structure
        it('should handle invalid result structure from actionExecutor and return failure', async () => {
            mockActionExecutor.executeAction.mockResolvedValue({some: 'wrong', structure: true}); // Invalid result

            const result = await gameLoop.executeAction(mockPlayer, parsedCmdV);

            // Should not log an error here, but return a structured failure
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('invalid result structure')); // Logger might debug, not error
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:display_message', expect.any(Object)); // No UI error for this case
            expect(result).toEqual({
                success: false,
                messages: [{
                    text: expect.stringContaining(`Action ${parsedCmdV.actionId} execution returned invalid result structure`),
                    type: 'internal'
                }]
            });
        });

    });
    // --- END executeAction TESTS ---

    // TODO: Add tests for #processNextTurn (complex due to private nature and branching logic)
    // TODO: Add tests for _discoverActionsForEntity (private, but testable via its effects on events)

}); // End describe('GameLoop')
