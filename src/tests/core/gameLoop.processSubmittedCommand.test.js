// src/tests/core/gameLoop.processSubmittedCommand.test.js
// ****** FIXED: Added missing turnHandlerResolver mock ******

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

// *** FIX: Define a mock TurnHandlerResolver ***
const mockTurnHandlerResolver = {
    resolveHandler: jest.fn(),
    // Optional: Mock a default handler if needed immediately upon creation or start
    // resolveHandler: jest.fn().mockReturnValue({ handleTurn: jest.fn() }),
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
    // *** FIX: Provide the mockTurnHandlerResolver ***
    turnHandlerResolver: mockTurnHandlerResolver,
    logger: mockLogger,
});

// --- Test Suite ---

describe('GameLoop', () => {
    let gameLoop;
    let promptInputSpy;
    let processNextTurnSpy;

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
        // Reset the TurnManager mocks
        mockTurnManager.start.mockClear();
        mockTurnManager.stop.mockClear();
        mockTurnManager.getCurrentActor.mockClear().mockReturnValue(null); // Reset mock and default return value
        mockTurnManager.advanceTurn.mockClear();
        // *** FIX: Reset the TurnHandlerResolver mock ***
        mockTurnHandlerResolver.resolveHandler.mockClear();

        // Reset other mocks
        mockEntityManager.activeEntities = new Map();
        mockPlayer.hasComponent.mockImplementation((componentId) => componentId === PLAYER_COMPONENT_ID);
        mockNpc.hasComponent.mockImplementation((componentId) => componentId === ACTOR_COMPONENT_ID);

        // *** This instantiation should now succeed with the added mock ***
        gameLoop = new GameLoop(createValidOptions());

        // Spies are setup in the describe block below
    });

    afterEach(() => {
        // Restore spies
        if (promptInputSpy) {
            promptInputSpy.mockRestore();
            promptInputSpy = null;
        }
        if (processNextTurnSpy) {
            processNextTurnSpy.mockRestore();
            processNextTurnSpy = null;
        }
        // Ensure game loop is stopped
        if (gameLoop && typeof gameLoop.stop === 'function') {
            if (gameLoop.isRunning) {
                gameLoop.stop();
            }
        }
        // Clear mocks again
        jest.clearAllMocks();
    });


    // --- processSubmittedCommand Tests ---
    // Note: The GameLoop code itself marks processSubmittedCommand as @deprecated
    // suggesting its logic moved to PlayerTurnHandler. These tests might become
    // obsolete or need refactoring to test PlayerTurnHandler instead.
    // However, let's fix them based on the provided code first.
    describe('processSubmittedCommand', () => {
        let executeActionSpy; // Use GameLoop's internal executeAction

        beforeEach(() => {
            if (!gameLoop) {
                throw new Error("GameLoop instance was not created in the outer beforeEach. Cannot run processSubmittedCommand tests.");
            }

            // Set internal state using helper methods
            gameLoop._test_setRunning(true); // Set loop to running
            mockTurnManager.getCurrentActor.mockReturnValue(mockPlayer); // Set the player as the current actor via TurnManager

            // Spy on the actual executeAction method of the instance
            executeActionSpy = jest.spyOn(gameLoop, 'executeAction').mockResolvedValue({
                success: true,
                messages: []
            });

            // Spying on private/protected methods like _processNextTurn is brittle. Focus on observable behavior.
            processNextTurnSpy = null; // Indicate it's not being used

            // Spy on promptInput AFTER gameLoop instance exists
            promptInputSpy = jest.spyOn(gameLoop, 'promptInput').mockResolvedValue(); // Make mock async if promptInput is async

            // Mock GameStateManager to return a location needed by executeAction context
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);

            // Clear mocks that might have been called during setup *within this describe*
            jest.clearAllMocks(); // Clear basic mocks first
            // Clear spies carefully
            if (executeActionSpy) executeActionSpy.mockClear();
            // if (processNextTurnSpy) processNextTurnSpy.mockClear(); // Not used
            if (promptInputSpy) promptInputSpy.mockClear();
            mockGameStateManager.getCurrentLocation.mockClear(); // Clear this specific mock too
            mockTurnManager.getCurrentActor.mockClear().mockReturnValue(mockPlayer); // Ensure turn manager mock is reset but consistent for tests here
            mockTurnManager.advanceTurn.mockClear(); // Clear the advanceTurn mock
            mockTurnHandlerResolver.resolveHandler.mockClear(); // Clear resolver mock too
        });

        afterEach(() => {
            // Restore spies created in this block
            if (executeActionSpy) executeActionSpy.mockRestore();
            if (promptInputSpy) promptInputSpy.mockRestore();
            // if (processNextTurnSpy) processNextTurnSpy.mockRestore(); // Not used

            // Reset internal state if needed, using helper methods
            if (gameLoop) {
                gameLoop._test_setRunning(false);
                mockTurnManager.getCurrentActor.mockReturnValue(null); // Reset mock
            }
        });

        it('should do nothing if called when the loop is not running', async () => {
            if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
            gameLoop._test_setRunning(false); // Ensure loop is stopped using helper
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
                hasComponent: jest.fn(() => false), // Indicate it's not a player if needed by prompt logic
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

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('State inconsistency'));
            expect(mockCommandParser.parse).not.toHaveBeenCalled();
            expect(executeActionSpy).not.toHaveBeenCalled();
            expect(mockTurnManager.advanceTurn).not.toHaveBeenCalled();

            // Check recovery logic: re-prompt the *correct* entity (mockPlayer)
            // Assuming _promptPlayerInput is called for recovery as seen in the code
            expect(promptInputSpy).toHaveBeenCalledTimes(1);
            // Optionally check that discovery happened *before* prompt (part of _promptPlayerInput)
            const discoveryCallOrder = mockActionDiscoverySystem.getValidActions.mock.invocationCallOrder[0];
            const promptCallOrder = promptInputSpy.mock.invocationCallOrder[0];
            expect(mockActionDiscoverySystem.getValidActions).toHaveBeenCalledWith(mockPlayer, expect.any(Object));
            expect(discoveryCallOrder).toBeLessThan(promptCallOrder);
        });

        it('should disable input and dispatch disable event upon receiving command', async () => {
            if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
            mockCommandParser.parse.mockReturnValue({actionId: 'action:wait', originalInput: 'wait', error: null});
            if (executeActionSpy) executeActionSpy.mockResolvedValue({success: true});
            mockInputHandler.disable.mockClear();
            mockvalidatedEventDispatcher.dispatchValidated.mockClear();

            await gameLoop.processSubmittedCommand(mockPlayer, 'wait');

            // Expect disable *before* parsing
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:disable_input', {message: "Processing..."});

            // Verify order if needed (might be brittle)
            const disableInputCallOrder = mockInputHandler.disable.mock.invocationCallOrder[0];
            const dispatchDisableCallOrder = mockvalidatedEventDispatcher.dispatchValidated.mock.invocationCallOrder[
                mockvalidatedEventDispatcher.dispatchValidated.mock.calls.findIndex(call => call[0] === 'textUI:disable_input')
                ];
            const parseCallOrder = mockCommandParser.parse.mock.invocationCallOrder[0];

            expect(disableInputCallOrder).toBeLessThan(parseCallOrder);
            expect(dispatchDisableCallOrder).toBeLessThan(parseCallOrder);
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

            it('should re-discover actions for the player', async () => {
                await gameLoop.processSubmittedCommand(mockPlayer, badCommand);
                expect(mockActionDiscoverySystem.getValidActions).toHaveBeenCalledWith(mockPlayer, expect.any(Object));
            });

            it('should call promptInput to allow retry', async () => {
                await gameLoop.processSubmittedCommand(mockPlayer, badCommand);
                expect(promptInputSpy).toHaveBeenCalledTimes(1);
            });

            it('should NOT dispatch turn:end event', async () => {
                await gameLoop.processSubmittedCommand(mockPlayer, badCommand);
                expect(mockTurnManager.advanceTurn).not.toHaveBeenCalled();
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
            });


            it('should call turnManager.advanceTurn to advance the game loop', async () => {
                if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
                await gameLoop.processSubmittedCommand(mockPlayer, command);
                expect(mockTurnManager.advanceTurn).toHaveBeenCalledTimes(1);
            });

            it('should NOT call promptInput', async () => {
                // Prompting happens later if the *next* entity is a player.
                if (!gameLoop) throw new Error("Test setup failed: gameLoop missing");
                await gameLoop.processSubmittedCommand(mockPlayer, command);
                expect(promptInputSpy).not.toHaveBeenCalled();
            });
        });
    }); // End describe('processSubmittedCommand')

    // Other GameLoop tests (start, stop, _processCurrentActorTurn etc.) would go here...

}); // End describe('GameLoop')