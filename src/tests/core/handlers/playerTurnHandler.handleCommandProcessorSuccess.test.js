// src/tests/core/handlers/playerTurnHandler.handleCommandProcessorSuccess.test.js
// --- FILE START ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import TurnDirective from '../../../core/constants/turnDirectives.js';
import {TURN_ENDED_ID} from '../../../core/constants/eventIds.js'; // Though not directly used, good for context

describe('PlayerTurnHandler - _handleCommandProcessorSuccess', () => {
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
    let cmdProcResult;
    let commandString;
    let className;

    // Spies for strategy methods
    let spyExecuteRepromptStrategy;
    let spyExecuteEndTurnSuccessStrategy;
    let spyExecuteEndTurnFailureStrategy;
    let spyExecuteWaitForTurnEndEventStrategy;
    // We will not spy on #_isTurnValidForActor directly, but control its inputs
    let spyHandleTurnEnd;


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
        cmdProcResult = {success: true, message: "Action successful."};
        commandString = "do action";

        process.env.NODE_ENV = 'test'; // Enable test-only methods

        // Spy on strategy methods
        spyExecuteRepromptStrategy = jest.spyOn(playerTurnHandler, '_executeRepromptStrategy').mockResolvedValue(undefined);
        spyExecuteEndTurnSuccessStrategy = jest.spyOn(playerTurnHandler, '_executeEndTurnSuccessStrategy').mockResolvedValue(undefined);
        spyExecuteEndTurnFailureStrategy = jest.spyOn(playerTurnHandler, '_executeEndTurnFailureStrategy').mockResolvedValue(undefined);
        spyExecuteWaitForTurnEndEventStrategy = jest.spyOn(playerTurnHandler, '_executeWaitForTurnEndEventStrategy').mockResolvedValue(undefined);
        spyHandleTurnEnd = jest.spyOn(playerTurnHandler, '_handleTurnEnd').mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        if (playerTurnHandler && !playerTurnHandler['#isDestroyed']) { // Accessing private field for check is indicative, might need getter in real app
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(null);
        }
        delete process.env.NODE_ENV;
    });

    /**
     * Test: PlayerTurnHandler - _handleCommandProcessorSuccess - Turn Becomes Invalid Before Interpreter
     * Scenario ID: 3.3.4.1
     */
    describe('Scenario 3.3.4.1: Turn Becomes Invalid Before Interpreter', () => {
        it('should abort if turn is invalid before consulting CommandOutcomeInterpreter', async () => {
            // Given: Simulate #_isTurnValidForActor returning false
            // One way is to set current actor to null.
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(null);

            await playerTurnHandler._handleCommandProcessorSuccess(actor, cmdProcResult, commandString);

            // Then
            // Check the log from #_isTurnValidForActor itself
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}.#_isTurnValidForActor: Check failed for actor ${actor.id}; no current actor.`
            );
            // Check the log from _handleCommandProcessorSuccess
            expect(mockLogger.info).toHaveBeenCalledWith(
                `${className}: _handleCommandProcessorSuccess: Turn for ${actor.id} concluded by external rules after command success. Aborting further handler processing.`
            );
            expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled();
            expect(spyExecuteRepromptStrategy).not.toHaveBeenCalled();
            expect(spyExecuteEndTurnSuccessStrategy).not.toHaveBeenCalled();
            expect(spyExecuteEndTurnFailureStrategy).not.toHaveBeenCalled();
            expect(spyExecuteWaitForTurnEndEventStrategy).not.toHaveBeenCalled();
        });
    });

    /**
     * Test: PlayerTurnHandler - _handleCommandProcessorSuccess - No CommandOutcomeInterpreter (Nullified)
     * Scenario ID: 3.3.4.2
     */
    describe('Scenario 3.3.4.2: No CommandOutcomeInterpreter (Nullified)', () => {
        it('should default to wait strategy if CommandOutcomeInterpreter is null', async () => {
            // Given
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor); // Ensures initial validity
            playerTurnHandler._TEST_SET_COMMAND_OUTCOME_INTERPRETER_TO_NULL();

            await playerTurnHandler._handleCommandProcessorSuccess(actor, cmdProcResult, commandString);

            // Then
            // #_isTurnValidForActor should pass. We don't check its call directly without a spy, but infer by flow.
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}: _handleCommandProcessorSuccess: No CommandOutcomeInterpreter for actor ${actor.id}. Assuming default: wait for turn end event.`
            );
            expect(spyExecuteWaitForTurnEndEventStrategy).toHaveBeenCalledWith(actor);
            expect(spyExecuteWaitForTurnEndEventStrategy).toHaveBeenCalledTimes(1);

            expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled();
            expect(spyExecuteRepromptStrategy).not.toHaveBeenCalled();
            expect(spyExecuteEndTurnSuccessStrategy).not.toHaveBeenCalled();
            expect(spyExecuteEndTurnFailureStrategy).not.toHaveBeenCalled();
        });
    });

    /**
     * Test: PlayerTurnHandler - _handleCommandProcessorSuccess - Turn Becomes Invalid After Interpreter
     * Scenario ID: 3.3.4.3
     */
    describe('Scenario 3.3.4.3: Turn Becomes Invalid After Interpreter', () => {
        it('should abort if turn becomes invalid after interpreter directive but before strategy execution', async () => {
            // Given
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor); // Initially valid

            mockCommandOutcomeInterpreter.interpret.mockImplementation(async () => {
                // Simulate turn becoming invalid (e.g., actor becomes null)
                // *during* the interpreter's async operation or just before it returns.
                playerTurnHandler._TEST_SET_CURRENT_ACTOR(null);
                return TurnDirective.RE_PROMPT;
            });

            await playerTurnHandler._handleCommandProcessorSuccess(actor, cmdProcResult, commandString);

            // Then
            expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(cmdProcResult, actor.id);
            expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledTimes(1);

            // Check the log from the *second* call to #_isTurnValidForActor
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}.#_isTurnValidForActor: Check failed for actor ${actor.id}; no current actor.`
            );
            // Check the log from _handleCommandProcessorSuccess
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}: _handleCommandProcessorSuccess: Turn for ${actor.id} became invalid after CommandOutcomeInterpreter. Aborting further handler processing.`
            );

            expect(spyExecuteRepromptStrategy).not.toHaveBeenCalled();
            expect(spyExecuteEndTurnSuccessStrategy).not.toHaveBeenCalled();
            expect(spyExecuteEndTurnFailureStrategy).not.toHaveBeenCalled();
            expect(spyExecuteWaitForTurnEndEventStrategy).not.toHaveBeenCalled();
        });
    });

    /**
     * Test: PlayerTurnHandler - _handleCommandProcessorSuccess - Interpreter Returns RE_PROMPT
     * Scenario ID: 3.3.4.4
     */
    describe('Scenario 3.3.4.4: Interpreter Returns RE_PROMPT', () => {
        it('should execute re-prompt strategy when interpreter returns RE_PROMPT', async () => {
            // Given
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor); // Valid throughout
            mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.RE_PROMPT);
            cmdProcResult = {success: true, message: "Almost done."};
            commandString = "use item partial";

            await playerTurnHandler._handleCommandProcessorSuccess(actor, cmdProcResult, commandString);

            // Then
            expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(cmdProcResult, actor.id);
            expect(mockLogger.info).toHaveBeenCalledWith(
                `${className}: CommandOutcomeInterpreter for ${actor.id} returned directive: '${TurnDirective.RE_PROMPT}'.`
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                `${className}: Directive RE_PROMPT for ${actor.id}. Executing re-prompt strategy.`
            );
            expect(spyExecuteRepromptStrategy).toHaveBeenCalledWith(actor);
            expect(spyExecuteRepromptStrategy).toHaveBeenCalledTimes(1);

            expect(spyExecuteEndTurnSuccessStrategy).not.toHaveBeenCalled();
            expect(spyExecuteEndTurnFailureStrategy).not.toHaveBeenCalled();
            expect(spyExecuteWaitForTurnEndEventStrategy).not.toHaveBeenCalled();
        });
    });

    /**
     * Test: PlayerTurnHandler - _handleCommandProcessorSuccess - Interpreter Returns END_TURN_SUCCESS
     * Scenario ID: 3.3.4.5
     */
    describe('Scenario 3.3.4.5: Interpreter Returns END_TURN_SUCCESS', () => {
        it('should execute end turn success strategy when interpreter returns END_TURN_SUCCESS', async () => {
            // Given
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor); // Valid throughout
            mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.END_TURN_SUCCESS);
            cmdProcResult = {success: true, message: "Task complete."};
            commandString = "finish quest";

            await playerTurnHandler._handleCommandProcessorSuccess(actor, cmdProcResult, commandString);

            // Then
            expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(cmdProcResult, actor.id);
            expect(spyExecuteEndTurnSuccessStrategy).toHaveBeenCalledWith(actor);
            expect(spyExecuteEndTurnSuccessStrategy).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith(
                `${className}: CommandOutcomeInterpreter for ${actor.id} returned directive: '${TurnDirective.END_TURN_SUCCESS}'.`
            );

            expect(spyExecuteRepromptStrategy).not.toHaveBeenCalled();
            expect(spyExecuteEndTurnFailureStrategy).not.toHaveBeenCalled();
            expect(spyExecuteWaitForTurnEndEventStrategy).not.toHaveBeenCalled();
        });
    });

    /**
     * Test: PlayerTurnHandler - _handleCommandProcessorSuccess - Interpreter Returns END_TURN_FAILURE
     * Scenario ID: 3.3.4.6
     */
    describe('Scenario 3.3.4.6: Interpreter Returns END_TURN_FAILURE', () => {
        it('should execute end turn failure strategy when interpreter returns END_TURN_FAILURE', async () => {
            // Given
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor); // Valid throughout
            mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.END_TURN_FAILURE);
            cmdProcResult = {success: true, message: "It worked, but something else went wrong."};
            commandString = "complex operation";
            const expectedErrorForStrategy = new Error("Turn ended by interpreter directive END_TURN_FAILURE after successful command processing.");

            await playerTurnHandler._handleCommandProcessorSuccess(actor, cmdProcResult, commandString);

            // Then
            expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(cmdProcResult, actor.id);
            expect(mockLogger.info).toHaveBeenCalledWith(
                `${className}: CommandOutcomeInterpreter for ${actor.id} returned directive: '${TurnDirective.END_TURN_FAILURE}'.`
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                `${className}: Directive END_TURN_FAILURE for ${actor.id} (post-success). Executing end turn failure strategy.`
            );

            expect(spyExecuteEndTurnFailureStrategy).toHaveBeenCalledTimes(1);
            expect(spyExecuteEndTurnFailureStrategy).toHaveBeenCalledWith(
                actor,
                expect.objectContaining({message: expectedErrorForStrategy.message}),
                TurnDirective.END_TURN_FAILURE,
                commandString
            );
            const errorArg = spyExecuteEndTurnFailureStrategy.mock.calls[0][1];
            expect(errorArg).toBeInstanceOf(Error);

            expect(spyExecuteRepromptStrategy).not.toHaveBeenCalled();
            expect(spyExecuteEndTurnSuccessStrategy).not.toHaveBeenCalled();
            expect(spyExecuteWaitForTurnEndEventStrategy).not.toHaveBeenCalled();
        });
    });

    /**
     * Test: PlayerTurnHandler - _handleCommandProcessorSuccess - Interpreter Returns null/undefined (Default to Wait)
     * Scenario ID: 3.3.4.7
     */
    describe('Scenario 3.3.4.7: Interpreter Returns null/undefined (Default to Wait)', () => {
        const testCases = [
            {directive: null, description: "null"},
            {directive: undefined, description: "undefined"}
        ];

        testCases.forEach(({directive, description}) => {
            it(`should execute wait strategy when interpreter returns ${description}`, async () => {
                // Given
                playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor); // Valid throughout
                mockCommandOutcomeInterpreter.interpret.mockResolvedValue(directive);
                cmdProcResult = {success: true, message: "Action initiated, waiting for results."};
                commandString = "long action";

                await playerTurnHandler._handleCommandProcessorSuccess(actor, cmdProcResult, commandString);

                // Then
                expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(cmdProcResult, actor.id);
                expect(mockLogger.info).toHaveBeenCalledWith(
                    `${className}: CommandOutcomeInterpreter for ${actor.id} returned directive: '${directive}'.`
                );
                expect(spyExecuteWaitForTurnEndEventStrategy).toHaveBeenCalledWith(actor);
                expect(spyExecuteWaitForTurnEndEventStrategy).toHaveBeenCalledTimes(1);

                expect(spyExecuteRepromptStrategy).not.toHaveBeenCalled();
                expect(spyExecuteEndTurnSuccessStrategy).not.toHaveBeenCalled();
                expect(spyExecuteEndTurnFailureStrategy).not.toHaveBeenCalled();

                spyExecuteWaitForTurnEndEventStrategy.mockClear();
                mockCommandOutcomeInterpreter.interpret.mockClear();
                mockLogger.info.mockClear();
            });
        });
    });

    /**
     * Test: PlayerTurnHandler - _handleCommandProcessorSuccess - Interpreter Returns Unknown/Invalid Directive
     * Scenario ID: 3.3.4.8
     */
    describe('Scenario 3.3.4.8: Interpreter Returns Unknown/Invalid Directive', () => {
        it('should dispatch system error and end turn with failure for unknown directive', async () => {
            // Given
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor); // Actor is current
            const invalidDirective = "TOTALLY_INVALID_DIRECTIVE";
            mockCommandOutcomeInterpreter.interpret.mockResolvedValue(invalidDirective);
            cmdProcResult = {success: true, message: "Action processed."};
            commandString = "corrupted action";
            const expectedErrorMessage = `Received unexpected directive: ${invalidDirective}`;

            await playerTurnHandler._handleCommandProcessorSuccess(actor, cmdProcResult, commandString);

            // Then
            expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(cmdProcResult, actor.id);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `${className}: _handleCommandProcessorSuccess: Unknown directive '${invalidDirective}' for actor ${actor.id}. Forcing turn failure.`
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith('core:system_error_occurred', expect.objectContaining({
                eventName: 'core:system_error_occurred',
                message: `Handler received unknown directive '${invalidDirective}' for actor ${actor.id}.`,
                type: 'error',
                details: expectedErrorMessage
            }));

            expect(spyHandleTurnEnd).toHaveBeenCalledTimes(1);
            expect(spyHandleTurnEnd).toHaveBeenCalledWith(actor.id, expect.objectContaining({message: expectedErrorMessage}));
            const errorArgToHandleTurnEnd = spyHandleTurnEnd.mock.calls[0][1];
            expect(errorArgToHandleTurnEnd).toBeInstanceOf(Error);

            expect(spyExecuteRepromptStrategy).not.toHaveBeenCalled();
            expect(spyExecuteEndTurnSuccessStrategy).not.toHaveBeenCalled();
            expect(spyExecuteEndTurnFailureStrategy).not.toHaveBeenCalled();
            expect(spyExecuteWaitForTurnEndEventStrategy).not.toHaveBeenCalled();
        });
    });
});
// --- FILE END ---