// tests/turns/strategies/turnDirectiveStrategyResolver.test.js

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import TurnDirectiveStrategyResolver, {
  DEFAULT_STRATEGY_MAP,
} from '../../../../src/turns/strategies/turnDirectiveStrategyResolver.js';
import TurnDirective from '../../../../src/turns/constants/turnDirectives.js';
import RepromptStrategy from '../../../../src/turns/strategies/repromptStrategy.js';
import EndTurnSuccessStrategy from '../../../../src/turns/strategies/endTurnSuccessStrategy.js';
import EndTurnFailureStrategy from '../../../../src/turns/strategies/endTurnFailureStrategy.js';
import WaitForTurnEndEventStrategy from '../../../../src/turns/strategies/waitForTurnEndEventStrategy.js';

// --- Test Suite ---

describe('TurnDirectiveStrategyResolver', () => {
  let consoleWarnSpy;
  let originalNodeEnv;
  let resolver;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    resolver = new TurnDirectiveStrategyResolver(DEFAULT_STRATEGY_MAP);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    process.env.NODE_ENV = originalNodeEnv;
    resolver.clearCache();
  });

  test('returns correct singleton strategies for known directives', () => {
    const reprompt1 = resolver.resolveStrategy(TurnDirective.RE_PROMPT);
    const reprompt2 = resolver.resolveStrategy(TurnDirective.RE_PROMPT);
    expect(reprompt1).toBeInstanceOf(RepromptStrategy);
    expect(reprompt1).toBe(reprompt2);

    const success1 = resolver.resolveStrategy(TurnDirective.END_TURN_SUCCESS);
    const success2 = resolver.resolveStrategy(TurnDirective.END_TURN_SUCCESS);
    expect(success1).toBeInstanceOf(EndTurnSuccessStrategy);
    expect(success1).toBe(success2);

    const failure = resolver.resolveStrategy(TurnDirective.END_TURN_FAILURE);
    expect(failure).toBeInstanceOf(EndTurnFailureStrategy);

    const wait = resolver.resolveStrategy(TurnDirective.WAIT_FOR_EVENT);
    expect(wait).toBeInstanceOf(WaitForTurnEndEventStrategy);
  });

  test('falls back to WAIT_FOR_EVENT and warns for unknown directive', () => {
    const result = resolver.resolveStrategy('UNKNOWN');
    expect(result).toBeInstanceOf(WaitForTurnEndEventStrategy);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0][0]).toContain(
      'Unrecognised TurnDirective'
    );
  });

  test('does not warn in production mode', () => {
    process.env.NODE_ENV = 'production';
    const result = resolver.resolveStrategy('UNKNOWN');
    expect(result).toBeInstanceOf(WaitForTurnEndEventStrategy);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
