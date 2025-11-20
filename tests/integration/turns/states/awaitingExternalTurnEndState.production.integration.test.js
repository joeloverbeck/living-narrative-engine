import { jest } from '@jest/globals';

import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import { TURN_ENDED_ID } from '../../../../src/constants/eventIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';
import { createEventBus } from '../../../common/mockFactories/eventBus.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

class TestTurnHandler {
  constructor({ logger, dispatcher }) {
    this._logger = logger;
    this._dispatcher = dispatcher;
    this.resetStateAndResources = jest.fn();
    this.requestIdleStateTransition = jest.fn();
  }

  setTurnContext(ctx) {
    this._context = ctx;
  }

  getTurnContext() {
    return this._context;
  }

  getLogger() {
    return this._logger;
  }

  getSafeEventDispatcher() {
    return this._dispatcher;
  }
}

describe('AwaitingExternalTurnEndState production defaults integration', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test('schedules production timeout and cleans up using default timer helpers', async () => {
    jest.useFakeTimers();

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    // Set NODE_ENV to production BEFORE isolateModulesAsync
    const hadNodeEnv = Object.prototype.hasOwnProperty.call(process.env, 'NODE_ENV');
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';



    const logger = createMockLogger();
    const eventBus = createEventBus({ captureEvents: true });
    const dispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: eventBus,
      logger,
    });

    const handler = new TestTurnHandler({ logger, dispatcher });
    const actor = { id: 'production-actor' };
    const onEndTurn = jest.fn();

    const context = new TurnContext({
      actor,
      logger,
      services: {
        safeEventDispatcher: dispatcher,
        turnEndPort: { signalTurnEnd: jest.fn() },
        entityManager: {
          getComponentData: jest.fn(),
          getEntityInstance: jest.fn(),
        },
      },
      strategy: {
        decideAction: jest.fn(),
        getMetadata: jest.fn(() => ({})),
        dispose: jest.fn(),
      },
      onEndTurnCallback: onEndTurn,
      handlerInstance: handler,
      onSetAwaitingExternalEventCallback: jest.fn(),
    });

    handler.setTurnContext(context);

    // Construct the state while NODE_ENV is still 'production'
    const state = new AwaitingExternalTurnEndState(handler);

    // Restore NODE_ENV after construction
    if (hadNodeEnv) {
      process.env.NODE_ENV = previousEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    await state.enterState(handler, null);

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30_000);

    const scheduledTimeoutId = setTimeoutSpy.mock.results[0]?.value;

    await jest.runOnlyPendingTimersAsync();

    expect(onEndTurn).toHaveBeenCalledTimes(1);
    const timeoutError = onEndTurn.mock.calls[0][0];
    expect(timeoutError).toBeInstanceOf(Error);
    expect(timeoutError.code).toBe('TURN_END_TIMEOUT');
    expect(timeoutError.message).toContain('30000');

    const systemErrors = eventBus.events.filter(
      (event) => event.eventType === SYSTEM_ERROR_OCCURRED_ID
    );
    expect(systemErrors).toHaveLength(1);
    expect(systemErrors[0].payload.details.actorId).toBe(actor.id);

    await state.exitState(handler, { getStateName: () => 'PostTimeoutCleanup' });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    if (typeof scheduledTimeoutId !== 'undefined') {
      expect(clearTimeoutSpy).toHaveBeenCalledWith(scheduledTimeoutId);
    }

    expect(context.isAwaitingExternalEvent()).toBe(false);
    expect(eventBus.listenerCount(TURN_ENDED_ID)).toBe(0);
  });
});
