/**
 * @file Unit tests for GateConstraintExtractor
 * Tests gate string parsing into per-axis intervals (Part B1 of v2 spec).
 * @see specs/prototype-redundancy-analyzer-v2.md
 */

import { describe, it, expect } from '@jest/globals';
import GateConstraintExtractor from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/GateConstraintExtractor.js';

describe('GateConstraintExtractor', () => {
  /**
   * Create a mock logger for testing.
   *
   * @returns {object} Mock logger
   */
  const createMockLogger = () => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  });

  /**
   * Create a test config with adjustable values.
   *
   * @param {object} [overrides] - Override specific config values
   * @returns {object} Config object
   */
  const createConfig = (overrides = {}) => ({
    strictEpsilon: 1e-6,
    ...overrides,
  });

  /**
   * Create extractor instance for testing.
   *
   * @param {object} [configOverrides] - Config overrides
   * @returns {{extractor: GateConstraintExtractor, logger: object}} Extractor and mock logger
   */
  const createExtractor = (configOverrides = {}) => {
    const logger = createMockLogger();
    const config = createConfig(configOverrides);
    const extractor = new GateConstraintExtractor({ config, logger });
    return { extractor, logger };
  };

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      const { extractor } = createExtractor();
      expect(extractor).toBeInstanceOf(GateConstraintExtractor);
    });

    it('should throw when logger is missing', () => {
      const config = createConfig();
      expect(
        () => new GateConstraintExtractor({ config, logger: null })
      ).toThrow();
    });

    it('should throw when logger lacks required methods', () => {
      const config = createConfig();
      const invalidLogger = { debug: jest.fn() }; // Missing warn, error
      expect(
        () => new GateConstraintExtractor({ config, logger: invalidLogger })
      ).toThrow();
    });

    it('should throw when config is missing', () => {
      const logger = createMockLogger();
      expect(
        () => new GateConstraintExtractor({ config: null, logger })
      ).toThrow();
    });

    it('should throw when config lacks strictEpsilon', () => {
      const logger = createMockLogger();
      const incompleteConfig = {};
      expect(
        () => new GateConstraintExtractor({ config: incompleteConfig, logger })
      ).toThrow(/strictEpsilon/);
    });

    it('should throw when config.strictEpsilon is not a number', () => {
      const logger = createMockLogger();
      const invalidConfig = { strictEpsilon: 'not a number' };
      expect(
        () => new GateConstraintExtractor({ config: invalidConfig, logger })
      ).toThrow(/strictEpsilon/);
    });

    it('should throw when config.strictEpsilon is not positive', () => {
      const logger = createMockLogger();
      const invalidConfig = { strictEpsilon: 0 };
      expect(
        () => new GateConstraintExtractor({ config: invalidConfig, logger })
      ).toThrow(/positive/);
    });

    it('should throw when config.strictEpsilon is negative', () => {
      const logger = createMockLogger();
      const invalidConfig = { strictEpsilon: -0.001 };
      expect(
        () => new GateConstraintExtractor({ config: invalidConfig, logger })
      ).toThrow(/positive/);
    });

    it('should log error when config is invalid', () => {
      const logger = createMockLogger();
      const invalidConfig = { strictEpsilon: 'invalid' };
      expect(
        () => new GateConstraintExtractor({ config: invalidConfig, logger })
      ).toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('extract - Acceptance Criteria', () => {
    // AC1: Simple upper bound
    describe('AC1: Simple upper bound', () => {
      it('should parse "threat <= 0.20" to upper=0.20', () => {
        const { extractor } = createExtractor();
        const result = extractor.extract(['threat <= 0.20']);

        expect(result.intervals.has('threat')).toBe(true);
        const interval = result.intervals.get('threat');
        expect(interval.upper).toBe(0.2);
        expect(interval.lower).toBeNull();
        expect(interval.unsatisfiable).toBe(false);
        expect(result.parseStatus).toBe('complete');
      });
    });

    // AC2: Simple lower bound
    describe('AC2: Simple lower bound', () => {
      it('should parse "arousal >= 0.30" to lower=0.30', () => {
        const { extractor } = createExtractor();
        const result = extractor.extract(['arousal >= 0.30']);

        expect(result.intervals.has('arousal')).toBe(true);
        const interval = result.intervals.get('arousal');
        expect(interval.lower).toBe(0.3);
        expect(interval.upper).toBeNull();
        expect(interval.unsatisfiable).toBe(false);
        expect(result.parseStatus).toBe('complete');
      });
    });

    // AC3: Combined bounds (same axis)
    describe('AC3: Combined bounds (same axis)', () => {
      it('should combine "arousal >= -0.30" and "arousal <= 0.35" to interval [-0.30, 0.35]', () => {
        const { extractor } = createExtractor();
        const result = extractor.extract([
          'arousal >= -0.30',
          'arousal <= 0.35',
        ]);

        expect(result.intervals.has('arousal')).toBe(true);
        const interval = result.intervals.get('arousal');
        expect(interval.lower).toBe(-0.3);
        expect(interval.upper).toBe(0.35);
        expect(interval.unsatisfiable).toBe(false);
        expect(result.parseStatus).toBe('complete');
      });

      it('should take most restrictive bounds when multiple specified', () => {
        const { extractor } = createExtractor();
        const result = extractor.extract([
          'arousal >= 0.10',
          'arousal >= 0.20', // More restrictive lower
          'arousal <= 0.80',
          'arousal <= 0.60', // More restrictive upper
        ]);

        const interval = result.intervals.get('arousal');
        expect(interval.lower).toBe(0.2);
        expect(interval.upper).toBe(0.6);
      });
    });

    // AC4: Strict inequality (>)
    describe('AC4: Strict inequality (>)', () => {
      it('should parse "valence > 0.10" to lower=0.10+strictEpsilon', () => {
        const epsilon = 1e-6;
        const { extractor } = createExtractor({ strictEpsilon: epsilon });
        const result = extractor.extract(['valence > 0.10']);

        expect(result.intervals.has('valence')).toBe(true);
        const interval = result.intervals.get('valence');
        expect(interval.lower).toBeCloseTo(0.1 + epsilon, 10);
        expect(interval.upper).toBeNull();
        expect(result.parseStatus).toBe('complete');
      });
    });

    // AC5: Strict inequality (<)
    describe('AC5: Strict inequality (<)', () => {
      it('should parse "dominance < 0.50" to upper=0.50-strictEpsilon', () => {
        const epsilon = 1e-6;
        const { extractor } = createExtractor({ strictEpsilon: epsilon });
        const result = extractor.extract(['dominance < 0.50']);

        expect(result.intervals.has('dominance')).toBe(true);
        const interval = result.intervals.get('dominance');
        expect(interval.upper).toBeCloseTo(0.5 - epsilon, 10);
        expect(interval.lower).toBeNull();
        expect(result.parseStatus).toBe('complete');
      });
    });

    // AC6: Unparsed gates → partial status
    describe('AC6: Unparsed gates → partial status', () => {
      it('should return partial status when some gates are unparseable', () => {
        const { extractor } = createExtractor();
        const result = extractor.extract([
          'threat <= 0.20',
          'invalid gate format',
          'arousal >= 0.10',
        ]);

        expect(result.parseStatus).toBe('partial');
        expect(result.unparsedGates).toEqual(['invalid gate format']);
        expect(result.intervals.size).toBe(2);
      });

      it('should include complex expressions as unparsed', () => {
        const { extractor } = createExtractor();
        const result = extractor.extract([
          'threat <= 0.20',
          'arousal >= 0.10 && valence < 0.50', // Complex expression
        ]);

        expect(result.parseStatus).toBe('partial');
        expect(result.unparsedGates).toContain(
          'arousal >= 0.10 && valence < 0.50'
        );
      });
    });

    // AC7: All unparsed → failed status
    describe('AC7: All unparsed → failed status', () => {
      it('should return failed status when all gates are unparseable', () => {
        const { extractor } = createExtractor();
        const result = extractor.extract([
          'invalid format 1',
          'another bad gate',
          '!!!syntax error!!!',
        ]);

        expect(result.parseStatus).toBe('failed');
        expect(result.unparsedGates.length).toBe(3);
        expect(result.intervals.size).toBe(0);
      });
    });

    // AC8: All parsed → complete status
    describe('AC8: All parsed → complete status', () => {
      it('should return complete status when all gates are parsed', () => {
        const { extractor } = createExtractor();
        const result = extractor.extract([
          'threat <= 0.20',
          'arousal >= 0.10',
          'valence > 0.05',
        ]);

        expect(result.parseStatus).toBe('complete');
        expect(result.unparsedGates.length).toBe(0);
        expect(result.intervals.size).toBe(3);
      });
    });

    // AC9: Unsatisfiable interval detection
    describe('AC9: Unsatisfiable interval detection', () => {
      it('should detect unsatisfiable interval when lower > upper', () => {
        const { extractor, logger } = createExtractor();
        const result = extractor.extract([
          'arousal >= 0.80', // Lower bound
          'arousal <= 0.20', // Upper bound (less than lower)
        ]);

        expect(result.intervals.has('arousal')).toBe(true);
        const interval = result.intervals.get('arousal');
        expect(interval.unsatisfiable).toBe(true);
        expect(interval.lower).toBe(0.8);
        expect(interval.upper).toBe(0.2);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Unsatisfiable')
        );
      });

      it('should not mark satisfiable interval as unsatisfiable', () => {
        const { extractor } = createExtractor();
        const result = extractor.extract([
          'arousal >= 0.20',
          'arousal <= 0.80',
        ]);

        const interval = result.intervals.get('arousal');
        expect(interval.unsatisfiable).toBe(false);
      });

      it('should not mark equal bounds as unsatisfiable', () => {
        const { extractor } = createExtractor();
        const result = extractor.extract([
          'arousal >= 0.50',
          'arousal <= 0.50',
        ]);

        const interval = result.intervals.get('arousal');
        expect(interval.unsatisfiable).toBe(false);
        expect(interval.lower).toBe(0.5);
        expect(interval.upper).toBe(0.5);
      });
    });

    // AC10: Empty gates array
    describe('AC10: Empty gates array', () => {
      it('should return empty result with complete status for empty array', () => {
        const { extractor } = createExtractor();
        const result = extractor.extract([]);

        expect(result.intervals.size).toBe(0);
        expect(result.unparsedGates.length).toBe(0);
        expect(result.parseStatus).toBe('complete');
      });
    });

    // AC11: Negative values
    describe('AC11: Negative values', () => {
      it('should parse gates with negative values correctly', () => {
        const { extractor } = createExtractor();
        const result = extractor.extract([
          'threat >= -0.50',
          'arousal <= -0.25',
        ]);

        expect(result.intervals.get('threat').lower).toBe(-0.5);
        expect(result.intervals.get('arousal').upper).toBe(-0.25);
        expect(result.parseStatus).toBe('complete');
      });

      it('should handle negative interval correctly', () => {
        const { extractor } = createExtractor();
        const result = extractor.extract([
          'valence >= -0.80',
          'valence <= -0.20',
        ]);

        const interval = result.intervals.get('valence');
        expect(interval.lower).toBe(-0.8);
        expect(interval.upper).toBe(-0.2);
        expect(interval.unsatisfiable).toBe(false);
      });
    });

    // AC12: Multiple axes
    describe('AC12: Multiple axes', () => {
      it('should handle multiple independent axes', () => {
        const { extractor } = createExtractor();
        const result = extractor.extract([
          'threat <= 0.30',
          'arousal >= 0.40',
          'arousal <= 0.80',
          'valence > 0.10',
          'dominance < 0.60',
        ]);

        expect(result.intervals.size).toBe(4);
        expect(result.intervals.has('threat')).toBe(true);
        expect(result.intervals.has('arousal')).toBe(true);
        expect(result.intervals.has('valence')).toBe(true);
        expect(result.intervals.has('dominance')).toBe(true);

        expect(result.intervals.get('threat').upper).toBe(0.3);
        expect(result.intervals.get('arousal').lower).toBe(0.4);
        expect(result.intervals.get('arousal').upper).toBe(0.8);
        expect(result.parseStatus).toBe('complete');
      });
    });
  });

  describe('extract - Edge Cases', () => {
    it('should handle whitespace variations', () => {
      const { extractor } = createExtractor();
      const result = extractor.extract([
        '  threat   <=   0.20  ',
        'arousal>=0.10',
        'valence  >  0.05  ',
      ]);

      expect(result.intervals.size).toBe(3);
      expect(result.parseStatus).toBe('complete');
    });

    it('should handle integer values', () => {
      const { extractor } = createExtractor();
      const result = extractor.extract(['threat <= 1', 'arousal >= 0']);

      expect(result.intervals.get('threat').upper).toBe(1);
      expect(result.intervals.get('arousal').lower).toBe(0);
    });

    it('should handle decimal variations', () => {
      const { extractor } = createExtractor();
      const result = extractor.extract([
        'threat <= 0.123456',
        'arousal >= .5', // Leading decimal without 0
      ]);

      expect(result.intervals.get('threat').upper).toBe(0.123456);
      // Note: .5 without leading zero may not match current regex - testing this edge case
      expect(result.unparsedGates).toContain('arousal >= .5');
    });

    it('should reject empty string gates', () => {
      const { extractor } = createExtractor();
      const result = extractor.extract(['', '  ', 'threat <= 0.20']);

      expect(result.unparsedGates).toContain('');
      expect(result.unparsedGates).toContain('  ');
      expect(result.parseStatus).toBe('partial');
    });

    it('should reject gates with invalid operators', () => {
      const { extractor } = createExtractor();
      const result = extractor.extract([
        'threat == 0.20',
        'arousal != 0.10',
        'valence = 0.30',
      ]);

      expect(result.parseStatus).toBe('failed');
      expect(result.unparsedGates.length).toBe(3);
    });

    it('should handle non-array input gracefully', () => {
      const { extractor, logger } = createExtractor();

      const result1 = extractor.extract('not an array');
      expect(result1.intervals.size).toBe(0);
      expect(result1.parseStatus).toBe('complete');
      expect(logger.warn).toHaveBeenCalled();

      const result2 = extractor.extract(null);
      expect(result2.parseStatus).toBe('complete');

      const result3 = extractor.extract(undefined);
      expect(result3.parseStatus).toBe('complete');
    });

    it('should handle axis names with underscores', () => {
      const { extractor } = createExtractor();
      const result = extractor.extract([
        'threat_level >= 0.50',
        'emotional_arousal <= 0.80',
      ]);

      expect(result.intervals.has('threat_level')).toBe(true);
      expect(result.intervals.has('emotional_arousal')).toBe(true);
      expect(result.parseStatus).toBe('complete');
    });

    it('should handle numeric axis names', () => {
      const { extractor } = createExtractor();
      const result = extractor.extract(['axis1 >= 0.10', 'axis2 <= 0.90']);

      expect(result.intervals.has('axis1')).toBe(true);
      expect(result.intervals.has('axis2')).toBe(true);
    });
  });

  describe('extract - Invariants', () => {
    it('should be stateless - repeated calls with same input produce same output', () => {
      const { extractor } = createExtractor();
      const gates = ['threat <= 0.20', 'arousal >= 0.10'];

      const result1 = extractor.extract(gates);
      const result2 = extractor.extract(gates);

      expect(result1.parseStatus).toBe(result2.parseStatus);
      expect(result1.intervals.size).toBe(result2.intervals.size);
      expect(result1.intervals.get('threat').upper).toBe(
        result2.intervals.get('threat').upper
      );
    });

    it('should not modify input array', () => {
      const { extractor } = createExtractor();
      const gates = ['threat <= 0.20', 'arousal >= 0.10'];
      const originalGates = [...gates];

      extractor.extract(gates);

      expect(gates).toEqual(originalGates);
    });

    it('should return new Map instance for each call', () => {
      const { extractor } = createExtractor();
      const gates = ['threat <= 0.20'];

      const result1 = extractor.extract(gates);
      const result2 = extractor.extract(gates);

      expect(result1.intervals).not.toBe(result2.intervals);
    });
  });

  describe('extract - Logging', () => {
    it('should log debug message with parsing summary', () => {
      const { extractor, logger } = createExtractor();
      extractor.extract(['threat <= 0.20', 'invalid gate']);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Parsed 1/2')
      );
    });

    it('should log debug for failed parse attempts', () => {
      const { extractor, logger } = createExtractor();
      extractor.extract(['completely invalid']);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse')
      );
    });
  });
});
