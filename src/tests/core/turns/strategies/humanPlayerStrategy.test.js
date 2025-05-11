// test/core/turns/strategies/humanPlayerStrategy.test.js
// --- FILE START ---

import {HumanPlayerStrategy} from '../../../../core/turns/strategies/humanPlayerStrategy.js';
import {beforeEach, afterEach, describe, expect, it, jest} from "@jest/globals";

// Mock for ITurnContext
const mockTurnContext = {
    getActor: jest.fn(),
    getLogger: jest.fn(),
    getPlayerPromptService: jest.fn(),
    getGame: jest.fn(),
    getCommandProcessor: jest.fn(),
    getCommandOutcomeInterpreter: jest.fn(),
    getSafeEventDispatcher: jest.fn(),
    getSubscriptionManager: jest.fn(),
    getTurnEndPort: jest.fn(),
    endTurn: jest.fn(),
    isAwaitingExternalEvent: jest.fn(),
    requestTransition: jest.fn(),
    setAwaitingExternalEvent: jest.fn(),
};

// Mock for IPlayerPromptService
const mockPlayerPromptService = {
    prompt: jest.fn(),
};

// Mock for ILogger
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    createChildLogger: jest.fn(() => mockLogger),
};

// Mock for Entity
const mockActor = {
    id: 'player1',
    name: 'TestPlayer',
};

describe('HumanPlayerStrategy', () => {
    let strategy;
    let consoleErrorSpy;

    beforeEach(() => {
        strategy = new HumanPlayerStrategy();
        jest.clearAllMocks();

        // Spy on console.error and mock its implementation to suppress output during tests
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });

        // Setup default mock implementations
        mockTurnContext.getLogger.mockReturnValue(mockLogger);
        mockTurnContext.getActor.mockReturnValue(mockActor);
        mockTurnContext.getPlayerPromptService.mockReturnValue(mockPlayerPromptService);
    });

    afterEach(() => {
        // Restore console.error to its original implementation
        consoleErrorSpy.mockRestore();
    });

    describe('decideAction', () => {
        it('should prompt the player and return an ITurnAction with the command string', async () => {
            const testCommand = 'look around';
            mockPlayerPromptService.prompt.mockResolvedValueOnce(testCommand);

            const turnAction = await strategy.decideAction(mockTurnContext);

            expect(mockTurnContext.getLogger).toHaveBeenCalledTimes(1);
            expect(mockTurnContext.getActor).toHaveBeenCalledTimes(1);
            expect(mockTurnContext.getPlayerPromptService).toHaveBeenCalledTimes(1);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor, `${mockActor.name || 'Player'}, your command?`);
            expect(turnAction).toEqual({
                commandString: testCommand,
                actionDefinitionId: 'unknown:playerInput',
                resolvedParameters: {},
            });
            expect(mockLogger.info).toHaveBeenCalledWith(`HumanPlayerStrategy: Received command "${testCommand}" from actor ${mockActor.id}.`);
        });

        it('should re-prompt if the player provides an empty command string initially', async () => {
            const emptyCommand = '';
            const testCommand = 'move north';
            mockPlayerPromptService.prompt
                .mockResolvedValueOnce(emptyCommand)
                .mockResolvedValueOnce(testCommand);

            const turnAction = await strategy.decideAction(mockTurnContext);

            expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(2);
            expect(mockPlayerPromptService.prompt).toHaveBeenNthCalledWith(1, mockActor, `${mockActor.name || 'Player'}, your command?`);
            expect(mockPlayerPromptService.prompt).toHaveBeenNthCalledWith(2, mockActor, `${mockActor.name || 'Player'}, please enter a command. (Previous was empty)`);
            expect(turnAction.commandString).toBe(testCommand);
            expect(mockLogger.debug).toHaveBeenCalledWith(`HumanPlayerStrategy: Empty command received from actor ${mockActor.id}. Re-prompting.`);
        });

        it('should re-prompt if the player provides a command string with only whitespace initially', async () => {
            const whitespaceCommand = '   ';
            const testCommand = 'inventory';
            mockPlayerPromptService.prompt
                .mockResolvedValueOnce(whitespaceCommand)
                .mockResolvedValueOnce(testCommand);

            const turnAction = await strategy.decideAction(mockTurnContext);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(2);
            expect(turnAction.commandString).toBe(testCommand);
            expect(mockLogger.debug).toHaveBeenCalledWith(`HumanPlayerStrategy: Empty command received from actor ${mockActor.id}. Re-prompting.`);
        });

        it('should use "Player" if actor name is not available for the prompt', async () => {
            const actorWithoutName = {id: 'player2'};
            mockTurnContext.getActor.mockReturnValueOnce(actorWithoutName);
            mockPlayerPromptService.prompt.mockResolvedValueOnce('test');
            await strategy.decideAction(mockTurnContext);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(actorWithoutName, 'Player, your command?');
        });

        // --- Tests for _getLoggerFromContext ---
        it('should throw if context is null when getting logger', async () => {
            await expect(strategy.decideAction(null))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: ITurnContext itself is null or undefined.');
        });

        it('should throw if context.getLogger is not a function', async () => {
            const invalidContext = {getLogger: "not-a-function"};
            await expect(strategy.decideAction(invalidContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: context.getLogger is not a function.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: context.getLogger is not a function.');
        });

        it('should throw if context.getLogger itself throws', async () => {
            const specificErrorMessage = "Internal error in getLogger";
            const specificError = new Error(specificErrorMessage);
            mockTurnContext.getLogger.mockImplementationOnce(() => {
                throw specificError;
            });
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow(`HumanPlayerStrategy Critical: context.getLogger() failed. Details: ${specificErrorMessage}`);
            expect(consoleErrorSpy).toHaveBeenCalledWith(`HumanPlayerStrategy Critical: context.getLogger() threw an error during retrieval: ${specificErrorMessage}`);
        });

        it('should throw if logger retrieved from context is invalid (e.g., null)', async () => {
            mockTurnContext.getLogger.mockReturnValueOnce(null);
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: Logger retrieved from context is invalid or incomplete (missing info/error methods).');
        });

        it('should throw if logger retrieved from context is incomplete (e.g., missing info method)', async () => {
            mockTurnContext.getLogger.mockReturnValueOnce({error: jest.fn()}); // Missing 'info'
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: Logger retrieved from context is invalid or incomplete (missing info/error methods).');
        });

        // --- Tests for _getActorFromContext (assuming logger was obtained successfully) ---
        it('should throw if getActor returns null', async () => {
            mockTurnContext.getActor.mockReturnValueOnce(null); // Logger is fine from default setup
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: Actor not available from ITurnContext.');
            expect(mockLogger.error).toHaveBeenCalledWith('HumanPlayerStrategy: Actor not found in ITurnContext (null or undefined).');
        });

        it('should throw if context.getActor throws', async () => {
            const specificErrorMessage = "Internal error in getActor";
            mockTurnContext.getActor.mockImplementationOnce(() => {
                throw new Error(specificErrorMessage);
            });
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow(`HumanPlayerStrategy Critical: Failed to call context.getActor(). Details: ${specificErrorMessage}`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy: Error calling context.getActor(): ${specificErrorMessage}`,
                expect.any(Error)
            );
        });

        // --- Tests for _getPlayerPromptServiceFromContext (assuming logger & actor obtained) ---
        it('should throw if getPlayerPromptService returns null', async () => {
            mockTurnContext.getPlayerPromptService.mockReturnValueOnce(null);
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: PlayerPromptService not available or invalid from ITurnContext.');
            expect(mockLogger.error).toHaveBeenCalledWith('HumanPlayerStrategy: PlayerPromptService not available or invalid (e.g., missing prompt method) in ITurnContext.');
        });

        it('should throw if context.getPlayerPromptService throws', async () => {
            const specificErrorMessage = "Internal error in getPlayerPromptService";
            mockTurnContext.getPlayerPromptService.mockImplementationOnce(() => {
                throw new Error(specificErrorMessage);
            });
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow(`HumanPlayerStrategy Critical: Failed to call context.getPlayerPromptService(). Details: ${specificErrorMessage}`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy: Error calling context.getPlayerPromptService(): ${specificErrorMessage}`,
                expect.any(Error)
            );
        });

        it('should throw if playerPromptService.prompt itself throws an error', async () => {
            const promptErrorMessage = 'Prompt service connection failed';
            const promptError = new Error(promptErrorMessage);
            mockPlayerPromptService.prompt.mockRejectedValueOnce(promptError);

            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow(`Failed to get player input for actor ${mockActor.id}. Details: ${promptErrorMessage}`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy: Error receiving input via playerPromptService for actor ${mockActor.id}: ${promptErrorMessage}`,
                promptError
            );
        });
    });
});

// --- FILE END ---