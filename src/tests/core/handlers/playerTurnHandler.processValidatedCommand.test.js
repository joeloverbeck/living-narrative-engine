// src/tests/core/handlers/playerTurnHandler.processValidatedCommand.test.js
// --- FILE START ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import TurnDirective from '../../../core/constants/turnDirectives.js';
import {TURN_ENDED_ID} from '../../../core/constants/eventIds.js';

describe('PlayerTurnHandler - #_processValidatedCommand', () => {
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
    // const DEFAULT_COMMAND_STRING = "test command"; // Defined but not used

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
            subscribeToCommandInput: jest.fn().mockReturnValue(true),
            unsubscribeFromCommandInput: jest.fn(),
            subscribeToTurnEnded: jest.fn().mockReturnValue(true),
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
        playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        playerTurnHandler._TEST_SET_CURRENT_ACTOR(null);
        delete process.env.NODE_ENV;
    });

    /**
     * Test: PlayerTurnHandler - #_processValidatedCommand - Assertion Fails (#_assertTurnActiveFor)
     * Scenario ID: 3.3.3.1
     * This test verifies the behavior when an error, potentially looking like an assertion failure,
     * is thrown from commandProcessor.processCommand. The test output indicated that the specific
     * 'if (error.message.includes('Assertion Failed - Turn is not active'))' check in
     * #_processValidatedCommand's catch block is bypassed (evaluates to false),
     * leading to the generic error handling path within that same catch block.
     */
    describe('Scenario 3.3.3.1: Handling of error from processCommand resembling an Assertion Failure', () => {
        it('should take the generic error path in #_processValidatedCommand, log details, and call _handleTurnEnd', async () => {
            const commandString = "valid command";
            const specificAssertionErrorMessage = `${className}: Assertion Failed - Turn not active. Command: "${commandString}"`;
            const specificAssertionError = new Error(specificAssertionErrorMessage);

            mockCommandProcessor.processCommand.mockRejectedValue(specificAssertionError);

            const handleSuccessSpy = jest.spyOn(playerTurnHandler, '_handleCommandProcessorSuccess');
            const handleFailureSpy = jest.spyOn(playerTurnHandler, '_handleCommandProcessorFailure');
            const handleTurnEndSpy = jest.spyOn(playerTurnHandler, '_handleTurnEnd');

            await playerTurnHandler._handleSubmittedCommand(commandString);

            // Verify #_processValidatedCommand's generic error handling logs
            expect(mockLogger.error).toHaveBeenCalledWith(
                `${className}: #_processValidatedCommand: Unexpected error processing command "${commandString}" for ${ACTOR_ID}: ${specificAssertionError.message}`,
                specificAssertionError
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith('core:system_error_occurred',
                expect.objectContaining({
                    message: `Internal error in #_processValidatedCommand for ${ACTOR_ID}, command "${commandString}".`,
                    details: specificAssertionError.message
                })
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                `${className}: #_processValidatedCommand: Attempting to end turn with failure for ${ACTOR_ID} due to unexpected error (command "${commandString}").`
            );

            // Verify _handleTurnEnd IS called by #_processValidatedCommand's generic error path
            expect(handleTurnEndSpy).toHaveBeenCalledTimes(1);
            expect(handleTurnEndSpy).toHaveBeenCalledWith(ACTOR_ID, specificAssertionError);

            // As a consequence, mockLogger.warn from _handleTurnEnd would be called due to the error.
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}: Turn for ${ACTOR_ID} ended with failure. Reason: ${specificAssertionError.message}`
            );

            // Ensure the specific "Assertion Failed" log from #_processValidatedCommand's specific catch was NOT called
            // (as the test failure indicates this path was not taken)
            const specificAssertionLogMsg = `${className}: #_processValidatedCommand: Turn state assertion failed for command "${commandString}" by ${ACTOR_ID}. Error: ${specificAssertionError.message}`;
            const wasSpecificLogCalled = mockLogger.warn.mock.calls.some(call => call[0] === specificAssertionLogMsg);
            expect(wasSpecificLogCalled).toBe(false);


            // Verify that _handleSubmittedCommand did NOT log an assertion failure itself from its own catch block
            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining(`${className}: _handleSubmittedCommand: Turn state assertion failed for command`)
            );
            // And did not log an unexpected error from its own catch block (as #_processValidatedCommand handled it)
            const unexpectedErrorLogMsgFromSubmittedCmd = `${className}: _handleSubmittedCommand: Unexpected error for actor ${ACTOR_ID}`;
            const wasUnexpectedErrorLoggedBySubmittedCmd = mockLogger.error.mock.calls.some(call => call[0].startsWith(unexpectedErrorLogMsgFromSubmittedCmd));
            expect(wasUnexpectedErrorLoggedBySubmittedCmd).toBe(false);


            // Verify that command processing was attempted (it's what threw the error)
            expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(actor, commandString);

            // Further processing within #_processValidatedCommand's try block should not occur
            expect(handleSuccessSpy).not.toHaveBeenCalled();
            expect(handleFailureSpy).not.toHaveBeenCalled();
        });
    });

    /**
     * Test: PlayerTurnHandler - #_processValidatedCommand - CommandProcessor Success Path
     * Scenario ID: 3.3.3.2
     */
    describe('Scenario 3.3.3.2: CommandProcessor Success Path', () => {
        it('should correctly process a successful command', async () => {
            const commandString = "look";
            const cmdProcResult = {success: true, message: "You see a room.", turnEnded: false};
            mockCommandProcessor.processCommand.mockResolvedValue(cmdProcResult);

            const handleSuccessSpy = jest.spyOn(playerTurnHandler, '_handleCommandProcessorSuccess').mockResolvedValue(undefined);
            const handleFailureSpy = jest.spyOn(playerTurnHandler, '_handleCommandProcessorFailure');

            await playerTurnHandler._handleSubmittedCommand(commandString);

            expect(mockCommandProcessor.processCommand).toHaveBeenCalledTimes(1);
            expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(actor, commandString);
            expect(handleSuccessSpy).toHaveBeenCalledTimes(1);
            expect(handleSuccessSpy).toHaveBeenCalledWith(actor, cmdProcResult, commandString);
            expect(handleFailureSpy).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining("Unexpected error"));
        });
    });

    /**
     * Test: PlayerTurnHandler - #_processValidatedCommand - CommandProcessor Failure Path
     * Scenario ID: 3.3.3.3
     */
    describe('Scenario 3.3.3.3: CommandProcessor Failure Path', () => {
        it('should correctly process a failed command', async () => {
            const commandString = "attack goblin";
            const cmdProcResult = {success: false, error: "Goblin not found.", turnEnded: false};
            mockCommandProcessor.processCommand.mockResolvedValue(cmdProcResult);

            const handleFailureSpy = jest.spyOn(playerTurnHandler, '_handleCommandProcessorFailure').mockResolvedValue(undefined);
            const handleSuccessSpy = jest.spyOn(playerTurnHandler, '_handleCommandProcessorSuccess');

            await playerTurnHandler._handleSubmittedCommand(commandString);

            expect(mockCommandProcessor.processCommand).toHaveBeenCalledTimes(1);
            expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(actor, commandString);
            expect(handleFailureSpy).toHaveBeenCalledTimes(1);
            expect(handleFailureSpy).toHaveBeenCalledWith(actor, cmdProcResult, commandString);
            expect(handleSuccessSpy).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining("Unexpected error"));
        });
    });

    /**
     * Test: PlayerTurnHandler - #_processValidatedCommand - Turn Becomes Invalid After processCommand
     * Scenario ID: 3.3.3.4
     */
    describe('Scenario 3.3.3.4: Turn Becomes Invalid After processCommand', () => {
        it('should abort if turn becomes invalid post-command processing', async () => {
            const commandString = "use potion";
            const cmdProcResult = {success: true, message: "Healed."};

            mockCommandProcessor.processCommand.mockImplementation(async () => {
                playerTurnHandler._TEST_SET_CURRENT_ACTOR(null);
                return cmdProcResult;
            });

            const handleSuccessSpy = jest.spyOn(playerTurnHandler, '_handleCommandProcessorSuccess');
            const handleFailureSpy = jest.spyOn(playerTurnHandler, '_handleCommandProcessorFailure');

            await playerTurnHandler._handleSubmittedCommand(commandString);

            expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(actor, commandString);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}.#_isTurnValidForActor: Check failed for actor ${ACTOR_ID}; no current actor.`
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}: #_processValidatedCommand: Turn for ${ACTOR_ID} became invalid after command processing. Aborting further handler action.`
            );
            expect(handleSuccessSpy).not.toHaveBeenCalled();
            expect(handleFailureSpy).not.toHaveBeenCalled();
        });
    });

    /**
     * Test: PlayerTurnHandler - #_processValidatedCommand - commandProcessor.processCommand Throws Error
     * Scenario ID: 3.3.3.5
     */
    describe('Scenario 3.3.3.5: commandProcessor.processCommand Throws Error', () => {
        const commandString = "cast spell";
        const processingError = new Error("CommandProcessor exploded!");
        let handleTurnEndSpy;

        beforeEach(() => {
            mockCommandProcessor.processCommand.mockRejectedValue(processingError);
            handleTurnEndSpy = jest.spyOn(playerTurnHandler, '_handleTurnEnd').mockResolvedValue(undefined);
        });

        it('Sub-Case 1: Actor still current, not awaiting turn end - should handle error and end turn', async () => {
            await playerTurnHandler._handleSubmittedCommand(commandString);

            expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(actor, commandString);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `${className}: #_processValidatedCommand: Unexpected error processing command "${commandString}" for ${ACTOR_ID}: ${processingError.message}`,
                processingError
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith('core:system_error_occurred', {
                eventName: 'core:system_error_occurred',
                message: `Internal error in #_processValidatedCommand for ${ACTOR_ID}, command "${commandString}".`,
                type: 'error',
                details: processingError.message
            });
            expect(mockLogger.info).toHaveBeenCalledWith(
                `${className}: #_processValidatedCommand: Attempting to end turn with failure for ${ACTOR_ID} due to unexpected error (command "${commandString}").`
            );
            expect(handleTurnEndSpy).toHaveBeenCalledWith(ACTOR_ID, processingError);
        });

        it('Sub-Case 2: Actor still current BUT awaiting turn end event - (Falls into Sub-Case 1 behavior due to SUT logic)', async () => {
            await playerTurnHandler._handleSubmittedCommand(commandString);

            expect(mockLogger.info).toHaveBeenCalledWith(
                `${className}: #_processValidatedCommand: Attempting to end turn with failure for ${ACTOR_ID} due to unexpected error (command "${commandString}").`
            );
            expect(handleTurnEndSpy).toHaveBeenCalledWith(ACTOR_ID, processingError);
            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining(`while awaiting '${TURN_ENDED_ID}'`)
            );
        });


        it('Sub-Case 3: Actor no longer current after error - should log error, not end turn for original actor', async () => {
            mockCommandProcessor.processCommand.mockImplementation(async () => {
                playerTurnHandler._TEST_SET_CURRENT_ACTOR(null);
                throw processingError;
            });

            await playerTurnHandler._handleSubmittedCommand(commandString);

            expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(actor, commandString);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `${className}: #_processValidatedCommand: Unexpected error processing command "${commandString}" for ${ACTOR_ID}: ${processingError.message}`,
                processingError
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalledWith(
                expect.stringContaining(`Attempting to end turn with failure for ${ACTOR_ID}`)
            );
            expect(handleTurnEndSpy).not.toHaveBeenCalled();
        });
    });

    /**
     * Test: PlayerTurnHandler - #_processValidatedCommand - Catches Re-thrown Prompt Error
     * Scenario ID: 3.3.3.6
     */
    describe('Scenario 3.3.3.6: Catches Re-thrown Prompt Error', () => {
        it('should identify, log, and re-throw prompt errors from deeper calls', async () => {
            const commandString = "retry action";
            const promptErrorMsg = `${className}: PlayerPromptService threw an error during prompt for actor ${ACTOR_ID}: From re-prompt.`;
            const promptError = new Error(promptErrorMsg);

            mockCommandProcessor.processCommand.mockResolvedValue({
                success: true,
                message: "Action seemed to work...",
                turnEnded: false
            });
            mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.RE_PROMPT);
            const promptPlayerSpy = jest.spyOn(playerTurnHandler, '_promptPlayerForAction').mockRejectedValue(promptError);

            await playerTurnHandler._handleSubmittedCommand(commandString);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                `${className}: #_processValidatedCommand: Re-thrown prompt error for ${ACTOR_ID} (command "${commandString}"). Lower-level handler should have finalized. Error: ${promptError.message}`
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `${className}: _handleSubmittedCommand: Re-thrown prompt error for ${ACTOR_ID} caught. Lower-level handler should have finalized turn. Error: ${promptError.message}`
            );
            expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
            expect(mockCommandProcessor.processCommand).toHaveBeenCalled();
            expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalled();
            expect(promptPlayerSpy).toHaveBeenCalledWith(actor);
        });
    });
});
// --- FILE END ---