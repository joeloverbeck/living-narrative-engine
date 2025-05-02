// src/tests/core/commandProcessor.processCommand.actionException.test.js

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
    let mockActor;
    let mockLocation; // Define mockLocation here

    beforeEach(() => {
        // Reset mocks before each test
        mocks = createValidMocks();
        // Instantiate CommandProcessor with valid mocks by default
        commandProcessor = new CommandProcessor(mocks);
        // Define standard valid mocks accessible in tests
        mockActor = { id: 'player1', name: 'ActionExceptionTester' };
        mockLocation = { id: 'room1', name: 'Magic Lab' };
    });


    // --- processCommand Tests for Action Exception ---
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


            // Mock VED dispatch to resolve successfully by default
            mocks.validatedEventDispatcher.dispatchValidated.mockResolvedValue(true);
            // Mock location lookup to succeed by default for these tests
            mocks.gameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
        });

        // --- Sub-Ticket 4.1.13.8 Test Case ---
        it('should handle action failure when executeAction throws an exception', async () => {
            // Arrange: Define test data and configure mocks
            const commandInput = 'use wand';
            const parsedCommand = {
                actionId: 'core:use',
                originalInput: commandInput,
                error: null, // Ensure parsing succeeds
                verb: 'use',
                directObjectPhrase: 'wand',
                preposition: null,
                indirectObjectPhrase: null,
            };
            const executionError = new Error('Executor subsystem crashed');
            executionError.stack = 'Mock stack trace'; // Add mock stack

            // Configure parser to return the valid parsed command
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            // Location lookup is already mocked to succeed in beforeEach

            // Configure action executor to reject with the exception
            mocks.actionExecutor.executeAction.mockRejectedValue(executionError);

            const userError = 'An internal error occurred while performing the action.';
            const internalErrorDetails = `Exception during action execution (${parsedCommand.actionId}): ${executionError.message}. Stack: ${executionError.stack}`;

            // Act: Call the method under test
            const result = await commandProcessor.processCommand(mockActor, commandInput);

            // Assert: Check the returned CommandResult precisely
            expect(result).toEqual({
                success: false,
                turnEnded: false, // Turn does NOT end on execution exception
                error: userError, // Generic user-facing error for execution exceptions
                internalError: expect.stringContaining(internalErrorDetails), // Check contains, as exact string might be fragile if stack trace formatting changes
                actionResult: undefined
            });
            // More robust check for internalError content
            expect(result.internalError).toContain(`Exception during action execution (${parsedCommand.actionId}): ${executionError.message}`);
            expect(result.internalError).toContain(executionError.stack);


            // Assert: Check logger.error call
            expect(mocks.logger.error).toHaveBeenCalledTimes(1);
            // Check that the log message contains the key details and the exception object itself is passed
            expect(mocks.logger.error).toHaveBeenCalledWith(
                expect.stringContaining(`CommandProcessor: Exception occurred during execution of action ${parsedCommand.actionId} for actor ${mockActor.id}. Error: ${executionError.message}`),
                executionError // Ensure the actual Error object is passed
            );


            // Assert: Check validatedEventDispatcher.dispatchValidated call
            // --- THIS IS THE CORRECTED ASSERTION ---
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:action_failed', // Expect the semantic event
                {                       // Expect the correct payload for core:action_failed
                    actorId: mockActor.id,
                    actionId: parsedCommand.actionId,
                    commandString: commandInput,
                    error: userError, // User-facing message is part of the payload
                    isExecutionError: true,
                    details: expect.stringContaining(internalErrorDetails) // Check internal details are included
                }
            );
            // --- END CORRECTION ---

            // Assert: Check necessary prior steps *were* called
            expect(mocks.commandParser.parse).toHaveBeenCalledWith(commandInput);
            expect(mocks.gameStateManager.getCurrentLocation).toHaveBeenCalledWith(mockActor.id);
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledTimes(1);
            // Check executeAction arguments
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledWith(
                parsedCommand.actionId,
                expect.objectContaining({ // Check the context object structure
                    actingEntity: mockActor,
                    currentLocation: mockLocation,
                    parsedCommand: parsedCommand,
                    // Add other context properties if needed for the check
                    dispatch: expect.any(Function), // Ensure dispatch is passed in context
                    logger: mocks.logger,
                    gameStateManager: mocks.gameStateManager,
                    entityManager: mocks.entityManager,
                    gameDataRepository: mocks.gameDataRepository
                })
            );

            // Assert: Check that logger.warn was not called
            expect(mocks.logger.warn).not.toHaveBeenCalled();
        });
        // --- End Sub-Ticket 4.1.13.8 Test Case ---

    }); // End describe('processCommand')

}); // End describe('CommandProcessor')
