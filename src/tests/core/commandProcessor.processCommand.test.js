// src/tests/core/commandProcessor.processCommand.test.js
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

    beforeEach(() => {
        // Reset mocks before each test
        mocks = createValidMocks(); // Now creates correct deps
        // Instantiate CommandProcessor with valid mocks by default
        commandProcessor = new CommandProcessor(mocks); // Constructor validation should pass
    });

    // --- processCommand Tests ---
    describe('processCommand', () => {

        let mockActor;
        let mockLocation;
        const command = 'test command';

        beforeEach(() => {
            // Reset mocks specifically used within processCommand
            mocks.commandParser.parse.mockClear();
            // ****** START #7 Change: Reset new worldContext mock method ******
            mocks.worldContext.getLocationOfEntity.mockClear();
            // ****** END #7 Change ******
            mocks.worldContext.getPlayer.mockClear();
            mocks.actionExecutor.executeAction.mockClear();
            mocks.logger.info.mockClear();
            mocks.logger.debug.mockClear();
            mocks.logger.warn.mockClear();
            mocks.logger.error.mockClear();
            mocks.validatedEventDispatcher.dispatchValidated.mockClear();

            // Setup common mocks for success path
            mockActor = {id: 'player1', name: 'Tester'}; // Simple object with id is enough
            mockLocation = {id: 'room1', name: 'Test Room'}; // Simple object with id

            // ****** START #7 Change: Mock new location lookup method ******
            mocks.worldContext.getLocationOfEntity.mockReturnValue(mockLocation);
            // ****** END #7 Change ******
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
                endsTurn: true, // Explicitly state turn ends
            };

            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            mocks.actionExecutor.executeAction.mockResolvedValue(actionResult);

            // Act: Call the method under test
            const result = await commandProcessor.processCommand(mockActor, command);

            // Assert: Check the returned CommandResult structure
            expect(result).toEqual({
                success: true, // derived from actionResult.success
                turnEnded: true, // derived from actionResult.endsTurn
                error: null, // No user-facing error expected on success
                internalError: null, // No internal error expected on success
                actionResult: actionResult, // Include the result from actionExecutor
            });

            // Assert: Check that mocks were called correctly
            expect(mocks.logger.info).toHaveBeenCalledWith(`CommandProcessor: Processing command "${command}" for actor ${mockActor.id}`);
            expect(mocks.logger.debug).toHaveBeenCalledWith(`CommandProcessor: Attempting to parse command: "${command}"`);
            expect(mocks.logger.debug).toHaveBeenCalledWith(`CommandProcessor: Parsing complete. Result: ${JSON.stringify(parsedCommand)}`);
            expect(mocks.logger.debug).toHaveBeenCalledWith(`CommandProcessor: Parsing successful for command "${command}", action ID: ${parsedCommand.actionId}. Proceeding to build context...`);
            // ****** START #7 Change: Check new worldContext mock call ******
            expect(mocks.worldContext.getLocationOfEntity).toHaveBeenCalledTimes(1);
            expect(mocks.worldContext.getLocationOfEntity).toHaveBeenCalledWith(mockActor.id);
            // ****** END #7 Change ******
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
                    dispatch: expect.any(Function),
                    logger: mocks.logger,
                    worldContext: mocks.worldContext // Check worldContext is passed
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
                expect.objectContaining({actionId: parsedCommand.actionId, actorId: mockActor.id, result: actionResult}) // Include result
            );
            expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                expect.stringMatching(/error/i), // Don't check for any event containing 'error'
                expect.anything()
            );
            // Stricter check: Ensure it wasn't called specifically for error UI messages or other error events
            expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                'textUI:display_message',
                expect.objectContaining({type: 'error'})
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

        // --- Failure Paths ---
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
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:command_parse_failed', {
                actorId: mockActor.id,
                commandString: command,
                error: parsingError // User-facing error from parser
            });
            // Ensure action execution was not attempted
            // ****** START #7 Change: Check new mock method was not called ******
            expect(mocks.worldContext.getLocationOfEntity).not.toHaveBeenCalled();
            // ****** END #7 Change ******
            expect(mocks.actionExecutor.executeAction).not.toHaveBeenCalled();
        });

        it('should handle action execution failure (ActionResult success: false)', async () => {
            const parsedCommand = {actionId: 'core:fail', originalInput: command, error: null};
            const failureMessage = 'Target is immune!';
            const actionResult = {
                success: false,
                messages: [{text: failureMessage, type: 'combat'}], // Message explaining logical failure
                endsTurn: false // Explicitly state turn does NOT end
            };

            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            mocks.actionExecutor.executeAction.mockResolvedValue(actionResult);

            const result = await commandProcessor.processCommand(mockActor, command);

            expect(result).toEqual({
                success: false, // from actionResult.success
                turnEnded: false, // from actionResult.endsTurn
                error: null, // User-facing errors expected via events or actionResult directly
                internalError: `Action ${parsedCommand.actionId} failed. See actionResult for details.`,
                actionResult: actionResult,
            });

            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledTimes(1);
            expect(mocks.logger.debug).toHaveBeenCalledWith(`CommandProcessor: Action executor returned result for action ${parsedCommand.actionId}: ${JSON.stringify(actionResult)}`);
            expect(mocks.logger.info).toHaveBeenCalledWith(expect.stringContaining(`CommandResult: { success: false, turnEnded: false } (Logical failure)`)); // Check turnEnded false here

            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:action_failed', {
                actorId: mockActor.id,
                actionId: parsedCommand.actionId,
                commandString: command,
                error: failureMessage, // Should use the message from actionResult
                isExecutionError: false, // Logical failure
                actionResult: actionResult // Include full result
            });

            expect(mocks.logger.error).not.toHaveBeenCalledWith(expect.stringContaining('Exception occurred during execution'));
            expect(mocks.logger.error).not.toHaveBeenCalledWith(expect.stringContaining('CRITICAL error'));
        });


        it('should handle exceptions during action execution', async () => {
            const parsedCommand = {actionId: 'core:crash', originalInput: command, error: null};
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
            expect(mocks.logger.error).toHaveBeenCalledWith(
                `CommandProcessor: Exception occurred during execution of action ${parsedCommand.actionId} for actor ${mockActor.id}. Error: ${executionError.message}`,
                executionError // Log the full error object
            );
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:action_failed', {
                actorId: mockActor.id,
                actionId: parsedCommand.actionId,
                commandString: command,
                error: userFacingError, // Generic user-facing error for exception
                isExecutionError: true, // Indicates runtime exception
                details: expect.stringContaining(`Exception during action execution (${parsedCommand.actionId}): ${executionError.message}`) // Include internal details
            });
        });

        it('should return failure if actor is invalid', async () => {
            const invalidActors = [null, undefined, {}, {id: 123}, {name: 'NoID'}];
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
                expect(mocks.commandParser.parse).not.toHaveBeenCalled();
            }
        });

        it('should return failure (but not error) if command string is invalid or empty', async () => {
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
                }
                expect(mocks.commandParser.parse).not.toHaveBeenCalled();
            }
        });


        // ****** START #7 Change: Rename test and update mocks/logic ******
        it('should return failure if worldContext.getLocationOfEntity fails', async () => {
            const parsedCommand = {actionId: 'core:move', originalInput: command, error: null};
            const locationError = new Error("Database offline");
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            // Mock the worldContext method to throw
            mocks.worldContext.getLocationOfEntity.mockImplementation(() => {
                throw locationError;
            });
            mocks.validatedEventDispatcher.dispatchValidated.mockClear(); // Clear VED mock

            const result = await commandProcessor.processCommand(mockActor, command);

            const userFacingError = 'Internal error: Could not determine your current location.';
            const internalErrorMsg = `Failed to get current location for actor ${mockActor.id} using getLocationOfEntity: ${locationError.message}`; // Updated message

            expect(result).toEqual({
                success: false,
                turnEnded: false,
                error: userFacingError,
                internalError: internalErrorMsg, // Use updated message
                actionResult: undefined,
            });
            expect(mocks.logger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Error fetching current location for actor ${mockActor.id} using getLocationOfEntity`), // Updated log
                locationError
            );
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:system_error_occurred', {
                message: userFacingError,
                type: 'error',
                details: internalErrorMsg // Check updated details
            });
            expect(mocks.actionExecutor.executeAction).not.toHaveBeenCalled();
        });

        it('should return failure if worldContext.getLocationOfEntity returns null', async () => {
            const parsedCommand = {actionId: 'core:move', originalInput: command, error: null};
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            // Mock the worldContext method to return null
            mocks.worldContext.getLocationOfEntity.mockReturnValue(null); // Location not found
            mocks.validatedEventDispatcher.dispatchValidated.mockClear(); // Clear VED mock

            const result = await commandProcessor.processCommand(mockActor, command);

            const userFacingError = 'Internal error: Your current location is unknown.';
            const internalErrorMsg = `getLocationOfEntity returned null for actor ${mockActor.id}.`; // Updated message

            expect(result).toEqual({
                success: false,
                turnEnded: false,
                error: userFacingError,
                internalError: internalErrorMsg, // Use updated message
                actionResult: undefined,
            });
            // Updated log message to reference WorldContext and the new method
            expect(mocks.logger.error).toHaveBeenCalledWith(
                `CommandProcessor: Could not find current location entity for actor ${mockActor.id}. WorldContext.getLocationOfEntity returned null.`
            );
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:system_error_occurred', {
                message: userFacingError,
                type: 'error',
                details: internalErrorMsg // Use updated message
            });
            expect(mocks.actionExecutor.executeAction).not.toHaveBeenCalled();
        });
        // ****** END #7 Change ******

    }); // End describe('processCommand')

}); // End describe('CommandProcessor')
// --- FILE END ---