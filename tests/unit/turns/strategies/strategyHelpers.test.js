// tests/unit/turns/strategies/strategyHelpers.test.js

import {
  assertDirective,
  requireContextActor,
} from '../../../../src/turns/strategies/strategyHelpers.js';
import { describe, test, expect, jest } from '@jest/globals';

class MockLogger {
  error = jest.fn();
}

class MockTurnContext {
  constructor(actor) {
    this._actor = actor;
    this.endTurn = jest.fn();
  }
  getActor() {
    return this._actor;
  }
}

describe('strategyHelpers', () => {
  describe('assertDirective', () => {
    test('does nothing when directives match', () => {
      const logger = new MockLogger();
      expect(() =>
        assertDirective({
          expected: 'A',
          actual: 'A',
          logger,
          className: 'Test',
        })
      ).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    test('logs and throws when directives mismatch', () => {
      const logger = new MockLogger();
      expect(() =>
        assertDirective({
          expected: 'A',
          actual: 'B',
          logger,
          className: 'Test',
        })
      ).toThrow('Test: Received wrong directive (B). Expected A.');
      expect(logger.error).toHaveBeenCalledWith(
        'Test: Received wrong directive (B). Expected A.'
      );
    });
  });

  describe('requireContextActor', () => {
    test('returns actor when present', () => {
      const actor = { id: '123' };
      const ctx = new MockTurnContext(actor);
      const logger = new MockLogger();
      const result = requireContextActor({
        turnContext: ctx,
        logger,
        className: 'Test',
        errorMsg: 'No actor',
      });
      expect(result).toBe(actor);
      expect(ctx.endTurn).not.toHaveBeenCalled();
    });

    test('logs, ends turn and returns null when actor missing', () => {
      const ctx = new MockTurnContext(null);
      const logger = new MockLogger();
      const result = requireContextActor({
        turnContext: ctx,
        logger,
        className: 'Test',
        errorMsg: 'No actor',
      });
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Test: No actor');
      expect(ctx.endTurn).toHaveBeenCalledWith(expect.any(Error));
      expect(ctx.endTurn.mock.calls[0][0].message).toBe('Test: No actor');
    });
  });
});
