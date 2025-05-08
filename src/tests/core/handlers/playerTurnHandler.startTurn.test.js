// __tests__/PlayerTurnHandler.startTurn.test.js
// --- FILE START ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js'; // Adjust path as necessary
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
// import TurnDirective from '../../../core/constants/turnDirectives.js'; // Not directly used in these tests

describe('PlayerTurnHandler - startTurn', () => {
    let mockLogger;
    let mockCommandProcessor;
    let mockTurnEndPort;
    let mockPlayerPromptService;
    let mockCommandOutcomeInterpreter;
    let mockSafeEventDispatcher;
    let mockSubscriptionManager;
    let validDependencies;
    let playerTurnHandler;

    const actor = {id: 'player1', name: 'Player One'};
    const actor1 = {id: 'player1', name: 'Player One'}; // Kept for consistency if other tests use it
    const actor2 = {id: 'player2', name: 'Player Two'};

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
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        jest.clearAllMocks();
        playerTurnHandler._TEST_SET_CURRENT_ACTOR(null); // Clean up current actor for next test
        // Removed unreliable private field access: playerTurnHandler['#isDestroyed'] = false;
        // Removed unreliable private field access: playerTurnHandler['#isTerminatingNormally'] = false;
    });

    /**
     * Test: PlayerTurnHandler - startTurn - Successful Turn Initiation (Happy Path)
     * Scenario ID: 3.2.1
     */
    describe('Scenario 3.2.1: Successful Turn Initiation (Happy Path)', () => {
        it('should successfully orchestrate initiating a player\'s turn', async () => {
            mockSubscriptionManager.subscribeToCommandInput.mockReturnValue(true);

            expect(playerTurnHandler._TEST_GET_CURRENT_ACTOR()).toBeNull();

            await expect(playerTurnHandler.startTurn(actor)).resolves.toBeUndefined();

            expect(mockLogger.info).toHaveBeenCalledWith('PlayerTurnHandler: Starting turn initiation for actor player1.');
            // Private fields #isDestroyed and #isTerminatingNormally are set to false by startTurn.
            // Direct assertion removed due to unreliability of access method. Their correct behavior is implied by successful execution.

            // Implicit verification of #clearTurnEndWaitingMechanisms being called at the start of startTurn.
            // Its effects (e.g. mockSubscriptionManager.unsubscribeFromTurnEnded) depend on prior state of #isAwaitingTurnEndEvent.
            // For a new turn, this usually means flags are reset and no unsubscription if not previously awaiting.

            expect(playerTurnHandler._TEST_GET_CURRENT_ACTOR()).toBe(actor);
            expect(mockSubscriptionManager.unsubscribeFromCommandInput).toHaveBeenCalledTimes(1); // Safeguard call
            expect(mockSubscriptionManager.subscribeToCommandInput).toHaveBeenCalledTimes(1);
            expect(mockSubscriptionManager.subscribeToCommandInput).toHaveBeenCalledWith(expect.any(Function));

            const boundHandleSubmittedCommand = mockSubscriptionManager.subscribeToCommandInput.mock.calls[0][0];
            expect(boundHandleSubmittedCommand.name).toBe('bound _handleSubmittedCommand');

            expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(actor);
            expect(mockLogger.debug).toHaveBeenCalledWith('PlayerTurnHandler: Initial prompt sequence initiated for player1.');
            expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
        });
    });

    /**
     * Test: PlayerTurnHandler - startTurn - Attempt with Invalid Actor
     * Scenario ID: 3.2.2
     */
    describe('Scenario 3.2.2: Attempt with Invalid Actor', () => {
        const invalidActorTestCases = [
            {
                description: "actor is null",
                actor: null,
                expectedLogId: 'UNKNOWN' // actor?.id results in 'UNKNOWN'
            },
            {
                description: "actor is undefined",
                actor: undefined,
                expectedLogId: 'UNKNOWN' // actor?.id results in 'UNKNOWN'
            },
            {
                description: "actor is an object without an id property",
                actor: {name: 'player1'},
                expectedLogId: 'UNKNOWN' // actor?.id results in 'UNKNOWN'
            },
            {
                description: "actor is an object with an id that is not a string",
                actor: {id: 123},
                // actor?.id will be 123 for the initial log, then validation fails.
                expectedLogId: '123'
            },
            {
                description: "actor is an object with an id that is an empty string",
                actor: {id: "  "}, // Assuming trim() will make it empty
                expectedLogId: '  ' // actor.id used before trim in initial log
            },
        ];

        invalidActorTestCases.forEach(({description, actor: invalidActor, expectedLogId}) => {
            it(`should throw error and log when ${description}`, async () => {
                // Ensure subscribeToCommandInput is not a factor for *these specific* validation errors
                // Default mock behavior (returns undefined) is fine as we shouldn't reach it.

                await expect(playerTurnHandler.startTurn(invalidActor))
                    .rejects
                    .toThrow('PlayerTurnHandler: Actor must be a valid entity.'); // Expected error from SUT validation

                expect(mockLogger.info).toHaveBeenCalledWith(`PlayerTurnHandler: Starting turn initiation for actor ${expectedLogId}.`);
                expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler: Attempted to start turn for an invalid or null actor.');
                expect(mockSubscriptionManager.subscribeToCommandInput).not.toHaveBeenCalled();
                expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled();
                expect(playerTurnHandler._TEST_GET_CURRENT_ACTOR()).toBeNull();
            });
        });
    });

    /**
     * Test: PlayerTurnHandler - startTurn - Attempt While Another Turn is in Progress
     * Scenario ID: 3.2.3
     */
    describe('Scenario 3.2.3: Attempt While Another Turn is in Progress', () => {
        it('should throw an error if called when a turn is already in progress', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor1);

            const expectedErrorMessage = `PlayerTurnHandler: Attempted to start a new turn for ${actor2.id} while turn for ${actor1.id} is already in progress.`;

            await expect(playerTurnHandler.startTurn(actor2))
                .rejects
                .toThrow(expectedErrorMessage);

            expect(mockLogger.info).toHaveBeenCalledWith(`PlayerTurnHandler: Starting turn initiation for actor ${actor2.id}.`);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessage);
            expect(mockSubscriptionManager.subscribeToCommandInput).not.toHaveBeenCalled();
            expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled();
            expect(playerTurnHandler._TEST_GET_CURRENT_ACTOR()).toBe(actor1);
        });
    });

    /**
     * Test: PlayerTurnHandler - startTurn - Failure to Subscribe to Command Input
     * Scenario ID: 3.2.4
     */
    describe('Scenario 3.2.4: Failure to Subscribe to Command Input', () => {
        it('should handle error and reject if command input subscription fails', async () => {
            mockSubscriptionManager.subscribeToCommandInput.mockReturnValue(false);

            const expectedErrorMsg = 'Failed to subscribe to command input via SubscriptionLifecycleManager.';

            await expect(playerTurnHandler.startTurn(actor))
                .rejects
                .toThrow(expectedErrorMsg);

            expect(mockLogger.info).toHaveBeenCalledWith(`PlayerTurnHandler: Starting turn initiation for actor ${actor.id}.`);
            // Current actor is set before the try block, but reset during error handling.
            // The assertion `expect(playerTurnHandler._TEST_GET_CURRENT_ACTOR()).toBe(actor);` was removed as it's checked too late.

            expect(mockSubscriptionManager.subscribeToCommandInput).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `PlayerTurnHandler: Critical error during turn initiation for ${actor.id}: ${expectedErrorMsg}`,
                expect.any(Error)
            );

            expect(mockLogger.info).toHaveBeenCalledWith(`PlayerTurnHandler: Error during turn initiation for ${actor.id} (not from PlayerPromptService). Proceeding to handle turn end.`);
            expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
            expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(actor.id, false);
            expect(mockSubscriptionManager.unsubscribeAll).toHaveBeenCalledTimes(1);

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`PlayerTurnHandler._resetTurnStateAndResources: Resetting internal state flags for actor context '${actor.id}'`));
            expect(playerTurnHandler._TEST_GET_CURRENT_ACTOR()).toBeNull(); // Correctly null after cleanup

            expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled();
        });
    });

    /**
     * Test: PlayerTurnHandler - startTurn - Error During Initial Player Prompt (from PlayerPromptService)
     * Scenario ID: 3.2.5
     */
    describe('Scenario 3.2.5: Error During Initial Player Prompt', () => {
        it('should handle and re-throw error from PlayerPromptService.prompt', async () => {
            const promptError = new Error("PlayerPromptService failed!");
            // The SUT prefixes the error message if it's not already prefixed.
            const expectedPrefixedErrorMsg = `PlayerTurnHandler: PlayerPromptService threw an error during prompt for actor ${actor.id}: ${promptError.message}`;

            mockSubscriptionManager.subscribeToCommandInput.mockReturnValue(true);
            mockPlayerPromptService.prompt.mockRejectedValue(promptError);

            await expect(playerTurnHandler.startTurn(actor))
                .rejects
                .toThrow(expectedPrefixedErrorMsg);

            expect(mockSubscriptionManager.subscribeToCommandInput).toHaveBeenCalledTimes(1);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(actor);

            expect(mockLogger.error).toHaveBeenCalledWith(
                expectedPrefixedErrorMsg,
                promptError // The original error is passed as the second argument to logger.error
            );

            expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
            // The error passed to _handleTurnEnd (and thus to notifyTurnEnded indirectly via the 'isSuccess' flag)
            // is the modified error with the prefix.
            expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(actor.id, false);

            expect(mockSubscriptionManager.unsubscribeAll).toHaveBeenCalledTimes(1);

            expect(mockLogger.error).toHaveBeenCalledWith(
                `PlayerTurnHandler: Critical error during turn initiation for ${actor.id}: ${expectedPrefixedErrorMsg}`,
                expect.objectContaining({message: expectedPrefixedErrorMsg})
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `PlayerTurnHandler: Error during turn initiation for ${actor.id} (from PlayerPromptService). _handleTurnEnd already called by _promptPlayerForAction.`
            );

            expect(playerTurnHandler._TEST_GET_CURRENT_ACTOR()).toBeNull();
        });
    });

    /**
     * Test: PlayerTurnHandler - startTurn - Critical Error (Not from PlayerPromptService, e.g., unexpected)
     * Scenario ID: 3.2.6
     */
    describe('Scenario 3.2.6: Critical Error (Not from PlayerPromptService)', () => {
        it('should handle unexpected errors during initiation correctly', async () => {
            const unexpectedError = new Error("Unexpected initiation failure!");
            mockSubscriptionManager.subscribeToCommandInput.mockReturnValue(true);

            const promptSpy = jest.spyOn(playerTurnHandler, '_promptPlayerForAction').mockRejectedValue(unexpectedError);

            await expect(playerTurnHandler.startTurn(actor))
                .rejects
                .toThrow(unexpectedError.message);

            expect(mockSubscriptionManager.subscribeToCommandInput).toHaveBeenCalledTimes(1);
            expect(playerTurnHandler._promptPlayerForAction).toHaveBeenCalledWith(actor);

            expect(mockLogger.error).toHaveBeenCalledWith(
                `PlayerTurnHandler: Critical error during turn initiation for ${actor.id}: ${unexpectedError.message}`,
                unexpectedError
            );

            expect(mockLogger.info).toHaveBeenCalledWith(
                `PlayerTurnHandler: Error during turn initiation for ${actor.id} (not from PlayerPromptService). Proceeding to handle turn end.`
            );
            expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
            expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(actor.id, false);

            expect(mockSubscriptionManager.unsubscribeAll).toHaveBeenCalledTimes(1);
            expect(playerTurnHandler._TEST_GET_CURRENT_ACTOR()).toBeNull();

            promptSpy.mockRestore();
        });
    });

    /**
     * Test: PlayerTurnHandler - startTurn - _handleTurnEnd Path When Current Actor Changes Mid-Error
     * Scenario ID: 3.2.7
     */
    describe('Scenario 3.2.7: Edge Case - Current Actor Changes Mid-Error', () => {
        const originalActor = {id: 'player1Original', name: 'Original Player'};
        const differentActor = {id: 'player2Different', name: 'Different Player'};

        beforeEach(() => {
            mockSubscriptionManager.subscribeToCommandInput.mockReturnValue(false); // This will cause initError
        });

        describe('Sub-Case 2: #currentActor is null when catch block check occurs', () => {
            it('should log warning, not call _handleTurnEnd from catch, but still reset resources', async () => {
                const resetSpy = jest.spyOn(playerTurnHandler, '_resetTurnStateAndResources');
                const handleTurnEndSpy = jest.spyOn(playerTurnHandler, '_handleTurnEnd');

                // This mock implementation simulates #currentActor changing *before* the conditional check in startTurn's catch block.
                const originalInfoMock = mockLogger.info;
                mockLogger.info = jest.fn((message, ...args) => {
                    originalInfoMock(message, ...args); // Call original mock if needed for other logs
                    if (typeof message === 'string' && message.startsWith('PlayerTurnHandler: Error during turn initiation for') && message.includes('(not from PlayerPromptService)')) {
                        playerTurnHandler._TEST_SET_CURRENT_ACTOR(null);
                    }
                });

                await expect(playerTurnHandler.startTurn(originalActor)).rejects.toThrow('Failed to subscribe to command input via SubscriptionLifecycleManager.');

                expect(mockLogger.warn).toHaveBeenCalledWith(
                    `PlayerTurnHandler: In startTurn catch for ${originalActor.id}, current actor is none. Turn end not invoked by startTurn. Performing minimal cleanup.`
                );

                expect(handleTurnEndSpy).not.toHaveBeenCalled();
                expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();

                expect(resetSpy).toHaveBeenCalledWith(originalActor.id || 'startTurn_initError_noCurrentActor');
                expect(mockSubscriptionManager.unsubscribeAll).toHaveBeenCalledTimes(1); // Called by the direct _resetTurnStateAndResources

                resetSpy.mockRestore();
                handleTurnEndSpy.mockRestore();
                mockLogger.info = originalInfoMock; // Restore original mock
            });
        });

        describe('Sub-Case 3: #currentActor is differentActor when catch block check occurs', () => {
            it('should log warning, not call _handleTurnEnd for originalActor from catch, but still reset resources for originalActor context', async () => {
                const resetSpy = jest.spyOn(playerTurnHandler, '_resetTurnStateAndResources');
                const handleTurnEndSpy = jest.spyOn(playerTurnHandler, '_handleTurnEnd');

                const originalInfoMock = mockLogger.info;
                mockLogger.info = jest.fn((message, ...args) => {
                    originalInfoMock(message, ...args);
                    if (typeof message === 'string' && message.startsWith('PlayerTurnHandler: Error during turn initiation for') && message.includes('(not from PlayerPromptService)')) {
                        playerTurnHandler._TEST_SET_CURRENT_ACTOR(differentActor);
                    }
                });

                await expect(playerTurnHandler.startTurn(originalActor)).rejects.toThrow('Failed to subscribe to command input via SubscriptionLifecycleManager.');

                expect(mockLogger.warn).toHaveBeenCalledWith(
                    `PlayerTurnHandler: In startTurn catch for ${originalActor.id}, current actor is ${differentActor.id}. Turn end not invoked by startTurn. Performing minimal cleanup.`
                );

                expect(handleTurnEndSpy).not.toHaveBeenCalled();
                expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();

                expect(resetSpy).toHaveBeenCalledWith(originalActor.id || 'startTurn_initError_noCurrentActor');
                expect(mockSubscriptionManager.unsubscribeAll).toHaveBeenCalledTimes(1);

                resetSpy.mockRestore();
                handleTurnEndSpy.mockRestore();
                mockLogger.info = originalInfoMock; // Restore original mock
            });
        });
    });
});
// --- FILE END ---