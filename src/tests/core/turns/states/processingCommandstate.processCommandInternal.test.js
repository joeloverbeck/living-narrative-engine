// src/tests/core/turns/states/processingCommandState.processCommandInternal.test.js

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

    describe('_processCommandInternal (Error Handling for Services)', () => {
        beforeEach(() => {
            mockTurnContext.getActor.mockReturnValue(actor);
            processingState['_isProcessing'] = true;
            // Ensure mockCommandProcessor.processCommand is reset for each error test
            mockCommandProcessor.processCommand.mockReset();
            mockCommandProcessor.processCommand.mockResolvedValue(mockSuccessfulCommandResult); // Default good outcome
        });

        it('should call #handleProcessingException if getCommandProcessor fails', async () => {
            const serviceError = new Error("Cannot get proc");
            mockTurnContext.getCommandProcessor.mockImplementationOnce(() => {
                throw serviceError;
            });

            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);

            const expectedOuterErrorMessage = `ProcessingCommandState: Failed to retrieve ICommandProcessor from ITurnContext for actor ${actor.getId()}. Error: ${serviceError.message}`;
            // This first assertion remains correct, as _getServiceFromContext logs this:
            expect(mockLogger.error).toHaveBeenCalledWith(expectedOuterErrorMessage, serviceError);

            // REVISED ASSERTION for the call from #handleProcessingException:
            // #handleProcessingException now receives 'serviceError' directly.
            // It logs 'serviceError.message' and the 'serviceError' object itself.
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${serviceError.message}`, // Message uses serviceError.message
                serviceError // The actual serviceError object is passed
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, expect.any(Object));
            // #handleProcessingException calls endTurn with the error it received, which is serviceError.
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(serviceError);
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should call #handleProcessingException if getCommandOutcomeInterpreter fails', async () => {
            const serviceError = new Error("Cannot get interp");
            // commandProcessor.processCommand needs to succeed first
            mockCommandProcessor.processCommand.mockResolvedValue({success: true, turnEnded: false});
            mockTurnContext.getCommandOutcomeInterpreter.mockImplementationOnce(() => {
                throw serviceError;
            });

            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);

            const expectedOuterErrorMessage = `ProcessingCommandState: Failed to retrieve ICommandOutcomeInterpreter from ITurnContext for actor ${actor.getId()}. Error: ${serviceError.message}`;
            // This first assertion remains correct:
            expect(mockLogger.error).toHaveBeenCalledWith(expectedOuterErrorMessage, serviceError);

            // REVISED ASSERTION for the call from #handleProcessingException:
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${serviceError.message}`, // Message uses serviceError.message
                serviceError // The actual serviceError object
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, expect.any(Object));
            // #handleProcessingException calls endTurn with the error it received, which is serviceError.
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(serviceError);
            expect(processingState['_isProcessing']).toBe(false);
        });


        it('should call #handleProcessingException if commandProcessor.processCommand() throws', async () => {
            const processError = new Error("ProcessExecuteFail");
            mockCommandProcessor.processCommand.mockRejectedValueOnce(processError); // Correctly mock processCommand

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
            mockCommandProcessor.processCommand.mockResolvedValue({success: true, turnEnded: false}); // Assume processCommand succeeds
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
            mockCommandProcessor.processCommand.mockResolvedValue({success: true, turnEnded: false});
            mockCommandOutcomeInterpreter.interpret.mockReturnValue(TurnDirective.END_TURN_SUCCESS);
            TurnDirectiveStrategyResolver.resolveStrategy.mockImplementationOnce(() => {
                throw resolveError;
            });

            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${resolveError.message}`, resolveError
            );
            // The SUT directly calls #handleProcessingException which then calls endTurn
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(resolveError);
            expect(processingState['_isProcessing']).toBe(false);

            // Test for null/invalid strategy returned
            TurnDirectiveStrategyResolver.resolveStrategy.mockReset();
            TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValueOnce(null); // Simulate invalid strategy
            mockLogger.error.mockClear();
            mockTurnContext.endTurn.mockClear();
            processingState['_isProcessing'] = true; // Reset for this part of test

            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnAction);

            const expectedErrorMsg = `ProcessingCommandState: Could not resolve ITurnDirectiveStrategy for directive '${TurnDirective.END_TURN_SUCCESS}' (actor ${actor.getId()}).`;
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg); // SUT logs this specific error
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.objectContaining({message: expectedErrorMsg}));
            expect(processingState['_isProcessing']).toBe(false);
        });

        it('should call #handleProcessingException if resolved strategy.execute() throws', async () => {
            const strategyExecuteError = new Error("StrategyExecuteFail");
            mockCommandProcessor.processCommand.mockResolvedValue({success: true, turnEnded: false});
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

        it('should handle context/actor change after commandProcessor.processCommand()', async () => {
            const originalActor = actor;
            const otherActor = new MockActor("otherActor");

            const currentTestMockSuccessfulCommandResult = {success: true, turnEnded: false};
            mockTurnContext.getActor.mockReturnValue(originalActor);

            mockCommandProcessor.processCommand.mockImplementationOnce(async () => {
                // Simulate actor changing in context *during* command processing (after our call but before SUT checks)
                mockTurnContext.getActor.mockReturnValue(otherActor);
                return currentTestMockSuccessfulCommandResult;
            });

            mockLogger.warn.mockClear();
            mockSafeEventDispatcher.dispatchSafely.mockClear();
            mockTurnContext.endTurn.mockClear();
            processingState['_isProcessing'] = true;

            await processingState['_processCommandInternal'](mockTurnContext, originalActor, mockTurnAction);
            await new Promise(resolve => process.nextTick(resolve));

            expect(mockLogger.warn).toHaveBeenCalledWith(
                `ProcessingCommandState: Context or actor changed/invalidated after commandProcessor.processCommand() for ${originalActor.getId()}. Aborting further processing for this turn.`
            );
            // Based on SUT logic: if context changed, it calls #handleProcessingException with shouldEndTurn=false
            // So, mockTurnContext.endTurn from this path should NOT be called.
            expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
            expect(processingState['_isProcessing']).toBe(false);
        });
    });

});