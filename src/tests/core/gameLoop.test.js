// src/tests/core/GameLoop.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import GameLoop from '../../core/GameLoop.js';
import {EVENT_DISPLAY_MESSAGE} from "../../types/eventTypes.js";
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
    getPlayer: jest.fn(),
    getCurrentLocation: jest.fn(),
    setPlayer: jest.fn(),
    setCurrentLocation: jest.fn()
};
const mockDataManager = {}; // Basic mock object
const mockEntityManager = {}; // Basic mock object
const mockCommandParser = {
    parse: jest.fn(),
};
const mockActionExecutor = {
    executeAction: jest.fn(), // Key mock for this ticket
};

// Mock entities for GameStateManager
const mockPlayer = {id: 'player1', name: 'Tester', getComponent: jest.fn() /* Add if needed */};
const mockLocation = {id: 'room:test', name: 'Test Chamber', getComponent: jest.fn() /* Add if needed */};

// Helper to create a complete, valid options object
const createValidOptions = () => ({
    dataManager: mockDataManager,
    entityManager: mockEntityManager,
    gameStateManager: mockGameStateManager,
    inputHandler: mockInputHandler,
    commandParser: mockCommandParser,
    actionExecutor: mockActionExecutor,
    eventBus: mockEventBus,
});

// --- Test Suite ---

describe('GameLoop', () => {
    let gameLoop;
    let promptInputSpy;

    // Reset mocks before each test to ensure isolation (Top Level)
    beforeEach(() => {
        jest.clearAllMocks();
        mockGameStateManager.getPlayer.mockReturnValue(null);
        mockGameStateManager.getCurrentLocation.mockReturnValue(null);
        mockActionExecutor.executeAction.mockResolvedValue({success: true, message: "Default mock action executed"}); // Default mock resolution
        mockCommandParser.parse.mockReturnValue({actionId: null, error: 'Default mock parse', originalInput: ''}); // Default parse mock
    });

    afterEach(() => {
        if (promptInputSpy) {
            promptInputSpy.mockRestore();
            promptInputSpy = null;
        }
    });

    // --- Existing tests for constructor, start, stop, promptInput, isRunning, processSubmittedCommand, _handleSubmittedCommandFromEvent ---
    // --- remain unchanged here ---

    /* --- PASTE PREVIOUS TESTS HERE --- */
    // AC 3: Constructor Tests
    describe('constructor', () => {
        // ... (constructor tests unchanged) ...
        it('should throw an error if options.dataManager is missing', () => {
            const options = createValidOptions();
            delete options.dataManager;
            expect(() => new GameLoop(options)).toThrow(/options\.dataManager/);
        });

        it('should throw an error if options.entityManager is missing', () => {
            const options = createValidOptions();
            delete options.entityManager;
            expect(() => new GameLoop(options)).toThrow(/options\.entityManager/);
        });

        it('should throw an error if options.gameStateManager is missing', () => {
            const options = createValidOptions();
            delete options.gameStateManager;
            expect(() => new GameLoop(options)).toThrow(/options\.gameStateManager/);
        });

        it('should throw an error if options.inputHandler is missing or invalid', () => {
            const options = createValidOptions();
            delete options.inputHandler;
            expect(() => new GameLoop(options)).toThrow(/options\.inputHandler/);
            options.inputHandler = {}; // Missing methods
            expect(() => new GameLoop(options)).toThrow(/options\.inputHandler/);
        });

        it('should throw an error if options.commandParser is missing or invalid', () => {
            const options = createValidOptions();
            delete options.commandParser;
            expect(() => new GameLoop(options)).toThrow(/options\.commandParser/);
            options.commandParser = {}; // Missing 'parse'
            expect(() => new GameLoop(options)).toThrow(/options\.commandParser/);
        });

        it('should throw an error if options.actionExecutor is missing or invalid', () => {
            const options = createValidOptions();
            delete options.actionExecutor;
            expect(() => new GameLoop(options)).toThrow(/options\.actionExecutor/);
            options.actionExecutor = {}; // Missing 'executeAction'
            expect(() => new GameLoop(options)).toThrow(/options\.actionExecutor/);
        });

        it('should throw an error if options.eventBus is missing or invalid', () => {
            const options = createValidOptions();
            delete options.eventBus;
            expect(() => new GameLoop(options)).toThrow(/options\.eventBus/);
            options.eventBus = {}; // Missing methods
            expect(() => new GameLoop(options)).toThrow(/options\.eventBus/);
        });

        it('should throw an error if options object itself is missing', () => {
            expect(() => new GameLoop(undefined)).toThrow(/options\.dataManager/); // Checks first required dependency
        });

        it('should successfully instantiate with valid mock dependencies', () => {
            expect(() => new GameLoop(createValidOptions())).not.toThrow();
        });

        it("should subscribe to 'command:submit' on the event bus during construction", () => {
            new GameLoop(createValidOptions());
            expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
            expect(mockEventBus.subscribe).toHaveBeenCalledWith(
                'command:submit',
                expect.any(Function) // Check that it subscribed with a function handler
            );
        });

        it('should initialize isRunning state to false', () => {
            gameLoop = new GameLoop(createValidOptions());
            expect(gameLoop.isRunning).toBe(false);
        });
    });
    // AC 4: start() Method Tests
    describe('start', () => {
        // ... (start tests unchanged) ...
        it('Success Case: should set isRunning to true, call promptInput, and not dispatch error if player/location exist', () => {
            mockGameStateManager.getPlayer.mockReturnValue(mockPlayer);
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
            gameLoop = new GameLoop(createValidOptions());

            expect(gameLoop.isRunning).toBe(false); // Pre-condition

            gameLoop.start();

            expect(gameLoop.isRunning).toBe(true);
            // Check calls made by promptInput (which is called by start)
            expect(mockInputHandler.enable).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('ui:enable_input', {placeholder: 'Enter command...'});
            // Ensure no error message was dispatched by start itself
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, expect.objectContaining({type: 'error'}));
        });

        it('Failure Case: should dispatch error, not set isRunning, and call stop if player is missing', () => {
            mockGameStateManager.getPlayer.mockReturnValue(null); // Player missing
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
            gameLoop = new GameLoop(createValidOptions());

            gameLoop.start();

            expect(gameLoop.isRunning).toBe(false);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, {
                text: expect.stringContaining('Critical Error: GameLoop cannot start'),
                type: 'error',
            });
            // Check that promptInput was NOT called
            expect(mockInputHandler.enable).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('ui:enable_input', expect.any(Object));

            // Check that stop() was called implicitly from start's error path
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('ui:disable_input', {message: 'Game stopped.'});
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, {
                text: 'Game stopped.',
                type: 'info'
            });
        });

        it('Failure Case: should dispatch error, not set isRunning, and call stop if location is missing', () => {
            mockGameStateManager.getPlayer.mockReturnValue(mockPlayer);
            mockGameStateManager.getCurrentLocation.mockReturnValue(null); // Location missing
            gameLoop = new GameLoop(createValidOptions());

            gameLoop.start();

            expect(gameLoop.isRunning).toBe(false);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, {
                text: expect.stringContaining('Critical Error: GameLoop cannot start'),
                type: 'error',
            });
            // Check that promptInput was NOT called
            expect(mockInputHandler.enable).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('ui:enable_input', expect.any(Object));

            // Check that stop() was called implicitly from start's error path
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('ui:disable_input', {message: 'Game stopped.'});
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, {
                text: 'Game stopped.',
                type: 'info'
            });
        });

        it('should not start again if already running', () => {
            mockGameStateManager.getPlayer.mockReturnValue(mockPlayer);
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
            gameLoop = new GameLoop(createValidOptions());
            gameLoop.start(); // Start once

            // Reset mocks called by first start/promptInput
            mockInputHandler.enable.mockClear();
            mockEventBus.dispatch.mockClear();

            gameLoop.start(); // Try starting again

            expect(gameLoop.isRunning).toBe(true); // Should still be true
            // Ensure promptInput wasn't called a second time
            expect(mockInputHandler.enable).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('ui:enable_input', expect.any(Object));
        });
    });
    // AC 5: stop() Method Tests
    describe('stop', () => {
        // ... (stop tests unchanged) ...
        beforeEach(() => {
            // Setup for a running state before each stop test
            mockGameStateManager.getPlayer.mockReturnValue(mockPlayer);
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
            gameLoop = new GameLoop(createValidOptions());
            gameLoop.start();
            // Clear mocks that might have been called during start()
            jest.clearAllMocks();
        });

        it('When Running: should set isRunning to false', () => {
            expect(gameLoop.isRunning).toBe(true); // Verify precondition set by beforeEach start
            gameLoop.stop();
            expect(gameLoop.isRunning).toBe(false);
        });

        it('When Running: should call inputHandler.disable', () => {
            gameLoop.stop();
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
        });

        it('When Running: should dispatch ui:disable_input event with message', () => {
            gameLoop.stop();
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('ui:disable_input', {
                message: 'Game stopped.',
            });
        });

        it('When Running: should dispatch ui:message_display event with info', () => {
            gameLoop.stop();
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, {
                text: 'Game stopped.',
                type: 'info',
            });
        });

        it('When Already Stopped: should not perform actions', () => {
            // First, stop the loop that was started in beforeEach
            gameLoop.stop();
            expect(gameLoop.isRunning).toBe(false); // Verify it's stopped

            // Clear mocks called by the first stop
            jest.clearAllMocks();

            // Call stop again
            gameLoop.stop();

            expect(gameLoop.isRunning).toBe(false); // Should remain false
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('ui:disable_input', expect.any(Object));
            // Check specifically for the 'Game stopped.' message
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, expect.objectContaining({text: 'Game stopped.'}));
        });
    });
    // AC 6: promptInput() Method Tests
    describe('promptInput', () => {
        // ... (promptInput tests unchanged) ...
        beforeEach(() => {
            // Can instantiate here, but start/stop state will be controlled in tests
            gameLoop = new GameLoop(createValidOptions());
        });

        it('When Running: should call inputHandler.enable', () => {
            // Manually set running state without calling full start() to isolate promptInput
            mockGameStateManager.getPlayer.mockReturnValue(mockPlayer);
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
            gameLoop.start(); // Start the loop
            jest.clearAllMocks(); // Clear mocks called by start

            gameLoop.promptInput();
            expect(mockInputHandler.enable).toHaveBeenCalledTimes(1);
        });

        it('When Running: should dispatch ui:enable_input event with default placeholder', () => {
            mockGameStateManager.getPlayer.mockReturnValue(mockPlayer);
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
            gameLoop.start(); // Start the loop
            jest.clearAllMocks(); // Clear mocks called by start

            gameLoop.promptInput();
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('ui:enable_input', {
                placeholder: 'Enter command...',
            });
        });

        // Test with custom message - though GameLoop doesn't use it internally yet
        it('When Running: should dispatch ui:enable_input event with provided placeholder', () => {
            mockGameStateManager.getPlayer.mockReturnValue(mockPlayer);
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
            gameLoop.start(); // Start the loop
            jest.clearAllMocks(); // Clear mocks called by start

            const customMessage = "What now?";
            gameLoop.promptInput(customMessage);
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('ui:enable_input', {
                placeholder: customMessage,
            });
        });


        it('When Stopped: should not call inputHandler.enable', () => {
            expect(gameLoop.isRunning).toBe(false); // Ensure stopped
            gameLoop.promptInput();
            expect(mockInputHandler.enable).not.toHaveBeenCalled();
        });

        it('When Stopped: should not dispatch ui:enable_input event', () => {
            expect(gameLoop.isRunning).toBe(false); // Ensure stopped
            gameLoop.promptInput();
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('ui:enable_input', expect.any(Object));
        });
    });
    // AC 7: isRunning Getter Test
    describe('isRunning getter', () => {
        // ... (isRunning tests unchanged) ...
        it('should return false initially', () => {
            gameLoop = new GameLoop(createValidOptions());
            expect(gameLoop.isRunning).toBe(false);
        });

        it('should return true after successful start()', () => {
            mockGameStateManager.getPlayer.mockReturnValue(mockPlayer);
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
            gameLoop = new GameLoop(createValidOptions());
            gameLoop.start();
            expect(gameLoop.isRunning).toBe(true);
        });

        it('should return false after start() fails', () => {
            mockGameStateManager.getPlayer.mockReturnValue(null); // Force failure
            gameLoop = new GameLoop(createValidOptions());
            gameLoop.start();
            expect(gameLoop.isRunning).toBe(false);
        });


        it('should return false after stop() is called on a running loop', () => {
            mockGameStateManager.getPlayer.mockReturnValue(mockPlayer);
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
            gameLoop = new GameLoop(createValidOptions());
            gameLoop.start();
            expect(gameLoop.isRunning).toBe(true); // Pre-condition
            gameLoop.stop();
            expect(gameLoop.isRunning).toBe(false);
        });

        it('should return false after stop() is called on a stopped loop', () => {
            gameLoop = new GameLoop(createValidOptions());
            expect(gameLoop.isRunning).toBe(false); // Pre-condition
            gameLoop.stop();
            expect(gameLoop.isRunning).toBe(false);
        });
    });
    // --- Tests for processSubmittedCommand (Ticket 4.3.2) ---
    describe('processSubmittedCommand', () => {
        // ... (processSubmittedCommand tests unchanged) ...
        beforeEach(() => {
            jest.clearAllMocks();
            mockGameStateManager.getPlayer.mockReturnValue(mockPlayer);
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
            gameLoop = new GameLoop(createValidOptions());
            gameLoop.start();
            promptInputSpy = jest.spyOn(gameLoop, 'promptInput');
            jest.clearAllMocks();
        });

        it('should dispatch error message, not execute action, and prompt input when parser returns an error', async () => {
            const commandInput = 'look errored';
            const parserErrorResult = {
                actionId: null, directObjectPhrase: null, preposition: null, indirectObjectPhrase: null,
                originalInput: commandInput, error: 'Parser failed spectacularly!',
            };
            mockCommandParser.parse.mockReturnValue(parserErrorResult);
            await gameLoop.processSubmittedCommand(commandInput);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, {
                text: 'Parser failed spectacularly!',
                type: 'error'
            });
            expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();
            expect(promptInputSpy).toHaveBeenCalledTimes(1);
        });

        it('should dispatch unknown command message, not execute action, and prompt input for non-whitespace unknown commands', async () => {
            const commandInput = 'xyzzy'; // Use a non-empty unknown command
            const parserUnknownResult = {
                actionId: null, error: null, originalInput: commandInput,
                directObjectPhrase: null, preposition: null, indirectObjectPhrase: null,
            };
            mockCommandParser.parse.mockReturnValue(parserUnknownResult);
            await gameLoop.processSubmittedCommand(commandInput);
            // Updated expected message to match GameLoop implementation
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, {
                text: "Unknown command. Try 'help'.",
                type: 'error'
            });
            expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();
            expect(promptInputSpy).toHaveBeenCalledTimes(1);
        });

        it('should not dispatch any message, not execute action, but prompt input for whitespace-only input', async () => {
            const commandInput = '   \t '; // Whitespace only
            const parserWhitespaceResult = {actionId: null, error: null, originalInput: commandInput};
            mockCommandParser.parse.mockReturnValue(parserWhitespaceResult);
            await gameLoop.processSubmittedCommand(commandInput);
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, expect.any(Object));
            expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();
            expect(promptInputSpy).toHaveBeenCalledTimes(1);
        });

        // AC5: Test Case: Parser Returns Valid Command - Modified to call executeAction directly
        it('should call internal executeAction and prompt input when parser returns a valid command', async () => {
            const commandInput = 'get lamp';
            const validParsedCmd = {
                actionId: 'action:get', directObjectPhrase: 'lamp', preposition: null, indirectObjectPhrase: null,
                originalInput: commandInput, error: null,
            };
            mockCommandParser.parse.mockReturnValue(validParsedCmd);
            // Spy on the internal method *before* calling the outer method
            const executeActionSpy = jest.spyOn(gameLoop, 'executeAction');

            await gameLoop.processSubmittedCommand(commandInput);

            // Verify internal executeAction was called with the correct args from parser
            expect(executeActionSpy).toHaveBeenCalledTimes(1);
            expect(executeActionSpy).toHaveBeenCalledWith(validParsedCmd.actionId, validParsedCmd);

            // Verify NO specific error/warning message was dispatched by processSubmittedCommand itself
            // (Messages from the action *handler* are possible but not tested here)
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, expect.objectContaining({type: 'error'}));
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, expect.objectContaining({text: "Unknown command. Try 'help'."}));

            // Verify promptInput was called after processing
            expect(promptInputSpy).toHaveBeenCalledTimes(1);

            executeActionSpy.mockRestore(); // Clean up spy
        });

        it('should do nothing if processSubmittedCommand is called when the loop is not running', async () => {
            jest.clearAllMocks(); // Clear mocks from outer scope beforeEach
            gameLoop = new GameLoop(createValidOptions());
            expect(gameLoop.isRunning).toBe(false); // Verify precondition
            promptInputSpy = jest.spyOn(gameLoop, 'promptInput');

            await gameLoop.processSubmittedCommand('look');

            expect(mockCommandParser.parse).not.toHaveBeenCalled();
            // Ensure the internal executeAction spy (if active from other tests) wasn't called either
            // We don't have the spy active here, but checking the mock directly is fine
            expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
            expect(promptInputSpy).not.toHaveBeenCalled();
        });

        it('should dispatch error and prompt if game state is missing during command processing', async () => {
            const commandInput = 'get lamp';
            const validParsedCmd = {
                actionId: 'action:get', directObjectPhrase: 'lamp', preposition: null, indirectObjectPhrase: null,
                originalInput: commandInput, error: null,
            };
            mockCommandParser.parse.mockReturnValue(validParsedCmd);

            // Make GameStateManager return null *after* start but *before* processing
            mockGameStateManager.getPlayer.mockReturnValue(null);

            await gameLoop.processSubmittedCommand(commandInput);

            expect(mockEventBus.dispatch).toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, {
                text: "Internal Error: Game state not fully initialized.",
                type: "error"
            });
            expect(mockActionExecutor.executeAction).not.toHaveBeenCalled(); // Should not execute action
            expect(promptInputSpy).toHaveBeenCalledTimes(1); // Should still prompt
        });
    });
    // --- Tests for Internal Event Handling (_handleSubmittedCommandFromEvent) ---
    describe('Internal Event Handling (_handleSubmittedCommandFromEvent)', () => {
        // ... (internal event tests unchanged) ...
        it("should call processSubmittedCommand when 'command:submit' is received and loop is running", () => {
            mockGameStateManager.getPlayer.mockReturnValue(mockPlayer);
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
            gameLoop = new GameLoop(createValidOptions());
            gameLoop.start(); // Start the loop

            const processCmdSpy = jest.spyOn(gameLoop, 'processSubmittedCommand');
            const subscribeCall = mockEventBus.subscribe.mock.calls.find(call => call[0] === 'command:submit');
            const commandSubmitHandler = subscribeCall[1];
            const eventData = {command: 'look'};
            commandSubmitHandler(eventData);

            expect(processCmdSpy).toHaveBeenCalledTimes(1);
            expect(processCmdSpy).toHaveBeenCalledWith(eventData.command);
            processCmdSpy.mockRestore(); // Clean up spy
        });

        it("should NOT call processSubmittedCommand when 'command:submit' is received and loop is stopped", () => {
            gameLoop = new GameLoop(createValidOptions());
            expect(gameLoop.isRunning).toBe(false); // Ensure stopped

            const processCmdSpy = jest.spyOn(gameLoop, 'processSubmittedCommand');
            const subscribeCall = mockEventBus.subscribe.mock.calls.find(call => call[0] === 'command:submit');
            const commandSubmitHandler = subscribeCall[1];
            const eventData = {command: 'look'};
            commandSubmitHandler(eventData);

            expect(processCmdSpy).not.toHaveBeenCalled();
            processCmdSpy.mockRestore();
        });

        it("should call promptInput if 'command:submit' event has invalid data while running", () => {
            mockGameStateManager.getPlayer.mockReturnValue(mockPlayer);
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
            gameLoop = new GameLoop(createValidOptions()); // Constructor calls subscribe

            // Retrieve the handler BEFORE start or clearing mocks if needed elsewhere
            // Or, more simply, just rely on beforeEach clear and remove the specific clear below.
            const subscribeCall = mockEventBus.subscribe.mock.calls.find(call => call[0] === 'command:submit');
            if (!subscribeCall) { // Add a check for safety in the test itself
                throw new Error("Test setup failed: Could not find 'command:submit' subscription.");
            }
            const commandSubmitHandler = subscribeCall[1];

            gameLoop.start(); // Start the loop

            const processCmdSpy = jest.spyOn(gameLoop, 'processSubmittedCommand');
            promptInputSpy = jest.spyOn(gameLoop, 'promptInput'); // Use the class-level spy variable

            // jest.clearAllMocks(); // <-- REMOVE OR COMMENT OUT THIS LINE

            // If you NEEDED to clear mocks specific to start(), do it selectively:
            // mockInputHandler.enable.mockClear();
            // mockEventBus.dispatch.mockClear(); // Be careful not to clear subscribe

            const eventData = {wrong_key: 'look'}; // Invalid event data
            commandSubmitHandler(eventData);

            expect(processCmdSpy).not.toHaveBeenCalled();
            expect(promptInputSpy).toHaveBeenCalledTimes(1); // Should still prompt

            processCmdSpy.mockRestore();
            // promptInputSpy restored in afterEach
        });
    });


    // --- NEW TESTS FOR TICKET 4.3.3 ---
    describe('executeAction', () => {

        // Define representative ParsedCommand objects (AC2)
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

        // Setup specifically for executeAction tests (AC1)
        beforeEach(() => {
            // Ensure mocks are reset specifically for this suite if needed, though top-level reset might suffice
            jest.clearAllMocks();

            // Set up required game state
            mockGameStateManager.getPlayer.mockReturnValue(mockPlayer);
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);

            // Instantiate GameLoop for each test in this suite
            gameLoop = new GameLoop(createValidOptions());

            // Optional: Set a default return value for the mocked executeAction if not already done
            mockActionExecutor.executeAction.mockResolvedValue({
                success: true,
                messages: [{text: 'Mock action success'}]
            });
        });

        // Helper function to run common assertions on the captured context
        const assertActionContextStructure = (context, inputParsedCommand) => {
            // AC6: Assert ActionContext.parsedCommand
            expect(context.parsedCommand).toBeDefined();
            expect(context.parsedCommand).toBe(inputParsedCommand); // Strict equality (===) check

            // AC7: Assert ActionContext.targets Absence
            expect(context.targets).toBeUndefined();

            // AC8: Assert ActionContext Game State
            expect(context.playerEntity).toBe(mockPlayer);
            expect(context.currentLocation).toBe(mockLocation);

            // AC10: Assert ActionContext Dependencies
            expect(context.dataManager).toBe(mockDataManager);
            expect(context.entityManager).toBe(mockEntityManager);
            expect(context.eventBus).toBe(mockEventBus);

            // AC11: Assert ActionContext.dispatch
            expect(context.dispatch).toBeDefined();
            expect(typeof context.dispatch).toBe('function');

            // AC11 (Optional but recommended check): Verify binding
            // Clear any previous calls to the mock dispatch before testing the bound function
            mockEventBus.dispatch.mockClear();
            const testEventData = {detail: 'test data'};
            context.dispatch('test:event', testEventData);
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('test:event', testEventData);
        };

        // Test case for simple Verb command
        it('should construct and pass correct ActionContext for V command', () => {
            // AC3: Trigger Method Under Test
            gameLoop.executeAction(parsedCmdV.actionId, parsedCmdV);

            // AC4: Assert Mock Interaction
            expect(mockActionExecutor.executeAction).toHaveBeenCalledTimes(1);

            // AC5: Capture ActionContext
            const [capturedActionId, capturedContext] = mockActionExecutor.executeAction.mock.calls[0];

            // Assert captured actionId matches input
            expect(capturedActionId).toBe(parsedCmdV.actionId);

            // AC6-11: Assert context structure using helper
            assertActionContextStructure(capturedContext, parsedCmdV);
        });

        // Test case for Verb + Direct Object command
        it('should construct and pass correct ActionContext for V+DO command', () => {
            gameLoop.executeAction(parsedCmdV_DO.actionId, parsedCmdV_DO);
            expect(mockActionExecutor.executeAction).toHaveBeenCalledTimes(1);
            const [capturedActionId, capturedContext] = mockActionExecutor.executeAction.mock.calls[0];
            expect(capturedActionId).toBe(parsedCmdV_DO.actionId);
            assertActionContextStructure(capturedContext, parsedCmdV_DO);
        });

        // Test case for Verb + Preposition + Indirect Object command
        it('should construct and pass correct ActionContext for V+P+IO command', () => {
            gameLoop.executeAction(parsedCmdV_P_IO.actionId, parsedCmdV_P_IO);
            expect(mockActionExecutor.executeAction).toHaveBeenCalledTimes(1);
            const [capturedActionId, capturedContext] = mockActionExecutor.executeAction.mock.calls[0];
            expect(capturedActionId).toBe(parsedCmdV_P_IO.actionId);
            assertActionContextStructure(capturedContext, parsedCmdV_P_IO);
        });

        // Test case for Verb + Direct Object + Preposition + Indirect Object command
        it('should construct and pass correct ActionContext for V+DO+P+IO command', () => {
            gameLoop.executeAction(parsedCmdV_DO_P_IO.actionId, parsedCmdV_DO_P_IO);
            expect(mockActionExecutor.executeAction).toHaveBeenCalledTimes(1);
            const [capturedActionId, capturedContext] = mockActionExecutor.executeAction.mock.calls[0];
            expect(capturedActionId).toBe(parsedCmdV_DO_P_IO.actionId);
            assertActionContextStructure(capturedContext, parsedCmdV_DO_P_IO);
        });

        // Test case for safety check: Missing Player
        it('should log error and not execute action if player is missing', () => {
            mockGameStateManager.getPlayer.mockReturnValue(null); // Simulate missing player state
            // Spy on console.error to check for logging
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });


            gameLoop.executeAction(parsedCmdV.actionId, parsedCmdV);

            // Verify error was logged (optional check, depends on implementation)
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("GameLoop executeAction called but state missing"));

            // Verify error event was dispatched
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, {
                text: "Internal Error: Game state inconsistent.",
                type: "error"
            });

            // Crucially, verify the action executor was NOT called
            expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore(); // Clean up spy
        });

        // Test case for safety check: Missing Location
        it('should log error and not execute action if location is missing', () => {
            mockGameStateManager.getCurrentLocation.mockReturnValue(null); // Simulate missing location state
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });


            gameLoop.executeAction(parsedCmdV.actionId, parsedCmdV);

            // Verify error was logged
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("GameLoop executeAction called but state missing"));

            // Verify error event was dispatched
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, {
                text: "Internal Error: Game state inconsistent.",
                type: "error"
            });

            // Verify the action executor was NOT called
            expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });
    });
    // --- END NEW TESTS FOR TICKET 4.3.3 ---

}); // End describe('GameLoop')
