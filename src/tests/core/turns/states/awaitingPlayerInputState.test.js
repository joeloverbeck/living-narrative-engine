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
import {
    AwaitingPlayerInputState
} from '../../../../core/turns/states/awaitingPlayerInputState.js';

// Dependencies to be mocked or spied upon
import {ProcessingCommandState} from '../../../../core/turns/states/processingCommandState.js';
import {TurnIdleState} from '../../../../core/turns/states/turnIdleState.js';
import {AbstractTurnState} from '../../../../core/turns/states/abstractTurnState.js';

// --- Mocks & Test Utilities ---

const mockLogger = {
    log: jest.fn(), // Added for completeness, though aim is to use specific levels
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
    // constructor: { name: 'MockTurnStrategy' } // One way to spoof constructor name if needed, but matching "Object" is simpler
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
    let mockTestStrategy; // Will be a fresh object literal { decideAction: jest.fn() }

    let superEnterSpy;
    let superExitSpy;
    let superDestroySpy;
    let superHandleTurnEndedEventSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        testActor = createMockActor('player1');
        // mockTestStrategy is a new object for each test, its constructor.name will be 'Object'
        mockTestStrategy = {decideAction: jest.fn()};
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
        expect(awaitingPlayerInputState._handler).toBe(mockHandler); // Check _handler
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

            expect(mockLogger.info).toHaveBeenCalledWith(`AwaitingPlayerInputState: Actor ${testActor.id}. Attempting to retrieve turn strategy.`);
            // Corrected to expect "Object" as strategy name
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Strategy Object obtained for actor ${testActor.id}. Requesting action decision.`));
            expect(mockLogger.info).toHaveBeenCalledWith(`AwaitingPlayerInputState: Actor ${testActor.id} decided action: ${mockAction.actionDefinitionId}. Storing action.`);
            expect(mockLogger.info).toHaveBeenCalledWith(`AwaitingPlayerInputState: Transitioning to ProcessingCommandState for actor ${testActor.id}.`);
        });

        test('should use actionDefinitionId for transition if commandString is null/empty on ITurnAction', async () => {
            const mockAction = createMockTurnAction(null, 'core:special_ability');
            mockTestStrategy.decideAction.mockResolvedValue(mockAction);

            await awaitingPlayerInputState.enterState(mockHandler, null);

            expect(mockTestStrategy.decideAction).toHaveBeenCalledWith(mockTestTurnContext);
            expect(mockTestTurnContext.setChosenAction).toHaveBeenCalledWith(mockAction);
            expect(mockTestTurnContext.requestTransition).toHaveBeenCalledWith(ProcessingCommandState, [mockAction.actionDefinitionId, mockAction]);
            // Add log checks if they are critical for this test path and distinct
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Strategy Object obtained for actor ${testActor.id}. Requesting action decision.`));
        });


        test('should end turn if ITurnContext is not available', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            const handlerLogger = {...mockLogger, error: jest.fn()};
            mockHandler.getLogger.mockReturnValue(handlerLogger);

            await awaitingPlayerInputState.enterState(mockHandler, null);

            expect(handlerLogger.error).toHaveBeenCalledWith('AwaitingPlayerInputState: Critical error - TurnContext is not available. Attempting to reset and idle.');
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(`critical-no-context-${awaitingPlayerInputState.getStateName()}`);
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
        });

        test('should end turn if actor is not found in ITurnContext', async () => {
            mockTestTurnContext.getActor.mockReturnValue(null);

            await awaitingPlayerInputState.enterState(mockHandler, null);

            expect(mockLogger.error).toHaveBeenCalledWith(`AwaitingPlayerInputState: No actor found in TurnContext. Ending turn.`);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe('No actor in context during AwaitingPlayerInputState.');
        });

        test('should end turn if getStrategy is missing on context', async () => {
            mockTestTurnContext.getStrategy = undefined;

            await awaitingPlayerInputState.enterState(mockHandler, null);
            const expectedErrorMsg = `AwaitingPlayerInputState: turnContext.getStrategy() is not a function for actor ${testActor.id}.`;
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedErrorMsg);
        });

        test('should end turn if strategy is null or invalid from getStrategy()', async () => {
            mockTestTurnContext.getStrategy.mockReturnValue(null);

            await awaitingPlayerInputState.enterState(mockHandler, null);
            const expectedErrorMsg = `AwaitingPlayerInputState: No valid IActorTurnStrategy found for actor ${testActor.id} or strategy is malformed (missing decideAction).`;
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg, {strategyReceived: null});
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedErrorMsg);

            jest.clearAllMocks();
            mockHandler.getTurnContext.mockReturnValue(mockTestTurnContext);
            mockTestTurnContext.getActor.mockReturnValue(testActor);
            mockTestTurnContext.getStrategy.mockReturnValue({decideAction: 'not-a-function'});

            await awaitingPlayerInputState.enterState(mockHandler, null);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg, {strategyReceived: {decideAction: 'not-a-function'}});
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedErrorMsg);
        });

        test('should end turn if strategy.decideAction throws an error', async () => {
            const strategyError = new Error('Strategy decision failed');
            mockTestStrategy.decideAction.mockRejectedValue(strategyError);

            await awaitingPlayerInputState.enterState(mockHandler, null);

            const expectedLogMessage = `${awaitingPlayerInputState.name}: Error during action decision, storage, or transition for actor ${testActor.id}: ${strategyError.message}`;
            const expectedEndTurnMessage = `${awaitingPlayerInputState.name}: Error during action decision, storage, or transition for actor ${testActor.id}: ${strategyError.message}`;

            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage, {originalError: strategyError});
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedEndTurnMessage);
        });

        test('should end turn if strategy.decideAction returns null or invalid ITurnAction', async () => {
            mockTestStrategy.decideAction.mockResolvedValue(null);

            await awaitingPlayerInputState.enterState(mockHandler, null);
            let expectedErrorMsg = `AwaitingPlayerInputState: Strategy for actor ${testActor.id} returned an invalid or null ITurnAction (must have actionDefinitionId).`;
            expect(mockLogger.warn).toHaveBeenCalledWith(expectedErrorMsg, {receivedAction: null});
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedErrorMsg);

            jest.clearAllMocks();
            mockHandler.getTurnContext.mockReturnValue(mockTestTurnContext);
            mockTestTurnContext.getActor.mockReturnValue(testActor);
            mockTestTurnContext.getStrategy.mockReturnValue(mockTestStrategy);
            const invalidAction = {someOtherProp: "value"};
            mockTestStrategy.decideAction.mockResolvedValue(invalidAction);

            await awaitingPlayerInputState.enterState(mockHandler, null);
            expect(mockLogger.warn).toHaveBeenCalledWith(expectedErrorMsg, {receivedAction: invalidAction});
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedErrorMsg);
        });


        test('should end turn if requestTransition fails', async () => {
            const mockAction = createMockTurnAction('test');
            mockTestStrategy.decideAction.mockResolvedValue(mockAction);
            const transitionError = new Error('Transition failed');
            // Ensure this mock is correctly applied to the specific context instance
            mockTestTurnContext.requestTransition.mockRejectedValue(transitionError);

            await awaitingPlayerInputState.enterState(mockHandler, null);

            const expectedLogMessage = `${awaitingPlayerInputState.name}: Error during action decision, storage, or transition for actor ${testActor.id}: ${transitionError.message}`;
            const expectedEndTurnMessage = `${awaitingPlayerInputState.name}: Error during action decision, storage, or transition for actor ${testActor.id}: ${transitionError.message}`;

            // This is the failing expectation. If "Number of calls: 0", the catch block's logger.error isn't hit.
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage, {originalError: transitionError});
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedEndTurnMessage);
        });

        test('should not call setChosenAction if method is not on context, but still transition', async () => {
            const mockAction = createMockTurnAction('action');
            mockTestStrategy.decideAction.mockResolvedValue(mockAction);
            mockTestTurnContext.setChosenAction = undefined;

            await awaitingPlayerInputState.enterState(mockHandler, null);

            expect(mockTestStrategy.decideAction).toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(`AwaitingPlayerInputState: ITurnContext.setChosenAction() not found. Cannot store action in context. ProcessingCommandState might rely on constructor argument.`);
            expect(mockTestTurnContext.requestTransition).toHaveBeenCalledWith(ProcessingCommandState, [mockAction.commandString, mockAction]);
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
        });

        test('should NOT call getSubscriptionManager or getPlayerPromptService for direct subscription/prompting', async () => {
            const mockAction = createMockTurnAction();
            mockTestStrategy.decideAction.mockResolvedValue(mockAction);

            const subManSpy = jest.spyOn(mockTestTurnContext, 'getSubscriptionManager');
            const promptServiceSpy = jest.spyOn(mockTestTurnContext, 'getPlayerPromptService');

            await awaitingPlayerInputState.enterState(mockHandler, null);

            expect(subManSpy).not.toHaveBeenCalled();
            expect(promptServiceSpy).not.toHaveBeenCalled();

            expect(mockTestStrategy.decideAction).toHaveBeenCalled();
            expect(mockTestTurnContext.requestTransition).toHaveBeenCalled();
        });
    });

    describe('exitState', () => {
        test('should call super.exitState and perform no other specific cleanup by default', async () => {
            await awaitingPlayerInputState.exitState(mockHandler, null);
            expect(superExitSpy).toHaveBeenCalledWith(awaitingPlayerInputState._handler, null);
            expect(mockLogger.debug).toHaveBeenCalledWith('AwaitingPlayerInputState: ExitState cleanup (if any) complete.');
        });
    });

    describe('handleSubmittedCommand', () => {
        test('should log a warning and end turn if called, as input is strategy-driven', async () => {
            const command = "unexpected command";
            await awaitingPlayerInputState.handleSubmittedCommand(mockHandler, command, testActor);

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: handleSubmittedCommand was called directly for actor ${testActor.id} with command "${command}". This is unexpected in the new strategy-driven workflow. Ending turn.`));
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toMatch(`Unexpected direct command submission to AwaitingPlayerInputState for actor ${testActor.id}. Input should be strategy-driven.`);
        });

        test('should try to reset and idle if no ITurnContext when unexpectedly called', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            const handlerLogger = {...mockLogger, error: jest.fn(), warn: jest.fn()};
            mockHandler.getLogger.mockReturnValue(handlerLogger);

            await awaitingPlayerInputState.handleSubmittedCommand(mockHandler, "cmd", testActor);

            expect(handlerLogger.error).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: handleSubmittedCommand (for actor ${testActor.id}, cmd: "cmd") called, but no ITurnContext. Forcing handler reset.`));
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(`no-context-submission-${awaitingPlayerInputState.getStateName()}`);
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
        });

        test('should log critical error if no context and no handler when unexpectedly called', async () => {
            const originalHandler = awaitingPlayerInputState._handler;
            awaitingPlayerInputState._handler = null;
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });

            await awaitingPlayerInputState.handleSubmittedCommand(null, "cmd", testActor);

            expect(consoleErrorSpy).toHaveBeenCalledWith(`AwaitingPlayerInputState: _handler is invalid or missing getTurnContext method.`);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: handleSubmittedCommand (for actor ${testActor.id}, cmd: "cmd") called, but no ITurnContext. Forcing handler reset.`));
            expect(consoleErrorSpy).toHaveBeenCalledWith(`AwaitingPlayerInputState: CRITICAL - No ITurnContext or handler methods to process unexpected command submission or to reset.`);

            consoleErrorSpy.mockRestore();
            awaitingPlayerInputState._handler = originalHandler;
        });
    });

    describe('handleTurnEndedEvent', () => {
        let eventPayloadForCurrentActor;
        let eventPayloadForOtherActor;

        beforeEach(() => {
            eventPayloadForCurrentActor = {entityId: testActor.id, error: null};
            eventPayloadForOtherActor = {entityId: 'other-player', error: null};
        });

        test('should end turn via ITurnContext if event is for current actor', async () => {
            await awaitingPlayerInputState.handleTurnEndedEvent(mockHandler, eventPayloadForCurrentActor);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: core:turn_ended event received for current actor ${testActor.id}. Ending turn.`));
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(null);
        });

        test('should call super.handleTurnEndedEvent if event is not for current actor', async () => {
            await awaitingPlayerInputState.handleTurnEndedEvent(mockHandler, eventPayloadForOtherActor);
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
            expect(superHandleTurnEndedEventSpy).toHaveBeenCalledWith(mockHandler, eventPayloadForOtherActor);
            expect(mockLogger.debug).toHaveBeenCalledWith(`AwaitingPlayerInputState: core:turn_ended event for actor ${eventPayloadForOtherActor.entityId} is not for current context actor ${testActor.id}. Deferring to superclass.`);

        });
    });

    describe('destroy', () => {
        test('should end turn via context and call super.destroy if context exists', async () => {
            await awaitingPlayerInputState.destroy(mockHandler);

            expect(mockLogger.info).toHaveBeenCalledWith(`AwaitingPlayerInputState: Handler destroyed while state was active for actor ${testActor.id}. Ending turn.`);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(`Turn handler destroyed while actor ${testActor.id} was in ${awaitingPlayerInputState.name}.`);
            expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
        });

        test('should log warning and not end turn via context if context is missing, then call super.destroy', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            const specificHandlerLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
            mockHandler.getLogger.mockReturnValue(specificHandlerLogger);

            await awaitingPlayerInputState.destroy(mockHandler);

            const expectedActorIdLog = 'N/A_no_context';
            expect(specificHandlerLogger.warn).toHaveBeenCalledWith(`AwaitingPlayerInputState: Handler destroyed. Actor ID from context: ${expectedActorIdLog}. No specific turn to end via context if actor is missing.`);
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
            expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
        });
    });

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