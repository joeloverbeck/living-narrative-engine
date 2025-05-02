// src/tests/core/commandProcessor.processCommand.locationException.test.js
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
        mockActor = { id: 'player1', name: 'LocationExceptionTester' };
    });


    // --- processCommand Tests for Location Lookup Exception ---
    describe('processCommand', () => {

        beforeEach(() => {
            // Clear all mocks before each test in this specific suite
            jest.clearAllMocks();

            // Mock VED dispatch to resolve successfully by default
            mocks.validatedEventDispatcher.dispatchValidated.mockResolvedValue(true);
        });

        // --- Sub-Ticket 4.1.13.6 Test Case ---
        it('should handle location lookup failure when getCurrentLocation throws an exception', async () => {
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

            // Configure gameStateManager to throw an exception during location lookup
            mocks.gameStateManager.getCurrentLocation.mockImplementation(() => {
                throw locationError;
            });

            // Act: Call the method under test
            const result = await commandProcessor.processCommand(mockActor, commandInput);

            // Define expected messages
            const userFacingError = 'Internal error: Could not determine your current location.';
            const internalErrorMsg = `Failed to get current location for actor ${mockActor.id}: ${locationError.message}`;

            // Assert: Check the returned CommandResult precisely
            expect(result).toEqual({
                success: false,
                turnEnded: false,
                error: userFacingError,
                // Check internalError contains the expected message prefix and the error message
                internalError: expect.stringContaining(internalErrorMsg),
                actionResult: undefined
            });
            // Optionally assert the internalError also contains the stack if relevant
            // expect(result.internalError).toContain(locationError.stack); // Uncomment if stack is included and needed


            // Assert: Check logger.error calls
            // *** FIX 1: Expect 2 calls ***
            expect(mocks.logger.error).toHaveBeenCalledTimes(2);
            // Check the first call (from the catch block)
            expect(mocks.logger.error).toHaveBeenNthCalledWith(1,
                expect.stringContaining(`CommandProcessor: Error fetching current location for actor ${mockActor.id}. Error: ${locationError.message}`),
                locationError // Ensure the actual Error object is passed
            );
            // *** FIX 2: Add check for the second call (from #dispatchSystemError) ***
            expect(mocks.logger.error).toHaveBeenNthCalledWith(2,
                expect.stringContaining(`System Error Context: ${internalErrorMsg}`),
                locationError // Ensure the actual Error object is passed
            );


            // Assert: Check that action execution was NOT attempted
            expect(mocks.actionExecutor.executeAction).not.toHaveBeenCalled();

            // Assert: Check that VED *was* called for the system error event
            // *** FIX 3: Expect 1 call ***
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            // *** FIX 4: Add check for the event payload ***
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:system_error_occurred', {
                message: userFacingError,
                type: 'error',
                details: expect.stringContaining(internalErrorMsg) // Check that internal details are included
            });

            // Assert: Check necessary prior steps *were* called
            expect(mocks.commandParser.parse).toHaveBeenCalledWith(commandInput);
            expect(mocks.gameStateManager.getCurrentLocation).toHaveBeenCalledWith(mockActor.id);

            // Assert: Check that logger.warn was not called
            expect(mocks.logger.warn).not.toHaveBeenCalled();
        });
        // --- End Sub-Ticket 4.1.13.6 Test Case ---

    }); // End describe('processCommand')

}); // End describe('CommandProcessor')
// --- FILE END ---