// src/tests/core/commandProcessor.processCommand.locationException.test.js
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
        mocks = createValidMocks(); // Uses the corrected function
        // Instantiate CommandProcessor with valid mocks by default
        commandProcessor = new CommandProcessor(mocks); // Should pass constructor validation
        // Define a standard valid actor for these tests
        mockActor = {id: 'player1', name: 'LocationExceptionTester'};

        // Clear specific mocks after instantiation if necessary
        jest.clearAllMocks(); // Clear all mocks to ensure clean state for this test
        // Re-mock essential defaults if cleared
        mocks.validatedEventDispatcher.dispatchValidated.mockResolvedValue(true);
        // Note: getLocationOfEntity will be mocked specifically within the test case
    });


    // --- processCommand Tests for Location Lookup Exception ---
    describe('processCommand', () => {

        // Removed inner beforeEach as clearAllMocks is done in outer beforeEach

        // --- Sub-Ticket 4.1.13.6 Test Case ---
        // ****** START #7 Change: Update test description and logic ******
        it('should handle location lookup failure when getLocationOfEntity throws an exception', async () => {
            // Arrange: Define test data and configure mocks
            const commandInput = 'move north';
            const parsedCommand = {
                actionId: 'core:move',
                originalInput: commandInput,
                error: null, // Ensure parsing succeeds
                verb: 'move',
                directObjectPhrase: 'north',
                preposition: null,
                indirectObjectPhrase: null,
            };
            const locationError = new Error('Location DB unavailable');
            locationError.stack = 'DB error stack trace'; // Optional: Add mock stack

            // Configure parser to return the valid parsed command
            mocks.commandParser.parse.mockReturnValue(parsedCommand);

            // Configure worldContext to throw an exception during location lookup
            mocks.worldContext.getLocationOfEntity.mockImplementation(() => {
                throw locationError;
            });

            // Act: Call the method under test
            const result = await commandProcessor.processCommand(mockActor, commandInput);

            // Define expected messages (updated for new method name)
            const userFacingError = 'Internal error: Could not determine your current location.';
            const internalErrorMsg = `Failed to get current location for actor ${mockActor.id} using getLocationOfEntity: ${locationError.message}`;

            // Assert: Check the returned CommandResult precisely
            expect(result).toEqual({
                success: false,
                turnEnded: false,
                error: userFacingError,
                internalError: internalErrorMsg, // Check exact string now
                actionResult: undefined
            });

            // Assert: Check logger.error calls
            expect(mocks.logger.error).toHaveBeenCalledTimes(2);
            // Check the first call (from the catch block in processCommand)
            expect(mocks.logger.error).toHaveBeenNthCalledWith(1,
                `CommandProcessor: Error fetching current location for actor ${mockActor.id} using getLocationOfEntity. Error: ${locationError.message}`, // Check exact string
                locationError // Ensure the actual Error object is passed
            );
            // Check the second call (from #dispatchSystemError helper)
            expect(mocks.logger.error).toHaveBeenNthCalledWith(2,
                `System Error Context: ${internalErrorMsg}`, // Check exact string
                locationError // Ensure the actual Error object is passed
            );


            // Assert: Check that action execution was NOT attempted
            expect(mocks.actionExecutor.executeAction).not.toHaveBeenCalled();

            // Assert: Check that VED *was* called for the system error event
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:system_error_occurred', {
                message: userFacingError,
                type: 'error',
                details: internalErrorMsg // Check that internal details match
            });

            // Assert: Check necessary prior steps *were* called
            expect(mocks.commandParser.parse).toHaveBeenCalledWith(commandInput);
            // Check worldContext mock call
            expect(mocks.worldContext.getLocationOfEntity).toHaveBeenCalledTimes(1);
            expect(mocks.worldContext.getLocationOfEntity).toHaveBeenCalledWith(mockActor.id);
            // ****** END #7 Change ******

            // Assert: Check that logger.warn was not called
            expect(mocks.logger.warn).not.toHaveBeenCalled();
        });
        // --- End Sub-Ticket 4.1.13.6 Test Case ---

    }); // End describe('processCommand')

}); // End describe('CommandProcessor')
// --- FILE END ---