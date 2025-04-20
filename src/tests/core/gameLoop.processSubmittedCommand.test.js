// src/tests/core/GameLoop.processSubmittedCommand.test.js
// Extracted tests for processSubmittedCommand focusing on specific edge cases
// and command handling logic, potentially isolating mock interactions.

// Assume ActionExecutor is imported if needed for type checks, though not strictly required for mocking
// import ActionExecutor from '../../actions/actionExecutor.js';

// --- Mock Dependencies (Copied from original file) ---
import GameLoop from "../../core/gameLoop.js";
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";

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
const mockEntityManager = {}; // Basic mock object
const mockCommandParser = {
    parse: jest.fn(),
};
const mockActionExecutor = {
    executeAction: jest.fn(), // Key mock for command execution
};
const mockActionDiscoverySystem = {
    getValidActions: jest.fn().mockResolvedValue([]),
};
const mockValidatedDispatcher = {
    dispatchValidated: jest.fn(),
};
const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Mock entities for GameStateManager (Copied from original file)
const mockPlayer = {id: 'player1', name: 'Tester', getComponent: jest.fn()};
const mockLocation = {id: 'room:test', name: 'Test Chamber', getComponent: jest.fn()};

// Helper to create a complete, valid options object (Copied from original file)
const createValidOptions = () => ({
    gameDataRepository: mockGameDataRepository,
    entityManager: mockEntityManager,
    gameStateManager: mockGameStateManager,
    inputHandler: mockInputHandler,
    commandParser: mockCommandParser,
    actionExecutor: mockActionExecutor,
    eventBus: mockEventBus,
    actionDiscoverySystem: mockActionDiscoverySystem,
    validatedDispatcher: mockValidatedDispatcher, // ***** ADD THIS LINE *****
    logger: mockLogger,
});

// --- Test Suite for Extracted processSubmittedCommand Tests ---

describe('GameLoop - processSubmittedCommand Handling', () => {
    let gameLoop;
    let promptInputSpy;

    // Setup specifically tailored for processSubmittedCommand tests
    // Replicates the beforeEach from the original 'processSubmittedCommand' describe block
    beforeEach(async () => { // Make async if start() is async
        // 1. Clear standard mocks from any previous test run
        jest.clearAllMocks();

        // 2. Setup necessary game state for start() and processSubmittedCommand()
        mockGameStateManager.getPlayer.mockReturnValue(mockPlayer);
        mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
        // Default mock results needed for these tests
        mockActionExecutor.executeAction.mockResolvedValue({success: true, message: "Default mock action executed"});
        mockCommandParser.parse.mockReturnValue({actionId: null, error: 'Default mock parse', originalInput: ''});


        // 3. Instantiate and start the loop
        gameLoop = new GameLoop(createValidOptions());
        await gameLoop.start(); // Ensure loop is running for these tests. Use await if start is async.

        // 4. Attach the spy *after* start() has potentially called promptInput
        promptInputSpy = jest.spyOn(gameLoop, 'promptInput');

        // 5. Clear mock history *after* start() and spy setup, before the actual test runs
        jest.clearAllMocks(); // Clears calls made during start()
        promptInputSpy.mockClear(); // Explicitly clear spy calls made during setup if any (though start usually calls eventBus dispatch)
    });

    // Restore spies after each test in this suite
    afterEach(() => {
        if (promptInputSpy) {
            promptInputSpy.mockRestore();
            promptInputSpy = null;
        }
    });

    // --- Extracted Tests ---

    it('should dispatch error message, not execute action, and prompt input when parser returns an error', async () => {
        const commandInput = 'look errored';
        // Specific setup for this test
        const parserErrorResult = {actionId: null, error: 'Parser failed spectacularly!', originalInput: commandInput};
        mockCommandParser.parse.mockReturnValue(parserErrorResult);

        await gameLoop.processSubmittedCommand(commandInput);

        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith("event:display_message", {
            text: 'Parser failed spectacularly!', type: 'error'
        });
        expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();
        expect(promptInputSpy).toHaveBeenCalledTimes(1);
    });

    it('should dispatch unknown command message, not execute action, and prompt input for non-whitespace unknown commands', async () => {
        const commandInput = 'frobozz'; // Non-empty unknown command
        // Specific setup for this test
        const parserUnknownResult = {actionId: null, error: null, originalInput: commandInput}; // actionId is null, no error -> unknown
        mockCommandParser.parse.mockReturnValue(parserUnknownResult);

        await gameLoop.processSubmittedCommand(commandInput);

        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith("event:display_message", {
            text: "Unknown command. Try 'help'.", type: 'error'
        });
        expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();
        expect(promptInputSpy).toHaveBeenCalledTimes(1);
    });

    it('should not dispatch any message, not execute action, but prompt input for whitespace-only input', async () => {
        const commandInput = '   \t '; // Whitespace only
        // Specific setup for this test
        const parserWhitespaceResult = {actionId: null, error: null, originalInput: commandInput}; // actionId null, no error, but input is whitespace
        mockCommandParser.parse.mockReturnValue(parserWhitespaceResult);

        await gameLoop.processSubmittedCommand(commandInput);

        // Crucially check *no* messages are dispatched
        expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalledWith("event:display_message", expect.any(Object));
        expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();
        expect(promptInputSpy).toHaveBeenCalledTimes(1);
    });

    it('should call internal executeAction and prompt input when parser returns a valid command', async () => {
        const commandInput = 'get lamp';
        // Specific setup for this test
        const validParsedCmd = {
            actionId: 'action:get', directObjectPhrase: 'lamp', preposition: null, indirectObjectPhrase: null,
            originalInput: commandInput, error: null,
        };
        mockCommandParser.parse.mockReturnValue(validParsedCmd);
        // Spy on the internal method *before* calling the outer method
        // Note: GameLoop.executeAction calls the *mockActionExecutor*.executeAction
        // We want to verify the call *to* mockActionExecutor.executeAction happened correctly via GameLoop.processSubmittedCommand
        // The original test spied on gameLoop.executeAction - let's stick to that if it's an internal helper,
        // but if gameLoop.executeAction IS the method calling the mock, verifying the mock is sufficient.
        // Assuming gameLoop.executeAction is an internal detail called BY processSubmittedCommand:
        const executeActionSpy = jest.spyOn(gameLoop, 'executeAction');
        // Set a mock return for the internal executeAction if necessary (it likely calls the mock executor internally)
        executeActionSpy.mockResolvedValue(); // Simple resolved promise is often enough

        await gameLoop.processSubmittedCommand(commandInput);

        // Verify internal executeAction was called with the correct args from parser
        expect(executeActionSpy).toHaveBeenCalledTimes(1);
        expect(executeActionSpy).toHaveBeenCalledWith(validParsedCmd.actionId, validParsedCmd);

        // Verify NO specific error/warning message was dispatched *by processSubmittedCommand itself*
        expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalledWith("event:display_message", expect.objectContaining({type: 'error'}));
        expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalledWith("event:display_message", expect.objectContaining({text: "Unknown command. Try 'help'."}));

        // Verify promptInput was called after processing
        expect(promptInputSpy).toHaveBeenCalledTimes(1);

        executeActionSpy.mockRestore(); // Clean up spy
    });

    it('should dispatch error and prompt if game state is missing during command processing', async () => {
        const commandInput = 'get lamp';
        // Specific setup for this test: parser returns valid command initially
        const validParsedCmd = {
            actionId: 'action:get', directObjectPhrase: 'lamp', preposition: null, indirectObjectPhrase: null,
            originalInput: commandInput, error: null,
        };
        mockCommandParser.parse.mockReturnValue(validParsedCmd);

        // Simulate missing game state *after* start but *before* command processing logic uses it
        mockGameStateManager.getPlayer.mockReturnValue(null);
        // Or: mockGameStateManager.getCurrentLocation.mockReturnValue(null); // Test either case

        await gameLoop.processSubmittedCommand(commandInput);

        // Check for the specific internal error message
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith("event:display_message", {
            text: "Internal Error: Game state not fully initialized.", // Or the specific error message from the original code
            type: "error"
        });
        expect(mockActionExecutor.executeAction).not.toHaveBeenCalled(); // Action should NOT be executed
        expect(promptInputSpy).toHaveBeenCalledTimes(1); // Should still re-prompt the user
    });

}); // End describe('GameLoop - processSubmittedCommand Handling')