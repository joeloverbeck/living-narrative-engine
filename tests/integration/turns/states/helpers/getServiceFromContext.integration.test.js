import { describe, it, beforeEach, expect } from '@jest/globals';
import {
  ServiceLookupHelper,
  ServiceLookupError,
} from '../../../../../src/turns/states/helpers/getServiceFromContext.js';
import { TurnContext } from '../../../../../src/turns/context/turnContext.js';
import { ProcessingExceptionHandler } from '../../../../../src/turns/states/helpers/processingExceptionHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../../src/constants/systemEventIds.js';

class TestLogger {
  constructor() {
    this.entries = { error: [], warn: [], info: [], debug: [] };
  }

  error(...args) {
    this.entries.error.push(args);
  }

  warn(...args) {
    this.entries.warn.push(args);
  }

  info(...args) {
    this.entries.info.push(args);
  }

  debug(...args) {
    this.entries.debug.push(args);
  }
}

class TestSafeEventDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
  }

  subscribe() {
    return () => {};
  }
}

class TestHandler {
  constructor(logger, dispatcher) {
    this._logger = logger;
    this._dispatcher = dispatcher;
    this.resetCalls = [];
    this.transitionCalls = [];
  }

  getLogger() {
    return this._logger;
  }

  setDispatcher(dispatcher) {
    this._dispatcher = dispatcher;
  }

  getSafeEventDispatcher() {
    return this._dispatcher;
  }

  async resetStateAndResources(reason) {
    this.resetCalls.push(reason);
  }

  async requestIdleStateTransition() {
    this.transitionCalls.push('requested');
  }
}

class TestStrategy {
  decideAction() {
    return null;
  }
}

class TestEntityManager {
  getComponentData() {
    return null;
  }

  getEntityInstance(id) {
    return { id };
  }
}

class TestState {
  constructor(handler) {
    this._handler = handler;
    this._isProcessing = true;
    this.finishCount = 0;
    this._exceptionHandler = null;
  }

  getStateName() {
    return 'ProcessingCommandState';
  }

  get isProcessing() {
    return this._isProcessing;
  }

  finishProcessing() {
    this._isProcessing = false;
    this.finishCount += 1;
  }
}

class TrackingExceptionHandler extends ProcessingExceptionHandler {
  constructor(state) {
    super(state);
    this.calls = [];
  }

  async handle(
    turnCtx,
    error,
    actorIdContext = 'UnknownActor',
    shouldEndTurn = true
  ) {
    this.calls.push({ turnCtx, error, actorIdContext, shouldEndTurn });
    return super.handle(turnCtx, error, actorIdContext, shouldEndTurn);
  }
}

class NullDispatcherTurnContext extends TurnContext {
  getSafeEventDispatcher() {
    return null;
  }
}

describe('ServiceLookupHelper integration', () => {
  let logger;
  let dispatcher;
  let handler;
  let actor;
  let strategy;
  let entityManager;
  let endTurnCalls;
  let turnCtx;
  let state;
  let exceptionHandler;
  let helper;

  beforeEach(() => {
    logger = new TestLogger();
    dispatcher = new TestSafeEventDispatcher();
    handler = new TestHandler(logger, dispatcher);
    actor = { id: 'actor-1', name: 'Test Actor' };
    strategy = new TestStrategy();
    entityManager = new TestEntityManager();
    endTurnCalls = [];

    turnCtx = new TurnContext({
      actor,
      logger,
      services: {
        safeEventDispatcher: dispatcher,
        turnEndPort: {
          async endTurn(error) {
            endTurnCalls.push(error ?? null);
          },
        },
        entityManager,
      },
      strategy,
      onEndTurnCallback: (error) => {
        endTurnCalls.push(error ?? null);
      },
      handlerInstance: handler,
    });

    state = new TestState(handler);
    exceptionHandler = new TrackingExceptionHandler(state);
    state._exceptionHandler = exceptionHandler;
    helper = new ServiceLookupHelper(state, exceptionHandler);
  });

  it('retrieves services from a valid context without triggering failure handlers', async () => {
    const service = await helper.getServiceFromContext(
      turnCtx,
      'getSafeEventDispatcher',
      'SafeEventDispatcher',
      actor.id
    );

    expect(service).toBe(dispatcher);
    expect(state.finishCount).toBe(0);
    expect(exceptionHandler.calls).toHaveLength(0);
    expect(dispatcher.events).toHaveLength(0);
    expect(logger.entries.error).toHaveLength(0);
  });

  it('logs and ends processing when the context method is missing', async () => {
    const serviceLabel = 'ImaginaryService';

    await expect(
      helper.getServiceFromContext(
        turnCtx,
        'getImaginaryService',
        serviceLabel,
        actor.id
      )
    ).rejects.toThrow(ServiceLookupError);

    expect(logger.entries.error[0][0]).toContain(
      'Invalid turnCtx in _getServiceFromContext'
    );
    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.events[0].eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(dispatcher.events[0].payload.details.service).toBe(serviceLabel);
    expect(state.finishCount).toBe(1);
    expect(exceptionHandler.calls).toHaveLength(0);

    // Subsequent failure when processing already stopped should not change finishCount
    await expect(
      helper.getServiceFromContext(
        turnCtx,
        'getImaginaryService',
        serviceLabel,
        actor.id
      )
    ).rejects.toThrow(ServiceLookupError);

    expect(state.finishCount).toBe(1);
    expect(dispatcher.events).toHaveLength(2);
  });

  it('invokes the exception handler and dispatches detailed errors when retrieval throws', async () => {
    const nullContext = new NullDispatcherTurnContext({
      actor,
      logger,
      services: {
        safeEventDispatcher: dispatcher,
        turnEndPort: {
          async endTurn(error) {
            endTurnCalls.push(error ?? null);
          },
        },
        entityManager,
      },
      strategy,
      onEndTurnCallback: (error) => {
        endTurnCalls.push(error ?? null);
      },
      handlerInstance: handler,
    });

    await expect(
      helper.getServiceFromContext(
        nullContext,
        'getSafeEventDispatcher',
        'SafeEventDispatcher',
        actor.id,
        exceptionHandler
      )
    ).rejects.toThrow(ServiceLookupError);

    const failureLogEntry = logger.entries.error.find(([message]) =>
      message.includes('Failed to retrieve SafeEventDispatcher')
    );
    expect(failureLogEntry).toBeDefined();
    expect(failureLogEntry[1]).toBeInstanceOf(Error);
    expect(failureLogEntry[1].name).toBe('ServiceLookupError');
    expect(failureLogEntry[1].cause).toBeInstanceOf(Error);
    expect(failureLogEntry[1].cause.message).toContain(
      'returned null or undefined'
    );
    expect(exceptionHandler.calls).toHaveLength(1);
    expect(exceptionHandler.calls[0].actorIdContext).toBe(actor.id);
    expect(
      dispatcher.events.filter(
        (event) => event.eventId === SYSTEM_ERROR_OCCURRED_ID
      )
    ).toHaveLength(2);
    expect(state.finishCount).toBe(1);
    expect(endTurnCalls.length).toBeGreaterThan(0);
  });

  it('skips dispatcher publishing when neither context nor handler expose a dispatcher', async () => {
    handler.setDispatcher(null);
    const minimalContext = {
      getLogger: () => logger,
      getActor: () => actor,
      endTurn: async (error) => {
        endTurnCalls.push(error ?? null);
      },
      getSafeEventDispatcher: () => null,
    };

    await expect(
      helper.getServiceFromContext(
        minimalContext,
        'getSafeEventDispatcher',
        'SafeEventDispatcher',
        actor.id
      )
    ).rejects.toThrow(ServiceLookupError);

    expect(dispatcher.events).toHaveLength(0);
    expect(
      logger.entries.warn.some(([message]) =>
        message.includes('SafeEventDispatcher unavailable')
      )
    ).toBe(true);
  });
});
