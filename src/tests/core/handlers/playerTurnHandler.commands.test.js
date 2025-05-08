// src/tests/core/handlers/playerTurnHandler.commands.test.js
// --- FILE START ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
// import TurnDirective from '../../../core/constants/turnDirectives.js'; // Not directly needed for these tests

describe('PlayerTurnHandler - Command Handling', () => {
    let mockLogger;
    let mockCommandProcessor;
    let mockTurnEndPort;
    let mockPlayerPromptService;
    let mockCommandOutcomeInterpreter;
    let mockSafeEventDispatcher;
    let mockSubscriptionManager;
    let validDependencies;
    let playerTurnHandler;
    let actor;
    let className;

    const ACTOR_ID = 'player1';

    beforeEach(() => {
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };
        mockCommandProcessor = {
            processCommand: jest.fn(),
        };
        mockTurnEndPort = {
            notifyTurnEnded: jest.fn().mockResolvedValue(undefined),
        };
        mockPlayerPromptService = {
            prompt: jest.fn().mockResolvedValue(undefined),
        };
        mockCommandOutcomeInterpreter = {
            interpret: jest.fn(),
        };
        mockSafeEventDispatcher = {
            dispatchSafely: jest.fn(),
            subscribe: jest.fn(),
        };
        mockSubscriptionManager = {
            subscribeToCommandInput: jest.fn(),
            unsubscribeFromCommandInput: jest.fn(),
            subscribeToTurnEnded: jest.fn(),
            unsubscribeFromTurnEnded: jest.fn(),
            unsubscribeAll: jest.fn(),
        };

        validDependencies = {
            logger: mockLogger,
            commandProcessor: mockCommandProcessor,
            turnEndPort: mockTurnEndPort,
            playerPromptService: mockPlayerPromptService,
            commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
            safeEventDispatcher: mockSafeEventDispatcher,
            subscriptionLifecycleManager: mockSubscriptionManager,
        };

        playerTurnHandler = new PlayerTurnHandler(validDependencies);
        className = playerTurnHandler.constructor.name;
        actor = {id: ACTOR_ID, name: 'Test Player'};
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        playerTurnHandler._TEST_SET_CURRENT_ACTOR(null);
    });

    describe('_handleSubmittedCommand', () => {
        /**
         * Test: PlayerTurnHandler - _handleSubmittedCommand - No Active Turn (No Current Actor)
         * Scenario ID: 3.3.1.1
         */
        it('should ignore command and log warning if no current actor (Scenario 3.3.1.1)', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(null);

            const handleEmptyCommandSpy = jest.spyOn(playerTurnHandler, '_handleEmptyCommand');
            const result = await playerTurnHandler._handleSubmittedCommand("look");

            expect(result).toBeUndefined();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}: Ignoring submitted command: no player turn is active.`
            );
            expect(handleEmptyCommandSpy).not.toHaveBeenCalled();
            expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();
        });

        /**
         * Test: PlayerTurnHandler - _handleSubmittedCommand - Empty or Whitespace Command String
         * Scenario ID: 3.3.1.2
         */
        describe('Scenario 3.3.1.2: Empty or Whitespace Command String', () => {
            let handleEmptyCommandSpy;

            beforeEach(() => {
                playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
                handleEmptyCommandSpy = jest.spyOn(playerTurnHandler, '_handleEmptyCommand').mockResolvedValue(undefined);
            });

            const testCases = [
                {command: "", description: "empty string", expectedTrimmedLog: ""},
                {command: "   ", description: "whitespace string", expectedTrimmedLog: ""},
                {command: null, description: "null command", expectedTrimmedLog: "undefined"},
                {command: undefined, description: "undefined command", expectedTrimmedLog: "undefined"},
            ];

            testCases.forEach(({command, description, expectedTrimmedLog}) => {
                it(`should delegate to _handleEmptyCommand for ${description}`, async () => {
                    await playerTurnHandler._handleSubmittedCommand(command);
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        `${className}: Received command from actor ${ACTOR_ID}: "${command}" (trimmed: "${expectedTrimmedLog}")`
                    );
                    expect(handleEmptyCommandSpy).toHaveBeenCalledTimes(1);
                    expect(handleEmptyCommandSpy).toHaveBeenCalledWith(actor);
                    expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();
                });
            });
        });

        /**
         * Test: PlayerTurnHandler - _handleSubmittedCommand - Valid Command - Successful Processing Flow
         * Scenario ID: 3.3.1.3
         */
        it('should delegate to #_processValidatedCommand for a valid command (Scenario 3.3.1.3)', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
            const commandString = "look around";
            mockCommandProcessor.processCommand.mockResolvedValue({success: true});

            await playerTurnHandler._handleSubmittedCommand(commandString);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                `${className}: Received command from actor ${ACTOR_ID}: "${commandString}" (trimmed: "${commandString}")`
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                `${className}: Handling command "${commandString}" for current actor ${ACTOR_ID}.`
            );
            expect(mockCommandProcessor.processCommand).toHaveBeenCalledTimes(1);
            expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(actor, commandString);
        });

        /**
         * Test: PlayerTurnHandler - _handleSubmittedCommand - Valid Command - #_assertTurnActiveFor Fails (simulated via error from processCommand)
         * Scenario ID: 3.3.1.4
         * This test verifies how an error message containing "Assertion Failed - Turn is not active",
         * when originating from within #_processValidatedCommand's scope (e.g. from commandProcessor.processCommand),
         * is handled by #_processValidatedCommand itself.
         */
        it('should be handled by #_processValidatedCommand if an "Assertion Failed - Turn is not active" error occurs within its scope (Scenario 3.3.1.4)', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
            const commandString = "look around";
            const relevantErrorMessageSubstring = "Assertion Failed - Turn is not active"; // Substring checked by SUT
            const fullErrorMessage = `${className}: ${relevantErrorMessageSubstring}. Expected actor '${ACTOR_ID}', but no turn in progress.`;
            const assertionStyleError = new Error(fullErrorMessage);

            mockCommandProcessor.processCommand.mockRejectedValue(assertionStyleError);

            await playerTurnHandler._handleSubmittedCommand(commandString);

            // Expect the warning log from #_processValidatedCommand, as it catches this error.
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}: #_processValidatedCommand: Turn state assertion failed for command "${commandString}" by actor ${ACTOR_ID}. Error: ${fullErrorMessage}`
            );

            // #_processValidatedCommand should not be called further after this type of error (it returns)
            // and _handleSubmittedCommand's specific catch for this should not be hit if #_processValidatedCommand handles it.
            expect(mockCommandProcessor.processCommand).toHaveBeenCalledTimes(1); // It was called and threw.
            // No additional _handleTurnEnd should be called from _handleSubmittedCommand for this, as #_processValidatedCommand returns.
            expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
        });


        /**
         * Test: PlayerTurnHandler - _handleSubmittedCommand - Valid Command - #_processValidatedCommand Throws Prompt-Related Error
         * Scenario ID: 3.3.1.5
         */
        it('should log prompt-related errors from #_processValidatedCommand correctly (Scenario 3.3.1.5)', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
            const commandString = "use item";
            const promptErrorMessage = `${className}: PlayerPromptService threw an error during prompt for actor ${ACTOR_ID}: Details here`;
            const promptError = new Error(promptErrorMessage);

            mockCommandProcessor.processCommand.mockRejectedValue(promptError);

            await playerTurnHandler._handleSubmittedCommand(commandString);

            expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(actor, commandString);
            // This log is from _handleSubmittedCommand because #_processValidatedCommand re-throws prompt errors.
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `${className}: _handleSubmittedCommand: Re-thrown prompt error for ${ACTOR_ID} caught. Lower-level handler should have finalized turn. Error: ${promptErrorMessage}`
            );
            expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
        });

        /**
         * Test: PlayerTurnHandler - _handleSubmittedCommand - Valid Command - #_processValidatedCommand Throws Unexpected Error
         * Scenario ID: 3.3.1.6
         */
        describe('Scenario 3.3.1.6: #_processValidatedCommand Throws Unexpected Error', () => {
            const commandString = "do something complex";
            const unexpectedError = new Error("Completely unexpected issue!");

            beforeEach(() => {
                mockCommandProcessor.processCommand.mockRejectedValue(unexpectedError);
            });

            it('Case 1: Actor still current - should log error from #_processValidatedCommand and attempt fallback turn end', async () => {
                playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
                const handleTurnEndSpy = jest.spyOn(playerTurnHandler, '_handleTurnEnd');

                await playerTurnHandler._handleSubmittedCommand(commandString);

                expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(actor, commandString);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    `${className}: #_processValidatedCommand: Unexpected error processing command "${commandString}" for ${ACTOR_ID}: ${unexpectedError.message}`,
                    unexpectedError
                );
                expect(mockLogger.info).toHaveBeenCalledWith(
                    `${className}: #_processValidatedCommand: Attempting to end turn with failure for ${ACTOR_ID} due to unexpected error (command "${commandString}").`
                );
                expect(handleTurnEndSpy).toHaveBeenCalledWith(ACTOR_ID, unexpectedError);
                expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(ACTOR_ID, false);
                expect(mockSubscriptionManager.unsubscribeAll).toHaveBeenCalled();
            });

            it('Case 2: Actor NOT current after error - should log error from #_processValidatedCommand and skip fallback turn end', async () => {
                playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
                mockCommandProcessor.processCommand.mockImplementation(async () => {
                    playerTurnHandler._TEST_SET_CURRENT_ACTOR(null);
                    throw unexpectedError;
                });

                const handleTurnEndSpy = jest.spyOn(playerTurnHandler, '_handleTurnEnd');
                await playerTurnHandler._handleSubmittedCommand(commandString);

                expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(actor, commandString);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    `${className}: #_processValidatedCommand: Unexpected error processing command "${commandString}" for ${ACTOR_ID}: ${unexpectedError.message}`,
                    unexpectedError
                );
                expect(mockLogger.info).not.toHaveBeenCalledWith(
                    expect.stringContaining(`Attempting to end turn with failure for ${ACTOR_ID}`)
                );
                expect(handleTurnEndSpy).not.toHaveBeenCalledWith(ACTOR_ID, unexpectedError);
                expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalledWith(ACTOR_ID, false);
            });
        });
    });

    describe('_handleEmptyCommand', () => {
        let promptPlayerForActionSpy;

        beforeEach(() => {
            promptPlayerForActionSpy = jest.spyOn(playerTurnHandler, '_promptPlayerForAction').mockResolvedValue(undefined);
        });

        it('Current Actor Matches - Re-prompt Successful (Scenario 3.3.2.1)', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
            await playerTurnHandler._handleEmptyCommand(actor);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}: Received empty command from actor ${ACTOR_ID}. Re-prompting.`
            );
            expect(promptPlayerForActionSpy).toHaveBeenCalledWith(actor);
            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining(`Aborting operation for actor ${ACTOR_ID}. Turn became invalid after re-prompt attempt.`)
            );
        });

        it('Current Actor Matches - Re-prompt Fails (Error from _promptPlayerForAction) (Scenario 3.3.2.2)', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
            const promptErrorMessage = "PlayerPromptService failed during re-prompt";
            const promptError = new Error(promptErrorMessage);
            promptPlayerForActionSpy.mockRejectedValue(promptError);

            await playerTurnHandler._handleEmptyCommand(actor);

            expect(promptPlayerForActionSpy).toHaveBeenCalledWith(actor);
            await expect(promptPlayerForActionSpy(actor)).rejects.toThrow(promptErrorMessage);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                `${className}: _handleEmptyCommand: Error during re-prompt for actor ${ACTOR_ID} (caught). Turn should have been ended by _promptPlayerForAction. Error: ${promptErrorMessage}`
            );
        });

        it('Current Actor Matches - Turn Becomes Invalid After Re-prompt (Scenario 3.3.2.3)', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
            promptPlayerForActionSpy.mockImplementation(async () => {
                playerTurnHandler._TEST_SET_CURRENT_ACTOR(null);
                return undefined;
            });

            await playerTurnHandler._handleEmptyCommand(actor);

            expect(promptPlayerForActionSpy).toHaveBeenCalledWith(actor);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}.#_isTurnValidForActor: Check failed for actor ${ACTOR_ID}; no current actor.`
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}: _handleEmptyCommand: Aborting operation for actor ${ACTOR_ID}. Turn became invalid after re-prompt attempt.`
            );
        });

        it('Current Actor Mismatch (Scenario 3.3.2.4)', async () => {
            const currentActor = {id: 'player1', name: 'Current Player'};
            const differentActor = {id: 'player2', name: 'Different Player'};
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(currentActor);

            await playerTurnHandler._handleEmptyCommand(differentActor);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}: _handleEmptyCommand: Skipping re-prompt for actor ${differentActor.id}. Actor is not current (current actor: ${currentActor.id}).`
            );
            expect(promptPlayerForActionSpy).not.toHaveBeenCalled();
        });
    });
});
// --- FILE END ---