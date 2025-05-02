// src/tests/core/commandProcessor.processCommand.locationNull.test.js
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
    getPlayer: jest.fn(), // Keep if needed by other tests, though not used here
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
        mockActor = {id: 'player1', name: 'LocationTester'};

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

        // Re-apply any necessary default mock behavior AFTER clearing
        mocks.validatedEventDispatcher.dispatchValidated.mockResolvedValue(true);

    });


    // --- processCommand Tests for Location Lookup Failure (Null) ---
    describe('processCommand', () => {

        // No inner beforeEach needed as outer one handles setup and clearing

        // --- Sub-Ticket 4.1.13.5 Test Case ---
        // ****** START #7 Change: Update test description and logic ******
        it('should handle location lookup failure when getLocationOfEntity returns null', async () => {
            // Arrange: Define test data and configure mocks
            const commandInput = 'look';
            const parsedCommand = {
                actionId: 'core:look',
                originalInput: commandInput,
                error: null, // Ensure parsing succeeds
                verb: 'look',
                directObjectPhrase: null,
                preposition: null,
                indirectObjectPhrase: null,
            };
            const userError = 'Internal error: Your current location is unknown.';
            const internalErrorDetails = `getLocationOfEntity returned null for actor ${mockActor.id}.`; // Updated message
            const systemErrorContext = `System Error Context: ${internalErrorDetails}`;


            // Configure parser to return the valid parsed command
            mocks.commandParser.parse.mockReturnValue(parsedCommand);

            // Configure worldContext to return null for location lookup
            mocks.worldContext.getLocationOfEntity.mockReturnValue(null);

            // Act: Call the method under test
            const result = await commandProcessor.processCommand(mockActor, commandInput);

            // Assert: Check the returned CommandResult precisely
            expect(result).toEqual({
                success: false,
                turnEnded: false,
                error: userError,
                internalError: internalErrorDetails, // Exact match
                actionResult: undefined
            });

            // Assert: Check logger.error call
            expect(mocks.logger.error).toHaveBeenCalledTimes(2);

            // Check the first call (specific error message - updated to reflect code)
            expect(mocks.logger.error).toHaveBeenNthCalledWith(1,
                `CommandProcessor: Could not find current location entity for actor ${mockActor.id}. WorldContext.getLocationOfEntity returned null.` // Corrected message
            );
            // Check the second call (from #dispatchSystemError)
            expect(mocks.logger.error).toHaveBeenNthCalledWith(2,
                systemErrorContext // Check exact context string
                // No second argument (null) when originalError isn't passed to dispatchSystemError
            );

            // Assert: Check that action execution was NOT attempted
            expect(mocks.actionExecutor.executeAction).not.toHaveBeenCalled();

            // Assert: Check that VED *was* called for the system error event
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:system_error_occurred', // Expect the semantic event
                {                             // Expect the correct payload structure
                    message: userError,       // User-facing message
                    type: 'error',
                    details: internalErrorDetails // Internal details should match
                }
            );


            // Assert: Check necessary prior steps *were* called
            expect(mocks.commandParser.parse).toHaveBeenCalledWith(commandInput);
            // Check worldContext mock call
            expect(mocks.worldContext.getLocationOfEntity).toHaveBeenCalledTimes(1);
            expect(mocks.worldContext.getLocationOfEntity).toHaveBeenCalledWith(mockActor.id);
            // ****** END #7 Change ******

            // Assert: Check that logger.warn was not called
            expect(mocks.logger.warn).not.toHaveBeenCalled();
        });
        // --- End Sub-Ticket 4.1.13.5 Test Case ---

    }); // End describe('processCommand')

}); // End describe('CommandProcessor')
// --- FILE END ---