// src/tests/core/commandProcessor.processCommand.parserException.test.js

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
        mockActor = { id: 'player1', name: 'ParserExceptionTester' };
    });


    // --- processCommand Tests for Parser Exception ---
    describe('processCommand', () => {

        beforeEach(() => {
            // Clear all mocks before each test in this specific suite
            // Note: jest.clearAllMocks() resets call counts etc. between tests
            Object.values(mocks.commandParser).forEach(mockFn => mockFn.mockClear());
            Object.values(mocks.actionExecutor).forEach(mockFn => mockFn.mockClear());
            Object.values(mocks.logger).forEach(mockFn => mockFn.mockClear());
            Object.values(mocks.validatedEventDispatcher).forEach(mockFn => mockFn.mockClear());
            Object.values(mocks.gameStateManager).forEach(mockFn => mockFn.mockClear());
            Object.values(mocks.entityManager).forEach(mockFn => mockFn.mockClear());
            Object.values(mocks.gameDataRepository).forEach(mockFn => mockFn.mockClear());


            // Mock VED dispatch to resolve successfully by default for these tests
            // This is important because the catch block attempts to dispatch an event
            mocks.validatedEventDispatcher.dispatchValidated.mockResolvedValue(true);
        });

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
                // Check internalError contains the critical prefix, message, and stack
                internalError: expect.stringContaining(internalErrorDetails),
                actionResult: undefined
            });

            // Optionally assert internalError contains message and stack separately if preferred
            expect(result.internalError).toContain(`Critical error during command processing: ${parserException.message}`);
            expect(result.internalError).toContain(parserException.stack);


            // Assert: Check logger.error call
            // --- CORRECTED ASSERTION: Expect 2 calls ---
            expect(mocks.logger.error).toHaveBeenCalledTimes(2);
            // --- END CORRECTION ---

            // Check the first call (from the main catch block)
            expect(mocks.logger.error).toHaveBeenCalledWith(
                expect.stringContaining(`CommandProcessor: CRITICAL error processing command "${commandInput}" for actor ${mockActor.id}. Error: ${parserException.message}`),
                parserException // Ensure the actual Error object is passed for logging stack traces etc.
            );
            // Check the second call (from #dispatchSystemError)
            expect(mocks.logger.error).toHaveBeenCalledWith(
                expect.stringContaining(systemErrorContext), // Check the context string
                parserException // Ensure the error object is passed again
            );


            // Assert: Check validatedEventDispatcher.dispatchValidated call
            // --- CORRECTED ASSERTION: Expect core:system_error_occurred ---
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:system_error_occurred', // Expect the semantic event
                {                             // Expect the correct payload structure
                    message: userError,       // User-facing message
                    type: 'error',
                    details: expect.stringContaining(internalErrorDetails) // Internal details
                }
            );
            // --- END CORRECTION ---


            // Assert: Check that further processing steps were NOT taken
            // (These happen after parsing, which threw the exception)
            expect(mocks.gameStateManager.getCurrentLocation).not.toHaveBeenCalled();
            expect(mocks.actionExecutor.executeAction).not.toHaveBeenCalled();

            // Assert: Check that logger.warn was not called for this type of failure
            expect(mocks.logger.warn).not.toHaveBeenCalled();
        });
        // --- End Sub-Ticket 4.1.13.4 Test Case ---

    }); // End describe('processCommand')

}); // End describe('CommandProcessor')