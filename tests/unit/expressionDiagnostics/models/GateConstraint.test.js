/**
 * @file Unit tests for GateConstraint model
 * @description Tests gate string parsing and constraint evaluation for emotion/sexual prototypes.
 */

import { describe, it, expect } from '@jest/globals';
import GateConstraint, {
  VALID_OPERATORS,
} from '../../../../src/expressionDiagnostics/models/GateConstraint.js';
import AxisInterval from '../../../../src/expressionDiagnostics/models/AxisInterval.js';

describe('GateConstraint Model', () => {
  describe('Constructor', () => {
    it('should create valid constraint with all parameters', () => {
      const constraint = new GateConstraint(
        'valence',
        '>=',
        0.35,
        'valence >= 0.35'
      );
      expect(constraint.axis).toBe('valence');
      expect(constraint.operator).toBe('>=');
      expect(constraint.value).toBe(0.35);
      expect(constraint.originalString).toBe('valence >= 0.35');
    });

    it('should generate originalString when not provided', () => {
      const constraint = new GateConstraint('threat', '<=', 0.2);
      expect(constraint.originalString).toBe('threat <= 0.2');
    });

    it('should throw for empty axis name', () => {
      expect(() => new GateConstraint('', '>=', 0.5)).toThrow(
        'GateConstraint requires a non-empty axis name'
      );
    });

    it('should throw for whitespace-only axis name', () => {
      expect(() => new GateConstraint('   ', '>=', 0.5)).toThrow(
        'GateConstraint requires a non-empty axis name'
      );
    });

    it('should throw for non-string axis', () => {
      expect(() => new GateConstraint(123, '>=', 0.5)).toThrow(
        'GateConstraint requires a non-empty axis name'
      );
    });

    it('should throw for invalid operator', () => {
      expect(() => new GateConstraint('valence', '!=', 0.5)).toThrow(
        'Invalid operator: !=. Valid operators: >=, <=, >, <, =='
      );
    });

    it('should throw for non-numeric value', () => {
      expect(() => new GateConstraint('valence', '>=', 'high')).toThrow(
        'GateConstraint requires a finite numeric value'
      );
    });

    it('should throw for NaN value', () => {
      expect(() => new GateConstraint('valence', '>=', NaN)).toThrow(
        'GateConstraint requires a finite numeric value'
      );
    });

    it('should throw for Infinity value', () => {
      expect(() => new GateConstraint('valence', '>=', Infinity)).toThrow(
        'GateConstraint requires a finite numeric value'
      );
    });

    it('should be immutable (frozen)', () => {
      const constraint = new GateConstraint('valence', '>=', 0.5);
      expect(Object.isFrozen(constraint)).toBe(true);
    });

    it('should accept negative values', () => {
      const constraint = new GateConstraint('valence', '<=', -0.5);
      expect(constraint.value).toBe(-0.5);
    });
  });

  describe('VALID_OPERATORS constant', () => {
    it('should export all 5 valid operators', () => {
      expect(VALID_OPERATORS).toEqual(['>=', '<=', '>', '<', '==']);
    });

    it('should be frozen', () => {
      expect(Object.isFrozen(VALID_OPERATORS)).toBe(true);
    });
  });

  describe('parse()', () => {
    it('should parse "axis >= 0.35"', () => {
      const constraint = GateConstraint.parse('valence >= 0.35');
      expect(constraint.axis).toBe('valence');
      expect(constraint.operator).toBe('>=');
      expect(constraint.value).toBe(0.35);
    });

    it('should parse "axis <= -0.20"', () => {
      const constraint = GateConstraint.parse('threat <= -0.20');
      expect(constraint.axis).toBe('threat');
      expect(constraint.operator).toBe('<=');
      expect(constraint.value).toBe(-0.2);
    });

    it('should parse "axis == 0.50"', () => {
      const constraint = GateConstraint.parse('arousal == 0.50');
      expect(constraint.axis).toBe('arousal');
      expect(constraint.operator).toBe('==');
      expect(constraint.value).toBe(0.5);
    });

    it('should parse "axis > 0"', () => {
      const constraint = GateConstraint.parse('engagement > 0');
      expect(constraint.axis).toBe('engagement');
      expect(constraint.operator).toBe('>');
      expect(constraint.value).toBe(0);
    });

    it('should parse "axis < 0.10"', () => {
      const constraint = GateConstraint.parse('threat < 0.10');
      expect(constraint.axis).toBe('threat');
      expect(constraint.operator).toBe('<');
      expect(constraint.value).toBe(0.1);
    });

    it('should handle no spaces around operator', () => {
      const constraint = GateConstraint.parse('valence>=0.35');
      expect(constraint.axis).toBe('valence');
      expect(constraint.operator).toBe('>=');
      expect(constraint.value).toBe(0.35);
    });

    it('should handle extra whitespace', () => {
      const constraint = GateConstraint.parse('  valence   >=   0.35  ');
      expect(constraint.axis).toBe('valence');
      expect(constraint.operator).toBe('>=');
      expect(constraint.value).toBe(0.35);
    });

    it('should handle underscored axis names', () => {
      const constraint = GateConstraint.parse('agency_control >= 0.10');
      expect(constraint.axis).toBe('agency_control');
    });

    it('should handle multiple underscores in axis names', () => {
      const constraint = GateConstraint.parse('baseline_libido_mod >= 0');
      expect(constraint.axis).toBe('baseline_libido_mod');
    });

    it('should handle integer values', () => {
      const constraint = GateConstraint.parse('threat <= 0');
      expect(constraint.value).toBe(0);
    });

    it('should handle decimals without a leading zero', () => {
      const constraint = GateConstraint.parse('valence >= .5');
      expect(constraint.value).toBe(0.5);
    });

    it('should handle large values', () => {
      const constraint = GateConstraint.parse('score >= 999999');
      expect(constraint.value).toBe(999999);
    });

    it('should handle very small decimals', () => {
      const constraint = GateConstraint.parse('precision >= 0.0001');
      expect(constraint.value).toBe(0.0001);
    });

    it('should preserve original string', () => {
      const original = 'valence >= 0.35';
      const constraint = GateConstraint.parse(original);
      expect(constraint.originalString).toBe(original);
    });

    it('should throw for malformed string - missing operator', () => {
      expect(() => GateConstraint.parse('valence 0.35')).toThrow(
        'Cannot parse gate string: "valence 0.35"'
      );
    });

    it('should throw for malformed string - missing value', () => {
      expect(() => GateConstraint.parse('valence >=')).toThrow(
        'Cannot parse gate string: "valence >="'
      );
    });

    it('should throw for malformed string - invalid operator', () => {
      expect(() => GateConstraint.parse('valence <> 0.5')).toThrow(
        'Cannot parse gate string: "valence <> 0.5"'
      );
    });

    it('should throw for empty string', () => {
      expect(() => GateConstraint.parse('')).toThrow(
        'Cannot parse gate string: ""'
      );
    });

    it('should throw for non-string argument', () => {
      expect(() => GateConstraint.parse(123)).toThrow(
        'parse requires a string argument'
      );
    });

    it('should throw for null argument', () => {
      expect(() => GateConstraint.parse(null)).toThrow(
        'parse requires a string argument'
      );
    });
  });

  describe('applyTo()', () => {
    it('should correctly constrain interval with >=', () => {
      const interval = AxisInterval.forMoodAxis(); // [-1, 1]
      const constraint = new GateConstraint('valence', '>=', 0.35);
      const result = constraint.applyTo(interval);
      expect(result.min).toBe(0.35);
      expect(result.max).toBe(1);
    });

    it('should correctly constrain interval with <=', () => {
      const interval = AxisInterval.forMoodAxis(); // [-1, 1]
      const constraint = new GateConstraint('threat', '<=', 0.2);
      const result = constraint.applyTo(interval);
      expect(result.min).toBe(-1);
      expect(result.max).toBe(0.2);
    });

    it('should correctly constrain interval with ==', () => {
      const interval = AxisInterval.forMoodAxis(); // [-1, 1]
      const constraint = new GateConstraint('arousal', '==', 0.5);
      const result = constraint.applyTo(interval);
      expect(result.min).toBe(0.5);
      expect(result.max).toBe(0.5);
    });

    it('should create empty interval when constraint is impossible', () => {
      const interval = new AxisInterval(0.5, 1);
      const constraint = new GateConstraint('valence', '<=', 0.3);
      const result = constraint.applyTo(interval);
      expect(result.isEmpty()).toBe(true);
    });

    it('should throw for non-AxisInterval argument', () => {
      const constraint = new GateConstraint('valence', '>=', 0.5);
      expect(() => constraint.applyTo({ min: 0, max: 1 })).toThrow(
        'applyTo requires an AxisInterval instance'
      );
    });
  });

  describe('isSatisfiedBy()', () => {
    describe('>= operator', () => {
      const constraint = new GateConstraint('valence', '>=', 0.5);

      it('should return true when value equals threshold', () => {
        expect(constraint.isSatisfiedBy(0.5)).toBe(true);
      });

      it('should return true when value exceeds threshold', () => {
        expect(constraint.isSatisfiedBy(0.8)).toBe(true);
      });

      it('should return false when value is below threshold', () => {
        expect(constraint.isSatisfiedBy(0.3)).toBe(false);
      });
    });

    describe('> operator', () => {
      const constraint = new GateConstraint('valence', '>', 0.5);

      it('should return false when value equals threshold', () => {
        expect(constraint.isSatisfiedBy(0.5)).toBe(false);
      });

      it('should return true when value exceeds threshold', () => {
        expect(constraint.isSatisfiedBy(0.51)).toBe(true);
      });
    });

    describe('<= operator', () => {
      const constraint = new GateConstraint('threat', '<=', 0.2);

      it('should return true when value equals threshold', () => {
        expect(constraint.isSatisfiedBy(0.2)).toBe(true);
      });

      it('should return true when value is below threshold', () => {
        expect(constraint.isSatisfiedBy(0.1)).toBe(true);
      });

      it('should return false when value exceeds threshold', () => {
        expect(constraint.isSatisfiedBy(0.3)).toBe(false);
      });
    });

    describe('< operator', () => {
      const constraint = new GateConstraint('threat', '<', 0.2);

      it('should return false when value equals threshold', () => {
        expect(constraint.isSatisfiedBy(0.2)).toBe(false);
      });

      it('should return true when value is below threshold', () => {
        expect(constraint.isSatisfiedBy(0.19)).toBe(true);
      });
    });

    describe('== operator', () => {
      const constraint = new GateConstraint('arousal', '==', 0.5);

      it('should return true when value equals threshold exactly', () => {
        expect(constraint.isSatisfiedBy(0.5)).toBe(true);
      });

      it('should return true for values within epsilon', () => {
        expect(constraint.isSatisfiedBy(0.50005)).toBe(true);
      });

      it('should return false for values outside epsilon', () => {
        expect(constraint.isSatisfiedBy(0.51)).toBe(false);
      });
    });

    it('should return false for non-numeric value', () => {
      const constraint = new GateConstraint('valence', '>=', 0.5);
      expect(constraint.isSatisfiedBy('high')).toBe(false);
    });

    it('should handle negative threshold values', () => {
      const constraint = new GateConstraint('valence', '>=', -0.5);
      expect(constraint.isSatisfiedBy(-0.3)).toBe(true);
      expect(constraint.isSatisfiedBy(-0.7)).toBe(false);
    });
  });

  describe('violationAmount()', () => {
    it('should return 0 when constraint is satisfied', () => {
      const constraint = new GateConstraint('valence', '>=', 0.5);
      expect(constraint.violationAmount(0.7)).toBe(0);
    });

    it('should return positive violation for >= operator', () => {
      const constraint = new GateConstraint('valence', '>=', 0.5);
      expect(constraint.violationAmount(0.3)).toBeCloseTo(0.2);
    });

    it('should return positive violation for <= operator', () => {
      const constraint = new GateConstraint('threat', '<=', 0.2);
      expect(constraint.violationAmount(0.5)).toBeCloseTo(0.3);
    });

    it('should return positive violation for == operator', () => {
      const constraint = new GateConstraint('arousal', '==', 0.5);
      expect(constraint.violationAmount(0.7)).toBeCloseTo(0.2);
    });
  });

  describe('toString()', () => {
    it('should produce readable output', () => {
      const constraint = new GateConstraint('valence', '>=', 0.35);
      expect(constraint.toString()).toBe('valence >= 0.35');
    });

    it('should handle negative values', () => {
      const constraint = new GateConstraint('threat', '<=', -0.2);
      expect(constraint.toString()).toBe('threat <= -0.2');
    });
  });

  describe('toJSON()', () => {
    it('should serialize to object with axis, operator, and value', () => {
      const constraint = new GateConstraint('valence', '>=', 0.35);
      const json = constraint.toJSON();
      expect(json).toEqual({
        axis: 'valence',
        operator: '>=',
        value: 0.35,
      });
    });

    it('should be JSON.stringify compatible', () => {
      const constraint = new GateConstraint('threat', '<=', -0.2);
      const str = JSON.stringify(constraint);
      expect(str).toBe('{"axis":"threat","operator":"<=","value":-0.2}');
    });
  });

  describe('Integration with real gate patterns', () => {
    // Based on actual gates from emotion_prototypes.lookup.json
    const realGates = [
      'threat <= 0.20',
      'valence >= 0.20',
      'valence >= 0.35',
      'agency_control >= 0.10',
      'arousal >= 0.20',
    ];

    it.each(realGates)('should parse real gate: %s', (gate) => {
      const constraint = GateConstraint.parse(gate);
      expect(constraint.axis).toBeTruthy();
      expect(VALID_OPERATORS).toContain(constraint.operator);
      expect(typeof constraint.value).toBe('number');
    });
  });
});
