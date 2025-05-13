// tests/core/turns/strategies/humanPlayerStrategy.test.js
// --- FILE START ---

import {HumanPlayerStrategy} from '../../../../core/turns/strategies/humanPlayerStrategy.js'; // Adjust path as needed
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';

// Mock Entity
class MockEntity {
    constructor(id, name = 'TestActor') {
        this.id = id;
        this.name = name;
    }
}

// Mock Logger (without createChildLogger)
const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    // Explicitly DO NOT include createChildLogger
});

// Mock PlayerPromptService
const createMockPlayerPromptService = () => ({
    prompt: jest.fn(),
});

// Mock TurnContext
const createMockTurnContext = (actor, logger, playerPromptService) => ({
    getActor: jest.fn(() => actor),
    getLogger: jest.fn(() => logger),
    getPlayerPromptService: jest.fn(() => playerPromptService),
    // Add other ITurnContext methods if HumanPlayerStrategy starts using them
});

describe('HumanPlayerStrategy', () => {
    let humanPlayerStrategy;
    let mockActor;
    let mockLogger;
    let mockPlayerPromptService;
    let mockTurnContext;

    beforeEach(() => {
        humanPlayerStrategy = new HumanPlayerStrategy();
        mockActor = new MockEntity('player1', 'Hero');
        mockLogger = createMockLogger();
        mockPlayerPromptService = createMockPlayerPromptService();
        mockTurnContext = createMockTurnContext(mockActor, mockLogger, mockPlayerPromptService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('decideAction', () => {
        it('should successfully get a command and return ITurnAction without calling createChildLogger', async () => {
            mockPlayerPromptService.prompt.mockResolvedValueOnce('attack');

            const turnAction = await humanPlayerStrategy.decideAction(mockTurnContext);

            expect(mockLogger.debug).toHaveBeenCalledWith(`HumanPlayerStrategy: Initiating decideAction for actor ${mockActor.id}.`);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor, `${mockActor.name}, your command?`);
            expect(mockLogger.info).toHaveBeenCalledWith(`HumanPlayerStrategy: Received command "attack" from actor ${mockActor.id}.`);
            expect(turnAction).toEqual({
                commandString: 'attack',
                actionDefinitionId: 'player:commandInput',
                resolvedParameters: {rawCommand: 'attack'},
            });
            // Verify no attempt to call createChildLogger (it doesn't exist on mockLogger)
            // The test passes if no error is thrown regarding createChildLogger.
        });

        it('should re-prompt if the first command is empty', async () => {
            mockPlayerPromptService.prompt
                .mockResolvedValueOnce('') // First attempt: empty
                .mockResolvedValueOnce('move north'); // Second attempt: valid

            const turnAction = await humanPlayerStrategy.decideAction(mockTurnContext);

            expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(2);
            expect(mockPlayerPromptService.prompt).toHaveBeenNthCalledWith(1, mockActor, `${mockActor.name}, your command?`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`HumanPlayerStrategy: Empty command received from actor ${mockActor.id}. Re-prompting.`);
            expect(mockPlayerPromptService.prompt).toHaveBeenNthCalledWith(2, mockActor, `${mockActor.name}, please enter a command. (Previous was empty)`);
            expect(mockLogger.info).toHaveBeenCalledWith(`HumanPlayerStrategy: Received command "move north" from actor ${mockActor.id}.`);
            expect(turnAction.commandString).toBe('move north');
        });

        it('should trim whitespace from the command', async () => {
            mockPlayerPromptService.prompt.mockResolvedValueOnce('  use item  ');
            const turnAction = await humanPlayerStrategy.decideAction(mockTurnContext);
            expect(turnAction.commandString).toBe('use item');
            expect(mockLogger.info).toHaveBeenCalledWith(`HumanPlayerStrategy: Received command "use item" from actor ${mockActor.id}.`);
        });

        it('should throw an error if PlayerPromptService.prompt fails', async () => {
            const promptError = new Error('Prompt service unavailable');
            mockPlayerPromptService.prompt.mockRejectedValueOnce(promptError);

            await expect(humanPlayerStrategy.decideAction(mockTurnContext)).rejects.toThrow(`Failed to get player input for actor ${mockActor.id}. Details: ${promptError.message}`);
            expect(mockLogger.error).toHaveBeenCalledWith(`HumanPlayerStrategy: Error during playerPromptService.prompt() for actor ${mockActor.id}: ${promptError.message}`, promptError);
        });

        describe('_getLoggerFromContext internal behavior (robustness checks)', () => {
            it('should throw if context is null', () => {
                expect(() => humanPlayerStrategy._getLoggerFromContext(null))
                    .toThrow('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
            });

            it('should throw if context.getLogger is not a function', () => {
                const invalidContext = {getLogger: 'not-a-function'};
                expect(() => humanPlayerStrategy._getLoggerFromContext(invalidContext))
                    .toThrow('HumanPlayerStrategy Critical: context.getLogger is not a function.');
            });

            it('should throw if context.getLogger() throws', () => {
                const getLoggerError = new Error("getLogger internal error");
                const faultyContext = {
                    getLogger: jest.fn(() => {
                        throw getLoggerError;
                    })
                };
                expect(() => humanPlayerStrategy._getLoggerFromContext(faultyContext))
                    .toThrow(`HumanPlayerStrategy Critical: context.getLogger() failed. Details: ${getLoggerError.message}`);
            });

            it('should throw if logger from context is invalid (missing methods)', () => {
                const incompleteLogger = {debug: jest.fn()}; // Missing info, error
                const contextWithBadLogger = {getLogger: jest.fn(() => incompleteLogger)};
                expect(() => humanPlayerStrategy._getLoggerFromContext(contextWithBadLogger))
                    .toThrow('HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete.');
            });
        });

        describe('_getActorFromContext internal behavior', () => {
            it('should throw if context.getActor is not a function', () => {
                const invalidContext = createMockTurnContext(null, mockLogger, mockPlayerPromptService);
                invalidContext.getActor = 'not-a-function'; // Break the mock
                expect(() => humanPlayerStrategy._getActorFromContext(invalidContext, mockLogger))
                    .toThrow('HumanPlayerStrategy Critical: context.getActor is not a function.');
            });

            it('should throw if context.getActor() returns null', () => {
                const contextWithNullActor = createMockTurnContext(null, mockLogger, mockPlayerPromptService);
                expect(() => humanPlayerStrategy._getActorFromContext(contextWithNullActor, mockLogger))
                    .toThrow('HumanPlayerStrategy Critical: Actor not available from ITurnContext.');
                expect(mockLogger.error).toHaveBeenCalledWith('HumanPlayerStrategy: Actor not found in ITurnContext (context.getActor() returned null/undefined or invalid actor).');
            });
        });

        describe('_getPlayerPromptServiceFromContext internal behavior', () => {
            it('should throw if context.getPlayerPromptService is not a function', () => {
                const invalidContext = createMockTurnContext(mockActor, mockLogger, null);
                invalidContext.getPlayerPromptService = 'not-a-function'; // Break the mock
                expect(() => humanPlayerStrategy._getPlayerPromptServiceFromContext(invalidContext, mockLogger))
                    .toThrow('HumanPlayerStrategy Critical: context.getPlayerPromptService is not a function.');
            });

            it('should throw if context.getPlayerPromptService() returns null', () => {
                const contextWithNullService = createMockTurnContext(mockActor, mockLogger, null);
                contextWithNullService.getPlayerPromptService.mockReturnValue(null); // Ensure it returns null
                expect(() => humanPlayerStrategy._getPlayerPromptServiceFromContext(contextWithNullService, mockLogger))
                    .toThrow('HumanPlayerStrategy Critical: PlayerPromptService not available or invalid from ITurnContext.');
                expect(mockLogger.error).toHaveBeenCalledWith('HumanPlayerStrategy: PlayerPromptService not found in ITurnContext or is invalid (e.g., missing prompt method).');
            });
        });
    });
});

// --- FILE END ---