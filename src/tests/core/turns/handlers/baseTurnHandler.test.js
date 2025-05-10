// src/tests/core/turns/handlers/baseTurnHandler.test.js
// --- FILE START ---

/**
 * @fileoverview Smoke-test harness for BaseTurnHandler core lifecycle.
 * Ticket: 1.5
 */

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';

// Adjust paths based on actual project structure relative to this test file
import {BaseTurnHandler} from '../../../../core/turns/handlers/baseTurnHandler.js';
import {TurnContext} from '../../../../core/turns/context/turnContext.js';
import {TurnIdleState} from '../../../../core/turns/states/turnIdleState.js';
import {AwaitingPlayerInputState} from '../../../../core/turns/states/awaitingPlayerInputState.js';

// --- Mocks & Test Utilities ---

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    createChild: jest.fn(() => mockLogger),
};

const createMockActor = (id = 'test-actor') => ({
    id: id,
    name: `MockActor-${id}`,
});

const mockPlayerPromptService = {
    prompt: jest.fn().mockResolvedValue(undefined),
};

const mockSubscriptionManager = {
    subscribeToCommandInput: jest.fn().mockReturnValue(jest.fn()),
    subscribeToTurnEnded: jest.fn().mockReturnValue(jest.fn()),
    unsubscribeAll: jest.fn(),
};

const mockTurnEndPort = {
    // notifyTurnEnded will still be logged if called by the actual TurnEndingState,
    // but we are removing the direct expectation for it in the tests below.
    notifyTurnEnded: jest.fn().mockImplementation(async (actorId, error) => {
        // console.log(`DEBUG: mockTurnEndPort.notifyTurnEnded CALLED with actorId: "${actorId}", error: "${error ? error.message : null}"`);
        return Promise.resolve(undefined);
    }),
};

const mockGameService = {
    recordEvent: jest.fn(),
};

/**
 * Minimal concrete implementation of BaseTurnHandler for testing its core lifecycle.
 */
class MinimalTestHandler extends BaseTurnHandler {
    #servicesForContext;
    #isAwaitingExternalEventProviderForContext;
    #onSetAwaitingExternalEventCallbackProviderForContext; // Added

    constructor({
                    logger,
                    initialConcreteState,
                    servicesForContext,
                    isAwaitingExternalEventProviderForContext,
                    onSetAwaitingExternalEventCallbackProviderForContext, // Added
                }) {
        super({logger, initialConcreteState});
        this.#servicesForContext = servicesForContext;
        this.#isAwaitingExternalEventProviderForContext = isAwaitingExternalEventProviderForContext;
        this.#onSetAwaitingExternalEventCallbackProviderForContext = onSetAwaitingExternalEventCallbackProviderForContext; // Added
    }

    async startTurn(actor) {
        this._assertHandlerActive();
        if (!actor) {
            const errorMsg = `${this.constructor.name}.startTurn: actor is required.`;
            this.getLogger().error(errorMsg); // Uses BaseTurnHandler.getLogger()
            throw new Error(errorMsg);
        }
        this._setCurrentActorInternal(actor);

        const onEndTurnCallback = (error) => {
            // Pass this._isDestroyed to correctly inform _handleTurnEnd about the context of the call
            this._handleTurnEnd(actor.id, error, this._isDestroyed);
        };

        const newTurnContext = new TurnContext({
            actor: actor,
            logger: this.getLogger(), // Uses BaseTurnHandler.getLogger() for the context
            services: this.#servicesForContext,
            onEndTurnCallback: onEndTurnCallback,
            isAwaitingExternalEventProvider: this.#isAwaitingExternalEventProviderForContext,
            onSetAwaitingExternalEventCallback: this.#onSetAwaitingExternalEventCallbackProviderForContext, // Added
            handlerInstance: this, // Added
        });
        this._setCurrentTurnContextInternal(newTurnContext);
        this.getLogger().debug(`${this.constructor.name}.startTurn: TurnContext created for actor ${actor.id}. Delegating to current state.`);
        await this._currentState.startTurn(this, actor);
    }

    _getInternalState() {
        return this._currentState;
    }

    _getInternalTurnContext() {
        return this._currentTurnContext;
    }
}

// --- Test Suite ---
describe('BaseTurnHandler Smoke Test Harness (Ticket 1.5)', () => {
    let handler;
    let dummyActor;
    let mockServices;
    let mockIsAwaitingExternalEventProvider;
    let mockOnSetAwaitingExternalEventCallback; // Added
    let resetSpy;
    let stateDestroySpy;

    const createDummyInitialState = (name = 'DummyInitState') => ({
        getStateName: jest.fn().mockReturnValue(name),
        enterState: jest.fn().mockResolvedValue(undefined),
        exitState: jest.fn().mockResolvedValue(undefined),
        startTurn: jest.fn().mockImplementation(() => {
            throw new Error(`${name}.startTurn should not be called`);
        }),
        handleSubmittedCommand: jest.fn().mockImplementation(() => {
            throw new Error(`${name}.handleSubmittedCommand should not be called`);
        }),
        handleTurnEndedEvent: jest.fn().mockImplementation(() => {
            throw new Error(`${name}.handleTurnEndedEvent should not be called`);
        }),
        processCommandResult: jest.fn().mockImplementation(() => {
            throw new Error(`${name}.processCommandResult should not be called`);
        }),
        handleDirective: jest.fn().mockImplementation(() => {
            throw new Error(`${name}.handleDirective should not be called`);
        }),
        destroy: jest.fn().mockResolvedValue(undefined),
    });

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();

        dummyActor = createMockActor('smoke-test-actor-1');
        mockIsAwaitingExternalEventProvider = jest.fn().mockReturnValue(false);
        mockOnSetAwaitingExternalEventCallback = jest.fn(); // Added

        mockServices = {
            playerPromptService: mockPlayerPromptService,
            subscriptionManager: mockSubscriptionManager,
            turnEndPort: mockTurnEndPort,
            game: mockGameService,
        };

        const dummyInitialState = createDummyInitialState('DummyInitStateForBeforeEach');

        handler = new MinimalTestHandler({
            logger: mockLogger,
            initialConcreteState: dummyInitialState,
            servicesForContext: mockServices,
            isAwaitingExternalEventProviderForContext: mockIsAwaitingExternalEventProvider,
            onSetAwaitingExternalEventCallbackProviderForContext: mockOnSetAwaitingExternalEventCallback, // Added
        });
        handler._currentState = new TurnIdleState(handler); // Start in a known concrete state

        jest.spyOn(handler, 'onEnterState').mockImplementation(async () => {
        });
        jest.spyOn(handler, 'onExitState').mockImplementation(async () => {
        });
        jest.spyOn(handler, '_handleTurnEnd');
        resetSpy = jest.spyOn(handler, '_resetTurnStateAndResources');
        stateDestroySpy = jest.spyOn(AwaitingPlayerInputState.prototype, 'destroy');
    });

    afterEach(async () => {
        stateDestroySpy.mockRestore();

        if (handler && typeof handler.destroy === 'function' && !handler._isDestroyed) {
            await handler.destroy();
        }
        await jest.runAllTimersAsync();
        jest.useRealTimers();
    });

    test('should initialize correctly and be in TurnIdleState', () => {
        expect(handler).toBeInstanceOf(MinimalTestHandler);
        expect(handler._getInternalState()).toBeInstanceOf(TurnIdleState);
        expect(handler._getInternalState().getStateName()).toBe('TurnIdleState');
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `MinimalTestHandler initialised. Initial state: DummyInitStateForBeforeEach`
        );
    });

    describe('startTurn()', () => {
        test('should transition from TurnIdleState to AwaitingPlayerInputState successfully', async () => {
            expect(handler._getInternalState()).toBeInstanceOf(TurnIdleState);
            mockLogger.debug.mockClear();
            mockLogger.info.mockClear();
            mockLogger.error.mockClear();
            handler.onEnterState.mockClear();
            handler.onExitState.mockClear();
            mockServices.subscriptionManager.subscribeToCommandInput.mockClear();

            await expect(handler.startTurn(dummyActor)).resolves.toBeUndefined();
            await jest.advanceTimersByTimeAsync(0);


            expect(handler._getInternalState()).toBeInstanceOf(AwaitingPlayerInputState);
            expect(handler._getInternalState().getStateName()).toBe('AwaitingPlayerInputState');
            const turnContext = handler._getInternalTurnContext();
            expect(turnContext).toBeInstanceOf(TurnContext);
            expect(turnContext.getActor()).toBe(dummyActor);
            expect(mockLogger.debug).toHaveBeenCalledWith(`MinimalTestHandler.startTurn: TurnContext created for actor ${dummyActor.id}. Delegating to current state.`);
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnIdleState: Received startTurn for actor ${dummyActor.id}.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`TurnIdleState: ITurnContext confirmed for actor ${dummyActor.id}. Transitioning to AwaitingPlayerInputState.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`MinimalTestHandler: State Transition: TurnIdleState \u2192 AwaitingPlayerInputState`);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`TurnIdleState: Exiting. Actor: ${dummyActor.id}. Transitioning to AwaitingPlayerInputState.`));
            expect(mockLogger.info).toHaveBeenCalledWith(`AwaitingPlayerInputState: Entered. Actor: ${dummyActor.id}. Previous state: TurnIdleState.`);
            expect(mockServices.subscriptionManager.subscribeToCommandInput).toHaveBeenCalledTimes(1);
        });

        test('should throw error if startTurn is called with no actor', async () => {
            await expect(handler.startTurn(null)).rejects.toThrow('MinimalTestHandler.startTurn: actor is required.');
            expect(mockLogger.error).toHaveBeenCalledWith('MinimalTestHandler.startTurn: actor is required.');
        });

        test('should call onExitState (for TurnIdleState) and onEnterState (for AwaitingPlayerInputState) hooks during successful transition', async () => {
            await handler.startTurn(dummyActor);
            await jest.advanceTimersByTimeAsync(0);

            expect(handler.onExitState).toHaveBeenCalledTimes(1);
            expect(handler.onExitState).toHaveBeenCalledWith(expect.any(TurnIdleState), expect.any(AwaitingPlayerInputState));
            expect(handler.onEnterState).toHaveBeenCalledTimes(1);
            expect(handler.onEnterState).toHaveBeenCalledWith(expect.any(AwaitingPlayerInputState), expect.any(TurnIdleState));
        });

        // ─────────────────────────────────────────────────────────────────
        // START OF CORRECTED TEST CASE
        // ─────────────────────────────────────────────────────────────────
        test('TurnIdleState.startTurn should throw (and handler recover) if ITurnContext is missing', async () => {
            const dummyInitialStateForMisconfigured = createDummyInitialState('DummyForMisconfiguredTest');
            const misconfiguredHandler = new MinimalTestHandler({
                logger: mockLogger,
                initialConcreteState: dummyInitialStateForMisconfigured,
                servicesForContext: mockServices,
                isAwaitingExternalEventProviderForContext: mockIsAwaitingExternalEventProvider,
                onSetAwaitingExternalEventCallbackProviderForContext: mockOnSetAwaitingExternalEventCallback,
            });
            misconfiguredHandler._currentState = new TurnIdleState(misconfiguredHandler);
            jest.spyOn(misconfiguredHandler, 'onEnterState').mockImplementation(async () => {
            });
            jest.spyOn(misconfiguredHandler, 'onExitState').mockImplementation(async () => {
            });
            const originalSetContextInternal = misconfiguredHandler._setCurrentTurnContextInternal;

            mockLogger.error.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear();

            // Simulate that the concrete handler's startTurn failed to set the context
            misconfiguredHandler._setCurrentTurnContextInternal(null);
            // SetCurrentActorInternal is usually called before context creation in a typical handler.startTurn
            // This ensures actorIdForLog in TurnIdleState is correctly populated for the error message.
            misconfiguredHandler._setCurrentActorInternal(dummyActor);

            const turnIdleState = new TurnIdleState(misconfiguredHandler); // Or use misconfiguredHandler._getInternalState();

            const expectedErrorMessage = `TurnIdleState: ITurnContext is missing or invalid. Expected concrete handler to set it up. Actor: ${dummyActor.id}.`;

            await expect(turnIdleState.startTurn(misconfiguredHandler, dummyActor)).rejects.toThrow(expectedErrorMessage);

            await jest.advanceTimersByTimeAsync(0); // Allow any pending microtasks/timers to complete

            // Verify logger was called with the exact error message
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessage);

            // Verify handler recovery (transitions back to Idle)
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: State Transition: TurnIdleState \u2192 TurnIdleState`));
            expect(misconfiguredHandler._getInternalState()).toBeInstanceOf(TurnIdleState); // Check final state

            // Restore original method if necessary (though in this test, it's more about observing behavior)
            misconfiguredHandler._setCurrentTurnContextInternal = originalSetContextInternal;
        });
        // ─────────────────────────────────────────────────────────────────
        // END OF CORRECTED TEST CASE
        // ─────────────────────────────────────────────────────────────────

        test('TurnIdleState.startTurn should throw (and handler recover) if actor in context mismatches', async () => {
            const wrongActor = createMockActor('wrong-actor');

            const turnContextForDummy = new TurnContext({
                actor: dummyActor,
                logger: mockLogger,
                services: mockServices,
                onEndTurnCallback: (err) => handler._handleTurnEnd(dummyActor.id, err, handler._isDestroyed),
                isAwaitingExternalEventProvider: mockIsAwaitingExternalEventProvider,
                onSetAwaitingExternalEventCallback: mockOnSetAwaitingExternalEventCallback, // Added
                handlerInstance: handler, // Added
            });
            handler._setCurrentTurnContextInternal(turnContextForDummy);
            handler._setCurrentActorInternal(dummyActor);

            mockLogger.error.mockClear();
            mockLogger.debug.mockClear();

            const turnIdleStateInstance = handler._getInternalState();
            await expect(turnIdleStateInstance.startTurn(handler, wrongActor)).rejects.toThrow(`TurnIdleState: Actor in ITurnContext ('${dummyActor.id}') does not match actor provided to state's startTurn ('${wrongActor.id}').`);

            await jest.advanceTimersByTimeAsync(0);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`TurnIdleState: Actor in ITurnContext ('${dummyActor.id}') does not match actor provided to state's startTurn ('${wrongActor.id}').`));
            expect(mockLogger.debug).toHaveBeenCalledWith(`MinimalTestHandler: State Transition: TurnIdleState \u2192 TurnIdleState`);
        });

        test('AwaitingPlayerInputState.enterState handles subscription failure (BaseTurnHandler recovers)', async () => {
            const subscriptionError = new Error('Subscription failed');
            mockServices.subscriptionManager.subscribeToCommandInput.mockImplementationOnce(() => {
                throw subscriptionError;
            });

            mockLogger.error.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear();
            mockTurnEndPort.notifyTurnEnded.mockClear();
            handler._handleTurnEnd.mockClear();
            resetSpy.mockClear();

            await handler.startTurn(dummyActor);
            await jest.advanceTimersByTimeAsync(0);


            const errorCallsDuringTest = mockLogger.error.mock.calls;
            expect(errorCallsDuringTest.length).toBe(1);

            if (errorCallsDuringTest.length > 0) {
                expect(errorCallsDuringTest[0][0]).toBe(`AwaitingPlayerInputState: Failed to subscribe or prompt player ${dummyActor.id}.`);
                expect(errorCallsDuringTest[0][1]).toBe(subscriptionError);
            }

            expect(handler._handleTurnEnd).toHaveBeenCalledTimes(1);
            expect(handler._handleTurnEnd).toHaveBeenCalledWith(dummyActor.id, expect.any(Error), false);


            expect(mockLogger.debug).toHaveBeenCalledWith(
                `MinimalTestHandler: State Transition: AwaitingPlayerInputState \u2192 TurnEndingState`
            );

            expect(resetSpy).toHaveBeenCalled();

            expect(mockLogger.debug).toHaveBeenCalledWith(
                `MinimalTestHandler: State Transition: TurnEndingState \u2192 TurnIdleState`
            );

            expect(handler._getInternalState()).toBeInstanceOf(TurnIdleState);
            expect(handler._getInternalState().getStateName()).toBe('TurnIdleState');

            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining('Forcing transition to TurnIdleState due to error entering TurnEndingState')
            );
            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining('Forcing transition to TurnIdleState due to error entering')
            );
        });
    });

    describe('destroy()', () => {
        test('should mark handler as destroyed, reset resources, and transition to TurnIdleState', async () => {
            await handler.startTurn(dummyActor);
            await jest.advanceTimersByTimeAsync(0);

            expect(handler._getInternalState()).toBeInstanceOf(AwaitingPlayerInputState);

            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.error.mockClear();
            handler._handleTurnEnd.mockClear();
            resetSpy.mockClear();
            stateDestroySpy.mockClear();
            mockTurnEndPort.notifyTurnEnded.mockClear();

            await handler.destroy();
            await jest.advanceTimersByTimeAsync(0);

            expect(handler._isDestroyed).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(`MinimalTestHandler.destroy() invoked.`);

            expect(stateDestroySpy).toHaveBeenCalledTimes(1);
            // CORRECTED LINE BELOW (REMOVED expect.stringContaining WRAPPER)
            expect(mockLogger.info).toHaveBeenCalledWith(`AwaitingPlayerInputState: Handler destroyed while awaiting input for ${dummyActor.id}.`);

            expect(handler._handleTurnEnd).toHaveBeenCalledTimes(1);
            expect(handler._handleTurnEnd).toHaveBeenCalledWith(dummyActor.id, expect.any(Error), true);

            expect(mockLogger.debug).toHaveBeenCalledWith(`MinimalTestHandler.destroy: Calling destroy on current state AwaitingPlayerInputState.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: State Transition: AwaitingPlayerInputState \u2192 TurnEndingState`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: State Transition: TurnEndingState \u2192 TurnIdleState`));

            expect(resetSpy).toHaveBeenCalledWith(expect.stringContaining(`destroy-MinimalTestHandler`));
            expect(handler._getInternalState()).toBeInstanceOf(TurnIdleState);

            const currentStateNameDuringDestroyCheck = 'AwaitingPlayerInputState';
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`MinimalTestHandler.destroy: Ensuring transition to TurnIdleState (current: ${currentStateNameDuringDestroyCheck}`)
            );
            expect(mockLogger.debug).not.toHaveBeenCalledWith(
                expect.stringContaining('MinimalTestHandler.destroy: Already in TurnIdleState after state cleanup and reset.')
            );

            expect(mockLogger.info).toHaveBeenCalledWith(`MinimalTestHandler.destroy() complete.`);

            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        test('calling destroy() multiple times should be idempotent', async () => {
            await handler.destroy();
            await jest.advanceTimersByTimeAsync(0);

            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.error.mockClear();
            handler._handleTurnEnd.mockClear();
            resetSpy.mockClear();
            stateDestroySpy.mockClear();


            const transitionSpy = jest.spyOn(handler, '_transitionToState');

            await handler.destroy();
            await jest.advanceTimersByTimeAsync(0);


            expect(mockLogger.debug).toHaveBeenCalledWith('MinimalTestHandler.destroy() called but already destroyed.');
            expect(resetSpy).not.toHaveBeenCalled();
            expect(transitionSpy).not.toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalledWith(`MinimalTestHandler.destroy() invoked.`);
            expect(stateDestroySpy).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();


            transitionSpy.mockRestore();
        });
    });
});

// --- FILE END ---