// tests/turns/strategies/humanPlayerStrategy.test.js
// --- FILE START ---

import {HumanPlayerStrategy} from '../../../src/turns/strategies/humanPlayerStrategy.js';
import {beforeEach, afterEach, describe, expect, it, jest} from "@jest/globals";

// Mock for ITurnContext
const mockTurnContext = {
    getActor: jest.fn(),
    getLogger: jest.fn(),
    getPlayerPromptService: jest.fn(),
    getPromptSignal: jest.fn(),
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
};

// Mock for Entity (Actor)
const mockActor = {
    id: 'player1',
    name: 'TestPlayer',
};

// Mock for AvailableAction
const mockAvailableAction = {
    id: 'test:actionId',
    command: 'Test Command String',
};


describe('HumanPlayerStrategy', () => {
    let strategy;
    let consoleErrorSpy;

    beforeEach(() => {
        strategy = new HumanPlayerStrategy();
        jest.clearAllMocks();

        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });

        mockTurnContext.getLogger.mockReturnValue(mockMainLogger);
        mockTurnContext.getActor.mockReturnValue(mockActor);
        mockTurnContext.getPlayerPromptService.mockReturnValue(mockPlayerPromptService);
        mockTurnContext.getPromptSignal.mockReturnValue(undefined);
        mockPlayerPromptService.prompt.mockReset();
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('decideAction', () => {
        it('should call playerPromptService.prompt and return a correctly structured ITurnAction', async () => {
            const playerData = {
                action: {...mockAvailableAction, id: 'action:look', command: 'Look Around'},
                speech: 'quickly',
            };
            mockPlayerPromptService.prompt.mockResolvedValueOnce(playerData);

            const turnAction = await strategy.decideAction(mockTurnContext);

            expect(mockTurnContext.getActor).toHaveBeenCalledTimes(1);
            expect(mockTurnContext.getPlayerPromptService).toHaveBeenCalledTimes(1);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(
                mockActor,
                {cancellationSignal: undefined}
            );

            expect(turnAction).toEqual({
                actionDefinitionId: playerData.action.id,
                commandString: playerData.action.command,
                resolvedParameters: {speech: playerData.speech},
            });

            expect(mockMainLogger.info).toHaveBeenCalledWith(`HumanPlayerStrategy: Initiating decideAction for actor ${mockActor.id}.`);
            expect(mockTurnContext.getPromptSignal).toHaveBeenCalled();
            expect(mockMainLogger.debug).toHaveBeenCalledWith(`HumanPlayerStrategy: Calling playerPromptService.prompt() for actor ${mockActor.id}.`);
            expect(mockMainLogger.debug).toHaveBeenCalledWith(`HumanPlayerStrategy: Received playerData for actor ${mockActor.id}. Details:`, playerData);
            expect(mockMainLogger.debug).toHaveBeenCalledWith(`HumanPlayerStrategy: playerData for actor ${mockActor.id} validated successfully. Action ID: "${playerData.action.id}".`);
            expect(mockMainLogger.info).toHaveBeenCalledWith(`HumanPlayerStrategy: Constructed ITurnAction for actor ${mockActor.id} with actionDefinitionId "${playerData.action.id}".`);
            expect(mockMainLogger.debug).toHaveBeenCalledWith(`HumanPlayerStrategy: ITurnAction details for actor ${mockActor.id}:`, {turnActionDetails: turnAction});
        });

        it('should handle null speech from playerData correctly', async () => {
            const playerData = {
                action: {...mockAvailableAction, id: 'action:wait', command: 'Wait'},
                speech: null,
            };
            mockPlayerPromptService.prompt.mockResolvedValueOnce(playerData);

            const turnAction = await strategy.decideAction(mockTurnContext);

            expect(turnAction).toEqual({
                actionDefinitionId: playerData.action.id,
                commandString: playerData.action.command,
                resolvedParameters: {speech: null},
            });
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(
                mockActor,
                {cancellationSignal: undefined}
            );
            expect(mockTurnContext.getPromptSignal).toHaveBeenCalled();
        });

        it('should throw if playerData from prompt is null', async () => {
            mockPlayerPromptService.prompt.mockResolvedValueOnce(null);
            const expectedErrorMsg = `HumanPlayerStrategy: Invalid or incomplete data received from playerPromptService.prompt() for actor ${mockActor.id}. Action ID and command string are mandatory. Received: null`;

            await expect(strategy.decideAction(mockTurnContext)).rejects.toThrow(expectedErrorMsg);
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy: Invalid or incomplete data received from playerPromptService.prompt() for actor ${mockActor.id}. Action ID and command string are mandatory.`,
                {receivedData: null}
            );
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy.decideAction: Operation failed for actor ${mockActor.id}. Error: ${expectedErrorMsg}`,
                expect.any(Error)
            );
            expect(mockTurnContext.getPromptSignal).toHaveBeenCalled();
        });

        it('should throw if playerData.action from prompt is null', async () => {
            const playerData = {action: null, speech: 'hello'};
            mockPlayerPromptService.prompt.mockResolvedValueOnce(playerData);
            const expectedErrorMsg = `HumanPlayerStrategy: Invalid or incomplete data received from playerPromptService.prompt() for actor ${mockActor.id}. Action ID and command string are mandatory. Received: ${JSON.stringify(playerData)}`;

            await expect(strategy.decideAction(mockTurnContext)).rejects.toThrow(expectedErrorMsg);
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy: Invalid or incomplete data received from playerPromptService.prompt() for actor ${mockActor.id}. Action ID and command string are mandatory.`,
                {receivedData: playerData}
            );
            expect(mockTurnContext.getPromptSignal).toHaveBeenCalled();
        });

        it('should throw if playerData.action.id is missing or not a string', async () => {
            const playerDataMissingId = {action: {command: 'Do It'}, speech: 'now'};
            mockPlayerPromptService.prompt.mockResolvedValueOnce(playerDataMissingId);
            const expectedErrorMsgPart = `HumanPlayerStrategy: Invalid or incomplete data received from playerPromptService.prompt() for actor ${mockActor.id}. Action ID and command string are mandatory.`;
            await expect(strategy.decideAction(mockTurnContext)).rejects.toThrow(new RegExp(`^${expectedErrorMsgPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
            expect(mockTurnContext.getPromptSignal).toHaveBeenCalledTimes(1);

            mockTurnContext.getPromptSignal.mockClear();
            mockPlayerPromptService.prompt.mockClear();

            const playerDataInvalidId = {action: {id: 123, command: 'Do It'}, speech: 'now'};
            mockPlayerPromptService.prompt.mockResolvedValueOnce(playerDataInvalidId);
            await expect(strategy.decideAction(mockTurnContext)).rejects.toThrow(new RegExp(`^${expectedErrorMsgPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
            expect(mockTurnContext.getPromptSignal).toHaveBeenCalledTimes(1);
        });

        it('should throw if playerData.action.command is missing or not a string', async () => {
            const playerDataMissingCommand = {action: {id: 'cmd:do'}, speech: 'now'};
            mockPlayerPromptService.prompt.mockResolvedValueOnce(playerDataMissingCommand);
            const expectedErrorMsgPart = `HumanPlayerStrategy: Invalid or incomplete data received from playerPromptService.prompt() for actor ${mockActor.id}. Action ID and command string are mandatory.`;
            await expect(strategy.decideAction(mockTurnContext)).rejects.toThrow(new RegExp(`^${expectedErrorMsgPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
            expect(mockTurnContext.getPromptSignal).toHaveBeenCalledTimes(1);

            mockTurnContext.getPromptSignal.mockClear();
            mockPlayerPromptService.prompt.mockClear();

            const playerDataInvalidCommand = {action: {id: 'cmd:do', command: 123}, speech: 'now'};
            mockPlayerPromptService.prompt.mockResolvedValueOnce(playerDataInvalidCommand);
            await expect(strategy.decideAction(mockTurnContext)).rejects.toThrow(new RegExp(`^${expectedErrorMsgPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
            expect(mockTurnContext.getPromptSignal).toHaveBeenCalledTimes(1);
        });

        it('should throw and log to console.error if ITurnContext is null', async () => {
            await expect(strategy.decideAction(null))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
            expect(mockMainLogger.error).not.toHaveBeenCalled();
        });

        it('should throw and log to console.error if ITurnContext is undefined', async () => {
            await expect(strategy.decideAction(undefined))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
            expect(mockMainLogger.error).not.toHaveBeenCalled();
        });

        it('should throw and log to console.error if context.getLogger is not a function', async () => {
            const invalidContext = {getLogger: "not-a-function"};
            await expect(strategy.decideAction(invalidContext))
                .rejects
                .toThrow('HumanPlayerStrategy Critical: context.getLogger is not a function.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('HumanPlayerStrategy Critical: context.getLogger is not a function.');
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
                .toThrow(`HumanPlayerStrategy Critical: context.getLogger() call failed. Details: ${specificErrorMessage}`);
            expect(consoleErrorSpy).toHaveBeenCalledWith(`HumanPlayerStrategy Critical: context.getLogger() call failed. Details: ${specificErrorMessage}`, specificError);
            expect(mockMainLogger.error).not.toHaveBeenCalled();
        });

        it('should throw and log to console.error if logger from context is null', async () => {
            mockTurnContext.getLogger.mockReturnValueOnce(null);
            const expectedErrorMsg = 'HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete (missing required methods like info, error, debug, warn).';
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow(expectedErrorMsg);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMsg);
            expect(mockMainLogger.error).not.toHaveBeenCalled();
        });

        it('should throw and log to console.error if logger from context is incomplete (e.g., missing error method)', async () => {
            const incompleteLogger = {info: jest.fn(), debug: jest.fn(), warn: jest.fn()};
            mockTurnContext.getLogger.mockReturnValueOnce(incompleteLogger);
            const expectedErrorMsg = 'HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete (missing required methods like info, error, debug, warn).';
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow(expectedErrorMsg);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMsg);
            expect(incompleteLogger.error).toBeUndefined();
            expect(mockMainLogger.error).not.toHaveBeenCalled();
        });

        it('should throw and log to console.error if logger from context is incomplete (e.g., missing info method)', async () => {
            const incompleteLogger = {error: jest.fn(), debug: jest.fn(), warn: jest.fn()};
            mockTurnContext.getLogger.mockReturnValueOnce(incompleteLogger);
            const expectedErrorMsg = 'HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete (missing required methods like info, error, debug, warn).';
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow(expectedErrorMsg);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMsg);
            expect(incompleteLogger.info).toBeUndefined();
        });

        it('should throw and log to console.error if logger from context is incomplete (e.g., missing debug method)', async () => {
            const incompleteLogger = {error: jest.fn(), info: jest.fn(), warn: jest.fn()};
            mockTurnContext.getLogger.mockReturnValueOnce(incompleteLogger);
            const expectedErrorMsg = 'HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete (missing required methods like info, error, debug, warn).';
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow(expectedErrorMsg);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMsg);
            expect(incompleteLogger.debug).toBeUndefined();
        });

        it('should throw and log to console.error if logger from context is incomplete (e.g., missing warn method)', async () => {
            const incompleteLogger = {error: jest.fn(), info: jest.fn(), debug: jest.fn()};
            mockTurnContext.getLogger.mockReturnValueOnce(incompleteLogger);
            const expectedErrorMsg = 'HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete (missing required methods like info, error, debug, warn).';
            await expect(strategy.decideAction(mockTurnContext))
                .rejects
                .toThrow(expectedErrorMsg);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMsg);
            expect(incompleteLogger.warn).toBeUndefined();
        });

        it('should throw and log via MAIN logger if context.getActor is not a function', async () => {
            mockTurnContext.getLogger.mockReturnValue(mockMainLogger);
            const invalidContext = {
                ...mockTurnContext,
                getActor: "not-a-function"
            };
            const expectedErrorMsg = 'HumanPlayerStrategy Critical: context.getActor is not a function.';
            await expect(strategy.decideAction(invalidContext)).rejects.toThrow(expectedErrorMsg);
            expect(mockMainLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy.decideAction: Operation failed for actor unknown_actor. Error: ${expectedErrorMsg}`,
                expect.any(Error)
            );
        });

        it('should throw and log via MAIN logger if context.getActor throws', async () => {
            const actorError = new Error("Cannot get actor");
            mockTurnContext.getActor.mockImplementationOnce(() => {
                throw actorError;
            });

            const expectedErrorMsg = `HumanPlayerStrategy Critical: context.getActor() call failed. Details: ${actorError.message}`;

            await expect(strategy.decideAction(mockTurnContext)).rejects.toThrow(expectedErrorMsg);
            expect(mockMainLogger.error).toHaveBeenCalledWith(expectedErrorMsg, actorError);
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy.decideAction: Operation failed for actor ${mockActor.id}. Error: ${expectedErrorMsg}`,
                expect.any(Error)
            );
        });

        it('should throw and log via MAIN logger if context.getActor returns null or invalid actor', async () => {
            mockTurnContext.getActor.mockReturnValueOnce(null);
            const expectedErrorMsg = 'HumanPlayerStrategy Critical: Actor not available from ITurnContext or actor has an invalid ID.';

            await expect(strategy.decideAction(mockTurnContext)).rejects.toThrow(expectedErrorMsg);
            expect(mockMainLogger.error).toHaveBeenCalledWith(expectedErrorMsg, {actorInstance: null});
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy.decideAction: Operation failed for actor ${mockActor.id}. Error: ${expectedErrorMsg}`,
                expect.any(Error)
            );

            jest.clearAllMocks();
            mockTurnContext.getLogger.mockReturnValue(mockMainLogger);
            mockTurnContext.getActor.mockReturnValueOnce({name: 'NoIDPlayer'});
            mockTurnContext.getPlayerPromptService.mockReturnValue(mockPlayerPromptService);
            mockTurnContext.getPromptSignal.mockReturnValue(undefined);

            await expect(strategy.decideAction(mockTurnContext)).rejects.toThrow(expectedErrorMsg);
            expect(mockMainLogger.error).toHaveBeenCalledWith(expectedErrorMsg, {actorInstance: {name: 'NoIDPlayer'}});
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy.decideAction: Operation failed for actor ${mockActor.id}. Error: ${expectedErrorMsg}`,
                expect.any(Error)
            );
        });

        it('should throw and log via MAIN logger if context.getPlayerPromptService is not a function', async () => {
            const invalidContext = {
                ...mockTurnContext, // This will spread the existing mocks, including getPromptSignal
                getActor: jest.fn(() => mockActor), // Ensure getActor is valid for this test
                getLogger: jest.fn(() => mockMainLogger), // Ensure getLogger is valid
                getPlayerPromptService: "not-a-function"
            };
            const expectedErrorMsg = 'HumanPlayerStrategy Critical: context.getPlayerPromptService is not a function.';
            await expect(strategy.decideAction(invalidContext)).rejects.toThrow(expectedErrorMsg);
            expect(mockMainLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                // Since getPlayerPromptService itself is not a function, actorId might be derived correctly.
                `HumanPlayerStrategy.decideAction: Operation failed for actor ${mockActor.id}. Error: ${expectedErrorMsg}`,
                expect.any(Error)
            );
            // --- MODIFICATION: Remove incorrect assertion ---
            // expect(mockTurnContext.getPromptSignal).toHaveBeenCalled();
            // --- END MODIFICATION ---
        });

        it('should throw and log via MAIN logger if context.getPlayerPromptService returns null', async () => {
            mockTurnContext.getPlayerPromptService.mockReturnValueOnce(null);
            const expectedErrorMsg = 'HumanPlayerStrategy Critical: PlayerPromptService not available from ITurnContext or is invalid (e.g., missing prompt method).';

            await expect(strategy.decideAction(mockTurnContext)).rejects.toThrow(expectedErrorMsg);
            expect(mockMainLogger.error).toHaveBeenCalledWith(expectedErrorMsg, {serviceInstance: null});
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy.decideAction: Operation failed for actor ${mockActor.id}. Error: ${expectedErrorMsg}`,
                expect.any(Error)
            );
            // --- MODIFICATION: Remove incorrect assertion ---
            // expect(mockTurnContext.getPromptSignal).toHaveBeenCalled();
            // --- END MODIFICATION ---
        });

        it('should throw and log via MAIN logger if playerPromptService from context is incomplete (missing prompt method)', async () => {
            mockTurnContext.getPlayerPromptService.mockReturnValueOnce({});
            const expectedErrorMsg = 'HumanPlayerStrategy Critical: PlayerPromptService not available from ITurnContext or is invalid (e.g., missing prompt method).';

            await expect(strategy.decideAction(mockTurnContext)).rejects.toThrow(expectedErrorMsg);
            expect(mockMainLogger.error).toHaveBeenCalledWith(expectedErrorMsg, {serviceInstance: {}});
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy.decideAction: Operation failed for actor ${mockActor.id}. Error: ${expectedErrorMsg}`,
                expect.any(Error)
            );
            // --- MODIFICATION: Remove incorrect assertion ---
            // expect(mockTurnContext.getPromptSignal).toHaveBeenCalled();
            // --- END MODIFICATION ---
        });

        it('should throw and log via MAIN logger if context.getPlayerPromptService throws an error', async () => {
            const specificErrorMessage = "Internal error in getPlayerPromptService";
            const specificError = new Error(specificErrorMessage);
            mockTurnContext.getPlayerPromptService.mockImplementationOnce(() => {
                throw specificError;
            });
            const expectedErrorMsg = `HumanPlayerStrategy Critical: context.getPlayerPromptService() call failed. Details: ${specificErrorMessage}`;

            await expect(strategy.decideAction(mockTurnContext)).rejects.toThrow(expectedErrorMsg);
            expect(mockMainLogger.error).toHaveBeenCalledWith(expectedErrorMsg, specificError);
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy.decideAction: Operation failed for actor ${mockActor.id}. Error: ${expectedErrorMsg}`,
                expect.any(Error)
            );
            // --- MODIFICATION: Remove incorrect assertion ---
            // expect(mockTurnContext.getPromptSignal).toHaveBeenCalled();
            // --- END MODIFICATION ---
        });

        it('should catch, log, and re-throw if playerPromptService.prompt() throws an error', async () => {
            const promptErrorMessage = 'Prompt service connection failed';
            const promptError = new Error(promptErrorMessage);
            mockPlayerPromptService.prompt.mockRejectedValueOnce(promptError);

            await expect(strategy.decideAction(mockTurnContext)).rejects.toThrow(promptError);

            expect(mockMainLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy: Error during playerPromptService.prompt() for actor ${mockActor.id}.`,
                promptError
            );
            expect(mockMainLogger.error).toHaveBeenCalledWith(
                `HumanPlayerStrategy.decideAction: Operation failed for actor ${mockActor.id}. Error: ${promptErrorMessage}`,
                promptError
            );
            expect(mockTurnContext.getPromptSignal).toHaveBeenCalled();
        });

        it('should log info and re-throw AbortError if playerPromptService.prompt is aborted', async () => {
            const abortError = new DOMException('Test Abort', 'AbortError');
            mockPlayerPromptService.prompt.mockRejectedValueOnce(abortError);

            const mockSignal = new AbortController().signal;
            mockTurnContext.getPromptSignal.mockReturnValueOnce(mockSignal);

            await expect(strategy.decideAction(mockTurnContext)).rejects.toThrow(abortError);

            expect(mockMainLogger.info).toHaveBeenCalledWith(
                `HumanPlayerStrategy: Prompt for actor ${mockActor.id} was cancelled (aborted).`
            );
            expect(mockMainLogger.error).not.toHaveBeenCalledWith(
                `HumanPlayerStrategy: Error during playerPromptService.prompt() for actor ${mockActor.id}.`,
                expect.anything()
            );
            expect(mockMainLogger.info).toHaveBeenCalledWith(
                `HumanPlayerStrategy.decideAction: Operation for actor ${mockActor.id} was cancelled (aborted). Error: ${abortError.message}`
            );
            expect(mockTurnContext.getPromptSignal).toHaveBeenCalled();
        });
    });
});
// --- FILE END ---