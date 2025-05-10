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

    constructor({
                    logger,
                    initialConcreteState,
                    servicesForContext,
                    isAwaitingExternalEventProviderForContext,
                }) {
        super({logger, initialConcreteState});
        this.#servicesForContext = servicesForContext;
        this.#isAwaitingExternalEventProviderForContext = isAwaitingExternalEventProviderForContext;
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
            `MinimalTestHandler initialised \u2192 state DummyInitStateForBeforeEach`
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
            expect(mockLogger.debug).toHaveBeenCalledWith(`TurnIdleState: ITurnContext confirmed for actor ${dummyActor.id}. Preparing to transition to AwaitingPlayerInputState.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`MinimalTestHandler: TurnIdleState \u2192 AwaitingPlayerInputState`);
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

        test('TurnIdleState.startTurn should throw (and handler recover) if ITurnContext is missing', async () => {
            const dummyInitialStateForMisconfigured = createDummyInitialState('DummyForMisconfiguredTest');
            const misconfiguredHandler = new MinimalTestHandler({
                logger: mockLogger,
                initialConcreteState: dummyInitialStateForMisconfigured,
                servicesForContext: mockServices,
                isAwaitingExternalEventProviderForContext: mockIsAwaitingExternalEventProvider
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

            misconfiguredHandler._setCurrentTurnContextInternal(null);
            misconfiguredHandler._setCurrentActorInternal(dummyActor);

            const turnIdleState = new TurnIdleState(misconfiguredHandler);

            await expect(turnIdleState.startTurn(misconfiguredHandler, dummyActor)).rejects.toThrow('TurnIdleState: startTurn called, but ITurnContext is not available on the handler. This indicates an issue in the handler\'s startTurn implementation.');

            await jest.advanceTimersByTimeAsync(0);

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('TurnIdleState: startTurn called, but ITurnContext is not available on the handler.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: TurnIdleState \u2192 TurnIdleState`));

            misconfiguredHandler._setCurrentTurnContextInternal = originalSetContextInternal;
        });

        test('TurnIdleState.startTurn should throw (and handler recover) if actor in context mismatches', async () => {
            const wrongActor = createMockActor('wrong-actor');

            const turnContextForDummy = new TurnContext({
                actor: dummyActor,
                logger: mockLogger,
                services: mockServices,
                onEndTurnCallback: (err) => handler._handleTurnEnd(dummyActor.id, err, handler._isDestroyed),
                isAwaitingExternalEventProvider: mockIsAwaitingExternalEventProvider
            });
            handler._setCurrentTurnContextInternal(turnContextForDummy);
            handler._setCurrentActorInternal(dummyActor);

            mockLogger.error.mockClear();
            mockLogger.debug.mockClear();

            const turnIdleStateInstance = handler._getInternalState();

            await expect(turnIdleStateInstance.startTurn(handler, wrongActor)).rejects.toThrow(`TurnIdleState: Actor in TurnContext ('${dummyActor.id}') does not match actor provided to startTurn ('${wrongActor.id}').`);

            await jest.advanceTimersByTimeAsync(0);

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Actor in TurnContext ('${dummyActor.id}') does not match actor provided to startTurn ('${wrongActor.id}').`));
            expect(mockLogger.debug).toHaveBeenCalledWith(`MinimalTestHandler: TurnIdleState \u2192 TurnIdleState`);
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
            // With TurnEndingState fixed, only the primary error from AwaitingPlayerInputState should be logged.
            expect(errorCallsDuringTest.length).toBe(1);

            if (errorCallsDuringTest.length > 0) {
                expect(errorCallsDuringTest[0][0]).toBe(`AwaitingPlayerInputState: Failed to subscribe to command input or prompt player for actor ${dummyActor.id}.`);
                expect(errorCallsDuringTest[0][1]).toBe(subscriptionError);
            }

            expect(handler._handleTurnEnd).toHaveBeenCalledTimes(1);
            expect(handler._handleTurnEnd).toHaveBeenCalledWith(dummyActor.id, expect.any(Error), false);


            expect(mockLogger.debug).toHaveBeenCalledWith(
                `MinimalTestHandler: AwaitingPlayerInputState \u2192 TurnEndingState`
            );

            expect(resetSpy).toHaveBeenCalled();

            expect(mockLogger.debug).toHaveBeenCalledWith(
                `MinimalTestHandler: TurnEndingState \u2192 TurnIdleState`
            );

            expect(handler._getInternalState()).toBeInstanceOf(TurnIdleState);
            expect(handler._getInternalState().getStateName()).toBe('TurnIdleState');

            // If TurnEndingState.enterState is now clean, this warning (about BaseTurnHandler forcing a transition due to *TurnEndingState* failing)
            // should not occur.
            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining('Forcing transition to TurnIdleState due to error entering TurnEndingState')
            );
            // Check generally that no warning about "Forcing transition..." occurred if not expected.
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
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: PlayerTurnHandler is being destroyed while awaiting input for actor ${dummyActor.id}.`));

            expect(handler._handleTurnEnd).toHaveBeenCalledTimes(1);
            expect(handler._handleTurnEnd).toHaveBeenCalledWith(dummyActor.id, expect.any(Error), true);

            expect(mockLogger.debug).toHaveBeenCalledWith(`MinimalTestHandler.destroy: Calling destroy on current state AwaitingPlayerInputState.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: AwaitingPlayerInputState \u2192 TurnEndingState`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: TurnEndingState \u2192 TurnIdleState`));

            expect(resetSpy).toHaveBeenCalledWith(expect.stringContaining(`destroy-MinimalTestHandler`));
            expect(handler._getInternalState()).toBeInstanceOf(TurnIdleState);

            const currentStateNameDuringDestroyCheck = 'AwaitingPlayerInputState';
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`MinimalTestHandler.destroy: Ensuring transition to TurnIdleState (current: ${currentStateNameDuringDestroyCheck}`)
            );
            expect(mockLogger.debug).not.toHaveBeenCalledWith(
                expect.stringContaining('MinimalTestHandler.destroy: Already in TurnIdleState after state cleanup and reset.')
            );

            expect(mockLogger.debug).toHaveBeenCalledWith(`MinimalTestHandler.destroy() complete.`);

            // With TurnEndingState fixed, no errors should be logged by BaseTurnHandler during these transitions.
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        test('calling destroy() multiple times should be idempotent', async () => {
            // First destroy call (and its async processes)
            await handler.destroy();
            await jest.advanceTimersByTimeAsync(0);

            // Clear mocks for the second call
            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.error.mockClear();
            handler._handleTurnEnd.mockClear();
            resetSpy.mockClear();
            stateDestroySpy.mockClear();


            const transitionSpy = jest.spyOn(handler, '_transitionToState');

            // Second destroy call
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