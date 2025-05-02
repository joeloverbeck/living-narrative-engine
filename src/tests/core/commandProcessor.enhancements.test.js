// src/tests/core/commandProcessor.enhancements.test.js
// --- FILE START (Entire file content as corrected) ---

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import CommandProcessor from '../../core/commandProcessor.js';

// --- Mock Dependencies ---
const mockCommandParser = {parse: jest.fn()};
const mockActionExecutor = {executeAction: jest.fn()};
const mockLogger = {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
};
const mockValidatedEventDispatcher = {dispatchValidated: jest.fn()};
const mockWorldContext = {getLocationOfEntity: jest.fn(), getPlayer: jest.fn()};
const mockEntityManager = {getEntityInstance: jest.fn(), addComponent: jest.fn()};
const mockGameDataRepository = {getActionDefinition: jest.fn()};

// Helper function to create a full set of valid mocks
const createValidMocks = () => ({
    commandParser: {...mockCommandParser, parse: jest.fn()},
    actionExecutor: {...mockActionExecutor, executeAction: jest.fn()},
    logger: {...mockLogger, info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()},
    validatedEventDispatcher: {...mockValidatedEventDispatcher, dispatchValidated: jest.fn()},
    worldContext: {...mockWorldContext, getLocationOfEntity: jest.fn(), getPlayer: jest.fn()},
    entityManager: {...mockEntityManager, getEntityInstance: jest.fn(), addComponent: jest.fn()},
    gameDataRepository: {...mockGameDataRepository, getActionDefinition: jest.fn()},
});

describe('CommandProcessor Enhanced Tests (Ticket 6.2.4)', () => {
    let commandProcessor;
    let mocks;
    let mockActor;
    let mockLocation;

    beforeEach(() => {
        mocks = createValidMocks();
        commandProcessor = new CommandProcessor(mocks);
        mockActor = {id: 'player1', name: 'EnhancedTester'};
        mockLocation = {id: 'testRoom', name: 'Enhanced Testing Room'};
        jest.clearAllMocks();
        mocks.worldContext.getLocationOfEntity.mockReturnValue(mockLocation);
        mocks.validatedEventDispatcher.dispatchValidated.mockResolvedValue(true); // Default VED success
    });

    // --- Gap: More variations in command strings tested ---
    describe('Command String Variations', () => {
        it('should handle command with only verb correctly', async () => {
            const commandInput = 'look';
            const parsedCommand = {actionId: 'core:look', verb: 'look', originalInput: commandInput, error: null};
            const actionResult = {success: true, endsTurn: false};
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            mocks.actionExecutor.executeAction.mockResolvedValue(actionResult);

            const result = await commandProcessor.processCommand(mockActor, commandInput);

            expect(result.success).toBe(true);
            expect(result.turnEnded).toBe(false);
            expect(mocks.commandParser.parse).toHaveBeenCalledWith(commandInput);
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledWith('core:look', expect.anything());
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:action_executed', expect.objectContaining({actionId: 'core:look'}));
        });

        it('should handle command with verb and direct object phrase correctly', async () => {
            const commandInput = 'take the shiny key';
            const parsedCommand = {
                actionId: 'core:take',
                verb: 'take',
                directObjectPhrase: 'the shiny key',
                originalInput: commandInput,
                error: null
            };
            const actionResult = {success: true, endsTurn: true};
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            mocks.actionExecutor.executeAction.mockResolvedValue(actionResult);

            const result = await commandProcessor.processCommand(mockActor, commandInput);

            expect(result.success).toBe(true);
            expect(result.turnEnded).toBe(true);
            expect(mocks.commandParser.parse).toHaveBeenCalledWith(commandInput);
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledWith('core:take', expect.objectContaining({parsedCommand: expect.objectContaining({directObjectPhrase: 'the shiny key'})}));
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:action_executed', expect.objectContaining({actionId: 'core:take'}));
        });

        it('should handle command with verb, direct object, preposition, and indirect object phrase correctly', async () => {
            const commandInput = 'put the book on the table';
            const parsedCommand = {
                actionId: 'verb:put',
                verb: 'put',
                directObjectPhrase: 'the book',
                preposition: 'on',
                indirectObjectPhrase: 'the table',
                originalInput: commandInput,
                error: null
            };
            const actionResult = {success: true, endsTurn: true};
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            mocks.actionExecutor.executeAction.mockResolvedValue(actionResult);

            const result = await commandProcessor.processCommand(mockActor, commandInput);

            expect(result.success).toBe(true);
            expect(result.turnEnded).toBe(true);
            expect(mocks.commandParser.parse).toHaveBeenCalledWith(commandInput);
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledWith('verb:put', expect.objectContaining({
                parsedCommand: expect.objectContaining({
                    directObjectPhrase: 'the book',
                    preposition: 'on',
                    indirectObjectPhrase: 'the table'
                })
            }));
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:action_executed', expect.objectContaining({actionId: 'verb:put'}));
        });
    });

    // --- Gap: ActionExecutor returns { success: true, endsTurn: false } ---
    describe('ActionExecutor Result Variations', () => {
        it('should handle ActionResult with success: true and endsTurn: false correctly', async () => {
            const commandInput = 'examine map';
            const parsedCommand = {actionId: 'core:examine', originalInput: commandInput, error: null};
            const actionResult = {
                success: true,
                messages: [{text: 'The map shows a nearby cave.', type: 'info'}],
                endsTurn: false
            };
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            mocks.actionExecutor.executeAction.mockResolvedValue(actionResult);

            const result = await commandProcessor.processCommand(mockActor, commandInput);

            expect(result).toEqual({
                success: true,
                turnEnded: false,
                error: null,
                internalError: null,
                actionResult: actionResult
            });
            expect(mocks.logger.info).toHaveBeenCalledWith(expect.stringContaining(`CommandResult: { success: true, turnEnded: false }`));
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:action_executed', expect.objectContaining({
                actionId: parsedCommand.actionId,
                actorId: mockActor.id,
                result: actionResult
            }));
            expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('core:action_failed', expect.anything());
            expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('core:system_error_occurred', expect.anything());
        });
    });

    // --- Gap: Testing the dispatch function passed within the ActionContext ---
    describe('ActionContext Dispatch Functionality', () => {
        it('should call VED correctly when the internal dispatch function is used by the action', async () => {
            const commandInput = 'activate portal';
            const parsedCommand = {actionId: 'custom:activate_portal', originalInput: commandInput, error: null};
            const eventToDispatchInternally = {
                type: 'custom:portal_activated',
                payload: {locationId: mockLocation.id, stability: 'stable'}
            };
            const actionResult = {success: true, endsTurn: true};
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            mocks.actionExecutor.executeAction.mockImplementation(async (actionId, context) => {
                await context.dispatch(eventToDispatchInternally.type, eventToDispatchInternally.payload);
                return actionResult;
            });

            const result = await commandProcessor.processCommand(mockActor, commandInput);

            expect(result.success).toBe(true);
            expect(result.turnEnded).toBe(true);
            expect(result.actionResult).toBe(actionResult);
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledTimes(1);
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledWith(parsedCommand.actionId, expect.objectContaining({dispatch: expect.any(Function)}));
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(2);
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(eventToDispatchInternally.type, eventToDispatchInternally.payload);
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:action_executed', expect.objectContaining({
                actionId: parsedCommand.actionId,
                result: actionResult
            }));
        });

        it('should handle errors if the internal dispatch function fails', async () => {
            const commandInput = 'trigger unstable device';
            const parsedCommand = {actionId: 'custom:trigger_device', originalInput: commandInput, error: null};
            const internalEvent = {type: 'device:triggered', payload: {intensity: 11}};
            const dispatchError = new Error('VED failed during internal dispatch');
            dispatchError.stack = 'Mock VED stack trace'; // Maintain mock stack for predictability

            mocks.commandParser.parse.mockReturnValue(parsedCommand);

            // Store the captured dispatch function
            let capturedDispatch;

            mocks.actionExecutor.executeAction.mockImplementation(async (actionId, context) => {
                capturedDispatch = context.dispatch; // Capture the dispatch function

                // Simulate the action attempting to dispatch, which will throw
                // We need to throw *outside* the mockImplementation of dispatch itself
                // because the error needs to be caught by the CommandProcessor's try/catch around executeAction
                await capturedDispatch(internalEvent.type, internalEvent.payload);

                // This part is unreachable if dispatch throws
                return {success: true, endsTurn: true};
            });

            // Make the captured dispatch function throw when called with the specific event
            // This needs to happen *before* processCommand is called but *after* executeAction is mocked
            // We achieve this by mocking VED directly *before* the call that uses the captured dispatch
            mocks.validatedEventDispatcher.dispatchValidated.mockImplementation(async (eventName) => {
                if (eventName === internalEvent.type) {
                    throw dispatchError; // Throw when the specific internal event is dispatched
                }
                return true; // Allow other dispatches (like core:action_failed) to succeed
            });


            // Act
            const result = await commandProcessor.processCommand(mockActor, commandInput);

            // Assert: The command should fail because the internal dispatch failed
            const userFacingError = 'An internal error occurred while performing the action.';
            // ** FIX: internalError should now contain the full message including stack **
            const expectedInternalError = `Exception during action execution (${parsedCommand.actionId}): ${dispatchError.message}. Stack: ${dispatchError.stack}`;

            expect(result).toEqual({
                success: false,
                turnEnded: false,
                error: userFacingError,
                internalError: expectedInternalError, // Expect the exact string including stack
                actionResult: undefined,
            });

            // Assert: VED dispatch was attempted for the internal event (which caused the throw)
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(internalEvent.type, internalEvent.payload);

            // Assert: VED dispatch was *not* called for core:action_executed
            expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('core:action_executed', expect.anything());

            // Assert: VED dispatch *was* called for core:action_failed (this should succeed based on the updated mock)
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:action_failed',
                expect.objectContaining({
                    actorId: mockActor.id,
                    actionId: parsedCommand.actionId,
                    error: userFacingError,
                    isExecutionError: true,
                    details: expectedInternalError // Details should match the internal error
                }),
            );

            // Assert: Logger.error was called for the exception caught during execution
            expect(mocks.logger.error).toHaveBeenCalledWith(
                // ** FIX: Ensure the logger message matches the caught error's message **
                `CommandProcessor: Exception occurred during execution of action ${parsedCommand.actionId} for actor ${mockActor.id}. Error: ${dispatchError.message}`,
                dispatchError, // Pass the original error object
            );
        });

    });

    // --- Gap: Errors during VED dispatch ---
    describe('VED Dispatch Error Handling', () => {
        const vedError = new Error('VED dispatch failed');
        vedError.stack = 'VED Error Stack';

        it('should handle VED error during core:action_executed dispatch', async () => {
            const commandInput = 'succeed but fail dispatch';
            const parsedCommand = {actionId: 'core:succeed', error: null};
            const actionResult = {success: true, endsTurn: true};
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            mocks.actionExecutor.executeAction.mockResolvedValue(actionResult);
            // ** FIX: Mock VED to throw *only* for core:action_executed **
            mocks.validatedEventDispatcher.dispatchValidated.mockImplementation(async (eventName) => {
                if (eventName === 'core:action_executed') throw vedError;
                return true; // Allow other potential dispatches
            });

            const result = await commandProcessor.processCommand(mockActor, commandInput);

            // ** FIX: Expect success: false because dispatch failed **
            expect(result.success).toBe(false);
            expect(result.turnEnded).toBe(true);
            expect(result.error).toBe('Internal error: Failed to finalize action success.');
            // ** FIX: Update expected internalError message slightly **
            expect(result.internalError).toBe(`Error dispatching core:action_executed: VED failed (see logs).`);
            expect(result.actionResult).toBe(actionResult);

            // ** FIX: Expect the correct log message from #dispatchWithErrorHandling **
            expect(mocks.logger.error).toHaveBeenCalledWith(
                `Failed to dispatch core:action_executed event: ${vedError.message}`, // Correct expected log
                vedError,
            );
            expect(mocks.logger.info).toHaveBeenCalledWith(expect.stringContaining(`CommandResult: { success: true, turnEnded: true }`));
            expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('core:system_error_occurred', expect.anything());
        });

        it('should handle VED error during core:command_parse_failed dispatch', async () => {
            const commandInput = 'bad command';
            const parsingError = 'Syntax error';
            const parsedCommandWithError = {error: parsingError, originalInput: commandInput}; // Add originalInput
            mocks.commandParser.parse.mockReturnValue(parsedCommandWithError);
            // ** FIX: Mock VED to throw *only* for core:command_parse_failed **
            mocks.validatedEventDispatcher.dispatchValidated.mockImplementation(async (eventName) => {
                if (eventName === 'core:command_parse_failed') throw vedError;
                return true;
            });

            const result = await commandProcessor.processCommand(mockActor, commandInput);

            expect(result.success).toBe(false);
            expect(result.turnEnded).toBe(false);
            expect(result.error).toBe(parsingError);
            expect(result.internalError).toBe(`Parsing Error: ${parsingError}`); // Use exact internal error

            // ** FIX: Expect the correct log message from #dispatchWithErrorHandling **
            expect(mocks.logger.error).toHaveBeenCalledWith(
                `Failed to dispatch core:command_parse_failed event: ${vedError.message}`, // Correct expected log
                vedError,
            );
            expect(mocks.logger.warn).toHaveBeenCalledWith(expect.stringContaining(`Parsing failed for command "${commandInput}"`));
            expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('core:system_error_occurred', expect.anything());
        });

        it('should handle VED error during core:action_failed (Logical Failure) dispatch', async () => {
            const commandInput = 'fail logically but fail dispatch';
            const parsedCommand = {actionId: 'core:fail_logical', originalInput: commandInput, error: null}; // Add originalInput
            const failureMessage = 'Target immune';
            const actionResult = {success: false, messages: [{text: failureMessage}], endsTurn: true};
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            mocks.actionExecutor.executeAction.mockResolvedValue(actionResult);
            // ** FIX: Mock VED to throw *only* for core:action_failed **
            mocks.validatedEventDispatcher.dispatchValidated.mockImplementation(async (eventName) => {
                if (eventName === 'core:action_failed') throw vedError;
                return true;
            });

            const result = await commandProcessor.processCommand(mockActor, commandInput);

            expect(result.success).toBe(false);
            expect(result.turnEnded).toBe(true);
            expect(result.error).toBeNull();
            // ** FIX: Update internal error to note the VED failure **
            expect(result.internalError).toBe(`Action ${parsedCommand.actionId} failed. See actionResult for details. Additionally, VED dispatch failed.`);
            expect(result.actionResult).toBe(actionResult);

            // ** FIX: Expect the correct log message from #dispatchWithErrorHandling **
            expect(mocks.logger.error).toHaveBeenCalledWith(
                `Failed to dispatch core:action_failed event: ${vedError.message}`, // Correct expected log
                vedError
            );
            expect(mocks.logger.info).toHaveBeenCalledWith(expect.stringContaining(`(Logical failure)`));
            expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('core:system_error_occurred', expect.anything());
        });

        it('should handle VED error during core:action_failed (Execution Exception) dispatch', async () => {
            const commandInput = 'fail execute but fail dispatch';
            const parsedCommand = {actionId: 'core:fail_execute', originalInput: commandInput, error: null}; // Add originalInput
            const executionError = new Error('Executor crashed');
            executionError.stack = 'Executor stack trace'; // Give it a stack
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            mocks.actionExecutor.executeAction.mockRejectedValue(executionError);
            // ** FIX: Mock VED to throw *only* for core:action_failed **
            mocks.validatedEventDispatcher.dispatchValidated.mockImplementation(async (eventName) => {
                if (eventName === 'core:action_failed') throw vedError;
                return true;
            });

            const result = await commandProcessor.processCommand(mockActor, commandInput);

            const userFacingError = 'An internal error occurred while performing the action.';
            const expectedInternalError = `Exception during action execution (${parsedCommand.actionId}): ${executionError.message}. Stack: ${executionError.stack}`;

            expect(result.success).toBe(false);
            expect(result.turnEnded).toBe(false);
            expect(result.error).toBe(userFacingError);
            expect(result.internalError).toBe(expectedInternalError); // Internal error remains the execution error
            expect(result.actionResult).toBeUndefined();

            // ** FIX: Expect the correct log messages IN ORDER **
            // 1. The original execution error log
            expect(mocks.logger.error).toHaveBeenNthCalledWith(1,
                expect.stringContaining(`Exception occurred during execution of action ${parsedCommand.actionId}`),
                executionError
            );
            // 2. The VED dispatch failure log
            expect(mocks.logger.error).toHaveBeenNthCalledWith(2,
                `Failed to dispatch core:action_failed event: ${vedError.message}`, // Correct expected log
                vedError
            );

            expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('core:system_error_occurred', expect.anything());
        });

        it('should handle VED error during core:system_error_occurred dispatch', async () => {
            const commandInput = 'trigger system error';
            const parsedCommand = {actionId: 'core:system_error_test', originalInput: commandInput, error: null}; // Add originalInput
            const locationError = new Error('Location DB unavailable');
            locationError.stack = 'DB Stack trace'; // Give it a stack
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            mocks.worldContext.getLocationOfEntity.mockImplementation(() => {
                throw locationError;
            });
            // ** FIX: Mock VED to throw *only* for core:system_error_occurred **
            mocks.validatedEventDispatcher.dispatchValidated.mockImplementation(async (eventName) => {
                if (eventName === 'core:system_error_occurred') throw vedError;
                return true;
            });

            const result = await commandProcessor.processCommand(mockActor, commandInput);

            const userFacingError = 'Internal error: Could not determine your current location.';
            const expectedInternalError = `Failed to get current location for actor ${mockActor.id} using getLocationOfEntity: ${locationError.message}`;

            expect(result.success).toBe(false);
            expect(result.turnEnded).toBe(false);
            expect(result.error).toBe(userFacingError);
            expect(result.internalError).toBe(expectedInternalError); // Keep original internal error

            // ** FIX: Expect the correct log messages IN ORDER **
            // 1. The original location fetch error
            expect(mocks.logger.error).toHaveBeenNthCalledWith(1,
                expect.stringContaining(`Error fetching current location for actor ${mockActor.id}`),
                locationError
            );
            // 2. The "System Error Context:" log
            expect(mocks.logger.error).toHaveBeenNthCalledWith(2,
                `System Error Context: ${expectedInternalError}`,
                locationError
            );
            // 3. The log from the failed VED dispatch inside #dispatchSystemError
            expect(mocks.logger.error).toHaveBeenNthCalledWith(3,
                `Failed to dispatch core:system_error_occurred event: ${vedError.message}`,
                vedError
            );
            // 4. The specific CRITICAL log from #dispatchSystemError about failing to dispatch the system error
            expect(mocks.logger.error).toHaveBeenNthCalledWith(4,
                `CommandProcessor: CRITICAL - Failed to dispatch system error event via VED. Original Error: ${locationError.message}. Dispatch Error: VED dispatch failed (see previous log)`, // Adjusted expected message
                // No second arg here as the specific log doesn't pass the original error again
            );


        });
    });
});
// --- FILE END ---