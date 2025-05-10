// src/tests/core/turns/states/awaitingPlayerInputState.test.js
// --- FILE START ---

/**
 * @fileoverview Unit tests for AwaitingPlayerInputState.
 * Verifies its interaction with ITurnContext and BaseTurnHandler,
 * ensuring it correctly handles player input, subscriptions, and state transitions.
 * Ticket: PTH-REFACTOR-001 (Decouple PlayerTurnHandler)
 * Related: PTH-REFACTOR-002 (Refactor Core Turn States to Utilize ITurnContext Exclusively)
 */

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';

// Module to be tested
import {AwaitingPlayerInputState} from '../../../../core/turns/states/awaitingPlayerInputState.js';

// Dependencies to be mocked or spied upon
import {ProcessingCommandState} from '../../../../core/turns/states/processingCommandState.js';
import {TurnIdleState} from '../../../../core/turns/states/turnIdleState.js';
import {TurnEndingState} from '../../../../core/turns/states/turnEndingState.js'; // For verifying transition types in some error paths
import {AbstractTurnState} from '../../../../core/turns/states/abstractTurnState.js';

// --- Mocks & Test Utilities ---

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    createChild: jest.fn(() => mockLogger),
};

const createMockActor = (id = 'test-actor-awaiting') => ({
    id: id,
    name: `MockAwaitingActor-${id}`,
    // Add any other actor properties your system might use if ITurnContext.getActor() returns more
});

const mockPlayerPromptService = {
    prompt: jest.fn().mockResolvedValue(undefined),
};

const mockUnsubscribeCommandInputFn = jest.fn();
const mockSubscriptionManager = {
    subscribeToCommandInput: jest.fn().mockReturnValue(mockUnsubscribeCommandInputFn),
    // Add other methods if AwaitingPlayerInputState uses them, though it primarily uses subscribeToCommandInput
    subscribeToTurnEnded: jest.fn().mockReturnValue(jest.fn()), // For completeness of a typical sub manager
    unsubscribeAll: jest.fn(),
};

const createMockTurnContext = (actor, loggerInstance = mockLogger) => {
    const mockContext = {
        getActor: jest.fn().mockReturnValue(actor),
        getLogger: jest.fn().mockReturnValue(loggerInstance),
        getPlayerPromptService: jest.fn().mockReturnValue(mockPlayerPromptService),
        getSubscriptionManager: jest.fn().mockReturnValue(mockSubscriptionManager),
        requestTransition: jest.fn().mockResolvedValue(undefined),
        endTurn: jest.fn(),
        // Add other ITurnContext methods as needed, with default mocks
        getGame: jest.fn(),
        getCommandProcessor: jest.fn(),
        getCommandOutcomeInterpreter: jest.fn(),
        getSafeEventDispatcher: jest.fn(),
        getTurnEndPort: jest.fn(),
        isAwaitingExternalEvent: jest.fn().mockReturnValue(false),
        setAwaitingExternalEvent: jest.fn(),
    };
    return mockContext;
};

const createMockBaseTurnHandler = (loggerInstance = mockLogger) => {
    const handlerMock = {
        // _logger: loggerInstance, // AbstractTurnState doesn't directly access _logger from handler
        getLogger: jest.fn().mockReturnValue(loggerInstance), // Fallback logger
        getTurnContext: jest.fn().mockReturnValue(null), // To be configured per test
        _transitionToState: jest.fn().mockResolvedValue(undefined), // Underlying transition
        _resetTurnStateAndResources: jest.fn(),
        getCurrentActor: jest.fn().mockReturnValue(null), // For AbstractTurnState's _getTurnContext fallback logging
        // Mock other BaseTurnHandler methods if they are ever called directly (should be rare)
    };
    return handlerMock;
};

// --- Test Suite ---
describe('AwaitingPlayerInputState', () => {
    let mockHandler;
    let awaitingPlayerInputState;
    let testActor;
    let mockTestTurnContext;

    let superEnterSpy;
    let superExitSpy;
    let superDestroySpy;
    let superHandleTurnEndedEventSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        testActor = createMockActor('player1');
        mockHandler = createMockBaseTurnHandler(mockLogger);
        mockTestTurnContext = createMockTurnContext(testActor, mockLogger);

        // Setup mockHandler to return the mockTestTurnContext by default
        mockHandler.getTurnContext.mockReturnValue(mockTestTurnContext);
        mockHandler.getCurrentActor.mockReturnValue(testActor); // Consistent with context

        awaitingPlayerInputState = new AwaitingPlayerInputState(mockHandler);

        // Spy on AbstractTurnState methods to verify they are called
        // and to allow overriding their implementation for specific tests if needed.
        superEnterSpy = jest.spyOn(AbstractTurnState.prototype, 'enterState');
        superExitSpy = jest.spyOn(AbstractTurnState.prototype, 'exitState');
        superDestroySpy = jest.spyOn(AbstractTurnState.prototype, 'destroy');
        superHandleTurnEndedEventSpy = jest.spyOn(AbstractTurnState.prototype, 'handleTurnEndedEvent');
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restores original implementations of spied methods
    });

    test('constructor should correctly store the handler and call super', () => {
        expect(awaitingPlayerInputState._handler).toBe(mockHandler);
        // Verification of super(handler) is implicit in _handler being set.
        // If AbstractTurnState constructor had side effects, those could be checked.
    });

    test('getStateName should return "AwaitingPlayerInputState"', () => {
        expect(awaitingPlayerInputState.getStateName()).toBe('AwaitingPlayerInputState');
    });

    describe('enterState', () => {
        test('should successfully subscribe to command input and prompt player', async () => {
            await awaitingPlayerInputState.enterState(mockHandler, null);

            expect(superEnterSpy).toHaveBeenCalledWith(mockHandler, null);
            expect(mockTestTurnContext.getLogger).toHaveBeenCalled();
            expect(mockTestTurnContext.getActor).toHaveBeenCalled();
            expect(mockTestTurnContext.getSubscriptionManager).toHaveBeenCalled();
            expect(mockSubscriptionManager.subscribeToCommandInput).toHaveBeenCalledTimes(1);
            expect(typeof mockSubscriptionManager.subscribeToCommandInput.mock.calls[0][0]).toBe('function'); // Callback
            // REMOVED: expect(awaitingPlayerInputState['_unsubscribeFromCommandInputFn']).toBe(mockUnsubscribeCommandInputFn);
            // We cannot directly test private field storage. Its correct usage is tested in exitState/destroy.
            expect(mockTestTurnContext.getPlayerPromptService).toHaveBeenCalled();
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(testActor, "Your command?");
            expect(mockLogger.debug).toHaveBeenCalledWith(`AwaitingPlayerInputState: Subscribed to command input for actor ${testActor.id}.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`AwaitingPlayerInputState: Player ${testActor.id} prompted for input.`);
        });

        test('should end turn if ITurnContext is not available', async () => {
            mockHandler.getTurnContext.mockReturnValue(null); // Simulate missing context
            // Provide a logger on the handler for the initial error message
            const handlerLogger = {...mockLogger, error: jest.fn()};
            mockHandler.getLogger.mockReturnValue(handlerLogger);


            await awaitingPlayerInputState.enterState(mockHandler, null);

            expect(handlerLogger.error).toHaveBeenCalledWith('AwaitingPlayerInputState: Critical - ITurnContext not available on entry. Transitioning to Idle.');
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(`critical-entry-no-context-${awaitingPlayerInputState.getStateName()}`);
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled(); // endTurn is on context, which is null here
        });

        test('should end turn if actor is not found in ITurnContext', async () => {
            mockTestTurnContext.getActor.mockReturnValue(null); // Simulate missing actor

            await awaitingPlayerInputState.enterState(mockHandler, null);

            expect(mockLogger.error).toHaveBeenCalledWith(`AwaitingPlayerInputState: Critical - Actor not found in ITurnContext on entry. Ending turn.`);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe('AwaitingPlayerInputState: Actor not found in ITurnContext on entry.');
        });

        test('should end turn if subscriptionManager throws', async () => {
            const subError = new Error('Subscription manager failed');
            mockTestTurnContext.getSubscriptionManager.mockImplementationOnce(() => {
                throw subError;
            });

            await awaitingPlayerInputState.enterState(mockHandler, null);
            const expectedOverallErrorMessage = `AwaitingPlayerInputState: Failed to subscribe or prompt player ${testActor.id}. Details: ${subError.message}`;
            expect(mockLogger.error).toHaveBeenCalledWith(`AwaitingPlayerInputState: Failed to subscribe or prompt player ${testActor.id}.`, subError);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedOverallErrorMessage);
        });

        test('should end turn if playerPromptService throws', async () => {
            const promptError = new Error('Prompt service failed');
            mockTestTurnContext.getPlayerPromptService.mockImplementationOnce(() => {
                throw promptError;
            });

            await awaitingPlayerInputState.enterState(mockHandler, null);
            const expectedOverallErrorMessage = `AwaitingPlayerInputState: Failed to subscribe or prompt player ${testActor.id}. Details: ${promptError.message}`;
            expect(mockLogger.error).toHaveBeenCalledWith(`AwaitingPlayerInputState: Failed to subscribe or prompt player ${testActor.id}.`, promptError);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedOverallErrorMessage);
        });

        test('should end turn if prompter.prompt() throws', async () => {
            const promptMethodError = new Error('Prompt method failed');
            mockPlayerPromptService.prompt.mockRejectedValueOnce(promptMethodError);

            await awaitingPlayerInputState.enterState(mockHandler, null);

            const expectedOverallErrorMessage = `AwaitingPlayerInputState: Failed to subscribe or prompt player ${testActor.id}. Details: ${promptMethodError.message}`;
            expect(mockLogger.error).toHaveBeenCalledWith(`AwaitingPlayerInputState: Failed to subscribe or prompt player ${testActor.id}.`, promptMethodError);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedOverallErrorMessage);
        });
    });

    describe('exitState', () => {
        test('should call unsubscribe function if it exists', async () => {
            // Simulate enterState to set up the unsubscribe function
            await awaitingPlayerInputState.enterState(mockHandler, null);
            // Verifying that subscribeToCommandInput was called (which returns mockUnsubscribeCommandInputFn)
            // implies that #unsubscribeFromCommandInputFn was set.

            await awaitingPlayerInputState.exitState(mockHandler, null);

            expect(mockUnsubscribeCommandInputFn).toHaveBeenCalledTimes(1);
            // REMOVED: expect(awaitingPlayerInputState['_unsubscribeFromCommandInputFn']).toBeNull();
            // Private field, its reset is an implementation detail supporting the mockUnsubscribe being called.
            expect(superExitSpy).toHaveBeenCalledWith(mockHandler, null);
        });

        test('should handle error during unsubscription and log it', async () => {
            await awaitingPlayerInputState.enterState(mockHandler, null);
            const unSubError = new Error('Unsubscribe failed');
            mockUnsubscribeCommandInputFn.mockImplementationOnce(() => {
                throw unSubError;
            });

            await awaitingPlayerInputState.exitState(mockHandler, null);

            expect(mockLogger.error).toHaveBeenCalledWith(`AwaitingPlayerInputState: Error during command input unsubscription: ${unSubError.message}`, unSubError);
            // REMOVED: expect(awaitingPlayerInputState['_unsubscribeFromCommandInputFn']).toBeNull();
        });

        test('should not warn if unsubscribe function is null when exiting to a terminal state', async () => {
            // #unsubscribeFromCommandInputFn is null by default. Don't call enterState.
            const mockIdleState = new TurnIdleState(mockHandler);
            await awaitingPlayerInputState.exitState(mockHandler, mockIdleState);
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('No unsubscribe function stored'));
        });

        test('should warn if unsubscribe function is null and context actor exists when exiting to non-terminal state', async () => {
            // #unsubscribeFromCommandInputFn is null by default. Don't call enterState.
            const mockProcessingState = new ProcessingCommandState(mockHandler, "cmd"); // Non-terminal

            await awaitingPlayerInputState.exitState(mockHandler, mockProcessingState);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: No unsubscribe function stored or already cleared upon exit to ${mockProcessingState.getStateName()}`));
        });
    });

    describe('handleSubmittedCommand', () => {
        let commandCallback;

        beforeEach(async () => {
            // Enter state to capture the command callback
            await awaitingPlayerInputState.enterState(mockHandler, null);
            expect(mockSubscriptionManager.subscribeToCommandInput).toHaveBeenCalled();
            commandCallback = mockSubscriptionManager.subscribeToCommandInput.mock.calls[0][0];

            // Clear mocks that might have been called during enterState for cleaner assertions in this suite
            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            mockTestTurnContext.requestTransition.mockClear();
            mockPlayerPromptService.prompt.mockClear(); // Clear prompt from enterState
        });

        test('should transition to ProcessingCommandState with valid command', async () => {
            const command = "test command";
            await commandCallback(command); // Simulate player submitting command

            expect(mockLogger.info).toHaveBeenCalledWith(`AwaitingPlayerInputState: Received command "${command}" for actor ${testActor.id}.`);
            expect(mockTestTurnContext.requestTransition).toHaveBeenCalledWith(ProcessingCommandState, [command]);
        });

        test('should re-prompt if command is empty', async () => {
            const command = "";
            await commandCallback(command);

            expect(mockLogger.debug).toHaveBeenCalledWith(`AwaitingPlayerInputState: Empty command received for ${testActor.id}. Re-prompting.`);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(testActor, "Your command? (Previous was empty)");
            expect(mockTestTurnContext.requestTransition).not.toHaveBeenCalled();
        });

        test('should re-prompt if command is whitespace only', async () => {
            const command = "   ";
            await commandCallback(command);

            expect(mockLogger.debug).toHaveBeenCalledWith(`AwaitingPlayerInputState: Empty command received for ${testActor.id}. Re-prompting.`);
            expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(testActor, "Your command? (Previous was empty)");
            expect(mockTestTurnContext.requestTransition).not.toHaveBeenCalled();
        });

        test('should end turn with error if actor in subscription mismatches context actor', async () => {
            // The 'actor' passed to handleSubmittedCommand (actorEntityFromSubscription)
            // is the one captured during `enterState`. We test what happens if the context's actor changes.
            const differentContextActor = createMockActor('different-context-actor');
            mockTestTurnContext.getActor.mockReturnValue(differentContextActor); // Context actor has changed

            // commandCallback was captured with 'testActor' from the initial enterState.
            // So, actorEntityFromSubscription inside handleSubmittedCommand will be 'testActor'.
            await commandCallback("some command");

            expect(mockLogger.error).toHaveBeenCalledWith(`AwaitingPlayerInputState: Command received for actor ${testActor.id}, but current context actor is ${differentContextActor.id}. This indicates a potential subscription mismatch or stale closure. Ending turn.`);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(`Command actor mismatch: expected ${differentContextActor.id}, got ${testActor.id} from subscription.`);
        });


        test('should transition to Idle if ITurnContext is missing', async () => {
            mockHandler.getTurnContext.mockReturnValue(null); // Simulate missing context
            const handlerLogger = {...mockLogger, error: jest.fn()};
            mockHandler.getLogger.mockReturnValue(handlerLogger);


            await commandCallback("any command");

            expect(handlerLogger.error).toHaveBeenCalledWith('AwaitingPlayerInputState: handleSubmittedCommand called but no ITurnContext. Command: "any command". Attempting to Idle.');
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
        });

        test('should end turn if actor is missing in ITurnContext', async () => {
            mockTestTurnContext.getActor.mockReturnValue(null);
            await commandCallback("any command");

            expect(mockLogger.error).toHaveBeenCalledWith('AwaitingPlayerInputState: Command received ("any command") but no actor in current ITurnContext. Ending turn.');
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe('AwaitingPlayerInputState: No actor in ITurnContext during command submission.');
        });


        test('should end turn if re-prompt fails', async () => {
            const promptError = new Error("Re-prompt failed");
            mockPlayerPromptService.prompt.mockRejectedValueOnce(promptError);
            await commandCallback(""); // Empty command to trigger re-prompt

            const expectedOverallErrorMessage = `AwaitingPlayerInputState: Failed to re-prompt ${testActor.id} after empty command. Details: ${promptError.message}`;
            expect(mockLogger.error).toHaveBeenCalledWith(`AwaitingPlayerInputState: Failed to re-prompt ${testActor.id} after empty command.`, promptError);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedOverallErrorMessage);
        });

        test('should end turn if transition to ProcessingCommandState fails', async () => {
            const transitionError = new Error("Transition failed");
            mockTestTurnContext.requestTransition.mockRejectedValueOnce(transitionError);
            await commandCallback("valid command");

            const expectedOverallErrorMessage = `AwaitingPlayerInputState: Failed to transition to ProcessingCommandState for ${testActor.id}. Cmd: "valid command". Details: ${transitionError.message}`;
            expect(mockLogger.error).toHaveBeenCalledWith(`AwaitingPlayerInputState: Failed to transition to ProcessingCommandState for ${testActor.id}. Cmd: "valid command".`, transitionError);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedOverallErrorMessage);
        });
    });

    describe('handleTurnEndedEvent', () => {
        let eventPayloadForCurrentActor;
        let eventPayloadForOtherActor;
        let eventPayloadWithError;

        beforeEach(() => {
            // Ensure testActor is defined from the outer beforeEach
            eventPayloadForCurrentActor = {entityId: testActor.id, event: 'TURN_ENDED_SOMEHOW', error: null};
            eventPayloadForOtherActor = {entityId: 'other-player', event: 'TURN_ENDED_SOMEHOW', error: null};
            eventPayloadWithError = {
                entityId: testActor.id,
                event: 'TURN_ENDED_WITH_ERROR',
                error: new Error("External Error")
            };
        });

        test('should end turn via ITurnContext if event is for current actor (no error)', async () => {
            await awaitingPlayerInputState.handleTurnEndedEvent(mockHandler, eventPayloadForCurrentActor);
            expect(mockLogger.info).toHaveBeenCalledWith(`AwaitingPlayerInputState: core:turn_ended event received for current actor ${testActor.id}. Ending turn via ITurnContext.`);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(null);
        });

        test('should end turn via ITurnContext if event is for current actor (with error)', async () => {
            await awaitingPlayerInputState.handleTurnEndedEvent(mockHandler, eventPayloadWithError);
            expect(mockLogger.info).toHaveBeenCalledWith(`AwaitingPlayerInputState: core:turn_ended event received for current actor ${testActor.id}. Ending turn via ITurnContext.`);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(eventPayloadWithError.error);
        });

        test('should call super.handleTurnEndedEvent if event is not for current actor', async () => {
            await awaitingPlayerInputState.handleTurnEndedEvent(mockHandler, eventPayloadForOtherActor);
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
            expect(superHandleTurnEndedEventSpy).toHaveBeenCalledWith(mockHandler, eventPayloadForOtherActor);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`core:turn_ended event for entity ${eventPayloadForOtherActor.entityId}`));
        });

        test('should call super.handleTurnEndedEvent if ITurnContext is missing', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            const handlerLogger = {...mockLogger, warn: jest.fn()};
            mockHandler.getLogger.mockReturnValue(handlerLogger);

            await awaitingPlayerInputState.handleTurnEndedEvent(mockHandler, eventPayloadForCurrentActor);

            expect(handlerLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: handleTurnEndedEvent received but no ITurnContext active. Payload for: ${eventPayloadForCurrentActor.entityId}`));
            expect(superHandleTurnEndedEventSpy).toHaveBeenCalledWith(mockHandler, eventPayloadForCurrentActor);
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
        });

        test('should call super.handleTurnEndedEvent if actor in context is null', async () => {
            mockTestTurnContext.getActor.mockReturnValue(null); // Actor is null
            await awaitingPlayerInputState.handleTurnEndedEvent(mockHandler, eventPayloadForCurrentActor); // Payload is for testActor.id

            // Corrected expectation: currentActor?.id will be undefined
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`core:turn_ended event for entity ${eventPayloadForCurrentActor.entityId} (payload error: ${eventPayloadForCurrentActor.error}) ignored or not for current actor undefined.`));
            expect(superHandleTurnEndedEventSpy).toHaveBeenCalledWith(mockHandler, eventPayloadForCurrentActor);
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
        });
    });

    describe('destroy', () => {
        test('should unsubscribe, end turn via context, and call super.destroy if subscribed and context exists', async () => {
            await awaitingPlayerInputState.enterState(mockHandler, null); // To subscribe

            await awaitingPlayerInputState.destroy(mockHandler);

            expect(mockLogger.info).toHaveBeenCalledWith(`AwaitingPlayerInputState: Handler destroyed while awaiting input for ${testActor.id}.`);
            expect(mockUnsubscribeCommandInputFn).toHaveBeenCalledTimes(1); // Called during destroy
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(`Turn handler destroyed while actor ${testActor.id} was in AwaitingPlayerInputState.`);
            expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
        });

        test('should not attempt unsubscription if not subscribed, but still end turn and call super.destroy if context exists', async () => {
            // State is new, enterState not called, so no subscription
            await awaitingPlayerInputState.destroy(mockHandler);

            expect(mockLogger.info).toHaveBeenCalledWith(`AwaitingPlayerInputState: Handler destroyed while awaiting input for ${testActor.id}.`);
            expect(mockUnsubscribeCommandInputFn).not.toHaveBeenCalled();
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
        });

        test('should log warning and not end turn via context if context is missing, then call super.destroy', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            const handlerLogger = {...mockLogger, warn: jest.fn(), info: jest.fn()};
            mockHandler.getLogger.mockReturnValue(handlerLogger);


            await awaitingPlayerInputState.destroy(mockHandler);

            expect(handlerLogger.info).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: Handler destroyed while awaiting input for N/A_at_destroy.`));
            expect(handlerLogger.warn).toHaveBeenCalledWith('AwaitingPlayerInputState: Handler destroyed, but no active ITurnContext for actor N/A_at_destroy. No specific turn to end via context.');
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
            expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
        });

        test('should handle error during manual unsubscription in destroy', async () => {
            await awaitingPlayerInputState.enterState(mockHandler, null); // Subscribe
            const unSubError = new Error("Destroy unsubscribe failed");
            mockUnsubscribeCommandInputFn.mockImplementationOnce(() => {
                throw unSubError;
            });

            await awaitingPlayerInputState.destroy(mockHandler);

            expect(mockLogger.error).toHaveBeenCalledWith(`AwaitingPlayerInputState (destroy): Error during manual unsubscription for ${testActor.id}: ${unSubError.message}`, unSubError);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalled(); // Still attempts to end turn
            expect(superDestroySpy).toHaveBeenCalled();
        });
    });

    // Test for methods that should not be applicable and rely on AbstractTurnState's default erroring behavior
    describe('Inapplicable AbstractTurnState Methods', () => {
        const inapplicableMethods = [
            {name: 'startTurn', args: [mockHandler, testActor]},
            {name: 'processCommandResult', args: [mockHandler, testActor, {}, "cmd"]},
            {name: 'handleDirective', args: [mockHandler, testActor, "DIR", {}]},
        ];

        inapplicableMethods.forEach(methodInfo => {
            test(`${methodInfo.name} should call super, which throws by default`, async () => {
                // Spy on the specific super method to confirm it's called before it throws
                const superMethodSpy = jest.spyOn(AbstractTurnState.prototype, methodInfo.name)
                    .mockImplementationOnce(async () => {
                        throw new Error(`Mocked super.${methodInfo.name} called and threw`);
                    });
                await expect(awaitingPlayerInputState[methodInfo.name](...methodInfo.args))
                    .rejects
                    .toThrow(`Mocked super.${methodInfo.name} called and threw`);
                expect(superMethodSpy).toHaveBeenCalledWith(...methodInfo.args);
                superMethodSpy.mockRestore();
            });
        });
    });
});

// --- FILE END ---