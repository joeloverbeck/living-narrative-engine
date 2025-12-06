/**
 * @file Integration tests for WaitForTurnEndEventStrategy coordinating with a real TurnContext.
 * @see src/turns/strategies/waitForTurnEndEventStrategy.js
 */

import { describe, it, expect, jest, afterEach } from '@jest/globals';
import WaitForTurnEndEventStrategy from '../../../../src/turns/strategies/waitForTurnEndEventStrategy.js';
import TurnDirective from '../../../../src/turns/constants/turnDirectives.js';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';

class InMemoryValidatedEventDispatcher {
  constructor() {
    /** @type {Map<string, Function[]>} */
    this.listeners = new Map();
  }

  async dispatch(eventName, payload) {
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
      const current = this.listeners.get(eventName) || [];
      this.listeners.set(
        eventName,
        current.filter((existing) => existing !== listener)
      );
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
  return {
    safeEventDispatcher: new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    }),
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
  const baseHandler = {
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

  return { ...baseHandler, ...overrides };
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

  return { context, handler, onEndTurn };
}

class NullActorTurnContext extends TurnContext {
  getActor() {
    return null;
  }
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('WaitForTurnEndEventStrategy integration', () => {
  it('requests a transition to the awaiting external turn end state when directive matches', async () => {
    const logger = createLogger();
    const { context, handler } = createTurnContextFixture({ logger });
    const strategy = new WaitForTurnEndEventStrategy();
    const endTurnSpy = jest.spyOn(context, 'endTurn');

    await strategy.execute(context, TurnDirective.WAIT_FOR_EVENT, {});

    expect(
      handler.requestAwaitingExternalTurnEndStateTransition
    ).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      'WaitForTurnEndEventStrategy: Actor actor-123 to wait for external event (e.g., core:turn_ended). Requesting transition to AwaitingExternalTurnEndState.'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'WaitForTurnEndEventStrategy: Transition to AwaitingExternalTurnEndState requested successfully for actor actor-123.'
    );
    expect(endTurnSpy).not.toHaveBeenCalled();
  });

  it('throws and logs when invoked with the wrong directive', async () => {
    const logger = createLogger();
    const { context, handler } = createTurnContextFixture({ logger });
    const strategy = new WaitForTurnEndEventStrategy();

    await expect(
      strategy.execute(context, TurnDirective.RE_PROMPT, {})
    ).rejects.toThrow(
      'WaitForTurnEndEventStrategy: Received wrong directive (RE_PROMPT). Expected WAIT_FOR_EVENT.'
    );

    expect(logger.error).toHaveBeenCalledWith(
      'WaitForTurnEndEventStrategy: Received wrong directive (RE_PROMPT). Expected WAIT_FOR_EVENT.'
    );
    expect(
      handler.requestAwaitingExternalTurnEndStateTransition
    ).not.toHaveBeenCalled();
  });

  it('ends the turn with an error when no actor is available on the context', async () => {
    const logger = createLogger();
    const { context, handler, onEndTurn } = createTurnContextFixture({
      logger,
      ContextClass: NullActorTurnContext,
    });
    const strategy = new WaitForTurnEndEventStrategy();
    const endTurnSpy = jest.spyOn(context, 'endTurn');

    await strategy.execute(context, TurnDirective.WAIT_FOR_EVENT, {});

    expect(
      handler.requestAwaitingExternalTurnEndStateTransition
    ).not.toHaveBeenCalled();
    expect(endTurnSpy).toHaveBeenCalledTimes(1);
    const errorArg = endTurnSpy.mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toBe(
      'WaitForTurnEndEventStrategy: No actor found in ITurnContext. Cannot transition to AwaitingExternalTurnEndState without an actor.'
    );
    expect(onEndTurn).toHaveBeenCalledWith(errorArg);
    expect(logger.error).toHaveBeenCalledWith(errorArg.message);
  });

  it('logs and ends the turn when the transition request fails', async () => {
    const logger = createLogger();
    const transitionError = new Error('state machine jammed');
    const { context, handler, onEndTurn } = createTurnContextFixture({
      logger,
      handlerOverrides: {
        requestAwaitingExternalTurnEndStateTransition: jest
          .fn()
          .mockRejectedValue(transitionError),
      },
    });
    const strategy = new WaitForTurnEndEventStrategy();
    const endTurnSpy = jest.spyOn(context, 'endTurn');

    await strategy.execute(context, TurnDirective.WAIT_FOR_EVENT, {});

    expect(
      handler.requestAwaitingExternalTurnEndStateTransition
    ).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'WaitForTurnEndEventStrategy: Failed to request transition to AwaitingExternalTurnEndState for actor actor-123. Error: state machine jammed',
      transitionError
    );
    expect(endTurnSpy).toHaveBeenCalledTimes(1);
    const errorArg = endTurnSpy.mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toBe(
      'WaitForTurnEndEventStrategy: Failed to request transition to AwaitingExternalTurnEndState for actor actor-123. Error: state machine jammed'
    );
    expect(onEndTurn).toHaveBeenCalledWith(errorArg);
  });
});
