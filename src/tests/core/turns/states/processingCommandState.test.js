// src/tests/core/turns/states/processingCommandState.test.js

import {describe, test, expect, jest, beforeEach, it, afterEach} from '@jest/globals';
import {ProcessingCommandState} from '../../../../core/turns/states/processingCommandState.js';
import {TurnIdleState} from '../../../../core/turns/states/turnIdleState.js';
import TurnDirectiveStrategyResolver from '../../../../core/turns/strategies/turnDirectiveStrategyResolver.js';
import {SYSTEM_ERROR_OCCURRED_ID} from '../../../../core/constants/eventIds.js';
import TurnDirective from "../../../../core/turns/constants/turnDirectives.js";
import {AwaitingPlayerInputState} from '../../../../core/turns/states/awaitingPlayerInputState.js';
import {AwaitingExternalTurnEndState} from '../../../../core/turns/states/awaitingExternalTurnEndState.js';

// Mock Actor class (simplified)
class MockActor {
    constructor(id = 'actor123') {
        this._id = id;
    }

    getId() {
        return this._id;
    }

    get id() { // For convenience if accidentally used, though getId() is preferred
        return this._id;
    }
}

// Mock implementations
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    createChildLogger: jest.fn().mockReturnThis(), // Chainable for child loggers
};

const mockCommandProcessor = {
    process: jest.fn(),
};

const mockCommandOutcomeInterpreter = {
    interpret: jest.fn(),
};

const mockSafeEventDispatcher = {
    dispatchSafely: jest.fn(),
};

const mockTurnDirectiveStrategy = {
    execute: jest.fn().mockResolvedValue(undefined), // Ensure it returns a promise
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
        await turnContext.requestTransition(AwaitingPlayerInputState, []); // Pass empty args array
    }),
    constructor: {name: 'MockRepromptStrategy'},
};

const mockWaitForEventStrategy = {
    execute: jest.fn().mockImplementation(async (turnContext) => {
        await turnContext.requestTransition(AwaitingExternalTurnEndState, []); // Pass empty args array
    }),
    constructor: {name: 'MockWaitForEventStrategy'},
};


let mockTurnContext;
let mockHandler;
// Define mockSuccessfulCommandResult in a scope accessible by all relevant tests if needed,
// or locally in tests that use it. For now, we'll define it locally in the one test that had the ReferenceError.
// let mockSuccessfulCommandResult; <= No, will define locally in test

jest.mock('../../../../core/turns/strategies/turnDirectiveStrategyResolver.js', () => ({
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
    // This mockSuccessfulCommandResult is for the "Successful Flows" describe block
    let mockSuccessfulCommandResultForSuccessFlows;


    beforeEach(() => {
        jest.clearAllMocks();
        actor = new MockActor('testActor');

        mockTurnAction = {
            actionDefinitionId: defaultActionDefinitionId,
            commandString: commandString,
            resolvedParameters: {param1: 'value1'}
        };

        // Initialize for the success flow tests
        mockSuccessfulCommandResultForSuccessFlows = {
            success: true,
            Succeeded: true,
            output: 'Action successful for success flow!',
            error: null
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
                    const TurnEndingStateActual = jest.requireActual('../../../../core/turns/states/turnEndingState.js').TurnEndingState;
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

    // ... other describe blocks (enterState) ...
    describe('enterState', () => {
        it('should log entry, set _isProcessing to true, and initiate _processCommandInternal', async () => {
            const specificActionForThisTest = {
                actionDefinitionId: 'testActionEnter',
                commandString: 'specific command for enter test',
                resolvedParameters: {}
            };
            mockTurnContext.getChosenAction.mockReturnValueOnce(specificActionForThisTest);

            let resolveProcessInternal;
            const processInternalPromise = new Promise(resolve => {
                resolveProcessInternal = resolve;
            });

            const processCommandInternalSpy = jest.spyOn(processingState, '_processCommandInternal')
                .mockImplementation(async () => {
                    await processInternalPromise;
                    if (mockHandler._currentState === processingState) {
                        processingState['_isProcessing'] = false;
                    }
                });

            await processingState.enterState(mockHandler, null);

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(
                `ProcessingCommandState: Entered. Actor: ${actor.getId()}. Previous state: None.`
            ));
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `ProcessingCommandState: Entering with command: "null" for actor: ${actor.getId()}`
            );
            expect(processingState['_isProcessing']).toBe(true);
            expect(processCommandInternalSpy).toHaveBeenCalledWith(mockTurnContext, actor, specificActionForThisTest);

            resolveProcessInternal();
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);

            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should handle null turn context on entry and use handler reset', async () => {
            mockHandler.getTurnContext.mockReturnValueOnce(null);
            const processCommandInternalSpy = jest.spyOn(processingState, '_processCommandInternal').mockResolvedValue(undefined);
            await processingState.enterState(mockHandler, null);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ProcessingCommandState: Turn context is null on enter. Attempting to reset and idle.'
            );
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(`critical-no-context-${processingState.getStateName()}`);
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
            expect(processCommandInternalSpy).not.toHaveBeenCalled();
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should handle missing actor on entry and call #handleProcessingException effects', async () => {
            mockTurnContext.getActor.mockReturnValue(null);

            await processingState.enterState(mockHandler, null);
            await new Promise(resolve => process.nextTick(resolve));
            await new Promise(resolve => process.nextTick(resolve));

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(
                `ProcessingCommandState: Entered. Actor: N/A. Previous state: None.`
            ));
            const expectedErrorObject = expect.objectContaining({message: 'No actor present at the start of command processing.'});
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringMatching(/ProcessingCommandState: Error during command processing for actor (N\/A|NoActorOnEnter): No actor present at the start of command processing./),
                expectedErrorObject
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
                SYSTEM_ERROR_OCCURRED_ID,
                expect.objectContaining({
                    error: expectedErrorObject,
                    actorId: expect.stringMatching(/^(N\/A|NoActorOnEnter)$/),
                    turnState: 'ProcessingCommandState'
                })
            );
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should use constructor-passed ITurnAction if it exists, overriding context action', async () => {
            const constructorAction = {
                actionDefinitionId: 'constructorAction',
                commandString: 'from_constructor',
                resolvedParameters: {cons: 1}
            };
            const stateWithConstructorAction = new ProcessingCommandState(mockHandler, 'from_constructor_cmd_str', constructorAction);
            mockHandler._currentState = stateWithConstructorAction;

            const processInternalSpy = jest.spyOn(stateWithConstructorAction, '_processCommandInternal').mockResolvedValue(undefined);
            mockLogger.debug.mockClear();

            await stateWithConstructorAction.enterState(mockHandler, null);
            await new Promise(resolve => process.nextTick(resolve));

            expect(mockTurnContext.getChosenAction).not.toHaveBeenCalled();
            expect(mockLogger.debug).not.toHaveBeenCalledWith(
                expect.stringContaining(`No turnAction passed via constructor. Retrieving from turnContext.getChosenAction()`)
            );
            expect(processInternalSpy).toHaveBeenCalledWith(mockTurnContext, actor, constructorAction);
        });

        it('should prioritize ITurnAction from turnContext.getChosenAction() if constructor-passed action is null', async () => {
            const contextAction = {
                actionDefinitionId: 'contextAction',
                commandString: 'from_context',
                resolvedParameters: {ctx: 1}
            };
            mockTurnContext.getChosenAction.mockReturnValueOnce(contextAction);
            const processInternalSpy = jest.spyOn(processingState, '_processCommandInternal').mockResolvedValue(undefined);

            await processingState.enterState(mockHandler, null);
            await new Promise(resolve => process.nextTick(resolve));

            expect(mockLogger.debug).toHaveBeenCalledWith(
                `ProcessingCommandState: No turnAction passed via constructor. Retrieving from turnContext.getChosenAction() for actor ${actor.getId()}.`
            );
            expect(processInternalSpy).toHaveBeenCalledWith(mockTurnContext, actor, contextAction);
        });

        it('should handle error if getChosenAction returns invalid ITurnAction (missing actionDefinitionId)', async () => {
            mockTurnContext.getChosenAction.mockReturnValueOnce({commandString: 'invalid', resolvedParameters: {}});
            await processingState.enterState(mockHandler, null);
            await new Promise(resolve => process.nextTick(resolve));
            await new Promise(resolve => process.nextTick(resolve));

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`ProcessingCommandState: ITurnAction for actor ${actor.getId()} is invalid: missing or empty actionDefinitionId.`),
                expect.objectContaining({receivedAction: {commandString: 'invalid', resolvedParameters: {}}})
            );
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should handle error if getChosenAction returns null', async () => {
            mockTurnContext.getChosenAction.mockReturnValueOnce(null);
            await processingState.enterState(mockHandler, null);
            await new Promise(resolve => process.nextTick(resolve));
            await new Promise(resolve => process.nextTick(resolve));

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`ProcessingCommandState: No ITurnAction available (neither from constructor nor context.getChosenAction()) for actor ${actor.getId()}. Cannot process command.`)
            );
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should call #handleProcessingException effects if _processCommandInternal rejects', async () => {
            const specificError = new Error('ProcessFailInEnter');
            mockTurnContext.getChosenAction.mockReturnValue({
                actionDefinitionId: 'validAction', commandString: 'valid', resolvedParameters: {}
            });
            const processInternalSpy = jest.spyOn(processingState, '_processCommandInternal').mockRejectedValue(specificError);

            await processingState.enterState(mockHandler, null);
            await new Promise(resolve => process.nextTick(resolve));
            await new Promise(resolve => process.nextTick(resolve));

            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Uncaught error from _processCommandInternal scope. Error: ${specificError.message}`,
                specificError
            );
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${specificError.message}`,
                specificError
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
                SYSTEM_ERROR_OCCURRED_ID,
                expect.objectContaining({error: specificError, actorId: actor.getId()})
            );
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(specificError);
            expect(processingState['_isProcessing']).toBe(false);
        });
    });


    describe('#handleProcessingException (private method - testing via effects)', () => {
        const mockTurnActionForExceptionTest = {
            actionDefinitionId: 'testPrivateAction', commandString: commandString, resolvedParameters: {}
        };
        beforeEach(() => {
            mockTurnContext.getActor.mockReturnValue(actor);
            mockTurnContext.isValid.mockReturnValue(true);
            mockCommandProcessor.process.mockReset();
            processingState['_isProcessing'] = true;
        });

        it('should log error, dispatch system error event, and end turn if process throws', async () => {
            mockCommandProcessor.process.mockRejectedValueOnce(testError);
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnActionForExceptionTest);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${testError.message}`, testError
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
                SYSTEM_ERROR_OCCURRED_ID, expect.objectContaining({error: testError, actorId: actor.getId()})
            );
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(testError);
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should handle missing SafeEventDispatcher gracefully during exception handling', async () => {
            mockTurnContext.getSafeEventDispatcher.mockReturnValueOnce(null);
            mockCommandProcessor.process.mockRejectedValueOnce(testError);
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnActionForExceptionTest);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${testError.message}`, testError
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `ProcessingCommandState: SafeEventDispatcher service not available or invalid from ITurnContext for actor ${actor.getId()}. Cannot dispatch system error event.`
            );
            expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalled();
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(testError);
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should handle failure in dispatchSafely gracefully during exception handling', async () => {
            const dispatchError = new Error('Dispatch Failed');
            mockSafeEventDispatcher.dispatchSafely.mockImplementationOnce(async () => {
                throw dispatchError;
            });
            mockCommandProcessor.process.mockRejectedValueOnce(testError);
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnActionForExceptionTest);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${testError.message}`, testError
            );
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Failed to dispatch SYSTEM_ERROR_OCCURRED_ID event for actor ${actor.getId()}: ${dispatchError.message}`, dispatchError
            );
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(testError);
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should use fallback reset if context is critically broken when #handleProcessingException is entered', async () => {
            const originalGetTurnContext = mockHandler.getTurnContext;
            mockHandler.getTurnContext = jest.fn()
                .mockReturnValueOnce(mockTurnContext)
                .mockReturnValueOnce({});

            mockCommandProcessor.process.mockRejectedValueOnce(testError);
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnActionForExceptionTest);
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);

            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
            expect(processingState['_isProcessing']).toBe(false);
            mockHandler.getTurnContext = originalGetTurnContext;
        });

        it('should set _isProcessing to false after an exception, regardless of shouldEndTurn parameter to #handleProcessingException', async () => {
            mockCommandProcessor.process.mockRejectedValueOnce(testError);
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnActionForExceptionTest);
            expect(processingState['_isProcessing']).toBe(false);
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(testError);
        });
    });

    describe('_processCommandInternal (Successful Flows and Service Interactions)', () => {
        // Note: mockSuccessfulCommandResultForSuccessFlows is used here.
        let mockFailedCommandResult;

        beforeEach(() => {
            // mockSuccessfulCommandResultForSuccessFlows is initialized in the parent beforeEach
            mockFailedCommandResult = {
                success: false,
                Succeeded: false,
                output: 'Action failed.',
                error: new Error("CommandProcFailure")
            };
            mockCommandProcessor.process.mockReset().mockResolvedValue(mockSuccessfulCommandResultForSuccessFlows); // Use the correctly scoped variable
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
            mockTurnContext.getChosenAction.mockReturnValue(mockTurnAction);
            processingState['_isProcessing'] = true;
        });

        it('should correctly call ICommandProcessor.process with ITurnAction data', async () => {
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(mockCommandProcessor.process).toHaveBeenCalledTimes(1);
            expect(mockCommandProcessor.process).toHaveBeenCalledWith(mockTurnContext, actor, mockTurnAction);
        });

        it('should call ICommandOutcomeInterpreter.interpret with the result from command processor', async () => {
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(mockSuccessfulCommandResultForSuccessFlows);
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
            expect(mockRepromptStrategy.execute).toHaveBeenCalledWith(mockTurnContext, TurnDirective.RE_PROMPT, mockSuccessfulCommandResultForSuccessFlows);
        });

        it('should handle successful command processing leading to END_TURN_SUCCESS', async () => {
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(mockEndTurnSuccessStrategy.execute).toHaveBeenCalledWith(mockTurnContext, TurnDirective.END_TURN_SUCCESS, mockSuccessfulCommandResultForSuccessFlows);
            await new Promise(process.nextTick);
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should handle failed command processing (CommandResult success:false) leading to END_TURN_FAILURE', async () => {
            mockCommandProcessor.process.mockResolvedValue(mockFailedCommandResult);
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
            expect(mockRepromptStrategy.execute).toHaveBeenCalledWith(mockTurnContext, TurnDirective.RE_PROMPT, mockSuccessfulCommandResultForSuccessFlows);
            expect(mockTurnContext.requestTransition).toHaveBeenCalledWith(AwaitingPlayerInputState, []);
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should handle WAIT_FOR_EVENT directive and set _isProcessing to false due to transition', async () => {
            mockCommandOutcomeInterpreter.interpret.mockReturnValue(TurnDirective.WAIT_FOR_EVENT);
            TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(mockWaitForEventStrategy);
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(mockWaitForEventStrategy.execute).toHaveBeenCalledWith(mockTurnContext, TurnDirective.WAIT_FOR_EVENT, mockSuccessfulCommandResultForSuccessFlows);
            expect(mockTurnContext.requestTransition).toHaveBeenCalledWith(AwaitingExternalTurnEndState, []);
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should correctly manage _isProcessing flag if no transition occurs after strategy execution but turn ends', async () => {
            const nonTransitioningEndTurnStrategy = {
                execute: jest.fn().mockImplementation(async (tc) => {
                    await tc.endTurn(null);
                }),
                constructor: {name: "NonTransitioningEndTurnStrategy"}
            };
            mockCommandOutcomeInterpreter.interpret.mockReturnValue(TurnDirective.END_TURN_SUCCESS);
            TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(nonTransitioningEndTurnStrategy);
            processingState['_isProcessing'] = true;
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(nonTransitioningEndTurnStrategy.execute).toHaveBeenCalled();
            expect(mockTurnContext.requestTransition).not.toHaveBeenCalled();
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(null);
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should process ITurnAction even if commandString is missing, using actionDefinitionId', async () => {
            const actionNoCommandString = {actionDefinitionId: 'actionWithoutCommandStr', resolvedParameters: {p: 1}};
            mockCommandOutcomeInterpreter.interpret.mockReturnValue(TurnDirective.END_TURN_SUCCESS);
            TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(mockEndTurnSuccessStrategy);
            await processingState['_processCommandInternal'](mockTurnContext, actor, actionNoCommandString);
            expect(mockCommandProcessor.process).toHaveBeenCalledWith(mockTurnContext, actor, actionNoCommandString);
            expect(mockEndTurnSuccessStrategy.execute).toHaveBeenCalled();
            await new Promise(process.nextTick);
            expect(processingState['_isProcessing']).toBe(false);
        });
    });

    describe('_processCommandInternal (Error Handling for Services)', () => {
        // This variable is for the specific test that had a ReferenceError
        let localMockSuccessfulCommandResult;

        beforeEach(() => {
            mockTurnContext.getActor.mockReturnValue(actor);
            processingState['_isProcessing'] = true;
            localMockSuccessfulCommandResult = {
                success: true,
                Succeeded: true,
                output: 'Action successful for error handling test!',
                error: null
            };
        });

        it('should call #handleProcessingException if getCommandProcessor fails', async () => {
            const serviceError = new Error("Cannot get proc");
            mockTurnContext.getCommandProcessor.mockImplementationOnce(() => {
                throw serviceError;
            });
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            const expectedOuterErrorMessage = `ProcessingCommandState: Failed to retrieve ICommandProcessor from ITurnContext for actor ${actor.getId()}. Error: ${serviceError.message}`;
            expect(mockLogger.error).toHaveBeenCalledWith(expectedOuterErrorMessage, serviceError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${expectedOuterErrorMessage}`,
                expect.objectContaining({message: expectedOuterErrorMessage, cause: serviceError})
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, expect.any(Object));
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.objectContaining({
                message: expectedOuterErrorMessage,
                cause: serviceError
            }));
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should call #handleProcessingException if getCommandOutcomeInterpreter fails', async () => {
            const serviceError = new Error("Cannot get interp");
            mockCommandProcessor.process.mockResolvedValue({success: true});
            mockTurnContext.getCommandOutcomeInterpreter.mockImplementationOnce(() => {
                throw serviceError;
            });
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            const expectedOuterErrorMessage = `ProcessingCommandState: Failed to retrieve ICommandOutcomeInterpreter from ITurnContext for actor ${actor.getId()}. Error: ${serviceError.message}`;
            expect(mockLogger.error).toHaveBeenCalledWith(expectedOuterErrorMessage, serviceError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${expectedOuterErrorMessage}`,
                expect.objectContaining({message: expectedOuterErrorMessage, cause: serviceError})
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, expect.any(Object));
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.objectContaining({
                message: expectedOuterErrorMessage,
                cause: serviceError
            }));
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should call #handleProcessingException if commandProcessor.process() throws', async () => {
            const processError = new Error("ProcessExecuteFail");
            mockCommandProcessor.process.mockRejectedValueOnce(processError);
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${processError.message}`, processError
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, expect.objectContaining({error: processError}));
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(processError);
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should call #handleProcessingException if commandOutcomeInterpreter.interpret() throws', async () => {
            const interpretError = new Error("InterpretFail");
            mockCommandProcessor.process.mockResolvedValue({success: true});
            mockCommandOutcomeInterpreter.interpret.mockImplementationOnce(() => {
                throw interpretError;
            });
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${interpretError.message}`, interpretError
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, expect.objectContaining({error: interpretError}));
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(interpretError);
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should call #handleProcessingException if TurnDirectiveStrategyResolver.resolveStrategy() throws (or returns invalid)', async () => {
            const resolveError = new Error("ResolveStrategyFail");
            mockCommandProcessor.process.mockResolvedValue({success: true});
            mockCommandOutcomeInterpreter.interpret.mockReturnValue(TurnDirective.END_TURN_SUCCESS);
            TurnDirectiveStrategyResolver.resolveStrategy.mockImplementationOnce(() => {
                throw resolveError;
            });
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${resolveError.message}`, resolveError
            );
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(resolveError);
            expect(processingState['_isProcessing']).toBe(false);

            TurnDirectiveStrategyResolver.resolveStrategy.mockReset();
            TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValueOnce(null);
            mockLogger.error.mockClear();
            mockTurnContext.endTurn.mockClear();
            processingState['_isProcessing'] = true;
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            const expectedErrorMsg = `ProcessingCommandState: Could not resolve ITurnDirectiveStrategy for directive '${TurnDirective.END_TURN_SUCCESS}' (actor ${actor.getId()}).`;
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(expectedErrorMsg));
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.objectContaining({message: expect.stringContaining(expectedErrorMsg)}));
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should call #handleProcessingException if resolved strategy.execute() throws', async () => {
            const strategyExecuteError = new Error("StrategyExecuteFail");
            mockCommandProcessor.process.mockResolvedValue({success: true});
            mockCommandOutcomeInterpreter.interpret.mockReturnValue(TurnDirective.END_TURN_SUCCESS);
            const faultyStrategy = {
                execute: jest.fn().mockRejectedValue(strategyExecuteError),
                constructor: {name: 'FaultyStrategy'}
            };
            TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValueOnce(faultyStrategy);
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${strategyExecuteError.message}`, strategyExecuteError
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, expect.objectContaining({error: strategyExecuteError}));
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(strategyExecuteError);
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should handle context/actor change after commandProcessor.process()', async () => {
            const originalActor = actor; // actor is 'testActor' from global beforeEach
            const otherActor = new MockActor("otherActor");

            // CORRECTED: Define mockSuccessfulCommandResult for this test's scope
            const currentTestMockSuccessfulCommandResult = {
                success: true,
                Succeeded: true,
                output: 'Action successful!',
                error: null
            };

            mockTurnContext.getActor.mockReturnValue(originalActor); // Context starts with originalActor

            mockCommandProcessor.process.mockImplementationOnce(async () => {
                // Simulate actor changing in context *during* command processing
                mockTurnContext.getActor.mockReturnValue(otherActor);
                return currentTestMockSuccessfulCommandResult; // Use the locally defined one
            });

            mockLogger.warn.mockClear();
            mockSafeEventDispatcher.dispatchSafely.mockClear();
            mockTurnContext.endTurn.mockClear();
            processingState['_isProcessing'] = true;

            await processingState['_processCommandInternal'](mockTurnContext, originalActor, mockTurnAction);
            await new Promise(resolve => process.nextTick(resolve));
            await new Promise(resolve => process.nextTick(resolve));

            // Reinstated this assertion: If the SUT is meant to log this warning, it should be checked.
            // If this fails with "0 calls", it means the SUT's specific logic path for this warning is not being hit.
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `ProcessingCommandState: Context or actor changed/invalidated after commandProcessor.process() for ${originalActor.getId()}. Aborting further processing for this turn.`
            );

            expect(mockTurnContext.endTurn).not.toHaveBeenCalled(); // Crucially, turn should not end normally by this path
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
            expect(mockLogger.debug.mock.calls.some(call => call[0].includes(expectedLog))).toBe(true);
        });

        it('should log a warning if exiting while _isProcessing was true', async () => {
            processingState['_isProcessing'] = true;
            const nextState = new TurnIdleState(mockHandler);
            mockTurnContext.getActor.mockReturnValue(actor);
            await processingState.exitState(mockHandler, nextState);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `ProcessingCommandState: Exiting for actor ${actor.getId()} while _isProcessing was true. This might indicate an incomplete or aborted operation. Transitioning to TurnIdleState.`
            );
            expect(processingState['_isProcessing']).toBe(false);
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
            superDestroySpy = jest.spyOn(Object.getPrototypeOf(ProcessingCommandState.prototype), 'destroy');
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

        it('should end turn via context if destroyed while processing', async () => {
            processingState['_isProcessing'] = true;
            mockTurnContext.getActor.mockReturnValue(actor);
            await processingState.destroy(mockHandler);
            expect(mockLogger.warn).toHaveBeenCalledWith(`ProcessingCommandState: Destroyed during active processing for actor ${actor.getId()}. Attempting to end turn if context is valid.`);
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            const errorArg = mockTurnContext.endTurn.mock.calls[0][0];
            expect(errorArg.message).toBe(`Command processing for ${actor.getId()} was destroyed mid-operation.`);
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should attempt handler reset if cannot end turn via context during destroy while processing', async () => {
            processingState['_isProcessing'] = true;
            const currentActorId = actor.getId();
            mockTurnContext.getActor.mockReturnValue(actor);
            const originalEndTurn = mockTurnContext.endTurn;
            mockTurnContext.endTurn = undefined;
            await processingState.destroy(mockHandler);
            expect(mockLogger.error).toHaveBeenCalledWith(`ProcessingCommandState: Cannot end turn via context for actor ${currentActorId} during destroy (context invalid, endTurn missing, or actor mismatch/missing).`);
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
            expect(processingState['_isProcessing']).toBe(false);
            mockTurnContext.endTurn = originalEndTurn;
        });

        it('should handle context actor mismatch during destroy while processing correctly', async () => {
            processingState['_isProcessing'] = true;
            const contextNowActor = new MockActor("contextNowActor");
            mockTurnContext.getActor.mockReturnValue(contextNowActor);
            await processingState.destroy(mockHandler);
            expect(mockLogger.warn).toHaveBeenCalledWith(`ProcessingCommandState: Destroyed during active processing for actor ${contextNowActor.getId()}. Attempting to end turn if context is valid.`);
            expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
            const errorArg = mockTurnContext.endTurn.mock.calls[0][0];
            expect(errorArg.message).toBe(`Command processing for ${contextNowActor.getId()} was destroyed mid-operation.`);
            expect(processingState['_isProcessing']).toBe(false);
        });
    });
});