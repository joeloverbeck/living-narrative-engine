// src/tests/core/commandProcessor.processCommand.invalidCommand.test.js
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

const mockWorldContext = {
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
    commandParser: {...mockCommandParser, parse: jest.fn()},
    actionExecutor: {...mockActionExecutor, executeAction: jest.fn()},
    logger: {...mockLogger, info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()},
    validatedEventDispatcher: {...mockValidatedEventDispatcher, dispatchValidated: jest.fn()},
    worldContext: {...mockWorldContext, getCurrentLocation: jest.fn(), getPlayer: jest.fn()}, // Corrected
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
        mockActor = {id: 'player1', name: 'ValidActor'};

        // Clear mocks *after* instantiation for clean test state
        jest.clearAllMocks();
        // Re-apply any default mock behavior if needed after clearAllMocks
        mocks.validatedEventDispatcher.dispatchValidated.mockResolvedValue(true); // Example
    });


    // --- processCommand Tests for Invalid Command String ---
    describe('processCommand', () => {

        // No inner beforeEach needed if outer one clears sufficiently

        // --- Sub-Ticket 4.1.13.2 Test Case ---
        it('should handle invalid command string inputs correctly', async () => {
            // Define the set of invalid command inputs that should be caught BEFORE parsing
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
                // Need to use the mocks object attached to the commandProcessor instance
                mocks.logger.warn.mockClear();
                mocks.commandParser.parse.mockClear();
                mocks.worldContext.getCurrentLocation.mockClear(); // Corrected
                mocks.actionExecutor.executeAction.mockClear();
                mocks.validatedEventDispatcher.dispatchValidated.mockClear();
                mocks.logger.info.mockClear();
                mocks.logger.debug.mockClear();
                mocks.logger.error.mockClear();


                // Act: Call the method with the valid actor and invalid command
                const result = await commandProcessor.processCommand(mockActor, invalidCommand);

                // Assert: Check the returned CommandResult precisely matches the expected result for pre-parser failures
                expect(result).toEqual(expectedResult);

                // Assert: Check logger.warn call for the pre-parser failure
                expect(mocks.logger.warn).toHaveBeenCalledTimes(1);
                // ****** START FIX: Add period to expected string ******
                expect(mocks.logger.warn).toHaveBeenCalledWith(
                    `CommandProcessor.processCommand: Empty or invalid command string provided by actor ${mockActor.id}.` // Added period
                );
                // ****** END FIX ******

                // Assert: Check that further processing steps were NOT taken because validation failed early
                expect(mocks.commandParser.parse).not.toHaveBeenCalled();
                expect(mocks.worldContext.getCurrentLocation).not.toHaveBeenCalled(); // Corrected
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