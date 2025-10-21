// tests/turns/builders/turnContextBuilder.test.js
// -----------------------------------------------------------------------------
// Unit tests for TurnContextBuilder ensuring constructor validations and basic
// build operation work as expected.
// -----------------------------------------------------------------------------

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { TurnContextBuilder } from '../../../../src/turns/builders/turnContextBuilder.js';

let logger;
let factory;
let assertValidEntity;

beforeEach(() => {
  logger = { debug: jest.fn() };
  factory = { create: jest.fn(() => ({ id: 'ctx' })) };
  assertValidEntity = jest.fn();
});

describe('TurnContextBuilder constructor validation', () => {
  it('throws if logger is missing', () => {
    expect(
      () =>
        new TurnContextBuilder({
          turnContextFactory: factory,
          assertValidEntity,
        })
    ).toThrow('logger is required');
  });

  it('throws if turnContextFactory is missing', () => {
    expect(() => new TurnContextBuilder({ logger, assertValidEntity })).toThrow(
      'turnContextFactory is required'
    );
  });

  it('throws if assertValidEntity is not a function', () => {
    expect(
      () => new TurnContextBuilder({ logger, turnContextFactory: factory })
    ).toThrow('assertValidEntity function is required');
  });
});

describe('TurnContextBuilder build', () => {
  it('validates actor and delegates to factory', () => {
    const builder = new TurnContextBuilder({
      logger,
      turnContextFactory: factory,
      assertValidEntity,
    });
    const actor = { id: 'a1' };
    const strategy = {};
    const onEnd = jest.fn();
    const handler = {};

    const ctx = builder.build({
      actor,
      strategy,
      onEndTurn: onEnd,
      handlerInstance: handler,
    });

    expect(assertValidEntity).toHaveBeenCalledWith(
      actor,
      logger,
      'TurnContextBuilder'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'TurnContextBuilder: Building context for actor a1.'
    );
    expect(factory.create).toHaveBeenCalledWith({
      actor,
      strategy,
      onEndTurnCallback: onEnd,
      handlerInstance: handler,
      isAwaitingExternalEventProvider: undefined,
      onSetAwaitingExternalEventCallback: undefined,
    });
    expect(ctx).toEqual({ id: 'ctx' });
  });

  it('passes optional awaiting handlers to the factory', () => {
    const builder = new TurnContextBuilder({
      logger,
      turnContextFactory: factory,
      assertValidEntity,
    });
    const actor = { id: 'optional-actor' };
    const strategy = {};
    const onEnd = jest.fn();
    const handler = {};
    const awaitFlagProvider = jest.fn(() => true);
    const setAwaitFlag = jest.fn();

    const ctx = builder.build({
      actor,
      strategy,
      onEndTurn: onEnd,
      handlerInstance: handler,
      awaitFlagProvider,
      setAwaitFlag,
    });

    expect(factory.create).toHaveBeenCalledWith({
      actor,
      strategy,
      onEndTurnCallback: onEnd,
      handlerInstance: handler,
      isAwaitingExternalEventProvider: awaitFlagProvider,
      onSetAwaitingExternalEventCallback: setAwaitFlag,
    });
    expect(ctx).toEqual({ id: 'ctx' });
  });
});
