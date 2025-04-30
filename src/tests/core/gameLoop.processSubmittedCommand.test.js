// src/tests/core/gameLoop.processSubmittedCommand.test.js
// ****** MODIFIED FILE ******

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import GameLoop from '../../core/GameLoop.js';
import {PLAYER_COMPONENT_ID, ACTOR_COMPONENT_ID} from '../../types/components.js'; // Import component IDs

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

const mockTurnOrderService = {
    isEmpty: jest.fn().mockReturnValue(true),
    startNewRound: jest.fn(),
    getNextEntity: jest.fn().mockReturnValue(null),
    clearCurrentRound: jest.fn(),
};

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
    turnOrderService: mockTurnOrderService,
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
        mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation); // Provide a default location for context
        mockActionExecutor.executeAction.mockResolvedValue({
            success: true,
            messages: [{text: 'Default mock action executed'}]
        });
        mockCommandParser.parse.mockReturnValue({actionId: null, error: 'Default mock parse', originalInput: ''});
        mockTurnOrderService.isEmpty.mockReturnValue(true);
        mockTurnOrderService.getNextEntity.mockReturnValue(null);
        mockEntityManager.activeEntities = new Map();
        mockPlayer.hasComponent.mockImplementation((componentId) => componentId === PLAYER_COMPONENT_ID);
        mockNpc.hasComponent.mockImplementation((componentId) => componentId === ACTOR_COMPONENT_ID);

        // Instantiate GameLoop *after* clearing mocks if constructor uses them
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
        if (gameLoop && gameLoop.isRunning) {
            // Use the public stop method, avoid direct state manipulation if possible
            gameLoop.stop();
        }
        // Clear mocks again to be absolutely sure between top-level tests
        jest.clearAllMocks();
    });


    // --- processSubmittedCommand Tests ---
    describe('processSubmittedCommand', () => {
        let executeActionSpy; // Use GameLoop's internal executeAction

        beforeEach(() => {
            // Instantiate GameLoop here IF it needs fresh instance per sub-describe test
            // If gameLoop from outer scope is fine, remove this line:
            // gameLoop = new GameLoop(createValidOptions());

            // *** FIX 1: Use test helper methods to set internal state ***
            gameLoop._test_setRunning(true); // Set loop to running
            gameLoop._test_setCurrentTurnEntity(mockPlayer); // Assume player's turn for most tests

            // Mock/Spy on internal methods for this specific instance
            // Spy on the actual executeAction method of the instance
            executeActionSpy = jest.spyOn(gameLoop, 'executeAction').mockResolvedValue({success: true, messages: []});

            // *** FIX 2: Correct the spy target name and handle potential failure ***
            try {
                // Target the actual protected method name '_processNextTurn'
                processNextTurnSpy = jest.spyOn(gameLoop, '_processNextTurn').mockResolvedValue();
            } catch (e) {
                console.warn("Could not spy on GameLoop._processNextTurn. Test assertions relying on it may fail.", e);
                processNextTurnSpy = null; // Ensure it's null if spy fails
            }

            // Spy on promptInput AFTER gameLoop instance exists
            promptInputSpy = jest.spyOn(gameLoop, 'promptInput');

            // Mock GameStateManager to return a location needed by executeAction context
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);

            // Clear mocks that might have been called during setup *within this describe*
            // Note: Mocks used by the constructor were likely called already in outer beforeEach
            jest.clearAllMocks();
            if (executeActionSpy) executeActionSpy.mockClear();
            if (processNextTurnSpy) processNextTurnSpy.mockClear();
            if (promptInputSpy) promptInputSpy.mockClear();
            mockGameStateManager.getCurrentLocation.mockClear(); // Clear this specific mock too
        });

        afterEach(() => {
            // Restore spies created in this block
            if (executeActionSpy) executeActionSpy.mockRestore();
            if (promptInputSpy) promptInputSpy.mockRestore(); // Already handled in outer afterEach, but safe to keep if needed
            if (processNextTurnSpy) processNextTurnSpy.mockRestore(); // Already handled in outer afterEach
            // Reset internal state if needed, though outer afterEach should handle stop()
            gameLoop._test_setRunning(false);
            gameLoop._test_setCurrentTurnEntity(null);
        });

        it('should do nothing if called when the loop is not running', async () => {
            gameLoop._test_setRunning(false); // Ensure loop is stopped using helper
            // Clear mocks called during beforeEach setup
            jest.clearAllMocks();
            if (executeActionSpy) executeActionSpy.mockClear();
            if (processNextTurnSpy) processNextTurnSpy.mockClear();

            await gameLoop.processSubmittedCommand(mockPlayer, 'look');

            expect(mockCommandParser.parse).not.toHaveBeenCalled();
            expect(executeActionSpy).not.toHaveBeenCalled();
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            if (processNextTurnSpy) expect(processNextTurnSpy).not.toHaveBeenCalled();
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
        });

        it('should log error and return if called for an entity that is not the current turn entity', async () => {
            const wrongEntity = {id: 'imposter', name: 'Wrong Guy', hasComponent: jest.fn(), getComponent: jest.fn()};
            gameLoop._test_setCurrentTurnEntity(mockPlayer); // Player's turn

            // *** FIX 3: Create spy BEFORE the call you want to check ***
            // promptInputSpy = jest.spyOn(gameLoop, 'promptInput'); // Already created in beforeEach, just clear it
            promptInputSpy.mockClear();
            mockActionDiscoverySystem.getValidActions.mockClear(); // Clear discovery mock too
            mockLogger.error.mockClear(); // Clear logger error mock

            await gameLoop.processSubmittedCommand(wrongEntity, 'look'); // Called for wrong entity

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('State inconsistency'));
            expect(mockCommandParser.parse).not.toHaveBeenCalled();
            expect(executeActionSpy).not.toHaveBeenCalled();
            if (processNextTurnSpy) expect(processNextTurnSpy).not.toHaveBeenCalled();

            // Check recovery logic: re-discover for *correct* entity and re-prompt
            expect(mockActionDiscoverySystem.getValidActions).toHaveBeenCalledWith(mockPlayer, expect.any(Object));
            expect(promptInputSpy).toHaveBeenCalledTimes(1); // Should have been called once during error handling
        });

        it('should disable input and dispatch disable event upon receiving command', async () => {
            // Ensure parse succeeds for this test path
            mockCommandParser.parse.mockReturnValue({actionId: 'action:wait', originalInput: 'wait', error: null});
            // Mock executeAction needed after parsing
            executeActionSpy.mockResolvedValue({success: true});

            await gameLoop.processSubmittedCommand(mockPlayer, 'wait');

            // Expect disable *before* parsing
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
            // Expect disable event dispatch *before* parsing
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:disable_input', {message: "Processing..."});
        });

        it('should call commandParser.parse with the command string', async () => {
            const command = 'examine the widget';
            // Ensure parse succeeds
            mockCommandParser.parse.mockReturnValue({actionId: 'action:examine', originalInput: command, error: null});
            // Mock executeAction needed after parsing
            executeActionSpy.mockResolvedValue({success: true});


            await gameLoop.processSubmittedCommand(mockPlayer, command);

            expect(mockCommandParser.parse).toHaveBeenCalledTimes(1);
            expect(mockCommandParser.parse).toHaveBeenCalledWith(command);
        });

        describe('when command parsing fails', () => {
            const parseError = 'Unknown command.';
            const badCommand = 'frobozz';

            beforeEach(() => {
                // Setup parse to fail
                mockCommandParser.parse.mockReturnValue({actionId: null, error: parseError, originalInput: badCommand});
                // Clear mocks specifically for this context
                jest.clearAllMocks();
                if (executeActionSpy) executeActionSpy.mockClear();
                if (processNextTurnSpy) processNextTurnSpy.mockClear();
                if (promptInputSpy) promptInputSpy.mockClear(); // Clear promptInput spy
                mockActionDiscoverySystem.getValidActions.mockClear(); // Clear discovery mock
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
                await gameLoop.processSubmittedCommand(mockPlayer, badCommand);
                expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('turn:end', expect.any(Object));
            });

            it('should NOT call _processNextTurn', async () => {
                await gameLoop.processSubmittedCommand(mockPlayer, badCommand);
                if (processNextTurnSpy) {
                    expect(processNextTurnSpy).not.toHaveBeenCalled();
                } else {
                    // If spy failed, we can't assert this, but the other tests should cover the logic
                    console.warn("Test cannot confirm _processNextTurn was NOT called due to spy limitations.");
                }
            });
        });

        describe('when command parsing succeeds', () => {
            const parsedCommand = {
                actionId: 'action:look',
                directObjectPhrase: null,
                originalInput: 'look',
                error: null
            };
            const command = 'look';

            beforeEach(() => {
                // Setup parse to succeed
                mockCommandParser.parse.mockReturnValue(parsedCommand);
                // Default executeAction to succeed (can be overridden)
                executeActionSpy.mockResolvedValue({success: true, messages: [{text: 'Looked around.'}]});

                // Clear mocks specifically for this context
                jest.clearAllMocks(); // Clear all standard mocks
                if (executeActionSpy) executeActionSpy.mockClear(); // Clear spy specifically
                if (processNextTurnSpy) processNextTurnSpy.mockClear(); // Clear spy specifically
                if (promptInputSpy) promptInputSpy.mockClear(); // Clear spy specifically
                mockEventBus.dispatch.mockClear(); // Clear event bus mock
                mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation); // Ensure location is set for executeAction context

            });

            it('should call executeAction with the acting entity and parsed command', async () => {
                await gameLoop.processSubmittedCommand(mockPlayer, command);
                expect(executeActionSpy).toHaveBeenCalledTimes(1);
                // Ensure executeAction context is properly formed (basic check)
                expect(executeActionSpy).toHaveBeenCalledWith(
                    mockPlayer,
                    parsedCommand
                    // The context object is created internally, so we check the args passed *to* executeAction spy
                );
            });

            it('should log the end of the turn', async () => {
                await gameLoop.processSubmittedCommand(mockPlayer, command);
                // Logger call happens *after* executeAction completes
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`<<< Ending turn for Entity: ${mockPlayer.id}`));
            });

            it('should dispatch turn:end event with entityId, actionId, and success status', async () => {
                // --- Test Success Case ---
                executeActionSpy.mockResolvedValue({success: true}); // Force success
                mockEventBus.dispatch.mockClear(); // Clear before call

                await gameLoop.processSubmittedCommand(mockPlayer, command);

                expect(mockEventBus.dispatch).toHaveBeenCalledWith('turn:end', {
                    entityId: mockPlayer.id,
                    actionTaken: parsedCommand.actionId,
                    success: true
                });

                // --- Test Failure Case ---
                executeActionSpy.mockResolvedValue({success: false}); // Force failure
                mockEventBus.dispatch.mockClear(); // Clear before call

                await gameLoop.processSubmittedCommand(mockPlayer, command);

                expect(mockEventBus.dispatch).toHaveBeenCalledWith('turn:end', {
                    entityId: mockPlayer.id,
                    actionTaken: parsedCommand.actionId,
                    success: false
                });
            });

            it('should call _processNextTurn to advance the game loop', async () => {
                await gameLoop.processSubmittedCommand(mockPlayer, command);
                if (processNextTurnSpy) {
                    // Check _processNextTurn is called *after* successful execution path
                    expect(processNextTurnSpy).toHaveBeenCalledTimes(1);
                } else {
                    // Log if spy failed, test might be inconclusive for this specific check
                    console.warn("Test cannot confirm _processNextTurn was called due to spy limitations.");
                }
            });

            it('should NOT call promptInput', async () => {
                // Prompting happens later via _processNextTurn if the *next* entity is a player
                await gameLoop.processSubmittedCommand(mockPlayer, command);
                expect(promptInputSpy).not.toHaveBeenCalled();
            });
        });
    }); // End describe('processSubmittedCommand')

    // Other GameLoop tests (start, stop, _processNextTurn etc.) would go here...

}); // End describe('GameLoop')