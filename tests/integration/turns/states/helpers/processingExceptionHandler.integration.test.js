import { describe, it, beforeEach, expect } from '@jest/globals';
import { ProcessingExceptionHandler } from '../../../../../src/turns/states/helpers/processingExceptionHandler.js';
import { SafeEventDispatcher } from '../../../../../src/events/safeEventDispatcher.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../../src/constants/systemEventIds.js';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(message, metadata) {
    this.debugEntries.push({ message, metadata });
  }

  info(message, metadata) {
    this.infoEntries.push({ message, metadata });
  }

  warn(message, metadata) {
    this.warnEntries.push({ message, metadata });
  }

  error(message, metadata) {
    this.errorEntries.push({ message, metadata });
  }
}

class RecordingValidatedDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload, options) {
    this.events.push({ eventId, payload, options });
    return true;
  }

  subscribe() {
    return () => {};
  }

  unsubscribe() {}
}

class BaseTestHandler {
  constructor(logger, dispatcher) {
    this._logger = logger;
    this._dispatcher = dispatcher;
    this.resetRequests = [];
    this.transitionRequests = 0;
  }

  getLogger() {
    return this._logger;
  }

  getSafeEventDispatcher() {
    return this._dispatcher;
  }

  async resetStateAndResources(reason) {
    this.resetRequests.push(reason);
  }

  async requestIdleStateTransition() {
    this.transitionRequests += 1;
  }
}

class MinimalHandler {
  constructor(logger, dispatcher) {
    this._logger = logger;
    this._dispatcher = dispatcher;
  }

  getLogger() {
    return this._logger;
  }

  getSafeEventDispatcher() {
    return this._dispatcher;
  }
}

class TestState {
  constructor(handler) {
    this._handler = handler;
    this._stateName = 'ProcessingCommandState';
    this._isProcessing = true;
    this.finishCalls = 0;
  }

  getStateName() {
    return this._stateName;
  }

  get isProcessing() {
    return this._isProcessing;
  }

  finishProcessing() {
    this._isProcessing = false;
    this.finishCalls += 1;
  }
}

describe('ProcessingExceptionHandler integration', () => {
  let logger;
  let validatedDispatcher;
  let safeDispatcher;
  let handler;
  let state;
  let exceptionHandler;

  beforeEach(() => {
    logger = new RecordingLogger();
    validatedDispatcher = new RecordingValidatedDispatcher();
    safeDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });
    handler = new BaseTestHandler(logger, safeDispatcher);
    state = new TestState(handler);
    exceptionHandler = new ProcessingExceptionHandler(state);
  });

  it('logs diagnostics without ending the turn when shouldEndTurn is false', async () => {
    const endTurnCalls = [];
    const turnCtx = {
      getLogger: () => logger,
      getActor: () => ({ id: 'actor-hesitation' }),
      getSafeEventDispatcher: () => safeDispatcher,
      async endTurn(err) {
        endTurnCalls.push(err ?? null);
      },
    };

    const error = new Error('formatter blew up');

    await exceptionHandler.handle(turnCtx, error, 'actor-hesitation', false);

    expect(state.finishCalls).toBe(1);
    expect(state.isProcessing).toBe(false);
    expect(endTurnCalls).toEqual([]);
    expect(
      logger.debugEntries.some((entry) =>
        String(entry.message).includes('shouldEndTurn=false')
      )
    ).toBe(true);
    expect(validatedDispatcher.events).toHaveLength(1);
    expect(validatedDispatcher.events[0]).toEqual(
      expect.objectContaining({
        eventId: SYSTEM_ERROR_OCCURRED_ID,
      })
    );
  });

  it('resets the handler when ending the turn throws', async () => {
    let endTurnAttempts = 0;
    const turnCtx = {
      getLogger: () => logger,
      getActor: () => ({ id: 'actor-reset' }),
      getSafeEventDispatcher: () => safeDispatcher,
      async endTurn() {
        endTurnAttempts += 1;
        throw new Error('endTurn failure');
      },
    };

    const error = new Error('pipeline failure');

    await exceptionHandler.handle(turnCtx, error, 'actor-reset', true);

    expect(endTurnAttempts).toBe(1);
    expect(handler.resetRequests).toContain(
      'exception-endTurn-failed-ProcessingCommandState'
    );
    expect(handler.transitionRequests).toBe(1);
    expect(
      logger.errorEntries.some((entry) =>
        String(entry.message).includes('Error calling turnCtx.endTurn')
      )
    ).toBe(true);
    expect(
      logger.warnEntries.some((entry) =>
        String(entry.message).includes('Resetting handler due to failure')
      )
    ).toBe(true);
    expect(validatedDispatcher.events).toHaveLength(1);
    expect(validatedDispatcher.events[0]).toEqual(
      expect.objectContaining({
        eventId: SYSTEM_ERROR_OCCURRED_ID,
      })
    );
  });

  it('logs a critical message when no endTurn is available and no reset can occur', async () => {
    const minimalHandler = new MinimalHandler(logger, safeDispatcher);
    const minimalState = new TestState(minimalHandler);
    const minimalExceptionHandler = new ProcessingExceptionHandler(
      minimalState
    );

    const turnCtx = {
      getLogger: () => logger,
      getActor: () => ({ id: 'actor-critical' }),
      getSafeEventDispatcher: () => safeDispatcher,
    };

    const error = new Error('no context recovery');

    await minimalExceptionHandler.handle(
      turnCtx,
      error,
      'actor-critical',
      true
    );

    expect(minimalState.finishCalls).toBe(1);
    expect(
      logger.warnEntries.some((entry) =>
        String(entry.message).includes('Cannot call turnCtx.endTurn')
      )
    ).toBe(true);
    expect(
      logger.errorEntries.some((entry) =>
        String(entry.message).includes(
          'CRITICAL - Cannot end turn OR reset handler'
        )
      )
    ).toBe(true);
    expect(validatedDispatcher.events).toHaveLength(1);
    expect(validatedDispatcher.events[0]).toEqual(
      expect.objectContaining({
        eventId: SYSTEM_ERROR_OCCURRED_ID,
      })
    );
  });
});
