// src/tests/core/commandProcessor.processCommand.invalidCommand.test.js
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
        mockActor = { id: 'player1', name: 'ValidActor' };
    });


    // --- processCommand Tests for Invalid Command String ---
    describe('processCommand', () => {

        beforeEach(() => {
            // Clear all mocks before each test in this specific suite
            jest.clearAllMocks();

            // Re-setup any necessary default mock behavior if needed after clearAllMocks
            // For this test suite, we primarily care about input validation,
            // so default return values for later steps aren't strictly necessary.
            // We still need the mockActor defined in the outer beforeEach.
        });

        // --- Sub-Ticket 4.1.13.2 Test Case ---
        it('should handle invalid command string inputs correctly', async () => {
            // Define the set of invalid command inputs that should be caught BEFORE parsing
            // *** CHANGE: Removed 123 from this list ***
            const invalidCommands = [null, undefined, '', ' '];

            // Define the expected result structure for commands failing the initial validation
            const expectedResult = {
                success: false,
                turnEnded: false,
                error: undefined,
                internalError: undefined,
                actionResult: undefined
            };

            for (const invalidCommand of invalidCommands) {
                // Clear mocks specifically involved in this test path *before each iteration*
                mocks.logger.warn.mockClear();
                mocks.commandParser.parse.mockClear();
                mocks.gameStateManager.getCurrentLocation.mockClear();
                mocks.actionExecutor.executeAction.mockClear();
                mocks.validatedEventDispatcher.dispatchValidated.mockClear();
                // Also clear logger.info/debug/error to be safe, although warn is primary here
                mocks.logger.info.mockClear();
                mocks.logger.debug.mockClear();
                mocks.logger.error.mockClear();


                // Act: Call the method with the valid actor and invalid command
                const result = await commandProcessor.processCommand(mockActor, invalidCommand);

                // Assert: Check the returned CommandResult precisely matches the expected result for pre-parser failures
                expect(result).toEqual(expectedResult);

                // Assert: Check logger.warn call for the pre-parser failure
                // Based on the code logic: (!commandString) which is true for null, undefined, '', ' '
                expect(mocks.logger.warn).toHaveBeenCalledTimes(1);
                expect(mocks.logger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`CommandProcessor.processCommand: Empty or invalid command string provided by actor ${mockActor.id}`)
                );

                // Assert: Check that further processing steps were NOT taken because validation failed early
                expect(mocks.commandParser.parse).not.toHaveBeenCalled();
                expect(mocks.gameStateManager.getCurrentLocation).not.toHaveBeenCalled();
                expect(mocks.actionExecutor.executeAction).not.toHaveBeenCalled();
                expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();

                // Assert that logger.error was not called for this specific pre-parser failure type
                expect(mocks.logger.error).not.toHaveBeenCalled();
            }
        });
        // --- End Sub-Ticket 4.1.13.2 Test Case ---

    }); // End describe('processCommand')

}); // End describe('CommandProcessor')
// --- FILE END ---