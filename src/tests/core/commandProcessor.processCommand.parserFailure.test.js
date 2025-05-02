// src/tests/core/commandProcessor.processCommand.parserFailure.test.js
// --- FILE START (Entire file content as requested) ---

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import CommandProcessor from '../../core/commandProcessor.js';

// --- Mock Dependencies ---
// Using jest.fn() creates mock functions for all required methods

const mockCommandParser = {
    parse: jest.fn(),
};

const mockActionExecutor = {
    executeAction: jest.fn(),
};

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

const mockValidatedEventDispatcher = {
    dispatchValidated: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
};

const mockGameStateManager = {
    getCurrentLocation: jest.fn(),
    getPlayer: jest.fn(),
};

const mockEntityManager = {
    getEntityInstance: jest.fn(),
    addComponent: jest.fn(),
};

const mockGameDataRepository = {
    getActionDefinition: jest.fn(),
};

// Helper function to create a full set of valid mocks for options
const createValidMocks = () => ({
    commandParser: { ...mockCommandParser, parse: jest.fn() },
    actionExecutor: { ...mockActionExecutor, executeAction: jest.fn() },
    logger: { ...mockLogger, info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    validatedEventDispatcher: { ...mockValidatedEventDispatcher, dispatchValidated: jest.fn() },
    gameStateManager: { ...mockGameStateManager, getCurrentLocation: jest.fn(), getPlayer: jest.fn() },
    entityManager: { ...mockEntityManager, getEntityInstance: jest.fn(), addComponent: jest.fn() },
    gameDataRepository: { ...mockGameDataRepository, getActionDefinition: jest.fn() },
});


describe('CommandProcessor', () => {
    let commandProcessor;
    let mocks;
    let mockActor; // Define mockActor here to be accessible in tests

    beforeEach(() => {
        // Reset mocks before each test
        mocks = createValidMocks();
        // Instantiate CommandProcessor with valid mocks by default
        commandProcessor = new CommandProcessor(mocks);
        // Define a standard valid actor for these tests
        mockActor = { id: 'player1', name: 'ParserFailTester' };
    });


    // --- processCommand Tests for Parser Failure ---
    describe('processCommand', () => {

        beforeEach(() => {
            // Clear all mocks before each test in this specific suite
            mocks = createValidMocks(); // Re-create mocks entirely to ensure clean state
            commandProcessor = new CommandProcessor(mocks); // Re-instantiate with fresh mocks


            // Mock VED dispatch to resolve successfully by default for these tests
            mocks.validatedEventDispatcher.dispatchValidated.mockResolvedValue(true);
            // Setup default actor mock accessible in this scope if needed (already done in outer scope)
            mockActor = { id: 'player1', name: 'ParserFailTester' }; // Ensure actor is defined if outer scope isn't used/reset differently
        });

        // --- Sub-Ticket 4.1.13.3 Test Case ---
        it('should handle parsing failures reported by the parser', async () => {
            // Arrange: Define test data and configure mocks
            const commandInput = ' plugh'; // Example command that fails parsing (note leading space)
            const parsingError = 'Syntax error: Unknown verb ""';
            const parsedCommandWithError = {
                error: parsingError,
                originalInput: commandInput, // Parser might include original input
                actionId: null,
                // Include other potential null/undefined properties for completeness
                verb: null,
                directObjectPhrase: null,
                preposition: null,
                indirectObjectPhrase: null,
            };

            mocks.commandParser.parse.mockReturnValue(parsedCommandWithError);

            // Act: Call the method under test
            // Use the actor defined in the beforeEach scope
            const result = await commandProcessor.processCommand(mockActor, commandInput);


            // Assert: Check the returned CommandResult precisely
            expect(result).toEqual({
                success: false,
                turnEnded: false,
                error: parsingError, // The user-facing error from parser
                internalError: `Parsing Error: ${parsingError}`, // Internal representation
                actionResult: undefined
            });

            // Assert: Check logger.warn call
            expect(mocks.logger.warn).toHaveBeenCalledTimes(1);
            // *** FIX 1: Use commandInput.trim() in the expected string ***
            const expectedLogString = `CommandProcessor: Parsing failed for command "${commandInput.trim()}" by actor ${mockActor.id}. Error: ${parsingError}`;
            expect(mocks.logger.warn).toHaveBeenCalledWith(expectedLogString);
            // The line below using stringContaining is also valid if preferred:
            // expect(mocks.logger.warn).toHaveBeenCalledWith(
            //     expect.stringContaining(`CommandProcessor: Parsing failed for command "${commandInput.trim()}" by actor ${mockActor.id}. Error: ${parsingError}`)
            // );


            // Assert: Check validatedEventDispatcher.dispatchValidated call
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            // *** FIX 2: Expect 'core:command_parse_failed' event ***
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:command_parse_failed', // Event name
                {                            // Payload
                    actorId: mockActor.id,
                    commandString: commandInput.trim(), // The trimmed command string is used internally
                    error: parsingError          // User-facing error from parser
                }
            );

            // Assert: Check that further processing steps were NOT taken
            expect(mocks.gameStateManager.getCurrentLocation).not.toHaveBeenCalled();
            expect(mocks.actionExecutor.executeAction).not.toHaveBeenCalled();

            // Assert: Check that logger.error was not called for this type of failure
            expect(mocks.logger.error).not.toHaveBeenCalled();
        });
        // --- End Sub-Ticket 4.1.13.3 Test Case ---

    }); // End describe('processCommand')

}); // End describe('CommandProcessor')
// --- FILE END ---