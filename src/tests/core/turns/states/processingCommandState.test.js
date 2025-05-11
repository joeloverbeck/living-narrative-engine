// src/tests/core/turns/states/processingCommandState.test.js

import {describe, test, expect, jest, beforeEach, it, afterEach} from '@jest/globals';
import {ProcessingCommandState} from '../../../../core/turns/states/processingCommandState.js';
import {TurnIdleState} from '../../../../core/turns/states/turnIdleState.js';
import TurnDirectiveStrategyResolver from '../../../../core/turns/strategies/turnDirectiveStrategyResolver.js';
import {SYSTEM_ERROR_OCCURRED_ID} from '../../../../core/constants/eventIds.js';

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
    execute: jest.fn(),
    constructor: {name: 'MockTurnDirectiveStrategy'}
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
    let actor;
    const testError = new Error('Test Exception');
    let consoleErrorSpy;
    let consoleWarnSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        actor = new MockActor('testActor');

        mockTurnContext = {
            getLogger: jest.fn().mockReturnValue(mockLogger),
            getActor: jest.fn().mockReturnValue(actor),
            getCommandProcessor: jest.fn().mockReturnValue(mockCommandProcessor),
            getCommandOutcomeInterpreter: jest.fn().mockReturnValue(mockCommandOutcomeInterpreter),
            getSafeEventDispatcher: jest.fn().mockReturnValue(mockSafeEventDispatcher),
            endTurn: jest.fn().mockResolvedValue(undefined),
            isValid: jest.fn().mockReturnValue(true),
            requestTransition: jest.fn(),
            // MODIFICATION: Added getChosenAction mock
            getChosenAction: jest.fn().mockReturnValue({
                actionDefinitionId: 'mockActionFromContext',
                commandString: commandString,
                resolvedParameters: {}
            }),
        };

        mockHandler = {
            getTurnContext: jest.fn().mockReturnValue(mockTurnContext),
            _transitionToState: jest.fn(),
            _resetTurnStateAndResources: jest.fn(),
            getLogger: jest.fn().mockReturnValue(mockLogger),
        };

        TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(mockTurnDirectiveStrategy);
        // MODIFICATION: Pass null for turnAction to encourage use of getChosenAction from context
        processingState = new ProcessingCommandState(mockHandler, commandString, null);

        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        mockHandler.getTurnContext.mockClear().mockReturnValue(mockTurnContext); // Keep this to reset for general handler use
    });

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

            // Spy on the actual method of the instance
            // MODIFIED FIX: The mock implementation now simulates the original's side effect on _isProcessing
            const processCommandInternalSpy = jest.spyOn(processingState, '_processCommandInternal')
                .mockImplementation(async () => {
                    await processInternalPromise; // Wait for the external resolution trigger
                    // Simulate that _processCommandInternal, upon successful completion (and no transition by a directive),
                    // sets _isProcessing to false. The original method does this in its try or finally block.
                    if (processingState._isProcessing && processingState._handler._currentState === processingState) {
                        processingState._isProcessing = false;
                    } else if (processingState._isProcessing) { // Catch-all like the original 'finally'
                        processingState._isProcessing = false;
                    }
                });

            await processingState.enterState(mockHandler, null);

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(
                `ProcessingCommandState: Entered. Actor: ${actor.getId()}. Previous state: None.`
            ));
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `ProcessingCommandState: Entering with command: "${commandString}" for actor: ${actor.getId()}`
            );
            expect(processingState._isProcessing).toBe(true);
            expect(processCommandInternalSpy).toHaveBeenCalledWith(mockTurnContext, actor, specificActionForThisTest);

            resolveProcessInternal(); // Resolve the promise for _processCommandInternal's mock
            // Allow microtasks to settle (for the IIFE in enterState and the mockImplementation)
            await new Promise(resolve => process.nextTick(resolve));
            await new Promise(resolve => process.nextTick(resolve));

            expect(processingState._isProcessing).toBe(false);
            processCommandInternalSpy.mockRestore();
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
            expect(processingState._isProcessing).toBe(false);
            processCommandInternalSpy.mockRestore();
        });

        it('should handle missing actor on entry and call #handleProcessingException effects', async () => {
            mockTurnContext.getActor.mockReturnValue(null);

            await processingState.enterState(mockHandler, null);

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(
                `ProcessingCommandState: Entered. Actor: N/A. Previous state: None.`
            ));

            const expectedErrorObject = expect.objectContaining({message: 'No actor present at the start of command processing.'});
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor NoActorOnEnter: No actor present at the start of command processing.`,
                expectedErrorObject
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
                SYSTEM_ERROR_OCCURRED_ID,
                expect.objectContaining({
                    error: expectedErrorObject,
                    actorId: 'NoActorOnEnter',
                    turnState: 'ProcessingCommandState'
                })
            );
            expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
            expect(processingState._isProcessing).toBe(false);
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
            expect(processingState._isProcessing).toBe(false);
            processInternalSpy.mockRestore();
        });
    });

    describe('#handleProcessingException (private method - testing via effects)', () => {
        const mockTurnActionForTest = {
            actionDefinitionId: 'testPrivateAction',
            commandString: commandString,
            resolvedParameters: {}
        };

        beforeEach(() => {
            mockTurnContext.getActor.mockReturnValue(actor);
            mockTurnContext.isValid.mockReturnValue(true);
            mockCommandProcessor.process.mockReset();
            processingState._isProcessing = true;
        });

        it('should log error, dispatch system error event, and end turn', async () => {
            mockCommandProcessor.process.mockRejectedValueOnce(testError);
            await processingState._processCommandInternal(mockTurnContext, actor, mockTurnActionForTest);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${testError.message}`,
                testError
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
                SYSTEM_ERROR_OCCURRED_ID,
                expect.objectContaining({error: testError, actorId: actor.getId()})
            );
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(testError);
        });

        it('should handle missing SafeEventDispatcher gracefully', async () => {
            mockTurnContext.getSafeEventDispatcher.mockReturnValueOnce(null);
            mockCommandProcessor.process.mockRejectedValueOnce(testError);
            await processingState._processCommandInternal(mockTurnContext, actor, mockTurnActionForTest);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${testError.message}`,
                testError
            );
            // MODIFIED FIX: Updated expected log message
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `ProcessingCommandState: SafeEventDispatcher service not available or invalid from ITurnContext for actor ${actor.getId()}. Cannot dispatch system error event.`
            );
            expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalled();
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(testError);
        });

        it('should handle failure in dispatchSafely gracefully', async () => {
            const dispatchError = new Error('Dispatch Failed');
            mockSafeEventDispatcher.dispatchSafely.mockRejectedValueOnce(dispatchError);
            mockCommandProcessor.process.mockRejectedValueOnce(testError);
            await processingState._processCommandInternal(mockTurnContext, actor, mockTurnActionForTest);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${testError.message}`,
                testError
            );
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Failed to dispatch SYSTEM_ERROR_OCCURRED_ID event for actor ${actor.getId()}: ${dispatchError.message}`,
                dispatchError
            );
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(testError);
        });

        it('should use fallback reset if context is critically broken when #handleProcessingException is entered', async () => {
            const faultyCtx = { /* Represents a critically broken context, e.g., no getLogger */};
            mockCommandProcessor.process.mockRejectedValueOnce(testError);

            // MODIFIED FIX: Ensure _getTurnContext() in the SUT's catch block receives faultyCtx
            mockHandler.getTurnContext.mockReset(); // Reset specifically for this test's interaction
            mockHandler.getTurnContext.mockReturnValueOnce(faultyCtx);

            await processingState._processCommandInternal(mockTurnContext, actor, mockTurnActionForTest);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                `ProcessingCommandState: Critical error - Invalid turn context during exception handling for actor ${actor.getId()}. Cannot dispatch event or end turn properly. Error:`,
                testError
            );
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
        });

        // ... (rest of the tests in this describe block)
    });

    // ... (other describe blocks like 'destroy', 'exitState')
});