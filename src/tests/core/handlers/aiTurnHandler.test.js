// src/tests/core/handlers/aiTurnHandler.test.js

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
        processCommand: jest.fn().mockResolvedValue({success: true, message: 'Wait successful'}),
    },
    // Optional actionDiscoverySystem, not strictly needed for these tests
    actionDiscoverySystem: {
        // Mock methods if needed in future tests
    },
});

// Helper function to create a mock actor
const createMockActor = (id = 'ai-actor-1') => new Entity(id);

describe('AITurnHandler', () => {
    let mockDeps;
    let mockActor;
    let handler;

    beforeEach(() => {
        mockDeps = createMockDeps();
        mockActor = createMockActor();
        // A valid handler instance for most tests
        handler = new AITurnHandler(mockDeps);
    });

    // --- Test Suite: Constructor ---
    describe('Constructor', () => {
        it('should throw an error if logger is missing', () => {
            const depsWithoutLogger = createMockDeps();
            delete depsWithoutLogger.logger;
            expect(() => new AITurnHandler(depsWithoutLogger)).toThrow('AITurnHandler requires a valid logger instance.');
        });

        it('should throw an error if logger is invalid (missing methods)', () => {
            const depsWithInvalidLogger = createMockDeps();
            depsWithInvalidLogger.logger = {debug: jest.fn()}; // Missing info, error etc.
            expect(() => new AITurnHandler(depsWithInvalidLogger)).toThrow('AITurnHandler requires a valid logger instance.');
        });

        it('should throw an error if commandProcessor is missing', () => {
            const depsWithoutCommandProcessor = createMockDeps();
            delete depsWithoutCommandProcessor.commandProcessor;
            expect(() => new AITurnHandler(depsWithoutCommandProcessor)).toThrow('AITurnHandler requires a valid commandProcessor instance.');
        });

        it('should throw an error if commandProcessor is invalid (missing method)', () => {
            const depsWithInvalidCommandProcessor = createMockDeps();
            depsWithInvalidCommandProcessor.commandProcessor = {someOtherMethod: jest.fn()}; // Missing processCommand
            expect(() => new AITurnHandler(depsWithInvalidCommandProcessor)).toThrow('AITurnHandler requires a valid commandProcessor instance.');
        });

        it('should store valid dependencies and log initialization', () => {
            // Create with valid deps (already done in beforeEach)
            expect(mockDeps.logger.info).toHaveBeenCalledWith('AITurnHandler initialized.');
            // Verification that deps are stored happens implicitly via handleTurn tests
        });

        it('should accept an optional actionDiscoverySystem without error', () => {
            const depsWithDiscovery = createMockDeps();
            // No need to explicitly add it if createMockDeps includes it, but ensure it doesn't throw
            expect(() => new AITurnHandler(depsWithDiscovery)).not.toThrow();
            expect(mockDeps.logger.info).toHaveBeenCalledWith('AITurnHandler initialized.');
        });
    });

    // --- Test Suite: handleTurn Method ---
    describe('handleTurn Method', () => {
        it('should log the start of the turn', async () => {
            await handler.handleTurn(mockActor);
            expect(mockDeps.logger.info).toHaveBeenCalledWith(`Starting AI turn for actor: ${mockActor.id}`);
        });

        it('should log the chosen "wait" command', async () => {
            await handler.handleTurn(mockActor);
            // Check if debug or info is used - based on the code, it's debug
            expect(mockDeps.logger.debug).toHaveBeenCalledWith(`AI actor ${mockActor.id} chose command: wait`);
        });

        it('should call commandProcessor.processCommand exactly once', async () => {
            await handler.handleTurn(mockActor);
            expect(mockDeps.commandProcessor.processCommand).toHaveBeenCalledTimes(1);
        });

        it('should call commandProcessor.processCommand with the correct actor and "wait" command', async () => {
            await handler.handleTurn(mockActor);
            expect(mockDeps.commandProcessor.processCommand).toHaveBeenCalledWith(mockActor, 'wait');
        });

        it('should log the result from commandProcessor upon successful processing', async () => {
            const mockResult = {success: true, message: 'Processed'};
            mockDeps.commandProcessor.processCommand.mockResolvedValue(mockResult);

            await handler.handleTurn(mockActor);

            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                `AI command 'wait' processed for actor ${mockActor.id}. Result:`,
                mockResult
            );
        });

        // --- Test Suite: handleTurn Error Handling ---
        describe('handleTurn Error Handling', () => {
            it('should log an error if commandProcessor.processCommand rejects', async () => {
                const testError = new Error('Command processing failed');
                mockDeps.commandProcessor.processCommand.mockRejectedValue(testError);

                // Expect handleTurn not to throw the error itself, but to catch and log it
                await expect(handler.handleTurn(mockActor)).resolves.toBeUndefined();

                expect(mockDeps.logger.error).toHaveBeenCalledWith(
                    `Error processing AI command 'wait' for actor ${mockActor.id}:`,
                    testError
                );
            });

            it('should still complete the turn even if commandProcessor rejects', async () => {
                const testError = new Error('Boom');
                mockDeps.commandProcessor.processCommand.mockRejectedValue(testError);

                // The method should catch the error and finish without re-throwing
                await expect(handler.handleTurn(mockActor)).resolves.toBeUndefined();

                // Ensure logs beyond the error might still occur (if any were added after the catch)
                // In the current implementation, there aren't any, but this confirms completion.
                // We also check that the initial logs happened.
                expect(mockDeps.logger.info).toHaveBeenCalledWith(`Starting AI turn for actor: ${mockActor.id}`);
                expect(mockDeps.logger.debug).toHaveBeenCalledWith(`AI actor ${mockActor.id} chose command: wait`);
                expect(mockDeps.logger.debug).toHaveBeenCalledWith(`Attempting to process command 'wait' for actor ${mockActor.id}`);
                expect(mockDeps.logger.error).toHaveBeenCalled(); // Checked in the previous test, but good for clarity
            });
        });
    });
});