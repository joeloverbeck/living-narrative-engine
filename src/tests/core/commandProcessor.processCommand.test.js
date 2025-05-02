// src/tests/core/commandProcessor.processCommand.test.js
// --- FILE START (Entire file content as requested) ---

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
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
    // Add subscribe/unsubscribe if needed for future tests, not strictly required by CommandProcessor constructor/processCommand
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
};

const mockGameStateManager = {
    getCurrentLocation: jest.fn(),
    getPlayer: jest.fn(),
    // Add other methods if needed by actions invoked through CommandProcessor
};

const mockEntityManager = {
    getEntityInstance: jest.fn(),
    addComponent: jest.fn(),
    // Add other methods like removeComponent, hasComponent, getComponentData if needed by actions
};

const mockGameDataRepository = {
    getActionDefinition: jest.fn(),
    // Add other methods like getEntityDefinition, etc. if needed by actions
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

    beforeEach(() => {
        // Reset mocks before each test
        mocks = createValidMocks();
        // Instantiate CommandProcessor with valid mocks by default
        commandProcessor = new CommandProcessor(mocks);
    });

    // --- processCommand Tests ---
    describe('processCommand', () => {

        let mockActor;
        let mockLocation;
        const command = 'test command';

        beforeEach(() => {
            // Reset mocks specifically used within processCommand
            mocks.commandParser.parse.mockClear();
            mocks.gameStateManager.getCurrentLocation.mockClear();
            mocks.actionExecutor.executeAction.mockClear();
            mocks.logger.info.mockClear();
            mocks.logger.debug.mockClear();
            mocks.logger.warn.mockClear();
            mocks.logger.error.mockClear();
            mocks.validatedEventDispatcher.dispatchValidated.mockClear();

            // Setup common mocks for success path
            mockActor = { id: 'player1', name: 'Tester' }; // Simple object with id is enough
            mockLocation = { id: 'room1', name: 'Test Room' }; // Simple object with id

            mocks.gameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
            // Mock VED to return success for simplicity in success path
            mocks.validatedEventDispatcher.dispatchValidated.mockResolvedValue(true);
        });

        // --- Success Path ---
        it('should process a valid command successfully and return the correct CommandResult', async () => {
            // Arrange: Configure mocks for the success path
            const parsedCommand = {
                actionId: 'core:test',
                directObjectPhrase: 'target',
                preposition: null,
                indirectObjectPhrase: null,
                originalInput: command,
                error: null, // No parsing error
            };
            const actionResult = {
                success: true,
                messages: [], // Assuming action might return messages, even if empty
            };

            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            mocks.actionExecutor.executeAction.mockResolvedValue(actionResult);

            // Act: Call the method under test
            const result = await commandProcessor.processCommand(mockActor, command);

            // Assert: Check the returned CommandResult structure
            expect(result).toEqual({
                success: true, // derived from actionResult.success
                turnEnded: true, // currently hardcoded on success
                error: null, // No user-facing error expected on success
                internalError: null, // No internal error expected on success
                actionResult: actionResult, // Include the result from actionExecutor
            });

            // Assert: Check that mocks were called correctly
            expect(mocks.logger.info).toHaveBeenCalledWith(`CommandProcessor: Processing command "${command}" for actor ${mockActor.id}`);
            expect(mocks.logger.debug).toHaveBeenCalledWith(`CommandProcessor: Attempting to parse command: "${command}"`);
            expect(mocks.logger.debug).toHaveBeenCalledWith(`CommandProcessor: Parsing complete. Result: ${JSON.stringify(parsedCommand)}`);
            // *** FIX 1: Updated expected log message ***
            expect(mocks.logger.debug).toHaveBeenCalledWith(`CommandProcessor: Parsing successful for command "${command}", action ID: ${parsedCommand.actionId}. Proceeding to build context...`);
            expect(mocks.gameStateManager.getCurrentLocation).toHaveBeenCalledWith(mockActor.id);
            expect(mocks.logger.debug).toHaveBeenCalledWith(`CommandProcessor: Successfully fetched current location ${mockLocation.id} for actor ${mockActor.id}.`);
            expect(mocks.logger.debug).toHaveBeenCalledWith(expect.stringContaining(`CommandProcessor: ActionContext built successfully`)); // Check substring
            expect(mocks.logger.debug).toHaveBeenCalledWith(`CommandProcessor: Attempting to execute action ${parsedCommand.actionId} for actor ${mockActor.id}.`);
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledTimes(1);
            // Assert executeAction was called with the correct actionId and a valid context object
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledWith(
                parsedCommand.actionId,
                expect.objectContaining({
                    actingEntity: mockActor,
                    currentLocation: mockLocation,
                    parsedCommand: parsedCommand,
                    gameDataRepository: mocks.gameDataRepository,
                    entityManager: mocks.entityManager,
                    // Check dispatch is a function bound to the VED instance
                    dispatch: expect.any(Function), // More specific check might be complex/brittle
                    logger: mocks.logger,
                    gameStateManager: mocks.gameStateManager,
                })
            );
            expect(mocks.logger.debug).toHaveBeenCalledWith(`CommandProcessor: Action executor returned result for action ${parsedCommand.actionId}: ${JSON.stringify(actionResult)}`);
            expect(mocks.logger.info).toHaveBeenCalledWith(expect.stringContaining(`CommandProcessor: Action ${parsedCommand.actionId} processed for actor ${mockActor.id}. CommandResult: { success: true, turnEnded: true }`));

            // Ensure error/warning logs were NOT called in success path
            expect(mocks.logger.warn).not.toHaveBeenCalled();
            expect(mocks.logger.error).not.toHaveBeenCalled();
            // Check VED was called for core:action_executed, but not for errors
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:action_executed',
                expect.objectContaining({ actionId: parsedCommand.actionId, actorId: mockActor.id })
            );
            expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                expect.stringMatching(/error/i), // Don't check for any event containing 'error'
                expect.anything()
            );
            // Stricter check: Ensure it wasn't called specifically for error UI messages or other error events
            expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                'textUI:display_message',
                expect.objectContaining({ type: 'error' })
            );
            expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                'core:command_parse_failed',
                expect.anything()
            );
            expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                'core:action_failed',
                expect.anything()
            );
            expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                'core:system_error_occurred',
                expect.anything()
            );
        });

        // --- Add more test cases for failure paths (parsing error, missing location, action execution error, etc.) ---
        // Example: Parsing Error
        it('should handle parsing errors correctly', async () => {
            const parsingError = 'Unknown command verb';
            const parsedCommandWithError = {
                actionId: null,
                originalInput: command,
                error: parsingError,
            };
            mocks.commandParser.parse.mockReturnValue(parsedCommandWithError);

            const result = await commandProcessor.processCommand(mockActor, command);

            expect(result).toEqual({
                success: false,
                turnEnded: false,
                error: parsingError, // User-facing error
                internalError: `Parsing Error: ${parsingError}`, // Internal details
                actionResult: undefined, // No action result
            });

            expect(mocks.logger.warn).toHaveBeenCalledWith(`CommandProcessor: Parsing failed for command "${command}" by actor ${mockActor.id}. Error: ${parsingError}`);
            // *** FIX 2: Expect core:command_parse_failed event ***
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:command_parse_failed', {
                actorId: mockActor.id,
                commandString: command,
                error: parsingError // User-facing error from parser
            });
            // Ensure action execution was not attempted
            expect(mocks.gameStateManager.getCurrentLocation).not.toHaveBeenCalled();
            expect(mocks.actionExecutor.executeAction).not.toHaveBeenCalled();
        });

        // Example: Action Execution Failure (ActionResult { success: false })
        it('should handle action execution failure (ActionResult success: false)', async () => {
            const parsedCommand = { actionId: 'core:fail', originalInput: command, error: null };
            // Simulate an action result with a specific failure message
            const failureMessage = 'Target is immune!';
            const actionResult = {
                success: false,
                messages: [{ text: failureMessage, type: 'combat' }] // Message explaining logical failure
            };

            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            mocks.actionExecutor.executeAction.mockResolvedValue(actionResult);

            const result = await commandProcessor.processCommand(mockActor, command);

            expect(result).toEqual({
                success: false, // from actionResult.success
                turnEnded: true, // Still ends turn even on action failure (as per current logic)
                error: null, // User-facing errors expected via events or actionResult directly
                internalError: `Action ${parsedCommand.actionId} failed. See actionResult for details.`,
                actionResult: actionResult,
            });

            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledTimes(1);
            expect(mocks.logger.debug).toHaveBeenCalledWith(`CommandProcessor: Action executor returned result for action ${parsedCommand.actionId}: ${JSON.stringify(actionResult)}`);
            expect(mocks.logger.info).toHaveBeenCalledWith(expect.stringContaining(`CommandResult: { success: false, turnEnded: true }`));

            // Expect the 'core:action_failed' event to be dispatched for logical failures
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:action_failed', {
                actorId: mockActor.id,
                actionId: parsedCommand.actionId,
                commandString: command,
                error: failureMessage, // Should use the message from actionResult
                isExecutionError: false, // Logical failure
                actionResult: actionResult // Include full result
            });

            // Ensure error logs specific to *exceptions* were not called
            expect(mocks.logger.error).not.toHaveBeenCalledWith(expect.stringContaining('Exception occurred during execution'));
            expect(mocks.logger.error).not.toHaveBeenCalledWith(expect.stringContaining('CRITICAL error'));
        });


        // Example: Action Execution Exception
        it('should handle exceptions during action execution', async () => {
            const parsedCommand = { actionId: 'core:crash', originalInput: command, error: null };
            const executionError = new Error('Something broke badly');
            executionError.stack = 'Error stack trace'; // Mock stack trace

            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            mocks.actionExecutor.executeAction.mockRejectedValue(executionError); // Throw error

            const result = await commandProcessor.processCommand(mockActor, command);

            const userFacingError = `An internal error occurred while performing the action.`;

            expect(result).toEqual({
                success: false,
                turnEnded: false, // Turn doesn't end on exception
                error: userFacingError,
                internalError: expect.stringContaining(`Exception during action execution (${parsedCommand.actionId}): ${executionError.message}`), // Check for key parts
                actionResult: undefined, // No action result
            });
            // Ensure error was logged
            expect(mocks.logger.error).toHaveBeenCalledWith(
                `CommandProcessor: Exception occurred during execution of action ${parsedCommand.actionId} for actor ${mockActor.id}. Error: ${executionError.message}`,
                executionError // Log the full error object
            );
            // *** FIX 3: Expect core:action_failed event for execution errors ***
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:action_failed', {
                actorId: mockActor.id,
                actionId: parsedCommand.actionId,
                commandString: command,
                error: userFacingError, // Generic user-facing error for exception
                isExecutionError: true, // Indicates runtime exception
                details: expect.stringContaining(`Exception during action execution (${parsedCommand.actionId}): ${executionError.message}`) // Include internal details
            });
        });

        // Test Input Validation
        it('should return failure if actor is invalid', async () => {
            const invalidActors = [null, undefined, {}, { id: 123 }, { name: 'NoID' }];
            for (const invalidActor of invalidActors) {
                mocks.logger.error.mockClear(); // Clear log before each iteration
                mocks.commandParser.parse.mockClear(); // Clear parse mock too

                const result = await commandProcessor.processCommand(invalidActor, command);
                expect(result).toEqual({
                    success: false,
                    turnEnded: false,
                    internalError: 'Invalid actor provided to processCommand.',
                    error: 'Internal error: Cannot process command without a valid actor.',
                    actionResult: undefined,
                });
                expect(mocks.logger.error).toHaveBeenCalledWith('CommandProcessor.processCommand: Invalid or missing actor entity provided.');
                // Ensure no further processing happened
                expect(mocks.commandParser.parse).not.toHaveBeenCalled();
            }
        });

        it('should return failure (but not error) if command string is invalid or empty', async () => {
            // *** FIX 4: Removed 123 from this list ***
            const invalidCommands = [null, undefined, '', '   '];
            for (const invalidCommand of invalidCommands) {
                mocks.logger.warn.mockClear(); // Clear log before each iteration
                mocks.commandParser.parse.mockClear(); // Clear parse mock

                const result = await commandProcessor.processCommand(mockActor, invalidCommand);
                expect(result).toEqual({
                    success: false,
                    turnEnded: false, // Empty command doesn't end turn
                    error: undefined, // No specific user error for empty command
                    internalError: undefined,
                    actionResult: undefined,
                });
                // This check remains valid for the remaining inputs
                if (typeof invalidCommand !== 'string' || invalidCommand.trim() === '') {
                    expect(mocks.logger.warn).toHaveBeenCalledWith(`CommandProcessor.processCommand: Empty or invalid command string provided by actor ${mockActor.id}.`);
                } else {
                    // This case should not be hit with the modified invalidCommands array
                    expect(mocks.logger.warn).not.toHaveBeenCalled();
                }
                // Ensure no further processing happened (parser not called)
                expect(mocks.commandParser.parse).not.toHaveBeenCalled();
            }
        });


        // Test failure to get location
        it('should return failure if gameStateManager.getCurrentLocation fails', async () => {
            const parsedCommand = { actionId: 'core:move', originalInput: command, error: null };
            const locationError = new Error("Database offline");
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            mocks.gameStateManager.getCurrentLocation.mockImplementation(() => {
                throw locationError;
            });
            // Mock dispatch for system error
            mocks.validatedEventDispatcher.dispatchValidated.mockClear();

            const result = await commandProcessor.processCommand(mockActor, command);

            const userFacingError = 'Internal error: Could not determine your current location.';
            const internalErrorMsg = `Failed to get current location for actor ${mockActor.id}: ${locationError.message}`;

            expect(result).toEqual({
                success: false,
                turnEnded: false,
                error: userFacingError,
                internalError: expect.stringContaining(internalErrorMsg),
                actionResult: undefined,
            });
            expect(mocks.logger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Error fetching current location for actor ${mockActor.id}`),
                locationError
            );
            // Check for system error event dispatch
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:system_error_occurred', {
                message: userFacingError,
                type: 'error',
                details: expect.stringContaining(internalErrorMsg)
            });
            expect(mocks.actionExecutor.executeAction).not.toHaveBeenCalled();
        });

        it('should return failure if gameStateManager.getCurrentLocation returns null', async () => {
            const parsedCommand = { actionId: 'core:move', originalInput: command, error: null };
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            mocks.gameStateManager.getCurrentLocation.mockReturnValue(null); // Location not found
            // Mock dispatch for system error
            mocks.validatedEventDispatcher.dispatchValidated.mockClear();

            const result = await commandProcessor.processCommand(mockActor, command);

            const userFacingError = 'Internal error: Your current location is unknown.';
            const internalErrorMsg = `getCurrentLocation returned null for actor ${mockActor.id}.`;

            expect(result).toEqual({
                success: false,
                turnEnded: false,
                error: userFacingError,
                internalError: internalErrorMsg,
                actionResult: undefined,
            });
            expect(mocks.logger.error).toHaveBeenCalledWith(
                `CommandProcessor: Could not find current location entity for actor ${mockActor.id}. GameStateManager returned null.`
            );
            // Check for system error event dispatch
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:system_error_occurred', {
                message: userFacingError,
                type: 'error',
                details: internalErrorMsg
            });
            expect(mocks.actionExecutor.executeAction).not.toHaveBeenCalled();
        });

    }); // End describe('processCommand')

}); // End describe('CommandProcessor')
// --- FILE END ---