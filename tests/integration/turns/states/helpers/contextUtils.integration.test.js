import { describe, it, expect, afterEach } from '@jest/globals';
import { TurnContext } from '../../../../../src/turns/context/turnContext.js';
import {
  getLogger,
  getSafeEventDispatcher,
} from '../../../../../src/turns/states/helpers/contextUtils.js';

class RecordingLogger {
  constructor(name) {
    this.name = name;
    this.calls = { debug: [], info: [], warn: [], error: [] };
  }

  debug(...args) {
    this.calls.debug.push(args);
  }

  info(...args) {
    this.calls.info.push(args);
  }

  warn(...args) {
    this.calls.warn.push(args);
  }

  error(...args) {
    this.calls.error.push(args);
  }
}

class RecordingDispatcher {
  constructor(label = 'dispatcher') {
    this.label = label;
    this.dispatched = [];
  }

  async dispatch(eventName, payload) {
    this.dispatched.push({ eventName, payload });
    return true;
  }

  subscribe() {
    return () => {};
  }

  unsubscribe() {}
}

class HandlerStub {
  constructor({ logger, dispatcher }) {
    this._logger = logger;
    this._dispatcher = dispatcher;
    this._throwLogger = false;
    this._throwDispatcher = false;
  }

  setLoggerThrows(shouldThrow) {
    this._throwLogger = shouldThrow;
  }

  setDispatcherThrows(shouldThrow) {
    this._throwDispatcher = shouldThrow;
  }

  setDispatcher(dispatcher) {
    this._dispatcher = dispatcher;
  }

  getLogger() {
    if (this._throwLogger) {
      throw new Error('handler logger failure');
    }
    return this._logger;
  }

  getSafeEventDispatcher() {
    if (this._throwDispatcher) {
      throw new Error('handler dispatcher failure');
    }
    return this._dispatcher;
  }
}

/**
 *
 */
function createEntityManager() {
  return {
    getComponentData: () => null,
    getEntityInstance: () => null,
  };
}

/**
 *
 * @param root0
 * @param root0.logger
 * @param root0.handler
 * @param root0.dispatcher
 */
function createTurnContext({ logger, handler, dispatcher }) {
  return new TurnContext({
    actor: { id: 'actor-1', type: 'test:actor' },
    logger,
    services: {
      entityManager: createEntityManager(),
      safeEventDispatcher: dispatcher,
      turnEndPort: { endTurn: async () => {} },
    },
    strategy: {
      decideAction: async () => ({
        actionDefinitionId: 'test:noop',
        commandString: 'noop',
      }),
    },
    onEndTurnCallback: () => {},
    handlerInstance: handler,
  });
}

/**
 *
 * @param root0
 * @param root0.contextDispatcher
 * @param root0.handlerDispatcher
 */
function setup({
  contextDispatcher = new RecordingDispatcher('context'),
  handlerDispatcher = new RecordingDispatcher('handler'),
} = {}) {
  const contextLogger = new RecordingLogger('context');
  const handlerLogger = new RecordingLogger('handler');
  const handler = new HandlerStub({
    logger: handlerLogger,
    dispatcher: handlerDispatcher,
  });
  const turnContext = createTurnContext({
    logger: contextLogger,
    handler,
    dispatcher: contextDispatcher,
  });

  return { contextLogger, handlerLogger, handler, turnContext };
}

describe('contextUtils integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prefers turn context logger and falls back to handler logger', () => {
    const { contextLogger, handlerLogger, handler, turnContext } = setup();

    const resolvedPrimary = getLogger(turnContext, handler);
    expect(resolvedPrimary).toBe(contextLogger);

    turnContext.getLogger = () => null;
    const resolvedFallback = getLogger(turnContext, handler);
    expect(resolvedFallback).toBe(handlerLogger);
  });

  it('logs errors and returns console when logger accessors fail', () => {
    const { handler, turnContext } = setup();

    const originalGetLogger = turnContext.getLogger.bind(turnContext);
    turnContext.getLogger = () => {
      throw new Error('context logger failure');
    };
    handler.setLoggerThrows(true);

    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const resolved = getLogger(turnContext, handler);
    expect(resolved).toBe(console);
    expect(consoleError).toHaveBeenCalled();
    expect(
      consoleError.mock.calls.some(([message]) =>
        String(message).includes('ContextUtils.getLogger')
      )
    ).toBe(true);

    consoleError.mockRestore();
    turnContext.getLogger = originalGetLogger;
  });

  it('returns safe event dispatcher from the turn context when available', () => {
    const { handler, turnContext } = setup();

    const resolved = getSafeEventDispatcher(turnContext, handler);
    expect(resolved).toBe(turnContext.getSafeEventDispatcher());
  });

  it('falls back to handler dispatcher and warns when context dispatcher lacks dispatch', () => {
    const handlerDispatcher = new RecordingDispatcher('handler-fallback');
    const { contextLogger, handler, turnContext } = setup({
      handlerDispatcher,
    });

    turnContext.getSafeEventDispatcher = () => ({ description: 'invalid' });

    const resolved = getSafeEventDispatcher(turnContext, handler);
    expect(resolved).toBe(handlerDispatcher);
    expect(
      contextLogger.calls.warn.some(([message]) =>
        String(message).includes(
          'Falling back to handler.getSafeEventDispatcher'
        )
      )
    ).toBe(true);
  });

  it('logs context dispatcher errors and still uses handler fallback', () => {
    const handlerDispatcher = new RecordingDispatcher('handler-fallback');
    const { contextLogger, handler, turnContext } = setup({
      handlerDispatcher,
    });

    turnContext.getSafeEventDispatcher = () => {
      throw new Error('context dispatcher failure');
    };

    const resolved = getSafeEventDispatcher(turnContext, handler);
    expect(resolved).toBe(handlerDispatcher);
    expect(
      contextLogger.calls.error.some(([message]) =>
        String(message).includes(
          'Error calling turnContext.getSafeEventDispatcher'
        )
      )
    ).toBe(true);
    expect(
      contextLogger.calls.warn.some(([message]) =>
        String(message).includes(
          'Falling back to handler.getSafeEventDispatcher'
        )
      )
    ).toBe(true);
  });

  it('logs handler dispatcher errors and warns when no dispatcher is available', () => {
    const { contextLogger, handler, turnContext } = setup();

    turnContext.getSafeEventDispatcher = () => null;
    handler.setDispatcherThrows(true);

    const resolved = getSafeEventDispatcher(turnContext, handler);
    expect(resolved).toBeNull();
    expect(
      contextLogger.calls.error.some(([message]) =>
        String(message).includes('Error calling handler.getSafeEventDispatcher')
      )
    ).toBe(true);
    expect(
      contextLogger.calls.warn.some(([message]) =>
        String(message).includes('SafeEventDispatcher unavailable')
      )
    ).toBe(true);
  });
});
