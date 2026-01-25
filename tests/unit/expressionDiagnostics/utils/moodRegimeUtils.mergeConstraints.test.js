/**
 * @file Unit tests for moodRegimeUtils.js - convertAxisConstraintsToMoodConstraints and mergeConstraints
 */

import { describe, expect, it } from '@jest/globals';
import {
  convertAxisConstraintsToMoodConstraints,
  mergeConstraints,
} from '../../../../src/expressionDiagnostics/utils/moodRegimeUtils.js';

describe('moodRegimeUtils', () => {
  describe('convertAxisConstraintsToMoodConstraints', () => {
    it('should return empty array for null input', () => {
      const result = convertAxisConstraintsToMoodConstraints(null);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined input', () => {
      const result = convertAxisConstraintsToMoodConstraints(undefined);
      expect(result).toEqual([]);
    });

    it('should return empty array for non-Map input', () => {
      const result = convertAxisConstraintsToMoodConstraints({ valence: { min: 0.3 } });
      expect(result).toEqual([]);
    });

    it('should return empty array for empty Map', () => {
      const result = convertAxisConstraintsToMoodConstraints(new Map());
      expect(result).toEqual([]);
    });

    it('should convert single axis with min constraint', () => {
      const axisConstraints = new Map([
        ['valence', { min: 0.35 }],
      ]);

      const result = convertAxisConstraintsToMoodConstraints(axisConstraints);

      expect(result).toEqual([
        {
          varPath: 'moodAxes.valence',
          operator: '>=',
          threshold: 0.35,
          source: 'prototype-gate',
        },
      ]);
    });

    it('should convert single axis with max constraint', () => {
      const axisConstraints = new Map([
        ['arousal', { max: 0.7 }],
      ]);

      const result = convertAxisConstraintsToMoodConstraints(axisConstraints);

      expect(result).toEqual([
        {
          varPath: 'moodAxes.arousal',
          operator: '<=',
          threshold: 0.7,
          source: 'prototype-gate',
        },
      ]);
    });

    it('should convert single axis with both min and max constraints', () => {
      const axisConstraints = new Map([
        ['valence', { min: 0.2, max: 0.8 }],
      ]);

      const result = convertAxisConstraintsToMoodConstraints(axisConstraints);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        varPath: 'moodAxes.valence',
        operator: '>=',
        threshold: 0.2,
        source: 'prototype-gate',
      });
      expect(result).toContainEqual({
        varPath: 'moodAxes.valence',
        operator: '<=',
        threshold: 0.8,
        source: 'prototype-gate',
      });
    });

    it('should convert multiple axes', () => {
      const axisConstraints = new Map([
        ['valence', { min: 0.35 }],
        ['arousal', { max: 0.6 }],
        ['dominance', { min: 0.1, max: 0.9 }],
      ]);

      const result = convertAxisConstraintsToMoodConstraints(axisConstraints);

      expect(result).toHaveLength(4);
      expect(result.filter((c) => c.varPath === 'moodAxes.valence')).toHaveLength(1);
      expect(result.filter((c) => c.varPath === 'moodAxes.arousal')).toHaveLength(1);
      expect(result.filter((c) => c.varPath === 'moodAxes.dominance')).toHaveLength(2);
    });

    it('should skip non-numeric bounds', () => {
      const axisConstraints = new Map([
        ['valence', { min: 'invalid', max: 0.8 }],
      ]);

      const result = convertAxisConstraintsToMoodConstraints(axisConstraints);

      expect(result).toEqual([
        {
          varPath: 'moodAxes.valence',
          operator: '<=',
          threshold: 0.8,
          source: 'prototype-gate',
        },
      ]);
    });

    it('should handle zero thresholds correctly', () => {
      const axisConstraints = new Map([
        ['valence', { min: 0, max: 0 }],
      ]);

      const result = convertAxisConstraintsToMoodConstraints(axisConstraints);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        varPath: 'moodAxes.valence',
        operator: '>=',
        threshold: 0,
        source: 'prototype-gate',
      });
      expect(result).toContainEqual({
        varPath: 'moodAxes.valence',
        operator: '<=',
        threshold: 0,
        source: 'prototype-gate',
      });
    });

    it('should handle negative thresholds', () => {
      const axisConstraints = new Map([
        ['valence', { min: -0.5, max: -0.1 }],
      ]);

      const result = convertAxisConstraintsToMoodConstraints(axisConstraints);

      expect(result).toContainEqual({
        varPath: 'moodAxes.valence',
        operator: '>=',
        threshold: -0.5,
        source: 'prototype-gate',
      });
      expect(result).toContainEqual({
        varPath: 'moodAxes.valence',
        operator: '<=',
        threshold: -0.1,
        source: 'prototype-gate',
      });
    });
  });

  describe('mergeConstraints', () => {
    it('should return empty array when both inputs are empty', () => {
      const result = mergeConstraints([], []);
      expect(result).toEqual([]);
    });

    it('should return empty array when both inputs are null', () => {
      const result = mergeConstraints(null, null);
      expect(result).toEqual([]);
    });

    it('should return empty array when both inputs are undefined', () => {
      const result = mergeConstraints(undefined, undefined);
      expect(result).toEqual([]);
    });

    it('should return direct constraints when prototype constraints are empty', () => {
      const direct = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 0.5 },
      ];

      const result = mergeConstraints(direct, []);

      expect(result).toEqual(direct);
    });

    it('should return prototype constraints when direct constraints are empty', () => {
      const prototype = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 0.35, source: 'prototype-gate' },
      ];

      const result = mergeConstraints([], prototype);

      expect(result).toEqual(prototype);
    });

    it('should merge non-overlapping constraints', () => {
      const direct = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 0.5 },
      ];
      const prototype = [
        { varPath: 'moodAxes.arousal', operator: '<=', threshold: 0.6, source: 'prototype-gate' },
      ];

      const result = mergeConstraints(direct, prototype);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(direct[0]);
      expect(result).toContainEqual(prototype[0]);
    });

    it('should give direct constraints precedence for duplicates (same varPath and operator)', () => {
      const direct = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 0.5 },
      ];
      const prototype = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 0.35, source: 'prototype-gate' },
      ];

      const result = mergeConstraints(direct, prototype);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(direct[0]);
      expect(result[0].threshold).toBe(0.5);
    });

    it('should not treat different operators as duplicates', () => {
      const direct = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 0.5 },
      ];
      const prototype = [
        { varPath: 'moodAxes.valence', operator: '<=', threshold: 0.8, source: 'prototype-gate' },
      ];

      const result = mergeConstraints(direct, prototype);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(direct[0]);
      expect(result).toContainEqual(prototype[0]);
    });

    it('should preserve order with direct constraints first', () => {
      const direct = [
        { varPath: 'moodAxes.arousal', operator: '>=', threshold: 0.3 },
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 0.5 },
      ];
      const prototype = [
        { varPath: 'moodAxes.dominance', operator: '<=', threshold: 0.7, source: 'prototype-gate' },
      ];

      const result = mergeConstraints(direct, prototype);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(direct[0]);
      expect(result[1]).toEqual(direct[1]);
      expect(result[2]).toEqual(prototype[0]);
    });

    it('should handle complex merge scenario with multiple overlaps', () => {
      const direct = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 0.5 },
        { varPath: 'moodAxes.arousal', operator: '<=', threshold: 0.7 },
      ];
      const prototype = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 0.35, source: 'prototype-gate' },
        { varPath: 'moodAxes.valence', operator: '<=', threshold: 0.9, source: 'prototype-gate' },
        { varPath: 'moodAxes.arousal', operator: '>=', threshold: 0.1, source: 'prototype-gate' },
        { varPath: 'moodAxes.dominance', operator: '>=', threshold: 0.2, source: 'prototype-gate' },
      ];

      const result = mergeConstraints(direct, prototype);

      expect(result).toHaveLength(5);

      // Direct constraints preserved
      expect(result).toContainEqual({ varPath: 'moodAxes.valence', operator: '>=', threshold: 0.5 });
      expect(result).toContainEqual({ varPath: 'moodAxes.arousal', operator: '<=', threshold: 0.7 });

      // Non-overlapping prototype constraints added
      expect(result).toContainEqual({ varPath: 'moodAxes.valence', operator: '<=', threshold: 0.9, source: 'prototype-gate' });
      expect(result).toContainEqual({ varPath: 'moodAxes.arousal', operator: '>=', threshold: 0.1, source: 'prototype-gate' });
      expect(result).toContainEqual({ varPath: 'moodAxes.dominance', operator: '>=', threshold: 0.2, source: 'prototype-gate' });

      // Overlapping prototype constraint NOT included
      const overlappingConstraint = result.find(
        (c) => c.varPath === 'moodAxes.valence' && c.operator === '>=' && c.threshold === 0.35
      );
      expect(overlappingConstraint).toBeUndefined();
    });

    it('should handle null direct with valid prototype', () => {
      const prototype = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 0.35, source: 'prototype-gate' },
      ];

      const result = mergeConstraints(null, prototype);

      expect(result).toEqual(prototype);
    });

    it('should handle valid direct with null prototype', () => {
      const direct = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 0.5 },
      ];

      const result = mergeConstraints(direct, null);

      expect(result).toEqual(direct);
    });
  });
});
