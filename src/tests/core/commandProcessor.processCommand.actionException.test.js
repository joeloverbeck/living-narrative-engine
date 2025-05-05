// src/tests/core/commandProcessor.processCommand.actionException.test.js
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

// --- FIX: Use jest.fn() for methods to allow per-test implementation changes if needed ---
const mockValidatedEventDispatcher = {
    dispatchValidated: jest.fn(),
    // Include other methods if they exist on the interface and might be called
    // subscribe: jest.fn(),
    // unsubscribe: jest.fn(),
};

const mockWorldContext = {
    getLocationOfEntity: jest.fn(),
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
    // --- FIX: Ensure VED mock is fresh ---
    validatedEventDispatcher: {...mockValidatedEventDispatcher, dispatchValidated: jest.fn()},
    worldContext: {...mockWorldContext, getLocationOfEntity: jest.fn(), getPlayer: jest.fn()},
    entityManager: {...mockEntityManager, getEntityInstance: jest.fn(), addComponent: jest.fn()},
    gameDataRepository: {...mockGameDataRepository, getActionDefinition: jest.fn()},
});


describe('CommandProcessor', () => {
    let commandProcessor;
    let mocks;
    let mockActor;
    let mockLocation; // Define mockLocation here

    beforeEach(() => {
        // Reset mocks before each test
        mocks = createValidMocks(); // Uses corrected function
        // Instantiate CommandProcessor with valid mocks by default
        commandProcessor = new CommandProcessor(mocks); // Constructor validation should pass
        // Define standard valid mocks accessible in tests
        mockActor = {id: 'player1', name: 'ActionExceptionTester'};
        mockLocation = {id: 'room1', name: 'Magic Lab'};

        // Clear mocks *after* instantiation to ensure clean state for test logic
        mocks.commandParser.parse.mockClear();
        mocks.actionExecutor.executeAction.mockClear();
        Object.values(mocks.logger).forEach(fn => fn.mockClear());
        mocks.validatedEventDispatcher.dispatchValidated.mockClear();
        mocks.worldContext.getLocationOfEntity.mockClear();
        mocks.worldContext.getPlayer.mockClear();
        mocks.entityManager.getEntityInstance.mockClear();
        mocks.entityManager.addComponent.mockClear();
        mocks.gameDataRepository.getActionDefinition.mockClear();

        // --- FIX: Set default mock implementations needed by the tests ---
        // Mock VED dispatch to resolve successfully by default
        mocks.validatedEventDispatcher.dispatchValidated.mockResolvedValue(true);
        // Mock location lookup to succeed by default for these tests
        mocks.worldContext.getLocationOfEntity.mockReturnValue(mockLocation);

    });


    // --- processCommand Tests for Action Exception ---
    describe('processCommand', () => {

        // No inner beforeEach needed as defaults are set in outer one

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
            // Location lookup is already mocked to succeed

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
                internalError: internalErrorDetails, // Check exact string
                actionResult: undefined
            });

            // Assert: Check logger.error call
            expect(mocks.logger.error).toHaveBeenCalledTimes(1);
            // Check that the log message contains the key details and the exception object itself is passed
            expect(mocks.logger.error).toHaveBeenCalledWith(
                `CommandProcessor: Exception occurred during execution of action ${parsedCommand.actionId} for actor ${mockActor.id}. Error: ${executionError.message}`, // Check exact string
                executionError // Ensure the actual Error object is passed
            );


            // Assert: Check validatedEventDispatcher.dispatchValidated call
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:action_failed', // Expect the semantic event
                expect.objectContaining({ // Check the payload structure (use objectContaining for flexibility)
                    actorId: mockActor.id,
                    actionId: parsedCommand.actionId,
                    commandString: commandInput,
                    error: userError, // User-facing message is part of the payload
                    isExecutionError: true,
                    details: internalErrorDetails // Check internal details match
                })
            );

            // Assert: Check necessary prior steps *were* called
            expect(mocks.commandParser.parse).toHaveBeenCalledWith(commandInput);
            expect(mocks.worldContext.getLocationOfEntity).toHaveBeenCalledTimes(1);
            expect(mocks.worldContext.getLocationOfEntity).toHaveBeenCalledWith(mockActor.id);
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledTimes(1);

            // Assert: Check context passed to executeAction
            // --- START FIX ---
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledWith(
                parsedCommand.actionId,
                expect.objectContaining({ // Check the context object structure accurately
                    actingEntity: mockActor,
                    currentLocation: mockLocation,
                    parsedCommand: parsedCommand,
                    // Expect eventBus with a dispatch function inside
                    eventBus: expect.objectContaining({
                        dispatch: expect.any(Function)
                    }),
                    // Expect the logger object
                    logger: mocks.logger,
                    // Expect the specific VED instance
                    validatedEventDispatcher: mocks.validatedEventDispatcher,
                    // Expect the world context object
                    worldContext: mocks.worldContext,
                    // Expect entity manager and game data repo
                    entityManager: mocks.entityManager,
                    gameDataRepository: mocks.gameDataRepository
                })
            );
            // --- END FIX ---

            // Assert: Check that logger.warn was not called
            expect(mocks.logger.warn).not.toHaveBeenCalled();
        });
        // --- End Sub-Ticket 4.1.13.8 Test Case ---

    }); // End describe('processCommand')

}); // End describe('CommandProcessor')
// --- FILE END ---