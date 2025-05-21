// src/tests/core/turns/states/processingCommandState.test.js

import {describe, test, expect, jest, beforeEach, it, afterEach} from '@jest/globals';
import {ProcessingCommandState} from '../../../src/turns/states/processingCommandState.js';
import {TurnIdleState} from '../../../src/turns/states/turnIdleState.js';
import TurnDirectiveStrategyResolver from '../../../src/turns/strategies/turnDirectiveStrategyResolver.js';
import {SYSTEM_ERROR_OCCURRED_ID} from '../../../src/constants/eventIds.js';
import TurnDirective from "../../../src/turns/constants/turnDirectives.js";
import {AwaitingPlayerInputState} from '../../../src/turns/states/awaitingPlayerInputState.js';
import {AwaitingExternalTurnEndState} from '../../../src/turns/states/awaitingExternalTurnEndState.js';

// Mock Actor class (simplified)
class MockActor {
    constructor(id = 'actor123') {
        this._id = id;
    }

    getId() {
        return this._id;
    }

    get id() {
        return this._id;
    }
}

// Mock implementations
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    createChildLogger: jest.fn().mockReturnThis(),
};

// CORRECTED: mockCommandProcessor definition
const mockCommandProcessor = {
    processCommand: jest.fn(), // Changed from 'process' to 'processCommand'
};

const mockCommandOutcomeInterpreter = {
    interpret: jest.fn(),
};

const mockSafeEventDispatcher = {
    dispatchSafely: jest.fn(),
};

const mockTurnDirectiveStrategy = {
    execute: jest.fn().mockResolvedValue(undefined),
    constructor: {name: 'MockTurnDirectiveStrategy'}
};

const mockEndTurnSuccessStrategy = {
    execute: jest.fn().mockImplementation(async (turnContext) => {
        turnContext.endTurn(null);
    }),
    constructor: {name: 'MockEndTurnSuccessStrategy'},
};

const mockEndTurnFailureStrategy = {
    execute: jest.fn().mockImplementation(async (turnContext, directive, cmdResult) => {
        turnContext.endTurn(cmdResult?.error || new Error("Failure strategy executed"));
    }),
    constructor: {name: 'MockEndTurnFailureStrategy'},
};

const mockRepromptStrategy = {
    execute: jest.fn().mockImplementation(async (turnContext) => {
        await turnContext.requestTransition(AwaitingPlayerInputState, []);
    }),
    constructor: {name: 'MockRepromptStrategy'},
};

const mockWaitForEventStrategy = {
    execute: jest.fn().mockImplementation(async (turnContext) => {
        await turnContext.requestTransition(AwaitingExternalTurnEndState, []);
    }),
    constructor: {name: 'MockWaitForEventStrategy'},
};


let mockTurnContext;
let mockHandler;

jest.mock('../../../src/turns/strategies/turnDirectiveStrategyResolver.js', () => ({
    __esModule: true,
    default: {
        resolveStrategy: jest.fn(),
    }
}));

describe('ProcessingCommandState', () => {
    let processingState;
    const commandString = 'do something';
    const defaultActionDefinitionId = 'testAction';
    let actor;
    const testError = new Error('Test Exception');
    let consoleErrorSpy;
    let consoleWarnSpy;
    let mockTurnAction;
    let mockSuccessfulCommandResult; // Renamed for clarity and adjusted structure
    let mockFailedCommandResult;


    beforeEach(() => {
        jest.clearAllMocks();
        actor = new MockActor('testActor');

        mockTurnAction = {
            actionDefinitionId: defaultActionDefinitionId,
            commandString: commandString,
            resolvedParameters: {param1: 'value1'}
        };

        // Adjusted to align with CommandResult typedef
        mockSuccessfulCommandResult = {
            success: true,
            turnEnded: false,
            // No 'output' or 'Succeeded' in CommandResult typedef
        };

        mockFailedCommandResult = {
            success: false,
            turnEnded: false,
            error: "CommandProcFailure", // User-facing error
            internalError: "Detailed CommandProcFailure"
        };


        mockTurnContext = {
            getLogger: jest.fn().mockReturnValue(mockLogger),
            getActor: jest.fn().mockReturnValue(actor),
            getCommandProcessor: jest.fn().mockReturnValue(mockCommandProcessor),
            getCommandOutcomeInterpreter: jest.fn().mockReturnValue(mockCommandOutcomeInterpreter),
            getSafeEventDispatcher: jest.fn().mockReturnValue(mockSafeEventDispatcher),
            endTurn: jest.fn().mockImplementation((_err) => {
                if (mockHandler._currentState === processingState ||
                    mockHandler._currentState?.constructor?.name === 'ProcessingCommandState') {
                    const TurnEndingStateActual = jest.requireActual('../../../src/turns/states/turnEndingState.js').TurnEndingState;
                    const currentActorForEndTurn = mockTurnContext.getActor ? (mockTurnContext.getActor()?.id || 'unknownFromEndTurn') : 'unknownNoGetActor';
                    const turnEndingState = new TurnEndingStateActual(mockHandler, currentActorForEndTurn, _err);

                    const oldState = mockHandler._currentState;
                    if (oldState && typeof oldState.exitState === 'function') {
                        Promise.resolve(oldState.exitState(mockHandler, turnEndingState))
                            .catch(e => mockLogger.debug("Error in mock oldState.exitState (during endTurn mock):", e));
                    }
                    mockHandler._currentState = turnEndingState;
                    if (typeof turnEndingState.enterState === 'function') {
                        Promise.resolve(turnEndingState.enterState(mockHandler, oldState))
                            .catch(e => mockLogger.debug("Error in mock turnEndingState.enterState (during endTurn mock):", e));
                    }

                    if (mockHandler._currentState === turnEndingState) {
                        const oldEndingState = mockHandler._currentState;
                        const idleState = new TurnIdleState(mockHandler);
                        if (oldEndingState && typeof oldEndingState.exitState === 'function') {
                            Promise.resolve(oldEndingState.exitState(mockHandler, idleState))
                                .catch(e => mockLogger.debug("Error in mock oldEndingState.exitState (during endTurn mock):", e));
                        }
                        mockHandler._currentState = idleState;
                        if (typeof idleState.enterState === 'function') {
                            Promise.resolve(idleState.enterState(mockHandler, oldEndingState))
                                .catch(e => mockLogger.debug("Error in mock idleState.enterState (during endTurn mock):", e));
                        }
                    }
                }
                return Promise.resolve();
            }),
            isValid: jest.fn().mockReturnValue(true),
            requestTransition: jest.fn().mockImplementation(async (NewStateClass, argsArray = []) => {
                const oldState = mockHandler._currentState;
                const newStateInstance = new NewStateClass(mockHandler, ...argsArray);

                if (oldState && typeof oldState.exitState === 'function') {
                    await oldState.exitState(mockHandler, newStateInstance);
                }
                mockHandler._currentState = newStateInstance;
                if (newStateInstance && typeof newStateInstance.enterState === 'function') {
                    await newStateInstance.enterState(mockHandler, oldState);
                }
                if (processingState && processingState['_isProcessing'] && oldState === processingState) {
                    processingState['_isProcessing'] = false;
                }
                return Promise.resolve();
            }),
            getChosenAction: jest.fn().mockReturnValue(mockTurnAction),
            getTurnEndPort: jest.fn().mockReturnValue({notifyTurnEnded: jest.fn()}),
            getSubscriptionManager: jest.fn().mockReturnValue({
                subscribeToTurnEnded: jest.fn(),
                unsubscribeAll: jest.fn()
            }),
        };

        mockHandler = {
            getTurnContext: jest.fn().mockReturnValue(mockTurnContext),
            _transitionToState: jest.fn().mockImplementation(async newState => {
                const oldState = mockHandler._currentState;
                if (oldState && typeof oldState.exitState === 'function') {
                    await oldState.exitState(mockHandler, newState);
                }
                mockHandler._currentState = newState;
                if (newState && typeof newState.enterState === 'function') {
                    await newState.enterState(mockHandler, oldState);
                }
            }),
            _resetTurnStateAndResources: jest.fn(),
            getLogger: jest.fn().mockReturnValue(mockLogger),
            _currentState: null,
        };

        TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(mockTurnDirectiveStrategy);
        processingState = new ProcessingCommandState(mockHandler, null, null);
        mockHandler._currentState = processingState;

        mockLogger.debug.mockClear();
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();

        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        jest.restoreAllMocks();
    });

    describe('_processCommandInternal (Successful Flows and Service Interactions)', () => {
        beforeEach(() => {
            mockCommandProcessor.processCommand.mockReset().mockResolvedValue(mockSuccessfulCommandResult);
            mockCommandOutcomeInterpreter.interpret.mockReset().mockReturnValue(TurnDirective.END_TURN_SUCCESS);
            TurnDirectiveStrategyResolver.resolveStrategy.mockReset().mockReturnValue(mockEndTurnSuccessStrategy);
            mockEndTurnSuccessStrategy.execute.mockClear();
            mockEndTurnFailureStrategy.execute.mockClear();
            mockRepromptStrategy.execute.mockClear();
            mockWaitForEventStrategy.execute.mockClear();
            mockTurnContext.requestTransition.mockClear();
            mockTurnContext.endTurn.mockClear();

            mockTurnContext.getActor.mockReturnValue(actor);
            mockTurnContext.isValid.mockReturnValue(true);
            mockTurnContext.getChosenAction.mockReturnValue(mockTurnAction); // Ensure chosen action is available
            processingState['_isProcessing'] = true; // Simulate processing started
        });

        it('should correctly call ICommandProcessor.processCommand with actor and command string', async () => {
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(mockCommandProcessor.processCommand).toHaveBeenCalledTimes(1);
            // SUT derives commandStringToProcess from turnAction.commandString or turnAction.actionDefinitionId
            const expectedCommandString = mockTurnAction.commandString || mockTurnAction.actionDefinitionId;
            expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(actor, expectedCommandString);
        });

        it('should call TurnDirectiveStrategyResolver.resolveStrategy with the directive from interpreter', async () => {
            mockCommandOutcomeInterpreter.interpret.mockReturnValueOnce(TurnDirective.RE_PROMPT);
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(TurnDirectiveStrategyResolver.resolveStrategy).toHaveBeenCalledWith(TurnDirective.RE_PROMPT);
        });

        it('should execute the resolved ITurnDirectiveStrategy with correct parameters', async () => {
            TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValueOnce(mockRepromptStrategy);
            mockCommandOutcomeInterpreter.interpret.mockReturnValueOnce(TurnDirective.RE_PROMPT);
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(mockRepromptStrategy.execute).toHaveBeenCalledWith(mockTurnContext, TurnDirective.RE_PROMPT, mockSuccessfulCommandResult);
        });

        it('should handle successful command processing leading to END_TURN_SUCCESS', async () => {
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(mockEndTurnSuccessStrategy.execute).toHaveBeenCalledWith(mockTurnContext, TurnDirective.END_TURN_SUCCESS, mockSuccessfulCommandResult);
            await new Promise(process.nextTick); // Allow async operations in strategy to complete
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should handle failed command processing (CommandResult success:false) leading to END_TURN_FAILURE', async () => {
            mockCommandProcessor.processCommand.mockResolvedValue(mockFailedCommandResult);
            mockCommandOutcomeInterpreter.interpret.mockReturnValue(TurnDirective.END_TURN_FAILURE);
            TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(mockEndTurnFailureStrategy);
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(mockEndTurnFailureStrategy.execute).toHaveBeenCalledWith(mockTurnContext, TurnDirective.END_TURN_FAILURE, mockFailedCommandResult);
            await new Promise(process.nextTick);
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should handle RE_PROMPT directive and set _isProcessing to false due to transition', async () => {
            mockCommandOutcomeInterpreter.interpret.mockReturnValue(TurnDirective.RE_PROMPT);
            TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(mockRepromptStrategy);
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(mockRepromptStrategy.execute).toHaveBeenCalledWith(mockTurnContext, TurnDirective.RE_PROMPT, mockSuccessfulCommandResult);
            expect(mockTurnContext.requestTransition).toHaveBeenCalledWith(AwaitingPlayerInputState, []);
            // The mock for requestTransition now sets _isProcessing to false
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should handle WAIT_FOR_EVENT directive and set _isProcessing to false due to transition', async () => {
            mockCommandOutcomeInterpreter.interpret.mockReturnValue(TurnDirective.WAIT_FOR_EVENT);
            TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(mockWaitForEventStrategy);
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(mockWaitForEventStrategy.execute).toHaveBeenCalledWith(mockTurnContext, TurnDirective.WAIT_FOR_EVENT, mockSuccessfulCommandResult);
            expect(mockTurnContext.requestTransition).toHaveBeenCalledWith(AwaitingExternalTurnEndState, []);
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should correctly manage _isProcessing flag if no transition occurs after strategy execution but turn ends', async () => {
            const nonTransitioningEndTurnStrategy = {
                execute: jest.fn().mockImplementation(async (tc) => {
                    await tc.endTurn(null); // Strategy ends the turn
                }),
                constructor: {name: "NonTransitioningEndTurnStrategy"}
            };
            mockCommandOutcomeInterpreter.interpret.mockReturnValue(TurnDirective.END_TURN_SUCCESS);
            TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(nonTransitioningEndTurnStrategy);

            processingState['_isProcessing'] = true; // Ensure it starts as true
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);

            expect(nonTransitioningEndTurnStrategy.execute).toHaveBeenCalled();
            expect(mockTurnContext.requestTransition).not.toHaveBeenCalled();
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(null);
            // The endTurn mock will cause a transition to TurnEndingState and then TurnIdleState.
            // If _processCommandInternal itself doesn't set _isProcessing = false before that (e.g. strategy doesn't transition)
            // the finally block in _processCommandInternal will set it.
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should process ITurnAction even if commandString is missing, using actionDefinitionId', async () => {
            const actionNoCommandString = {
                actionDefinitionId: 'actionWithoutCommandStr',
                // commandString is missing/undefined
                resolvedParameters: {p: 1}
            };
            mockCommandOutcomeInterpreter.interpret.mockReturnValue(TurnDirective.END_TURN_SUCCESS);
            TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(mockEndTurnSuccessStrategy);

            await processingState['_processCommandInternal'](mockTurnContext, actor, actionNoCommandString);

            // SUT uses actionDefinitionId as fallback for commandStringToProcess
            expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(actor, actionNoCommandString.actionDefinitionId);
            expect(mockEndTurnSuccessStrategy.execute).toHaveBeenCalled();
            await new Promise(process.nextTick);
            expect(processingState['_isProcessing']).toBe(false);
        });
    });

    describe('exitState', () => {
        beforeEach(() => {
            mockLogger.debug.mockClear();
            mockLogger.warn.mockClear();
            mockTurnContext.getActor.mockReturnValue(actor);
        });

        it('should set _isProcessing to false and log exit', async () => {
            processingState['_isProcessing'] = false;
            const nextState = new TurnIdleState(mockHandler);
            mockTurnContext.getActor.mockReturnValue(actor);
            await processingState.exitState(mockHandler, nextState);
            expect(processingState['_isProcessing']).toBe(false);
            const expectedLog = `ProcessingCommandState: Exiting for actor: ${actor.getId()}. Transitioning to TurnIdleState.`;
            // Check if any of the calls to debug include the expected log string
            expect(mockLogger.debug.mock.calls.some(call => call[0].includes(expectedLog))).toBe(true);
        });
    });

    describe('destroy', () => {
        let superDestroySpy;
        beforeEach(() => {
            mockTurnContext.getActor.mockReturnValue(actor);
            mockLogger.debug.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockTurnContext.endTurn.mockClear();
            // Spy on the superclass's destroy method
            superDestroySpy = jest.spyOn(Object.getPrototypeOf(ProcessingCommandState.prototype), 'destroy').mockResolvedValue(undefined);
        });

        afterEach(() => {
            superDestroySpy.mockRestore();
        });

        it('should set _isProcessing to false', async () => {
            processingState['_isProcessing'] = true;
            await processingState.destroy(mockHandler);
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should log destruction and call super.destroy', async () => {
            await processingState.destroy(mockHandler);
            const expectedActorIdForLog = actor.getId();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`ProcessingCommandState: Destroying for actor: ${expectedActorIdForLog}.`));
            expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`ProcessingCommandState: Destroy handling for actor ${expectedActorIdForLog} complete.`));
        });
    });
});