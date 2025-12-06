/**
 * @file Integration tests for RepromptStrategy interacting with a real TurnContext and SafeEventDispatcher.
 */

import { describe, it, expect, jest, afterEach } from '@jest/globals';
import RepromptStrategy from '../../../../src/turns/strategies/repromptStrategy.js';
import TurnDirective from '../../../../src/turns/constants/turnDirectives.js';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import { AwaitingActorDecisionState } from '../../../../src/turns/states/awaitingActorDecisionState.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';

class InMemoryValidatedEventDispatcher {
  constructor() {
    /** @type {Map<string, Function[]>} */
    this.listeners = new Map();
    /** @type {{ eventName: string, payload: unknown }[]} */
    this.dispatched = [];
  }

  async dispatch(eventName, payload) {
    this.dispatched.push({ eventName, payload });
    const listeners = this.listeners.get(eventName) || [];
    for (const listener of listeners) {
      await listener({ type: eventName, payload });
    }
    return true;
  }

  subscribe(eventName, listener) {
    const listeners = this.listeners.get(eventName) || [];
    listeners.push(listener);
    this.listeners.set(eventName, listeners);
    return () => {
      this.unsubscribe(eventName, listener);
    };
  }

  unsubscribe(eventName, listener) {
    const listeners = this.listeners.get(eventName) || [];
    this.listeners.set(
      eventName,
      listeners.filter((existing) => existing !== listener)
    );
  }
}

/**
 *
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 *
 * @param logger
 */
function createServices(logger) {
  const validatedEventDispatcher = new InMemoryValidatedEventDispatcher();
  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher,
    logger,
  });

  return {
    validatedEventDispatcher,
    safeEventDispatcher,
    turnEndPort: { endTurn: jest.fn().mockResolvedValue(undefined) },
    entityManager: {
      getComponentData: jest.fn().mockReturnValue(null),
      getEntityInstance: jest.fn().mockReturnValue(null),
    },
  };
}

/**
 *
 * @param logger
 * @param overrides
 */
function createHandler(logger, overrides = {}) {
  const handler = {
    _isDestroyed: false,
    getLogger: () => logger,
    requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
    requestAwaitingInputStateTransition: jest.fn().mockResolvedValue(undefined),
    requestProcessingCommandStateTransition: jest
      .fn()
      .mockResolvedValue(undefined),
    requestAwaitingExternalTurnEndStateTransition: jest
      .fn()
      .mockResolvedValue(undefined),
  };

  return { ...handler, ...overrides };
}

/**
 *
 * @param context
 * @param handler
 */
function attachLegacyRequestTransition(context, handler) {
  context.requestTransition = jest.fn(async (StateClass, args = []) => {
    if (StateClass !== AwaitingActorDecisionState) {
      throw new Error(
        `Unsupported transition requested for ${
          StateClass?.name ?? 'unknown state'
        }`
      );
    }
    return handler.requestAwaitingInputStateTransition(...args);
  });
}

/**
 *
 * @param root0
 * @param root0.logger
 * @param root0.actorId
 * @param root0.handlerOverrides
 * @param root0.ContextClass
 */
function createTurnContextFixture({
  logger,
  actorId = 'actor-123',
  handlerOverrides = {},
  ContextClass = TurnContext,
} = {}) {
  const services = createServices(logger);
  const handler = createHandler(logger, handlerOverrides);
  const onEndTurn = jest.fn().mockResolvedValue(undefined);

  const context = new ContextClass({
    actor: { id: actorId },
    logger,
    services,
    strategy: { decideAction: async () => null },
    onEndTurnCallback: onEndTurn,
    handlerInstance: handler,
  });

  handler.getTurnContext = () => context;
  attachLegacyRequestTransition(context, handler);

  return { context, handler, onEndTurn, services };
}

class NullActorTurnContext extends TurnContext {
  getActor() {
    return null;
  }
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('RepromptStrategy integration', () => {
  it('requests transition to AwaitingActorDecisionState when directive matches', async () => {
    const logger = createLogger();
    const { context, handler, services } = createTurnContextFixture({ logger });
    const strategy = new RepromptStrategy();

    await strategy.execute(context, TurnDirective.RE_PROMPT, {});

    expect(context.requestTransition).toHaveBeenCalledTimes(1);
    expect(context.requestTransition.mock.calls[0][0]).toBe(
      AwaitingActorDecisionState
    );
    expect(handler.requestAwaitingInputStateTransition).toHaveBeenCalledTimes(
      1
    );
    expect(services.validatedEventDispatcher.dispatched).toHaveLength(0);
    expect(logger.debug).toHaveBeenCalledWith(
      'RepromptStrategy: Re-prompting actor actor-123; requesting transition to AwaitingActorDecisionState.'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'RepromptStrategy: Transition to AwaitingActorDecisionState requested successfully for actor actor-123.'
    );
  });

  it('dispatches a system error and ends the turn when the context lacks an actor', async () => {
    const logger = createLogger();
    const { context, handler, onEndTurn, services } = createTurnContextFixture({
      logger,
      ContextClass: NullActorTurnContext,
    });
    const endTurnSpy = jest.spyOn(context, 'endTurn');
    const strategy = new RepromptStrategy();

    await strategy.execute(context, TurnDirective.RE_PROMPT, {});

    expect(context.requestTransition).not.toHaveBeenCalled();
    expect(handler.requestAwaitingInputStateTransition).not.toHaveBeenCalled();
    expect(endTurnSpy).toHaveBeenCalledTimes(1);
    const dispatched = services.validatedEventDispatcher.dispatched;
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].eventName).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(dispatched[0].payload.message).toBe(
      'RepromptStrategy: No actor found in ITurnContext. Cannot re-prompt.'
    );
    expect(onEndTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'RepromptStrategy: No actor found in ITurnContext. Cannot re-prompt.',
      })
    );
  });

  it('reports transition failures through the SafeEventDispatcher and ends the turn', async () => {
    const logger = createLogger();
    const transitionError = new Error('state machine jammed');
    const { context, handler, onEndTurn, services } = createTurnContextFixture({
      logger,
      handlerOverrides: {
        requestAwaitingInputStateTransition: jest
          .fn()
          .mockRejectedValue(transitionError),
      },
    });
    const endTurnSpy = jest.spyOn(context, 'endTurn');
    const strategy = new RepromptStrategy();

    await strategy.execute(context, TurnDirective.RE_PROMPT, {});

    expect(context.requestTransition).toHaveBeenCalledTimes(1);
    expect(context.requestTransition.mock.calls[0][0]).toBe(
      AwaitingActorDecisionState
    );
    const dispatched = services.validatedEventDispatcher.dispatched;
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].eventName).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(dispatched[0].payload.message).toContain(
      'Failed to request transition to AwaitingActorDecisionState'
    );
    expect(endTurnSpy).toHaveBeenCalledTimes(1);
    expect(onEndTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'Failed to request transition to AwaitingActorDecisionState'
        ),
      })
    );
    expect(logger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('requested successfully')
    );
  });
});
