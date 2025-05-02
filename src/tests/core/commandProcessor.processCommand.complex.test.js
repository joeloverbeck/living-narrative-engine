// src/tests/core/commandProcessor.processCommand.complex.test.js
// --- FILE START (Corrected Test File) ---

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import CommandProcessor from '../../core/commandProcessor.js';
// Import Entity for type checking if needed, although mocks are primary
// import Entity from '../entities/entity.js';

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

// ****** START FIX: Rename to mockWorldContext ******
const mockWorldContext = {
    getCurrentLocation: jest.fn(),
    getPlayer: jest.fn(),
};
// ****** END FIX ******

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
    // ****** START FIX: Provide worldContext ******
    // gameStateManager: { ...mockGameStateManager, getCurrentLocation: jest.fn(), getPlayer: jest.fn() }, // Removed
    worldContext: {...mockWorldContext, getCurrentLocation: jest.fn(), getPlayer: jest.fn()}, // Added
    // ****** END FIX ******
    entityManager: {...mockEntityManager, getEntityInstance: jest.fn(), addComponent: jest.fn()},
    gameDataRepository: {...mockGameDataRepository, getActionDefinition: jest.fn()},
});


describe('CommandProcessor', () => {
    let commandProcessor;
    let mocks;

    beforeEach(() => {
        // Reset mocks before each test
        mocks = createValidMocks(); // Uses corrected function
        // Instantiate CommandProcessor with valid mocks by default
        commandProcessor = new CommandProcessor(mocks); // Constructor validation passes
    });


    // --- processCommand Tests ---
    describe('processCommand', () => {

        let mockActor;
        let mockLocation;
        const command = 'test command'; // Use a consistent valid command for tests not focusing on the command itself

        beforeEach(() => {
            // Reset mocks used within processCommand before each test in this suite
            mocks = createValidMocks(); // Re-create mocks entirely to ensure clean state
            commandProcessor = new CommandProcessor(mocks); // Re-instantiate with fresh mocks

            // Setup common valid mocks needed for most tests
            mockActor = {id: 'player1', name: 'Tester'}; // Simple object with string id is enough
            mockLocation = {id: 'room1', name: 'Test Room'}; // Simple object with id

            // ****** START FIX: Use worldContext for mock setup ******
            mocks.worldContext.getCurrentLocation.mockReturnValue(mockLocation);
            // ****** END FIX ******
            // Mock VED dispatch to resolve successfully by default
            mocks.validatedEventDispatcher.dispatchValidated.mockResolvedValue(true);
        });

        // --- Sub-Ticket 4.1.13.1 Test Case ---
        it('should handle invalid actor inputs correctly', async () => {
            const invalidActors = [null, undefined, {}, {id: 123}, {name: 'NoID'}];
            const validCommand = 'valid command'; // A placeholder command string

            for (const invalidActor of invalidActors) {
                // Clear mocks specifically involved in this test path before each iteration
                mocks.logger.error.mockClear();
                mocks.commandParser.parse.mockClear();
                // ****** START FIX: Clear worldContext mock ******
                mocks.worldContext.getCurrentLocation.mockClear();
                // ****** END FIX ******
                mocks.actionExecutor.executeAction.mockClear();
                mocks.validatedEventDispatcher.dispatchValidated.mockClear();

                // Act: Call the method with the invalid actor
                const result = await commandProcessor.processCommand(invalidActor, validCommand);

                // Assert: Check the returned CommandResult precisely
                expect(result).toEqual({
                    success: false,
                    turnEnded: false,
                    error: 'Internal error: Cannot process command without a valid actor.',
                    internalError: 'Invalid actor provided to processCommand.',
                    actionResult: undefined // Explicitly check actionResult is undefined
                });

                // Assert: Check logger.error call
                expect(mocks.logger.error).toHaveBeenCalledTimes(1);
                expect(mocks.logger.error).toHaveBeenCalledWith('CommandProcessor.processCommand: Invalid or missing actor entity provided.');

                // Assert: Check that further processing steps were NOT taken
                expect(mocks.commandParser.parse).not.toHaveBeenCalled();
                // ****** START FIX: Check worldContext mock ******
                expect(mocks.worldContext.getCurrentLocation).not.toHaveBeenCalled();
                // ****** END FIX ******
                expect(mocks.actionExecutor.executeAction).not.toHaveBeenCalled();
                expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled(); // No events dispatched for this internal error
            }
        });
        // --- End Sub-Ticket 4.1.13.1 Test Case ---


        // Test Invalid Command String Input Validation
        it('should return failure (but not error) if command string is invalid or empty', async () => {
            const invalidCommands = [null, undefined, '', '   '];
            for (const invalidCommand of invalidCommands) {
                // Clear mocks specifically involved in this test path before each iteration
                mocks.logger.warn.mockClear();
                mocks.commandParser.parse.mockClear();
                // ****** START FIX: Clear worldContext mock ******
                mocks.worldContext.getCurrentLocation.mockClear();
                // ****** END FIX ******
                mocks.actionExecutor.executeAction.mockClear();
                mocks.validatedEventDispatcher.dispatchValidated.mockClear();
                mocks.logger.error.mockClear(); // Also clear error log

                const result = await commandProcessor.processCommand(mockActor, invalidCommand);
                expect(result).toEqual({
                    success: false,
                    turnEnded: false, // Empty command doesn't end turn
                    error: undefined, // No specific user error for empty command
                    internalError: undefined,
                    actionResult: undefined,
                });

                // Check logger.warn was called for these specific invalid types
                expect(mocks.logger.warn).toHaveBeenCalledTimes(1);
                expect(mocks.logger.warn).toHaveBeenCalledWith(`CommandProcessor.processCommand: Empty or invalid command string provided by actor ${mockActor.id}.`);

                // Ensure no further processing happened
                expect(mocks.commandParser.parse).not.toHaveBeenCalled();
                // ****** START FIX: Check worldContext mock ******
                expect(mocks.worldContext.getCurrentLocation).not.toHaveBeenCalled();
                // ****** END FIX ******
                expect(mocks.actionExecutor.executeAction).not.toHaveBeenCalled();
                expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled(); // No events dispatched
                expect(mocks.logger.error).not.toHaveBeenCalled(); // Ensure no errors logged for these cases
            }
        });


    }); // End describe('processCommand')

}); // End describe('CommandProcessor')
// --- FILE END ---