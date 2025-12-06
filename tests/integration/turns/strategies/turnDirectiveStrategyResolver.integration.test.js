/**
 * @file Integration tests for TurnDirectiveStrategyResolver covering caching
 * behaviour and directive fallbacks using real strategy implementations.
 */

import { describe, it, expect, jest } from '@jest/globals';
import TurnDirectiveStrategyResolver, {
  DEFAULT_STRATEGY_MAP,
} from '../../../../src/turns/strategies/turnDirectiveStrategyResolver.js';
import TurnDirective from '../../../../src/turns/constants/turnDirectives.js';
import RepromptStrategy from '../../../../src/turns/strategies/repromptStrategy.js';
import EndTurnSuccessStrategy from '../../../../src/turns/strategies/endTurnSuccessStrategy.js';
import EndTurnFailureStrategy from '../../../../src/turns/strategies/endTurnFailureStrategy.js';
import WaitForTurnEndEventStrategy from '../../../../src/turns/strategies/waitForTurnEndEventStrategy.js';
import { ITurnDirectiveStrategy } from '../../../../src/turns/interfaces/ITurnDirectiveStrategy.js';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import { AwaitingActorDecisionState } from '../../../../src/turns/states/awaitingActorDecisionState.js';

class InMemoryValidatedEventDispatcher {
  constructor() {
    this.listeners = new Map();
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
    return () => this.unsubscribe(eventName, listener);
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
 */
function createHandler() {
  const handler = {
    _isDestroyed: false,
    requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
    requestAwaitingInputStateTransition: jest.fn().mockResolvedValue(undefined),
    requestProcessingCommandStateTransition: jest
      .fn()
      .mockResolvedValue(undefined),
    requestAwaitingExternalTurnEndStateTransition: jest
      .fn()
      .mockResolvedValue(undefined),
  };

  return handler;
}

/**
 *
 * @param root0
 * @param root0.actorId
 */
function createTurnContextFixture({ actorId = 'actor-ctx' } = {}) {
  const logger = createLogger();
  const handler = createHandler();
  const validatedEventDispatcher = new InMemoryValidatedEventDispatcher();
  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher,
    logger,
  });

  const services = {
    safeEventDispatcher,
    turnEndPort: { endTurn: jest.fn().mockResolvedValue(undefined) },
    entityManager: {
      getComponentData: jest.fn().mockReturnValue(null),
      getEntityInstance: jest.fn().mockReturnValue(null),
    },
  };

  const strategy = { decideAction: jest.fn(), getContext: jest.fn() };
  const onEndTurn = jest.fn();

  const context = new TurnContext({
    actor: { id: actorId },
    logger,
    services,
    strategy,
    onEndTurnCallback: onEndTurn,
    handlerInstance: handler,
  });

  context.requestTransition = jest.fn(async (StateClass, args = []) => {
    if (StateClass !== AwaitingActorDecisionState) {
      throw new Error(
        `Unsupported transition requested for ${StateClass?.name ?? 'unknown state'}`
      );
    }
    return handler.requestAwaitingInputStateTransition(...args);
  });

  return {
    context,
    logger,
    handler,
    services,
    validatedEventDispatcher,
    onEndTurn,
  };
}

describe('TurnDirectiveStrategyResolver integration', () => {
  it('resolves default strategies and executes them end-to-end', async () => {
    const resolver = new TurnDirectiveStrategyResolver(DEFAULT_STRATEGY_MAP);
    const { context, handler, validatedEventDispatcher, onEndTurn } =
      createTurnContextFixture({ actorId: 'actor-main' });

    const repromptStrategy = resolver.resolveStrategy(TurnDirective.RE_PROMPT);
    expect(repromptStrategy).toBeInstanceOf(RepromptStrategy);
    await repromptStrategy.execute(context, TurnDirective.RE_PROMPT, {
      success: false,
    });
    expect(handler.requestAwaitingInputStateTransition).toHaveBeenCalledTimes(
      1
    );
    expect(validatedEventDispatcher.dispatched).toHaveLength(0);
    expect(resolver.resolveStrategy(TurnDirective.RE_PROMPT)).toBe(
      repromptStrategy
    );

    const successStrategy = resolver.resolveStrategy(
      TurnDirective.END_TURN_SUCCESS
    );
    expect(successStrategy).toBeInstanceOf(EndTurnSuccessStrategy);
    await successStrategy.execute(context, TurnDirective.END_TURN_SUCCESS, {
      success: true,
    });
    expect(onEndTurn).toHaveBeenCalledWith(null);

    const failureStrategy = resolver.resolveStrategy(
      TurnDirective.END_TURN_FAILURE
    );
    expect(failureStrategy).toBeInstanceOf(EndTurnFailureStrategy);
    await failureStrategy.execute(context, TurnDirective.END_TURN_FAILURE, {
      error: 'failure-case',
    });
    const lastCall = onEndTurn.mock.calls[onEndTurn.mock.calls.length - 1];
    expect(lastCall[0]).toBeInstanceOf(Error);
    expect(lastCall[0].message).toContain('failure-case');
  });

  it('supports factory functions and caches the resulting strategy instance', async () => {
    const factoryInvocations = [];

    class CustomFactoryStrategy extends ITurnDirectiveStrategy {
      constructor() {
        super();
        this.executionCount = 0;
      }

      async execute(turnContext, directive) {
        this.executionCount += 1;
        turnContext.lastFactoryDirective = directive;
      }
    }

    const resolver = new TurnDirectiveStrategyResolver({
      ...DEFAULT_STRATEGY_MAP,
      CUSTOM_FACTORY: () => {
        factoryInvocations.push('factory');
        return new CustomFactoryStrategy();
      },
    });

    const { context } = createTurnContextFixture({ actorId: 'actor-factory' });

    const customStrategy = resolver.resolveStrategy('CUSTOM_FACTORY');
    expect(customStrategy).toBeInstanceOf(CustomFactoryStrategy);
    expect(factoryInvocations).toHaveLength(1);

    await customStrategy.execute(context, 'CUSTOM_FACTORY');
    expect(customStrategy.executionCount).toBe(1);
    expect(context.lastFactoryDirective).toBe('CUSTOM_FACTORY');

    const cached = resolver.resolveStrategy('CUSTOM_FACTORY');
    expect(cached).toBe(customStrategy);
    expect(factoryInvocations).toHaveLength(1);
  });

  it('falls back to WAIT_FOR_EVENT and warns when directive is unknown', async () => {
    const resolver = new TurnDirectiveStrategyResolver(DEFAULT_STRATEGY_MAP);
    const { context, handler } = createTurnContextFixture({
      actorId: 'actor-fallback',
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const strategy = resolver.resolveStrategy('UNKNOWN_DIRECTIVE');
    expect(strategy).toBeInstanceOf(WaitForTurnEndEventStrategy);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('UNKNOWN_DIRECTIVE')
    );

    await strategy.execute(context, TurnDirective.WAIT_FOR_EVENT, {
      success: true,
    });
    expect(
      handler.requestAwaitingExternalTurnEndStateTransition
    ).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it('clears cached instances when requested', () => {
    const resolver = new TurnDirectiveStrategyResolver(DEFAULT_STRATEGY_MAP);
    const first = resolver.resolveStrategy(TurnDirective.RE_PROMPT);
    resolver.clearCache();
    const second = resolver.resolveStrategy(TurnDirective.RE_PROMPT);

    expect(first).toBeInstanceOf(RepromptStrategy);
    expect(second).toBeInstanceOf(RepromptStrategy);
    expect(second).not.toBe(first);
  });

  it('throws when constructed without a strategy map', () => {
    expect(() => new TurnDirectiveStrategyResolver()).toThrow(
      'TurnDirectiveStrategyResolver: strategyMap is required'
    );
  });
});
