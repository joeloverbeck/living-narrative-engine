// tests/turns/states/awaitingPlayerInputState.test.js
// --- FILE START ---

/**
 * @fileoverview Unit tests for AwaitingPlayerInputState.
 * Verifies its interaction with ITurnContext, IActorTurnStrategy, and state transitions.
 * Ticket: PTH-REFACTOR-003.5.7 (Unit Tests for AwaitingPlayerInputState - Responsibility Shift)
 * Parent Ticket: PTH-REFACTOR-003.5 (Define ITurnAction; Refactor Command Processing into ProcessingCommandState)
 * Depends On: PTH-REFACTOR-003.5.4 (Refactor AwaitingPlayerInputState for New Workflow)
 */

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';

// Module to be tested
import {
    AwaitingPlayerInputState
} from '../../../src/turns/states/awaitingPlayerInputState.js';

// Dependencies to be mocked or spied upon
import {ProcessingCommandState} from '../../../src/turns/states/processingCommandState.js';
import {TurnIdleState} from '../../../src/turns/states/turnIdleState.js';
import {AbstractTurnState} from '../../../src/turns/states/abstractTurnState.js';
// TurnDirectiveStrategyResolver is not directly used by AwaitingPlayerInputState,
// so no need to import/mock it here unless testing that it's *not* resolved by this state.

// --- Mocks & Test Utilities ---

const mockLogger = {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    createChild: jest.fn(() => mockLogger), // Ensure child logger also returns mockLogger
    createChildLogger: jest.fn(() => mockLogger), // Adding createChildLogger as it's used in HumanPlayerStrategy
};

const createMockActor = (id = 'test-actor-awaiting') => ({
    id: id,
    name: `MockAwaitingActor-${id}`,
    hasComponent: jest.fn(), // Add hasComponent mock
});

// Mock for ITurnAction
// Ensure it has actionDefinitionId as per PTH-REFACTOR-003.5.3
const createMockTurnAction = (commandString = 'mock action', actionDefinitionId = 'mock:action_id_123', resolvedParameters = {}) => ({
    commandString: commandString,
    actionDefinitionId: actionDefinitionId,
    resolvedParameters: resolvedParameters,
});

// Mock for IActorTurnStrategy - instance with a jest.fn() for decideAction
const createMockActorTurnStrategy = () => ({
    decideAction: jest.fn(),
    // constructor.name will be 'Object' for object literals. If a specific name is needed for logging tests:
    // constructor: { name: 'MockActorTurnStrategy' }
});

const createMockTurnContext = (actor, loggerInstance = mockLogger, strategy) => {
    const mockContext = {
        getActor: jest.fn().mockReturnValue(actor),
        getLogger: jest.fn().mockReturnValue(loggerInstance),
        getStrategy: jest.fn().mockReturnValue(strategy),
        setChosenAction: jest.fn(),
        requestTransition: jest.fn().mockResolvedValue(undefined), // Default successful transition
        endTurn: jest.fn(),
        getChosenAction: jest.fn(), // Added as per ProcessingCommandState
        isValid: jest.fn().mockReturnValue(true), // Added for ProcessingCommandState robustness

        // Services that should NOT be called by AwaitingPlayerInputState
        getCommandProcessor: jest.fn(),
        getCommandOutcomeInterpreter: jest.fn(),

        // Other services that might be on a real ITurnContext but not directly used by this state
        getPlayerPromptService: jest.fn(), // Not called directly by AwaitingPlayerInputState
        getSubscriptionManager: jest.fn(), // Not called directly by AwaitingPlayerInputState
        getGame: jest.fn(),
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
        getTurnContext: jest.fn().mockReturnValue(null), // Will be overridden in tests
        _transitionToState: jest.fn().mockResolvedValue(undefined),
        _resetTurnStateAndResources: jest.fn(),
        getCurrentActor: jest.fn().mockReturnValue(null), // Will be overridden
        _currentState: null,
    };
    return handlerMock;
};

// --- Test Suite ---
describe('AwaitingPlayerInputState (PTH-REFACTOR-003.5.7)', () => {
    let mockHandler;
    let awaitingPlayerInputState;
    let testActor;
    let mockTestTurnContext;
    let mockTestStrategy;

    let superEnterSpy;
    let superExitSpy;
    let superDestroySpy;
    let superHandleTurnEndedEventSpy;
    let consoleErrorSpy; // For critical error logging

    beforeEach(() => {
        jest.clearAllMocks();

        testActor = createMockActor('player1');
        mockTestStrategy = createMockActorTurnStrategy();
        mockHandler = createMockBaseTurnHandler(mockLogger);
        mockTestTurnContext = createMockTurnContext(testActor, mockLogger, mockTestStrategy);

        mockHandler.getTurnContext.mockReturnValue(mockTestTurnContext);
        mockHandler.getCurrentActor.mockReturnValue(testActor);

        awaitingPlayerInputState = new AwaitingPlayerInputState(mockHandler);
        mockHandler._currentState = awaitingPlayerInputState;

        superEnterSpy = jest.spyOn(AbstractTurnState.prototype, 'enterState').mockResolvedValue(undefined);
        superExitSpy = jest.spyOn(AbstractTurnState.prototype, 'exitState').mockResolvedValue(undefined);
        superDestroySpy = jest.spyOn(AbstractTurnState.prototype, 'destroy').mockResolvedValue(undefined);
        superHandleTurnEndedEventSpy = jest.spyOn(AbstractTurnState.prototype, 'handleTurnEndedEvent').mockResolvedValue(undefined);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        }); // Suppress console.error during tests
    });

    afterEach(() => {
        jest.restoreAllMocks();
        consoleErrorSpy.mockRestore();
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

            await awaitingPlayerInputState.enterState();

            expect(superEnterSpy).toHaveBeenCalledWith(awaitingPlayerInputState._handler, null);
            expect(mockTestTurnContext.getLogger).toHaveBeenCalled();
            expect(mockTestTurnContext.getActor).toHaveBeenCalled();
            expect(mockTestTurnContext.getStrategy).toHaveBeenCalled();
            expect(mockTestStrategy.decideAction).toHaveBeenCalledWith(mockTestTurnContext);
            expect(mockTestTurnContext.setChosenAction).toHaveBeenCalledWith(mockAction);
            expect(mockTestTurnContext.requestTransition).toHaveBeenCalledWith(
                ProcessingCommandState,
                [mockAction.commandString, mockAction]
            );

            const expectedStrategyName = mockTestStrategy.constructor.name || 'Object';
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: Actor ${testActor.id}. Attempting to retrieve turn strategy.`));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Strategy ${expectedStrategyName} obtained for actor ${testActor.id}. Requesting action decision.`));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: Actor ${testActor.id} decided action: ${mockAction.actionDefinitionId}. Storing action.`));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: Transitioning to ProcessingCommandState for actor ${testActor.id}.`));
        });

        test('should use actionDefinitionId for transition if commandString is null/empty on ITurnAction', async () => {
            const mockActionNoCmdString = createMockTurnAction(null, 'core:special_ability');
            mockTestStrategy.decideAction.mockResolvedValue(mockActionNoCmdString);
            await awaitingPlayerInputState.enterState();
            expect(mockTestTurnContext.requestTransition).toHaveBeenCalledWith(
                ProcessingCommandState,
                [mockActionNoCmdString.actionDefinitionId, mockActionNoCmdString]
            );
        });

        test('should use actionDefinitionId for transition if commandString is an empty string on ITurnAction', async () => {
            const mockActionEmptyCmdString = createMockTurnAction('', 'core:another_ability');
            mockTestStrategy.decideAction.mockResolvedValue(mockActionEmptyCmdString);
            await awaitingPlayerInputState.enterState();
            expect(mockTestTurnContext.requestTransition).toHaveBeenCalledWith(
                ProcessingCommandState,
                [mockActionEmptyCmdString.actionDefinitionId, mockActionEmptyCmdString]
            );
        });

        test('should NOT call getCommandProcessor or getCommandOutcomeInterpreter during enterState', async () => {
            const mockAction = createMockTurnAction('do something', 'core:do_something');
            mockTestStrategy.decideAction.mockResolvedValue(mockAction);

            await awaitingPlayerInputState.enterState();

            expect(mockTestTurnContext.getCommandProcessor).not.toHaveBeenCalled();
            expect(mockTestTurnContext.getCommandOutcomeInterpreter).not.toHaveBeenCalled();
        });


        // --- ERROR HANDLING ---
        test('should reset and transition to TurnIdleState if ITurnContext is not available', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            const specificHandlerLogger = {...mockLogger, error: jest.fn()};
            mockHandler.getLogger.mockReturnValue(specificHandlerLogger);

            await awaitingPlayerInputState.enterState();

            expect(superEnterSpy).not.toHaveBeenCalled();
            expect(specificHandlerLogger.error).toHaveBeenCalledWith('AwaitingPlayerInputState: Critical error - TurnContext is not available. Attempting to reset and idle.');
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith('critical-no-context-AwaitingPlayerInputState');
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
        });

        test('should end turn if actor is not found in ITurnContext', async () => {
            mockTestTurnContext.getActor.mockReturnValue(null);
            await awaitingPlayerInputState.enterState();
            expect(superEnterSpy).toHaveBeenCalledWith(awaitingPlayerInputState._handler, null);
            expect(mockLogger.error).toHaveBeenCalledWith('AwaitingPlayerInputState: No actor found in TurnContext. Ending turn.');
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe('No actor in context during AwaitingPlayerInputState.');
            expect(mockTestTurnContext.requestTransition).not.toHaveBeenCalled();
        });

        test('should end turn if turnContext.getStrategy is not a function', async () => {
            mockTestTurnContext.getStrategy = undefined;
            await awaitingPlayerInputState.enterState();
            expect(superEnterSpy).toHaveBeenCalledWith(awaitingPlayerInputState._handler, null);
            const expectedErrorMsg = `AwaitingPlayerInputState: turnContext.getStrategy() is not a function for actor ${testActor.id}.`;
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedErrorMsg);
        });

        test('should end turn if turnContext.getStrategy returns null', async () => {
            mockTestTurnContext.getStrategy.mockReturnValue(null);
            await awaitingPlayerInputState.enterState();
            expect(superEnterSpy).toHaveBeenCalledWith(awaitingPlayerInputState._handler, null);
            const expectedErrorMsg = `AwaitingPlayerInputState: No valid IActorTurnStrategy found for actor ${testActor.id} or strategy is malformed (missing decideAction).`;
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg, {strategyReceived: null});
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedErrorMsg);
        });

        test('should end turn if strategy from getStrategy() is malformed (missing decideAction)', async () => {
            const malformedStrategy = {name: 'MalformedStrategy'};
            mockTestTurnContext.getStrategy.mockReturnValue(malformedStrategy);
            await awaitingPlayerInputState.enterState();
            expect(superEnterSpy).toHaveBeenCalledWith(awaitingPlayerInputState._handler, null);
            const expectedErrorMsg = `AwaitingPlayerInputState: No valid IActorTurnStrategy found for actor ${testActor.id} or strategy is malformed (missing decideAction).`;
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg, {strategyReceived: malformedStrategy});
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedErrorMsg);
        });

        test('should end turn if strategy.decideAction throws an error', async () => {
            const strategyError = new Error('Strategy decision failed spectacularly');
            mockTestStrategy.decideAction.mockRejectedValue(strategyError);
            await awaitingPlayerInputState.enterState();
            expect(superEnterSpy).toHaveBeenCalledWith(awaitingPlayerInputState._handler, null);
            const expectedLogMessage = `${awaitingPlayerInputState.name}: Error during action decision, storage, or transition for actor ${testActor.id}: ${strategyError.message}`;
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage, {originalError: strategyError});
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            const endTurnError = mockTestTurnContext.endTurn.mock.calls[0][0];
            expect(endTurnError.message).toBe(expectedLogMessage);
            expect(endTurnError.cause).toBe(strategyError);
        });

        test('should end turn if strategy.decideAction returns null', async () => {
            mockTestStrategy.decideAction.mockResolvedValue(null);
            await awaitingPlayerInputState.enterState();
            expect(superEnterSpy).toHaveBeenCalledWith(awaitingPlayerInputState._handler, null);
            const expectedWarnMsg = `AwaitingPlayerInputState: Strategy for actor ${testActor.id} returned an invalid or null ITurnAction (must have actionDefinitionId).`;
            expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarnMsg, {receivedAction: null});
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedWarnMsg);
        });

        test('should end turn if strategy.decideAction returns ITurnAction without actionDefinitionId', async () => {
            const invalidAction = {commandString: 'invalid', resolvedParameters: {}};
            mockTestStrategy.decideAction.mockResolvedValue(invalidAction);
            await awaitingPlayerInputState.enterState();
            expect(superEnterSpy).toHaveBeenCalledWith(awaitingPlayerInputState._handler, null);
            const expectedWarnMsg = `AwaitingPlayerInputState: Strategy for actor ${testActor.id} returned an invalid or null ITurnAction (must have actionDefinitionId).`;
            expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarnMsg, {receivedAction: invalidAction});
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedWarnMsg);
        });

        test('should end turn if requestTransition fails', async () => {
            const mockAction = createMockTurnAction('test_action', 'core:test_action');
            mockTestStrategy.decideAction.mockResolvedValue(mockAction);
            const transitionError = new Error('Transition failed miserably');
            mockTestTurnContext.requestTransition.mockRejectedValue(transitionError);
            await awaitingPlayerInputState.enterState();
            expect(superEnterSpy).toHaveBeenCalledWith(awaitingPlayerInputState._handler, null);
            expect(mockTestTurnContext.setChosenAction).toHaveBeenCalledWith(mockAction);
            const expectedLogMessage = `${awaitingPlayerInputState.name}: Error during action decision, storage, or transition for actor ${testActor.id}: ${transitionError.message}`;
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage, {originalError: transitionError});
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            const endTurnError = mockTestTurnContext.endTurn.mock.calls[0][0];
            expect(endTurnError.message).toBe(expectedLogMessage);
            expect(endTurnError.cause).toBe(transitionError);
        });

        test('should log warning but still transition if turnContext.setChosenAction is missing', async () => {
            const mockAction = createMockTurnAction('action', 'core:action');
            mockTestStrategy.decideAction.mockResolvedValue(mockAction);
            const contextWithoutSetChosenAction = {...mockTestTurnContext, setChosenAction: undefined};
            mockHandler.getTurnContext.mockReturnValue(contextWithoutSetChosenAction);
            await awaitingPlayerInputState.enterState();
            expect(superEnterSpy).toHaveBeenCalledWith(awaitingPlayerInputState._handler, null);
            expect(mockLogger.warn).toHaveBeenCalledWith(`AwaitingPlayerInputState: ITurnContext.setChosenAction() not found. Cannot store action in context. ProcessingCommandState might rely on constructor argument.`);
            expect(contextWithoutSetChosenAction.requestTransition).toHaveBeenCalledWith(
                ProcessingCommandState,
                [mockAction.commandString, mockAction]
            );
            expect(contextWithoutSetChosenAction.endTurn).not.toHaveBeenCalled();
        });
    });

    describe('handleSubmittedCommand (Stub Behavior)', () => {
        test('should log a warning and end turn if called with valid context', async () => {
            const command = "unexpected direct command";
            await awaitingPlayerInputState.handleSubmittedCommand(mockHandler, command, testActor);

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: handleSubmittedCommand was called directly for actor ${testActor.id} with command "${command}". This is unexpected in the new strategy-driven workflow. Ending turn.`));
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toMatch(`Unexpected direct command submission to AwaitingPlayerInputState for actor ${testActor.id}. Input should be strategy-driven.`);
        });

        test('should reset and transition to TurnIdleState if context is missing when called', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            const specificHandlerLogger = {...mockLogger, error: jest.fn()};
            mockHandler.getLogger.mockReturnValue(specificHandlerLogger);
            const command = "cmd_no_context";

            await awaitingPlayerInputState.handleSubmittedCommand(mockHandler, command, testActor);

            expect(specificHandlerLogger.error).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: handleSubmittedCommand (for actor ${testActor.id}, cmd: "${command}") called, but no ITurnContext. Forcing handler reset.`));
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith('no-context-submission-AwaitingPlayerInputState');
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
        });

        test('should log critical error to console if handler is null/invalid when context is missing', async () => {
            const originalHandler = awaitingPlayerInputState._handler;
            awaitingPlayerInputState._handler = null;
            const command = "cmd_no_handler";

            await awaitingPlayerInputState.handleSubmittedCommand(null, command, testActor);

            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: handleSubmittedCommand (for actor ${testActor.id}, cmd: "${command}") called, but no ITurnContext. Forcing handler reset.`));
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: CRITICAL - No ITurnContext or handler methods to process unexpected command submission or to reset.`));

            awaitingPlayerInputState._handler = originalHandler;
        });
    });

    // --- PTH-REFACTOR-003.5.7 Final Chunk: Other Methods ---

    describe('exitState', () => {
        test('should call super.exitState and log debug message', async () => {
            await awaitingPlayerInputState.exitState(); // SUT's exitState doesn't use parameters directly

            expect(superExitSpy).toHaveBeenCalledWith(awaitingPlayerInputState._handler, null);
            expect(mockLogger.debug).toHaveBeenCalledWith('AwaitingPlayerInputState: ExitState cleanup (if any) complete.');
        });

        test('should use handler logger for debug message if context is null during exit', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            const handlerOnlyLogger = {...mockLogger, debug: jest.fn()};
            mockHandler.getLogger.mockReturnValue(handlerOnlyLogger);

            await awaitingPlayerInputState.exitState();

            expect(superExitSpy).toHaveBeenCalledWith(awaitingPlayerInputState._handler, null);
            expect(handlerOnlyLogger.debug).toHaveBeenCalledWith('AwaitingPlayerInputState: ExitState cleanup (if any) complete.');
        });
    });

    describe('handleTurnEndedEvent', () => {
        let eventPayloadForCurrentActor;
        let eventPayloadForOtherActor;
        let eventPayloadWithError;

        beforeEach(() => {
            eventPayloadForCurrentActor = {entityId: testActor.id, success: true, error: null};
            eventPayloadForOtherActor = {entityId: 'other-player', success: true, error: null};
            eventPayloadWithError = {entityId: testActor.id, success: false, error: new Error("Turn ended badly")};
        });

        test('should end turn via ITurnContext if event is for current actor', async () => {
            await awaitingPlayerInputState.handleTurnEndedEvent(mockHandler, eventPayloadForCurrentActor);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: core:turn_ended event received for current actor ${testActor.id}. Ending turn.`));
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(null);
            expect(superHandleTurnEndedEventSpy).not.toHaveBeenCalled();
        });

        test('should end turn via ITurnContext with error if event is for current actor and has error', async () => {
            await awaitingPlayerInputState.handleTurnEndedEvent(mockHandler, eventPayloadWithError);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: core:turn_ended event received for current actor ${testActor.id}. Ending turn.`));
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(eventPayloadWithError.error);
            expect(superHandleTurnEndedEventSpy).not.toHaveBeenCalled();
        });

        test('should call super.handleTurnEndedEvent if event is not for current actor', async () => {
            await awaitingPlayerInputState.handleTurnEndedEvent(mockHandler, eventPayloadForOtherActor);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: core:turn_ended event for actor ${eventPayloadForOtherActor.entityId} is not for current context actor ${testActor.id}. Deferring to superclass.`));
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
            expect(superHandleTurnEndedEventSpy).toHaveBeenCalledWith(mockHandler, eventPayloadForOtherActor);
        });

        test('should call super.handleTurnEndedEvent if no actor in context', async () => {
            mockTestTurnContext.getActor.mockReturnValue(null);
            await awaitingPlayerInputState.handleTurnEndedEvent(mockHandler, eventPayloadForCurrentActor);
            // CORRECTED: Expect "undefined" instead of "null" for currentActor?.id when currentActor is null
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: core:turn_ended event for actor ${eventPayloadForCurrentActor.entityId} is not for current context actor undefined. Deferring to superclass.`));
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
            expect(superHandleTurnEndedEventSpy).toHaveBeenCalledWith(mockHandler, eventPayloadForCurrentActor);
        });

        test('should call super.handleTurnEndedEvent and use handler logger if no context', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            const specificHandlerLogger = {...mockLogger, warn: jest.fn(), debug: jest.fn()};
            mockHandler.getLogger.mockReturnValue(specificHandlerLogger);

            await awaitingPlayerInputState.handleTurnEndedEvent(mockHandler, eventPayloadForCurrentActor);

            // CORRECTED: Construct the expected string carefully to match JSON.stringify output
            const expectedPayloadString = JSON.stringify(eventPayloadForCurrentActor);
            expect(specificHandlerLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: handleTurnEndedEvent received but no turn context. Payload: ${expectedPayloadString}. Deferring to superclass.`));
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
            expect(superHandleTurnEndedEventSpy).toHaveBeenCalledWith(mockHandler, eventPayloadForCurrentActor);
        });
    });

    describe('destroy', () => {
        test('should end turn via context and call super.destroy if context and actor exist', async () => {
            await awaitingPlayerInputState.destroy(mockHandler);

            const expectedErrorMessage = `Turn handler destroyed while actor ${testActor.id} was in AwaitingPlayerInputState.`;
            expect(mockLogger.info).toHaveBeenCalledWith(`AwaitingPlayerInputState: Handler destroyed while state was active for actor ${testActor.id}. Ending turn via turnContext.`);
            expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(expectedErrorMessage);
            expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
        });

        test('should log warning and call super.destroy if context exists but no actor in context', async () => {
            mockTestTurnContext.getActor.mockReturnValue(null);
            await awaitingPlayerInputState.destroy(mockHandler);

            expect(mockLogger.warn).toHaveBeenCalledWith(`AwaitingPlayerInputState: Handler destroyed. Actor ID from context: N/A_in_context. No specific turn to end via context if actor is missing.`);
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
            expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
        });

        test('should log warning and call super.destroy if context is missing', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            const specificHandlerLogger = {...mockLogger, warn: jest.fn(), info: jest.fn()};
            mockHandler.getLogger.mockReturnValue(specificHandlerLogger);

            await awaitingPlayerInputState.destroy(mockHandler);

            expect(specificHandlerLogger.warn).toHaveBeenCalledWith(`AwaitingPlayerInputState: Handler destroyed. Actor ID from context: N/A_no_context. No specific turn to end via context if actor is missing.`);
            expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
            expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
        });
    });

    describe('Inapplicable AbstractTurnState Methods', () => {
        const inapplicableMethods = [
            {name: 'startTurn', args: [mockHandler, testActor]},
            {name: 'processCommandResult', args: [mockHandler, testActor, {}, "cmd"]},
            {name: 'handleDirective', args: [mockHandler, testActor, "DIR_TEST", {}]},
        ];

        inapplicableMethods.forEach(methodInfo => {
            test(`${methodInfo.name} should call super (which logs/throws by default)`, async () => {
                jest.spyOn(AbstractTurnState.prototype, methodInfo.name).mockRestore();
                const superMethodImplSpy = jest.spyOn(AbstractTurnState.prototype, methodInfo.name)
                    .mockImplementationOnce(async function (...args) {
                        const stateName = this.getStateName ? this.getStateName() : 'AbstractState';
                        const logger = this._handler?.getLogger() ?? console;
                        logger.warn(`MockedAbstract.${methodInfo.name} called on ${stateName}`);
                        throw new Error(`MockedAbstract.${methodInfo.name} called on ${stateName} and threw`);
                    });

                await expect(awaitingPlayerInputState[methodInfo.name](...methodInfo.args))
                    .rejects
                    .toThrow(`MockedAbstract.${methodInfo.name} called on AwaitingPlayerInputState and threw`);

                expect(superMethodImplSpy).toHaveBeenCalledWith(...methodInfo.args);
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    `MockedAbstract.${methodInfo.name} called on AwaitingPlayerInputState`
                );
                superMethodImplSpy.mockRestore();
            });
        });
    });
});

// --- FILE END ---