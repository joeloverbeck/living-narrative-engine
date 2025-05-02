// src/tests/core/commandProcessor.processCommand.parserException.test.js
// --- FILE START (Corrected Test File) ---

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
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

// ****** START #7 Change: Update mockWorldContext definition ******
const mockWorldContext = {
    getLocationOfEntity: jest.fn(), // New method
    getPlayer: jest.fn(),
};
// ****** END #7 Change ******

const mockEntityManager = {
    getEntityInstance: jest.fn(),
    addComponent: jest.fn(),
};

const mockGameDataRepository = {
    getActionDefinition: jest.fn(),
};

// Helper function to create a full set of valid mocks for options
const createValidMocks = () => ({
    commandParser: {...mockCommandParser, parse: jest.fn()},
    actionExecutor: {...mockActionExecutor, executeAction: jest.fn()},
    logger: {...mockLogger, info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()},
    validatedEventDispatcher: {...mockValidatedEventDispatcher, dispatchValidated: jest.fn()},
    // ****** START #7 Change: Update mock return in helper ******
    worldContext: {...mockWorldContext, getLocationOfEntity: jest.fn(), getPlayer: jest.fn()},
    // ****** END #7 Change ******
    entityManager: {...mockEntityManager, getEntityInstance: jest.fn(), addComponent: jest.fn()},
    gameDataRepository: {...mockGameDataRepository, getActionDefinition: jest.fn()},
});


describe('CommandProcessor', () => {
    let commandProcessor;
    let mocks;
    let mockActor; // Define mockActor here to be accessible in tests

    beforeEach(() => {
        // Reset mocks before each test
        mocks = createValidMocks(); // Uses corrected function
        // Instantiate CommandProcessor with valid mocks by default
        commandProcessor = new CommandProcessor(mocks); // Constructor validation should pass
        // Define a standard valid actor for these tests
        mockActor = {id: 'player1', name: 'ParserExceptionTester'};

        // Clear mocks *after* instantiation for clean test state
        // Clear individual mocks for clarity
        mocks.commandParser.parse.mockClear();
        mocks.actionExecutor.executeAction.mockClear();
        Object.values(mocks.logger).forEach(fn => fn.mockClear());
        mocks.validatedEventDispatcher.dispatchValidated.mockClear();
        // ****** START #7 Change: Clear new mock method ******
        mocks.worldContext.getLocationOfEntity.mockClear();
        // ****** END #7 Change ******
        mocks.worldContext.getPlayer.mockClear();
        mocks.entityManager.getEntityInstance.mockClear();
        mocks.entityManager.addComponent.mockClear();
        mocks.gameDataRepository.getActionDefinition.mockClear();

        // Re-apply necessary default mock behaviors AFTER clearing
        mocks.validatedEventDispatcher.dispatchValidated.mockResolvedValue(true);

    });


    // --- processCommand Tests for Parser Exception ---
    describe('processCommand', () => {

        // No inner beforeEach needed as outer one handles setup and clearing

        // --- Sub-Ticket 4.1.13.4 Test Case ---
        it('should handle exceptions thrown by the parser', async () => {
            // Arrange: Define test data and configure mocks
            const commandInput = 'some command'; // Command input doesn't matter much as parse will throw
            const parserException = new Error('Parser crashed unexpectedly');
            parserException.stack = 'Mock stack trace'; // Add mock stack

            // Configure the mock parser to throw the exception
            mocks.commandParser.parse.mockImplementation(() => {
                throw parserException;
            });

            const userError = 'An unexpected internal error occurred while processing your command.';
            const internalErrorDetails = `Critical error during command processing: ${parserException.message}. Stack: ${parserException.stack}`;
            const systemErrorContext = `System Error Context: ${internalErrorDetails}`;


            // Act: Call the method under test
            const result = await commandProcessor.processCommand(mockActor, commandInput);

            // Assert: Check the returned CommandResult precisely
            expect(result).toEqual({
                success: false,
                turnEnded: false,
                error: userError, // Specific user-facing error for critical failure
                internalError: internalErrorDetails, // Check exact string
                actionResult: undefined
            });

            // Assert: Check logger.error call
            expect(mocks.logger.error).toHaveBeenCalledTimes(2);

            // Check the first call (from the main catch block)
            expect(mocks.logger.error).toHaveBeenNthCalledWith(1,
                `CommandProcessor: CRITICAL error processing command "${commandInput}" for actor ${mockActor.id}. Error: ${parserException.message}`, // Check exact string
                parserException // Ensure the actual Error object is passed for logging stack traces etc.
            );
            // Check the second call (from #dispatchSystemError)
            expect(mocks.logger.error).toHaveBeenNthCalledWith(2,
                systemErrorContext, // Check exact context string
                parserException // Ensure the error object is passed again
            );


            // Assert: Check validatedEventDispatcher.dispatchValidated call
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:system_error_occurred', // Expect the semantic event
                {                             // Expect the correct payload structure
                    message: userError,       // User-facing message
                    type: 'error',
                    details: internalErrorDetails // Internal details should match
                }
            );


            // Assert: Check that further processing steps were NOT taken
            // (These happen after parsing, which threw the exception)
            // ****** START #7 Change: Check new mock method was not called ******
            expect(mocks.worldContext.getLocationOfEntity).not.toHaveBeenCalled();
            // ****** END #7 Change ******
            expect(mocks.actionExecutor.executeAction).not.toHaveBeenCalled();

            // Assert: Check that logger.warn was not called for this type of failure
            expect(mocks.logger.warn).not.toHaveBeenCalled();
        });
        // --- End Sub-Ticket 4.1.13.4 Test Case ---

    }); // End describe('processCommand')

}); // End describe('CommandProcessor')
// --- FILE END ---