// src/tests/core/gameLoop.processSubmittedCommand.test.js
// ****** CORRECTED Test Expectations ******
// The GameLoop.processSubmittedCommand is marked @deprecated, and key logic
// (input handling, parse error recovery) has moved elsewhere (likely PlayerTurnHandler).
// These tests are adjusted to reflect the *current state* of the deprecated function.

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import GameLoop from '../../core/GameLoop.js';
import {PLAYER_COMPONENT_ID, ACTOR_COMPONENT_ID} from '../../types/components.js'; // Import component IDs

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
    getCurrentActor: jest.fn().mockReturnValue(null), // Default to null
    advanceTurn: jest.fn(),
};

// *** Define a mock TurnHandlerResolver (Needed for GameLoop constructor) ***
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

// Helper to create options
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
    turnHandlerResolver: mockTurnHandlerResolver, // Provide the mock
    logger: mockLogger,
});

// --- Test Suite ---

describe('GameLoop', () => {
    let gameLoop;
    let promptInputSpy; // Spy on the GameLoop's own promptInput (also deprecated)
    let executeActionSpy; // Spy on the GameLoop's own executeAction

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset mocks
        mockGameStateManager.getPlayer.mockReturnValue(null);
        mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
        mockActionExecutor.executeAction.mockResolvedValue({
            success: true,
            messages: [{text: 'Default mock action executed'}]
        });
        mockCommandParser.parse.mockReturnValue({actionId: null, error: 'Default mock parse', originalInput: ''});
        mockTurnManager.start.mockClear();
        mockTurnManager.stop.mockClear();
        mockTurnManager.getCurrentActor.mockClear().mockReturnValue(null);
        mockTurnManager.advanceTurn.mockClear();
        mockTurnHandlerResolver.resolveHandler.mockClear();

        mockEntityManager.activeEntities = new Map();
        mockPlayer.hasComponent.mockImplementation((componentId) => componentId === PLAYER_COMPONENT_ID);
        mockNpc.hasComponent.mockImplementation((componentId) => componentId === ACTOR_COMPONENT_ID);

        // Instantiate GameLoop AFTER mocks are ready
        gameLoop = new GameLoop(createValidOptions());

        // --- Setup spies AFTER gameLoop instance exists ---
        // Spy on the actual executeAction method of the instance
        executeActionSpy = jest.spyOn(gameLoop, 'executeAction').mockResolvedValue({
            success: true,
            messages: []
        });
        // Spy on the actual (deprecated) promptInput method
        promptInputSpy = jest.spyOn(gameLoop, 'promptInput').mockResolvedValue();
    });

    afterEach(() => {
        // Restore spies
        if (executeActionSpy) executeActionSpy.mockRestore();
        if (promptInputSpy) promptInputSpy.mockRestore();

        // Ensure game loop is stopped
        if (gameLoop && typeof gameLoop.stop === 'function') {
            if (gameLoop.isRunning) {
                gameLoop.stop(); // Use async stop if available
            }
        }
        // Clear mocks again
        jest.clearAllMocks();
    });


    // --- processSubmittedCommand Tests ---
    // Note: The GameLoop code itself marks processSubmittedCommand as @deprecated
    // suggesting its logic moved to PlayerTurnHandler. These tests are adjusted
    // to reflect the CURRENT state of the deprecated function.
    describe('processSubmittedCommand (@deprecated)', () => {

        beforeEach(() => {
            if (!gameLoop) {
                throw new Error("GameLoop instance was not created in the outer beforeEach. Cannot run processSubmittedCommand tests.");
            }

            // Set internal state using helper methods for testing
            gameLoop._test_setRunning(true);
            mockTurnManager.getCurrentActor.mockReturnValue(mockPlayer); // Set the player as the current actor

            // Mock GameStateManager for executeAction context
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);

            // Clear mocks/spies that might have been called during setup *within this describe*
            jest.clearAllMocks(); // Clear basic mocks first
            // Clear spies carefully
            if (executeActionSpy) executeActionSpy.mockClear();
            if (promptInputSpy) promptInputSpy.mockClear();
            mockGameStateManager.getCurrentLocation.mockClear(); // Clear this specific mock too
            mockTurnManager.getCurrentActor.mockClear().mockReturnValue(mockPlayer); // Ensure consistent state for these tests
            mockTurnManager.advanceTurn.mockClear(); // Clear the advanceTurn mock
            mockTurnHandlerResolver.resolveHandler.mockClear(); // Clear resolver mock too
        });

        afterEach(() => {
            // Reset internal state if needed, using helper methods
            if (gameLoop) {
                gameLoop._test_setRunning(false);
                mockTurnManager.getCurrentActor.mockReturnValue(null); // Reset mock
            }
        });

        it('should do nothing if called when the loop is not running', async () => {
            if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
            gameLoop._test_setRunning(false); // Ensure loop is stopped
            // Clear mocks called during beforeEach setup
            jest.clearAllMocks();
            if (executeActionSpy) executeActionSpy.mockClear();
            mockTurnManager.advanceTurn.mockClear();

            await gameLoop.processSubmittedCommand(mockPlayer, 'look');

            expect(mockCommandParser.parse).not.toHaveBeenCalled();
            expect(executeActionSpy).not.toHaveBeenCalled();
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockTurnManager.advanceTurn).not.toHaveBeenCalled();
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
        });

        it('should log error and return if called for an entity that is not the current turn entity', async () => {
            if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
            const wrongEntity = {
                id: 'imposter',
                name: 'Wrong Guy',
                hasComponent: jest.fn(() => false),
                getComponent: jest.fn()
            };
            // beforeEach sets mockPlayer as current actor via mockTurnManager
            // Clear mocks for this specific test path
            if (promptInputSpy) promptInputSpy.mockClear();
            mockActionDiscoverySystem.getValidActions.mockClear();
            mockLogger.error.mockClear();
            mockTurnManager.advanceTurn.mockClear();
            mockCommandParser.parse.mockClear();

            await gameLoop.processSubmittedCommand(wrongEntity, 'look'); // Called for wrong entity

            // Verify expected error logging and NO processing
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('State inconsistency'));
            expect(mockCommandParser.parse).not.toHaveBeenCalled();
            expect(executeActionSpy).not.toHaveBeenCalled();
            expect(mockTurnManager.advanceTurn).not.toHaveBeenCalled();

            // --- FIX: Check that recovery logic (prompting/discovery) is NOT called from this deprecated function ---
            // The function now just logs and returns. Recovery is handled elsewhere.
            expect(promptInputSpy).not.toHaveBeenCalled();
            expect(mockActionDiscoverySystem.getValidActions).not.toHaveBeenCalled();
        });

        it('should NOT disable input or dispatch disable event (deprecated behavior)', async () => {
            // Test adjusted because input disabling is now handled elsewhere (e.g., PlayerTurnHandler)
            if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
            mockCommandParser.parse.mockReturnValue({actionId: 'action:wait', originalInput: 'wait', error: null});
            if (executeActionSpy) executeActionSpy.mockResolvedValue({success: true});
            mockInputHandler.disable.mockClear();
            mockvalidatedEventDispatcher.dispatchValidated.mockClear();

            await gameLoop.processSubmittedCommand(mockPlayer, 'wait');

            // --- FIX: Expect these NOT to be called by this deprecated function ---
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
            // The dispatch for 'Processing...' might still happen in some flows, but let's assume it moved too.
            // If this fails, it means the dispatch still happens before parse.
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:disable_input', expect.any(Object));

            // Sanity check: parsing should still happen
            expect(mockCommandParser.parse).toHaveBeenCalledTimes(1);
        });


        it('should call commandParser.parse with the command string', async () => {
            if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
            const command = 'examine the widget';
            mockCommandParser.parse.mockReturnValue({actionId: 'action:examine', originalInput: command, error: null});
            if (executeActionSpy) executeActionSpy.mockResolvedValue({success: true});

            await gameLoop.processSubmittedCommand(mockPlayer, command);

            expect(mockCommandParser.parse).toHaveBeenCalledTimes(1);
            expect(mockCommandParser.parse).toHaveBeenCalledWith(command);
        });

        describe('when command parsing fails', () => {
            const parseError = 'Unknown command.';
            const badCommand = 'frobozz';

            beforeEach(() => {
                if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
                mockCommandParser.parse.mockReturnValue({actionId: null, error: parseError, originalInput: badCommand});
                // Clear mocks specifically for this context
                jest.clearAllMocks();
                mockTurnManager.getCurrentActor.mockClear().mockReturnValue(mockPlayer); // Keep turn manager consistent
                mockTurnManager.advanceTurn.mockClear(); // Clear advanceTurn
                if (executeActionSpy) executeActionSpy.mockClear();
                if (promptInputSpy) promptInputSpy.mockClear();
                mockActionDiscoverySystem.getValidActions.mockClear();
                mockTurnHandlerResolver.resolveHandler.mockClear(); // Clear resolver mock too
            });

            it('should display parse error message', async () => {
                await gameLoop.processSubmittedCommand(mockPlayer, badCommand);
                expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:display_message', {
                    text: parseError,
                    type: 'error'
                });
            });

            it('should log a warning', async () => {
                await gameLoop.processSubmittedCommand(mockPlayer, badCommand);
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Command parsing failed for "${badCommand}"`));
            });

            it('should NOT call executeAction', async () => {
                await gameLoop.processSubmittedCommand(mockPlayer, badCommand);
                expect(executeActionSpy).not.toHaveBeenCalled();
            });

            it('should NOT re-discover actions for the player (deprecated behavior)', async () => {
                // --- FIX: Expect discovery NOT to be called by this deprecated function ---
                await gameLoop.processSubmittedCommand(mockPlayer, badCommand);
                expect(mockActionDiscoverySystem.getValidActions).not.toHaveBeenCalled();
            });

            it('should NOT call promptInput to allow retry (deprecated behavior)', async () => {
                // --- FIX: Expect promptInput NOT to be called by this deprecated function ---
                await gameLoop.processSubmittedCommand(mockPlayer, badCommand);
                expect(promptInputSpy).not.toHaveBeenCalled();
            });

            it('should NOT dispatch turn:end event', async () => {
                await gameLoop.processSubmittedCommand(mockPlayer, badCommand);
                // Turn advancement dispatches this, so check advanceTurn instead
                expect(mockTurnManager.advanceTurn).not.toHaveBeenCalled();
                // Direct check might be brittle, relies on advanceTurn not being called
                expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('turn:end', expect.any(Object));
            });

            it('should NOT call turnManager.advanceTurn', async () => {
                await gameLoop.processSubmittedCommand(mockPlayer, badCommand);
                expect(mockTurnManager.advanceTurn).not.toHaveBeenCalled();
            });
        });

        describe('when command parsing succeeds', () => {
            const parsedCommand = {
                actionId: 'action:look',
                directObjectPhrase: null,
                originalInput: 'look',
                error: null,
                targets: [],
                prepositions: {},
            };
            const command = 'look';

            beforeEach(() => {
                if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
                mockCommandParser.parse.mockReturnValue(parsedCommand);
                if (executeActionSpy) executeActionSpy.mockResolvedValue({
                    success: true,
                    messages: [{text: 'Looked around.'}]
                });
                // Clear mocks specifically for this context
                jest.clearAllMocks(); // Clear all standard mocks
                mockTurnManager.getCurrentActor.mockClear().mockReturnValue(mockPlayer); // Keep consistent
                mockTurnManager.advanceTurn.mockClear(); // Clear advanceTurn
                if (executeActionSpy) executeActionSpy.mockClear(); // Clear spy specifically
                if (promptInputSpy) promptInputSpy.mockClear(); // Clear spy specifically
                mockEventBus.dispatch.mockClear(); // Clear event bus mock
                mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation); // Ensure location is set for executeAction context
                mockTurnHandlerResolver.resolveHandler.mockClear(); // Clear resolver mock too
            });

            it('should call executeAction with the acting entity and parsed command', async () => {
                if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
                await gameLoop.processSubmittedCommand(mockPlayer, command);
                expect(executeActionSpy).toHaveBeenCalledTimes(1);
                expect(executeActionSpy).toHaveBeenCalledWith(
                    mockPlayer,
                    parsedCommand
                );
            });


            it('should log the end of the turn (implicitly via advancing turn)', async () => {
                // This logging happens right BEFORE calling advanceTurn in the current code
                if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
                await gameLoop.processSubmittedCommand(mockPlayer, command);
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Player ${mockPlayer.id} completed action ${parsedCommand.actionId}. Advancing turn...`));
            });

            it('should dispatch turn:end event (via TurnManager interaction)', async () => {
                // GameLoop calls turnManager.advanceTurn(). Test that this happens.
                if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
                await gameLoop.processSubmittedCommand(mockPlayer, command);
                expect(mockTurnManager.advanceTurn).toHaveBeenCalledTimes(1);
                // Verifying the 'turn:end' event itself would require mocking TurnManager's dispatch or more integration.
                // Checking that advanceTurn was called is sufficient for testing GameLoop's responsibility here.
            });


            it('should call turnManager.advanceTurn to advance the game loop', async () => {
                if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
                await gameLoop.processSubmittedCommand(mockPlayer, command);
                expect(mockTurnManager.advanceTurn).toHaveBeenCalledTimes(1);
            });

            it('should NOT call promptInput', async () => {
                // Prompting happens later if the *next* entity is a player, handled by TurnManager/Handlers.
                // This function shouldn't call promptInput after a successful action.
                if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
                await gameLoop.processSubmittedCommand(mockPlayer, command);
                expect(promptInputSpy).not.toHaveBeenCalled();
            });
        });
    }); // End describe('processSubmittedCommand')

    // Other GameLoop tests (start, stop, _processCurrentActorTurn etc.) would go here...

}); // End describe('GameLoop')