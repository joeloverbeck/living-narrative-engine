// src/tests/core/turns/states/awaitingPlayerInputState.test.js
// --- FILE START ---

/**
 * @fileoverview Unit tests for AwaitingPlayerInputState.
 * Verifies its interaction with ITurnContext, IActorTurnStrategy, and state transitions.
 * Ticket: PTH-REFACTOR-003.2 (Update AwaitPlayerInputState to Use IActorTurnStrategy)
 * Related: PTH-REFACTOR-003 (Decouple All User-Input Prompting Logic)
 */

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';

// Module to be tested
import {AwaitingPlayerInputState} from '../../../../core/turns/states/awaitingPlayerInputState.js';

// Dependencies to be mocked or spied upon
import {ProcessingCommandState} from '../../../../core/turns/states/processingCommandState.js';
import {TurnIdleState} from '../../../../core/turns/states/turnIdleState.js';
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
});

// Mock for ITurnAction
const createMockTurnAction = (commandString = 'mock action', actionDefinitionId = 'mock:action') => ({
    commandString: commandString,
    actionDefinitionId: actionDefinitionId,
    resolvedParameters: {},
});

// Mock for IActorTurnStrategy
const mockActorTurnStrategy = {
    decideAction: jest.fn(),
};

const createMockTurnContext = (actor, loggerInstance = mockLogger, strategy = mockActorTurnStrategy) => {
    const mockContext = {
        getActor: jest.fn().mockReturnValue(actor),
        getLogger: jest.fn().mockReturnValue(loggerInstance),
        getStrategy: jest.fn().mockReturnValue(strategy), // For PTH-REFACTOR-003.2
        setChosenAction: jest.fn(),                       // For PTH-REFACTOR-003.2
        requestTransition: jest.fn().mockResolvedValue(undefined),
        endTurn: jest.fn(),
        // Keep other mocks from original test file if they might be needed by superclass or other interactions
        getPlayerPromptService: jest.fn(), // Might be called by old strategy, or if strategy needs it
        getSubscriptionManager: jest.fn(), // Might be called by old strategy
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
        getLogger: jest.fn().mockReturnValue(loggerInstance),
        getTurnContext: jest.fn().mockReturnValue(null),
        _transitionToState: jest.fn().mockResolvedValue(undefined),
        _resetTurnStateAndResources: jest.fn(),
        getCurrentActor: jest.fn().mockReturnValue(null),
    };
    return handlerMock;
};

// --- Test Suite ---
describe('AwaitingPlayerInputState (PTH-REFACTOR-003.2)', () => {
    let mockHandler;
    let awaitingPlayerInputState;
    let testActor;
    let mockTestTurnContext;
    let mockTestStrategy;

    let superEnterSpy;
    let superExitSpy;
    let superDestroySpy;
    let superHandleTurnEndedEventSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        testActor = createMockActor('player1');
        mockTestStrategy = {decideAction: jest.fn()}; // Fresh mock strategy for each test
        mockHandler = createMockBaseTurnHandler(mockLogger);
        mockTestTurnContext = createMockTurnContext(testActor, mockLogger, mockTestStrategy);

        mockHandler.getTurnContext.mockReturnValue(mockTestTurnContext);
        mockHandler.getCurrentActor.mockReturnValue(testActor);

        awaitingPlayerInputState = new AwaitingPlayerInputState(mockHandler);

        superEnterSpy = jest.spyOn(AbstractTurnState.prototype, 'enterState');
        superExitSpy = jest.spyOn(AbstractTurnState.prototype, 'exitState');
        superDestroySpy = jest.spyOn(AbstractTurnState.prototype, 'destroy');
        superHandleTurnEndedEventSpy = jest.spyOn(AbstractTurnState.prototype, 'handleTurnEndedEvent');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('constructor should correctly store the handler and call super', () => {
        expect(awaitingPlayerInputState._handler).toBe(mockHandler);
    });

    test('getStateName should return "AwaitingPlayerInputState"', () => {
        expect(awaitingPlayerInputState.getStateName()).toBe('AwaitingPlayerInputState');
    });

    describe('enterState', () => {
        test('should call strategy.decideAction, setChosenAction, and transition to ProcessingCommandState on success', async () => {
            const mockAction = createMockTurnAction('look around', 'core:observe');
            mockTestStrategy.decideAction.mockResolvedValue(mockAction);

            await awaitingPlayerInputState.enterState(mockHandler, null);

            expect(superEnterSpy).toHaveBeenCalledWith(mockHandler, null);
            expect(mockTestTurnContext.getLogger).toHaveBeenCalled();
            expect(mockTestTurnContext.getActor).toHaveBeenCalled();
            expect(mockTestTurnContext.getStrategy).toHaveBeenCalled();
            expect(mockTestStrategy.decideAction).toHaveBeenCalledWith(mockTestTurnContext);
            expect(mockTestTurnContext.setChosenAction).toHaveBeenCalledWith(mockAction);
            expect(mockTestTurnContext.requestTransition).toHaveBeenCalledWith(ProcessingCommandState, [mockAction.commandString, mockAction]);
            expect(mockLogger.info).toHaveBeenCalledWith(`AwaitingPlayerInputState: Actor ${testActor.id} is now awaiting decision via its strategy.`);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Received ITurnAction from strategy for actor ${testActor.id}`));
        });

        test('should use actionDefinitionId for transition if commandString is null/empty on ITurnAction', async () => {
            const mockAction = createMockTurnAction(null, 'core:special_ability');
            mockTestStrategy.decideAction.mockResolvedValue(mockAction);

            await awaitingPlayerInputState.enterState(mockHandler, null);

            expect(mockTestStrategy.decideAction).toHaveBeenCalledWith(mockTestTurnContext);
            expect(mockTestTurnContext.setChosenAction).toHaveBeenCalledWith(mockAction);
            expect(mockTestTurnContext.requestTransition).toHaveBeenCalledWith(ProcessingCommandState, [mockAction.actionDefinitionId, mockAction]);
        });


        test('should end turn if ITurnContext is not available', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            const handlerLogger = {...mockLogger, error: jest.fn()}; // Ensure fresh mock for this specific logger
            mockHandler.getLogger.mockReturnValue(handlerLogger);

            await awaitingPlayerInputState.enterState(mockHandler, null);

            expect(handlerLogger.error).toHaveBeenCalledWith('AwaitingPlayerInputState: Critical - ITurnContext not available on entry. Transitioning to Idle.');
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(`critical-entry-no-context-${awaitingPlayerInputState.getStateName()}`);
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled(); // endTurn is on context, which is null here
        });

        test('should end turn if actor is not found in ITurnContext', async () => {
            mockTestTurnContext.getActor.mockReturnValue(null);

            await awaitingPlayerInputState.enterState(mockHandler, null);

            expect(mockLogger.error).toHaveBeenCalledWith(`AwaitingPlayerInputState: Critical - Actor not found in ITurnContext on entry. Ending turn.`);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe('AwaitingPlayerInputState: Actor not found in ITurnContext on entry.');
        });

        test('should end turn if getStrategy is missing on context', async () => {
            mockTestTurnContext.getStrategy = undefined; // Simulate missing method

            await awaitingPlayerInputState.enterState(mockHandler, null);
            const expectedErrorMsg = `AwaitingPlayerInputState: Actor ${testActor.id} has no valid IActorTurnStrategy or getStrategy() is missing on context.`;
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedErrorMsg);
        });

        test('should end turn if strategy is null or invalid from getStrategy()', async () => {
            mockTestTurnContext.getStrategy.mockReturnValue(null); // Strategy is null

            await awaitingPlayerInputState.enterState(mockHandler, null);
            const expectedErrorMsg = `AwaitingPlayerInputState: Actor ${testActor.id} has no valid IActorTurnStrategy or getStrategy() is missing on context.`;
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedErrorMsg);

            mockTestTurnContext.getStrategy.mockReturnValue({decideAction: 'not-a-function'}); // Invalid strategy
            jest.clearAllMocks(); // Clear mocks before re-running with invalid strategy
            mockHandler.getTurnContext.mockReturnValue(mockTestTurnContext); // Re-assign context
            mockTestTurnContext.getActor.mockReturnValue(testActor); // Ensure actor is set
            mockLogger.error.mockClear(); // Clear logger for this specific check
            mockTestTurnContext.endTurn.mockClear();

            await awaitingPlayerInputState.enterState(mockHandler, null);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedErrorMsg);
        });

        test('should end turn if strategy.decideAction throws an error', async () => {
            const strategyError = new Error('Strategy decision failed');
            mockTestStrategy.decideAction.mockRejectedValue(strategyError);

            await awaitingPlayerInputState.enterState(mockHandler, null);

            const expectedOverallErrorMessage = `AwaitingPlayerInputState: Error during strategy execution or transition for actor ${testActor.id}. Details: ${strategyError.message}`;
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Error during strategy execution or transition for actor ${testActor.id}`), strategyError);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedOverallErrorMessage);
        });

        test('should end turn if strategy.decideAction returns null or invalid ITurnAction', async () => {
            mockTestStrategy.decideAction.mockResolvedValue(null); // Test null return

            await awaitingPlayerInputState.enterState(mockHandler, null);
            let expectedErrorMsg = `AwaitingPlayerInputState: Strategy for actor ${testActor.id} returned an invalid or null ITurnAction.`;
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg, {receivedAction: null});
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedErrorMsg);

            jest.clearAllMocks(); // Clear mocks
            mockHandler.getTurnContext.mockReturnValue(mockTestTurnContext);
            mockTestTurnContext.getActor.mockReturnValue(testActor);
            mockTestTurnContext.getStrategy.mockReturnValue(mockTestStrategy); // Re-setup mocks
            const invalidAction = {someOtherProp: "value"}; // Missing actionDefinitionId
            mockTestStrategy.decideAction.mockResolvedValue(invalidAction);

            await awaitingPlayerInputState.enterState(mockHandler, null);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg, {receivedAction: invalidAction});
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedErrorMsg);
        });


        test('should end turn if requestTransition fails', async () => {
            const mockAction = createMockTurnAction('test');
            mockTestStrategy.decideAction.mockResolvedValue(mockAction);
            const transitionError = new Error('Transition failed');
            mockTestTurnContext.requestTransition.mockRejectedValue(transitionError);

            await awaitingPlayerInputState.enterState(mockHandler, null);
            const expectedOverallErrorMessage = `AwaitingPlayerInputState: Error during strategy execution or transition for actor ${testActor.id}. Details: ${transitionError.message}`;
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Error during strategy execution or transition for actor ${testActor.id}`), transitionError);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedOverallErrorMessage);
        });

        test('should not call setChosenAction if method is not on context, but still transition', async () => {
            const mockAction = createMockTurnAction('action');
            mockTestStrategy.decideAction.mockResolvedValue(mockAction);
            mockTestTurnContext.setChosenAction = undefined; // Simulate missing method

            await awaitingPlayerInputState.enterState(mockHandler, null);

            expect(mockTestStrategy.decideAction).toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('ITurnContext.setChosenAction() not found'));
            expect(mockTestTurnContext.requestTransition).toHaveBeenCalledWith(ProcessingCommandState, [mockAction.commandString, mockAction]);
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
        });

        // Verify removal of direct prompting/subscription logic
        test('should NOT call getSubscriptionManager or getPlayerPromptService for direct subscription/prompting', async () => {
            const mockAction = createMockTurnAction();
            mockTestStrategy.decideAction.mockResolvedValue(mockAction);
            // Spy on these to ensure they are NOT called for the old reasons
            const subManSpy = jest.spyOn(mockTestTurnContext, 'getSubscriptionManager');
            const promptServiceSpy = jest.spyOn(mockTestTurnContext, 'getPlayerPromptService');


            await awaitingPlayerInputState.enterState(mockHandler, null);

            expect(subManSpy).not.toHaveBeenCalled(); // Core check: No direct subscription
            expect(promptServiceSpy).not.toHaveBeenCalled(); // Core check: No direct prompting

            // Strategy still called
            expect(mockTestStrategy.decideAction).toHaveBeenCalled();
            expect(mockTestTurnContext.requestTransition).toHaveBeenCalled();
        });
    });

    describe('exitState', () => {
        test('should call super.exitState and perform no other specific cleanup by default', async () => {
            await awaitingPlayerInputState.exitState(mockHandler, null);
            expect(superExitSpy).toHaveBeenCalledWith(mockHandler, null);
            expect(mockLogger.debug).toHaveBeenCalledWith('AwaitingPlayerInputState: Exiting AwaitingPlayerInputState.');
            // No #unsubscribeFromCommandInputFn to check anymore
        });
    });

    describe('handleSubmittedCommand', () => {
        // This method is now largely a fallback for unexpected calls.
        test('should log a warning and end turn if called, as input is strategy-driven', async () => {
            const command = "unexpected command";
            await awaitingPlayerInputState.handleSubmittedCommand(mockHandler, command, testActor);

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('handleSubmittedCommand was called directly'));
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toMatch(/Unexpected direct command submission/);
        });

        test('should try to reset and idle if no ITurnContext when unexpectedly called', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            const handlerLogger = {...mockLogger, error: jest.fn(), warn: jest.fn()};
            mockHandler.getLogger.mockReturnValue(handlerLogger);

            await awaitingPlayerInputState.handleSubmittedCommand(mockHandler, "cmd", testActor);

            expect(handlerLogger.warn).toHaveBeenCalledWith(expect.stringContaining('handleSubmittedCommand was called directly'));
            expect(handlerLogger.error).toHaveBeenCalledWith(expect.stringContaining('No ITurnContext available to end turn. Forcing handler reset'));
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
        });

        test('should log critical error if no context and no handler when unexpectedly called', async () => {
            awaitingPlayerInputState._handler = null; // Simulate no handler
            // Logger will be console if handler is null. Spy on console.error.
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });


            await awaitingPlayerInputState.handleSubmittedCommand(null, "cmd", testActor);

            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('CRITICAL - No ITurnContext or handler available'));
            consoleErrorSpy.mockRestore();
        });
    });

    // Tests for handleTurnEndedEvent and destroy are largely unchanged by this ticket's core logic,
    // as they interact with ITurnContext or handler, not directly with input methods.
    // We can keep them to ensure no regressions.
    describe('handleTurnEndedEvent', () => {
        let eventPayloadForCurrentActor;
        let eventPayloadForOtherActor;

        beforeEach(() => {
            eventPayloadForCurrentActor = {entityId: testActor.id, error: null};
            eventPayloadForOtherActor = {entityId: 'other-player', error: null};
        });

        test('should end turn via ITurnContext if event is for current actor', async () => {
            await awaitingPlayerInputState.handleTurnEndedEvent(mockHandler, eventPayloadForCurrentActor);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`core:turn_ended event received for current actor ${testActor.id}`));
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(null);
        });

        test('should call super.handleTurnEndedEvent if event is not for current actor', async () => {
            await awaitingPlayerInputState.handleTurnEndedEvent(mockHandler, eventPayloadForOtherActor);
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
            expect(superHandleTurnEndedEventSpy).toHaveBeenCalledWith(mockHandler, eventPayloadForOtherActor);
        });
    });

    describe('destroy', () => {
        test('should end turn via context and call super.destroy if context exists', async () => {
            await awaitingPlayerInputState.destroy(mockHandler);

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Handler destroyed while awaiting input for ${testActor.id}`));
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(`Turn handler destroyed while actor ${testActor.id} was in AwaitingPlayerInputState.`);
            expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
        });

        test('should log warning and not end turn via context if context is missing, then call super.destroy', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            const handlerLogger = {...mockLogger, warn: jest.fn(), info: jest.fn()};
            mockHandler.getLogger.mockReturnValue(handlerLogger);

            await awaitingPlayerInputState.destroy(mockHandler);

            expect(handlerLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Handler destroyed while awaiting input for N/A_at_destroy`));
            expect(handlerLogger.warn).toHaveBeenCalledWith('AwaitingPlayerInputState: Handler destroyed, but no active ITurnContext for actor N/A_at_destroy. No specific turn to end via context.');
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
            expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
        });
    });

    // Inapplicable methods test remains the same.
    describe('Inapplicable AbstractTurnState Methods', () => {
        const inapplicableMethods = [
            {name: 'startTurn', args: [mockHandler, testActor]},
            {name: 'processCommandResult', args: [mockHandler, testActor, {}, "cmd"]},
            {name: 'handleDirective', args: [mockHandler, testActor, "DIR", {}]},
        ];

        inapplicableMethods.forEach(methodInfo => {
            test(`${methodInfo.name} should call super, which throws by default`, async () => {
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