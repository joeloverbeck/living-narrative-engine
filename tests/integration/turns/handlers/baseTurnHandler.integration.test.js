import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { BaseTurnHandler } from '../../../../src/turns/handlers/baseTurnHandler.js';
import { AbstractTurnState } from '../../../../src/turns/states/abstractTurnState.js';
import { ITurnStateFactory } from '../../../../src/turns/interfaces/ITurnStateFactory.js';
import TurnDirectiveStrategyResolver from '../../../../src/turns/strategies/turnDirectiveStrategyResolver.js';
import TurnDirective from '../../../../src/turns/constants/turnDirectives.js';
import EndTurnSuccessStrategy from '../../../../src/turns/strategies/endTurnSuccessStrategy.js';
import EndTurnFailureStrategy from '../../../../src/turns/strategies/endTurnFailureStrategy.js';
import RepromptStrategy from '../../../../src/turns/strategies/repromptStrategy.js';
import WaitForTurnEndEventStrategy from '../../../../src/turns/strategies/waitForTurnEndEventStrategy.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

class RecordingState extends AbstractTurnState {
  constructor(handler, name, { idle = false, ending = false } = {}) {
    super(handler);
    this._name = name;
    this._isIdle = idle;
    this._isEnding = ending;
    this.enterCalls = [];
    this.exitCalls = [];
    this.shouldThrowOnEnter = false;
  }

  getStateName() {
    return this._name;
  }

  isIdle() {
    return this._isIdle;
  }

  isEnding() {
    return this._isEnding;
  }

  async enterState(handler, previousState) {
    this.enterCalls.push({ handler, previousState });
    if (this.shouldThrowOnEnter) {
      throw new Error(`${this._name} failed to enter`);
    }
    await super.enterState(handler, previousState);
  }

  async exitState(handler, nextState) {
    this.exitCalls.push({ handler, nextState });
    await super.exitState(handler, nextState);
  }
}

class IdleState extends RecordingState {
  constructor(handler) {
    super(handler, 'IdleState', { idle: true });
  }
}

class AwaitingState extends RecordingState {
  constructor(handler) {
    super(handler, 'AwaitingState');
  }
}

class ProcessingState extends RecordingState {
  constructor(handler, commandString, turnAction, resolver) {
    super(handler, 'ProcessingState');
    this.commandString = commandString;
    this.turnAction = turnAction;
    this.resolver = resolver;
  }
}

class EndingState extends RecordingState {
  constructor(handler, actorId, error) {
    super(handler, 'EndingState', { ending: true });
    this.actorId = actorId;
    this.error = error;
  }
}

class ExternalAwaitingState extends RecordingState {
  constructor(handler) {
    super(handler, 'ExternalAwaitingState');
  }
}

class ThrowingIdentityState extends RecordingState {
  constructor(handler) {
    super(handler, 'ThrowingIdentityState');
  }

  isIdle() {
    throw new Error('identity evaluation failed');
  }
}

class IntegrationTurnStateFactory extends ITurnStateFactory {
  constructor() {
    super();
    this.createdProcessingStates = [];
    this.createdEndingStates = [];
  }

  createInitialState(handler) {
    return new IdleState(handler);
  }

  createIdleState(handler) {
    return new IdleState(handler);
  }

  createEndingState(handler, actorId, error) {
    const state = new EndingState(handler, actorId, error);
    this.createdEndingStates.push(state);
    return state;
  }

  createAwaitingInputState(handler) {
    return new AwaitingState(handler);
  }

  createProcessingCommandState(handler, commandString, turnAction, resolver) {
    const state = new ProcessingState(
      handler,
      commandString,
      turnAction,
      resolver
    );
    this.createdProcessingStates.push(state);
    return state;
  }

  createAwaitingExternalTurnEndState(handler) {
    return new ExternalAwaitingState(handler);
  }
}

class IntegrationTurnHandler extends BaseTurnHandler {
  constructor({ logger, turnStateFactory }) {
    super({ logger, turnStateFactory });
    this.turnEndPort = {
      notifyTurnEnded: jest.fn(async () => {}),
    };
    this.safeEventDispatcher = { dispatch: jest.fn() };
    this._setInitialState(this._turnStateFactory.createInitialState(this));
  }

  getTurnEndPort() {
    return this.turnEndPort;
  }
}

const createContext = ({
  actorId = 'actor-1',
  logger,
  dispatcher = { dispatch: jest.fn() },
  handler,
  overrides = {},
}) => {
  const actor = { id: actorId };
  const base = {
    getActor: jest.fn(() => actor),
    getLogger: jest.fn(() => logger),
    getSafeEventDispatcher: jest.fn(() => dispatcher),
    cancelActivePrompt: jest.fn(),
    requestAwaitingInputStateTransition: jest.fn(() =>
      handler.requestAwaitingInputStateTransition()
    ),
    requestProcessingCommandStateTransition: jest.fn((command, action) =>
      handler.requestProcessingCommandStateTransition(command, action)
    ),
    requestIdleStateTransition: jest.fn(() =>
      handler.requestIdleStateTransition()
    ),
    requestAwaitingExternalTurnEndStateTransition: jest.fn(() =>
      handler.requestAwaitingExternalTurnEndStateTransition()
    ),
    endTurn: jest.fn(() => Promise.resolve()),
  };
  return { ...base, ...overrides };
};

describe('BaseTurnHandler integration coverage', () => {
  let logger;
  let turnStateFactory;
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = createLogger();
    turnStateFactory = new IntegrationTurnStateFactory();
    handler = new IntegrationTurnHandler({ logger, turnStateFactory });
  });

  test('constructor enforces required dependencies', () => {
    expect(
      () =>
        new IntegrationTurnHandler({
          logger: null,
          turnStateFactory,
        })
    ).toThrow('logger is required');

    expect(
      () =>
        new IntegrationTurnHandler({
          logger,
          turnStateFactory: null,
        })
    ).toThrow('turnStateFactory is required');
  });

  test('getLogger prefers context logger and falls back with warning', () => {
    const contextLogger = { ...createLogger() };
    const context = createContext({ logger: contextLogger, handler });
    handler._setCurrentTurnContextInternal(context);
    handler._setCurrentActorInternal({ id: 'actor-ctx' });

    expect(handler.getLogger()).toBe(contextLogger);

    context.getLogger.mockImplementation(() => {
      throw new Error('logger missing');
    });

    const fallback = handler.getLogger();
    expect(fallback).toBe(logger);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Error accessing logger from TurnContext')
    );
  });

  test('getCurrentActor gracefully falls back when context access fails', () => {
    const fallbackActor = { id: 'fallback-actor' };
    handler._setCurrentActorInternal(fallbackActor);
    const context = createContext({ logger, handler });
    context.getActor.mockImplementation(() => {
      throw new Error('actor lookup failed');
    });
    handler._setCurrentTurnContextInternal(context);

    const resolvedActor = handler.getCurrentActor();
    expect(resolvedActor).toBe(fallbackActor);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Error accessing actor from TurnContext')
    );
  });

  test('setCurrentTurnContextInternal handles actor retrieval errors', () => {
    handler._setCurrentActorInternal({ id: 'stable-actor' });
    const context = createContext({ logger, handler });
    context.getActor.mockImplementation(() => {
      throw new Error('boom');
    });

    handler._setCurrentTurnContextInternal(context);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Error accessing actor from TurnContext')
    );
    expect(handler._currentActor.id).toBe('stable-actor');
  });

  test('getSafeEventDispatcher resolves from context, handler fallback, and warning when unavailable', () => {
    const dispatcherFromContext = { dispatch: jest.fn() };
    const context = createContext({
      logger,
      handler,
      dispatcher: dispatcherFromContext,
    });
    handler._setCurrentTurnContextInternal(context);

    expect(handler.getSafeEventDispatcher()).toBe(dispatcherFromContext);

    const fallbackDispatcher = { dispatch: jest.fn() };
    handler.safeEventDispatcher = fallbackDispatcher;
    context.getSafeEventDispatcher.mockImplementation(() => {
      throw new Error('no dispatcher');
    });
    expect(handler.getSafeEventDispatcher()).toBe(fallbackDispatcher);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Error accessing dispatcher from TurnContext')
    );

    handler.safeEventDispatcher = null;
    context.getSafeEventDispatcher.mockReturnValue({});
    expect(handler.getSafeEventDispatcher()).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('dispatcher unavailable')
    );
  });

  test('_setCurrentActorInternal and _setCurrentTurnContextInternal align actors', () => {
    const actor = { id: 'actor-initial' };
    const contextActor = { id: 'context-actor' };
    const context = createContext({
      logger,
      handler,
      overrides: {
        getActor: jest.fn(() => contextActor),
      },
    });

    handler._setCurrentActorInternal(actor);
    expect(handler._currentActor).toBe(actor);

    handler._setCurrentTurnContextInternal(context);
    expect(handler._currentActor).toBe(contextActor);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Aligning _currentActor')
    );

    handler._setCurrentActorInternal({ id: 'new-actor' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Handler's actor set to")
    );
  });

  test('_transitionToState validates target state and handles identical transitions', async () => {
    await expect(handler._transitionToState({})).rejects.toThrow(
      'newState must implement ITurnState'
    );

    const context = createContext({ logger, handler });
    handler._setCurrentTurnContextInternal(context);
    const initialState = handler.getCurrentState();
    const awaiting = new AwaitingState(handler);

    await handler._transitionToState(awaiting);
    expect(handler.getCurrentState()).toBe(awaiting);
    expect(awaiting.enterCalls).toHaveLength(1);
    expect(initialState.exitCalls).toHaveLength(1);

    logger.debug.mockClear();
    await handler._transitionToState(awaiting);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Attempted to transition to the same state')
    );
  });

  test('_transitionToState handles identity checks and exit errors gracefully', async () => {
    const context = createContext({ logger, handler });
    handler._setCurrentTurnContextInternal(context);
    const prevState = handler.getCurrentState();
    prevState.exitState = jest.fn(() => {
      throw new Error('exit failure');
    });

    const throwingState = new ThrowingIdentityState(handler);
    await handler._transitionToState(throwingState);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('exitState or onExitState hook'),
      expect.any(Error)
    );
    expect(handler.getCurrentState()).toBe(throwingState);
  });

  test('_transitionToState warns when idle state fails to enter', async () => {
    const context = createContext({ logger, handler });
    handler._setCurrentTurnContextInternal(context);
    const idleState = new IdleState(handler);
    idleState.shouldThrowOnEnter = true;

    await handler._transitionToState(idleState);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to enter TurnIdleState even after an error.'
      )
    );
  });

  test('_transitionToState forces idle when recovery transition throws', async () => {
    const context = createContext({ logger, handler });
    handler._setCurrentTurnContextInternal(context);
    const failingState = new AwaitingState(handler);
    failingState.shouldThrowOnEnter = true;

    const idleFactorySpy = jest
      .spyOn(turnStateFactory, 'createIdleState')
      .mockImplementationOnce(() => {
        throw new Error('factory idle failure');
      })
      .mockImplementation(() => new IdleState(handler));

    await handler._transitionToState(failingState);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'CRITICAL - Failed to transition to TurnIdleState after error.'
      ),
      expect.any(Error)
    );
    expect(handler.getCurrentState()).toBeInstanceOf(IdleState);

    idleFactorySpy.mockRestore();
  });

  test('_transitionToState recovers to idle when entering new state fails', async () => {
    const context = createContext({ logger, handler });
    handler._setCurrentTurnContextInternal(context);

    const failing = new AwaitingState(handler);
    failing.shouldThrowOnEnter = true;
    const resetSpy = jest.spyOn(handler, '_resetTurnStateAndResources');

    await handler._transitionToState(failing);

    expect(resetSpy).toHaveBeenCalledWith(
      expect.stringContaining('error-entering-AwaitingState-for')
    );
    expect(handler.getCurrentState()).toBeInstanceOf(IdleState);
  });

  test('operations that require active handler throw when destroyed', async () => {
    handler._isDestroyed = true;
    await expect(handler.requestIdleStateTransition()).rejects.toThrow(
      'Operation invoked while handler is destroying or has been destroyed.'
    );
    handler._isDestroyed = false;
  });

  test('_handleTurnEnd respects destroyed flag and idle states', async () => {
    handler._isDestroyed = true;
    await handler._handleTurnEnd('actor-x');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('handler already destroyed')
    );

    handler._isDestroyed = false;
    const idle = new IdleState(handler);
    handler._currentState = idle;
    const context = createContext({ logger, handler });
    handler._setCurrentTurnContextInternal(context);

    await handler._handleTurnEnd('actor-x');
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Ignoring')
    );
    expect(handler.getCurrentState()).toBe(idle);
  });

  test('_handleTurnEnd transitions to ending state with actor resolution', async () => {
    const context = createContext({
      logger,
      handler,
      overrides: {
        getActor: jest.fn(() => ({ id: 'ctx-actor' })),
      },
    });
    handler._setCurrentTurnContextInternal(context);
    const activeState = new AwaitingState(handler);
    handler._currentState = activeState;

    await handler._handleTurnEnd(null, new Error('turn error'));

    const endingState = handler.getCurrentState();
    expect(endingState).toBeInstanceOf(EndingState);
    expect(endingState.actorId).toBe('ctx-actor');
    expect(endingState.error).toBeInstanceOf(Error);
    expect(activeState.exitCalls).toHaveLength(1);
  });

  test('_handleTurnEnd logs mismatch, fallback, and error scenarios', async () => {
    const contextWithFailure = createContext({ logger, handler });
    logger.warn.mockClear();
    let failureCalls = 0;
    contextWithFailure.getActor.mockImplementation(() => {
      if (failureCalls < 3) {
        failureCalls += 1;
        throw new Error('context failure');
      }
      return { id: 'recovered' };
    });
    handler._currentActor = null;
    handler._setCurrentTurnContextInternal(contextWithFailure);
    handler._currentState = new AwaitingState(handler);
    handler._currentActor = null;

    await handler._handleTurnEnd(null);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Could not determine actor ID for TurnEndingState'
      )
    );

    const mismatchContext = createContext({
      logger,
      handler,
      overrides: {
        getActor: jest.fn(() => ({ id: 'ctx-1' })),
      },
    });
    handler._setCurrentTurnContextInternal(mismatchContext);
    handler._currentState = new AwaitingState(handler);
    logger.warn.mockClear();

    await handler._handleTurnEnd('ended-actor');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "called for actor 'ended-actor', but TurnContext is for 'ctx-1'"
      )
    );

    handler._setCurrentTurnContextInternal(null);
    handler._setCurrentActorInternal({ id: 'handler-actor' });
    logger.warn.mockClear();

    await handler._handleTurnEnd('ended-actor');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "no active TurnContext, but handler's _currentActor is 'handler-actor'"
      )
    );

    handler._setCurrentTurnContextInternal(createContext({ logger, handler }));
    handler._currentState = new IdleState(handler);
    logger.warn.mockClear();

    await handler._handleTurnEnd('handler-actor', new Error('idle failure'));
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Error will be logged but no new transition initiated'
      )
    );

    const originalAssert = handler._assertHandlerActiveUnlessDestroying;
    handler._isDestroyed = false;
    handler._assertHandlerActiveUnlessDestroying = () => {
      handler._isDestroyed = true;
    };
    logger.warn.mockClear();
    handler._currentState = new AwaitingState(handler);
    await handler._handleTurnEnd('late-call');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'handler is already destroyed and call is not from destroy process'
      )
    );
    handler._assertHandlerActiveUnlessDestroying = originalAssert;
    handler._isDestroyed = false;
  });

  test('_handleTurnEnd tolerates state identity check errors', async () => {
    const context = createContext({ logger, handler });
    handler._setCurrentTurnContextInternal(context);
    const problematicState = new AwaitingState(handler);
    problematicState.isEnding = jest.fn(() => {
      throw new Error('ending check failure');
    });
    problematicState.isIdle = jest.fn(() => {
      throw new Error('idle check failure');
    });
    handler._currentState = problematicState;

    await handler._handleTurnEnd('actor-check');

    expect(problematicState.isEnding).toHaveBeenCalled();
    expect(problematicState.isIdle).toHaveBeenCalled();
  });

  test('_resetTurnStateAndResources clears context and actor', () => {
    const context = createContext({ logger, handler });
    handler._setCurrentTurnContextInternal(context);
    handler._setCurrentActorInternal({ id: 'actor-123' });

    handler._resetTurnStateAndResources('test-reset');

    expect(context.cancelActivePrompt).toHaveBeenCalledTimes(1);
    expect(handler._currentTurnContext).toBeNull();
    expect(handler._currentActor).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Base per-turn state reset complete')
    );
  });

  test('resetStateAndResources handles prompt cancellation errors gracefully', () => {
    const context = createContext({ logger, handler });
    context.getActor
      .mockImplementationOnce(() => ({ id: 'initial' }))
      .mockImplementationOnce(() => ({ id: 'initial' }))
      .mockImplementationOnce(() => ({ id: 'initial' }))
      .mockImplementationOnce(() => ({ id: 'initial' }))
      .mockImplementationOnce(() => {
        throw new Error('context actor failure');
      })
      .mockReturnValue({ id: 'post-error' });
    context.cancelActivePrompt.mockImplementation(() => {
      throw new Error('cancel failure');
    });
    handler._setCurrentTurnContextInternal(context);
    handler._setCurrentActorInternal({ id: 'actor-reset' });

    handler.resetStateAndResources('wrap-reset');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Error during cancelActivePrompt: cancel failure'
      ),
      expect.any(Error)
    );
    expect(handler._currentTurnContext).toBeNull();
    expect(handler._currentActor).toBeNull();
  });

  test('destroy transitions to idle, resets resources, and is idempotent', async () => {
    const context = createContext({ logger, handler });
    handler._setCurrentTurnContextInternal(context);
    handler._currentState = new AwaitingState(handler);

    await handler.destroy();
    expect(handler._isDestroyed).toBe(true);
    expect(handler._isDestroying).toBe(false);
    expect(handler.getCurrentState()).toBeInstanceOf(IdleState);
    expect(context.cancelActivePrompt).toHaveBeenCalled();

    await handler.destroy();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('already destroyed')
    );
  });

  test('destroy handles prompt cancellation, state destroy, and transition errors', async () => {
    const context = createContext({ logger, handler });
    context.cancelActivePrompt.mockImplementation(() => {
      throw new Error('cancel error');
    });
    handler._setCurrentTurnContextInternal(context);

    const troublesomeState = new AwaitingState(handler);
    troublesomeState.destroy = jest.fn(() => {
      throw new Error('state destroy error');
    });
    troublesomeState.isIdle = jest.fn(() => {
      throw new Error('isIdle failure');
    });
    handler._currentState = troublesomeState;

    const transitionSpy = jest
      .spyOn(handler, '_transitionToState')
      .mockRejectedValue(new Error('transition failure'));

    await handler.destroy();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'destroy: Error during cancelActivePrompt: cancel error'
      ),
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Error during AwaitingState.destroy(): state destroy error'
      ),
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Error while transitioning to TurnIdleState during destroy'
      ),
      expect.any(Error)
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Forcibly set state to TurnIdleState due to transition error'
      )
    );
    expect(handler.getCurrentState()).toBeInstanceOf(IdleState);

    transitionSpy.mockRestore();
  });

  test('startTurn default implementation throws', async () => {
    await expect(handler.startTurn({ id: 'actor' })).rejects.toThrow(
      "Method 'startTurn(actor)' must be implemented"
    );
  });

  test('_setInitialState validates state once and rejects subsequent calls', () => {
    const freshHandler = new (class extends BaseTurnHandler {
      constructor(opts) {
        super(opts);
      }
      getTurnEndPort() {
        return { notifyTurnEnded: jest.fn(async () => {}) };
      }
    })({ logger, turnStateFactory });

    expect(() => freshHandler._setInitialState({})).toThrow(
      'Attempted to set invalid initial state'
    );

    const validState = new IdleState(freshHandler);
    freshHandler._setInitialState(validState);

    expect(() => freshHandler._setInitialState(validState)).toThrow(
      'Initial state has already been set'
    );
  });

  test('request transition helpers delegate to state factory outputs', async () => {
    const context = createContext({ logger, handler });
    handler._setCurrentTurnContextInternal(context);
    const spy = jest.spyOn(handler, '_transitionToState');

    await handler.requestIdleStateTransition();
    await handler.requestAwaitingInputStateTransition();
    await handler.requestAwaitingExternalTurnEndStateTransition();
    await handler.requestProcessingCommandStateTransition('command', {
      id: 'action',
    });

    expect(spy).toHaveBeenCalledTimes(4);
    const [, awaitingCall, externalCall, processingCall] = spy.mock.calls;
    expect(awaitingCall[0]).toBeInstanceOf(AwaitingState);
    expect(externalCall[0]).toBeInstanceOf(ExternalAwaitingState);
    expect(processingCall[0]).toBeInstanceOf(ProcessingState);
    const resolver = turnStateFactory.createdProcessingStates[0].resolver;
    expect(resolver).toBeInstanceOf(TurnDirectiveStrategyResolver);
    expect(
      resolver.resolveStrategy(TurnDirective.END_TURN_SUCCESS)
    ).toBeInstanceOf(EndTurnSuccessStrategy);
    expect(
      resolver.resolveStrategy(TurnDirective.END_TURN_FAILURE)
    ).toBeInstanceOf(EndTurnFailureStrategy);
    expect(resolver.resolveStrategy(TurnDirective.RE_PROMPT)).toBeInstanceOf(
      RepromptStrategy
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolver.resolveStrategy('unknown-directive')).toBeInstanceOf(
      WaitForTurnEndEventStrategy
    );
    warnSpy.mockRestore();
  });

  test('getTurnEndPort must be implemented by subclasses', () => {
    const incompleteHandler = new (class extends BaseTurnHandler {
      constructor(opts) {
        super(opts);
      }
    })({ logger, turnStateFactory });

    incompleteHandler._setInitialState(
      turnStateFactory.createInitialState(incompleteHandler)
    );

    expect(() => incompleteHandler.getTurnEndPort()).toThrow(
      'Method not implemented.'
    );
  });
});
