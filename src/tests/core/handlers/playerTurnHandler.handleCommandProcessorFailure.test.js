// src/tests/core/handlers/playerTurnHandler.handleCommandProcessorFailure.test.js
// --- FILE START ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import TurnDirective from '../../../core/constants/turnDirectives.js';

describe('PlayerTurnHandler - _handleCommandProcessorFailure', () => {
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

    // Spies for strategy methods & other relevant methods
    let spyExecuteRepromptStrategy;
    let spyExecuteEndTurnFailureStrategy;
    // let spyIsTurnValidForActor; // Removed direct spy on private method
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

        process.env.NODE_ENV = 'test'; // Enable test-only methods

        // Spy on strategy methods and _handleTurnEnd
        spyExecuteRepromptStrategy = jest.spyOn(playerTurnHandler, '_executeRepromptStrategy').mockResolvedValue(undefined);
        spyExecuteEndTurnFailureStrategy = jest.spyOn(playerTurnHandler, '_executeEndTurnFailureStrategy').mockResolvedValue(undefined);
        spyHandleTurnEnd = jest.spyOn(playerTurnHandler, '_handleTurnEnd').mockResolvedValue(undefined);

        // We will no longer spy on #_isTurnValidForActor directly.
        // Instead, we'll control its inputs (e.g., #currentActor) to test its effects.
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        if (playerTurnHandler && playerTurnHandler._TEST_GET_CURRENT_ACTOR() !== undefined && !playerTurnHandler['#isDestroyed']) { // Check if #isDestroyed might be more complex
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(null);
        }
        delete process.env.NODE_ENV;
    });

    /**
     * Test: PlayerTurnHandler - _handleCommandProcessorFailure - cmdProcResult.turnEnded is true
     * Scenario ID: 3.3.5.1
     */
    describe('Scenario 3.3.5.1: cmdProcResult.turnEnded is true', () => {
        it('should bypass interpreter and call _handleTurnEnd if cmdProcResult.turnEnded is true', async () => {
            // Given
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor); // Essential for the _handleTurnEnd call condition
            const commandString = "failed command";
            const failureError = new Error("Explicit turn end error from processor.");
            const cmdProcResult = {success: false, error: failureError, turnEnded: true};

            // When
            await playerTurnHandler._handleCommandProcessorFailure(actor, cmdProcResult, commandString);

            // Then
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}: CommandProcessor FAILED for "${commandString}" by ${ACTOR_ID}. Error: Error: ${failureError.message}.`
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                `${className}: CommandProcessor indicated turn has ended for ${ACTOR_ID} post-failure. Bypassing interpreter.`
            );
            expect(spyHandleTurnEnd).toHaveBeenCalledTimes(1);
            expect(spyHandleTurnEnd).toHaveBeenCalledWith(actor.id, failureError);

            expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled();

            expect(spyExecuteRepromptStrategy).not.toHaveBeenCalled();
            expect(spyExecuteEndTurnFailureStrategy).not.toHaveBeenCalled();
        });
    });

    /**
     * Test: PlayerTurnHandler - _handleCommandProcessorFailure - turnEnded is false - Turn Becomes Invalid Before Interpreter
     * Scenario ID: 3.3.5.2
     */
    describe('Scenario 3.3.5.2: turnEnded false, turn becomes invalid before interpreter', () => {
        it('should abort if turn becomes invalid before consulting interpreter', async () => {
            // Given
            const commandString = "another failed command";
            const failureError = new Error("Some failure.");
            const cmdProcResult = {success: false, error: failureError, turnEnded: false};

            // Make #_isTurnValidForActor return false for the first check
            // by setting currentActor to something that doesn't match actor.id or null
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(null); // or { id: 'otherPlayer' }

            // When
            await playerTurnHandler._handleCommandProcessorFailure(actor, cmdProcResult, commandString);

            // Then
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}: CommandProcessor FAILED for "${commandString}" by ${ACTOR_ID}. Error: Error: ${failureError.message}.`
            );

            // Log from #_isTurnValidForActor due to currentActor being null
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}.#_isTurnValidForActor: Check failed for actor ${ACTOR_ID}; no current actor.`
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}: _handleCommandProcessorFailure: Turn for ${ACTOR_ID} became invalid before CommandOutcomeInterpreter. Aborting further handler processing.`
            );

            expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled();
            expect(spyExecuteRepromptStrategy).not.toHaveBeenCalled();
            expect(spyExecuteEndTurnFailureStrategy).not.toHaveBeenCalled();
            expect(spyHandleTurnEnd).not.toHaveBeenCalled();
        });
    });

    /**
     * Test: PlayerTurnHandler - _handleCommandProcessorFailure - turnEnded is false - Turn Becomes Invalid After Interpreter
     * Scenario ID: 3.3.5.3
     */
    describe('Scenario 3.3.5.3: turnEnded false, turn becomes invalid after interpreter', () => {
        it('should abort if turn becomes invalid after interpreter call', async () => {
            // Given
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor); // Turn is valid for the first check
            const commandString = "complex failure";
            const failureError = new Error("Interpreter will be called.");
            const cmdProcResult = {success: false, error: failureError, turnEnded: false};

            mockCommandOutcomeInterpreter.interpret.mockImplementationOnce(async () => {
                // Simulate turn becoming invalid *during* or *after* interpreter's logic
                playerTurnHandler._TEST_SET_CURRENT_ACTOR(null);
                return TurnDirective.RE_PROMPT;
            });

            // When
            await playerTurnHandler._handleCommandProcessorFailure(actor, cmdProcResult, commandString);

            // Then
            // First call to #_isTurnValidForActor (before interpreter) passes because currentActor is set.
            // No direct log for this pass unless it's a debug log not being checked.

            expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledTimes(1);
            expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(cmdProcResult, actor.id);

            // Second call to #_isTurnValidForActor (after interpreter) fails.
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}.#_isTurnValidForActor: Check failed for actor ${ACTOR_ID}; no current actor.` // Log from the check itself
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}: _handleCommandProcessorFailure: Turn for ${ACTOR_ID} became invalid after CommandOutcomeInterpreter. Aborting further handler processing.`
            );

            expect(spyExecuteRepromptStrategy).not.toHaveBeenCalled();
            expect(spyExecuteEndTurnFailureStrategy).not.toHaveBeenCalled();
            expect(spyHandleTurnEnd).not.toHaveBeenCalled();
        });
    });

    /**
     * Test: PlayerTurnHandler - _handleCommandProcessorFailure - Interpreter Returns RE_PROMPT
     * Scenario ID: 3.3.5.4
     */
    describe('Scenario 3.3.5.4: Interpreter Returns RE_PROMPT', () => {
        it('should call _executeRepromptStrategy if interpreter returns RE_PROMPT', async () => {
            // Given
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor); // Ensure turn is valid throughout
            const commandString = "minor error, try again";
            const failureError = new Error("Minor issue.");
            const cmdProcResult = {success: false, error: failureError, turnEnded: false};

            mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.RE_PROMPT);

            // When
            await playerTurnHandler._handleCommandProcessorFailure(actor, cmdProcResult, commandString);

            // Then
            // #_isTurnValidForActor should pass both times implicitly (no warning logs from it)
            expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledTimes(1);
            expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(cmdProcResult, actor.id);

            expect(mockLogger.info).toHaveBeenCalledWith(
                `${className}: Directive for CommandProcessor failure for ${ACTOR_ID}: '${TurnDirective.RE_PROMPT}'.`
            );

            expect(spyExecuteRepromptStrategy).toHaveBeenCalledTimes(1);
            expect(spyExecuteRepromptStrategy).toHaveBeenCalledWith(actor);

            expect(spyExecuteEndTurnFailureStrategy).not.toHaveBeenCalled();
        });
    });

    /**
     * Test: PlayerTurnHandler - _handleCommandProcessorFailure - Interpreter Returns END_TURN_FAILURE (or Default)
     * Scenario ID: 3.3.5.5
     */
    describe('Scenario 3.3.5.5: Interpreter Returns END_TURN_FAILURE or Default', () => {
        const commandString = "fatal error in command";
        const processorError = new Error("Processor says major fail.");
        const cmdProcResultBase = {success: false, error: processorError, turnEnded: false};

        beforeEach(() => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor); // Ensure turn is valid
        });

        // Test Case 1: Explicit END_TURN_FAILURE
        it('Case 1: should call _executeEndTurnFailureStrategy for END_TURN_FAILURE directive', async () => {
            const directiveToReturn = TurnDirective.END_TURN_FAILURE;
            mockCommandOutcomeInterpreter.interpret.mockResolvedValue(directiveToReturn);
            const cmdProcResult = {...cmdProcResultBase};

            await playerTurnHandler._handleCommandProcessorFailure(actor, cmdProcResult, commandString);

            // #_isTurnValidForActor should pass both times implicitly
            expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(cmdProcResult, actor.id);
            expect(mockLogger.info).toHaveBeenCalledWith(
                `${className}: Directive for CommandProcessor failure for ${ACTOR_ID}: '${directiveToReturn}'.`
            );
            expect(spyExecuteEndTurnFailureStrategy).toHaveBeenCalledTimes(1);
            expect(spyExecuteEndTurnFailureStrategy).toHaveBeenCalledWith(
                actor,
                processorError,
                directiveToReturn,
                commandString
            );
            expect(spyExecuteRepromptStrategy).not.toHaveBeenCalled();
        });

        // Test Case 2: Default/Other Directive (e.g., null, undefined, or unknown string)
        const otherDirectives = [
            {value: "SOME_OTHER_DIRECTIVE_NOT_RE_PROMPT", description: "an unknown string directive"},
            {value: null, description: "null directive"},
            {value: undefined, description: "undefined directive"}
        ];

        otherDirectives.forEach(({value: directiveToReturn, description}) => {
            it(`Case 2: should call _executeEndTurnFailureStrategy for ${description} (default case)`, async () => {
                mockCommandOutcomeInterpreter.interpret.mockResolvedValue(directiveToReturn);
                const cmdProcResult = {...cmdProcResultBase};

                await playerTurnHandler._handleCommandProcessorFailure(actor, cmdProcResult, commandString);

                // #_isTurnValidForActor should pass both times implicitly
                expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(cmdProcResult, actor.id);
                expect(mockLogger.info).toHaveBeenCalledWith(
                    `${className}: Directive for CommandProcessor failure for ${ACTOR_ID}: '${directiveToReturn}'.`
                );
                expect(spyExecuteEndTurnFailureStrategy).toHaveBeenCalledTimes(1);
                expect(spyExecuteEndTurnFailureStrategy).toHaveBeenCalledWith(
                    actor,
                    processorError,
                    directiveToReturn,
                    commandString
                );
                expect(spyExecuteRepromptStrategy).not.toHaveBeenCalled();

                // Clear mocks for next iteration
                mockCommandOutcomeInterpreter.interpret.mockClear();
                mockLogger.info.mockClear();
                spyExecuteEndTurnFailureStrategy.mockClear();
            });
        });

        it('Case 2 (Error as String): should correctly pass string error to _executeEndTurnFailureStrategy', async () => {
            const directiveToReturn = TurnDirective.END_TURN_FAILURE;
            const stringError = "Processor says major fail as string.";
            const cmdProcWithStringError = {success: false, error: stringError, turnEnded: false};

            mockCommandOutcomeInterpreter.interpret.mockResolvedValue(directiveToReturn);

            await playerTurnHandler._handleCommandProcessorFailure(actor, cmdProcWithStringError, commandString);

            expect(spyExecuteEndTurnFailureStrategy).toHaveBeenCalledWith(
                actor,
                stringError,
                directiveToReturn,
                commandString
            );
        });
    });
});
// --- FILE END ---