/**
 * @file Unit tests for AxisInterval model
 * @description Tests interval arithmetic and constraint application for mood/sexual axes.
 */

import { describe, it, expect } from '@jest/globals';
import AxisInterval from '../../../../src/expressionDiagnostics/models/AxisInterval.js';

describe('AxisInterval Model', () => {
  describe('Constructor', () => {
    it('should create valid interval with min and max', () => {
      const interval = new AxisInterval(0, 1);
      expect(interval.min).toBe(0);
      expect(interval.max).toBe(1);
    });

    it('should create interval with negative bounds', () => {
      const interval = new AxisInterval(-1, 1);
      expect(interval.min).toBe(-1);
      expect(interval.max).toBe(1);
    });

    it('should create interval where min equals max (single point)', () => {
      const interval = new AxisInterval(0.5, 0.5);
      expect(interval.min).toBe(0.5);
      expect(interval.max).toBe(0.5);
      expect(interval.isEmpty()).toBe(false);
    });

    it('should allow creating empty interval (min > max)', () => {
      const interval = new AxisInterval(1, 0);
      expect(interval.isEmpty()).toBe(true);
    });

    it('should throw for non-numeric min', () => {
      expect(() => new AxisInterval('0', 1)).toThrow(
        'AxisInterval requires numeric min and max values'
      );
    });

    it('should throw for non-numeric max', () => {
      expect(() => new AxisInterval(0, '1')).toThrow(
        'AxisInterval requires numeric min and max values'
      );
    });

    it('should throw for NaN min', () => {
      expect(() => new AxisInterval(NaN, 1)).toThrow(
        'AxisInterval requires finite min and max values'
      );
    });

    it('should throw for Infinity max', () => {
      expect(() => new AxisInterval(0, Infinity)).toThrow(
        'AxisInterval requires finite min and max values'
      );
    });

    it('should be immutable (frozen)', () => {
      const interval = new AxisInterval(0, 1);
      expect(Object.isFrozen(interval)).toBe(true);
    });
  });

  describe('isEmpty()', () => {
    it('should return true when min > max', () => {
      const interval = new AxisInterval(1, 0);
      expect(interval.isEmpty()).toBe(true);
    });

    it('should return false for valid intervals', () => {
      const interval = new AxisInterval(0, 1);
      expect(interval.isEmpty()).toBe(false);
    });

    it('should return false when min equals max', () => {
      const interval = new AxisInterval(0.5, 0.5);
      expect(interval.isEmpty()).toBe(false);
    });

    it('should return false for negative range', () => {
      const interval = new AxisInterval(-1, -0.5);
      expect(interval.isEmpty()).toBe(false);
    });
  });

  describe('intersect()', () => {
    it('should return null for non-overlapping intervals', () => {
      const a = new AxisInterval(0, 0.3);
      const b = new AxisInterval(0.5, 1);
      expect(a.intersect(b)).toBeNull();
    });

    it('should return null when one interval is entirely before another', () => {
      const a = new AxisInterval(-1, -0.5);
      const b = new AxisInterval(0, 1);
      expect(a.intersect(b)).toBeNull();
    });

    it('should return correct intersection for overlapping intervals', () => {
      const a = new AxisInterval(0, 0.6);
      const b = new AxisInterval(0.4, 1);
      const result = a.intersect(b);
      expect(result).not.toBeNull();
      expect(result.min).toBe(0.4);
      expect(result.max).toBe(0.6);
    });

    it('should return contained interval when one contains the other', () => {
      const outer = new AxisInterval(0, 1);
      const inner = new AxisInterval(0.3, 0.7);
      const result = outer.intersect(inner);
      expect(result.min).toBe(0.3);
      expect(result.max).toBe(0.7);
    });

    it('should return single point for touching intervals', () => {
      const a = new AxisInterval(0, 0.5);
      const b = new AxisInterval(0.5, 1);
      const result = a.intersect(b);
      expect(result.min).toBe(0.5);
      expect(result.max).toBe(0.5);
    });

    it('should be commutative', () => {
      const a = new AxisInterval(0, 0.6);
      const b = new AxisInterval(0.4, 1);
      const ab = a.intersect(b);
      const ba = b.intersect(a);
      expect(ab.min).toBe(ba.min);
      expect(ab.max).toBe(ba.max);
    });

    it('should throw for non-AxisInterval argument', () => {
      const interval = new AxisInterval(0, 1);
      expect(() => interval.intersect({ min: 0, max: 1 })).toThrow(
        'intersect requires an AxisInterval instance'
      );
    });
  });

  describe('applyConstraint()', () => {
    const baseInterval = new AxisInterval(-1, 1);

    it('should handle >= operator', () => {
      const result = baseInterval.applyConstraint('>=', 0.5);
      expect(result.min).toBe(0.5);
      expect(result.max).toBe(1);
    });

    it('should handle <= operator', () => {
      const result = baseInterval.applyConstraint('<=', 0.5);
      expect(result.min).toBe(-1);
      expect(result.max).toBe(0.5);
    });

    it('should handle > operator', () => {
      const result = baseInterval.applyConstraint('>', 0.5);
      expect(result.min).toBeGreaterThan(0.5);
      expect(result.max).toBe(1);
    });

    it('should handle < operator', () => {
      const result = baseInterval.applyConstraint('<', 0.5);
      expect(result.min).toBe(-1);
      expect(result.max).toBeLessThan(0.5);
    });

    it('should handle == operator', () => {
      const result = baseInterval.applyConstraint('==', 0.5);
      expect(result.min).toBe(0.5);
      expect(result.max).toBe(0.5);
    });

    it('should create empty interval when >= constraint exceeds max', () => {
      const narrow = new AxisInterval(0, 0.3);
      const result = narrow.applyConstraint('>=', 0.5);
      expect(result.isEmpty()).toBe(true);
    });

    it('should create empty interval when <= constraint is below min', () => {
      const narrow = new AxisInterval(0.5, 1);
      const result = narrow.applyConstraint('<=', 0.3);
      expect(result.isEmpty()).toBe(true);
    });

    it('should handle negative threshold values', () => {
      const result = baseInterval.applyConstraint('<=', -0.5);
      expect(result.min).toBe(-1);
      expect(result.max).toBe(-0.5);
    });

    it('should throw for unknown operator', () => {
      expect(() => baseInterval.applyConstraint('!=', 0.5)).toThrow(
        'Unknown operator: !='
      );
    });

    it('should throw for non-numeric value', () => {
      expect(() => baseInterval.applyConstraint('>=', 'high')).toThrow(
        'applyConstraint requires a finite numeric value'
      );
    });

    it('should return new instance (immutability)', () => {
      const original = new AxisInterval(0, 1);
      const result = original.applyConstraint('>=', 0.5);
      expect(result).not.toBe(original);
      expect(original.min).toBe(0);
      expect(original.max).toBe(1);
    });
  });

  describe('contains()', () => {
    const interval = new AxisInterval(0, 1);

    it('should return true for value within bounds', () => {
      expect(interval.contains(0.5)).toBe(true);
    });

    it('should return true for value at min bound', () => {
      expect(interval.contains(0)).toBe(true);
    });

    it('should return true for value at max bound', () => {
      expect(interval.contains(1)).toBe(true);
    });

    it('should return false for value below min', () => {
      expect(interval.contains(-0.1)).toBe(false);
    });

    it('should return false for value above max', () => {
      expect(interval.contains(1.1)).toBe(false);
    });
  });

  describe('width()', () => {
    it('should return correct width for valid interval', () => {
      const interval = new AxisInterval(0, 1);
      expect(interval.width()).toBe(1);
    });

    it('should return 0 for single point interval', () => {
      const interval = new AxisInterval(0.5, 0.5);
      expect(interval.width()).toBe(0);
    });

    it('should return negative for empty interval', () => {
      const interval = new AxisInterval(1, 0);
      expect(interval.width()).toBe(-1);
    });
  });

  describe('Static Factory Methods', () => {
    it('forMoodAxis() should create [-1, 1] interval', () => {
      const interval = AxisInterval.forMoodAxis();
      expect(interval.min).toBe(-1);
      expect(interval.max).toBe(1);
    });

    it('forSexualAxis() should create [0, 1] interval', () => {
      const interval = AxisInterval.forSexualAxis();
      expect(interval.min).toBe(0);
      expect(interval.max).toBe(1);
    });

    it('forRawMoodAxis() should create [-100, 100] interval', () => {
      const interval = AxisInterval.forRawMoodAxis();
      expect(interval.min).toBe(-100);
      expect(interval.max).toBe(100);
    });

    it('forRawSexualAxis() should create [0, 100] interval', () => {
      const interval = AxisInterval.forRawSexualAxis();
      expect(interval.min).toBe(0);
      expect(interval.max).toBe(100);
    });

    it('empty() should create an empty interval', () => {
      const interval = AxisInterval.empty();
      expect(interval.isEmpty()).toBe(true);
    });
  });

  describe('toJSON()', () => {
    it('should serialize to object with min and max', () => {
      const interval = new AxisInterval(0.25, 0.75);
      const json = interval.toJSON();
      expect(json).toEqual({ min: 0.25, max: 0.75 });
    });

    it('should be JSON.stringify compatible', () => {
      const interval = new AxisInterval(-0.5, 0.5);
      const str = JSON.stringify(interval);
      expect(str).toBe('{"min":-0.5,"max":0.5}');
    });
  });

  describe('toString()', () => {
    it('should return bracket notation for valid interval', () => {
      const interval = new AxisInterval(0, 1);
      expect(interval.toString()).toBe('[0, 1]');
    });

    it('should return [empty] for empty interval', () => {
      const interval = new AxisInterval(1, 0);
      expect(interval.toString()).toBe('[empty]');
    });

    it('should handle negative values', () => {
      const interval = new AxisInterval(-1, 0.5);
      expect(interval.toString()).toBe('[-1, 0.5]');
    });
  });
});
