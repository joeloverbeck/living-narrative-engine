// tests/core/turns/strategies/humanPlayerStrategy.noChildLogger.test.js
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
});

// Mock for AvailableAction structure
const mockAvailableActionData = {
    id: 'default:action',
    command: 'Default Command',
};

describe('HumanPlayerStrategy', () => {
    let humanPlayerStrategy;
    let mockActor;
    let mockLogger;
    let mockPlayerPromptService;
    let mockTurnContext;
    let consoleErrorSpy;


    beforeEach(() => {
        humanPlayerStrategy = new HumanPlayerStrategy();
        mockActor = new MockEntity('player1', 'Hero');
        mockLogger = createMockLogger();
        mockPlayerPromptService = createMockPlayerPromptService();
        mockTurnContext = createMockTurnContext(mockActor, mockLogger, mockPlayerPromptService);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy.mockRestore();
    });

    describe('decideAction', () => {
        it('should successfully get player data and return ITurnAction', async () => {
            const playerData = {
                action: {id: 'test:attack', command: 'Attack Foe'},
                speech: 'with haste',
            };
            mockPlayerPromptService.prompt.mockResolvedValueOnce(playerData);

            const turnAction = await humanPlayerStrategy.decideAction(mockTurnContext);

            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor); // Called with actor only
            expect(mockLogger.info).toHaveBeenCalledWith(`HumanPlayerStrategy: Constructed ITurnAction for actor ${mockActor.id} with actionDefinitionId "${playerData.action.id}".`);
            expect(turnAction).toEqual({
                actionDefinitionId: playerData.action.id,
                commandString: playerData.action.command,
                resolvedParameters: {speech: playerData.speech},
            });
        });

        // This test is obsolete as re-prompting is PlayerPromptService's responsibility
        // it('should re-prompt if the first command is empty', async () => { ... });
        // This test is also obsolete as trimming is not directly done on raw string by this strategy anymore
        // it('should trim whitespace from the command', async () => { ... });


        it('should throw an error if PlayerPromptService.prompt fails, and log appropriately', async () => {
            const promptErrorMessage = 'Prompt service unavailable';
            const promptError = new Error(promptErrorMessage);
            mockPlayerPromptService.prompt.mockRejectedValueOnce(promptError);

            await expect(humanPlayerStrategy.decideAction(mockTurnContext)).rejects.toThrow(promptError); // Expect original error

            // Log from the inner catch block (around prompt call)
            expect(mockLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy: Error during playerPromptService.prompt() for actor ${mockActor.id}.`,
                promptError
            );
            // Log from the outer catch block in decideAction
            expect(mockLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy.decideAction: Operation failed for actor ${mockActor.id}. Error: ${promptErrorMessage}`,
                promptError
            );
        });

        describe('_getLoggerFromContext internal behavior (robustness checks)', () => {
            it('should throw if context is null', () => {
                expect(() => humanPlayerStrategy._getLoggerFromContext(null))
                    .toThrow('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
                expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
            });

            it('should throw if context.getLogger is not a function', () => {
                const invalidContext = {getLogger: 'not-a-function'};
                expect(() => humanPlayerStrategy._getLoggerFromContext(invalidContext))
                    .toThrow('HumanPlayerStrategy Critical: context.getLogger is not a function.');
                expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: context.getLogger is not a function.');
            });

            it('should throw if context.getLogger() throws', () => {
                const getLoggerError = new Error("getLogger internal error");
                const faultyContext = {
                    getLogger: jest.fn(() => {
                        throw getLoggerError;
                    })
                };
                // Corrected expected error message
                const expectedMsg = `HumanPlayerStrategy Critical: context.getLogger() call failed. Details: ${getLoggerError.message}`;
                expect(() => humanPlayerStrategy._getLoggerFromContext(faultyContext))
                    .toThrow(expectedMsg);
                expect(consoleErrorSpy).toHaveBeenCalledWith(expectedMsg, getLoggerError);
            });

            it('should throw if logger from context is invalid (missing methods)', () => {
                const incompleteLogger = {debug: jest.fn()}; // Missing info, error, warn
                const contextWithBadLogger = {getLogger: jest.fn(() => incompleteLogger)};
                // Corrected expected error message
                const expectedMsg = 'HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete (missing required methods like info, error, debug, warn).';
                expect(() => humanPlayerStrategy._getLoggerFromContext(contextWithBadLogger))
                    .toThrow(expectedMsg);
                expect(consoleErrorSpy).toHaveBeenCalledWith(expectedMsg);
            });
        });

        describe('_getActorFromContext internal behavior', () => {
            it('should throw if context.getActor is not a function', () => {
                const invalidContext = createMockTurnContext(null, mockLogger, mockPlayerPromptService);
                invalidContext.getActor = 'not-a-function'; // Break the mock
                expect(() => humanPlayerStrategy._getActorFromContext(invalidContext, mockLogger))
                    .toThrow('HumanPlayerStrategy Critical: context.getActor is not a function.');
                expect(mockLogger.error).toHaveBeenCalledWith('HumanPlayerStrategy Critical: context.getActor is not a function.');
            });

            it('should throw if context.getActor() returns null', () => {
                const contextWithNullActor = createMockTurnContext(null, mockLogger, mockPlayerPromptService);
                // Corrected expected error message
                const expectedMsg = 'HumanPlayerStrategy Critical: Actor not available from ITurnContext or actor has an invalid ID.';
                expect(() => humanPlayerStrategy._getActorFromContext(contextWithNullActor, mockLogger))
                    .toThrow(expectedMsg);
                // Corrected log assertion
                expect(mockLogger.error).toHaveBeenCalledWith(expectedMsg, {actorInstance: null});
            });
        });

        describe('_getPlayerPromptServiceFromContext internal behavior', () => {
            it('should throw if context.getPlayerPromptService is not a function', () => {
                const invalidContext = createMockTurnContext(mockActor, mockLogger, null);
                invalidContext.getPlayerPromptService = 'not-a-function'; // Break the mock
                expect(() => humanPlayerStrategy._getPlayerPromptServiceFromContext(invalidContext, mockLogger))
                    .toThrow('HumanPlayerStrategy Critical: context.getPlayerPromptService is not a function.');
                expect(mockLogger.error).toHaveBeenCalledWith('HumanPlayerStrategy Critical: context.getPlayerPromptService is not a function.');
            });

            it('should throw if context.getPlayerPromptService() returns null', () => {
                const contextWithNullService = createMockTurnContext(mockActor, mockLogger, null);
                // Make sure the mock inside createMockTurnContext is indeed returning null as intended for this test
                contextWithNullService.getPlayerPromptService.mockReturnValue(null);

                // Corrected expected error message
                const expectedMsg = 'HumanPlayerStrategy Critical: PlayerPromptService not available from ITurnContext or is invalid (e.g., missing prompt method).';
                expect(() => humanPlayerStrategy._getPlayerPromptServiceFromContext(contextWithNullService, mockLogger))
                    .toThrow(expectedMsg);
                // Corrected log assertion
                expect(mockLogger.error).toHaveBeenCalledWith(expectedMsg, {serviceInstance: null});
            });
        });
    });
});

// --- FILE END ---