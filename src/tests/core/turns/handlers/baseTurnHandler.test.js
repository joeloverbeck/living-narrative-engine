// src/tests/core/turns/handlers/baseTurnHandler.test.js
// --- FILE START ---

/**
 * @fileoverview Smoke-test harness for BaseTurnHandler core lifecycle.
 * Ticket: 1.5
 * PTH-REFACTOR-003.2: Adjusted tests to account for AwaitingPlayerInputState's
 * new dependency on IActorTurnStrategy.
 */

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';

// Adjust paths based on actual project structure relative to this test file
import {BaseTurnHandler} from '../../../../core/turns/handlers/baseTurnHandler.js';
import {TurnContext} from '../../../../core/turns/context/turnContext.js';
import {TurnIdleState} from '../../../../core/turns/states/turnIdleState.js';
import {AwaitingPlayerInputState} from '../../../../core/turns/states/awaitingPlayerInputState.js';
import {TurnEndingState} from '../../../../core/turns/states/turnEndingState.js'; // Needed for some assertions
import {AbstractTurnState} from '../../../../core/turns/states/abstractTurnState.js'; // For calling super methods in mocks

// --- Mocks & Test Utilities ---

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    createChild: jest.fn(() => mockLogger), // Return self for child logger
};

const createMockActor = (id = 'test-actor') => ({
    id: id,
    name: `MockActor-${id}`,
    getId: jest.fn(() => id), // Ensure getId method if used by code under test
});

const mockPlayerPromptService = {
    prompt: jest.fn().mockResolvedValue('mock command'),
};

const mockSubscriptionManager = {
    subscribeToCommandInput: jest.fn().mockReturnValue(jest.fn()),
    subscribeToTurnEnded: jest.fn().mockReturnValue(jest.fn()),
    unsubscribeAll: jest.fn(),
};

const mockTurnEndPort = {
    notifyTurnEnded: jest.fn().mockResolvedValue(undefined),
};

const mockGameService = {
    recordEvent: jest.fn(),
};

const createMockTurnAction = (commandString = 'mock action', actionDefinitionId = 'mock:action') => ({
    commandString: commandString,
    actionDefinitionId: actionDefinitionId,
    resolvedParameters: {},
});

let mockDefaultStrategy;

class MinimalTestHandler extends BaseTurnHandler {
    #servicesForContext;
    #isAwaitingExternalEventProviderForContext;
    #onSetAwaitingExternalEventCallbackProviderForContext;

    constructor({
                    logger,
                    initialConcreteState,
                    servicesForContext,
                    isAwaitingExternalEventProviderForContext,
                    onSetAwaitingExternalEventCallbackProviderForContext,
                }) {
        super({logger, initialConcreteState});
        this.#servicesForContext = servicesForContext;
        this.#isAwaitingExternalEventProviderForContext = isAwaitingExternalEventProviderForContext;
        this.#onSetAwaitingExternalEventCallbackProviderForContext = onSetAwaitingExternalEventCallbackProviderForContext;
    }

    async startTurn(actor) {
        this._assertHandlerActive();
        if (!actor) {
            const errorMsg = `${this.constructor.name}.startTurn: actor is required.`;
            this.getLogger().error(errorMsg);
            throw new Error(errorMsg);
        }
        this._setCurrentActorInternal(actor);

        const onEndTurnCallback = (error) => {
            const actorIdForEndTurn = this.getCurrentActor()?.id || actor.id; // Robustly get actor ID
            this._handleTurnEnd(actorIdForEndTurn, error, this._isDestroyed);
        };

        const newTurnContext = new TurnContext({
            actor: actor,
            logger: this.getLogger().createChild({turnActorId: actor.id}), // Use a child logger for context
            services: this.#servicesForContext,
            onEndTurnCallback: onEndTurnCallback,
            isAwaitingExternalEventProvider: this.#isAwaitingExternalEventProviderForContext,
            onSetAwaitingExternalEventCallback: this.#onSetAwaitingExternalEventCallbackProviderForContext,
            handlerInstance: this,
        });

        if (!newTurnContext.getStrategy) {
            newTurnContext.getStrategy = jest.fn().mockReturnValue(this.#servicesForContext.mockStrategy || mockDefaultStrategy);
        }
        if (!newTurnContext.setChosenAction) {
            newTurnContext.setChosenAction = jest.fn();
        }

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
    let mockOnSetAwaitingExternalEventCallback;
    let resetSpy;
    let stateDestroySpy; // Spy for AwaitingPlayerInputState.prototype.destroy

    const createDummyInitialState = (name = 'DummyInitState') => ({
        // This is the state object, not a constructor.
        // It needs all methods from ITurnState.
        _handler: null, // Will be set by initializeHandler for _getTurnContext
        getStateName: jest.fn().mockReturnValue(name),
        enterState: jest.fn().mockResolvedValue(undefined),
        exitState: jest.fn().mockResolvedValue(undefined),
        startTurn: jest.fn().mockImplementation(function () { // Use function for 'this' if needed
            throw new Error(`${this.getStateName()}.startTurn should not be called unless it's TurnIdleState`);
        }),
        handleSubmittedCommand: jest.fn().mockImplementation(function () {
            throw new Error(`${this.getStateName()}.handleSubmittedCommand should not be called`);
        }),
        handleTurnEndedEvent: jest.fn().mockImplementation(function () {
            throw new Error(`${this.getStateName()}.handleTurnEndedEvent should not be called`);
        }),
        processCommandResult: jest.fn().mockImplementation(function () {
            throw new Error(`${this.getStateName()}.processCommandResult should not be called`);
        }),
        handleDirective: jest.fn().mockImplementation(function () {
            throw new Error(`${this.getStateName()}.handleDirective should not be called`);
        }),
        destroy: jest.fn().mockResolvedValue(undefined),
        // Mock _getTurnContext if AbstractTurnState methods are called via .call(this, ...)
        _getTurnContext: jest.fn(function () {
            return this._handler?.getTurnContext();
        }),
    });

    const initializeHandler = (initialConcreteStateOverride = null) => {
        const defaultDummyStateName = 'DummyInitStateForBeforeEach';
        const dummyInitialState = initialConcreteStateOverride || createDummyInitialState(defaultDummyStateName);

        handler = new MinimalTestHandler({
            logger: mockLogger,
            initialConcreteState: dummyInitialState,
            servicesForContext: mockServices,
            isAwaitingExternalEventProviderForContext: mockIsAwaitingExternalEventProvider,
            onSetAwaitingExternalEventCallbackProviderForContext: mockOnSetAwaitingExternalEventCallback,
        });

        // Assign handler to the dummy state if it's used, for _getTurnContext
        if (dummyInitialState && typeof dummyInitialState._getTurnContext === 'function') {
            dummyInitialState._handler = handler;
        }

        // For most tests, we want to start with a clean TurnIdleState.
        // The BaseTurnHandler constructor will use initialConcreteState.
        // If we want to ensure it's specifically TurnIdleState after that:
        if (!initialConcreteStateOverride || dummyInitialState.getStateName() === defaultDummyStateName) {
            handler._currentState = new TurnIdleState(handler);
            // Manually call enterState if needed, though TurnIdleState's enter resets things.
            // For simplicity, we assume tests needing specific pre-states will set them.
            // BaseTurnHandler's constructor logs with the initial state name.
            // If we immediately switch to TurnIdleState, its enter log will also occur.
        }


        // Spies on the handler instance
        if (handler.onEnterState.mockRestore) handler.onEnterState.mockRestore();
        jest.spyOn(handler, 'onEnterState').mockImplementation(async () => {
        });

        if (handler.onExitState.mockRestore) handler.onExitState.mockRestore();
        jest.spyOn(handler, 'onExitState').mockImplementation(async () => {
        });

        if (handler._handleTurnEnd.mockRestore) handler._handleTurnEnd.mockRestore();
        jest.spyOn(handler, '_handleTurnEnd');

        if (resetSpy && resetSpy.mockRestore) resetSpy.mockRestore(); // resetSpy is on the handler instance
        resetSpy = jest.spyOn(handler, '_resetTurnStateAndResources');
    };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();

        dummyActor = createMockActor('smoke-test-actor-1');
        mockIsAwaitingExternalEventProvider = jest.fn().mockReturnValue(false);
        mockOnSetAwaitingExternalEventCallback = jest.fn();

        mockDefaultStrategy = {
            decideAction: jest.fn().mockResolvedValue(createMockTurnAction('default mock action from strategy')),
        };

        mockServices = {
            playerPromptService: mockPlayerPromptService,
            subscriptionManager: mockSubscriptionManager,
            turnEndPort: mockTurnEndPort,
            game: mockGameService,
            mockStrategy: mockDefaultStrategy,
            commandProcessor: {process: jest.fn().mockResolvedValue({success: true, directives: []})},
            commandOutcomeInterpreter: {interpret: jest.fn().mockReturnValue('defaultDirective')},
            safeEventDispatcher: {dispatchSafely: jest.fn().mockResolvedValue(undefined)},
        };

        initializeHandler();

        // Spy on AwaitingPlayerInputState.prototype.destroy. Restored in main afterEach.
        stateDestroySpy = jest.spyOn(AwaitingPlayerInputState.prototype, 'destroy');
    });

    afterEach(async () => {
        // Restore any prototype-level mocks here to prevent test leakage
        if (AwaitingPlayerInputState.prototype.enterState && AwaitingPlayerInputState.prototype.enterState.mockRestore) {
            AwaitingPlayerInputState.prototype.enterState.mockRestore();
        }
        if (stateDestroySpy && stateDestroySpy.mockRestore) {
            stateDestroySpy.mockRestore();
        }
        // If AbstractTurnState methods were spied on its prototype, restore them too.
        // e.g. if (AbstractTurnState.prototype.enterState.mockRestore) AbstractTurnState.prototype.enterState.mockRestore();


        if (handler && typeof handler.destroy === 'function' && !handler._isDestroyed) {
            await handler.destroy();
        }
        await jest.runAllTimersAsync();
        jest.useRealTimers();
    });

    test('should initialize correctly and be in TurnIdleState', () => {
        expect(handler).toBeInstanceOf(MinimalTestHandler);
        // initializeHandler sets the current state to TurnIdleState
        expect(handler._getInternalState()).toBeInstanceOf(TurnIdleState);
        expect(handler._getInternalState().getStateName()).toBe('TurnIdleState');

        // Log from BaseTurnHandler constructor (with 'DummyInitStateForBeforeEach')
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `MinimalTestHandler initialised. Initial state: DummyInitStateForBeforeEach`
        );
        // If initializeHandler sets _currentState to new TurnIdleState(handler),
        // and if TurnIdleState's enterState (or its super.enterState) logs:
        // It would log: "TurnIdleState: Entered. Actor: N/A. Previous state: DummyInitStateForBeforeEach"
        // This depends on how/if enterState is called by initializeHandler or constructor.
        // For now, the primary check is that it *is* in TurnIdleState.
    });

    describe('startTurn()', () => {
        // Store original prototype methods to restore them
        let originalAwaitingEnterState;

        beforeEach(() => {
            originalAwaitingEnterState = AwaitingPlayerInputState.prototype.enterState;
        });

        afterEach(() => {
            // Restore prototype method after each test in this describe block
            if (originalAwaitingEnterState) { // Ensure it was captured
                AwaitingPlayerInputState.prototype.enterState = originalAwaitingEnterState;
            }
        });

        test('should transition from TurnIdleState to AwaitingPlayerInputState successfully (and pause there)', async () => {
            expect(handler._getInternalState()).toBeInstanceOf(TurnIdleState);

            mockDefaultStrategy.decideAction.mockResolvedValue(createMockTurnAction('test command'));
            const contextGetStrategyMock = jest.fn().mockReturnValue(mockDefaultStrategy);
            const contextSetChosenActionMock = jest.fn();

            AwaitingPlayerInputState.prototype.enterState = jest.fn(async function (h, prevState) {
                this._handler = h; // For AbstractTurnState methods
                await AbstractTurnState.prototype.enterState.call(this, h, prevState); // Call super for logging
                const currentCtx = this._getTurnContext();
                currentCtx?.getLogger().info(`${this.getStateName()}: Mocked entry for transition test. Pausing.`);
                // Deliberately do not proceed to strategy.decideAction or requestTransition
            });

            const originalSetCurrentTurnContextInternal = handler._setCurrentTurnContextInternal.bind(handler);
            handler._setCurrentTurnContextInternal = (turnContext) => {
                if (turnContext) {
                    turnContext.getStrategy = contextGetStrategyMock;
                    turnContext.setChosenAction = contextSetChosenActionMock;
                }
                originalSetCurrentTurnContextInternal(turnContext);
            };

            await handler.startTurn(dummyActor);

            expect(handler._getInternalState()).toBeInstanceOf(AwaitingPlayerInputState);
            expect(handler._getInternalState().getStateName()).toBe('AwaitingPlayerInputState');
            expect(AwaitingPlayerInputState.prototype.enterState).toHaveBeenCalled();

            const turnContextAfterStart = handler._getInternalTurnContext();
            expect(turnContextAfterStart).toBeInstanceOf(TurnContext);
            expect(turnContextAfterStart.getActor()).toBe(dummyActor);

            handler._setCurrentTurnContextInternal = originalSetCurrentTurnContextInternal;
        });

        test('should throw error if startTurn is called with no actor', async () => {
            await expect(handler.startTurn(null)).rejects.toThrow('MinimalTestHandler.startTurn: actor is required.');
            expect(mockLogger.error).toHaveBeenCalledWith('MinimalTestHandler.startTurn: actor is required.');
        });

        test('should call onExitState (for TurnIdleState) and onEnterState (for AwaitingPlayerInputState) hooks during successful transition (when paused in Awaiting)', async () => {
            AwaitingPlayerInputState.prototype.enterState = jest.fn(async function (h, prevState) {
                this._handler = h;
                await AbstractTurnState.prototype.enterState.call(this, h, prevState);
                const currentCtx = this._getTurnContext();
                currentCtx?.getLogger().info(`${this.getStateName()}: Mocked entry for hook test. Pausing.`);
            });

            mockDefaultStrategy.decideAction.mockResolvedValue(createMockTurnAction());

            await handler.startTurn(dummyActor);

            expect(handler.onExitState).toHaveBeenCalledTimes(1);
            expect(handler.onExitState).toHaveBeenCalledWith(expect.any(TurnIdleState), expect.any(AwaitingPlayerInputState));
            expect(handler.onEnterState).toHaveBeenCalledTimes(1);
            expect(handler.onEnterState).toHaveBeenCalledWith(expect.any(AwaitingPlayerInputState), expect.any(TurnIdleState));
        });

        test('TurnIdleState.startTurn should throw (and handler recover) if ITurnContext is missing', async () => {
            // This test creates its own handler, so it doesn't use the global `handler` from beforeEach.
            const misconfiguredHandler = new MinimalTestHandler({
                logger: mockLogger,
                initialConcreteState: createDummyInitialState('DummyForMisconfiguredTest'),
                servicesForContext: mockServices,
                isAwaitingExternalEventProviderForContext: mockIsAwaitingExternalEventProvider,
                onSetAwaitingExternalEventCallbackProviderForContext: mockOnSetAwaitingExternalEventCallback,
            });
            misconfiguredHandler._currentState = new TurnIdleState(misconfiguredHandler); // Ensure it's in Idle
            jest.spyOn(misconfiguredHandler, 'onEnterState').mockImplementation(async () => {
            });
            jest.spyOn(misconfiguredHandler, 'onExitState').mockImplementation(async () => {
            });

            misconfiguredHandler._setCurrentTurnContextInternal(null); // Crucial setup for the test
            misconfiguredHandler._setCurrentActorInternal(dummyActor); // Set actor for error message

            const turnIdleStateInstance = misconfiguredHandler._getInternalState();
            const expectedErrorMessage = `TurnIdleState: ITurnContext is missing or invalid. Expected concrete handler to set it up. Actor: ${dummyActor.id}.`;

            await expect(turnIdleStateInstance.startTurn(misconfiguredHandler, dummyActor)).rejects.toThrow(expectedErrorMessage);

            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessage);
            // The log check might need to be more specific to the misconfiguredHandler's logger if it's different
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: State Transition: TurnIdleState \u2192 TurnIdleState`));
            expect(misconfiguredHandler._getInternalState()).toBeInstanceOf(TurnIdleState);
        });

        test('TurnIdleState.startTurn should throw (and handler recover) if actor in context mismatches', async () => {
            const wrongActor = createMockActor('wrong-actor');

            // ** CORRECTED localHandler INSTANTIATION **
            const localHandler = new MinimalTestHandler({
                logger: mockLogger,
                // Use a dummy state object for the constructor, as initialConcreteState cannot be null
                // or a state constructed with a null handler.
                initialConcreteState: createDummyInitialState('TempInitialStateForLocalHandlerMismatchTest'),
                servicesForContext: mockServices,
                isAwaitingExternalEventProviderForContext: mockIsAwaitingExternalEventProvider,
                onSetAwaitingExternalEventCallbackProviderForContext: mockOnSetAwaitingExternalEventCallback,
            });
            // Now that localHandler is created, set its current state to a TurnIdleState
            // constructed *with* the valid localHandler.
            localHandler._currentState = new TurnIdleState(localHandler);
            // If the dummy state was used by the constructor and needs a handler ref:
            if (localHandler._initialConcreteState && typeof localHandler._initialConcreteState._getTurnContext === 'function') {
                localHandler._initialConcreteState._handler = localHandler;
            }


            const turnContextForDummy = new TurnContext({
                actor: dummyActor, // Context for dummyActor
                logger: mockLogger,
                services: mockServices,
                onEndTurnCallback: (err) => localHandler._handleTurnEnd(dummyActor.id, err, localHandler._isDestroyed),
                isAwaitingExternalEventProvider: mockIsAwaitingExternalEventProvider,
                onSetAwaitingExternalEventCallback: mockOnSetAwaitingExternalEventCallback,
                handlerInstance: localHandler,
            });
            // No need to mock getStrategy/setChosenAction on context for this test's path in TurnIdleState

            localHandler._setCurrentTurnContextInternal(turnContextForDummy);
            localHandler._setCurrentActorInternal(dummyActor); // Handler is tracking dummyActor from context

            const turnIdleStateInstance = localHandler._getInternalState(); // Should be TurnIdleState
            const expectedErrorMessage = `TurnIdleState: Actor in ITurnContext ('${dummyActor.id}') does not match actor provided to state's startTurn ('${wrongActor.id}').`;

            // Call TurnIdleState's startTurn directly with the wrongActor
            await expect(turnIdleStateInstance.startTurn(localHandler, wrongActor)).rejects.toThrow(expectedErrorMessage);

            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessage);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: State Transition: TurnIdleState \u2192 TurnIdleState`));
        });

        test('AwaitingPlayerInputState.enterState handles strategy execution failure (BaseTurnHandler recovers)', async () => {
            const strategyError = new Error('Strategy failed to decide');
            mockDefaultStrategy.decideAction.mockRejectedValue(strategyError);

            await handler.startTurn(dummyActor);

            // Allow pending promise chains and 0-delay timers to resolve.
            // The error handling path initiated by turnCtx.endTurn() runs asynchronously
            // and involves further state transitions that need to complete before assertions.
            await jest.advanceTimersByTimeAsync(0);

            // **** MOVED THIS LINE TO AFTER THE FLUSH FOR MORE COMPLETE LOGS ****
            console.log('DEBUG: mockLogger.debug calls (after flush):', JSON.stringify(mockLogger.debug.mock.calls, null, 2));

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`AwaitingPlayerInputState: Error during strategy execution or transition for actor ${dummyActor.id}.`),
                strategyError
            );
            expect(handler._handleTurnEnd).toHaveBeenCalledTimes(1);
            const errorArgToHandleTurnEnd = handler._handleTurnEnd.mock.calls[0][1];
            expect(errorArgToHandleTurnEnd.message).toContain(`Details: ${strategyError.message}`);

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: State Transition: TurnIdleState \u2192 AwaitingPlayerInputState`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: State Transition: AwaitingPlayerInputState \u2192 TurnEndingState`));
            // This is the assertion that was failing

            expect(resetSpy).toHaveBeenCalled();
            expect(handler._getInternalState()).toBeInstanceOf(TurnIdleState);
        });

    });

    describe('destroy()', () => {
        let originalAwaitingEnterState;

        beforeEach(() => {
            originalAwaitingEnterState = AwaitingPlayerInputState.prototype.enterState;
        });
        afterEach(() => {
            if (originalAwaitingEnterState) {
                AwaitingPlayerInputState.prototype.enterState = originalAwaitingEnterState;
            }
        });

        test('should mark handler as destroyed, reset resources, and transition to TurnIdleState (when destroying from AwaitingPlayerInputState)', async () => {
            let enterStatePromiseResolveFn;
            AwaitingPlayerInputState.prototype.enterState = jest.fn(async function (h, prevState) {
                this._handler = h;
                await AbstractTurnState.prototype.enterState.call(this, h, prevState);
                const currentCtx = this._getTurnContext();
                currentCtx?.getLogger().info(`${this.getStateName()}: Mocked entry for destroy test. Pausing.`);
                return new Promise((resolve) => {
                    enterStatePromiseResolveFn = resolve;
                });
            });

            handler._currentState = new TurnIdleState(handler);
            mockDefaultStrategy.decideAction.mockResolvedValue(createMockTurnAction());

            const startTurnCallPromise = handler.startTurn(dummyActor);
            await jest.advanceTimersByTimeAsync(0); // Allow promises to resolve, like the start of the mocked enterState

            expect(handler._getInternalState()).toBeInstanceOf(AwaitingPlayerInputState);
            expect(AwaitingPlayerInputState.prototype.enterState).toHaveBeenCalled();

            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.error.mockClear();
            handler._handleTurnEnd.mockClear();
            resetSpy.mockClear();
            // stateDestroySpy is on AwaitingPlayerInputState.prototype.destroy from the main beforeEach

            await handler.destroy();

            expect(handler._isDestroyed).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(`MinimalTestHandler.destroy() invoked.`);
            expect(stateDestroySpy).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`AwaitingPlayerInputState: Handler destroyed while awaiting input for ${dummyActor.id}.`));

            const expectedDestroyErrorMsg = `Turn handler destroyed while actor ${dummyActor.id} was in AwaitingPlayerInputState.`;
            expect(handler._handleTurnEnd).toHaveBeenCalledWith(dummyActor.id, expect.objectContaining({message: expectedDestroyErrorMsg}), true);

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: State Transition: AwaitingPlayerInputState \u2192 TurnEndingState`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: State Transition: TurnEndingState \u2192 TurnIdleState`));
            expect(resetSpy).toHaveBeenCalledWith(expect.stringContaining(`destroy-MinimalTestHandler`));
            expect(handler._getInternalState()).toBeInstanceOf(TurnIdleState);
            expect(mockLogger.info).toHaveBeenCalledWith(`MinimalTestHandler.destroy() complete.`);
            expect(mockLogger.error).not.toHaveBeenCalled();

            if (enterStatePromiseResolveFn) enterStatePromiseResolveFn(); // Resolve the promise from mocked enterState
            try {
                await startTurnCallPromise;
            } catch (e) { /* Errors from aborted turn are expected */
            }
        });

        test('calling destroy() multiple times should be idempotent', async () => {
            await handler.destroy(); // First destroy, handler should be in TurnIdleState

            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.error.mockClear();
            handler._handleTurnEnd.mockClear();
            resetSpy.mockClear();
            stateDestroySpy.mockClear(); // Clear calls for this specific assertion

            const transitionSpy = jest.spyOn(handler, '_transitionToState');

            await handler.destroy(); // Second destroy

            expect(mockLogger.debug).toHaveBeenCalledWith('MinimalTestHandler.destroy() called but already destroyed.');
            expect(resetSpy).not.toHaveBeenCalled();
            expect(transitionSpy).not.toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalledWith(`MinimalTestHandler.destroy() invoked.`);
            expect(stateDestroySpy).not.toHaveBeenCalled(); // Should not call Awaiting's destroy if already Idle
            expect(mockLogger.error).not.toHaveBeenCalled();

            transitionSpy.mockRestore();
        });
    });
});
// --- FILE END ---