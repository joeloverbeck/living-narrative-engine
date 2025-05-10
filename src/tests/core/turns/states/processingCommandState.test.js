// src/tests/core/turns/states/processingCommandState.test.js

import {describe, test, expect, jest, beforeEach, it} from '@jest/globals';
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

// mockTurnContext will be configured in beforeEach
let mockTurnContext;

const mockHandler = {
    getTurnContext: jest.fn(), // Will return mockTurnContext
    _transitionToState: jest.fn(),
    _resetTurnStateAndResources: jest.fn(),
    getLogger: jest.fn().mockReturnValue(mockLogger),
};

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

    beforeEach(() => {
        jest.clearAllMocks(); // Clears all mocks, including mock implementations

        actor = new MockActor('testActor');

        // Re-initialize mockTurnContext and its methods FRESH for each test
        // This ensures that jest.clearAllMocks() doesn't leave them as plain jest.fn()
        // without their specific mockReturnValues for subsequent tests.
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

        mockHandler.getTurnContext.mockReturnValue(mockTurnContext);
        mockHandler._transitionToState.mockReset(); // Also done by clearAllMocks, but can be explicit
        mockHandler._resetTurnStateAndResources.mockReset();
        mockHandler.getLogger.mockReturnValue(mockLogger); // Ensure this is always returning mockLogger

        TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(mockTurnDirectiveStrategy);
        mockCommandProcessor.process.mockReset();

        processingState = new ProcessingCommandState(mockHandler, commandString);
    });

    // ... All previously passing tests should remain passing ...
    // (constructor, id, most of enterState, _processCommandInternal, _handleProcessorSuccess, _handleProcessorFailure)

    describe('enterState', () => {
        it('should log entry, set _isProcessing to true, and initiate _processCommandInternal', async () => {
            const processCommandInternalSpy = jest.spyOn(processingState, '_processCommandInternal').mockResolvedValue(undefined);
            await processingState.enterState();
            expect(mockTurnContext.getLogger).toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Entering ProcessingCommandState with command: "do something" for actor: testActor'));
            expect(processingState._isProcessing).toBe(true);
            expect(processCommandInternalSpy).toHaveBeenCalledWith(mockTurnContext, actor, commandString);
            await new Promise(resolve => process.nextTick(resolve));
            expect(processingState._isProcessing).toBe(false);
            processCommandInternalSpy.mockRestore();
        });

        it('should end turn if turn context is invalid on entry', async () => {
            mockTurnContext.isValid.mockReturnValue(false);
            const processCommandInternalSpy = jest.spyOn(processingState, '_processCommandInternal').mockResolvedValue(undefined);
            await processingState.enterState();
            expect(mockLogger.warn).toHaveBeenCalledWith('ProcessingCommandState: Invalid turn context on enter. Attempting to reset and idle.');
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(processCommandInternalSpy).not.toHaveBeenCalled();
            expect(processingState._isProcessing).toBe(false);
            processCommandInternalSpy.mockRestore();
        });

        it('should use fallback reset if context is completely null on entry', async () => {
            mockHandler.getTurnContext.mockReturnValueOnce(null);
            const processCommandInternalSpy = jest.spyOn(processingState, '_processCommandInternal').mockResolvedValue(undefined);
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
            await processingState.enterState();
            expect(consoleWarnSpy).toHaveBeenCalledWith('ProcessingCommandState: Invalid turn context on enter. Attempting to reset and idle.');
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
            expect(processCommandInternalSpy).not.toHaveBeenCalled();
            expect(processingState._isProcessing).toBe(false);
            processCommandInternalSpy.mockRestore();
            consoleWarnSpy.mockRestore();
        });

        it('should handle missing actor on entry and call #handleProcessingException effects', async () => {
            mockTurnContext.getActor.mockReturnValue(null);
            await processingState.enterState();
            expect(mockLogger.error).toHaveBeenCalledWith('ProcessingCommandState: No actor found in turn context. Ending turn.');
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
                SYSTEM_ERROR_OCCURRED_ID,
                expect.objectContaining({
                    error: expect.objectContaining({message: 'No actor present at the start of command processing.'}),
                    turnState: 'ProcessingCommandState'
                })
            );
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.objectContaining({message: 'No actor present at the start of command processing.'}));
            expect(processingState._isProcessing).toBe(false);
        });

        it('should call #handleProcessingException effects if _processCommandInternal rejects', async () => {
            const specificError = new Error('ProcessFailInEnter');
            const processInternalSpy = jest.spyOn(processingState, '_processCommandInternal').mockRejectedValue(specificError);

            // We need to ensure these mocks are clear if they might have been called by other paths
            // before the error handling.
            mockSafeEventDispatcher.dispatchSafely.mockClear();
            mockTurnContext.endTurn.mockClear();
            mockLogger.error.mockClear();

            await processingState.enterState();
            await new Promise(resolve => process.nextTick(resolve)); // Allow all microtasks to settle

            expect(mockLogger.error).toHaveBeenCalledWith(`Error during command processing: ${specificError.message}`, specificError);
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
                SYSTEM_ERROR_OCCURRED_ID,
                expect.objectContaining({error: specificError})
            );
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(specificError);
            expect(processingState._isProcessing).toBe(false);

            processInternalSpy.mockRestore();
        });
    });


    describe('#handleProcessingException (private method - testing via effects)', () => {
        beforeEach(() => {
            // This block's beforeEach will run AFTER the main describe's beforeEach.
            // Ensure critical methods on mockTurnContext are functions as expected by SUT guard.
            // The main beforeEach already reinitializes mockTurnContext, so these should be fine,
            // but being explicit can help diagnose if something is amiss.
            if (typeof mockTurnContext.getLogger !== 'function') mockTurnContext.getLogger = jest.fn().mockReturnValue(mockLogger);
            if (typeof mockTurnContext.getSafeEventDispatcher !== 'function') mockTurnContext.getSafeEventDispatcher = jest.fn().mockReturnValue(mockSafeEventDispatcher);
            if (typeof mockTurnContext.endTurn !== 'function') mockTurnContext.endTurn = jest.fn().mockResolvedValue(undefined);

            mockTurnContext.getActor.mockReturnValue(actor); // Ensure actor is available for logging in dispatch
            mockTurnContext.isValid.mockReturnValue(true); // Default to valid for this block
            mockTurnContext.getCommandProcessor.mockReturnValue(mockCommandProcessor);

            // Clear call history for logger mocks specifically for this describe block
            mockLogger.error.mockClear();
            mockLogger.warn.mockClear();
            mockSafeEventDispatcher.dispatchSafely.mockClear(); // Use mockClear for these too
            mockTurnContext.endTurn.mockClear();

            processingState._isProcessing = true;
            mockCommandProcessor.process.mockReset();
        });

        it('should log error, dispatch system error event, and end turn', async () => {
            mockCommandProcessor.process.mockRejectedValueOnce(testError);
            await processingState._processCommandInternal(mockTurnContext, actor, commandString);
            expect(mockLogger.error).toHaveBeenCalledWith(`Error during command processing: ${testError.message}`, testError);
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
            expect(mockLogger.error).toHaveBeenCalledWith(`Error during command processing: ${testError.message}`, testError); // Still logs error
            expect(mockLogger.warn).toHaveBeenCalledWith('ProcessingCommandState: ISafeEventDispatcher not available from ITurnContext. Cannot dispatch SYSTEM_ERROR_OCCURRED_ID.');
            expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalled();
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(testError);
        });

        it('should handle failure in dispatchSafely gracefully', async () => {
            const dispatchError = new Error('Dispatch Failed');
            mockSafeEventDispatcher.dispatchSafely.mockRejectedValueOnce(dispatchError);
            mockCommandProcessor.process.mockRejectedValueOnce(testError);
            await processingState._processCommandInternal(mockTurnContext, actor, commandString);
            expect(mockLogger.error).toHaveBeenCalledWith(`Error during command processing: ${testError.message}`, testError); // Original error log
            expect(mockLogger.error).toHaveBeenCalledWith(`Failed to dispatch system error event: ${dispatchError.message}`, dispatchError); // Dispatch error log
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(testError);
        });

        it('should use fallback reset if context is critically broken when #handleProcessingException is entered', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            mockHandler._resetTurnStateAndResources.mockClear();
            mockHandler._transitionToState.mockClear();

            const faultyCtx = {
                getActor: jest.fn().mockReturnValue(null), // No getLogger, etc.
                // isValid is not strictly needed here as the functions are missing
            };

            mockCommandProcessor.process.mockImplementationOnce(async () => {
                mockHandler.getTurnContext.mockReturnValue(faultyCtx); // This is returned by SUT's _getTurnContext()
                throw testError;
            });

            // _processCommandInternal is initially called with mockTurnContext (which is valid)
            // but its internal call to _getTurnContext() (via mockHandler) will yield faultyCtx
            // for the errorHandlingCtx calculation IF `turnCtx` param was also faulty (or null)
            // To force errorHandlingCtx to be `faultyCtx`: `errorHandlingCtx = faultyCtx || faultyCtx`
            // One way to achieve this is if initial `turnCtx` was `null`.
            // Or, if SUT logic was `this._getTurnContext() ?? turnCtx;` and `_getTurnContext()` was faulty.
            // The SUT is `this._getTurnContext() || turnCtx;`
            // So `faultyCtx || mockTurnContext` results in `faultyCtx`.
            await processingState._processCommandInternal(mockTurnContext, actor, commandString);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'ProcessingCommandState: Critical error - Invalid turn context during exception handling. Cannot dispatch event or end turn properly.',
                testError
            );
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
            consoleErrorSpy.mockRestore();
        });

        it('should use fallback if context becomes invalid before endTurn call in exception handler', async () => {
            // Setup isValid for its different calls:
            mockTurnContext.isValid = jest.fn()
                .mockReturnValueOnce(true)  // For _processCommandInternal's initial guard
                .mockReturnValueOnce(false); // For #handleProcessingException's check before endTurn

            mockCommandProcessor.process.mockRejectedValueOnce(testError);

            // Ensure mockTurnContext is the one used and has all necessary methods for the first part of #handleProcessingException
            mockTurnContext.getLogger.mockReturnValue(mockLogger); // Explicitly ensure it's set
            mockTurnContext.getSafeEventDispatcher.mockReturnValue(mockSafeEventDispatcher); // Explicitly ensure
            mockTurnContext.endTurn.mockResolvedValue(undefined); // Ensure endTurn is a function

            // Set isValid to false for the check right before endTurn
            mockTurnContext.isValid.mockReturnValueOnce(false);

            // Clear mocks for precise assertion
            mockLogger.error.mockClear();
            mockLogger.warn.mockClear();
            mockSafeEventDispatcher.dispatchSafely.mockClear();
            mockTurnContext.endTurn.mockClear();
            mockHandler._resetTurnStateAndResources.mockClear();
            mockHandler._transitionToState.mockClear();

            await processingState._processCommandInternal(mockTurnContext, actor, commandString);

            expect(mockLogger.error).toHaveBeenCalledWith(`Error during command processing: ${testError.message}`, testError);
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalled();

            expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith('ProcessingCommandState: Turn context became invalid before explicit turn end in exception handler.');
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
        });
    });

    describe('destroy', () => {
        it('should end turn if processing is active and context is valid', async () => {
            processingState._isProcessing = true;
            mockTurnContext.isValid.mockReturnValue(true);
            await processingState.destroy(); // SUT change: super.destroy(this._handler)
            expect(mockLogger.warn).toHaveBeenCalledWith('ProcessingCommandState: Destroyed during active processing. Ending turn.');
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(processingState._isProcessing).toBe(false);
        });

        it('should not end turn if not processing', async () => {
            processingState._isProcessing = false;
            await processingState.destroy();
            expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
        });

        it('should not end turn if context is invalid, but still log debug', async () => {
            processingState._isProcessing = true;
            mockTurnContext.isValid.mockReturnValue(false);
            mockTurnContext.getActor.mockReturnValue(actor);
            await processingState.destroy();
            expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Destroying ProcessingCommandState for actor: ${actor.getId()}`));
        });

        it('should still set _isProcessing to false even if context is invalid during destroy', async () => {
            processingState._isProcessing = true;
            mockTurnContext.isValid.mockReturnValue(false);
            await processingState.destroy();
            expect(processingState._isProcessing).toBe(false);
        });
    });

    describe('exitState', () => {
        it('should log exit', async () => {
            await processingState.exitState();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Exiting ProcessingCommandState for actor: ${actor.getId()}`));
        });

        it('should end turn if exiting while still processing and context is valid', async () => {
            processingState._isProcessing = true;
            mockTurnContext.isValid.mockReturnValue(true);
            await processingState.exitState();
            expect(mockLogger.warn).toHaveBeenCalledWith('ProcessingCommandState: Exiting while still marked as processing. Attempting to end turn.');
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
            expect(processingState._isProcessing).toBe(false);
        });

        it('should not end turn if not processing on exit', async () => {
            processingState._isProcessing = false;
            await processingState.exitState();
            expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
        });

        it('should not call specific warning or endTurn if context is invalid on exit while processing, but still log debug', async () => {
            processingState._isProcessing = true;
            mockTurnContext.isValid.mockReturnValue(false);

            const loggerWarnSpy = jest.spyOn(mockLogger, 'warn');
            const loggerDebugSpy = jest.spyOn(mockLogger, 'debug');

            await processingState.exitState();

            expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
            expect(loggerWarnSpy).not.toHaveBeenCalledWith('ProcessingCommandState: Exiting while still marked as processing. Attempting to end turn.');
            expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`Exiting ProcessingCommandState for actor: ${actor.getId()}`));
            expect(processingState._isProcessing).toBe(false);

            loggerWarnSpy.mockRestore();
            loggerDebugSpy.mockRestore();
        });
    });
});