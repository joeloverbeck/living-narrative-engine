import { describe, it, expect, jest } from '@jest/globals';
import {
  assertIsMap,
  assertIsLogger,
} from '../../../src/utils/argValidation.js';

describe('argValidation', () => {
  describe('assertIsMap', () => {
    it('passes when value is a Map', () => {
      expect(() => assertIsMap(new Map(), 'context')).not.toThrow();
    });

    it('throws with message when value is not a Map', () => {
      expect(() => assertIsMap({}, 'context')).toThrow(
        'context must be a Map.'
      );
    });
  });

  describe('assertIsLogger', () => {
    const validLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    it('passes when logger has required methods', () => {
      expect(() => assertIsLogger(validLogger, 'logger')).not.toThrow();
    });

    it('throws when logger is missing methods', () => {
      const invalid = { info: jest.fn() };
      expect(() => assertIsLogger(invalid, 'logger')).toThrow(
        'logger must be a valid ILogger instance.'
      );
    });

    it('uses custom message when provided', () => {
      expect(() => assertIsLogger(null, 'logger', 'bad')).toThrow('bad');
    });
  });
});
