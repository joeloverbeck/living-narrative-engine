// src/tests/core/turns/states/awaitingExternalTurnEndState.test.js
// --- FILE START ---

/**
 * @fileoverview Unit tests for AwaitingExternalTurnEndState.
 * Verifies its exclusive use of ITurnContext for all operations,
 * including event subscription, managing awaiting status, and ending the turn.
 * Ticket: Refactor AwaitingExternalTurnEndState to Use ITurnContext
 * Parent Epic: PTH-REFACTOR-001 (Decouple PlayerTurnHandler)
 * Related Ticket: PTH-REFACTOR-002 (Refactor Core Turn States to Utilize ITurnContext Exclusively)
 */

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';

// Module to be tested
import {AwaitingExternalTurnEndState} from '../../../../core/turns/states/awaitingExternalTurnEndState.js';

// Dependencies to be mocked or spied upon
import {TurnIdleState} from '../../../../core/turns/states/turnIdleState.js';
import {AbstractTurnState}
    from "../../../../core/turns/states/abstractTurnState.js"; // For spying on super methods
import {TURN_ENDED_ID} from '../../../../core/constants/eventIds.js';

// --- Mocks & Test Utilities ---

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    createChild: jest.fn(() => mockLogger),
};

const createMockActor = (id = 'test-actor-awaiting-external') => ({
    id: id,
    name: `MockExternalEventActor-${id}`,
});

const mockUnsubscribeTurnEndedFn = jest.fn();
const mockSubscriptionManager = {
    subscribeToTurnEnded: jest.fn().mockReturnValue(mockUnsubscribeTurnEndedFn),
    subscribeToCommandInput: jest.fn().mockReturnValue(jest.fn()), // Other sub manager methods
    unsubscribeAll: jest.fn(),
};

const createMockTurnContext = (actor, loggerInstance = mockLogger) => {
    const mockContext = {
        getActor: jest.fn().mockReturnValue(actor),
        getLogger: jest.fn().mockReturnValue(loggerInstance),
        getSubscriptionManager: jest.fn().mockReturnValue(mockSubscriptionManager),
        setAwaitingExternalEvent: jest.fn(),
        isAwaitingExternalEvent: jest.fn().mockReturnValue(false), // Default to not awaiting
        endTurn: jest.fn(),
        requestTransition: jest.fn().mockResolvedValue(undefined),
        // Add other ITurnContext methods as needed, with default mocks
        getPlayerPromptService: jest.fn(),
        getGame: jest.fn(),
        getCommandProcessor: jest.fn(),
        getCommandOutcomeInterpreter: jest.fn(),
        getSafeEventDispatcher: jest.fn(),
        getTurnEndPort: jest.fn(),
    };
    return mockContext;
};

const createMockBaseTurnHandler = (loggerInstance = mockLogger) => {
    const handlerMock = {
        getLogger: jest.fn().mockReturnValue(loggerInstance),
        getTurnContext: jest.fn().mockReturnValue(null),
        _transitionToState: jest.fn().mockResolvedValue(undefined),
        _resetTurnStateAndResources: jest.fn(),
        getCurrentActor: jest.fn().mockReturnValue(null),
        _handleTurnEnd: jest.fn() // For testing fallback in handleSubmittedCommand with no context
    };
    return handlerMock;
};

// --- Test Suite ---
describe('AwaitingExternalTurnEndState', () => {
    let mockHandler;
    let awaitingExternalTurnEndState;
    let testActor;
    let mockTestTurnContext;

    // Spies for superclass methods
    let superEnterSpy;
    let superExitSpy;
    let superDestroySpy;
    let superHandleSubmittedCommandSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        testActor = createMockActor('externalEventActor1');
        mockHandler = createMockBaseTurnHandler(mockLogger);
        mockTestTurnContext = createMockTurnContext(testActor, mockLogger);

        mockHandler.getTurnContext.mockReturnValue(mockTestTurnContext);
        mockHandler.getCurrentActor.mockReturnValue(testActor); // Align handler's current actor

        awaitingExternalTurnEndState = new AwaitingExternalTurnEndState(mockHandler);

        // Spy on AbstractTurnState methods
        superEnterSpy = jest.spyOn(AbstractTurnState.prototype, 'enterState');
        superExitSpy = jest.spyOn(AbstractTurnState.prototype, 'exitState');
        superDestroySpy = jest.spyOn(AbstractTurnState.prototype, 'destroy');
        superHandleSubmittedCommandSpy = jest.spyOn(AbstractTurnState.prototype, 'handleSubmittedCommand');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('constructor should correctly store the handler and call super', () => {
        expect(awaitingExternalTurnEndState._handler).toBe(mockHandler);
        // Implicitly, super(handler) was called.
    });

    test('getStateName should return "AwaitingExternalTurnEndState"', () => {
        expect(awaitingExternalTurnEndState.getStateName()).toBe('AwaitingExternalTurnEndState');
    });

    describe('enterState', () => {
        test('should call super.enterState, set awaiting flag, and subscribe to TURN_ENDED_ID', async () => {
            await awaitingExternalTurnEndState.enterState(mockHandler, null);

            expect(superEnterSpy).toHaveBeenCalledWith(mockHandler, null);
            expect(mockTestTurnContext.getLogger).toHaveBeenCalled();
            expect(mockTestTurnContext.getActor).toHaveBeenCalled();
            expect(mockTestTurnContext.setAwaitingExternalEvent).toHaveBeenCalledWith(true, testActor.id);
            expect(mockTestTurnContext.getSubscriptionManager).toHaveBeenCalled();
            expect(mockSubscriptionManager.subscribeToTurnEnded).toHaveBeenCalledTimes(1);
            // Check that the callback passed is indeed the state's handleTurnEndedEvent method
            const actualCallback = mockSubscriptionManager.subscribeToTurnEnded.mock.calls[0][0];
            expect(actualCallback).toBeInstanceOf(Function);
            // We can't directly assert it's `this.handleTurnEndedEvent` bound, but we can test its behavior later.

            expect(mockLogger.info).toHaveBeenCalledWith(`AwaitingExternalTurnEndState: Successfully subscribed – awaiting ${TURN_ENDED_ID} for actor ${testActor.id}.`);
        });

        test('should transition to Idle if ITurnContext is not available', async () => {
            mockHandler.getTurnContext.mockReturnValue(null); // Simulate missing context
            const handlerLogger = {...mockLogger, error: jest.fn()};
            mockHandler.getLogger.mockReturnValue(handlerLogger);

            await awaitingExternalTurnEndState.enterState(mockHandler, null);

            expect(handlerLogger.error).toHaveBeenCalledWith('AwaitingExternalTurnEndState: Critical - ITurnContext not available on entry. Transitioning to Idle.');
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(`critical-entry-no-context-${awaitingExternalTurnEndState.getStateName()}`);
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
            expect(mockTestTurnContext.setAwaitingExternalEvent).not.toHaveBeenCalled();
            expect(mockSubscriptionManager.subscribeToTurnEnded).not.toHaveBeenCalled();
        });

        test('should end turn if actor is not found in ITurnContext', async () => {
            mockTestTurnContext.getActor.mockReturnValue(null); // Simulate missing actor

            await awaitingExternalTurnEndState.enterState(mockHandler, null);

            expect(mockLogger.error).toHaveBeenCalledWith(`AwaitingExternalTurnEndState: No actor in ITurnContext. Ending turn.`);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe('AwaitingExternalTurnEndState: No actor in ITurnContext on entry.');
            expect(mockTestTurnContext.setAwaitingExternalEvent).not.toHaveBeenCalled();
        });

        test('should end turn if turnCtx.setAwaitingExternalEvent throws', async () => {
            const flagError = new Error('Failed to set flag');
            mockTestTurnContext.setAwaitingExternalEvent.mockImplementationOnce(() => {
                throw flagError;
            });

            await awaitingExternalTurnEndState.enterState(mockHandler, null);

            expect(mockLogger.error).toHaveBeenCalledWith(`AwaitingExternalTurnEndState: Error during enterState setup for actor ${testActor.id}: ${flagError.message}`, flagError);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(flagError);
            expect(mockSubscriptionManager.subscribeToTurnEnded).not.toHaveBeenCalled();
        });

        test('should end turn and attempt to clear flag if subscription fails', async () => {
            const subError = new Error('Subscription failed');
            mockTestTurnContext.getSubscriptionManager().subscribeToTurnEnded.mockImplementationOnce(() => {
                throw subError;
            });
            mockTestTurnContext.isAwaitingExternalEvent.mockReturnValue(true); // Assume flag was set before error

            await awaitingExternalTurnEndState.enterState(mockHandler, null);

            expect(mockLogger.error).toHaveBeenCalledWith(`AwaitingExternalTurnEndState: Error during enterState setup for actor ${testActor.id}: ${subError.message}`, subError);
            // It will attempt to clear the flag if it was set
            expect(mockTestTurnContext.setAwaitingExternalEvent).toHaveBeenCalledWith(false, testActor.id);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(subError);
        });

        test('should log warning if subscribeToTurnEnded does not return a function', async () => {
            mockSubscriptionManager.subscribeToTurnEnded.mockReturnValueOnce(null); // Not a function

            await awaitingExternalTurnEndState.enterState(mockHandler, null);

            expect(mockLogger.warn).toHaveBeenCalledWith(`AwaitingExternalTurnEndState: subscribeToTurnEnded did not return an unsubscribe function for ${testActor.id}. This is unexpected.`);
            // State should still proceed, assuming subscription might have partially worked or sub manager is lenient
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully subscribed'));
        });
    });

    describe('exitState', () => {
        test('should unsubscribe and clear awaiting flag if set', async () => {
            // Simulate enterState to set up subscription and flag
            await awaitingExternalTurnEndState.enterState(mockHandler, null);
            mockTestTurnContext.isAwaitingExternalEvent.mockReturnValue(true); // Ensure flag is considered set

            mockUnsubscribeTurnEndedFn.mockClear(); // Clear calls from enterState if any mock setup
            mockTestTurnContext.setAwaitingExternalEvent.mockClear();

            await awaitingExternalTurnEndState.exitState(mockHandler, null);

            expect(mockUnsubscribeTurnEndedFn).toHaveBeenCalledTimes(1);
            expect(mockTestTurnContext.isAwaitingExternalEvent).toHaveBeenCalled();
            expect(mockTestTurnContext.setAwaitingExternalEvent).toHaveBeenCalledWith(false, testActor.id);
            expect(superExitSpy).toHaveBeenCalledWith(mockHandler, null);
        });

        test('should only unsubscribe if awaiting flag is not set (or cleared by event)', async () => {
            await awaitingExternalTurnEndState.enterState(mockHandler, null);
            mockTestTurnContext.isAwaitingExternalEvent.mockReturnValue(false); // Flag already cleared

            mockUnsubscribeTurnEndedFn.mockClear();
            mockTestTurnContext.setAwaitingExternalEvent.mockClear();

            await awaitingExternalTurnEndState.exitState(mockHandler, null);

            expect(mockUnsubscribeTurnEndedFn).toHaveBeenCalledTimes(1);
            expect(mockTestTurnContext.isAwaitingExternalEvent).toHaveBeenCalled();
            expect(mockTestTurnContext.setAwaitingExternalEvent).not.toHaveBeenCalledWith(false, testActor.id);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Awaiting external event flag was already false'));
        });

        test('should handle error during unsubscription gracefully', async () => {
            await awaitingExternalTurnEndState.enterState(mockHandler, null);
            const unSubError = new Error('Unsubscribe failed');
            mockUnsubscribeTurnEndedFn.mockImplementationOnce(() => {
                throw unSubError;
            });
            mockTestTurnContext.isAwaitingExternalEvent.mockReturnValue(true);

            await awaitingExternalTurnEndState.exitState(mockHandler, null);

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Error unsubscribing from ${TURN_ENDED_ID} for actor ${testActor.id}: ${unSubError.message}`));
            expect(mockTestTurnContext.setAwaitingExternalEvent).toHaveBeenCalledWith(false, testActor.id); // Still tries to clear flag
        });

        test('should handle error clearing flag gracefully', async () => {
            await awaitingExternalTurnEndState.enterState(mockHandler, null);
            const flagClearError = new Error('Flag clear failed');
            mockTestTurnContext.isAwaitingExternalEvent.mockReturnValue(true);
            mockTestTurnContext.setAwaitingExternalEvent.mockImplementationOnce(() => {
                throw flagClearError;
            });

            await awaitingExternalTurnEndState.exitState(mockHandler, null);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Failed to clear awaiting external event flag for ${testActor.id} on exit: ${flagClearError.message}`));
        });

        test('should proceed if context is null on exit, attempting unsubscription', async () => {
            await awaitingExternalTurnEndState.enterState(mockHandler, null); // Store unsubscribe
            mockHandler.getTurnContext.mockReturnValue(null); // Context disappears

            await awaitingExternalTurnEndState.exitState(mockHandler, null);
            expect(mockUnsubscribeTurnEndedFn).toHaveBeenCalledTimes(1); // Still attempts
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('ITurnContext not available on exit'));
            expect(mockTestTurnContext.setAwaitingExternalEvent).not.toHaveBeenCalled(); // Cannot call on null context
        });
    });

    describe('handleTurnEndedEvent', () => {
        let eventPayloadForCurrentActor;
        let eventPayloadForOtherActor;
        let eventPayloadWithError;
        let capturedSubscriptionCallback;

        beforeEach(async () => {
            // Enter state to capture the actual subscription callback
            await awaitingExternalTurnEndState.enterState(mockHandler, null);
            expect(mockSubscriptionManager.subscribeToTurnEnded).toHaveBeenCalledTimes(1);
            capturedSubscriptionCallback = mockSubscriptionManager.subscribeToTurnEnded.mock.calls[0][0];

            // Clear mocks that might have been called during enterState
            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.warn.mockClear();
            mockTestTurnContext.endTurn.mockClear();
            mockUnsubscribeTurnEndedFn.mockClear(); // Clear this for specific event handling tests

            eventPayloadForCurrentActor = {entityId: testActor.id, event: 'core:turn_ended', error: null};
            eventPayloadForOtherActor = {entityId: 'otherActorId', event: 'core:turn_ended', error: null};
            eventPayloadWithError = {
                entityId: testActor.id,
                event: 'core:turn_ended',
                error: new Error("External Event Error")
            };
        });

        test('should end turn via ITurnContext if event is for current actor and isAwaitingExternalEvent is true', async () => {
            mockTestTurnContext.isAwaitingExternalEvent.mockReturnValue(true);
            await capturedSubscriptionCallback(eventPayloadForCurrentActor); // Trigger event via captured callback

            expect(mockLogger.info).toHaveBeenCalledWith(`AwaitingExternalTurnEndState: Matched ${TURN_ENDED_ID} for actor ${testActor.id}. Ending turn via ITurnContext.`);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(null);
        });

        test('should end turn with error if event payload contains an error object', async () => {
            mockTestTurnContext.isAwaitingExternalEvent.mockReturnValue(true);
            await capturedSubscriptionCallback(eventPayloadWithError);

            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(eventPayloadWithError.error);
        });

        test('should end turn with a new Error if event payload error is not an Error instance', async () => {
            mockTestTurnContext.isAwaitingExternalEvent.mockReturnValue(true);
            const payloadWithStringError = {
                entityId: testActor.id,
                event: 'core:turn_ended',
                error: "Some string error"
            };
            await capturedSubscriptionCallback(payloadWithStringError);

            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe("Some string error");
        });


        test('should ignore event if it is not for the current actor', async () => {
            mockTestTurnContext.isAwaitingExternalEvent.mockReturnValue(true);
            await capturedSubscriptionCallback(eventPayloadForOtherActor);

            expect(mockLogger.debug).toHaveBeenCalledWith(`AwaitingExternalTurnEndState: ${TURN_ENDED_ID} for ${eventPayloadForOtherActor.entityId} ignored; current context actor is ${testActor.id}.`);
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
        });

        test('should ignore event and clean up subscription if isAwaitingExternalEvent is false', async () => {
            mockTestTurnContext.isAwaitingExternalEvent.mockReturnValue(false); // No longer awaiting
            await capturedSubscriptionCallback(eventPayloadForCurrentActor);

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`ITurnContext is no longer awaiting an external event`));
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
            expect(mockUnsubscribeTurnEndedFn).toHaveBeenCalledTimes(1); // Cleanup called
        });

        test('should log warning and clean up if context is missing when event arrives', async () => {
            mockHandler.getTurnContext.mockReturnValue(null); // Context gone
            const handlerLogger = {...mockLogger, warn: jest.fn(), debug: jest.fn()};
            mockHandler.getLogger.mockReturnValue(handlerLogger);


            await capturedSubscriptionCallback(eventPayloadForCurrentActor);

            expect(handlerLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`AwaitingExternalTurnEndState: ${TURN_ENDED_ID} received, but no active ITurnContext.`));
            expect(mockUnsubscribeTurnEndedFn).toHaveBeenCalledTimes(1); // Cleanup
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled(); // Cannot call on null context
        });

        test('should log warning and clean up if actor in context is missing when event arrives', async () => {
            mockTestTurnContext.getActor.mockReturnValue(null); // Actor gone from context

            await capturedSubscriptionCallback(eventPayloadForCurrentActor);

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`but no actor in current ITurnContext. Cleaning up subscription and ignoring.`));
            expect(mockUnsubscribeTurnEndedFn).toHaveBeenCalledTimes(1); // Cleanup
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
        });
    });

    describe('handleSubmittedCommand', () => {
        test('should log an error and end the turn via ITurnContext', async () => {
            const commandString = "unexpected command";
            const submitter = createMockActor("submitter");
            await awaitingExternalTurnEndState.handleSubmittedCommand(mockHandler, commandString, submitter);

            const expectedErrorMessage = `AwaitingExternalTurnEndState: Unexpected command "${commandString}" from entity ${submitter.id} received while awaiting external turn end for context actor ${testActor.id}.`;
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessage);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedErrorMessage);
        });

        test('should use handler._handleTurnEnd if context is missing', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            const handlerLogger = {...mockLogger, error: jest.fn()};
            mockHandler.getLogger.mockReturnValue(handlerLogger);

            const commandString = "cmd_no_ctx";
            const submitter = createMockActor("submitter_no_ctx");
            const expectedErrorMessage = `AwaitingExternalTurnEndState: Unexpected command "${commandString}" from ${submitter.id} received, but no ITurnContext. Ending turn for an unknown actor if possible.`;


            await awaitingExternalTurnEndState.handleSubmittedCommand(mockHandler, commandString, submitter);

            expect(handlerLogger.error).toHaveBeenCalledWith(expectedErrorMessage);
            expect(mockHandler._handleTurnEnd).toHaveBeenCalledWith(submitter.id, expect.any(Error));
            expect(mockHandler._handleTurnEnd.mock.calls[0][1].message).toBe(expectedErrorMessage);
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();

        });
    });

    describe('destroy', () => {
        test('should unsubscribe, clear flag, end turn, and call super.destroy if context and actor exist and awaiting', async () => {
            await awaitingExternalTurnEndState.enterState(mockHandler, null); // To subscribe
            mockTestTurnContext.isAwaitingExternalEvent.mockReturnValue(true); // Ensure it's "awaiting"

            mockUnsubscribeTurnEndedFn.mockClear();
            mockTestTurnContext.setAwaitingExternalEvent.mockClear();
            mockTestTurnContext.endTurn.mockClear();

            await awaitingExternalTurnEndState.destroy(mockHandler);

            expect(mockLogger.warn).toHaveBeenCalledWith(`AwaitingExternalTurnEndState: Handler destroyed while awaiting external turn end for ${testActor.id}.`);
            expect(mockUnsubscribeTurnEndedFn).toHaveBeenCalledTimes(1);
            expect(mockTestTurnContext.isAwaitingExternalEvent).toHaveBeenCalled(); // Called by destroy to check
            expect(mockTestTurnContext.setAwaitingExternalEvent).toHaveBeenCalledWith(false, testActor.id);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(`Handler destroyed while ${testActor.id} was in AwaitingExternalTurnEndState.`);
            expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
        });

        test('should handle context being null during destroy', async () => {
            await awaitingExternalTurnEndState.enterState(mockHandler, null); // Subscribes
            mockHandler.getTurnContext.mockReturnValue(null); // Context disappears
            const handlerLogger = {...mockLogger, warn: jest.fn(), debug: jest.fn()};
            mockHandler.getLogger.mockReturnValue(handlerLogger);


            await awaitingExternalTurnEndState.destroy(mockHandler);

            expect(handlerLogger.warn).toHaveBeenCalledWith(`AwaitingExternalTurnEndState: Handler destroyed while awaiting external turn end for N/A_at_destroy.`);
            expect(mockUnsubscribeTurnEndedFn).toHaveBeenCalledTimes(1); // Attempt unsubscribe
            expect(handlerLogger.warn).toHaveBeenCalledWith(expect.stringContaining('ITurnContext not available for actor N/A_at_destroy'));
            expect(mockTestTurnContext.setAwaitingExternalEvent).not.toHaveBeenCalled();
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled(); // Cannot call on null context
            expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
        });

        test('should handle flag clear error during destroy', async () => {
            await awaitingExternalTurnEndState.enterState(mockHandler, null);
            mockTestTurnContext.isAwaitingExternalEvent.mockReturnValue(true);
            const flagError = new Error("Flag clear fail in destroy");
            mockTestTurnContext.setAwaitingExternalEvent.mockImplementationOnce(() => {
                throw flagError;
            });

            await awaitingExternalTurnEndState.destroy(mockHandler);

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Failed to clear awaiting flag for ${testActor.id}: ${flagError.message}`));
            expect(mockTestTurnContext.endTurn).toHaveBeenCalled(); // Still proceeds to end turn
        });
    });

    test('No direct PlayerTurnHandler dependencies in source code', () => {
        const sourceCode = AwaitingExternalTurnEndState.toString();
        // Regex to find "PlayerTurnHandler" not preceded by // or * (i.e., not in comments)
        const pthDependencyRegex = /(?<!\/\/\s*|\*\s*)\bPlayerTurnHandler\b/;
        // Regex to find private handler flags (e.g., ._isAwaitingTurnEndEvent or ['_isAwaitingTurnEndEvent'])
        const privateFlagRegex = /\.(_isAwaitingTurnEndEvent|_awaitingTurnEndForActorId)\b|\[\s*['"](_isAwaitingTurnEndEvent|_awaitingTurnEndForActorId)['"]\s*\]/;

        expect(sourceCode).not.toMatch(pthDependencyRegex);
        expect(sourceCode).not.toMatch(privateFlagRegex);
    });
});

// --- FILE END ---