// src/tests/core/gameLoop.processSubmittedCommand.test.js
// ****** CORRECTED FILE ******

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

// *** FIX: Define a mock TurnManager implementing the ITurnManager interface ***
const mockTurnManager = {
    start: jest.fn(),
    stop: jest.fn(),
    getCurrentActor: jest.fn().mockReturnValue(null), // Default to null
    advanceTurn: jest.fn(),
    // Add other methods if the GameLoop interacts with more TurnManager features
};

// Remove or comment out if unused elsewhere in this file
// const mockTurnOrderService = {
//     isEmpty: jest.fn().mockReturnValue(true),
//     startNewRound: jest.fn(),
//     getNextEntity: jest.fn().mockReturnValue(null),
//     clearCurrentRound: jest.fn(),
// };


// Mock entities
const mockPlayer = {
    id: 'player1',
    name: 'Tester',
    getComponent: jest.fn(),
    // Ensure mock hasComponent handles both types correctly if needed elsewhere, but focus on PLAYER_COMPONENT_ID here
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
    // *** FIX: Provide the mockTurnManager under the correct key ***
    turnManager: mockTurnManager,
    logger: mockLogger,
    // turnOrderService: mockTurnOrderService, // Removed/Commented out
});

// --- Test Suite ---

describe('GameLoop', () => {
    let gameLoop;
    let promptInputSpy;
    let processNextTurnSpy; // Keep using this name if spying on internal method

    // *** NOTE: Outer beforeEach now uses the corrected createValidOptions ***
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset mocks
        mockGameStateManager.getPlayer.mockReturnValue(null);
        mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation); // Provide a default location for context
        mockActionExecutor.executeAction.mockResolvedValue({
            success: true,
            messages: [{text: 'Default mock action executed'}]
        });
        mockCommandParser.parse.mockReturnValue({actionId: null, error: 'Default mock parse', originalInput: ''});
        // Reset the new mockTurnManager methods
        mockTurnManager.start.mockClear();
        mockTurnManager.stop.mockClear();
        mockTurnManager.getCurrentActor.mockClear().mockReturnValue(null); // Reset mock and default return value
        mockTurnManager.advanceTurn.mockClear();

        // Reset other mocks as before
        mockEntityManager.activeEntities = new Map();
        mockPlayer.hasComponent.mockImplementation((componentId) => componentId === PLAYER_COMPONENT_ID);
        mockNpc.hasComponent.mockImplementation((componentId) => componentId === ACTOR_COMPONENT_ID);

        // *** This instantiation should now succeed ***
        gameLoop = new GameLoop(createValidOptions());

        // Spies are setup in the describe block below
    });

    afterEach(() => {
        // Restore spies
        if (promptInputSpy) {
            promptInputSpy.mockRestore();
            promptInputSpy = null;
        }
        // *** FIX: Ensure processNextTurnSpy is checked before restoring ***
        if (processNextTurnSpy) {
            processNextTurnSpy.mockRestore();
            processNextTurnSpy = null;
        }
        // Ensure game loop is stopped
        // *** FIX: Check if gameLoop was successfully created before calling stop ***
        if (gameLoop && typeof gameLoop.stop === 'function') {
            // Use the public stop method, avoid direct state manipulation if possible
            // Need to ensure stop is async if it truly is, but for test teardown sync might be okay
            // or wrap in async/await if necessary. Assuming sync for now based on typical teardown.
            if (gameLoop.isRunning) {
                // GameLoop.stop might be async, handle appropriately if needed
                gameLoop.stop();
            }
        }
        // Clear mocks again to be absolutely sure between top-level tests
        jest.clearAllMocks();
    });


    // --- processSubmittedCommand Tests ---
    describe('processSubmittedCommand', () => {
        let executeActionSpy; // Use GameLoop's internal executeAction

        beforeEach(() => {
            // *** gameLoop instance should exist from outer beforeEach ***
            // If not, the outer beforeEach failed, and tests here won't run correctly.

            // Set internal state using helper methods IF gameLoop exists
            if (gameLoop) {
                gameLoop._test_setRunning(true); // Set loop to running
                // *** CORRECTION HERE ***
                gameLoop._test_setInternalCurrentTurnEntity(mockPlayer); // Assume player's turn
                mockTurnManager.getCurrentActor.mockReturnValue(mockPlayer); // Make mockTurnManager consistent
            } else {
                // Fail fast or log if gameLoop isn't set up - indicates a problem in outer beforeEach
                throw new Error("GameLoop instance was not created in the outer beforeEach. Cannot run processSubmittedCommand tests.");
            }


            // Mock/Spy on internal methods for this specific instance
            // Spy on the actual executeAction method of the instance
            // *** FIX: Check gameLoop exists before spying ***
            executeActionSpy = gameLoop ? jest.spyOn(gameLoop, 'executeAction').mockResolvedValue({
                success: true,
                messages: []
            }) : null;

            // Spy on _processCurrentActorTurn (or equivalent logic trigger) if needed for specific tests,
            // but _processNextTurn might be too internal. Spying on turnManager.advanceTurn might be better.
            // For now, keep the original plan but add checks.
            try {
                // Target the actual protected method name '_processNextTurn' if it exists and is needed
                // processNextTurnSpy = gameLoop ? jest.spyOn(gameLoop, '_processNextTurn').mockResolvedValue() : null;
                // Commenting out: Spying on private/protected methods can be brittle.
                // Focus on observable behavior (like turnManager.advanceTurn being called).
                processNextTurnSpy = null; // Indicate it's not being used for now
            } catch (e) {
                console.warn("Could not spy on GameLoop._processNextTurn (potentially removed or refactored). Test assertions relying on it may fail.", e);
                processNextTurnSpy = null; // Ensure it's null if spy fails
            }

            // Spy on promptInput AFTER gameLoop instance exists
            promptInputSpy = gameLoop ? jest.spyOn(gameLoop, 'promptInput').mockResolvedValue() : null; // Make mock async if promptInput is async

            // Mock GameStateManager to return a location needed by executeAction context
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);

            // Clear mocks that might have been called during setup *within this describe*
            jest.clearAllMocks(); // Clear basic mocks first
            // Clear spies carefully
            if (executeActionSpy) executeActionSpy.mockClear();
            if (processNextTurnSpy) processNextTurnSpy.mockClear();
            if (promptInputSpy) promptInputSpy.mockClear();
            mockGameStateManager.getCurrentLocation.mockClear(); // Clear this specific mock too
            mockTurnManager.getCurrentActor.mockClear().mockReturnValue(mockPlayer); // Ensure turn manager mock is reset but consistent for tests here
            mockTurnManager.advanceTurn.mockClear(); // Clear the advanceTurn mock
        });

        afterEach(() => {
            // Restore spies created in this block
            if (executeActionSpy) executeActionSpy.mockRestore();
            if (promptInputSpy) promptInputSpy.mockRestore();
            if (processNextTurnSpy) processNextTurnSpy.mockRestore();

            // Reset internal state if needed, using helper methods IF gameLoop exists
            // *** FIX: Check gameLoop exists before accessing methods ***
            if (gameLoop) {
                gameLoop._test_setRunning(false);
                // *** CORRECTION HERE ***
                gameLoop._test_setInternalCurrentTurnEntity(null);
                mockTurnManager.getCurrentActor.mockReturnValue(null); // Reset mock
            }
        });

        it('should do nothing if called when the loop is not running', async () => {
            if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
            gameLoop._test_setRunning(false); // Ensure loop is stopped using helper
            // Clear mocks called during beforeEach setup
            jest.clearAllMocks();
            if (executeActionSpy) executeActionSpy.mockClear();
            // Clear turn manager mocks
            mockTurnManager.advanceTurn.mockClear();

            await gameLoop.processSubmittedCommand(mockPlayer, 'look');

            expect(mockCommandParser.parse).not.toHaveBeenCalled();
            expect(executeActionSpy).not.toHaveBeenCalled();
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockTurnManager.advanceTurn).not.toHaveBeenCalled(); // Check turn manager instead of private method
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
        });

        it('should log error and return if called for an entity that is not the current turn entity', async () => {
            if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
            const wrongEntity = {
                id: 'imposter',
                name: 'Wrong Guy',
                hasComponent: jest.fn(() => false),
                getComponent: jest.fn()
            }; // Ensure hasComponent returns false for player
            // *** CORRECTION HERE (although redundant due to outer beforeEach, good practice) ***
            gameLoop._test_setInternalCurrentTurnEntity(mockPlayer); // Player's turn
            mockTurnManager.getCurrentActor.mockReturnValue(mockPlayer); // Align mock

            // Clear mocks for this specific test path
            if (promptInputSpy) promptInputSpy.mockClear();
            mockActionDiscoverySystem.getValidActions.mockClear();
            mockLogger.error.mockClear();
            mockTurnManager.advanceTurn.mockClear();
            mockCommandParser.parse.mockClear(); // Clear parse mock as well

            await gameLoop.processSubmittedCommand(wrongEntity, 'look'); // Called for wrong entity

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('State inconsistency'));
            expect(mockCommandParser.parse).not.toHaveBeenCalled();
            expect(executeActionSpy).not.toHaveBeenCalled();
            expect(mockTurnManager.advanceTurn).not.toHaveBeenCalled(); // Check turn manager

            // Check recovery logic: re-discover for *correct* entity and re-prompt
            expect(mockActionDiscoverySystem.getValidActions).toHaveBeenCalledWith(mockPlayer, expect.any(Object));
            expect(promptInputSpy).toHaveBeenCalledTimes(1); // Should have been called once during error handling
        });

        it('should disable input and dispatch disable event upon receiving command', async () => {
            if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
            // Ensure parse succeeds for this test path
            mockCommandParser.parse.mockReturnValue({actionId: 'action:wait', originalInput: 'wait', error: null});
            // Mock executeAction needed after parsing
            if (executeActionSpy) executeActionSpy.mockResolvedValue({success: true});

            // Clear specific mocks before the call
            mockInputHandler.disable.mockClear();
            mockvalidatedEventDispatcher.dispatchValidated.mockClear();


            await gameLoop.processSubmittedCommand(mockPlayer, 'wait');

            // Get calls *after* the execution
            const disableInputCall = mockInputHandler.disable.mock.invocationCallOrder[0];
            const dispatchDisableCall = mockvalidatedEventDispatcher.dispatchValidated.mock.calls.find(call => call[0] === 'textUI:disable_input');
            const dispatchDisableCallOrder = mockvalidatedEventDispatcher.dispatchValidated.mock.invocationCallOrder[
                mockvalidatedEventDispatcher.dispatchValidated.mock.calls.indexOf(dispatchDisableCall)
                ];
            const parseCallOrder = mockCommandParser.parse.mock.invocationCallOrder[0];

            // Expect disable *before* parsing
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
            expect(disableInputCall).toBeLessThan(parseCallOrder);

            // Expect disable event dispatch *before* parsing
            expect(dispatchDisableCall).toBeTruthy();
            expect(dispatchDisableCall[1]).toEqual({message: "Processing..."});
            expect(dispatchDisableCallOrder).toBeLessThan(parseCallOrder);
        });


        it('should call commandParser.parse with the command string', async () => {
            if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
            const command = 'examine the widget';
            // Ensure parse succeeds
            mockCommandParser.parse.mockReturnValue({actionId: 'action:examine', originalInput: command, error: null});
            // Mock executeAction needed after parsing
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
                // Setup parse to fail
                mockCommandParser.parse.mockReturnValue({actionId: null, error: parseError, originalInput: badCommand});
                // Clear mocks specifically for this context
                jest.clearAllMocks();
                mockTurnManager.getCurrentActor.mockClear().mockReturnValue(mockPlayer); // Keep turn manager consistent
                mockTurnManager.advanceTurn.mockClear(); // Clear advanceTurn
                if (executeActionSpy) executeActionSpy.mockClear();
                // processNextTurnSpy is not used
                if (promptInputSpy) promptInputSpy.mockClear();
                mockActionDiscoverySystem.getValidActions.mockClear();
            });

            it('should display parse error message', async () => {
                await gameLoop.processSubmittedCommand(mockPlayer, badCommand);
                // Check for the specific call *after* the parse failure path is taken
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

            it('should re-discover actions for the player', async () => {
                await gameLoop.processSubmittedCommand(mockPlayer, badCommand);
                // Check discovery happens *after* parse failure
                expect(mockActionDiscoverySystem.getValidActions).toHaveBeenCalledWith(mockPlayer, expect.any(Object));
            });

            it('should call promptInput to allow retry', async () => {
                await gameLoop.processSubmittedCommand(mockPlayer, badCommand);
                // Check promptInput happens *after* parse failure
                expect(promptInputSpy).toHaveBeenCalledTimes(1);
            });

            it('should NOT dispatch turn:end event', async () => {
                // The turn:end event is dispatched by the TurnManager or GameLoop *after* a successful turn advance signal,
                // which doesn't happen on parse fail. We check if advanceTurn was called.
                await gameLoop.processSubmittedCommand(mockPlayer, badCommand);
                expect(mockTurnManager.advanceTurn).not.toHaveBeenCalled();
                // Also check eventBus directly if GameLoop dispatches it separately (it doesn't seem to based on code)
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
                targets: [], // Added for completeness if needed by executeAction context potentially
                prepositions: {}, // Added for completeness
            };
            const command = 'look';

            beforeEach(() => {
                if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
                // Setup parse to succeed
                mockCommandParser.parse.mockReturnValue(parsedCommand);
                // Default executeAction to succeed (can be overridden)
                if (executeActionSpy) executeActionSpy.mockResolvedValue({
                    success: true,
                    messages: [{text: 'Looked around.'}]
                });

                // Clear mocks specifically for this context
                jest.clearAllMocks(); // Clear all standard mocks
                mockTurnManager.getCurrentActor.mockClear().mockReturnValue(mockPlayer); // Keep consistent
                mockTurnManager.advanceTurn.mockClear(); // Clear advanceTurn
                if (executeActionSpy) executeActionSpy.mockClear(); // Clear spy specifically
                // processNextTurnSpy not used
                if (promptInputSpy) promptInputSpy.mockClear(); // Clear spy specifically
                mockEventBus.dispatch.mockClear(); // Clear event bus mock
                mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation); // Ensure location is set for executeAction context
            });

            it('should call executeAction with the acting entity and parsed command', async () => {
                if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
                await gameLoop.processSubmittedCommand(mockPlayer, command);
                expect(executeActionSpy).toHaveBeenCalledTimes(1);
                // Ensure executeAction context is properly formed (basic check)
                // The GameLoop's executeAction method internally creates the full context
                // So we check the arguments passed TO the spy on gameLoop.executeAction
                expect(executeActionSpy).toHaveBeenCalledWith(
                    mockPlayer,
                    parsedCommand
                    // We don't need to check the internal context object here, just that the method was called correctly
                );
            });


            it('should log the end of the turn (implicitly via advancing turn)', async () => {
                // The logging seems to happen *before* advancing the turn in the provided GameLoop code
                if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
                await gameLoop.processSubmittedCommand(mockPlayer, command);
                // Check for the log message related to advancing turn
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Player ${mockPlayer.id} completed action ${parsedCommand.actionId}. Advancing turn...`));
            });

            it('should dispatch turn:end event (via TurnManager interaction)', async () => {
                // The GameLoop code doesn't directly dispatch 'turn:end'. It calls turnManager.advanceTurn().
                // We assume the TurnManager (or something subscribed to its events) dispatches 'turn:end'.
                // Let's test that advanceTurn is called, which *should* lead to turn:end eventually.

                // Mocking the result of executeAction for success/failure isn't directly relevant
                // to whether advanceTurn is called *after* executeAction finishes, unless executeAction throws unexpectedly.

                // --- Test Call Path ---
                if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
                await gameLoop.processSubmittedCommand(mockPlayer, command);
                expect(mockTurnManager.advanceTurn).toHaveBeenCalledTimes(1);

                // If you NEED to test the turn:end event payload specifically, you'd need to either:
                // 1. Mock the TurnManager to dispatch the event when advanceTurn is called.
                // 2. Have a more integrated test that includes the TurnManager's real event dispatching.
                // For a unit test of GameLoop, verifying advanceTurn is called is usually sufficient.
            });


            it('should call turnManager.advanceTurn to advance the game loop', async () => {
                if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
                await gameLoop.processSubmittedCommand(mockPlayer, command);
                // Check turnManager.advanceTurn is called *after* successful execution path
                expect(mockTurnManager.advanceTurn).toHaveBeenCalledTimes(1);
            });

            it('should NOT call promptInput', async () => {
                if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
                // Prompting happens later via _handleTurnActorChanged -> _processCurrentActorTurn if the *next* entity is a player
                await gameLoop.processSubmittedCommand(mockPlayer, command);
                expect(promptInputSpy).not.toHaveBeenCalled();
            });
        });
    }); // End describe('processSubmittedCommand')

    // Other GameLoop tests (start, stop, _processNextTurn etc.) would go here...

}); // End describe('GameLoop')