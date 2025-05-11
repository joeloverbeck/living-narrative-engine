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
        };

        mockHandler = {
            getTurnContext: jest.fn().mockReturnValue(mockTurnContext),
            _transitionToState: jest.fn(),
            _resetTurnStateAndResources: jest.fn(),
            getLogger: jest.fn().mockReturnValue(mockLogger),
        };

        TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(mockTurnDirectiveStrategy);
        processingState = new ProcessingCommandState(mockHandler, commandString);

        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        mockHandler.getTurnContext.mockClear().mockReturnValue(mockTurnContext);
    });

    describe('enterState', () => {
        it('should log entry, set _isProcessing to true, and initiate _processCommandInternal', async () => {
            let resolveProcessInternal;
            const processInternalPromise = new Promise(resolve => {
                resolveProcessInternal = resolve;
            });
            const processCommandInternalSpy = jest.spyOn(processingState, '_processCommandInternal').mockReturnValue(processInternalPromise);
            await processingState.enterState(mockHandler, null);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(
                `ProcessingCommandState: Entered. Actor: ${actor.getId()}. Previous state: None.`
            ));
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `ProcessingCommandState: Entering with command: "${commandString}" for actor: ${actor.getId()}`
            );
            expect(processingState._isProcessing).toBe(true);
            expect(processCommandInternalSpy).toHaveBeenCalledWith(mockTurnContext, actor, commandString);
            resolveProcessInternal(undefined);
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
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(`null-context-${processingState.getStateName()}`);
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
            const processInternalSpy = jest.spyOn(processingState, '_processCommandInternal').mockRejectedValue(specificError);
            await processingState.enterState(mockHandler, null);
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
        beforeEach(() => {
            mockTurnContext.getActor.mockReturnValue(actor);
            mockTurnContext.isValid.mockReturnValue(true);
            mockCommandProcessor.process.mockReset();
            processingState._isProcessing = true;
        });

        it('should log error, dispatch system error event, and end turn', async () => {
            mockCommandProcessor.process.mockRejectedValueOnce(testError);
            await processingState._processCommandInternal(mockTurnContext, actor, commandString);
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
            await processingState._processCommandInternal(mockTurnContext, actor, commandString);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${testError.message}`,
                testError
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `ProcessingCommandState: ISafeEventDispatcher not available from ITurnContext for actor ${actor.getId()}. Cannot dispatch SYSTEM_ERROR_OCCURRED_ID.`
            );
            expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalled();
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(testError);
        });

        it('should handle failure in dispatchSafely gracefully', async () => {
            const dispatchError = new Error('Dispatch Failed');
            mockSafeEventDispatcher.dispatchSafely.mockRejectedValueOnce(dispatchError);
            mockCommandProcessor.process.mockRejectedValueOnce(testError);
            await processingState._processCommandInternal(mockTurnContext, actor, commandString);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${testError.message}`,
                testError
            );
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Failed to dispatch system error event for actor ${actor.getId()}: ${dispatchError.message}`,
                dispatchError
            );
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(testError);
        });

        it('should use fallback reset if context is critically broken when #handleProcessingException is entered', async () => {
            const faultyCtx = { /* Represents a critically broken context */};
            mockCommandProcessor.process.mockRejectedValueOnce(testError);

            // Configure mockHandler.getTurnContext to return the good context for the 'try' block
            // and the faulty context for the 'catch' block when _getTurnContext determines errorHandlingCtx.
            let getTurnContextCallCount = 0;
            mockHandler.getTurnContext.mockImplementation(() => {
                getTurnContextCallCount++;
                if (getTurnContextCallCount === 1) { // First call in _processCommandInternal's try block
                    return mockTurnContext;
                }
                if (getTurnContextCallCount === 2) { // Second call, in _processCommandInternal's catch block
                    return faultyCtx;
                }
                return mockTurnContext; // Should not be reached in this test's flow if setup is right
            });

            await processingState._processCommandInternal(mockTurnContext, actor, commandString);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                `ProcessingCommandState: Critical error - Invalid turn context during exception handling for actor ${actor.getId()}. Cannot dispatch event or end turn properly. Error:`,
                testError
            );
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
        });

        it('should use fallback if context actor becomes invalid before endTurn call in exception handler', async () => {
            mockCommandProcessor.process.mockRejectedValueOnce(testError);
            mockTurnContext.getActor.mockReset()
                .mockReturnValueOnce(actor)
                .mockReturnValueOnce(actor)
                .mockReturnValueOnce(null);

            await processingState._processCommandInternal(mockTurnContext, actor, commandString);

            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${testError.message}`,
                testError
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalled();
            expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `ProcessingCommandState: Turn context actor became invalid before explicit turn end in exception handler for intended actor ${actor.getId()}. Attempting handler reset if possible.`
            );
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
        });
    });

    describe('destroy', () => {
        it('should end turn if processing is active and context is valid', async () => {
            processingState._isProcessing = true;
            await processingState.destroy(mockHandler);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(
                `ProcessingCommandState: Destroyed during active processing for actor ${actor.getId()}. Ending turn.`
            ));
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(processingState._isProcessing).toBe(false);
        });

        it('should not end turn if not processing', async () => {
            processingState._isProcessing = false;
            await processingState.destroy(mockHandler);
            expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
            expect(processingState._isProcessing).toBe(false);
        });

        it('should not end turn if context is invalid, but still log debug', async () => {
            processingState._isProcessing = true;
            const tempMockTurnContext = {
                ...mockTurnContext,
                getActor: jest.fn().mockReturnValue(null),
                getLogger: jest.fn().mockReturnValue(mockLogger),
            };
            mockHandler.getTurnContext.mockReturnValueOnce(tempMockTurnContext);
            await processingState.destroy(mockHandler);
            expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(
                `ProcessingCommandState: Destroying for actor: N/A_at_destroy. Current _isProcessing: true`
            ));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(
                `ProcessingCommandState: Destroy handling for N/A_at_destroy complete.`
            ));
            expect(processingState._isProcessing).toBe(false);
        });

        it('should still set _isProcessing to false even if context is invalid during destroy', async () => {
            processingState._isProcessing = true;
            mockHandler.getTurnContext.mockReturnValue(null);
            await processingState.destroy(mockHandler);
            expect(processingState._isProcessing).toBe(false);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(
                `ProcessingCommandState: Destroying for actor: N/A_at_destroy. Current _isProcessing: true`
            ));
        });
    });

    describe('exitState', () => {
        it('should log exit', async () => {
            await processingState.exitState(mockHandler, null);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `ProcessingCommandState: Exiting for actor: ${actor.getId()}. Transitioning to None.`
            );
        });

        it('should NOT end turn or warn if exiting while still processing (SUT changed)', async () => {
            processingState._isProcessing = true;
            await processingState.exitState(mockHandler, null);
            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                'ProcessingCommandState: Exiting while still marked as processing. Attempting to end turn.'
            );
            expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
            expect(processingState._isProcessing).toBe(false);
        });

        it('should not end turn if not processing on exit', async () => {
            processingState._isProcessing = false;
            await processingState.exitState(mockHandler, null);
            expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
            expect(processingState._isProcessing).toBe(false);
        });

        it('should log debug even if context is invalid on exit while processing', async () => {
            processingState._isProcessing = true;
            mockHandler.getTurnContext.mockReturnValueOnce(null);
            await processingState.exitState(mockHandler, null);
            expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                'ProcessingCommandState: Exiting while still marked as processing. Attempting to end turn.'
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `ProcessingCommandState: Exiting for actor: N/A_on_exit. Transitioning to None.`
            );
            expect(processingState._isProcessing).toBe(false);
        });
    });
});