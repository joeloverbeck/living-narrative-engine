// src/tests/core/turns/handlers/baseTurnHandler.test.js
// --- FILE START ---

/**
 * @fileoverview Smoke-test harness for BaseTurnHandler core lifecycle.
 * Ticket: 1.5
 * PTH-REFACTOR-003.2: Adjusted tests to account for AwaitingPlayerInputState's
 * new dependency on IActorTurnStrategy.
 * PTH-REFACTOR-003.4: Updated TurnContext instantiation to include strategy.
 */

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';

// Adjust paths based on actual project structure relative to this test file
import {BaseTurnHandler} from '../../../../core/turns/handlers/baseTurnHandler.js';
import {TurnContext} from '../../../../core/turns/context/turnContext.js';
import {TurnIdleState} from '../../../../core/turns/states/turnIdleState.js';
import {AwaitingPlayerInputState} from '../../../../core/turns/states/awaitingPlayerInputState.js';
import {TurnEndingState} from '../../../../core/turns/states/turnEndingState.js'; // Needed for some assertions
import {AbstractTurnState} from '../../../../core/turns/states/abstractTurnState.js'; // For calling super methods in mocks
import {IActorTurnStrategy} from '../../../../core/turns/interfaces/IActorTurnStrategy.js'; // Import for type check if needed

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

let mockDefaultStrategyImplementation; // Renamed for clarity

class MinimalTestHandler extends BaseTurnHandler {
    #servicesForContext;
    #isAwaitingExternalEventProviderForContext;
    #onSetAwaitingExternalEventCallbackProviderForContext;
    // Store strategy to be passed to TurnContext
    #strategyForContext;

    constructor({
                    logger,
                    // No initialConcreteState needed here anymore
                    servicesForContext,
                    strategyForContext,
                    isAwaitingExternalEventProviderForContext,
                    onSetAwaitingExternalEventCallbackProviderForContext,
                }) {
        super({logger}); // Call base constructor first
        // Assign other dependencies...
        this.#servicesForContext = servicesForContext;
        this.#strategyForContext = strategyForContext;
        this.#isAwaitingExternalEventProviderForContext = isAwaitingExternalEventProviderForContext;
        this.#onSetAwaitingExternalEventCallbackProviderForContext = onSetAwaitingExternalEventCallbackProviderForContext;

        // Create and set the initial state AFTER super()
        const initialState = new TurnIdleState(this);
        this._setInitialState(initialState); // Use the protected setter
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

        // Ensure a strategy is available, use from constructor or default mock
        const strategyToUse = this.#strategyForContext || this.#servicesForContext?.mockStrategy || mockDefaultStrategyImplementation;
        if (!strategyToUse) {
            this.getLogger().error(`${this.constructor.name}.startTurn: No strategy available for TurnContext construction.`);
            throw new Error(`${this.constructor.name}.startTurn: Critical - no strategy provided for actor ${actor.id}`);
        }


        const newTurnContext = new TurnContext({
            actor: actor,
            logger: this.getLogger().createChild({turnActorId: actor.id}), // Use a child logger for context
            services: this.#servicesForContext,
            strategy: strategyToUse, // Pass the strategy here
            onEndTurnCallback: onEndTurnCallback,
            isAwaitingExternalEventProvider: this.#isAwaitingExternalEventProviderForContext,
            onSetAwaitingExternalEventCallback: this.#onSetAwaitingExternalEventCallbackProviderForContext,
            handlerInstance: this,
        });

        // The below was a hack, now strategy is properly passed.
        // We might still want to mock getStrategy on the context instance for some tests if needed,
        // but TurnContext itself should now return the one passed to its constructor.
        // if (!newTurnContext.getStrategy) {
        // newTurnContext.getStrategy = jest.fn().mockReturnValue(strategyToUse);
        // }
        if (!newTurnContext.setChosenAction) { // Keep this if setChosenAction is still a planned extension
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
        _handler: null,
        getStateName: jest.fn().mockReturnValue(name),
        enterState: jest.fn().mockResolvedValue(undefined),
        exitState: jest.fn().mockResolvedValue(undefined),
        startTurn: jest.fn().mockImplementation(function () {
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
        _getTurnContext: jest.fn(function () {
            return this._handler?.getTurnContext();
        }),
    });

    const initializeHandler = () => {
        // No need for dummyInitialState creation here anymore

        handler = new MinimalTestHandler({
            logger: mockLogger,
            // No initialConcreteState passed here
            servicesForContext: mockServices,
            strategyForContext: mockServices.mockStrategy,
            isAwaitingExternalEventProviderForContext: mockIsAwaitingExternalEventProvider,
            onSetAwaitingExternalEventCallbackProviderForContext: mockOnSetAwaitingExternalEventCallback,
        });

        // No need for handler linking or overwriting _currentState here

        // Keep spies setup
        if (handler.onEnterState?.mockRestore) handler.onEnterState.mockRestore();
        jest.spyOn(handler, 'onEnterState').mockImplementation(async () => {
        });

        if (handler.onExitState?.mockRestore) handler.onExitState.mockRestore();
        jest.spyOn(handler, 'onExitState').mockImplementation(async () => {
        });

        if (handler._handleTurnEnd?.mockRestore) handler._handleTurnEnd.mockRestore();
        jest.spyOn(handler, '_handleTurnEnd');

        if (resetSpy?.mockRestore) resetSpy.mockRestore();
        resetSpy = jest.spyOn(handler, '_resetTurnStateAndResources');
    };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();

        dummyActor = createMockActor('smoke-test-actor-1');
        mockIsAwaitingExternalEventProvider = jest.fn().mockReturnValue(false);
        mockOnSetAwaitingExternalEventCallback = jest.fn();

        // This is the actual mock IActorTurnStrategy implementation
        mockDefaultStrategyImplementation = {
            decideAction: jest.fn().mockResolvedValue(createMockTurnAction('default mock action from strategy')),
        };

        mockServices = {
            playerPromptService: mockPlayerPromptService,
            subscriptionManager: mockSubscriptionManager,
            turnEndPort: mockTurnEndPort,
            game: mockGameService,
            mockStrategy: mockDefaultStrategyImplementation, // mockStrategy is the object itself
            commandProcessor: {process: jest.fn().mockResolvedValue({success: true, directives: []})},
            commandOutcomeInterpreter: {interpret: jest.fn().mockReturnValue('defaultDirective')},
            safeEventDispatcher: {dispatchSafely: jest.fn().mockResolvedValue(undefined)},
        };

        initializeHandler(); // This will now use mockServices.mockStrategy

        stateDestroySpy = jest.spyOn(AwaitingPlayerInputState.prototype, 'destroy');
    });

    afterEach(async () => {
        if (AwaitingPlayerInputState.prototype.enterState && AwaitingPlayerInputState.prototype.enterState.mockRestore) {
            AwaitingPlayerInputState.prototype.enterState.mockRestore();
        }
        if (stateDestroySpy && stateDestroySpy.mockRestore) {
            stateDestroySpy.mockRestore();
        }

        if (handler && typeof handler.destroy === 'function' && !handler._isDestroyed) {
            await handler.destroy();
        }
        await jest.runAllTimersAsync();
        jest.useRealTimers();
    });

    test('should initialize correctly and be in TurnIdleState', () => {
        // Calls initializeHandler() via beforeEach

        expect(handler).toBeInstanceOf(MinimalTestHandler);
        expect(handler._getInternalState()).toBeInstanceOf(TurnIdleState);
        expect(handler._getInternalState().getStateName()).toBe('TurnIdleState');
    });

    describe('startTurn()', () => {
        let originalAwaitingEnterState;

        beforeEach(() => {
            originalAwaitingEnterState = AwaitingPlayerInputState.prototype.enterState;
        });

        afterEach(() => {
            if (originalAwaitingEnterState) {
                AwaitingPlayerInputState.prototype.enterState = originalAwaitingEnterState;
            }
        });

        test('should transition from TurnIdleState to AwaitingPlayerInputState successfully (and pause there)', async () => {
            expect(handler._getInternalState()).toBeInstanceOf(TurnIdleState);

            // mockDefaultStrategyImplementation is already set up in the main beforeEach
            // to resolve with a mock action.
            // No need to mock contextGetStrategyMock unless testing specific context mock behavior

            // Mock AwaitingPlayerInputState.prototype.enterState to pause
            const enterStatePauseMock = jest.fn(async function (h, prevState) {
                this._handler = h;
                await AbstractTurnState.prototype.enterState.call(this, h, prevState);
                const currentCtx = this._getTurnContext();
                currentCtx?.getLogger().info(`${this.getStateName()}: Mocked entry for transition test. Pausing.`);
                // Deliberately do not proceed further to simulate pause
            });
            AwaitingPlayerInputState.prototype.enterState = enterStatePauseMock;

            await handler.startTurn(dummyActor);

            expect(handler._getInternalState()).toBeInstanceOf(AwaitingPlayerInputState);
            expect(handler._getInternalState().getStateName()).toBe('AwaitingPlayerInputState');
            expect(AwaitingPlayerInputState.prototype.enterState).toHaveBeenCalled();

            const turnContextAfterStart = handler._getInternalTurnContext();
            expect(turnContextAfterStart).toBeInstanceOf(TurnContext);
            expect(turnContextAfterStart.getActor()).toBe(dummyActor);
            expect(turnContextAfterStart.getStrategy()).toBe(mockDefaultStrategyImplementation); // Verify strategy is in context
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
            // mockDefaultStrategyImplementation.decideAction already set up

            await handler.startTurn(dummyActor);

            expect(handler.onExitState).toHaveBeenCalledTimes(1);
            expect(handler.onExitState).toHaveBeenCalledWith(expect.any(TurnIdleState), expect.any(AwaitingPlayerInputState));
            expect(handler.onEnterState).toHaveBeenCalledTimes(1);
            expect(handler.onEnterState).toHaveBeenCalledWith(expect.any(AwaitingPlayerInputState), expect.any(TurnIdleState));
        });

        test('TurnIdleState.startTurn should throw (and handler recover) if ITurnContext is missing', async () => {
            const misconfiguredHandler = new MinimalTestHandler({
                logger: mockLogger,
                initialConcreteState: createDummyInitialState('DummyForMisconfiguredTest'),
                servicesForContext: mockServices,
                strategyForContext: mockServices.mockStrategy, // Pass strategy
                isAwaitingExternalEventProviderForContext: mockIsAwaitingExternalEventProvider,
                onSetAwaitingExternalEventCallbackProviderForContext: mockOnSetAwaitingExternalEventCallback,
            });
            misconfiguredHandler._currentState = new TurnIdleState(misconfiguredHandler);
            jest.spyOn(misconfiguredHandler, 'onEnterState').mockImplementation(async () => {
            });
            jest.spyOn(misconfiguredHandler, 'onExitState').mockImplementation(async () => {
            });

            misconfiguredHandler._setCurrentTurnContextInternal(null);
            misconfiguredHandler._setCurrentActorInternal(dummyActor);

            const turnIdleStateInstance = misconfiguredHandler._getInternalState();
            const expectedErrorMessage = `TurnIdleState: ITurnContext is missing or invalid. Expected concrete handler to set it up. Actor: ${dummyActor.id}.`;

            await expect(turnIdleStateInstance.startTurn(misconfiguredHandler, dummyActor)).rejects.toThrow(expectedErrorMessage);

            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessage);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: State Transition: TurnIdleState \u2192 TurnIdleState`));
            expect(misconfiguredHandler._getInternalState()).toBeInstanceOf(TurnIdleState);
        });

        test('TurnIdleState.startTurn should throw (and handler recover) if actor in context mismatches', async () => {
            const wrongActor = createMockActor('wrong-actor');
            const localHandler = new MinimalTestHandler({
                logger: mockLogger,
                initialConcreteState: createDummyInitialState('TempInitialStateForLocalHandlerMismatchTest'),
                servicesForContext: mockServices,
                strategyForContext: mockServices.mockStrategy, // Pass strategy
                isAwaitingExternalEventProviderForContext: mockIsAwaitingExternalEventProvider,
                onSetAwaitingExternalEventCallbackProviderForContext: mockOnSetAwaitingExternalEventCallback,
            });
            localHandler._currentState = new TurnIdleState(localHandler);
            if (localHandler._initialConcreteState && typeof localHandler._initialConcreteState._getTurnContext === 'function') {
                localHandler._initialConcreteState._handler = localHandler;
            }

            const turnContextForDummy = new TurnContext({
                actor: dummyActor,
                logger: mockLogger,
                services: mockServices,
                strategy: mockServices.mockStrategy, // CRITICAL: Pass strategy here
                onEndTurnCallback: (err) => localHandler._handleTurnEnd(dummyActor.id, err, localHandler._isDestroyed),
                isAwaitingExternalEventProvider: mockIsAwaitingExternalEventProvider,
                onSetAwaitingExternalEventCallback: mockOnSetAwaitingExternalEventCallback,
                handlerInstance: localHandler,
            });

            localHandler._setCurrentTurnContextInternal(turnContextForDummy);
            localHandler._setCurrentActorInternal(dummyActor);

            const turnIdleStateInstance = localHandler._getInternalState();
            const expectedErrorMessage = `TurnIdleState: Actor in ITurnContext ('${dummyActor.id}') does not match actor provided to state's startTurn ('${wrongActor.id}').`;

            await expect(turnIdleStateInstance.startTurn(localHandler, wrongActor)).rejects.toThrow(expectedErrorMessage);

            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessage);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: State Transition: TurnIdleState \u2192 TurnIdleState`));
        });

        test('AwaitingPlayerInputState.enterState handles strategy execution failure (BaseTurnHandler recovers)', async () => {
            const strategyError = new Error('Strategy failed to decide');
            mockDefaultStrategyImplementation.decideAction.mockRejectedValue(strategyError);
            // The handler is already initialized with mockDefaultStrategyImplementation via mockServices.mockStrategy

            await handler.startTurn(dummyActor);
            await jest.advanceTimersByTimeAsync(0); // Ensure all promises in the chain resolve

            // Corrected assertion to match AwaitingPlayerInputState's actual logging
            expect(mockLogger.error).toHaveBeenCalledWith(
                // The message logged by AwaitingPlayerInputState.js when decideAction or requestTransition fails
                `AwaitingPlayerInputState: Error during action decision, storage, or transition for actor ${dummyActor.id}: ${strategyError.message}`,
                // AwaitingPlayerInputState.js logs an object { originalError: error } as the second param
                {originalError: strategyError}
            );
            expect(handler._handleTurnEnd).toHaveBeenCalledTimes(1);
            const errorArgToHandleTurnEnd = handler._handleTurnEnd.mock.calls[0][1];
            // The error passed to endTurn in AwaitingPlayerInputState.js also includes the strategyError.message
            expect(errorArgToHandleTurnEnd.message).toContain(`Error during action decision, storage, or transition for actor ${dummyActor.id}: ${strategyError.message}`);


            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: State Transition: TurnIdleState \u2192 AwaitingPlayerInputState`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: State Transition: AwaitingPlayerInputState \u2192 TurnEndingState`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: State Transition: TurnEndingState \u2192 TurnIdleState`));


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
                this._handler = h; // AbstractTurnState needs this for _getTurnContext
                await AbstractTurnState.prototype.enterState.call(this, h, prevState); // Call super for logging
                const currentCtx = this._getTurnContext();
                currentCtx?.getLogger().info(`${this.getStateName()}: Mocked entry for destroy test. Pausing.`);
                // Simulate a pause, like waiting for async strategy.decideAction()
                return new Promise((resolve) => {
                    enterStatePromiseResolveFn = resolve; // Store resolve to manually complete later
                });
            });

            handler._currentState = new TurnIdleState(handler); // Start from Idle
            // mockDefaultStrategyImplementation.decideAction is already prepared by main beforeEach

            // Do not await this, as enterState is mocked to pause
            const startTurnCallPromise = handler.startTurn(dummyActor);
            await jest.advanceTimersByTimeAsync(0); // Let startTurn initiate and reach the mocked enterState

            expect(handler._getInternalState()).toBeInstanceOf(AwaitingPlayerInputState); // Confirms we are in the target state
            expect(AwaitingPlayerInputState.prototype.enterState).toHaveBeenCalled();

            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.error.mockClear();
            handler._handleTurnEnd.mockClear();
            resetSpy.mockClear();
            // stateDestroySpy is on AwaitingPlayerInputState.prototype.destroy from the main beforeEach

            await handler.destroy(); // Destroy the handler

            expect(handler._isDestroyed).toBe(true);
            expect(stateDestroySpy).toHaveBeenCalledTimes(1); // AwaitingPlayerInputState.destroy() should be called

            // Corrected assertion for the log message from AwaitingPlayerInputState.destroy()
            expect(mockLogger.info).toHaveBeenCalledWith(
                `AwaitingPlayerInputState: Handler destroyed while state was active for actor ${dummyActor.id}. Ending turn.`
            );

            const expectedDestroyErrorMsg = `Turn handler destroyed while actor ${dummyActor.id} was in AwaitingPlayerInputState.`;
            expect(handler._handleTurnEnd).toHaveBeenCalledWith(dummyActor.id, expect.objectContaining({message: expectedDestroyErrorMsg}), true);

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`MinimalTestHandler: State Transition: AwaitingPlayerInputState \u2192 TurnEndingState`));
            expect(resetSpy).toHaveBeenCalledWith(expect.stringContaining(`destroy-MinimalTestHandler`));
            expect(handler._getInternalState()).toBeInstanceOf(TurnIdleState);
            expect(mockLogger.error).not.toHaveBeenCalled(); // No unexpected errors

            if (enterStatePromiseResolveFn) enterStatePromiseResolveFn(); // Resolve the promise from mocked enterState
            try {
                await startTurnCallPromise; // Now await the original startTurn call to catch any errors from it
            } catch (e) {
                // Errors are expected if the turn was aborted by destroy
                expect(e.message).toContain(expectedDestroyErrorMsg);
            }
        });

        test('calling destroy() multiple times should be idempotent', async () => {
            await handler.destroy();

            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.error.mockClear();
            handler._handleTurnEnd.mockClear();
            resetSpy.mockClear();
            stateDestroySpy.mockClear();

            const transitionSpy = jest.spyOn(handler, '_transitionToState');

            await handler.destroy(); // Second destroy

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