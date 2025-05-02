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
        processCommand: jest.fn().mockResolvedValue({
            success: true,
            message: 'Wait successful',
            turnEnded: true,
            error: null,
            internalError: null,
            actionResult: {type: 'wait', status: 'completed'}
        }),
    },
    validatedEventDispatcher: {
        dispatchValidated: jest.fn().mockResolvedValue(undefined),
    },
    // --- MODIFICATION START (Task 6 - Add worldContext mock) ---
    worldContext: {
        getLocationOfEntity: jest.fn().mockResolvedValue({id: 'ai-loc-1'}), // Mock return value for location
        // Add other methods if needed by future AI logic
    },
    // --- MODIFICATION END (Task 6 - Add worldContext mock) ---
    actionDiscoverySystem: {
        getValidActions: jest.fn().mockResolvedValue([]),
    },
});

// Helper function to create a mock actor
const createMockActor = (id = 'ai-actor-1') => new Entity(id);

describe('AITurnHandler', () => {
    let mockDeps;
    let mockActor;
    let handler;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDeps = createMockDeps();
        mockActor = createMockActor();
        // Handler creation requires all dependencies, including the new worldContext
        handler = new AITurnHandler(mockDeps);
    });

    // --- Test Suite: Constructor ---
    describe('Constructor', () => {
        it('should throw an error if logger is missing', () => {
            const deps = createMockDeps();
            delete deps.logger;
            expect(() => new AITurnHandler(deps)).toThrow(/logger instance/);
        });

        it('should throw an error if logger is invalid (missing methods)', () => {
            const deps = createMockDeps();
            deps.logger = {debug: jest.fn()};
            expect(() => new AITurnHandler(deps)).toThrow(/logger instance/);
        });

        it('should throw an error if commandProcessor is missing', () => {
            const deps = createMockDeps();
            delete deps.commandProcessor;
            expect(() => new AITurnHandler(deps)).toThrow(/commandProcessor instance/);
        });

        it('should throw an error if commandProcessor is invalid (missing method)', () => {
            const deps = createMockDeps();
            deps.commandProcessor = {};
            expect(() => new AITurnHandler(deps)).toThrow(/commandProcessor instance/);
        });

        it('should throw an error if validatedEventDispatcher is missing', () => {
            const deps = createMockDeps();
            delete deps.validatedEventDispatcher;
            expect(() => new AITurnHandler(deps)).toThrow(/validatedEventDispatcher instance/);
        });

        it('should throw an error if validatedEventDispatcher is invalid (missing method)', () => {
            const deps = createMockDeps();
            deps.validatedEventDispatcher = {};
            expect(() => new AITurnHandler(deps)).toThrow(/validatedEventDispatcher instance/);
        });

        // --- MODIFICATION START (Task 6 - Test worldContext dependency) ---
        it('should throw an error if worldContext is missing', () => {
            const deps = createMockDeps();
            delete deps.worldContext;
            expect(() => new AITurnHandler(deps)).toThrow(/worldContext instance/);
        });

        it('should throw an error if worldContext is invalid (missing method)', () => {
            const deps = createMockDeps();
            deps.worldContext = {}; // Missing getLocationOfEntity
            expect(() => new AITurnHandler(deps)).toThrow(/worldContext instance/);
        });
        // --- MODIFICATION END (Task 6 - Test worldContext dependency) ---


        it('should store valid dependencies and log initialization', () => {
            expect(mockDeps.logger.info).toHaveBeenCalledWith('AITurnHandler initialized.');
            expect(() => handler).not.toThrow();
        });

        it('should accept an optional actionDiscoverySystem without error', () => {
            expect(() => handler).not.toThrow();
            expect(mockDeps.logger.info).toHaveBeenCalledWith('AITurnHandler initialized.');
        });

        it('should warn if optional actionDiscoverySystem is invalid', () => {
            const depsWithInvalidADS = createMockDeps();
            depsWithInvalidADS.actionDiscoverySystem = {someOtherMethod: jest.fn()};
            const testHandler = new AITurnHandler(depsWithInvalidADS);
            expect(depsWithInvalidADS.logger.warn).toHaveBeenCalledWith(expect.stringContaining('actionDiscoverySystem is invalid'));
            expect(testHandler).toBeDefined();
        });
    });

    // --- Test Suite: handleTurn Method ---
    describe('handleTurn Method', () => {
        it('should log the start of the turn processing', async () => {
            await handler.handleTurn(mockActor);
            expect(mockDeps.logger.info).toHaveBeenCalledWith(`Starting AI turn processing for actor: ${mockActor.id}`);
        });

        it('should dispatch core:ai_turn_processing_started event', async () => {
            await handler.handleTurn(mockActor);
            expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:ai_turn_processing_started',
                {entityId: mockActor.id}
            );
        });

        // --- MODIFICATION START (Task 6 - Test worldContext usage in AI action determination) ---
        it('should call worldContext.getLocationOfEntity during AI action determination', async () => {
            // Ensure actionDiscoverySystem is provided for this test path
            const depsWithADS = createMockDeps();
            const testHandler = new AITurnHandler(depsWithADS); // Use ADS
            await testHandler.handleTurn(mockActor);

            // Check if getLocationOfEntity was called with the actor's ID
            expect(depsWithADS.worldContext.getLocationOfEntity).toHaveBeenCalledWith(mockActor.id);
        });
        // --- MODIFICATION END (Task 6 - Test worldContext usage in AI action determination) ---

        it('should log the determined "wait" command (default fallback behavior)', async () => {
            // Use handler created in beforeEach which has ADS, but it returns [] actions by default
            await handler.handleTurn(mockActor);
            expect(mockDeps.logger.debug).toHaveBeenCalledWith(`AI ${mockActor.id} falling back to 'wait' action.`);
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
            const expectedResolvedValue = await mockDeps.commandProcessor.processCommand();
            await handler.handleTurn(mockActor);
            const expectedLogString =
                `AITurnHandler: CommandProcessor result for AI ${mockActor.id} command "wait": ` +
                `Success=${expectedResolvedValue.success}, TurnEnded=${expectedResolvedValue.turnEnded}.`;
            expect(mockDeps.logger.info).toHaveBeenCalledWith(expectedLogString);
        });

        it('should log a warning if command succeeded but did not end turn', async () => {
            mockDeps.commandProcessor.processCommand.mockResolvedValue({
                success: true, turnEnded: false, actionResult: {}
            });
            await handler.handleTurn(mockActor);
            expect(mockDeps.logger.warn).toHaveBeenCalledWith(expect.stringContaining('did not end turn according to CommandResult'));
        });


        it('should log completion message and dispatch end events in finally block', async () => {
            const resolvedValue = await mockDeps.commandProcessor.processCommand();
            await handler.handleTurn(mockActor);

            expect(mockDeps.logger.info).toHaveBeenCalledWith(`AI turn processing complete for actor: ${mockActor.id}. Dispatching end events.`);
            expect(mockDeps.logger.info).toHaveBeenCalledWith(`AI turn fully concluded for actor: ${mockActor.id}.`);

            expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:ai_turn_processing_ended',
                {entityId: mockActor.id, actionResult: resolvedValue.actionResult}
            );
            expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:turn_ended',
                {entityId: mockActor.id}
            );
        });

        it('should handle invalid actor gracefully', async () => {
            await expect(handler.handleTurn(null)).rejects.toThrow('AITurnHandler: Actor must be a valid entity.');
            expect(mockDeps.logger.error).toHaveBeenCalledWith('AITurnHandler: Attempted to handle turn for an invalid actor.');
            expect(mockDeps.commandProcessor.processCommand).not.toHaveBeenCalled();
            expect(mockDeps.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        });


        // --- Test Suite: handleTurn Error Handling ---
        describe('handleTurn Error Handling', () => {
            it('should log an error and re-throw if commandProcessor.processCommand rejects', async () => {
                const testError = new Error('Command processing failed');
                mockDeps.commandProcessor.processCommand.mockRejectedValue(testError);

                await expect(handler.handleTurn(mockActor)).rejects.toThrow(testError);

                expect(mockDeps.logger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`CRITICAL error during AI turn for actor ${mockActor.id}`),
                    testError
                );
                expect(mockDeps.logger.info).toHaveBeenCalledWith(`AI turn processing complete for actor: ${mockActor.id}. Dispatching end events.`);
                expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:ai_turn_processing_ended', expect.anything());
                expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_ended', expect.anything());
            });

            it('should log dispatch errors for start event but continue turn', async () => {
                const dispatchError = new Error("Event bus down");
                mockDeps.validatedEventDispatcher.dispatchValidated
                    .mockImplementationOnce(async (eventName) => {
                        if (eventName === 'core:ai_turn_processing_started') throw dispatchError;
                        return undefined;
                    });

                await handler.handleTurn(mockActor);

                expect(mockDeps.logger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Failed to dispatch core:ai_turn_processing_started for ${mockActor.id}`),
                    dispatchError
                );
                expect(mockDeps.commandProcessor.processCommand).toHaveBeenCalled();
                expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:ai_turn_processing_ended', expect.anything());
                expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_ended', expect.anything());
            });

            it('should log dispatch errors for end events but finish', async () => {
                const dispatchError = new Error("Event bus down again");
                mockDeps.validatedEventDispatcher.dispatchValidated
                    .mockResolvedValueOnce(undefined) // Start succeeds
                    .mockImplementationOnce(async (eventName) => { // processing_ended fails
                        if (eventName === 'core:ai_turn_processing_ended') throw dispatchError;
                        return undefined;
                    })
                    .mockImplementationOnce(async (eventName) => { // turn_ended fails
                        if (eventName === 'core:turn_ended') throw dispatchError;
                        return undefined;
                    });


                await handler.handleTurn(mockActor);

                expect(mockDeps.logger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Failed to dispatch core:ai_turn_processing_ended for ${mockActor.id}`),
                    dispatchError
                );
                expect(mockDeps.logger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Failed to dispatch core:turn_ended for ${mockActor.id}`),
                    dispatchError
                );
                expect(mockDeps.logger.info).toHaveBeenCalledWith(`AI turn fully concluded for actor: ${mockActor.id}.`);
            });


            it('should still complete logging up to the error point and run finally block when commandProcessor rejects', async () => {
                const testError = new Error('Boom');
                mockDeps.commandProcessor.processCommand.mockRejectedValue(testError);

                await expect(handler.handleTurn(mockActor)).rejects.toThrow(testError);

                expect(mockDeps.logger.info).toHaveBeenCalledWith(`Starting AI turn processing for actor: ${mockActor.id}`);
                expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:ai_turn_processing_started', expect.anything());
                // Check for the fallback log OR the discovery log depending on ADS mock setup
                expect(mockDeps.logger.debug).toHaveBeenCalledWith(expect.stringContaining(`AI ${mockActor.id}`)); // Action determination logs
                expect(mockDeps.logger.debug).toHaveBeenCalledWith(`AITurnHandler: Processing command 'wait' for actor ${mockActor.id} via CommandProcessor.`);


                expect(mockDeps.logger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL error'), testError);

                expect(mockDeps.logger.info).toHaveBeenCalledWith(`AI turn processing complete for actor: ${mockActor.id}. Dispatching end events.`);
                expect(mockDeps.logger.info).toHaveBeenCalledWith(`AI turn fully concluded for actor: ${mockActor.id}.`);
                expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:ai_turn_processing_ended', expect.anything());
                expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_ended', expect.anything());
            });
        });
    });
});
// --- FILE END ---
