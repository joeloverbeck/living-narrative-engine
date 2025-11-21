import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import { TestEnvironmentProvider } from '../../../../src/configuration/TestEnvironmentProvider.js';
import { TURN_ENDED_ID } from '../../../../src/constants/eventIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';
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

describe('AwaitingExternalTurnEndState - Timeout Scenarios Integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Timeout Firing Scenarios', () => {
    it('should fire timeout at 30 seconds with production configuration', async () => {
      // Arrange
      const productionProvider = new TestEnvironmentProvider({ IS_PRODUCTION: true });
      const logger = createMockLogger();
      const eventBus = createEventBus({ captureEvents: true });
      const safeDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher: eventBus,
        logger,
      });
      const handler = new TestTurnHandler({ logger, dispatcher: safeDispatcher });
      const onEndTurn = jest.fn();

      const context = new TurnContext({
        actor: { id: 'test-actor' },
        logger,
        services: {
          safeEventDispatcher: safeDispatcher,
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

      const state = new AwaitingExternalTurnEndState(handler, {
        environmentProvider: productionProvider,
      });

      // Act
      await state.enterState(handler, null);

      // Advance timers to 30 seconds
      await jest.advanceTimersByTimeAsync(30_000);

      // Assert
      const systemErrors = eventBus.events.filter(
        (event) => event.eventType === SYSTEM_ERROR_OCCURRED_ID
      );
      expect(systemErrors).toHaveLength(1);
      expect(systemErrors[0].payload.details.actorId).toBe('test-actor');

      expect(onEndTurn).toHaveBeenCalledTimes(1);
      const timeoutError = onEndTurn.mock.calls[0][0];
      expect(timeoutError).toBeInstanceOf(Error);
      expect(timeoutError.code).toBe('TURN_END_TIMEOUT');
      expect(timeoutError.message).toContain('30000');
    });

    it('should fire timeout at 3 seconds with development configuration', async () => {
      // Arrange
      const developmentProvider = new TestEnvironmentProvider({ IS_PRODUCTION: false });
      const logger = createMockLogger();
      const eventBus = createEventBus({ captureEvents: true });
      const safeDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher: eventBus,
        logger,
      });
      const handler = new TestTurnHandler({ logger, dispatcher: safeDispatcher });
      const onEndTurn = jest.fn();

      const context = new TurnContext({
        actor: { id: 'dev-actor' },
        logger,
        services: {
          safeEventDispatcher: safeDispatcher,
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

      const state = new AwaitingExternalTurnEndState(handler, {
        environmentProvider: developmentProvider,
      });

      // Act
      await state.enterState(handler, null);

      // Advance timers to 3 seconds (NOT 30 seconds)
      await jest.advanceTimersByTimeAsync(3_000);

      // Assert
      expect(onEndTurn).toHaveBeenCalledTimes(1);
      const timeoutError = onEndTurn.mock.calls[0][0];
      expect(timeoutError).toBeInstanceOf(Error);
      expect(timeoutError.code).toBe('TURN_END_TIMEOUT');

      // Verify timeout fired at 3s, not 30s
      // Advance to 30s - should not trigger again
      await jest.advanceTimersByTimeAsync(27_000); // Total 30s
      expect(onEndTurn).toHaveBeenCalledTimes(1); // Only once, at 3s
    });
  });

  describe('Event Arrival Scenarios', () => {
    it('should clear timeout when turn end event arrives before timeout', async () => {
      // Arrange
      const logger = createMockLogger();
      const eventBus = createEventBus({ captureEvents: true });
      const safeDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher: eventBus,
        logger,
      });
      const handler = new TestTurnHandler({ logger, dispatcher: safeDispatcher });
      const onEndTurn = jest.fn();

      const context = new TurnContext({
        actor: { id: 'test-actor' },
        logger,
        services: {
          safeEventDispatcher: safeDispatcher,
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

      const state = new AwaitingExternalTurnEndState(handler, {
        timeoutMs: 5_000, // 5 second timeout
      });

      // Act
      await state.enterState(handler, null);

      // Advance time by 2 seconds (before 5s timeout)
      await jest.advanceTimersByTimeAsync(2_000);

      // Simulate turn end event arriving
      await eventBus.dispatch(TURN_ENDED_ID, {
        entityId: 'test-actor',
        error: null,
      });

      // Advance time past original timeout
      await jest.advanceTimersByTimeAsync(5_000); // Total 7s, past 5s timeout

      // Assert
      expect(onEndTurn).toHaveBeenCalledTimes(1); // Called by event, not timeout

      // No timeout error should be dispatched
      const systemErrors = eventBus.events.filter(
        (event) => event.eventType === SYSTEM_ERROR_OCCURRED_ID
      );
      expect(systemErrors).toHaveLength(0);

      // Verify turn ended via event, not timeout
      expect(onEndTurn).toHaveBeenCalledWith(null); // No error from event
    });
  });

  describe('Resource Cleanup at Scale', () => {
    it('should clean up resources correctly across 100 state instances', async () => {
      // Arrange
      const logger = createMockLogger();
      const eventBus = createEventBus({ captureEvents: true });
      const safeDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher: eventBus,
        logger,
      });

      const states = [];
      const handlers = [];
      const contexts = [];

      // Act - Create 100 instances
      for (let i = 0; i < 100; i++) {
        const handler = new TestTurnHandler({ logger, dispatcher: safeDispatcher });
        const onEndTurn = jest.fn();

        const context = new TurnContext({
          actor: { id: `actor-${i}` },
          logger,
          services: {
            safeEventDispatcher: safeDispatcher,
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

        const state = new AwaitingExternalTurnEndState(handler, {
          timeoutMs: 1_000, // 1 second timeout
        });

        await state.enterState(handler, null);

        states.push(state);
        handlers.push(handler);
        contexts.push(context);
      }

      // Assert - 100 subscriptions created
      expect(eventBus.listenerCount(TURN_ENDED_ID)).toBe(100);

      // Verify all contexts are awaiting
      contexts.forEach((ctx) => {
        expect(ctx.isAwaitingExternalEvent()).toBe(true);
      });

      // Act - Destroy all instances
      for (let i = 0; i < 100; i++) {
        await states[i].destroy(handlers[i]);
      }

      // Assert - All subscriptions cleaned up
      expect(eventBus.listenerCount(TURN_ENDED_ID)).toBe(0);

      // All contexts should no longer be awaiting
      contexts.forEach((ctx) => {
        expect(ctx.isAwaitingExternalEvent()).toBe(false);
      });

      // Advance timers past timeout - no orphan timers should fire
      await jest.advanceTimersByTimeAsync(2_000);

      // No timeout callbacks should fire (all cleared by destroy)
      const systemErrors = eventBus.events.filter(
        (event) => event.eventType === SYSTEM_ERROR_OCCURRED_ID
      );
      expect(systemErrors.length).toBe(0);
    });
  });
});
