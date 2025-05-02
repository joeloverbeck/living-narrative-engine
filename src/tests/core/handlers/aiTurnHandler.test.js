// src/tests/core/handlers/aiTurnHandler.test.js
// --- FILE START (Entire file content as requested) ---

/* eslint-env jest */

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import AITurnHandler from '../../../core/handlers/aiTurnHandler.js';
import Entity from '../../../entities/entity.js';

// Helper function to create mock dependencies
const createMockDeps = () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
    commandProcessor: {
        // Default mock returns a result suitable for the success log test
        processCommand: jest.fn().mockResolvedValue({
            success: true,
            message: 'Wait successful', // Standard message
            turnEnded: true,           // Assume 'wait' ends the turn
            error: null,               // No user error
            internalError: null,       // No internal error
            actionResult: { type: 'wait', status: 'completed' } // Add mock action result for event payload
        }),
    },
    // --- ADDED MOCK ---
    validatedEventDispatcher: {
        dispatchValidated: jest.fn().mockResolvedValue(undefined), // Mock the required method
    },
    // --- END ADDED MOCK ---
    // Optional actionDiscoverySystem, mock its method if needed by internal logic
    actionDiscoverySystem: {
        getValidActions: jest.fn().mockResolvedValue([]), // Mock method used by #determineAIAction
    },
});

// Helper function to create a mock actor
const createMockActor = (id = 'ai-actor-1') => new Entity(id);

describe('AITurnHandler', () => {
    let mockDeps;
    let mockActor;
    let handler;

    beforeEach(() => {
        // Clear mocks before each test to prevent interference
        jest.clearAllMocks();
        // Recreate fresh mocks and handler for isolation
        mockDeps = createMockDeps();
        mockActor = createMockActor();
        // This should now succeed because validatedEventDispatcher is mocked
        handler = new AITurnHandler(mockDeps);
    });

    // --- Test Suite: Constructor ---
    describe('Constructor', () => {
        // These tests should now fail with the *correct* error if mocks are wrong
        it('should throw an error if logger is missing', () => {
            const depsWithoutLogger = createMockDeps();
            delete depsWithoutLogger.logger;
            // Pass the incomplete deps directly, avoiding beforeEach handler creation
            expect(() => new AITurnHandler(depsWithoutLogger)).toThrow('AITurnHandler requires a valid logger instance.');
        });

        it('should throw an error if logger is invalid (missing methods)', () => {
            const depsWithInvalidLogger = createMockDeps();
            depsWithInvalidLogger.logger = {debug: jest.fn()}; // Missing info, error etc.
            // Pass the incomplete deps directly
            expect(() => new AITurnHandler(depsWithInvalidLogger)).toThrow('AITurnHandler requires a valid logger instance.');
        });

        it('should throw an error if commandProcessor is missing', () => {
            const depsWithoutCommandProcessor = createMockDeps();
            delete depsWithoutCommandProcessor.commandProcessor;
            // Need logger for the error path within the constructor
            const logger = createMockDeps().logger;
            expect(() => new AITurnHandler({...depsWithoutCommandProcessor, logger})).toThrow('AITurnHandler requires a valid commandProcessor instance.');
        });

        it('should throw an error if commandProcessor is invalid (missing method)', () => {
            const depsWithInvalidCommandProcessor = createMockDeps();
            depsWithInvalidCommandProcessor.commandProcessor = {someOtherMethod: jest.fn()}; // Missing processCommand
            // Need logger for the error path within the constructor
            const logger = createMockDeps().logger;
            expect(() => new AITurnHandler({...depsWithInvalidCommandProcessor, logger})).toThrow('AITurnHandler requires a valid commandProcessor instance.');
        });

        // --- Test for validatedEventDispatcher (Mirroring others) ---
        it('should throw an error if validatedEventDispatcher is missing', () => {
            const depsWithoutDispatcher = createMockDeps();
            delete depsWithoutDispatcher.validatedEventDispatcher;
            // Need logger for the error path within the constructor
            const logger = createMockDeps().logger;
            const commandProcessor = createMockDeps().commandProcessor;
            expect(() => new AITurnHandler({ ...depsWithoutDispatcher, logger, commandProcessor })).toThrow('AITurnHandler requires a valid validatedEventDispatcher instance.');
        });

        it('should throw an error if validatedEventDispatcher is invalid (missing method)', () => {
            const depsWithInvalidDispatcher = createMockDeps();
            depsWithInvalidDispatcher.validatedEventDispatcher = { someOtherMethod: jest.fn() }; // Missing dispatchValidated
            // Need logger for the error path within the constructor
            const logger = createMockDeps().logger;
            const commandProcessor = createMockDeps().commandProcessor;
            expect(() => new AITurnHandler({ ...depsWithInvalidDispatcher, logger, commandProcessor })).toThrow('AITurnHandler requires a valid validatedEventDispatcher instance.');
        });
        // --- End Test for validatedEventDispatcher ---


        it('should store valid dependencies and log initialization', () => {
            // The handler is already created in beforeEach with fresh mocks
            // We just need to check the mock logger that was passed to it
            expect(mockDeps.logger.info).toHaveBeenCalledWith('AITurnHandler initialized.');
            // Optionally check that the constructor didn't throw
            expect(() => handler).not.toThrow();
        });

        it('should accept an optional actionDiscoverySystem without error', () => {
            // Handler created in beforeEach includes it
            expect(() => handler).not.toThrow();
            expect(mockDeps.logger.info).toHaveBeenCalledWith('AITurnHandler initialized.');
        });

        it('should warn if optional actionDiscoverySystem is invalid', () => {
            const depsWithInvalidADS = createMockDeps();
            depsWithInvalidADS.actionDiscoverySystem = { someOtherMethod: jest.fn() }; // Missing getValidActions
            // Create a new handler instance specifically for this test
            const testHandler = new AITurnHandler(depsWithInvalidADS);
            expect(depsWithInvalidADS.logger.warn).toHaveBeenCalledWith('AITurnHandler Constructor: Provided actionDiscoverySystem is invalid or missing getValidActions method.');
            expect(testHandler).toBeDefined(); // Should still initialize
        });
    });

    // --- Test Suite: handleTurn Method ---
    describe('handleTurn Method', () => {
        it('should log the start of the turn processing', async () => {
            await handler.handleTurn(mockActor);
            // Check the log *during* the handleTurn call
            expect(mockDeps.logger.info).toHaveBeenCalledWith(`Starting AI turn processing for actor: ${mockActor.id}`);
        });

        it('should dispatch core:ai_turn_processing_started event', async () => {
            await handler.handleTurn(mockActor);
            expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:ai_turn_processing_started',
                { entityId: mockActor.id }
            );
        });

        it('should log the determined "wait" command (default behavior)', async () => {
            await handler.handleTurn(mockActor);
            // Default logic uses "wait"
            expect(mockDeps.logger.debug).toHaveBeenCalledWith(`AI actor ${mockActor.id} determined command: "wait"`);
        });

        it('should log the attempt to process the command', async () => {
            await handler.handleTurn(mockActor);
            expect(mockDeps.logger.debug).toHaveBeenCalledWith(`AITurnHandler: Processing command 'wait' for actor ${mockActor.id} via CommandProcessor.`);
        });


        it('should call commandProcessor.processCommand exactly once', async () => {
            await handler.handleTurn(mockActor);
            expect(mockDeps.commandProcessor.processCommand).toHaveBeenCalledTimes(1);
        });

        it('should call commandProcessor.processCommand with the correct actor and determined command', async () => {
            await handler.handleTurn(mockActor);
            expect(mockDeps.commandProcessor.processCommand).toHaveBeenCalledWith(mockActor, 'wait'); // Default command is wait
        });

        it('should log the result from commandProcessor upon successful processing', async () => {
            // --- CORRECTED EXPECTED LOG ---
            // Retrieve the resolved value from the mock setup
            const expectedResolvedValue = await mockDeps.commandProcessor.processCommand();

            // Execute the handler which calls the mock processCommand
            await handler.handleTurn(mockActor);

            // Construct the expected log string based on the ACTUAL log format in aiTurnHandler.js
            const expectedLogString =
                `AITurnHandler: CommandProcessor result for AI ${mockActor.id} command "wait": ` +
                `Success=${expectedResolvedValue.success}, TurnEnded=${expectedResolvedValue.turnEnded}.`; // Matches the code
            // --- END CORRECTION ---

            // Assert the log call (ensure it's called *after* the initial logs)
            // Check specific call rather than just any call
            expect(mockDeps.logger.info).toHaveBeenCalledWith(expectedLogString);
        });

        it('should log a warning if command succeeded but did not end turn', async () => {
            // Override the mock for this specific test
            mockDeps.commandProcessor.processCommand.mockResolvedValue({
                success: true,
                message: 'Did something, but turn continues',
                turnEnded: false, // Explicitly false
                error: null,
                internalError: null,
                actionResult: {}
            });
            await handler.handleTurn(mockActor);
            expect(mockDeps.logger.warn).toHaveBeenCalledWith(`AITurnHandler: AI command 'wait' processed but did not end turn according to CommandResult for actor ${mockActor.id}. Turn will end anyway.`);
        });


        it('should log completion message and dispatch end events in finally block', async () => {
            const resolvedValue = await mockDeps.commandProcessor.processCommand(); // Get the mocked result
            await handler.handleTurn(mockActor);

            // Check logs in finally
            expect(mockDeps.logger.info).toHaveBeenCalledWith(`AI turn processing complete for actor: ${mockActor.id}. Dispatching end events.`);
            expect(mockDeps.logger.info).toHaveBeenCalledWith(`AI turn fully concluded for actor: ${mockActor.id}.`);

            // Check event dispatches in finally
            expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:ai_turn_processing_ended',
                { entityId: mockActor.id, actionResult: resolvedValue.actionResult } // Check payload
            );
            expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:turn_ended',
                { entityId: mockActor.id }
            );
        });

        it('should handle invalid actor gracefully', async () => {
            await expect(handler.handleTurn(null)).rejects.toThrow('AITurnHandler: Actor must be a valid entity.');
            expect(mockDeps.logger.error).toHaveBeenCalledWith('AITurnHandler: Attempted to handle turn for an invalid actor.');
            // Ensure no command processing or event dispatch happened
            expect(mockDeps.commandProcessor.processCommand).not.toHaveBeenCalled();
            expect(mockDeps.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        });


        // --- Test Suite: handleTurn Error Handling ---
        describe('handleTurn Error Handling', () => {
            it('should log an error and re-throw if commandProcessor.processCommand rejects', async () => {
                const testError = new Error('Command processing failed');
                mockDeps.commandProcessor.processCommand.mockRejectedValue(testError);

                await expect(handler.handleTurn(mockActor)).rejects.toThrow(testError);

                // Check the critical error log format from the catch block
                expect(mockDeps.logger.error).toHaveBeenCalledWith(
                    `AITurnHandler: CRITICAL error during AI turn for actor ${mockActor.id}: ${testError.message}`,
                    testError
                );
                // Also check that finally block still runs
                expect(mockDeps.logger.info).toHaveBeenCalledWith(`AI turn processing complete for actor: ${mockActor.id}. Dispatching end events.`);
                expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:ai_turn_processing_ended', expect.anything());
                expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_ended', expect.anything());
            });

            it('should log dispatch errors for start event but continue turn', async () => {
                const dispatchError = new Error("Event bus down");
                mockDeps.validatedEventDispatcher.dispatchValidated
                    .mockImplementationOnce(async (eventName) => { // Mock only the first call (start event)
                        if (eventName === 'core:ai_turn_processing_started') {
                            throw dispatchError;
                        }
                        return undefined; // Allow subsequent calls to succeed
                    });

                await handler.handleTurn(mockActor); // Should not throw out

                expect(mockDeps.logger.error).toHaveBeenCalledWith(
                    `AITurnHandler: Failed to dispatch core:ai_turn_processing_started for ${mockActor.id}: ${dispatchError.message}`,
                    dispatchError
                );
                // Ensure turn processing still happened
                expect(mockDeps.commandProcessor.processCommand).toHaveBeenCalled();
                // Ensure end events were still attempted
                expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:ai_turn_processing_ended', expect.anything());
                expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_ended', expect.anything());
            });

            it('should log dispatch errors for end events but finish', async () => {
                const dispatchError = new Error("Event bus down again");
                const resolvedValue = await mockDeps.commandProcessor.processCommand(); // Get result for payload check
                mockDeps.validatedEventDispatcher.dispatchValidated
                    // Allow 'start' event to succeed
                    .mockResolvedValueOnce(undefined)
                    // Fail 'processing_ended' event
                    .mockImplementationOnce(async (eventName) => {
                        if (eventName === 'core:ai_turn_processing_ended') throw dispatchError;
                        return undefined;
                    })
                    // Fail 'turn_ended' event
                    .mockImplementationOnce(async (eventName) => {
                        if (eventName === 'core:turn_ended') throw dispatchError;
                        return undefined;
                    });


                await handler.handleTurn(mockActor); // Should not throw out

                expect(mockDeps.logger.error).toHaveBeenCalledWith(
                    `AITurnHandler: Failed to dispatch core:ai_turn_processing_ended for ${mockActor.id}: ${dispatchError.message}`,
                    dispatchError
                );
                expect(mockDeps.logger.error).toHaveBeenCalledWith(
                    `AITurnHandler: Failed to dispatch core:turn_ended for ${mockActor.id}: ${dispatchError.message}`,
                    dispatchError
                );
                // Ensure log indicates conclusion despite event errors
                expect(mockDeps.logger.info).toHaveBeenCalledWith(`AI turn fully concluded for actor: ${mockActor.id}.`);
            });


            // This test was checking logs slightly incorrectly based on previous assumptions
            it('should still complete logging up to the error point and run finally block when commandProcessor rejects', async () => {
                const testError = new Error('Boom');
                mockDeps.commandProcessor.processCommand.mockRejectedValue(testError);

                await expect(handler.handleTurn(mockActor)).rejects.toThrow(testError);

                // Ensure logs *before* the error still occurred
                expect(mockDeps.logger.info).toHaveBeenCalledWith(`Starting AI turn processing for actor: ${mockActor.id}`);
                expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:ai_turn_processing_started', expect.anything());
                expect(mockDeps.logger.debug).toHaveBeenCalledWith(`AI actor ${mockActor.id} determined command: "wait"`);
                // --- CORRECTED EXPECTED LOG ---
                expect(mockDeps.logger.debug).toHaveBeenCalledWith(`AITurnHandler: Processing command 'wait' for actor ${mockActor.id} via CommandProcessor.`);
                // --- END CORRECTION ---

                // Verify critical error log occurred (checked in the specific error test above)
                expect(mockDeps.logger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL error'), testError);

                // Verify the final "AI turn processing complete" and "fully concluded" logs in the finally block were called
                expect(mockDeps.logger.info).toHaveBeenCalledWith(`AI turn processing complete for actor: ${mockActor.id}. Dispatching end events.`);
                expect(mockDeps.logger.info).toHaveBeenCalledWith(`AI turn fully concluded for actor: ${mockActor.id}.`);
                // Verify finally block event dispatch attempts
                expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:ai_turn_processing_ended', expect.anything());
                expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_ended', expect.anything());
            });
        });
    });
});
// --- FILE END ---