// src/tests/core/turns/strategies/humanPlayerStrategy.test.js
// --- FILE START ---

import {HumanPlayerStrategy} from '../../../../core/turns/strategies/humanPlayerStrategy.js';
import {beforeEach, afterEach, describe, expect, it, jest} from "@jest/globals";

// Mock for ITurnContext
const mockTurnContext = {
    getActor: jest.fn(),
    getLogger: jest.fn(),
    getPlayerPromptService: jest.fn(),
    // --- Add other methods if they become needed by the strategy or its helpers ---
    // getGame: jest.fn(),
    // getCommandProcessor: jest.fn(),
    // getCommandOutcomeInterpreter: jest.fn(),
    // getSafeEventDispatcher: jest.fn(),
    // getSubscriptionManager: jest.fn(),
    // getTurnEndPort: jest.fn(),
    // endTurn: jest.fn(),
    // isAwaitingExternalEvent: jest.fn(),
    // requestTransition: jest.fn(),
    // setAwaitingExternalEvent: jest.fn(),
};

// Mock for IPlayerPromptService
const mockPlayerPromptService = {
    prompt: jest.fn(),
};

// Mock for the logger returned by context.getLogger()
const mockMainLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    // Removed createChildLogger as it's no longer used by the strategy directly
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

        // Default setup: getLogger returns the main logger
        mockTurnContext.getLogger.mockReturnValue(mockMainLogger);
        // Ensure other necessary mocks are set up
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

            expect(mockTurnContext.getActor).toHaveBeenCalledTimes(1);
            expect(mockTurnContext.getPlayerPromptService).toHaveBeenCalledTimes(1);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor, `${mockActor.name || 'Player'}, your command?`);

            expect(turnAction).toEqual({
                commandString: trimmedCommand,
                actionDefinitionId: 'player:commandInput',
                resolvedParameters: {rawCommand: trimmedCommand},
            });
            // Log messages will now go to the main logger
            expect(mockMainLogger.debug).toHaveBeenCalledWith(`HumanPlayerStrategy: Initiating decideAction for actor ${mockActor.id}.`);
            expect(mockMainLogger.debug).toHaveBeenCalledWith(`HumanPlayerStrategy: Prompting actor ${mockActor.id} with message: "${mockActor.name || 'Player'}, your command?"`);
            expect(mockMainLogger.info).toHaveBeenCalledWith(`HumanPlayerStrategy: Received command "${trimmedCommand}" from actor ${mockActor.id}.`);
            expect(mockMainLogger.debug).toHaveBeenCalledWith(`HumanPlayerStrategy: Resolving with ITurnAction for actor ${mockActor.id}:`, {turnActionDetails: turnAction});
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
                actionDefinitionId: 'player:commandInput',
                resolvedParameters: {rawCommand: validCommand},
            });
            // Log messages will now go to the main logger
            expect(mockMainLogger.debug).toHaveBeenCalledWith(`HumanPlayerStrategy: Empty command received from actor ${mockActor.id}. Re-prompting.`);
            expect(mockMainLogger.info).toHaveBeenCalledWith(`HumanPlayerStrategy: Received command "${validCommand}" from actor ${mockActor.id}.`);
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
                actionDefinitionId: 'player:commandInput',
                resolvedParameters: {rawCommand: validCommand},
            });
            // Log messages will now go to the main logger
            expect(mockMainLogger.debug).toHaveBeenCalledWith(`HumanPlayerStrategy: Empty command received from actor ${mockActor.id}. Re-prompting.`);
            expect(mockMainLogger.info).toHaveBeenCalledWith(`HumanPlayerStrategy: Received command "${validCommand}" from actor ${mockActor.id}.`);
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
                actionDefinitionId: 'player:commandInput',
                resolvedParameters: {rawCommand: command},
            });
            // Log messages will now go to the main logger
            expect(mockMainLogger.info).toHaveBeenCalledWith(`HumanPlayerStrategy: Received command "${command}" from actor ${actorWithoutName.id}.`);


            // Clear mocks for the next part of the test within the same 'it' block
            jest.clearAllMocks();
            // Reset main logger mock for the next section
            mockTurnContext.getLogger.mockReturnValue(mockMainLogger);
            mockTurnContext.getPlayerPromptService.mockReturnValue(mockPlayerPromptService); // Ensure service is reset if needed


            const actorWithUndefinedName = {id: 'player3'}; // name is undefined
            mockTurnContext.getActor.mockReturnValueOnce(actorWithUndefinedName);
            mockPlayerPromptService.prompt.mockResolvedValueOnce(command); // Reset for next call
            turnAction = await strategy.decideAction(mockTurnContext);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(actorWithUndefinedName, 'Player, your command?');
            expect(turnAction.commandString).toBe(command);
            // Log messages will now go to the main logger
            expect(mockMainLogger.info).toHaveBeenCalledWith(`HumanPlayerStrategy: Received command "${command}" from actor ${actorWithUndefinedName.id}.`);


            // Clear mocks for the next part of the test within the same 'it' block
            jest.clearAllMocks();
            // Reset main logger mock for the next section
            mockTurnContext.getLogger.mockReturnValue(mockMainLogger);
            mockTurnContext.getPlayerPromptService.mockReturnValue(mockPlayerPromptService); // Ensure service is reset if needed

            const actorWithEmptyName = {id: 'player4', name: ''};
            mockTurnContext.getActor.mockReturnValueOnce(actorWithEmptyName);
            mockPlayerPromptService.prompt.mockResolvedValueOnce(command); // Reset for next call
            turnAction = await strategy.decideAction(mockTurnContext);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(actorWithEmptyName, 'Player, your command?');
            expect(turnAction.commandString).toBe(command);
            // Log messages will now go to the main logger
            expect(mockMainLogger.info).toHaveBeenCalledWith(`HumanPlayerStrategy: Received command "${command}" from actor ${actorWithEmptyName.id}.`);
        });

        // --- Tests for _getLoggerFromContext (and initial context validation) ---
        it('should throw and log to console.error if ITurnContext is null', async () => {
            await expect(strategy.decideAction(null))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
            // Expect console.error because logger cannot be obtained
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
            // Ensure no logger methods were called
            expect(mockMainLogger.error).not.toHaveBeenCalled();
        });

        it('should throw and log to console.error if ITurnContext is undefined', async () => {
            await expect(strategy.decideAction(undefined))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
            // Expect console.error because logger cannot be obtained
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
            // Ensure no logger methods were called
            expect(mockMainLogger.error).not.toHaveBeenCalled();
        });

        it('should throw and log to console.error if context.getLogger is not a function', async () => {
            const invalidContext = {getLogger: "not-a-function"};
            await expect(strategy.decideAction(invalidContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: context.getLogger is not a function.');
            // Expect console.error because logger cannot be obtained
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: context.getLogger is not a function.');
            // Ensure no logger methods were called
            expect(mockMainLogger.error).not.toHaveBeenCalled();
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
            // Expect console.error because logger cannot be obtained reliably
            expect(consoleErrorSpy).toHaveBeenCalledWith(`HumanPlayerStrategy Critical: context.getLogger() threw an error during retrieval: ${specificErrorMessage}`);
            // Ensure no logger methods were called
            expect(mockMainLogger.error).not.toHaveBeenCalled();
        });

        it('should throw and log to console.error if logger from context is null', async () => {
            mockTurnContext.getLogger.mockReturnValueOnce(null);
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete.');
            // Expect console.error because the retrieved logger is invalid
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: Logger retrieved from context is invalid or incomplete (missing required methods like info, error, debug).');
            // Ensure no logger methods were called (as the logger instance was null)
            expect(mockMainLogger.error).not.toHaveBeenCalled(); // Note: This check is tricky because the mock was *not* returned.
        });

        it('should throw and log to console.error if logger from context is incomplete (e.g., missing error method)', async () => {
            const incompleteLogger = {info: jest.fn(), debug: jest.fn()}; // Missing 'error'
            mockTurnContext.getLogger.mockReturnValueOnce(incompleteLogger);
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete.');
            // Expect console.error because the retrieved logger is invalid
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: Logger retrieved from context is invalid or incomplete (missing required methods like info, error, debug).');
            // Ensure no error logging happened via the incomplete logger
            expect(incompleteLogger.error).toBeUndefined(); // Or check that if it existed, it wasn't called
            // Ensure mockMainLogger wasn't used either
            expect(mockMainLogger.error).not.toHaveBeenCalled();
        });

        it('should throw and log to console.error if logger from context is incomplete (e.g., missing info method)', async () => {
            const incompleteLogger = {error: jest.fn(), debug: jest.fn()}; // Missing 'info'
            mockTurnContext.getLogger.mockReturnValueOnce(incompleteLogger);
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: Logger retrieved from context is invalid or incomplete (missing required methods like info, error, debug).');
            expect(incompleteLogger.info).toBeUndefined();
            expect(mockMainLogger.info).not.toHaveBeenCalled();
        });

        it('should throw and log to console.error if logger from context is incomplete (e.g., missing debug method)', async () => {
            const incompleteLogger = {error: jest.fn(), info: jest.fn()}; // Missing 'debug'
            mockTurnContext.getLogger.mockReturnValueOnce(incompleteLogger);
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: Logger retrieved from context is invalid or incomplete (missing required methods like info, error, debug).');
            expect(incompleteLogger.debug).toBeUndefined();
            expect(mockMainLogger.debug).not.toHaveBeenCalled();
        });


        // --- Tests for _getActorFromContext (assuming logger was obtained successfully) ---
        it('should throw and log via MAIN logger if context.getActor is not a function', async () => {
            // Setup: Ensure getLogger returns the valid mockMainLogger first
            mockTurnContext.getLogger.mockReturnValue(mockMainLogger);

            const invalidContext = {
                ...mockTurnContext, // Spread valid parts
                getLogger: jest.fn().mockReturnValue(mockMainLogger), // Keep getLogger valid
                getActor: "not-a-function" // Introduce the invalid part
            };

            await expect(strategy.decideAction(invalidContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: context.getActor is not a function.');

            // Error logged by _getActorFromContext using the obtained logger
            expect(mockMainLogger.error).toHaveBeenCalledWith('HumanPlayerStrategy Critical: context.getActor is not a function.');
            // Error logged by the outer catch block in decideAction
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`HumanPlayerStrategy.decideAction: Unhandled error during turn decision for actor unknown_actor. Message: HumanPlayerStrategy Critical: context.getActor is not a function.`),
                expect.any(Error) // Expect the actual error object to be logged
            );
        });

        // --- Tests for _getPlayerPromptServiceFromContext (assuming logger & actor obtained) ---
        it('should throw and log via MAIN logger if context.getPlayerPromptService is not a function', async () => {
            // Setup: Ensure getLogger and getActor return valid mocks first
            mockTurnContext.getLogger.mockReturnValue(mockMainLogger);
            mockTurnContext.getActor.mockReturnValue(mockActor);

            const invalidContext = {
                ...mockTurnContext, // Spread valid parts
                getLogger: jest.fn().mockReturnValue(mockMainLogger), // Keep getLogger valid
                getActor: jest.fn().mockReturnValue(mockActor), // Keep getActor valid
                getPlayerPromptService: "not-a-function" // Introduce the invalid part
            };


            await expect(strategy.decideAction(invalidContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: context.getPlayerPromptService is not a function.');

            // Error logged by _getPlayerPromptServiceFromContext using the obtained logger
            expect(mockMainLogger.error).toHaveBeenCalledWith('HumanPlayerStrategy Critical: context.getPlayerPromptService is not a function.');
            // Error logged by the outer catch block in decideAction
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`HumanPlayerStrategy.decideAction: Unhandled error during turn decision for actor ${mockActor.id}. Message: HumanPlayerStrategy Critical: context.getPlayerPromptService is not a function.`),
                expect.any(Error) // Expect the actual error object to be logged
            );
        });

        it('should throw and log via MAIN logger if context.getPlayerPromptService returns null', async () => {
            mockTurnContext.getPlayerPromptService.mockReturnValueOnce(null);

            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: PlayerPromptService not available or invalid from ITurnContext.');

            // Error logged by _getPlayerPromptServiceFromContext
            expect(mockMainLogger.error).toHaveBeenCalledWith('HumanPlayerStrategy: PlayerPromptService not found in ITurnContext or is invalid (e.g., missing prompt method).');
            // Error logged by the outer catch block in decideAction
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`HumanPlayerStrategy.decideAction: Unhandled error during turn decision for actor ${mockActor.id}. Message: HumanPlayerStrategy Critical: PlayerPromptService not available or invalid from ITurnContext.`),
                expect.any(Error)
            );
        });

        it('should throw and log via MAIN logger if playerPromptService from context is incomplete (missing prompt method)', async () => {
            mockTurnContext.getPlayerPromptService.mockReturnValueOnce({}); // Missing 'prompt'

            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: PlayerPromptService not available or invalid from ITurnContext.');

            // Error logged by _getPlayerPromptServiceFromContext
            expect(mockMainLogger.error).toHaveBeenCalledWith('HumanPlayerStrategy: PlayerPromptService not found in ITurnContext or is invalid (e.g., missing prompt method).');
            // Error logged by the outer catch block in decideAction
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`HumanPlayerStrategy.decideAction: Unhandled error during turn decision for actor ${mockActor.id}. Message: HumanPlayerStrategy Critical: PlayerPromptService not available or invalid from ITurnContext.`),
                expect.any(Error)
            );
        });

        it('should throw and log via MAIN logger if context.getPlayerPromptService throws an error', async () => {
            const specificErrorMessage = "Internal error in getPlayerPromptService";
            const specificError = new Error(specificErrorMessage);
            mockTurnContext.getPlayerPromptService.mockImplementationOnce(() => {
                throw specificError;
            });

            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow(`HumanPlayerStrategy Critical: Failed to call context.getPlayerPromptService(). Details: ${specificErrorMessage}`);

            // Error logged by _getPlayerPromptServiceFromContext
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy: Error calling context.getPlayerPromptService(): ${specificErrorMessage}`,
                specificError // Check that the original error object is passed
            );
            // Error logged by the outer catch block in decideAction
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`HumanPlayerStrategy.decideAction: Unhandled error during turn decision for actor ${mockActor.id}. Message: HumanPlayerStrategy Critical: Failed to call context.getPlayerPromptService(). Details: ${specificErrorMessage}`),
                expect.any(Error) // The specificError is re-thrown and caught here
            );
        });

        // --- Test for playerPromptService.prompt() itself throwing ---
        it('should catch, log via MAIN logger, and re-throw if playerPromptService.prompt() throws an error', async () => {
            const promptErrorMessage = 'Prompt service connection failed';
            const promptError = new Error(promptErrorMessage);
            mockPlayerPromptService.prompt.mockRejectedValueOnce(promptError);

            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow(`Failed to get player input for actor ${mockActor.id}. Details: ${promptErrorMessage}`);

            // Log from the inner catch block (around prompt call) inside decideAction
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy: Error during playerPromptService.prompt() for actor ${mockActor.id}: ${promptErrorMessage}`,
                promptError // Check original error object
            );
            // Log from the outer catch block in decideAction
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`HumanPlayerStrategy.decideAction: Unhandled error during turn decision for actor ${mockActor.id}. Message: Failed to get player input for actor ${mockActor.id}. Details: ${promptErrorMessage}`),
                expect.any(Error) // The error re-thrown would be the one created in the inner catch
            );
        });
    });
});

// --- FILE END ---