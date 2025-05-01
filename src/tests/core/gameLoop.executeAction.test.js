// src/tests/core/gameLoop.executeAction.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import GameLoop from '../../core/GameLoop.js';
import {PLAYER_COMPONENT_ID, ACTOR_COMPONENT_ID} from '../../types/components.js';

// Assume ActionExecutor is imported if needed for type checks, though not strictly required for mocking
// import ActionExecutor from '../../actions/actionExecutor.js';

// --- Mock Dependencies ---
// (Mocks remain the same as provided in the initial code, except for TurnManager and the new TurnHandlerResolver)
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

// Mock TurnManager (Implements ITurnManager interface)
const mockTurnManager = {
    start: jest.fn(),
    stop: jest.fn(),
    getCurrentActor: jest.fn().mockReturnValue(null), // Default to no actor
    advanceTurn: jest.fn(),
};

// ****** NEW MOCK: TurnHandlerResolver ******
// Implements ITurnHandlerResolver interface expected by GameLoop constructor
const mockTurnHandlerResolver = {
    resolveHandler: jest.fn().mockImplementation((actor) => {
        // Default mock implementation: return a basic handler object
        // This might need to be more sophisticated if tests depend on specific handler behavior
        // console.warn(`Mock TurnHandlerResolver used for actor: ${actor?.id}. Returning default mock handler.`); // Optional: Log usage
        return {
            handleTurn: jest.fn().mockResolvedValue(undefined) // Basic mock handler method
        };
    }),
};
// *******************************************


// Mock entities for GameStateManager/TurnOrderService
const mockPlayer = {
    id: 'player1',
    name: 'Tester',
    getComponent: jest.fn(),
    // Corrected hasComponent mock implementation
    hasComponent: jest.fn((componentId) => componentId === PLAYER_COMPONENT_ID),
    getAllComponents: jest.fn(() => [{id: PLAYER_COMPONENT_ID}]), // Added for potential logging in resolver
};
const mockNpc = {
    id: 'npc1',
    name: 'Goblin',
    getComponent: jest.fn(),
    // Corrected hasComponent mock implementation
    hasComponent: jest.fn((componentId) => componentId === ACTOR_COMPONENT_ID),
    getAllComponents: jest.fn(() => [{id: ACTOR_COMPONENT_ID}]), // Added for potential logging in resolver
};
const mockLocation = {id: 'room:test', name: 'Test Chamber', getComponent: jest.fn() /* Add if needed */};

// ****** CORRECTED HELPER: createValidOptions ******
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
    turnHandlerResolver: mockTurnHandlerResolver, // ***** ADDED THIS LINE *****
    logger: mockLogger,
});
// *************************************************

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
            messages: [{text: 'Default mock action executed', type: 'info'}] // Ensure type is present
        }); // Adjusted default return

        // Reset Command Parser Mock
        mockCommandParser.parse.mockReturnValue({actionId: null, error: 'Default mock parse', originalInput: ''});

        // Reset Turn Manager Mocks
        mockTurnManager.start.mockClear();
        mockTurnManager.stop.mockClear();
        mockTurnManager.getCurrentActor.mockClear().mockReturnValue(null); // Reset return value too
        mockTurnManager.advanceTurn.mockClear();

        // ***** NEW: Reset Turn Handler Resolver Mock *****
        mockTurnHandlerResolver.resolveHandler.mockClear();
        // Reset implementation if needed (e.g., if a test overrides it)
        mockTurnHandlerResolver.resolveHandler.mockImplementation((actor) => {
            // console.warn(`Mock TurnHandlerResolver reset for actor: ${actor?.id}. Returning default mock handler.`);
            return {handleTurn: jest.fn().mockResolvedValue(undefined)};
        });
        // **************************************************


        // Reset Entity Manager Mock (Example: Clear active entities if needed)
        mockEntityManager.activeEntities = new Map();

        // Reset entity mocks (ensure clean state for hasComponent etc.)
        // Corrected implementations
        mockPlayer.hasComponent.mockImplementation((componentId) => componentId === PLAYER_COMPONENT_ID);
        mockNpc.hasComponent.mockImplementation((componentId) => componentId === ACTOR_COMPONENT_ID);
        // Reset getAllComponents if used/modified
        mockPlayer.getAllComponents.mockImplementation(() => [{id: PLAYER_COMPONENT_ID}]);
        mockNpc.getAllComponents.mockImplementation(() => [{id: ACTOR_COMPONENT_ID}]);


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
            // Use async stop if it's async now
            gameLoop.stop(); // Assuming stop is synchronous for this example, adjust if async
        }
        gameLoop = null; // Clear gameLoop instance
    });


    // --- executeAction Tests (Ticket 4.3.3) ---
    // These should now pass the constructor check
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
            // Note: Top-level beforeEach already clears mocks

            // Set up required game state - *Important*: GameStateManager provides the location
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);

            // ***** This should now pass *****
            // Now uses the corrected createValidOptions which includes mockTurnHandlerResolver
            gameLoop = new GameLoop(createValidOptions());
            // *****----------------------*****


            // Set a default return value for the mocked actionExecutor
            mockActionExecutor.executeAction.mockResolvedValue({
                success: true,
                messages: [{text: 'Mock action success', type: 'info'}] // Added type for ActionResult compliance
            });
        });

        // Helper function to run common assertions on the captured context
        const assertActionContextStructure = (context, inputParsedCommand, expectedActingEntity) => {
            expect(context).toBeDefined(); // Basic check first
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

        // Test case for safety check: Missing Acting Entity
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
            const invalidResult = {some: 'wrong', structure: true}; // Define the invalid structure
            mockActionExecutor.executeAction.mockResolvedValue(invalidResult); // Mock executor to return it

            const result = await gameLoop.executeAction(mockPlayer, parsedCmdV);

            // Logger might debug/warn, but not necessarily error for bad structure vs exception
            // Expect the error message AND the invalid result object itself as the second argument
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Action ${parsedCmdV.actionId} execution returned invalid result structure`),
                invalidResult // Assert the second argument passed to logger.error
            );
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:display_message', expect.any(Object)); // No UI error for this specific case usually
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