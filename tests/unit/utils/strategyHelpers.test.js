import { describe, it, expect, jest } from '@jest/globals';
import {
  assertDirective,
  requireContextActor,
} from '../../../src/turns/strategies/strategyHelpers.js';

describe('strategyHelpers', () => {
  describe('assertDirective', () => {
    it('does nothing when directive matches', () => {
      const logger = { error: jest.fn() };
      expect(() =>
        assertDirective({
          expected: 'SAME',
          actual: 'SAME',
          logger,
          className: 'TestClass',
        })
      ).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('throws and logs when directive mismatches', () => {
      const logger = { error: jest.fn() };
      expect(() =>
        assertDirective({
          expected: 'EXPECTED',
          actual: 'ACTUAL',
          logger,
          className: 'TestClass',
        })
      ).toThrow(
        'TestClass: Received wrong directive (ACTUAL). Expected EXPECTED.'
      );
      expect(logger.error).toHaveBeenCalledWith(
        'TestClass: Received wrong directive (ACTUAL). Expected EXPECTED.'
      );
    });
  });

  describe('requireContextActor', () => {
    it('returns actor when present', () => {
      const actor = { id: 'a1' };
      const turnContext = {
        getActor: jest.fn(() => actor),
        endTurn: jest.fn(),
      };
      const logger = { error: jest.fn() };

      const result = requireContextActor({
        turnContext,
        logger,
        className: 'TestClass',
        errorMsg: 'missing',
      });

      expect(result).toBe(actor);
      expect(logger.error).not.toHaveBeenCalled();
      expect(turnContext.endTurn).not.toHaveBeenCalled();
    });

    it('logs and ends the turn when actor missing', () => {
      const turnContext = {
        getActor: jest.fn(() => null),
        endTurn: jest.fn(),
      };
      const logger = { error: jest.fn() };

      const result = requireContextActor({
        turnContext,
        logger,
        className: 'TestClass',
        errorMsg: 'missing actor',
      });

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('missing actor');
      expect(turnContext.endTurn).toHaveBeenCalledTimes(1);
      expect(turnContext.endTurn.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(turnContext.endTurn.mock.calls[0][0].message).toBe(
        'missing actor'
      );
    });
  });
});
