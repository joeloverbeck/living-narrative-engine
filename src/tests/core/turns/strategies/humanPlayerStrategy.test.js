// src/tests/core/turns/strategies/humanPlayerStrategy.test.js
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

// Mock for ILogger (this will be the child logger)
const mockChildLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    // createChildLogger: jest.fn(() => mockChildLogger), // Child logger doesn't create more children in this mock
};

// Mock for the main logger returned by context.getLogger()
const mockMainLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    createChildLogger: jest.fn(() => mockChildLogger),
};

// Mock for Entity (Actor)
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

        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });

        // Default setup: getLogger returns the main logger, which then creates a child logger
        mockTurnContext.getLogger.mockReturnValue(mockMainLogger);
        mockMainLogger.createChildLogger.mockReturnValue(mockChildLogger); // Ensure child logger is returned

        mockTurnContext.getActor.mockReturnValue(mockActor);
        mockTurnContext.getPlayerPromptService.mockReturnValue(mockPlayerPromptService);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('decideAction', () => {
        it('should prompt the player and return an ITurnAction with trimmed command string, correct actionDefinitionId, and resolvedParameters', async () => {
            const rawCommand = '  look around  ';
            const trimmedCommand = 'look around';
            mockPlayerPromptService.prompt.mockResolvedValueOnce(rawCommand);

            const turnAction = await strategy.decideAction(mockTurnContext);

            expect(mockMainLogger.createChildLogger).toHaveBeenCalledWith('HumanPlayerStrategy');
            expect(mockTurnContext.getActor).toHaveBeenCalledTimes(1);
            expect(mockTurnContext.getPlayerPromptService).toHaveBeenCalledTimes(1);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor, `${mockActor.name || 'Player'}, your command?`);

            expect(turnAction).toEqual({
                commandString: trimmedCommand,
                actionDefinitionId: 'player:commandInput', // Corrected
                resolvedParameters: {rawCommand: trimmedCommand}, // Corrected
            });
            // Log messages will go to the child logger
            expect(mockChildLogger.info).toHaveBeenCalledWith(`HumanPlayerStrategy: Received command "${trimmedCommand}" from actor ${mockActor.id}.`);
        });

        it('should re-prompt if the player provides an empty command string initially, then return correct ITurnAction', async () => {
            const emptyCommand = '';
            const validCommand = 'move north';
            mockPlayerPromptService.prompt
                .mockResolvedValueOnce(emptyCommand)
                .mockResolvedValueOnce(validCommand);

            const turnAction = await strategy.decideAction(mockTurnContext);

            expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(2);
            expect(mockPlayerPromptService.prompt).toHaveBeenNthCalledWith(1, mockActor, `${mockActor.name || 'Player'}, your command?`);
            expect(mockPlayerPromptService.prompt).toHaveBeenNthCalledWith(2, mockActor, `${mockActor.name || 'Player'}, please enter a command. (Previous was empty)`);
            expect(turnAction).toEqual({
                commandString: validCommand,
                actionDefinitionId: 'player:commandInput', // Corrected
                resolvedParameters: {rawCommand: validCommand}, // Corrected
            });
            expect(mockChildLogger.debug).toHaveBeenCalledWith(`HumanPlayerStrategy: Empty command received from actor ${mockActor.id}. Re-prompting.`);
            expect(mockChildLogger.info).toHaveBeenCalledWith(`HumanPlayerStrategy: Received command "${validCommand}" from actor ${mockActor.id}.`);
        });

        it('should re-prompt if the player provides a whitespace-only command string initially, then return correct ITurnAction', async () => {
            const whitespaceCommand = '   ';
            const validCommand = 'inventory';
            mockPlayerPromptService.prompt
                .mockResolvedValueOnce(whitespaceCommand)
                .mockResolvedValueOnce(validCommand);

            const turnAction = await strategy.decideAction(mockTurnContext);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(2);
            expect(turnAction).toEqual({
                commandString: validCommand,
                actionDefinitionId: 'player:commandInput', // Corrected
                resolvedParameters: {rawCommand: validCommand}, // Corrected
            });
            expect(mockChildLogger.debug).toHaveBeenCalledWith(`HumanPlayerStrategy: Empty command received from actor ${mockActor.id}. Re-prompting.`);
            expect(mockChildLogger.info).toHaveBeenCalledWith(`HumanPlayerStrategy: Received command "${validCommand}" from actor ${mockActor.id}.`);
        });

        it('should use "Player" in prompt if actor name is null, undefined or empty and return correct ITurnAction', async () => {
            const actorWithoutName = {id: 'player2', name: null};
            mockTurnContext.getActor.mockReturnValueOnce(actorWithoutName);
            const command = 'test command';
            mockPlayerPromptService.prompt.mockResolvedValueOnce(command);

            let turnAction = await strategy.decideAction(mockTurnContext);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(actorWithoutName, 'Player, your command?');
            expect(turnAction).toEqual({
                commandString: command,
                actionDefinitionId: 'player:commandInput', // Corrected
                resolvedParameters: {rawCommand: command}, // Corrected
            });

            const actorWithUndefinedName = {id: 'player3'}; // name is undefined
            mockTurnContext.getActor.mockReturnValueOnce(actorWithUndefinedName);
            mockPlayerPromptService.prompt.mockResolvedValueOnce(command); // Reset for next call
            turnAction = await strategy.decideAction(mockTurnContext);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(actorWithUndefinedName, 'Player, your command?');
            expect(turnAction.commandString).toBe(command);


            const actorWithEmptyName = {id: 'player4', name: ''};
            mockTurnContext.getActor.mockReturnValueOnce(actorWithEmptyName);
            mockPlayerPromptService.prompt.mockResolvedValueOnce(command); // Reset for next call
            turnAction = await strategy.decideAction(mockTurnContext);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(actorWithEmptyName, 'Player, your command?');
            expect(turnAction.commandString).toBe(command);
        });

        // --- Tests for _getLoggerFromContext (and initial context validation) ---
        it('should throw and log to console.error if ITurnContext is null', async () => {
            await expect(strategy.decideAction(null))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
        });

        it('should throw and log to console.error if ITurnContext is undefined', async () => {
            await expect(strategy.decideAction(undefined))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
        });

        it('should throw and log to console.error if context.getLogger is not a function', async () => {
            const invalidContext = {getLogger: "not-a-function"};
            await expect(strategy.decideAction(invalidContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: context.getLogger is not a function.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: context.getLogger is not a function.');
        });

        it('should throw and log to console.error if context.getLogger throws an error', async () => {
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

        it('should throw and log to console.error if logger from context is null', async () => {
            mockTurnContext.getLogger.mockReturnValueOnce(null);
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: Logger retrieved from context is invalid or incomplete (missing required methods like info, error, debug).');
        });

        it('should throw and log to console.error if logger from context is incomplete (e.g., missing error method)', async () => {
            mockTurnContext.getLogger.mockReturnValueOnce({
                info: jest.fn(),
                debug: jest.fn(),
                createChildLogger: jest.fn()
            }); // Missing 'error'
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: Logger retrieved from context is invalid or incomplete (missing required methods like info, error, debug).');
        });

        it('should throw and log to console.error if logger from context is incomplete (e.g., missing info method)', async () => {
            mockTurnContext.getLogger.mockReturnValueOnce({
                error: jest.fn(),
                debug: jest.fn(),
                createChildLogger: jest.fn()
            }); // Missing 'info'
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: Logger retrieved from context is invalid or incomplete (missing required methods like info, error, debug).');
        });

        it('should throw and log to console.error if logger from context is incomplete (e.g., missing debug method)', async () => {
            mockTurnContext.getLogger.mockReturnValueOnce({
                error: jest.fn(),
                info: jest.fn(),
                createChildLogger: jest.fn()
            }); // Missing 'debug'
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: Logger retrieved from context is invalid or incomplete (missing required methods like info, error, debug).');
        });

        // --- Tests for _getActorFromContext (assuming logger was obtained successfully) ---
        it('should throw and log via CHILD logger if context.getActor is not a function', async () => {
            const invalidContext = {
                ...mockTurnContext,
                getLogger: jest.fn().mockReturnValue(mockMainLogger),
                getActor: "not-a-function"
            };
            mockMainLogger.createChildLogger.mockReturnValue(mockChildLogger);


            await expect(strategy.decideAction(invalidContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: context.getActor is not a function.');
            expect(mockChildLogger.error).toHaveBeenCalledWith('HumanPlayerStrategy Critical: context.getActor is not a function.');
            // Check that the outer catch also logs
            expect(mockChildLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Unhandled error during turn decision for actor unknown_actor. Message: HumanPlayerStrategy Critical: context.getActor is not a function.`), expect.any(Error));
        });

        // --- Tests for _getPlayerPromptServiceFromContext (assuming logger & actor obtained) ---
        it('should throw and log via CHILD logger if context.getPlayerPromptService is not a function', async () => {
            const invalidContext = {
                ...mockTurnContext,
                getLogger: jest.fn().mockReturnValue(mockMainLogger),
                getPlayerPromptService: "not-a-function"
            };
            mockMainLogger.createChildLogger.mockReturnValue(mockChildLogger);


            await expect(strategy.decideAction(invalidContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: context.getPlayerPromptService is not a function.');
            expect(mockChildLogger.error).toHaveBeenCalledWith('HumanPlayerStrategy Critical: context.getPlayerPromptService is not a function.');
            expect(mockChildLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Unhandled error during turn decision for actor ${mockActor.id}. Message: HumanPlayerStrategy Critical: context.getPlayerPromptService is not a function.`), expect.any(Error));
        });

        it('should throw and log via CHILD logger if context.getPlayerPromptService returns null', async () => {
            mockTurnContext.getPlayerPromptService.mockReturnValueOnce(null);
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: PlayerPromptService not available or invalid from ITurnContext.');
            expect(mockChildLogger.error).toHaveBeenCalledWith('HumanPlayerStrategy: PlayerPromptService not found in ITurnContext or is invalid (e.g., missing prompt method).');
            expect(mockChildLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Unhandled error during turn decision for actor ${mockActor.id}. Message: HumanPlayerStrategy Critical: PlayerPromptService not available or invalid from ITurnContext.`), expect.any(Error));
        });

        it('should throw and log via CHILD logger if playerPromptService from context is incomplete (missing prompt method)', async () => {
            mockTurnContext.getPlayerPromptService.mockReturnValueOnce({}); // Missing 'prompt'
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: PlayerPromptService not available or invalid from ITurnContext.');
            expect(mockChildLogger.error).toHaveBeenCalledWith('HumanPlayerStrategy: PlayerPromptService not found in ITurnContext or is invalid (e.g., missing prompt method).');
            expect(mockChildLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Unhandled error during turn decision for actor ${mockActor.id}. Message: HumanPlayerStrategy Critical: PlayerPromptService not available or invalid from ITurnContext.`), expect.any(Error));
        });

        it('should throw and log via CHILD logger if context.getPlayerPromptService throws an error', async () => {
            const specificErrorMessage = "Internal error in getPlayerPromptService";
            const specificError = new Error(specificErrorMessage);
            mockTurnContext.getPlayerPromptService.mockImplementationOnce(() => {
                throw specificError;
            });

            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow(`HumanPlayerStrategy Critical: Failed to call context.getPlayerPromptService(). Details: ${specificErrorMessage}`);
            expect(mockChildLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy: Error calling context.getPlayerPromptService(): ${specificErrorMessage}`,
                specificError
            );
            expect(mockChildLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Unhandled error during turn decision for actor ${mockActor.id}. Message: HumanPlayerStrategy Critical: Failed to call context.getPlayerPromptService(). Details: ${specificErrorMessage}`),
                expect.any(Error)
            );
        });

        // --- Test for playerPromptService.prompt() itself throwing ---
        it('should catch, log via CHILD logger, and re-throw if playerPromptService.prompt() throws an error', async () => {
            const promptErrorMessage = 'Prompt service connection failed';
            const promptError = new Error(promptErrorMessage);
            mockPlayerPromptService.prompt.mockRejectedValueOnce(promptError);

            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow(`Failed to get player input for actor ${mockActor.id}. Details: ${promptErrorMessage}`);

            // Log from the inner catch block (around prompt call)
            expect(mockChildLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy: Error during playerPromptService.prompt() for actor ${mockActor.id}: ${promptErrorMessage}`,
                promptError
            );
            // Log from the outer catch block in decideAction
            expect(mockChildLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Unhandled error during turn decision for actor ${mockActor.id}. Message: Failed to get player input for actor ${mockActor.id}. Details: ${promptErrorMessage}`),
                expect.any(Error) // The error re-thrown would be the one from the inner catch
            );
        });
    });
});

// --- FILE END ---