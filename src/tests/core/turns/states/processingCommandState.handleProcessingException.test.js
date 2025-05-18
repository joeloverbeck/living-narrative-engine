// src/tests/core/turns/states/processingCommandState.handleProcessingException.test.js

import {describe, test, expect, jest, beforeEach, it, afterEach} from '@jest/globals';
import {ProcessingCommandState} from '../../../../core/turns/states/processingCommandState.js';
import {TurnIdleState} from '../../../../core/turns/states/turnIdleState.js';
import TurnDirectiveStrategyResolver from '../../../../core/turns/strategies/turnDirectiveStrategyResolver.js'; // Mocked, but not directly used in these tests
import {SYSTEM_ERROR_OCCURRED_ID} from '../../../../core/constants/eventIds.js';

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

const mockCommandProcessor = {
    processCommand: jest.fn(),
};

const mockCommandOutcomeInterpreter = {
    interpret: jest.fn(),
};

const mockSafeEventDispatcher = {
    dispatchSafely: jest.fn(),
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
    let actor;
    const testError = new Error('Test Exception');
    let consoleErrorSpy;
    let consoleWarnSpy;
    let mockTurnAction;


    beforeEach(() => {
        jest.clearAllMocks();
        actor = new MockActor('testActor');

        mockTurnAction = { // General mock action for _processCommandInternal calls
            actionDefinitionId: 'testActionForHPE',
            commandString: 'command for handleProcessingException tests',
            resolvedParameters: {}
        };

        mockTurnContext = {
            getLogger: jest.fn().mockReturnValue(mockLogger),
            getActor: jest.fn().mockReturnValue(actor),
            getCommandProcessor: jest.fn().mockReturnValue(mockCommandProcessor),
            getCommandOutcomeInterpreter: jest.fn().mockReturnValue(mockCommandOutcomeInterpreter),
            getSafeEventDispatcher: jest.fn().mockReturnValue(mockSafeEventDispatcher),
            endTurn: jest.fn().mockResolvedValue(undefined),
            isValid: jest.fn().mockReturnValue(true),
            requestTransition: jest.fn().mockResolvedValue(undefined),
            getChosenAction: jest.fn().mockReturnValue(mockTurnAction), // Though _processCommandInternal takes action as arg
        };

        mockHandler = {
            getTurnContext: jest.fn().mockReturnValue(mockTurnContext),
            _transitionToState: jest.fn().mockImplementation(async (newState) => {
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

        processingState = new ProcessingCommandState(mockHandler, null, null);
        mockHandler._currentState = processingState; // Set current state for the handler

        // Clear mocks specifically relevant to these tests before each run
        mockLogger.debug.mockClear();
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockSafeEventDispatcher.dispatchSafely.mockClear();
        mockTurnContext.endTurn.mockClear();
        mockHandler._resetTurnStateAndResources.mockClear();
        mockHandler._transitionToState.mockClear();

        // Spies on console methods
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        jest.restoreAllMocks(); // Restores all mocks, including those on mockTurnContext.getLogger
    });

    describe('#handleProcessingException (private method - testing via effects)', () => {
        // mockTurnActionForExceptionTest is specific to triggering _processCommandInternal
        const mockTurnActionForExceptionTest = {
            actionDefinitionId: 'testPrivateAction',
            commandString: "test_cmd_string_for_exception",
            resolvedParameters: {}
        };

        beforeEach(() => {
            // Default setup for #handleProcessingException tests where context is generally valid
            mockTurnContext.getActor.mockReturnValue(actor); // Ensure actor is available in context
            mockTurnContext.isValid.mockReturnValue(true);
            mockCommandProcessor.processCommand.mockReset(); // Ensure clean state for processCommand
            processingState['_isProcessing'] = true; // Simulate state being active
        });

        it('should log error, dispatch system error event, and end turn if process throws', async () => {
            mockCommandProcessor.processCommand.mockRejectedValueOnce(testError);
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnActionForExceptionTest);
            await new Promise(process.nextTick);

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
            mockCommandProcessor.processCommand.mockRejectedValueOnce(testError);
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnActionForExceptionTest);
            await new Promise(process.nextTick);

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
            mockSafeEventDispatcher.dispatchSafely.mockRejectedValueOnce(dispatchError);
            mockCommandProcessor.processCommand.mockRejectedValueOnce(testError);
            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnActionForExceptionTest);
            await new Promise(process.nextTick);


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
            const serviceError = new Error("Service Get Fail");
            mockTurnContext.getCommandProcessor.mockImplementationOnce(() => {
                throw serviceError; // This error triggers the path to #handleProcessingException
            });

            // Critically break the context for #handleProcessingException's initial check
            mockTurnContext.getSafeEventDispatcher = undefined;

            // Save the original getLogger mock function from mockTurnContext (setup in global beforeEach)
            const originalGetLoggerFn = mockTurnContext.getLogger;

            // Replace mockTurnContext.getLogger with a new specific mock for this test's execution path
            mockTurnContext.getLogger = jest.fn()
                .mockImplementationOnce(() => mockLogger) // Call 1: from _getServiceFromContext (used to log serviceError)
                .mockReturnValueOnce(undefined)          // Call 2: from ProcessingCommandState.exitState's turnCtx.getLogger()
                .mockReturnValueOnce(undefined)          // Call 3: from AbstractTurnState.exitState's turnCtx.getLogger()
                .mockReturnValueOnce(undefined);          // Call 4: from AbstractTurnState.enterState's (via TurnIdleState) turnCtx.getLogger()

            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnActionForExceptionTest);
            await new Promise(process.nextTick); // Allow all async operations in #HPE and transitions to settle

            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining(`${processingState.getStateName()}: Attempting to reset handler due to critical context failure`)
            );

            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(
                `critical-exception-handling-context-${processingState.getStateName()}`
            );
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
            expect(processingState['_isProcessing']).toBe(false);

            // Restore the original getLogger to mockTurnContext for subsequent tests
            mockTurnContext.getLogger = originalGetLoggerFn;
        });


        it('should set _isProcessing to false after an exception', async () => {
            mockCommandProcessor.processCommand.mockRejectedValueOnce(testError);
            processingState['_isProcessing'] = true; // Pre-condition

            await processingState['_processCommandInternal'](mockTurnContext, actor, mockTurnActionForExceptionTest);
            await new Promise(process.nextTick);

            expect(processingState['_isProcessing']).toBe(false); // Post-condition

            // Verify other effects of #handleProcessingException for this standard error path
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ProcessingCommandState: Error during command processing for actor ${actor.getId()}: ${testError.message}`, testError
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
                SYSTEM_ERROR_OCCURRED_ID, expect.objectContaining({error: testError, actorId: actor.getId()})
            );
            expect(mockTurnContext.endTurn).toHaveBeenCalledWith(testError);
        });
    });
});